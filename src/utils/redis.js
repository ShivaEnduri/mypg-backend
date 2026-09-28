




import Redis from "ioredis";

const log = {
  debug: (...args) => console.debug("[redis]", ...args),
  info: (...args) => console.info("[redis]", ...args),
  warn: (...args) => console.warn("[redis]", ...args),
  error: (...args) => console.error("[redis]", ...args),
};

const DEFAULT_DB_MAP = {
  pg: Number(process.env.REDIS_DB_PG) || 0,
  rufrent: Number(process.env.REDIS_DB_RUFRENT) || 1,
};

class RedisManager {
  constructor() {
    this.clients = new Map();
    this.readOnlyDetected = new Set();
    this.connectionFailed = false;

    this.enabled = process.env.ENABLE_REDIS === "true";

    if (!this.enabled) {
      log.warn("Redis disabled via ENABLE_REDIS");
      return;
    }

    this.redisHost = process.env.REDIS_HOST || "127.0.0.1";
    this.redisPort = Number(process.env.REDIS_PORT) || 6379;
    this.redisTTL = Number(process.env.REDIS_TTL) || 86400;
    this.dbMap = { ...DEFAULT_DB_MAP };

    this._initClients();
  }

  /* -----------------------------
     Normalize DB Key
  ----------------------------- */
  _normalizeConfigKey(key = "pg") {
    const map = {
      default: "pg",
      ruf: "rufrent",
    };

    return map[String(key).toLowerCase()] || String(key).toLowerCase();
  }

  /* -----------------------------
     Initialize Clients
  ----------------------------- */
  _initClients() {
    log.info(`Connecting Redis @ ${this.redisHost}:${this.redisPort}`);

    const baseConfig = {
      host: this.redisHost,
      port: this.redisPort,

      connectTimeout: 5000,
      maxRetriesPerRequest: 2,

      enableOfflineQueue: true, // ✅ FIXED

      retryStrategy: (times) => {
        if (times > 3) {
          log.warn("Redis unavailable → disabling cache");
          this.enabled = false;
          return null;
        }
        return 500;
      },
    };

    for (const [key, db] of Object.entries(this.dbMap)) {
      const client = new Redis({ ...baseConfig, db });

      client.on("connect", () => {
        log.info(`Redis connected → ${key} [DB ${db}]`);
      });

      client.on("ready", () => {
        log.info(`Redis ready → ${key}`);
      });

      client.on("error", (err) => {
        if (!this.connectionFailed) {
          this.connectionFailed = true;
          log.error(`Redis connection failed → ${err.message}`);
        }
      });

      this.clients.set(key, client);
    }
  }

  /* -----------------------------
     No-op client
  ----------------------------- */
  _noopClient() {
    return {
      status: "noop",
      get: async () => null,
      set: async () => null,
      del: async () => 0,
      scan: async () => ["0", []],
    };
  }

  /* -----------------------------
     Get Client (SAFE)
  ----------------------------- */
  getClient(configKey) {
    if (!this.enabled) return this._noopClient();

    const key = this._normalizeConfigKey(configKey);
    const client = this.clients.get(key);

    if (!client) {
      log.warn(`Redis client missing → ${key}`);
      return this._noopClient();
    }

    if (client.status !== "ready") {
      log.warn(`Redis not ready → ${key} (status: ${client.status})`);
      return this._noopClient();
    }

    return client;
  }

  /* -----------------------------
     Stable JSON stringify
  ----------------------------- */
  _stableStringify(obj) {
    if (obj === null || obj === undefined) return JSON.stringify(obj);

    if (Array.isArray(obj)) {
      return `[${obj.map((v) => this._stableStringify(v)).join(",")}]`;
    }

    if (typeof obj === "object") {
      return `{${Object.keys(obj)
        .sort()
        .map((k) => `${JSON.stringify(k)}:${this._stableStringify(obj[k])}`)
        .join(",")}}`;
    }

    return JSON.stringify(obj);
  }

  /* -----------------------------
     Build Cache Key
  ----------------------------- */
  _buildKey(configKey, tableName, filters = {}) {
    const dbKey = this._normalizeConfigKey(configKey);
    const hash = Buffer.from(this._stableStringify(filters)).toString("base64url");
    return `${dbKey}:${tableName}:${hash}`;
  }

  /* -----------------------------
     GET
  ----------------------------- */
  async get(configKey, tableName, filters = {}) {
    if (!this.enabled) return null;

    try {
      const client = this.getClient(configKey);
      if (client.status !== "ready") return null;

      const key = this._buildKey(configKey, tableName, filters);
      const data = await client.get(key);

      if (data) {
        log.debug(`CACHE HIT → ${key}`);
        return JSON.parse(data);
      }

      log.debug(`CACHE MISS → ${key}`);
      return null;
    } catch (err) {
      log.warn(`Redis GET failed → ${err.message}`);
      return null;
    }
  }

  /* -----------------------------
     SET
  ----------------------------- */
  async set(configKey, tableName, filters, data, ttl = null) {
    if (!this.enabled) return null;

    const dbKey = this._normalizeConfigKey(configKey);

    if (this.readOnlyDetected.has(dbKey)) return null;

    try {
      const client = this.getClient(dbKey);
      if (client.status !== "ready") return null;

      const key = this._buildKey(dbKey, tableName, filters);

      await client.set(
        key,
        JSON.stringify(data),
        "EX",
        ttl || this.redisTTL
      );

      log.debug(`CACHE SET → ${key}`);
      return key;

    } catch (err) {
      if (err.message?.includes("READONLY")) {
        this.readOnlyDetected.add(dbKey);
      }

      log.warn(`Redis SET failed → ${err.message}`);
      return null;
    }
  }

  /* -----------------------------
     INVALIDATE
  ----------------------------- */
  async invalidate(configKey, tableName, filters = null) {
    if (!this.enabled) return;

    try {
      const client = this.getClient(configKey);
      if (client.status !== "ready") return;

      if (filters) {
        const key = this._buildKey(configKey, tableName, filters);
        await client.del(key);
        log.debug(`CACHE DEL → ${key}`);
        return;
      }

      const pattern = `${this._normalizeConfigKey(configKey)}:${tableName}:*`;
      let cursor = "0";

      do {
        const [nextCursor, keys] = await client.scan(
          cursor,
          "MATCH",
          pattern,
          "COUNT",
          100
        );

        cursor = nextCursor;

        if (keys.length) {
          await client.del(...keys);
          log.debug(`CACHE INVALIDATED → ${keys.length} keys`);
        }
      } while (cursor !== "0");

    } catch (err) {
      log.warn(`Redis invalidate failed → ${err.message}`);
    }
  }

  /* -----------------------------
     Shutdown
  ----------------------------- */
  async disconnect() {
    for (const client of this.clients.values()) {
      await client.quit();
    }
    log.info("Redis disconnected");
  }
}

export default new RedisManager();