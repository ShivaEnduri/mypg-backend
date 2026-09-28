import getModel from "../utils/modelResolver.js";
import S3Service from "../utils/mediaservices.js";

const s3Service = new S3Service();
import getDB from "../utils/dbResolver.js"
import {
  buildRelations,
  removeEmptyFields,
  getModelMeta,
  parseRequest
} from "../utils/dynamicInclude.js";
import redisManager from "../utils/redis.js";
import {
  buildNestedWhere,
  RELATION_FILTERS,
  getBedInfo,
  executeSpecialHandler,
  handleSpecialCreate,
  handleFileUpload,
  handleKycCreate,
  handleMediaUploadAndUpdate,
  handlePgInfoUpdate,
  handlePgKycUpdate,
  getAmenitiesWithFilters,
  parseQueryParams,
   specialAllowedParams,
   generateBookingNumber ,
    formatIST,
  formatResponseDates,
  handlePgBookingUpdate
  
} from "../utils/helper.js";
import { flattenResponse } from "../utils/responseFormatter.js";




const parseISTDate = (value) => {
  if (!value) return value;

  // =====================================
  // YYYY-MM-DD
  // =====================================

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {

    const [year, month, day] =
      value.split("-").map(Number);

    // Keep the same clock time
    return new Date(
      Date.UTC(
        year,
        month - 1,
        day,
        0,
        0,
        0
      )
    );
  }


  // =====================================
  // YYYY-MM-DD HH:mm:ss
  // =====================================

  if (
    /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(value)
  ) {

    const [datePart, timePart] =
      value.split(" ");

    const [year, month, day] =
      datePart.split("-").map(Number);

    const [hour, minute, second] =
      timePart.split(":").map(Number);

    // IMPORTANT:
    // Do NOT subtract 5:30.
    //
    // We want MySQL DATETIME to contain
    // exactly the same India clock time.

    return new Date(
      Date.UTC(
        year,
        month - 1,
        day,
        hour,
        minute,
        second
      )
    );
  }


  // =====================================
  // ISO Date
  // =====================================

  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Date(value);
  }


  return value;
};


const convertDateFields = (obj) => {
  if (!obj || typeof obj !== "object") {
    return obj;
  }

  for (const key in obj) {
    const value = obj[key];

    if (value == null) {
      continue;
    }

    // =====================================
    // STRING DATE
    // =====================================

    if (typeof value === "string") {
      const parsedDate = parseISTDate(value);

      if (
        parsedDate instanceof Date &&
        !isNaN(parsedDate.getTime())
      ) {
        obj[key] = parsedDate;
        continue;
      }
    }

    // =====================================
    // ARRAY
    // =====================================

    if (Array.isArray(value)) {
      value.forEach(convertDateFields);
      continue;
    }

    // =====================================
    // NESTED OBJECT
    // =====================================

    if (
      typeof value === "object" &&
      !(value instanceof Date)
    ) {
      convertDateFields(value);
    }
  }

  return obj;
};



