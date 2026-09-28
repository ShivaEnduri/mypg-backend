


/* =====================================================
   📦 DMMF CACHE (Performance Boost)
===================================================== */
const dmmfCache = {};


/* =====================================================
   🔍 Get Prisma DMMF metadata (FIXED + CACHED)
===================================================== */


const getModelMeta = async (db) => {
  let Prisma;

  switch (db.toLowerCase()) {
    case "pg":
    case "mypg":{
      const module = await import("../../generated/pg/index.js");
      Prisma = module.Prisma;
      break;
    }


    default:
      throw new Error(`Unknown database for DMMF: ${db}`);
  }

  if (!Prisma?.dmmf?.datamodel?.models) {
    throw new Error("Invalid DMMF structure");
  }

  return Prisma.dmmf;
};

/* =====================================================
   🔗 Build include relations dynamically (SAFE)
===================================================== */

const buildRelations = (modelName, dmmf) => {
  if (!dmmf?.datamodel?.models) return {};

  const model = dmmf.datamodel.models.find(
    m => m.name === modelName
  );

  if (!model) return {};

  const include = {};

  for (const field of model.fields) {
    if (
      field.kind === "object" &&
      field.relationName
    ) {
      include[field.name] = true;
    }
  }

  return include;
};


/* =====================================================
   🧹 Remove empty fields
===================================================== */
const removeEmptyFields = (data) => {

  if (Array.isArray(data)) {
    return data.map(item => removeEmptyFields(item));
  }

  if (data !== null && typeof data === "object") {

    const cleaned = {};

    Object.keys(data).forEach(key => {

      const value = data[key];

      if (Array.isArray(value) && value.length === 0) return;
      if (value === null) return;

      if (typeof value === "object") {

        const nested = removeEmptyFields(value);

        if (
          nested !== null &&
          !(Array.isArray(nested) && nested.length === 0) &&
          !(typeof nested === "object" && Object.keys(nested).length === 0)
        ) {
          cleaned[key] = nested;
        }

        return;
      }

      cleaned[key] = value;
    });

    return cleaned;
  }

  return data;
};


/* =====================================================
   📥 Parse request (filters + pagination)
===================================================== */
const parseRequest = (req = {}) => {

  const source = {
    ...(req.query || {}),
    ...(req.body || {})
  };

  const page = Number(source.page) || 1;
  const limit = Number(source.limit) || 10;

  const include = source.include || {};

  delete source.page;
  delete source.limit;
  delete source.include;

  return {
    filters: source,
    include,
    page,
    limit
  };
};


export {
  buildRelations,
  removeEmptyFields,
  getModelMeta,
  parseRequest
};