/**
 * Import the model resolver utility (ESM)
 */
import getModel from "../utils/modelResolver.js";


/**
 * ============================
 * FIND MANY (MULTI JOIN QUERY)
 * ============================
 */
export const findMany = (
  db, // ✅ NEW (dynamic DB support)
  modelName,
  filters = {},
  include = {},
  select = {},
  orderBy = {},
  pagination = {},
  tx = null // ✅ support transaction
) => {

  /**
   * Resolve the Prisma model dynamically
   */
  const model = getModel(modelName, db, tx);


  /**
   * Execute Prisma findMany query
   */
  return model.findMany({

    ...(Object.keys(filters).length && { where: filters }),

    ...(Object.keys(include).length && { include }),

    ...(Object.keys(select).length && { select }),

    ...(Object.keys(orderBy).length && { orderBy }),

    ...pagination,
  });
};