const create = async ({ db, model, data, files }) => {

  const dbClient = getDB(db);

  /* ===============================
     🔥 KYC SPECIAL CASE
  =============================== */

  if (model === "dy_pg_kyc_info") {

    return await handleKycCreate({
      data,
      files,
      prisma: dbClient,
    });
  }


  const prismaModel =
    getModel(model, db, dbClient);

  let createdData;


  /* ===============================
     ✅ DB TRANSACTION
  =============================== */

  if (
    model === "dy_pg_info" ||
    model === "dy_pg_bookings"
  ) {

    createdData = await dbClient.$transaction(
      async (tx) => {

        let parsedData = data;


        // =====================================
        // HANDLE STRING DATA
        // =====================================

        if (typeof parsedData === "string") {
          parsedData = JSON.parse(parsedData);
        }


        // =====================================
        // HANDLE MULTIPART PAYLOAD
        // =====================================

        if (parsedData?.payload) {
          parsedData =
            JSON.parse(parsedData.payload);
        }


        // =====================================
        // UNWRAP { data: {...} }
        // =====================================

        if (parsedData?.data) {
          parsedData = parsedData.data;
        }


        // =====================================
        // CONVERT DATE FIELDS
        // =====================================

        parsedData =
          convertDateFields(parsedData);


        console.log(
          "========== SPECIAL CREATE DEBUG =========="
        );

        console.log(
          "DB:",
          db
        );

        console.log(
          "MODEL:",
          model
        );

        console.log(
          "RAW DATA:",
          data
        );

        console.log(
          "PARSED DATA:",
          parsedData
        );


        // =====================================
        // SPECIAL CREATE
        // =====================================

        const special =
          await handleSpecialCreate({
            modelName: model,
            data: parsedData,
            prisma: tx,
            db,
          });


        if (special?.data) {
          return special.data;
        }


        throw new Error(
          "Special create failed"
        );
      }
    );

  } else {

    /* ===============================
       NORMAL CREATE
    =============================== */

    let parsedData = data;


    // =====================================
    // PARSE JSON STRING
    // =====================================

    if (typeof parsedData === "string") {
      parsedData = JSON.parse(parsedData);
    }


    // =====================================
    // HANDLE MULTIPART PAYLOAD
    // =====================================

    if (parsedData?.payload) {
      parsedData =
        JSON.parse(parsedData.payload);
    }


    // =====================================
    // UNWRAP { data: {...} }
    // =====================================

    if (parsedData?.data) {
      parsedData = parsedData.data;
    }


    // =====================================
    // CONVERT DATE FIELDS
    // =====================================

    parsedData =
      convertDateFields(parsedData);


    console.log(
      "========== CREATE DEBUG =========="
    );

    console.log(
      "DB:",
      db
    );

    console.log(
      "MODEL:",
      model
    );

    console.log(
      "PARSED DATA:",
      parsedData
    );

    console.log(
      "=================================="
    );


    // =====================================
    // CREATE ONLY ONCE
    // =====================================

    createdData =
      await prismaModel.create({
        data: parsedData,
      });
  }


  /* ===============================
     ✅ CHECK CREATE
  =============================== */

  if (!createdData) {
    throw new Error(
      "Create operation failed"
    );
  }


  /* ===============================
     ✅ S3 UPLOAD
     ONLY IF FILES
  =============================== */

  let media = null;


  if (
    files &&
    Object.keys(files).length > 0
  ) {

    media =
      await handleMediaUploadAndUpdate({
        model,
        files,
        createdData,
        prisma: dbClient,
      });
  }


  /* ===============================
     ✅ FINAL RESPONSE
  =============================== */

  // IMPORTANT:
  // Convert Date objects to IST
  // before sending response.

  const response =
    formatResponseDates(createdData);


  /* ===============================
     ✅ MEDIA RESPONSE
  =============================== */

  if (
    media &&
    (media.media || media)
  ) {

    response.media =
      media.media || media;
  }


  /* ===============================
     ✅ CLEAR CACHE
  =============================== */

  await redisManager.invalidate(
    db,
    model
  );


  return response;
};






const getAmenities = async (req, res) => {
  try {
    const { community_id, amenity_id, category_id } = req.query;

    if (!community_id) {
      return res.status(400).json({
        error: "community_id is required"
      });
    }

    const results = await getAmenitiesWithFilters(
      this.prisma,
      { community_id, amenity_id, category_id }
    );

    // ✅ GROUPING (same as your SQL logic)
    const grouped = results.reduce((acc, item) => {

      const communityName = item.st_community?.name;
      const categoryName =
        item.st_amenities?.st_amenity_category?.amenity_category;

      const key = `${communityName}-${categoryName}`;

      if (!acc[key]) {
        acc[key] = {
          community_name: communityName,
          category: categoryName,
          amenities: []
        };
      }

      acc[key].amenities.push(
        item.st_amenities?.amenity_name
      );

      return acc;

    }, {});

    return res.status(200).json({
      message: "Amenities retrieved successfully",
      amenities: Object.values(grouped)
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Error fetching amenities",
      details: error.message
    });
  }
  // your logic
};

/**
 * =========================
 * FIND MANY WITH RELATIONS
 * =========================
 *
 * Fetch multiple records with optional
 * relations and pagination.
 */

/**
 * Function: getAllJoin
 *
 * Purpose:
 * Fetch records from a Prisma model with:
 * - dynamic filters
 * - nested relation filters
 * - pagination
 * - custom formatted response for specific models
 *
 * Parameters:
 *
 * db        → database key (PG / RUF etc)
 * modelName → Prisma model/table name
 * filters   → filters passed from API
 * page      → pagination page number
 * limit     → number of records per page
 */




/**
 * =========================
 * HELPER FUNCTION
 * =========================
 *
 * Resolve ID from request object.
 *
 * Supports multiple sources:
 * params → /users/:id
 * query  → ?id=10
 * body   → { id: 10 }
 */
