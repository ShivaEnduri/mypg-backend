import getDB from "./dbResolver.js";

/**
 * Get Prisma Model Dynamically
 */
const getModel = (modelName, db = "pg", tx = null) => {

  // ✅ Use transaction client if exists, else normal client
  const client = tx ?? getDB(db);

  // ✅ Validate model existence
  if (!client[modelName]) {
    throw new Error(`Model '${modelName}' not found in DB '${db}'`);
  }

  return client[modelName];
};

export default getModel;