



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
  handlePgBookingUpdate,
  addDefaultDateTimes
  
} from "../utils/helper.js";
import { flattenResponse } from "../utils/responseFormatter.js";



/* ============================================================
   GET INDIAN CURRENT DATETIME
   ============================================================ */

const getIndianDateTime = () => {

  const now =
    new Date();

  const parts =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone:
          "Asia/Kolkata",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",

        hour:
          "2-digit",

        minute:
          "2-digit",

        second:
          "2-digit",

        hourCycle:
          "h23"
      }
    ).formatToParts(now);

  const result =
    {};

  for (
    const part of parts
  ) {

    if (
      part.type !==
      "literal"
    ) {

      result[part.type] =
        part.value;

    }

  }

  return (
    `${result.year}-${result.month}-${result.day} ` +
    `${result.hour}:${result.minute}:${result.second}`
  );

};


/* ============================================================
   GET PRISMA DATETIME FIELDS DYNAMICALLY
   ============================================================ */

const getDateTimeFields = (
  prisma,
  modelName
) => {

  try {

    const runtimeModels =
      prisma?._runtimeDataModel?.models;

    if (
      !runtimeModels
    ) {

      console.warn(
        `Prisma runtime metadata not available for ${modelName}`
      );

      return [];

    }


    const modelMeta =
      runtimeModels[modelName];

    if (
      !modelMeta
    ) {

      console.warn(
        `Prisma model metadata not found: ${modelName}`
      );

      return [];

    }


    const fields =
      modelMeta.fields
        .filter(
          field =>
            field.kind ===
              "scalar" &&
            field.type ===
              "DateTime"
        )
        .map(
          field =>
            field.name
        );


    console.log(
      `DateTime fields for ${modelName}:`,
      fields
    );


    return fields;

  }

  catch (error) {

    console.error(
      `Failed to get DateTime fields for ${modelName}:`,
      error
    );

    return [];

  }

};


/* ============================================================
   ADD DEFAULT DATETIME VALUES
   ============================================================

   RULE:

   1. If frontend sends DateTime
      -> keep frontend DateTime

   2. If frontend sends null
      -> keep null

   3. If frontend does NOT send DateTime
      -> current Indian DateTime

   4. DateTime fields are discovered
      dynamically from Prisma.

   ============================================================ */




/* ============================================================
   CONVERT DATETIME FIELDS

   IMPORTANT:

   DO NOT recursively walk arbitrary objects.

   Only process the DateTime fields belonging
   to the current Prisma model.

   This prevents:

   Maximum call stack size exceeded

   ============================================================ */




const convertDateFields = (
  data,
  dateTimeFields,
  modelName
) => {

  if (
    data === null ||
    data === undefined
  ) {

    return data;

  }


  /* ==========================================================
     NEVER PROCESS DATE OBJECT
  ========================================================== */

  if (
    data instanceof Date
  ) {

    return data;

  }


  /* ==========================================================
     ONLY PROCESS OBJECT
  ========================================================== */

  if (
    typeof data !== "object" ||
    Array.isArray(data)
  ) {

    return data;

  }


  const result = {
    ...data,
  };


  /* ==========================================================
     PROCESS DATETIME FIELDS
  ========================================================== */

  for (
    const field
    of dateTimeFields
  ) {

    /* ========================================================
       FIELD NOT PRESENT
    ======================================================== */

    if (
      !Object.prototype.hasOwnProperty.call(
        result,
        field
      )
    ) {

      continue;

    }


    const value =
      result[field];


    /* ========================================================
       NULL
    ======================================================== */

    if (
      value === null
    ) {

      console.log(
        `Keeping NULL: ${modelName}.${field}`
      );


      continue;

    }


    /* ========================================================
       ALREADY DATE
    ======================================================== */

    if (
      value instanceof Date
    ) {

      console.log(
        `Already Date object: ${modelName}.${field}`
      );


      continue;

    }


    /* ========================================================
       STRING
    ======================================================== */

    if (
      typeof value === "string"
    ) {

      if (
        value.trim() === ""
      ) {

        continue;

      }


      const parsedDate =
        new Date(value);


      if (
        !Number.isNaN(
          parsedDate.getTime()
        )
      ) {

        console.log(
          `Converted DateTime: ${modelName}.${field}`
        );

        console.log(
          "Original:",
          value
        );

        console.log(
          "Date object:",
          parsedDate
        );


        result[field] =
          parsedDate;


        continue;

      }


      console.warn(
        `Invalid datetime: ${modelName}.${field} = ${value}`
      );


      continue;

    }

  }


  return result;

};