const resolveId = (req) => {
  return (
    req?.params?.id ||
    req?.query?.id ||
    req?.body?.id ||
    null
  );
};


/**
 * =========================
 * FIND BY ID
 * =========================
 *
 * Fetch a single record with relations.
 */












const getRecords = async (
  db,
  modelName,
  req,
  {
    filters = {},
    include = {},
    page = 1,
    limit = 100
  } = {},
  prismaClient = null
) => {

  const client = prismaClient || getDB(db);
  const model = getModel(modelName, db, client);
  
  /* ===============================
    🔹 QUERY PARAMS
  ================================ */

  const {
    page: queryPage,
    limit: queryLimit,
    id: queryId,
    noCache,

    sortBy,
    sortOrder,
    fields,
    include: queryInclude,

    count,
    sum,
    avg,
    min,
    max,
    groupBy,

    ...filterQuery
  } = req.query;

  /* ===============================
     🔹 ID RESOLUTION
  =============================== */
  const id =
    req.params?.id ||
    queryId ||
    req.body?.id ||
    null;

  /* ===============================
    🔹 MODEL META
  =============================== */
  const dmmf = await getModelMeta(db);

  const modelMeta = dmmf.datamodel.models.find(
    m => m.name === modelName
  );

  const validFields = modelMeta.fields.map(f => f.name);

  const numericFields = modelMeta.fields
  .filter(f =>
    ["Int", "Float", "Decimal", "BigInt"].includes(f.type)
  )
  .map(f => f.name);

    const allowedParams = [
    "page",
    "limit",
    "id",
    "noCache",
    "sortBy",
    "sortOrder",
    "fields",
    "include",
    "count",
    "sum",
    "avg",
    "min",
    "max",
    "groupBy"
  ];

 const relationFilterFields = Object.keys(
  RELATION_FILTERS[modelName] || {}
);

const specialFields =
  specialAllowedParams[modelName] || [];

Object.keys(req.query).forEach(param => {

  if (
    allowedParams.includes(param) ||
    validFields.includes(param) ||
    relationFilterFields.includes(param) ||
    specialFields.includes(param)
  ) {
    return;
  }

  throw new Error(`Unknown query parameter: ${param}`);
});

  const relationFields = modelMeta.fields
  .filter(f => f.kind === "object")
  .map(f => f.name);

  /* ===============================
    🔹 PAGINATION
  ================================ */

  page = Number(queryPage ?? page);
  limit = Number(queryLimit ?? limit);

  if (!Number.isInteger(page) || page < 1) {
      throw new Error("page must be a positive integer");
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new Error("limit must be an integer between 1 and 100");
  }

  const skip = (page - 1) * limit;

  /* ===============================
    🔹 QUERY PARSING
  ================================ */

 const parsedQuery = parseQueryParams(
  filterQuery,
  modelMeta
);

console.log("RAW filterQuery:", filterQuery);
console.log("PARSED QUERY:", parsedQuery);

const where = buildNestedWhere(
  modelName,
  { ...filters, ...parsedQuery },
  RELATION_FILTERS,
  dmmf
);

console.log("FINAL WHERE:", JSON.stringify(where, null, 2));

  let orderBy = undefined;

    if (
    sortOrder &&
    !["asc", "desc"].includes(sortOrder.toLowerCase())
  ) {
    throw new Error("sortOrder must be asc or desc");
  }

  if (sortBy) {

    if (!validFields.includes(sortBy)) {
      throw new Error(`Invalid sort field: ${sortBy}`);
    }

    orderBy = {
      [sortBy]:
        sortOrder?.toLowerCase() === "desc"
          ? "desc"
          : "asc"
    };

  }

  const hasAggregate =
  count === "true" ||
  sum ||
  avg ||
  min ||
  max ||
  groupBy;


      const checkEmpty = (value, name) => {

      if (value !== undefined && value.trim() === "") {
        throw new Error(`${name} cannot be empty`);
      }

    };

    checkEmpty(fields, "fields");
    checkEmpty(queryInclude, "include");
    checkEmpty(sum, "sum");
    checkEmpty(avg, "avg");
    checkEmpty(min, "min");
    checkEmpty(max, "max");


    /* ===============================
      🔹 CACHE KEY
    =============================== */

    const cacheKeyFilters = {
        where,
        page,
        limit,
        id,
        fields,
        include: queryInclude,
        sortBy,
        sortOrder
    };

    const useNoCache = noCache === "true";

  /* ===============================
     ⚡ CACHE GET
  =============================== */
  if (!useNoCache) {
    const start = Date.now();
    const cached = await redisManager.get(db, modelName, cacheKeyFilters);

    if (cached !== null && cached !== undefined) {
      console.log(`⚡ CACHE HIT → ${modelName} (${Date.now() - start}ms)`);

      const isArray = Array.isArray(cached);

      return {
        success: true,
        source: "cache",
        count: isArray ? cached.length : (cached ? 1 : 0),
        result: isArray ? cached : (cached ? [cached] : [])
      };
    }

    console.log(`🐢 CACHE MISS → ${modelName}`);
  }

  /* ===============================
     🔹 RELATIONS
  =============================== */
  let finalInclude = buildRelations(modelName, dmmf);

  if (queryInclude) {

    finalInclude = {};

    queryInclude
      .split(",")
      .map(r => r.trim())
      .forEach(rel => {

        if (!relationFields.includes(rel)) {
          throw new Error(`Invalid relation: ${rel}`);
        }

        finalInclude[rel] = true;
      });

  }

  /* ===============================
     🔹 TRANSFORM (FIXED)
  =============================== */
  const applyTransform1 = (data) => {
    if (!data) return [];
    return Array.isArray(data)
      ? flattenResponse(data, modelName, dmmf)
      : flattenResponse([data], modelName, dmmf);
  };
  const applyTransform = (data) => {
  if (!data) {
    return [];
  }

  const dataArray = Array.isArray(data)
    ? data
    : [data];

  // ==========================================
  // DY USER + ROLE
  // ==========================================
  if (modelName === "dy_user") {
    return transformUserWithRole(dataArray);
  }

  // ==========================================
  // EXISTING GENERIC TRANSFORM
  // ==========================================
  return flattenResponse(
    dataArray,
    modelName,
    dmmf
  );
};

  let result;

  if (hasAggregate) {

  const aggregateArgs = {
    where
  };

  if (count === "true") {
    aggregateArgs._count = true;
  }

  const validateAggregateFields = (fields, allowed, operation) => {
    fields.split(",").map(f => f.trim()).forEach(field => {
        if (!allowed.includes(field)) {
            throw new Error(`${field} cannot be used with ${operation}`);
        }
    });
};

  if (sum) {
      validateAggregateFields(sum, numericFields, "sum");
  }

  if (avg) {
      validateAggregateFields(avg, numericFields, "avg");
  }

  if (min) {
      validateAggregateFields(min, validFields, "min");
  }

  if (max) {
      validateAggregateFields(max, validFields, "max");
  }

  result = await model.aggregate(aggregateArgs);

  return {
    success: true,
    source: "db",
    result
  };
}

let select;

if (fields) {

  const requested = fields.split(",").map(f => f.trim());

  requested.forEach(field => {

    if (!validFields.includes(field)) {
      throw new Error(`Invalid field: ${field}`);
    }

  });

  select = Object.fromEntries(
    requested.map(field => [field, true])
  );
}

  /* ===============================
    🔥 FETCH DATA
  =============================== */

  if (id) {
    where.id = Number(id);
  }

  const specialResult = await executeSpecialHandler(
    modelName,
    model,
    where,
    skip,
    limit
  );

  result = specialResult || await model.findMany({
      where,
      ...(select ? { select } : { include: finalInclude }),
      orderBy,
      skip,
      take: limit,
  });

  const finalData = applyTransform(result);

  /* ===============================
     💾 CACHE SET (SAFE)
  =============================== */
  if (!useNoCache) {
    if (finalData && finalData.length > 0) {
      const key = await redisManager.set(
        db,
        modelName,
        cacheKeyFilters,
        finalData
      );

      if (key) {
        console.log(`💾 CACHE SET → ${modelName}`);
      }
    } else {
      console.log(`⚠️ SKIP CACHE EMPTY → ${modelName}`);
    }
  }

  /* ===============================
     ✅ FINAL RESPONSE (CLEAN)
  =============================== */
  return {
    success: true,
    source: "db",
    count: finalData.length,
    result: finalData
  };
};
/**
 * =========================
 * UPDATE RECORD
 * =========================
 */




