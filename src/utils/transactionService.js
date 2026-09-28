/**
 * Import DB resolver (Multi-DB Prisma v5)
 */
import getDB from "../utils/dbResolver.js";

/**
 * Import service layer
 */
import * as service from "../services/services.js";


/**
 * Run Multiple Database Operations Inside a Transaction
 */
export const runTransaction1 = async (
  db = "default",   // ✅ NEW (dynamic DB)
  operations = []
) => {

  /**
   * Get correct Prisma client
   */
  const prisma = getDB(db);

  /**
   * Start transaction
   */
  return prisma.$transaction(async (tx) => {

    const results = [];

    for (const op of operations) {

      const {
        model,
        action,
        id,
        data = {},
        where = {},
        filters = {}
      } = op;

      /**
       * Get model from transaction client
       */
      const modelTx = tx[model];

      if (!modelTx) {
        throw new Error(`Invalid model in transaction: ${model}`);
      }

      switch (action) {

        case "create":
          results.push(
            await service.create({
              db,
              model,
              data,
              prisma: tx
            })
          );
          break;

        case "update":
          results.push(
            await service.update(
              db,
              model,
              { id, where, data },
              tx
            )
          );
          break;

        case "delete":
          results.push(
            await service.remove(
              db,
              model,
              { id, where },
              tx
            )
          );
          break;

        case "findMany":
          results.push(
            await modelTx.findMany({
              where: filters
            })
          );
          break;

        default:
          throw new Error(
            `Unsupported transaction action: ${action}`
          );
      }
    }

    return results;
  });
};
export const runTransaction = async (
  db = "default",
  operations = []
) => {

  const prisma = getDB(db);

  if (!prisma || typeof prisma.$transaction !== "function") {
    throw new Error("Invalid Prisma client returned from getDB()");
  }

  return await prisma.$transaction(async (tx) => {

    const results = [];

    for (const op of operations) {

      const {
        model,
        action,
        id,
        data = {},
        where = {},
        filters = {}
      } = op;

      const modelTx = tx[model];

      if (!modelTx) {
        throw new Error(`Invalid model in transaction: ${model}`);
      }

      switch (action) {

        case "create":
          results.push(
            await service.create({
              db,
              model,
              data,
              prisma: tx
            })
          );
          break;

        case "update":
          results.push(
            await service.update(
              db,
              model,
              { id, where, data },
              tx
            )
          );
          break;

        case "delete":
          results.push(
            await service.remove(
              db,
              model,
              { id, where },
              tx
            )
          );
          break;

        case "findMany":
          results.push(
            await modelTx.findMany({
              where: filters
            })
          );
          break;

        default:
          throw new Error(
            `Unsupported transaction action: ${action}`
          );
      }

    }

    return results;

  });
};