/* ============================================================
   CREATE
   ============================================================ */




const create = async ({
  db,
  model,
  data,
  files,
}) => {

  /* ==========================================================
     GET DATABASE CLIENT
  ========================================================== */

  const dbClient =
    getDB(db);


  /* ==========================================================
     DEBUG INPUT
  ========================================================== */

  console.log(
    "========== CREATE INPUT =========="
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
    "DATA TYPE:",
    typeof data
  );

  console.log(
    "RAW DATA:",
    data
  );

  console.log(
    "FILES:",
    files
  );

  console.log(
    "=================================="
  );


  /* ==========================================================
     KYC SPECIAL CASE
  ========================================================== */

  if (
    model === "dy_pg_kyc_info"
  ) {

    return await handleKycCreate({

      data,

      files,

      prisma:
        dbClient,

    });

  }


  /* ==========================================================
     PARSE DATA
  ========================================================== */

  let parsedData =
    data;


  /* ==========================================================
     STRING DATA
  ========================================================== */

  if (
    typeof parsedData === "string"
  ) {

    try {

      parsedData =
        JSON.parse(
          parsedData
        );

    }

    catch (error) {

      throw new Error(
        "Invalid JSON create data"
      );

    }

  }


  /* ==========================================================
     NULL / UNDEFINED
  ========================================================== */

  if (
    parsedData === null ||
    parsedData === undefined
  ) {

    throw new Error(
      `Create data is missing for model: ${model}`
    );

  }


  /* ==========================================================
     PAYLOAD
  ========================================================== */

  if (
    parsedData?.payload !== undefined
  ) {

    parsedData =
      typeof parsedData.payload === "string"

        ? JSON.parse(
            parsedData.payload
          )

        : parsedData.payload;

  }


  /* ==========================================================
     { data: {} }
  ========================================================== */

  if (
    parsedData &&
    typeof parsedData === "object" &&
    parsedData.data !== undefined
  ) {

    parsedData =
      typeof parsedData.data === "string"

        ? JSON.parse(
            parsedData.data
          )

        : parsedData.data;

  }


  /* ==========================================================
     VALIDATION
  ========================================================== */

  if (
    !parsedData ||
    typeof parsedData !== "object" ||
    Array.isArray(parsedData)
  ) {

    throw new Error(
      `Invalid create data for model: ${model}`
    );

  }


  if (
    Object.keys(
      parsedData
    ).length === 0
  ) {

    throw new Error(
      `Create data is empty for model: ${model}`
    );

  }


  /* ==========================================================
     GET DATETIME FIELDS
  ========================================================== */

  const dateTimeFields =
    getDateTimeFields(
      dbClient,
      model
    );


  /* ==========================================================
     ADD DEFAULT INDIAN DATETIME
  ========================================================== */

  parsedData =
    addDefaultDateTimes(
      dbClient,
      model,
      parsedData
    );


  /* ==========================================================
     CONVERT DATETIME STRINGS
  ========================================================== */

  parsedData =
    convertDateFields(
      parsedData,
      dateTimeFields,
      model
    );


  /* ==========================================================
     DEBUG PREPARED DATA
  ========================================================== */

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
    "DATETIME FIELDS:",
    dateTimeFields
  );

  console.log(
    "PREPARED DATA:",
    parsedData
  );

  console.log(
    "=================================="
  );


  /* ==========================================================
     SPECIAL CREATE MODELS
  ========================================================== */

  const SPECIAL_CREATE_MODELS = [

    "dy_pg_info",

    "dy_pg_bookings",

    "dy_invoices",

    "dy_payments_info",

    "dy_user",

  ];


  let createdData;


  /* ==========================================================
     SPECIAL CREATE
  ========================================================== */

  if (
    SPECIAL_CREATE_MODELS.includes(
      model
    )
  ) {

    createdData =
      await dbClient.$transaction(

        async (tx) => {

          console.log(
            "========== TRANSACTION START =========="
          );


          const special =
            await handleSpecialCreate({

              modelName:
                model,

              data:
                parsedData,

              prisma:
                tx,

              db:
                db,

            });


          if (
            !special ||
            !special.data
          ) {

            throw new Error(
              "Special create failed for model: " +
              model
            );

          }


          console.log(
            "========== TRANSACTION SUCCESS =========="
          );


          return special.data;

        }

      );

  }


  /* ==========================================================
     NORMAL CREATE
  ========================================================== */

  else {

    const prismaModel =
      getModel(
        model,
        db,
        dbClient
      );


    createdData =
      await prismaModel.create({

        data:
          parsedData,

      });

  }


  /* ==========================================================
     CREATE CHECK
  ========================================================== */

  if (
    !createdData
  ) {

    throw new Error(
      "Create operation failed"
    );

  }


  /* ==========================================================
     S3 MEDIA
  ========================================================== */

  let media =
    null;


  if (
    files &&
    Object.keys(
      files
    ).length > 0
  ) {

    media =
      await handleMediaUploadAndUpdate({

        model,

        files,

        createdData,

        prisma:
          dbClient,

      });

  }


  /* ==========================================================
     FORMAT RESPONSE DATES
  ========================================================== */

  const response =
    formatResponseDates(
      createdData
    );


  /* ==========================================================
     MEDIA RESPONSE
  ========================================================== */

  if (
    media &&
    (
      media.media ||
      media
    )
  ) {

    response.media =
      media.media ||
      media;

  }


  /* ==========================================================
     CLEAR CACHE
  ========================================================== */

  await redisManager.invalidate(
    db,
    model
  );


  /* ==========================================================
     FINAL RESPONSE
  ========================================================== */

  return response;

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

  const id =
    req.params?.id ||
    queryId ||
    req.body?.id ||
    null;

  const dmmf = await getModelMeta(db);

  const modelMeta = dmmf.datamodel.models.find(
    m => m.name === modelName
  );

  if (!modelMeta) {
    throw new Error(`Model metadata not found for ${modelName}`);
  }

  const validFields = modelMeta.fields.map(
    f => f.name
  );

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

    throw new Error(
      `Unknown query parameter: ${param}`
    );
  });

  const relationFields = modelMeta.fields
    .filter(f => f.kind === "object")
    .map(f => f.name);

  page = Number(queryPage ?? page);
  limit = Number(queryLimit ?? limit);

  if (!Number.isInteger(page) || page < 1) {
    throw new Error(
      "page must be a positive integer"
    );
  }

  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    throw new Error(
      "limit must be an integer between 1 and 100"
    );
  }

  const skip = (page - 1) * limit;

  const parsedQuery = parseQueryParams(
    filterQuery,
    modelMeta
  );

  console.log(
    "RAW filterQuery:",
    filterQuery
  );

  console.log(
    "PARSED QUERY:",
    parsedQuery
  );

  const where = buildNestedWhere(
    modelName,
    {
      ...filters,
      ...parsedQuery
    },
    RELATION_FILTERS,
    dmmf
  );

  console.log(
    "FINAL WHERE:",
    JSON.stringify(where, null, 2)
  );

  let orderBy = undefined;

  if (
    sortOrder &&
    !["asc", "desc"].includes(
      sortOrder.toLowerCase()
    )
  ) {
    throw new Error(
      "sortOrder must be asc or desc"
    );
  }

  if (sortBy) {

    if (!validFields.includes(sortBy)) {
      throw new Error(
        `Invalid sort field: ${sortBy}`
      );
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

  const checkEmpty = (
    value,
    name
  ) => {

    if (
      value !== undefined &&
      value.trim() === ""
    ) {
      throw new Error(
        `${name} cannot be empty`
      );
    }
  };

  checkEmpty(fields, "fields");
  checkEmpty(queryInclude, "include");
  checkEmpty(sum, "sum");
  checkEmpty(avg, "avg");
  checkEmpty(min, "min");
  checkEmpty(max, "max");

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

  const useNoCache =
    noCache === "true";

  /*
  ============================================================
  CACHE
  ============================================================
  */

  if (!useNoCache) {

    const start = Date.now();

    const cached =
      await redisManager.get(
        db,
        modelName,
        cacheKeyFilters
      );

    if (
      cached !== null &&
      cached !== undefined
    ) {

      console.log(
        `⚡ CACHE HIT → ${modelName} (${Date.now() - start}ms)`
      );

      const isArray =
        Array.isArray(cached);

      return {
        success: true,
        source: "cache",
        count: isArray
          ? cached.length
          : (cached ? 1 : 0),
        result: isArray
          ? cached
          : (cached ? [cached] : [])
      };
    }

    console.log(
      `🐢 CACHE MISS → ${modelName}`
    );
  }

  /*
  ============================================================
  BUILD RELATIONS
  ============================================================
  */

  let finalInclude =
    buildRelations(
      modelName,
      dmmf
    );

  /*
  ============================================================
  NEW:
  dy_pg_srv_reqs RELATION HANDLING
  ============================================================

  We specifically identify relations whose
  relationFromFields contain:

      requestor_info
      request_assigned_to

  This means we do NOT need to know the actual
  Prisma relation name.

  Example Prisma relation:

      requestor_info
          ↓
      dy_user

  The response will become:

      requestor_info_data

  ============================================================
  */

  const serviceRequestRelationFields = [
    "requestor_info",
    "request_assigned_to"
  ];

  const serviceRequestRelations =
    modelMeta.fields.filter(field => {

      if (field.kind !== "object") {
        return false;
      }

      const fromFields =
        field.relationFromFields || [];

      return fromFields.some(fieldName =>
        serviceRequestRelationFields.includes(
          fieldName
        )
      );
    });

  console.log(
    "SERVICE REQUEST RELATIONS:",
    serviceRequestRelations.map(
      relation => ({
        relationName: relation.name,
        fromFields:
          relation.relationFromFields,
        toFields:
          relation.relationToFields
      })
    )
  );

  /*
  ============================================================
  ADD REQUIRED RELATIONS TO INCLUDE
  ============================================================
  */

  if (
    modelName === "dy_pg_srv_reqs" &&
    serviceRequestRelations.length > 0
  ) {

    finalInclude = {
      ...finalInclude
    };

    serviceRequestRelations.forEach(
      relation => {

        finalInclude[relation.name] = true;
      }
    );
  }

  /*
  ============================================================
  QUERY INCLUDE FROM FRONTEND
  ============================================================
  */

  if (queryInclude) {

    finalInclude = {};

    queryInclude
      .split(",")
      .map(r => r.trim())
      .forEach(rel => {

        if (!relationFields.includes(rel)) {

          throw new Error(
            `Invalid relation: ${rel}`
          );
        }

        finalInclude[rel] = true;
      });

    /*
    ------------------------------------------------------------
    Keep service-request relations even when frontend
    sends ?include=...
    ------------------------------------------------------------
    */

    if (
      modelName === "dy_pg_srv_reqs"
    ) {

      serviceRequestRelations.forEach(
        relation => {

          finalInclude[
            relation.name
          ] = true;
        }
      );
    }
  }

  /*
  ============================================================
  TRANSFORM
  ============================================================
  */

  const applyTransform1 = (data) => {

    if (!data) {
      return [];
    }

    return Array.isArray(data)
      ? flattenResponse(
          data,
          modelName,
          dmmf
        )
      : flattenResponse(
          [data],
          modelName,
          dmmf
        );
  };

  /*
  ============================================================
  MODIFIED TRANSFORM
  ============================================================
  */

  const applyTransform = (data) => {

    if (!data) {
      return [];
    }

    const dataArray =
      Array.isArray(data)
        ? data
        : [data];

    /*
    ============================================================
    NORMAL MODE
    ============================================================
    */

    if (
      modelName !== "dy_pg_srv_reqs"
    ) {

      if (modelName === "dy_user") {

        return transformUserWithRole(
          dataArray
        );
      }

      return flattenResponse(
        dataArray,
        modelName,
        dmmf
      );
    }

    /*
    ============================================================
    dy_pg_srv_reqs SPECIAL NESTING
    ============================================================

    IMPORTANT:

    We MUST capture relation data BEFORE
    flattenResponse().

    Otherwise flattenResponse() converts:

        requestor relation
             ↓
        first_name
        last_name
        email_id

    and the original relation object
    is no longer available.

    ============================================================
    */

    const relationData = dataArray.map(
      item => {

        const nestedData = {};

        serviceRequestRelations.forEach(
          relation => {

            const fromFields =
              relation.relationFromFields ||
              [];

            /*
            A relation should normally have
            one foreign-key field here.
            */

            const foreignKey =
              fromFields.find(fieldName =>
                serviceRequestRelationFields.includes(
                  fieldName
                )
              );

            if (!foreignKey) {
              return;
            }

            const relationValue =
              item[relation.name];

            /*
            If relation does not exist,
            do not create _data.
            */

            if (
              relationValue === null ||
              relationValue === undefined
            ) {
              return;
            }

            /*
            ----------------------------------------------------
            Copy relation object
            ----------------------------------------------------
            */

            let nestedValue;

            if (
              typeof relationValue === "object" &&
              !Array.isArray(relationValue)
            ) {

              nestedValue = {
                ...relationValue
              };

            } else {

              nestedValue =
                relationValue;
            }

            /*
            ----------------------------------------------------
            Ensure id exists
            ----------------------------------------------------
            */

            if (
              typeof nestedValue === "object" &&
              nestedValue.id === undefined &&
              item[foreignKey] !== undefined
            ) {

              nestedValue.id =
                item[foreignKey];
            }

            /*
            ----------------------------------------------------
            Create:
            
                requestor_info_data
                request_assigned_to_data
            ----------------------------------------------------
            */

            nestedData[
              `${foreignKey}_data`
            ] = nestedValue;
          }
        );

        return nestedData;
      }
    );

    /*
    ============================================================
    REMOVE RELATION OBJECTS BEFORE flattenResponse
    ============================================================

    This prevents flattenResponse() from producing:

        first_name
        last_name
        email_id
        passwd
        etc.

    at the root level from the requestor/assigned
    user relation.

    ============================================================
    */

    const dataForFlatten =
      dataArray.map(item => {

        const clonedItem = {
          ...item
        };

        serviceRequestRelations.forEach(
          relation => {

            delete clonedItem[
              relation.name
            ];
          }
        );

        return clonedItem;
      });

    /*
    ============================================================
    EXISTING FLATTEN LOGIC
    ============================================================
    */

    let flattened =
      flattenResponse(
        dataForFlatten,
        modelName,
        dmmf
      );

    /*
    ============================================================
    RESTORE NESTED RELATION DATA
    ============================================================
    */

    flattened =
      flattened.map(
        (item, index) => {

          return {
            ...item,
            ...relationData[index]
          };
        }
      );

    return flattened;
  };

  /*
  ============================================================
  AGGREGATE
  ============================================================
  */

  let result;

  if (hasAggregate) {

    const aggregateArgs = {
      where
    };

    if (
      count === "true"
    ) {
      aggregateArgs._count = true;
    }

    const validateAggregateFields =
      (
        fields,
        allowed,
        operation
      ) => {

        fields
          .split(",")
          .map(f => f.trim())
          .forEach(field => {

            if (
              !allowed.includes(field)
            ) {

              throw new Error(
                `${field} cannot be used with ${operation}`
              );
            }
          });
      };

    if (sum) {

      validateAggregateFields(
        sum,
        numericFields,
        "sum"
      );
    }

    if (avg) {

      validateAggregateFields(
        avg,
        numericFields,
        "avg"
      );
    }

    if (min) {

      validateAggregateFields(
        min,
        validFields,
        "min"
      );
    }

    if (max) {

      validateAggregateFields(
        max,
        validFields,
        "max"
      );
    }

    result =
      await model.aggregate(
        aggregateArgs
      );

    return {
      success: true,
      source: "db",
      result
    };
  }

  /*
  ============================================================
  SELECT FIELDS
  ============================================================
  */

  let select;

  if (fields) {

    const requested =
      fields
        .split(",")
        .map(f => f.trim());

    requested.forEach(field => {

      if (
        !validFields.includes(field)
      ) {

        throw new Error(
          `Invalid field: ${field}`
        );
      }
    });

    select =
      Object.fromEntries(
        requested.map(
          field => [
            field,
            true
          ]
        )
      );
  }

  /*
  ============================================================
  ID FILTER
  ============================================================
  */

  if (id) {

    where.id =
      Number(id);
  }

  /*
  ============================================================
  SPECIAL HANDLER
  ============================================================
  */

  const specialResult =
    await executeSpecialHandler(
      modelName,
      model,
      where,
      skip,
      limit
    );

  /*
  ============================================================
  DATABASE QUERY
  ============================================================
  */

  result =
    specialResult ||
    await model.findMany({

      where,

      ...(select
        ? {
            select
          }
        : {
            include:
              finalInclude
          }),

      orderBy,

      skip,

      take: limit
    });

  /*
  ============================================================
  TRANSFORM RESULT
  ============================================================
  */

  const finalData =
    applyTransform(result);

  /*
  ============================================================
  CACHE SET
  ============================================================
  */

  if (!useNoCache) {

    if (
      finalData &&
      finalData.length > 0
    ) {

      const key =
        await redisManager.set(
          db,
          modelName,
          cacheKeyFilters,
          finalData
        );

      if (key) {

        console.log(
          `💾 CACHE SET → ${modelName}`
        );
      }

    } else {

      console.log(
        `⚠️ SKIP CACHE EMPTY → ${modelName}`
      );
    }
  }

  /*
  ============================================================
  FINAL RESPONSE
  ============================================================
  */

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









const update = async (
  db,
  modelName,
  {
    id = null,
    where = {},
    data = {},
    updates = []
  },
  tx = null,
  files = null
) => {

  /**
   * ============================================================
   * DATABASE CLIENT
   * ============================================================
   */

  const client =
    tx || getDB(db);

  const model =
    getModel(
      modelName,
      db,
      client
    );

  console.log("\n================================================");
  console.log("SERVICE UPDATE");
  console.log("================================================");
  console.log("DB:", db);
  console.log("MODEL:", modelName);
  console.log("ID:", id);
  console.log("WHERE:", where);
  console.log("DATA:", data);
  console.log("UPDATES:", updates);
  console.log("TRANSACTION:", !!tx);


  /* ============================================================
     BULK UPDATE
     ============================================================ */

  /**
   * Bulk update format:
   *
   * {
   *   "updates": [
   *     {
   *       "id": 779,
   *       "fields": {
   *         "payment_status": 5,
   *         "cash_payment": 18000
   *       }
   *     }
   *   ]
   * }
   *
   * Also supports old format:
   *
   * {
   *   "updates": [
   *     {
   *       "id": 779,
   *       "data": {
   *         "payment_status": 5,
   *         "cash_payment": 18000
   *       }
   *     }
   *   ]
   * }
   */

  if (
    Array.isArray(updates) &&
    updates.length > 0
  ) {

    console.log(
      "================================================"
    );

    console.log(
      "BULK UPDATE START"
    );

    console.log(
      "================================================"
    );


    /**
     * ----------------------------------------------------------
     * Only dy_payments_info currently supports this bulk flow
     * ----------------------------------------------------------
     */

    if (
      modelName !== "dy_payments_info"
    ) {

      throw new Error(
        `Bulk update is not supported for model ${modelName}`
      );

    }


    /**
     * ----------------------------------------------------------
     * Maximum 5 records
     * ----------------------------------------------------------
     */

    if (
      updates.length > 5
    ) {

      throw new Error(
        "Maximum 5 payment records can be updated at a time"
      );

    }


    const results = [];


    /**
     * ----------------------------------------------------------
     * Process every update
     * ----------------------------------------------------------
     */

    for (
      let index = 0;
      index < updates.length;
      index++
    ) {

      const item =
        updates[index];


      console.log(
        `\nProcessing bulk item ${index + 1}`
      );

      console.log(
        "ITEM:",
        item
      );


      /**
       * --------------------------------------------------------
       * Validate item
       * --------------------------------------------------------
       */

      if (
        !item ||
        typeof item !== "object" ||
        Array.isArray(item)
      ) {

        throw new Error(
          `Invalid update item at index ${index}`
        );

      }


      /**
       * --------------------------------------------------------
       * Validate ID or WHERE
       * --------------------------------------------------------
       */

      const hasItemId =
        item.id !== undefined &&
        item.id !== null &&
        item.id !== "";


      const hasItemWhere =
        item.where &&
        typeof item.where === "object" &&
        !Array.isArray(item.where) &&
        Object.keys(item.where).length > 0;


      if (
        !hasItemId &&
        !hasItemWhere
      ) {

        throw new Error(
          `Each payment update requires id or where at index ${index}`
        );

      }


      /**
       * --------------------------------------------------------
       * Build WHERE
       * --------------------------------------------------------
       */

      let updateWhere;


      if (hasItemWhere) {

        updateWhere =
          {
            ...item.where
          };

      }

      else {

        const numericId =
          Number(item.id);


        if (
          !Number.isInteger(numericId) ||
          numericId <= 0
        ) {

          throw new Error(
            `Invalid payment ID: ${item.id}`
          );

        }


        updateWhere = {
          id: numericId
        };

      }


      /**
       * --------------------------------------------------------
       * If WHERE contains ID, validate it
       * --------------------------------------------------------
       */

      if (
        updateWhere.id !== undefined &&
        updateWhere.id !== null
      ) {

        const numericWhereId =
          Number(
            updateWhere.id
          );


        if (
          !Number.isInteger(numericWhereId) ||
          numericWhereId <= 0
        ) {

          throw new Error(
            `Invalid payment ID: ${updateWhere.id}`
          );

        }


        updateWhere.id =
          numericWhereId;

      }


      /**
       * --------------------------------------------------------
       * GET UPDATE FIELDS
       * --------------------------------------------------------
       *
       * Preferred:
       *
       *   item.fields
       *
       * Backward compatible:
       *
       *   item.data
       *
       * So both formats work.
       */

      const itemData =
        item.fields ??
        item.data;


      /**
       * --------------------------------------------------------
       * Validate update fields
       * --------------------------------------------------------
       */

      if (
        !itemData ||
        typeof itemData !== "object" ||
        Array.isArray(itemData) ||
        Object.keys(itemData).length === 0
      ) {

        throw new Error(
          `Update fields are required for payment ${
            item.id ?? index
          }`
        );

      }


      /**
       * --------------------------------------------------------
       * DEBUG
       * --------------------------------------------------------
       */

      console.log(
        "UPDATE WHERE:",
        updateWhere
      );

      console.log(
        "PAYMENT FIELDS:",
        itemData
      );


      /**
       * --------------------------------------------------------
       * UPDATE DATABASE
       * --------------------------------------------------------
       */

      const updatedPayment =
        await model.update({
          where: updateWhere,
          data: itemData
        });


      /**
       * --------------------------------------------------------
       * ADD RESULT
       * --------------------------------------------------------
       */

      results.push(
        updatedPayment
      );


      console.log(
        `PAYMENT UPDATED: ${
          item.id ?? "WHERE"
        }`
      );

    }


    /**
     * ----------------------------------------------------------
     * Redis invalidation
     *
     * Only invalidate once after all updates.
     * ----------------------------------------------------------
     */

    await redisManager.invalidate(
      db,
      model
    );


    console.log(
      "\n================================================"
    );

    console.log(
      "BULK UPDATE COMPLETE"
    );

    console.log(
      "UPDATED:",
      results.length
    );

    console.log(
      "================================================"
    );


    return {
      success: true,
      count: results.length,
      data: results
    };

  }


  /* ============================================================
     SINGLE UPDATE
     ============================================================ */

  /**
   * This section is reached only when there is
   * no bulk `updates` array.
   */

  const hasWhere =
    where &&
    typeof where === "object" &&
    !Array.isArray(where) &&
    Object.keys(where).length > 0;


  const hasId =
    id !== undefined &&
    id !== null &&
    id !== "";


  if (
    !hasWhere &&
    !hasId
  ) {

    throw new Error(
      "Update requires where or id"
    );

  }


  /**
   * ------------------------------------------------------------
   * Determine record ID
   * ------------------------------------------------------------
   */

  const recordId =
    hasId
      ? id
      : where?.id;


  let finalId =
    recordId !== undefined &&
    recordId !== null
      ? Number(recordId)
      : null;


  /**
   * ------------------------------------------------------------
   * Validate ID
   * ------------------------------------------------------------
   */

  if (
    recordId !== undefined &&
    recordId !== null &&
    recordId !== ""
  ) {

    if (
      !Number.isInteger(finalId) ||
      finalId <= 0
    ) {

      throw new Error(
        `Invalid ID: ${recordId}`
      );

    }

  }


  /**
   * ------------------------------------------------------------
   * Validate data
   * ------------------------------------------------------------
   */

  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    Object.keys(data).length === 0
  ) {

    throw new Error(
      "Update data is required"
    );

  }


  console.log(
    "\n================================================"
  );

  console.log(
    "SINGLE UPDATE START"
  );

  console.log(
    "================================================"
  );

  console.log(
    "MODEL:",
    modelName
  );

  console.log(
    "RECORD ID:",
    finalId
  );

  console.log(
    "WHERE:",
    where
  );

  console.log(
    "DATA:",
    data
  );


  /* ============================================================
     SPECIAL CASE: dy_pg_info
     ============================================================ */

  if (
    modelName === "dy_pg_info"
  ) {

    const result =
      await handlePgInfoUpdate({
        model,
        recordId: finalId,
        data,
        files,
        tx: client
      });


    /**
     * Don't return media when no files were uploaded.
     */

    if (
      !files ||
      Object.keys(files).length === 0
    ) {

      delete result?.media;

    }


    return result;

  }


  /* ============================================================
     SPECIAL CASE: dy_pg_kyc_info
     ============================================================ */

  if (
    modelName === "dy_pg_kyc_info"
  ) {

    const result =
      await handlePgKycUpdate({
        model,
        recordId: finalId,
        data,
        files
      });


    /**
     * Don't return media when no files were uploaded.
     */

    if (
      !files ||
      Object.keys(files).length === 0
    ) {

      delete result?.media;

    }


    return result;

  }


  /* ============================================================
     SPECIAL CASE: dy_pg_bookings
     ============================================================ */

  if (
    modelName === "dy_pg_bookings"
  ) {

    const updatedBooking =
      await handlePgBookingUpdate({
        model,
        recordId: finalId,
        where,
        data,
        tx: client
      });


    let media = null;


    /**
     * Upload files after booking update.
     */

    if (
      files &&
      Object.keys(files).length > 0
    ) {

      media =
        await handleMediaUploadAndUpdate({
          model: modelName,
          files,
          createdData: updatedBooking,
          prisma: client
        });

    }


    const response = {
      ...updatedBooking
    };


    /**
     * Add media if available.
     */

    if (
      media &&
      (
        media.media ||
        media
      )
    ) {

      response.media =
        media.media ||
        media;

    }


    /**
     * Invalidate cache.
     */

    await redisManager.invalidate(
      db,
      model
    );


    return response;

  }


  /* ============================================================
     NORMAL UPDATE
     ============================================================ */

  /**
   * Build WHERE condition.
   */

  const updateWhere =
    hasWhere
      ? where
      : {
          id: finalId
        };


  console.log(
    "NORMAL UPDATE WHERE:",
    updateWhere
  );


  /**
   * Execute update.
   */

  const updatedData =
    await model.update({
      where: updateWhere,
      data
    });


  /* ============================================================
     MEDIA
     ============================================================ */

  let media = null;


  if (
    files &&
    Object.keys(files).length > 0
  ) {

    media =
      await handleMediaUploadAndUpdate({
        model: modelName,
        files,
        createdData: updatedData,
        prisma: client
      });

  }


  /* ============================================================
     RESPONSE
     ============================================================ */

  const response = {
    ...updatedData
  };


  if (
    media &&
    (
      media.media ||
      media
    )
  ) {

    response.media =
      media.media ||
      media;

  }


  /* ============================================================
     REDIS
     ============================================================ */

  await redisManager.invalidate(
    db,
    model
  );


  console.log(
    "\n================================================"
  );

  console.log(
    "SINGLE UPDATE COMPLETE"
  );

  console.log(
    "================================================"
  );


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
 
};