const update1 = async (
  db,
  modelName,
  { id, where, data },
  tx = null,
  files = null
) => {

  const client = tx || getDB(db);
  const model = getModel(modelName, db, client);


  if ((!where || Object.keys(where).length === 0) && !id) {
    throw new Error("Update requires where or id");
  }

  const recordId = id || where?.id;
  const finalId = Number(recordId);

  if (recordId && isNaN(finalId)) {
    throw new Error("Invalid ID");
  }

  /* =====================================================
     🔥 SPECIAL CASE: dy_pg_info
  ===================================================== */
  if (modelName === "dy_pg_info") {
    const result = await handlePgInfoUpdate({
      model,
      recordId: finalId,
      data,
      files,
      tx: client
    });

    // ✅ Remove empty media
    if (!files || Object.keys(files).length === 0) {
      delete result?.media;
    }

    return result;
  }

  /* =====================================================
     🔥 SPECIAL CASE: dy_pg_kyc_info
  ===================================================== */
  if (modelName === "dy_pg_kyc_info") {
    const result = await handlePgKycUpdate({
      model,
      recordId: finalId,
      data,
      files
    });

    if (!files || Object.keys(files).length === 0) {
      delete result?.media;
    }

    return result;
  }

  /* =====================================================
     ✅ NORMAL UPDATE
  ===================================================== */
  const updatedData = await model.update({
    where: where && Object.keys(where).length
      ? where
      : { id: finalId },
    data
  });

  /* =====================================================
     ✅ FILE UPLOAD (OPTIONAL)
  ===================================================== */
  let media = null;

  if (files && Object.keys(files).length > 0) {
    media = await handleMediaUploadAndUpdate({
      model: modelName,
      files,
      createdData: updatedData,
      prisma: client
    });
  }

  /* =====================================================
     ✅ FINAL RESPONSE
  ===================================================== */
  const response = {
    ...updatedData
  };

  if (media && (media.media || media)) {
    response.media = media.media || media;
  }

  // ✅ CLEAR CACHE
await redisManager.invalidate(db, model);

  return response;
};


