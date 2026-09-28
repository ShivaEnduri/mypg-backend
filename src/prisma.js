






import { PrismaClient as PgClient } from "../generated/pg/index.js";


// ✅ Single cache
const clients = {};

const getPrismaClient = (db = "pg") => {
  const key = db.toLowerCase();

  if (clients[key]) return clients[key];

  let client;

  switch (key) {
    case "pg":
      client = new PgClient({
        log: ["error", "warn"],
      });
      break;

   

    default:
      throw new Error(`Unknown DB: ${db}`);
  }

  clients[key] = client;
  return client;
};

// ✅ Default export (pg)
const prisma = getPrismaClient("pg");

export default prisma;
export { getPrismaClient };