const update = async (
  db,
  modelName,
  { id, where, data },
  tx = null,
  files = null
) => {

  const client = tx || getDB(db);
  const model = getModel(modelName, db, client);

  if ((!where || Object.keys(where).length === 0) && !id) {
    throw new Error("Update requires where or id");
  }

  const recordId = id || where?.id;
  const finalId = Number(recordId);

  if (recordId && isNaN(finalId)) {
    throw new Error("Invalid ID");
  }

  /* =====================================================
     SPECIAL CASE: dy_pg_info
  ===================================================== */

  if (modelName === "dy_pg_info") {

    const result = await handlePgInfoUpdate({
      model,
      recordId: finalId,
      data,
      files,
      tx: client
    });

    if (!files || Object.keys(files).length === 0) {
      delete result?.media;
    }

    return result;
  }

  /* =====================================================
     SPECIAL CASE: dy_pg_kyc_info
  ===================================================== */

  if (modelName === "dy_pg_kyc_info") {

    const result = await handlePgKycUpdate({
      model,
      recordId: finalId,
      data,
      files
    });

    if (!files || Object.keys(files).length === 0) {
      delete result?.media;
    }

    return result;
  }

  /* =====================================================
     🔥 SPECIAL CASE: dy_pg_bookings
  ===================================================== */

  if (modelName === "dy_pg_bookings") {

    const updatedBooking = await handlePgBookingUpdate({
      model,
      recordId: finalId,
      where,
      data,
      tx: client
    });

    // Optional media handling if bookings support files
    let media = null;

    if (files && Object.keys(files).length > 0) {
      media = await handleMediaUploadAndUpdate({
        model: modelName,
        files,
        createdData: updatedBooking,
        prisma: client
      });
    }

    const response = {
      ...updatedBooking
    };

    if (media && (media.media || media)) {
      response.media = media.media || media;
    }

    await redisManager.invalidate(db, model);

    return response;
  }

  /* =====================================================
     NORMAL UPDATE
  ===================================================== */

  const updatedData = await model.update({
    where:
      where && Object.keys(where).length
        ? where
        : { id: finalId },
    data
  });

  /* =====================================================
     FILE UPLOAD
  ===================================================== */

  let media = null;

  if (files && Object.keys(files).length > 0) {
    media = await handleMediaUploadAndUpdate({
      model: modelName,
      files,
      createdData: updatedData,
      prisma: client
    });
  }

  /* =====================================================
     FINAL RESPONSE
  ===================================================== */

  const response = {
    ...updatedData
  };

  if (media && (media.media || media)) {
    response.media = media.media || media;
  }

  await redisManager.invalidate(db, model);

  return response;
};

/**
 * =========================
 * DELETE RECORD
 * =========================
 */


const remove = (db, modelName, { id, where }, tx = null) => {
  const model = getModel(modelName, db, tx);

  const finalId = id ? Number(id) : null;

  if ((!where || Object.keys(where).length === 0) && !finalId) {
    throw new Error("Delete requires where or id");
  }

  return model.delete({
    where: where && Object.keys(where).length
      ? where
      : { id: finalId }
  });
  
};


/**
 * =========================
 * AGGREGATE QUERY
 * =========================
 *
 * Perform aggregate functions like:
 * count, sum, avg, min, max
 */
const aggregate = (db, modelName, filters = {}, aggregates = {}) => {

  return getModel(modelName, db).aggregate({

    /**
     * Apply filters if present
     */
    ...(Object.keys(filters).length && { where: filters }),

    /**
     * Apply aggregate operations
     */
    ...aggregates,
  });
};


/**
 * =========================
 * GROUP BY QUERY
 * =========================
 *
 * Used for grouped aggregation queries.
 */
const groupBy = (db, modelName, by = [], aggregates = {}, having = {}) => {

  return getModel(modelName, db).groupBy({

    /**
     * Fields to group by
     */
    by,

    /**
     * Aggregate fields
     */
    ...aggregates,

    /**
     * Optional having condition
     */
    ...(Object.keys(having).length && { having }),
  });
};

const getPgInfoMedia = async ({ prisma, s3Service }) => {
  try {
    const basePrefix = "Pgdata/";
    const pgFolders = await s3Service.listFolders(basePrefix);

    if (!pgFolders.length) {
      return [];
    }

    const mediaResults = await Promise.all(
      pgFolders.map(async (folder) => {
        const pg_id = folder.replace("Pgdata/", "").replace("/", "");

        const [images, videos] = await Promise.all([
          s3Service.listObjects(`${folder}media/images`),
          s3Service.listObjects(`${folder}media/videos`)
        ]);

        if (!images.length && !videos.length) return null;

        return {
          pg_id,
          media: {
            images,
            videos
          }
        };
      })
    );

    return mediaResults.filter(Boolean);

  } catch (error) {
    throw new Error("Failed to fetch PG media files: " + error.message);
  }
};

const getPgKycDocuments = async ({ prisma, pg_info, s3Service }) => {
  try {
    if (!pg_info) {
      throw new Error("pg_info is required");
    }

    /* ─────────────────────────────
       1️⃣ Fetch PG
    ───────────────────────────── */
    const pg = await prisma.dy_pg_info.findUnique({
      where: { id: Number(pg_info) },
      select: { pg_documents_path: true }
    });

    if (!pg || !pg.pg_documents_path) {
      throw new Error("PG documents path not configured");
    }

    /* ─────────────────────────────
       2️⃣ Normalize Path
    ───────────────────────────── */
    let prefix = pg.pg_documents_path.trim();

    prefix = prefix.replace(/\/$/, "");

    if (prefix.endsWith("/info")) {
      prefix = prefix.replace(/\/info$/, "/kyc");
    } else if (!prefix.endsWith("/kyc")) {
      prefix = `${prefix}/kyc`;
    }

    prefix += "/";

    console.log("KYC S3 Prefix:", prefix);

    /* ─────────────────────────────
       3️⃣ Fetch Documents
    ───────────────────────────── */
    const documents = await s3Service.listObjects(prefix, ".pdf");

    return {
      pg_info,
      documents_url: documents
    };

  } catch (error) {
    throw new Error("Failed to fetch PG KYC documents: " + error.message);
  }
};

const getProjectDocuments = async ({
  prisma,
  project_formatted_id,
  s3Service
}) => {

  if (!project_formatted_id) {
    throw new Error("project_formatted_id is required");
  }

  const project = await prisma.std_project.findFirst({
    where: {
      project_formatted_id
    },
    select: {
      project_formatted_id: true,
      project_name: true,
      documents_path: true
    }
  });

  if (!project) {
    throw new Error("Project not found");
  }

  if (!project.documents_path) {
    return {
      project_formatted_id,
      documents: []
    };
  }

  const documents = await s3Service.listObjects(
    project.documents_path
  );

  return {
    project_formatted_id,
    project_name: project.project_name,
    documents
  };
};

export default {
  create,
  getRecords,
  update,
  remove,
  aggregate,
  groupBy,
  getPgInfoMedia,
  getPgKycDocuments,
  getProjectDocuments,
  getAmenities
};