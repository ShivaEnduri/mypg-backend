


import crypto from "crypto";



import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import getModel from "./modelResolver.js";

import S3Service from "../utils/mediaservices.js";


const s3Service = new S3Service();


const buildNestedWhere = (
  modelName,
  filters = {},
  relationConfig = {},
  dmmf
) => {
  const model = dmmf?.datamodel?.models?.find(
    m => m.name === modelName
  );

  if (!model) {
    throw new Error(`Prisma model not found: ${modelName}`);
  }

  const where = {};

  const modelFilters =
    relationConfig?.[modelName] || {};

  // ============================================================
  // MODEL FIELDS
  // ============================================================

  const scalarFields = new Map();

  model.fields
    .filter(field => field.kind !== "object")
    .forEach(field => {
      scalarFields.set(field.name, field);
    });

  const relationFields = model.fields.filter(
    field => field.kind === "object"
  );

  // ============================================================
  // DATE/TIME CONVERSION
  // ============================================================

  const convertDateTime = (value, fieldName) => {
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        throw new Error(
          `${fieldName} must be a valid date/time`
        );
      }

      return value;
    }

    if (typeof value !== "string") {
      throw new Error(
        `${fieldName} must be a valid date/time`
      );
    }

    let input = value.trim();

    if (!input) {
      throw new Error(
        `${fieldName} cannot be empty`
      );
    }

    // ----------------------------------------------------------
    // MySQL DATETIME
    //
    // 2026-08-10 04:30:00
    // ->
    // 2026-08-10T04:30:00
    // ----------------------------------------------------------

    input = input.replace(
      /^(\d{4}-\d{2}-\d{2})\s+/,
      "$1T"
    );

    // ----------------------------------------------------------
    // Date only
    //
    // 2026-08-10
    // ->
    // 2026-08-10T00:00:00
    // ----------------------------------------------------------

    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      input += "T00:00:00";
    }

    // ----------------------------------------------------------
    // IMPORTANT
    //
    // Do NOT automatically add +05:30.
    //
    // Your DB response is:
    //
    // 2026-08-10T04:30:00.000Z
    //
    // Therefore:
    //
    // 2026-08-10T04:30:00
    //
    // should become:
    //
    // 2026-08-10T04:30:00.000Z
    // ----------------------------------------------------------

    const hasTimezone =
      /(?:Z|[+-]\d{2}:?\d{2})$/i.test(input);

    let date;

    if (hasTimezone) {
      date = new Date(input);
    } else {
      // Treat timezone-less DB datetime as UTC
      date = new Date(`${input}Z`);
    }

    if (Number.isNaN(date.getTime())) {
      throw new Error(
        `${fieldName} must be a valid date/time`
      );
    }

    return date;
  };

  // ============================================================
  // VALUE CONVERSION
  // ============================================================

  const convertValue = (value, field) => {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    // ----------------------------------------------------------
    // Array values
    // ----------------------------------------------------------

    if (Array.isArray(value)) {
      return value.map(v =>
        convertValue(v, field)
      );
    }

    // ----------------------------------------------------------
    // Already Date
    // ----------------------------------------------------------

    if (value instanceof Date) {
      return value;
    }

    // ----------------------------------------------------------
    // Int
    // ----------------------------------------------------------

    if (field.type === "Int") {
      const number = Number(value);

      if (!Number.isInteger(number)) {
        throw new Error(
          `${field.name} must be a valid integer`
        );
      }

      return number;
    }

    // ----------------------------------------------------------
    // Float
    // ----------------------------------------------------------

    if (field.type === "Float") {
      const number = Number(value);

      if (!Number.isFinite(number)) {
        throw new Error(
          `${field.name} must be a valid number`
        );
      }

      return number;
    }

    // ----------------------------------------------------------
    // Decimal
    // ----------------------------------------------------------

    if (field.type === "Decimal") {
      return value;
    }

    // ----------------------------------------------------------
    // BigInt
    // ----------------------------------------------------------

    if (field.type === "BigInt") {
      try {
        return BigInt(value);
      } catch {
        throw new Error(
          `${field.name} must be a valid bigint`
        );
      }
    }

    // ----------------------------------------------------------
    // Boolean
    // ----------------------------------------------------------

    if (field.type === "Boolean") {
      if (typeof value === "boolean") {
        return value;
      }

      if (value === "true") {
        return true;
      }

      if (value === "false") {
        return false;
      }

      throw new Error(
        `${field.name} must be true or false`
      );
    }

    // ----------------------------------------------------------
    // DateTime
    // ----------------------------------------------------------

    if (field.type === "DateTime") {
      return convertDateTime(
        value,
        field.name
      );
    }

    // ----------------------------------------------------------
    // String / Enum / Json
    // ----------------------------------------------------------

    return value;
  };

  // ============================================================
  // OPERATOR CONVERSION
  // ============================================================

  const operatorMap = {
    eq: "equals",
    equals: "equals",

    ne: "not",
    not: "not",

    gt: "gt",
    gte: "gte",

    lt: "lt",
    lte: "lte",

    contains: "contains",
    startsWith: "startsWith",
    endsWith: "endsWith",

    in: "in",
    notIn: "notIn"
  };

  // ============================================================
  // BUILD FIELD CONDITION
  // ============================================================

  const buildFieldCondition = (
    value,
    field
  ) => {

    // ----------------------------------------------------------
    // Normal:
    //
    // pg_id=1
    //
    // =>
    // { pg_id: 1 }
    // ----------------------------------------------------------

    if (
      value === null ||
      typeof value !== "object" ||
      value instanceof Date ||
      Array.isArray(value)
    ) {
      return convertValue(
        value,
        field
      );
    }

    const condition = {};

    for (const [operator, rawValue] of Object.entries(value)) {

      const prismaOperator =
        operatorMap[operator];

      if (!prismaOperator) {
        throw new Error(
          `Invalid filter operator "${operator}" for field "${field.name}"`
        );
      }

      let convertedValue;

      // --------------------------------------------------------
      // in / notIn
      // --------------------------------------------------------

      if (
        operator === "in" ||
        operator === "notIn"
      ) {
        if (!Array.isArray(rawValue)) {
          throw new Error(
            `${field.name}.${operator} must be an array`
          );
        }

        convertedValue = rawValue.map(item =>
          convertValue(item, field)
        );
      }

      // --------------------------------------------------------
      // normal operator
      // --------------------------------------------------------

      else {
        convertedValue =
          convertValue(
            rawValue,
            field
          );
      }

      condition[prismaOperator] =
        convertedValue;
    }

    return condition;
  };

  // ============================================================
  // PROCESS FILTERS
  // ============================================================

  for (const [key, value] of Object.entries(filters)) {

    // ==========================================================
    // 1. DIRECT FIELD
    // ==========================================================

    const directField =
      scalarFields.get(key);

    if (directField) {

      where[key] =
        buildFieldCondition(
          value,
          directField
        );

      continue;
    }

    // ==========================================================
    // 2. EXPLICIT RELATION CONFIG
    // ==========================================================

    let config =
      modelFilters[key];

    // ==========================================================
    // 3. AUTO DISCOVER RELATION
    // ==========================================================

    if (!config) {

      for (const relation of relationFields) {

        const relatedModel =
          dmmf.datamodel.models.find(
            m => m.name === relation.type
          );

        if (!relatedModel) {
          continue;
        }

        const relatedField =
          relatedModel.fields.find(
            f =>
              f.name === key &&
              f.kind !== "object"
          );

        if (!relatedField) {
          continue;
        }

        config = {
          relation: relation.name,
          isList: relation.isList,

          nested: {
            field: key,
            relation: null,
            isList: false
          },

          fieldMeta: relatedField
        };

        break;
      }
    }

    // ==========================================================
    // 4. NO RELATION
    // ==========================================================

    if (!config) {
      continue;
    }

    // ==========================================================
    // 5. RELATED FIELD
    // ==========================================================

    let relatedFieldMeta =
      config.fieldMeta;

    if (!relatedFieldMeta) {

      const relation =
        relationFields.find(
          r => r.name === config.relation
        );

      if (relation) {

        const relatedModel =
          dmmf.datamodel.models.find(
            m => m.name === relation.type
          );

        if (relatedModel) {

          relatedFieldMeta =
            relatedModel.fields.find(
              f =>
                f.name ===
                config.nested.field
            );
        }
      }
    }

    if (!relatedFieldMeta) {
      continue;
    }

    // ==========================================================
    // 6. RELATED CONDITION
    // ==========================================================

    const nestedCondition =
      buildFieldCondition(
        value,
        relatedFieldMeta
      );

    // ==========================================================
    // 7. RELATION WHERE
    // ==========================================================

    if (!config.nested.relation) {

      if (config.isList) {

        where[config.relation] = {
          some: {
            [config.nested.field]:
              nestedCondition
          }
        };

      } else {

        where[config.relation] = {
          is: {
            [config.nested.field]:
              nestedCondition
          }
        };
      }

    } else {

      if (config.isList) {

        where[config.relation] = {
          some: {
            [config.nested.relation]:
              {
                [config.nested.field]:
                  nestedCondition
              }
          }
        };

      } else {

        where[config.relation] = {
          is: {
            [config.nested.relation]:
              {
                [config.nested.field]:
                  nestedCondition
              }
          }
        };
      }
    }
  }

  return where;
};


/* ================================
   RELATION CONFIG (UNCHANGED)
================================ */

const RELATION_FILTERS = {
  dy_pg_bed_info: {
    pg_info_id: {
      relation: "dy_pg_room_info",
      nested: {
        relation: "dy_pg_info",
        field: "id",
      },
      type: "number",
      isList: false,
    },
  },

  dy_user_roles: {
    role_id: {
      relation: "st_pg_role",
      field: "id",
      type: "number",
    },
  },

  dy_amenities: {
    community_id: {
      field: "community",
      type: "number",
    },

    amenity_id: {
      relation: "st_amenities",
      field: "id",
      type: "number",
    },

    category_id: {
      relation: "st_amenity_category",
      field: "id",
      type: "number",
    },
  },

  dy_pg_info: {
    amns_info: {
      relation: "dy_pg_amns_map",
      nested: {
        relation: "st_pg_amns",
        field: "id",
      },
      type: "number",
      isList: true,
    },
  },

  // ✅ FIXED
  dy_pg_guest_info: {
    pg_info_id: {
      relation: "dy_pg_info",
      field: "id",
      type: "number",
      isList: false,
    },
  },

  std_sub_tasks: {
    project_id: {
      relation: "std_main_tasks",
      nested: {
        field: "project_id",
      },
      type: "number",
      isList: false,
    },
  },
};

const specialAllowedParams = {
  dy_pg_bed_info: ["pg_info_id"],
  dy_pg_info: ["amns_info"],
  dy_pg_guest_info: ["pg_info_id"],
   dy_user_roles: ["user_id"]
  
};

const getBedInfo = async (model, filters = {}, skip = 0, limit = 10) => {

  const { pg_info_id, ...otherFilters } = filters;

  const where = {
    ...otherFilters,
    ...(pg_info_id && {
      dy_pg_room_info: {
        dy_pg_info: {
          id: Number(pg_info_id),
        },
      },
    }),
  };

  return await model.findMany({
    where,
    select: {
      id: true,
      bed_number: true,
      bed_status:true,
      room_info:true,
      dy_pg_room_info: {
        select: {
          id: true,
          room_name: true,
          dy_pg_info: {
            select: {
              id: true,
              pg_name: true,
            },
          },
        },
      },
    },
    skip,
    take: limit,
  });
};

const getUserRole = async (model, where, skip = 0, limit = 10) => {
  return await model.findMany({
    where,
    select: {
      id: true,
      user_id: true,
      role_id: true,
      is_active: true,

      st_pg_role: {
        select: {
          id: true,
          role: true,
        },
      },
    },
    skip,
    take: limit,
  });
};


const generateBookingNumber = async (prisma) => {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  const dateStr = `${year}${month}${day}`;

  // Start of today
  const start = new Date(year, now.getMonth(), now.getDate(), 0, 0, 0);

  // End of today
  const end = new Date(year, now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const count = await prisma.dy_pg_bookings.count({
    where: {
      create_time: {
        gte: start,
        lte: end
      }
    }
  });

  const serial = String(count + 1).padStart(3, "0");

  return `BKG-${dateStr}-${serial}`;
};

const getAmenitiesWithFilters = async (
  prisma,
  filters = {},
  skip = 0,
  limit = 100
) => {

  const { community_id, amenity_id, category_id } = filters;

  const where = {

    // ✅ Direct filter
    ...(community_id && {
      community: Number(community_id)
    }),

    // ✅ Amenity filter
    ...(amenity_id && {
      st_amenities: {
        id: Number(amenity_id)
      }
    }),

    // ✅ Category filter (nested relation)
    ...(category_id && {
      st_amenities: {
        st_amenity_category: {
          id: Number(category_id),
        }
      }
    })

  };

  return await prisma.dy_amenities.findMany({
    where,

    include: {
      st_community: {
        select: {
          id: true,
          name: true
        }
      },

      st_amenities: {
        select: {
          id: true,
          amenity_name: true,
          st_amenity_category: {
            select: {
              id: true,
              amenity_category: true
            }
          }
        }
      }
    },

    skip,
    take: limit
  });
};

const getPgInfoWithAmenities = async (
  model,
  filters = {},
  skip = 0,
  limit = 100
) => {

  const { amns_info, ...otherFilters } = filters;

  const where = {
    ...otherFilters,
    ...(amns_info && {
      dy_pg_amns_map: {
        some: {
          st_pg_amns: {
            id: Number(amns_info),
          },
        },
      },
    }),
  };

  return await model.findMany({
    where,
    include: {

      // ✅ MAIN RELATIONS
      st_pg_cat: true,
      st_pg_description: true,
      st_pg_state: true,
      st_pg_type: true,

      // ✅ AMENITIES
      dy_pg_amns_map: {
        include: {
          st_pg_amns: true
        }
      }

    },
    skip,
    take: limit,
  });
};

const getGuestWithPgInfo = async (
  model,
  filters = {},
  skip = 0,
  limit = 10
) => {
  try {
    const {
      pg_info_id,
      ...otherFilters
    } = filters;

    const pgId =
      pg_info_id !== undefined &&
      pg_info_id !== null &&
      pg_info_id !== ""
        ? Number(pg_info_id)
        : null;

    // ----------------------------------------------------
    // Validate pg_info_id
    // ----------------------------------------------------

    if (
      pg_info_id !== undefined &&
      pg_info_id !== null &&
      pg_info_id !== "" &&
      !Number.isInteger(pgId)
    ) {
      throw new Error(
        "pg_info_id must be a valid number"
      );
    }

    // ----------------------------------------------------
    // WHERE
    // ----------------------------------------------------

    const where = {
      ...otherFilters,

      ...(pgId !== null && {
        dy_pg_info: {
          is: {
            id: pgId,
          },
        },
      }),
    };

    console.log(
      "Guest WHERE:",
      JSON.stringify(where, null, 2)
    );

    // ----------------------------------------------------
    // QUERY
    // ----------------------------------------------------

    const data = await model.findMany({
      where,

      include: {
        dy_pg_info: true,
      },

      skip,

      take: limit,
    });

    return data;
  } catch (error) {
    console.error(
      "getGuestWithPgInfo error:",
      error
    );

    throw error;
  }
};


const executeSpecialHandler = async (modelName, model, where, skip, limit) => {

  const handlers = {
    dy_pg_bed_info: getBedInfo,
    dy_pg_info: getPgInfoWithAmenities,
    dy_pg_guest_info: getGuestWithPgInfo
  };

  const handler = handlers[modelName];

  if (!handler) return null;

  return await handler(model, where, skip, limit);
};
const handleFileUpload = async (files, modelName) => {
  if (!files) return {};

  const grouped = Array.isArray(files)
    ? files.reduce((acc, file) => {
        acc[file.fieldname] = acc[file.fieldname] || [];
        acc[file.fieldname].push(file);
        return acc;
      }, {})
    : files;

  const result = {};

  for (const field in grouped) {
    const arr = grouped[field];
    if (!Array.isArray(arr)) continue;
    result[field] = [];

    for (const file of arr) {
      const dir = path.join(__dirname, "..", "uploads", modelName);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const fileName = `${Date.now()}_${file.originalname}`;
      const fullPath = path.join(dir, fileName);
      fs.writeFileSync(fullPath, file.buffer);

      result[field].push(`uploads/${modelName}/${fileName}`);
    }
  }

  return result;
};

/**
 * Special create handler for dy_pg_info
 */










const INDIA_TIMEZONE = "Asia/Kolkata";


/**
 * Get today's date in India
 * Returns YYYY-MM-DD
 */
const getIndiaDateString = () => {

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

};


/**
 * Format Date object as IST
 *
 * Example:
 * 2026-08-07T04:55:26.000Z
 *
 * becomes:
 * 2026-08-07 10:25:26
 */
const formatIST = (date) => {

  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(new Date(date))
    .replace(",", "");

};

/**
 * Get current date/time in India
 */
const formatResponseDates = (obj) => {

  if (!obj || typeof obj !== "object") {
    return obj;
  }

  const dateFields = [
    "bkg_date",
    "planned_check_in_date",
    "actual_check_in_date",
    "planned_check_out_date",
    "actual_check_out_date",
    "create_time",
    "modified_time",
  ];

  // =====================================
  // ARRAY
  // =====================================

  if (Array.isArray(obj)) {
    return obj.map(formatResponseDates);
  }

  const result = { ...obj };

  for (const key in result) {

    const value = result[key];

    if (value == null) {
      continue;
    }

    // =====================================
    // DATE FIELD
    // =====================================

    if (
      dateFields.includes(key) &&
      value instanceof Date
    ) {
      result[key] = formatIST(value);
      continue;
    }

    // =====================================
    // NESTED OBJECT
    // =====================================

    if (
      typeof value === "object" &&
      !(value instanceof Date)
    ) {
      result[key] = formatResponseDates(value);
    }
  }

  return result;
};


const generateUniversalUserId = () => {

  const characters =
    "0123456789abcdef";

  let result = "";

  for (let i = 0; i < 64; i++) {

    const randomIndex =
      Math.floor(
        Math.random() * characters.length
      );

    result +=
      characters[randomIndex];
  }

  return result;
};


const handleSpecialCreate1 = async ({
  modelName,
  data,
  prisma,
  db,
}) => {

  /* ============================================================
     1. CREATE PG
  ============================================================ */

  if (modelName === "dy_pg_info") {

    const model =
      getModel(
        modelName,
        db,
        prisma
      );


    /* ==========================================================
       FIND REVIEW STATUS
    ========================================================== */

    const reviewStatus =
      await prisma.st_pg_cur_sts.findFirst({

        where: {
          status_code: "review",
        },

        select: {
          id: true,
        },

      });


    if (!reviewStatus) {

      throw new Error(
        "Default status 'review' not found"
      );

    }


    /* ==========================================================
       PG DATA
    ========================================================== */

    const createData = {

      pg_name:
        data.pg_name ?? null,

      pg_owner:
        data.pg_owner !== undefined &&
        data.pg_owner !== null &&
        data.pg_owner !== ""
          ? Number(data.pg_owner)
          : null,

      pg_cat:
        data.pg_cat !== undefined &&
        data.pg_cat !== null &&
        data.pg_cat !== ""
          ? Number(data.pg_cat)
          : null,

      pg_type_id:
        data.pg_type_id !== undefined &&
        data.pg_type_id !== null &&
        data.pg_type_id !== ""
          ? Number(data.pg_type_id)
          :
          (
            data.pg_type !== undefined &&
            data.pg_type !== null &&
            data.pg_type !== ""
              ? Number(data.pg_type)
              : null
          ),

      pg_desc_id:
        data.pg_desc_id !== undefined &&
        data.pg_desc_id !== null &&
        data.pg_desc_id !== ""
          ? Number(data.pg_desc_id)
          :
          (
            data.pg_desc !== undefined &&
            data.pg_desc !== null &&
            data.pg_desc !== ""
              ? Number(data.pg_desc)
              : null
          ),

      pg_address:
        data.pg_address ?? null,

      pg_city:
        data.pg_city !== undefined &&
        data.pg_city !== null &&
        data.pg_city !== ""
          ? Number(data.pg_city)
          : null,

      pg_state:
        data.pg_state !== undefined &&
        data.pg_state !== null &&
        data.pg_state !== ""
          ? Number(data.pg_state)
          : null,

      pg_landmark:
        data.pg_landmark ?? null,

      pg_pincode:
        data.pg_pincode !== undefined &&
        data.pg_pincode !== null &&
        data.pg_pincode !== ""
          ? Number(data.pg_pincode)
          : null,

      pg_major_area:
        data.pg_major_area ?? null,

      pg_primary_contact_no:
        data.pg_primary_contact_no ?? null,

      pg_alternate_contact_no:
        data.pg_alternate_contact_no ?? null,

      pg_email:
        data.pg_email ?? null,

      pg_map_url:
        data.pg_map_url ?? null,

      pg_status:
        reviewStatus.id,

    };


    /* ==========================================================
       CREATE PG
    ========================================================== */

    const created =
      await model.create({
        data: createData,
      });


    /* ==========================================================
       GET OWNER NAME
    ========================================================== */

    let ownerName = "unknown";


    if (created.pg_owner) {

      const owner =
        await prisma.dy_user.findUnique({

          where: {
            id: Number(
              created.pg_owner
            ),
          },

          select: {
            first_name: true,
            last_name: true,
          },

        });


      if (owner) {

        ownerName =
          owner.first_name ||
          "unknown";


        if (owner.last_name) {

          ownerName =
            ownerName +
            "_" +
            owner.last_name;

        }

      }

    }


    /* ==========================================================
       PG NAME
    ========================================================== */

    const pgName =
      String(
        created.pg_name ?? "PG"
      ).replace(
        /\s+/g,
        "_"
      );


    /* ==========================================================
       GENERATE PG ID
    ========================================================== */

    const pg_id =
      pgName +
      "_" +
      ownerName +
      "_" +
      created.id;


    /* ==========================================================
       UPDATE PG
    ========================================================== */

    const updated =
      await model.update({

        where: {
          id: created.id,
        },

        data: {

          pg_id:
            pg_id,

          pg_documents_path:
            "Pgdata/" +
            pg_id,

        },

      });


    return {
      data: updated,
    };

  }


  /* ============================================================
     2. USER → ROLE → GUEST → BOOKING
  ============================================================ */

  if (modelName === "dy_user") {

    console.log(
      "================================================"
    );

    console.log(
      "USER + ROLE + GUEST + BOOKING CREATE"
    );

    console.log(
      "================================================"
    );


    /* ==========================================================
       SEPARATE NESTED DATA
    ========================================================== */

    const {
      guest,
      booking,
      role_id,
      ...userData
    } = data;


    /* ==========================================================
       VALIDATION
    ========================================================== */

    if (!userData.first_name) {

      throw new Error(
        "first_name is required"
      );

    }


    if (!userData.email_id) {

      throw new Error(
        "email_id is required"
      );

    }


    if (!userData.mobile_no) {

      throw new Error(
        "mobile_no is required"
      );

    }


    if (!guest) {

      throw new Error(
        "guest data is required"
      );

    }


    if (!booking) {

      throw new Error(
        "booking data is required"
      );

    }


    /* ==========================================================
       1️⃣ GENERATE UNIQUE UNIVERSAL USER ID
       
       NO TRANSACTION HERE.
       
       prisma is already transaction client.
    ========================================================== */

    let univ_user_id;


    do {

      univ_user_id =
        generateUniversalUserId();


      const existingUser =
        await prisma.dy_user.findFirst({

          where: {
            univ_user_id:
              univ_user_id,
          },

          select: {
            id: true,
          },

        });


      if (!existingUser) {
        break;
      }

    } while (true);


    console.log(
      "NEW univ_user_id:",
      univ_user_id
    );


    /* ==========================================================
       2️⃣ CREATE USER
    ========================================================== */

    const finalUserData = {

      ...userData,

      univ_user_id:
        univ_user_id,

      signuptime:
        userData.signuptime
          ? new Date(
              userData.signuptime
            )
          : new Date(),

      last_updated:
        new Date(),

    };


    console.log(
      "USER DATA:",
      finalUserData
    );


    const createdUser =
      await prisma.dy_user.create({

        data:
          finalUserData,

      });


    console.log(
      "USER CREATED ID:",
      createdUser.id
    );


    console.log(
      "USER CREATED univ_user_id:",
      createdUser.univ_user_id
    );


    /* ==========================================================
       3️⃣ CREATE USER ROLE
       
       Default role = 4
    ========================================================== */

    const finalRoleId =
      role_id !== undefined &&
      role_id !== null &&
      role_id !== ""
        ? Number(role_id)
        : 4;


    const createdRole =
      await prisma.dy_user_roles.create({

        data: {

          user_id:
            createdUser.id,

          role_id:
            finalRoleId,

        },

      });


    console.log(
      "ROLE CREATED:",
      createdRole
    );


    /* ==========================================================
       4️⃣ VALIDATE GUEST PG
    ========================================================== */

    if (
      guest.pg_id === undefined ||
      guest.pg_id === null ||
      guest.pg_id === ""
    ) {

      throw new Error(
        "guest.pg_id is required"
      );

    }


    /* ==========================================================
       5️⃣ CREATE GUEST
       
       dy_user.id
              ↓
       dy_pg_guest_info.user_id
    ========================================================== */

    const guestData = {

      guest_type:
        guest.guest_type !== undefined &&
        guest.guest_type !== null &&
        guest.guest_type !== ""
          ? Number(
              guest.guest_type
            )
          : null,


      guest_status:
        guest.guest_status !== undefined &&
        guest.guest_status !== null &&
        guest.guest_status !== ""
          ? Number(
              guest.guest_status
            )
          : null,


      perm_address:
        guest.perm_address ??
        null,


      pg_id:
        Number(
          guest.pg_id
        ),


      user_id:
        createdUser.id,


      emergency_contact:
        guest.emergency_contact ??
        null,


      emergency_contact_name:
        guest.emergency_contact_name ??
        null,

    };


    console.log(
      "GUEST DATA:",
      guestData
    );


    const createdGuest =
      await prisma.dy_pg_guest_info.create({

        data:
          guestData,

      });


    console.log(
      "GUEST CREATED ID:",
      createdGuest.id
    );


    /* ==========================================================
       6️⃣ VALIDATE BOOKING
    ========================================================== */

    if (
      booking.pg_id === undefined ||
      booking.pg_id === null ||
      booking.pg_id === ""
    ) {

      throw new Error(
        "booking.pg_id is required"
      );

    }


   


   


    /* ==========================================================
       7️⃣ GENERATE BOOKING NUMBER
    ========================================================== */

    const indiaDate =
      getIndiaDateString();


    const datePart =
      indiaDate.replace(
        /-/g,
        ""
      );


    const bookingPrefix =
      "BKG-" +
      datePart +
      "-";


    console.log(
      "BOOKING PREFIX:",
      bookingPrefix
    );


    /* ==========================================================
       FIND LAST BOOKING
    ========================================================== */

    const lastBooking =
      await prisma.dy_pg_bookings.findFirst({

        where: {

          bkg_no: {

            startsWith:
              bookingPrefix,

          },

        },

        orderBy: {

          id:
            "desc",

        },

        select: {

          bkg_no:
            true,

        },

      });


    /* ==========================================================
       NEXT SEQUENCE
    ========================================================== */

    let sequence = 1;


    if (
      lastBooking &&
      lastBooking.bkg_no
    ) {

      const parts =
        lastBooking.bkg_no.split("-");


      const lastSequence =
        Number(
          parts[2]
        );


      if (
        !Number.isNaN(
          lastSequence
        )
      ) {

        sequence =
          lastSequence + 1;

      }

    }


    /* ==========================================================
       BOOKING NUMBER
    ========================================================== */

    const bkg_no =
      bookingPrefix +
      String(
        sequence
      ).padStart(
        3,
        "0"
      );


    console.log(
      "GENERATED BOOKING NUMBER:",
      bkg_no
    );


    /* ==========================================================
       8️⃣ CREATE BOOKING
       
       dy_pg_guest_info.id
              ↓
       dy_pg_bookings.guest_id
    ========================================================== */

    const bookingData = {

      bkg_no:
        bkg_no,


      pg_id:
        Number(
          booking.pg_id
        ),


      




      planned_check_in_date:
        booking.planned_check_in_date
          ? new Date(
              booking.planned_check_in_date
            )
          : null,


     


      planned_check_out_date:
        booking.planned_check_out_date
          ? new Date(
              booking.planned_check_out_date
            )
          : null,


     


      bkg_status:
        booking.bkg_status !== undefined &&
        booking.bkg_status !== null &&
        booking.bkg_status !== ""
          ? Number(
              booking.bkg_status
            )
          : null,


      create_time:
        new Date(),


     


      created_by:
        booking.created_by !== undefined &&
        booking.created_by !== null &&
        booking.created_by !== ""
          ? Number(
              booking.created_by
            )
          : createdUser.id,


      modified_by:
        booking.modified_by !== undefined &&
        booking.modified_by !== null &&
        booking.modified_by !== ""
          ? Number(
              booking.modified_by
            )
          : null,


      remarks:
        booking.remarks ??
        null,


      monthly_rent:
        booking.monthly_rent !== undefined &&
        booking.monthly_rent !== null &&
        booking.monthly_rent !== ""
          ? Number(
              booking.monthly_rent
            )
          : null,


      secuirty_deposit:
        booking.secuirty_deposit !== undefined &&
        booking.secuirty_deposit !== null &&
        booking.secuirty_deposit !== ""
          ? Number(
              booking.secuirty_deposit
            )
          : null,


     


     


      


    



     


      notice_period_time:
        booking.notice_period_time !== undefined &&
        booking.notice_period_time !== null &&
        booking.notice_period_time !== ""
          ? Number(
              booking.notice_period_time
            )
          : null,


      /* ======================================================
         IMPORTANT FOREIGN KEY
         
         guest.id → booking.guest_id
      ====================================================== */

      guest_id:
        createdGuest.id,

    };


    console.log(
      "BOOKING DATA:",
      bookingData
    );


    /* ==========================================================
       CREATE BOOKING
    ========================================================== */

    const createdBooking =
      await prisma.dy_pg_bookings.create({

        data:
          bookingData,

      });


    console.log(
      "BOOKING CREATED ID:",
      createdBooking.id
    );


    /* ==========================================================
       RETURN
    ========================================================== */

    return {

      data: {

        user:
          createdUser,

        role:
          createdRole,

        guest:
          createdGuest,

        booking:
          createdBooking,

      },

    };

  }


  /* ============================================================
     3. STANDALONE BOOKING CREATE
  ============================================================ */

  if (modelName === "dy_pg_bookings") {

    const model =
      getModel(
        modelName,
        db,
        prisma
      );


    /* ==========================================================
       INDIA DATE
    ========================================================== */

    const indiaDate =
      getIndiaDateString();


    const datePart =
      indiaDate.replace(
        /-/g,
        ""
      );


    const bookingPrefix =
      "BKG-" +
      datePart +
      "-";


    /* ==========================================================
       FIND LAST BOOKING
    ========================================================== */

    const lastBooking =
      await model.findFirst({

        where: {

          bkg_no: {

            startsWith:
              bookingPrefix,

          },

        },

        orderBy: {

          id:
            "desc",

        },

        select: {

          bkg_no:
            true,

        },

      });


    /* ==========================================================
       SEQUENCE
    ========================================================== */

    let sequence = 1;


    if (
      lastBooking &&
      lastBooking.bkg_no
    ) {

      const parts =
        lastBooking.bkg_no.split("-");


      const lastSequence =
        Number(
          parts[2]
        );


      if (
        !Number.isNaN(
          lastSequence
        )
      ) {

        sequence =
          lastSequence + 1;

      }

    }


    /* ==========================================================
       BOOKING NUMBER
    ========================================================== */

    const bkg_no =
      bookingPrefix +
      String(
        sequence
      ).padStart(
        3,
        "0"
      );


    /* ==========================================================
       CREATE DATA
    ========================================================== */

    const createData = {

      ...data,

      bkg_no:
        bkg_no,

      create_time:
        new Date(),

    };


    /* ==========================================================
       CONVERT DATE FIELDS
    ========================================================== */

    const dateFields = [

      "bkg_date",

      "planned_check_in_date",

      "actual_check_in_date",

      "planned_check_out_date",

      "actual_check_out_date",

      "create_time",

      "modified_time",

    ];


    for (
      const field of dateFields
    ) {

      if (
        createData[field] &&
        typeof createData[field] ===
          "string"
      ) {

        createData[field] =
          new Date(
            createData[field]
          );

      }

    }


    /* ==========================================================
       CREATE BOOKING
    ========================================================== */

    const created =
      await model.create({

        data:
          createData,

      });


    return {

      data:
        created,

    };

  }
/* ============================================================
   4. CREATE PG ALERT
============================================================ */

if (modelName === "dy_pg_alerts") {

  console.log(
    "================================================"
  );

  console.log(
    "PG ALERT CREATE"
  );

  console.log(
    "================================================"
  );


  /* ==========================================================
     VALIDATE REQUIRED FIELDS
  ========================================================== */

  if (
    data.alert_cat === undefined ||
    data.alert_cat === null ||
    data.alert_cat === ""
  ) {

    throw new Error(
      "alert_cat is required"
    );

  }


  if (
    data.alert_receiver_role === undefined ||
    data.alert_receiver_role === null ||
    data.alert_receiver_role === ""
  ) {

    throw new Error(
      "alert_receiver_role is required"
    );

  }


  if (
    data.alert_title === undefined ||
    data.alert_title === null ||
    data.alert_title === ""
  ) {

    throw new Error(
      "alert_title is required"
    );

  }


  if (
    data.alert_priority === undefined ||
    data.alert_priority === null ||
    data.alert_priority === ""
  ) {

    throw new Error(
      "alert_priority is required"
    );

  }


  if (
    data.pg_id === undefined ||
    data.pg_id === null ||
    data.pg_id === ""
  ) {

    throw new Error(
      "pg_id is required"
    );

  }


  if (
    data.alert_status === undefined ||
    data.alert_status === null ||
    data.alert_status === ""
  ) {

    throw new Error(
      "alert_status is required"
    );

  }


  /* ==========================================================
     ALERT RECEIVER

     If passed:
       alert_receiver = 15
       → save 15

     If not passed:
       alert_receiver = undefined

     We do NOT automatically assign a receiver.
  ========================================================== */

  let alertReceiver = null;


  if (
    data.alert_receiver !== undefined &&
    data.alert_receiver !== null &&
    data.alert_receiver !== ""
  ) {

    alertReceiver =
      Number(
        data.alert_receiver
      );


    if (
      !Number.isInteger(
        alertReceiver
      ) ||
      alertReceiver <= 0
    ) {

      throw new Error(
        "alert_receiver must be a valid positive integer"
      );

    }

  }


  /* ==========================================================
     CREATE ALERT DATA
  ========================================================== */

  const alertData = {

    alert_cat:
      Number(
        data.alert_cat
      ),


    alert_receiver_role:
      Number(
        data.alert_receiver_role
      ),


    alert_receiver:
      alertReceiver,


    alert_title:
      data.alert_title,


    alert_description:
      data.alert_description ??
      null,


    alert_priority:
      Number(
        data.alert_priority
      ),


    pg_id:
      Number(
        data.pg_id
      ),


    alert_status:
      Number(
        data.alert_status
      ),

  };


  console.log(
    "FINAL ALERT DATA:",
    alertData
  );


  /* ==========================================================
     CREATE ALERT
  ========================================================== */

  const createdAlert =
    await prisma.dy_pg_alerts.create({

      data:
        alertData,

    });


  console.log(
    "ALERT CREATED:",
    createdAlert
  );


  /* ==========================================================
     RETURN
  ========================================================== */

  return {

    data:
      createdAlert,

  };

}

  /* ============================================================
     NO SPECIAL CREATE
  ============================================================ */

  return null;

};

const handleSpecialCreate = async ({
  modelName,
  data,
  prisma,
  db,
}) => {

  /* ============================================================
     1. CREATE PG
  ============================================================ */

  if (modelName === "dy_pg_info") {

    const model =
      getModel(
        modelName,
        db,
        prisma
      );

    /* ==========================================================
       FIND REVIEW STATUS
    ========================================================== */

    const reviewStatus =
      await prisma.st_pg_cur_sts.findFirst({

        where: {
          status_code: "review",
        },

        select: {
          id: true,
        },

      });

    if (!reviewStatus) {

      throw new Error(
        "Default status 'review' not found"
      );

    }

    /* ==========================================================
       PG DATA
    ========================================================== */

    const createData = {

      pg_name:
        data.pg_name ?? null,

      pg_owner:
        data.pg_owner !== undefined &&
        data.pg_owner !== null &&
        data.pg_owner !== ""
          ? Number(data.pg_owner)
          : null,

      pg_cat:
        data.pg_cat !== undefined &&
        data.pg_cat !== null &&
        data.pg_cat !== ""
          ? Number(data.pg_cat)
          : null,

      pg_type_id:
        data.pg_type_id !== undefined &&
        data.pg_type_id !== null &&
        data.pg_type_id !== ""
          ? Number(data.pg_type_id)
          :
          (
            data.pg_type !== undefined &&
            data.pg_type !== null &&
            data.pg_type !== ""
              ? Number(data.pg_type)
              : null
          ),

      pg_desc_id:
        data.pg_desc_id !== undefined &&
        data.pg_desc_id !== null &&
        data.pg_desc_id !== ""
          ? Number(data.pg_desc_id)
          :
          (
            data.pg_desc !== undefined &&
            data.pg_desc !== null &&
            data.pg_desc !== ""
              ? Number(data.pg_desc)
              : null
          ),

      pg_address:
        data.pg_address ?? null,

      pg_city:
        data.pg_city !== undefined &&
        data.pg_city !== null &&
        data.pg_city !== ""
          ? Number(data.pg_city)
          : null,

      pg_state:
        data.pg_state !== undefined &&
        data.pg_state !== null &&
        data.pg_state !== ""
          ? Number(data.pg_state)
          : null,

      pg_landmark:
        data.pg_landmark ?? null,

      pg_pincode:
        data.pg_pincode !== undefined &&
        data.pg_pincode !== null &&
        data.pg_pincode !== ""
          ? Number(data.pg_pincode)
          : null,

      pg_major_area:
        data.pg_major_area ?? null,

      pg_primary_contact_no:
        data.pg_primary_contact_no ?? null,

      pg_alternate_contact_no:
        data.pg_alternate_contact_no ?? null,

      pg_email:
        data.pg_email ?? null,

      pg_map_url:
        data.pg_map_url ?? null,

      pg_status:
        reviewStatus.id,

    };

    /* ==========================================================
       CREATE PG
    ========================================================== */

    const created =
      await model.create({
        data: createData,
      });

    /* ==========================================================
       GET OWNER NAME
    ========================================================== */

    let ownerName = "unknown";

    if (created.pg_owner) {

      const owner =
        await prisma.dy_user.findUnique({

          where: {
            id: Number(
              created.pg_owner
            ),
          },

          select: {
            first_name: true,
            last_name: true,
          },

        });

      if (owner) {

        ownerName =
          owner.first_name ||
          "unknown";

        if (owner.last_name) {

          ownerName =
            ownerName +
            "_" +
            owner.last_name;

        }

      }

    }

    /* ==========================================================
       PG NAME
    ========================================================== */

    const pgName =
      String(
        created.pg_name ?? "PG"
      ).replace(
        /\s+/g,
        "_"
      );

    /* ==========================================================
       GENERATE PG ID
    ========================================================== */

    const pg_id =
      pgName +
      "_" +
      ownerName +
      "_" +
      created.id;

    /* ==========================================================
       UPDATE PG
    ========================================================== */

    const updated =
      await model.update({

        where: {
          id: created.id,
        },

        data: {

          pg_id:
            pg_id,

          pg_documents_path:
            "Pgdata/" +
            pg_id,

        },

      });

    return {
      data: updated,
    };

  }

/* ============================================================
   CREATE PAYMENT
   TABLE:
   dy_payments_info

   AUTO PAYMENT ID FORMAT:

   PYM-07092026-001
   PYM-07092026-002
   PYM-07092026-003
   ============================================================ */

if (modelName === "dy_payments_info") {

  console.log(
    "================================================"
  );

  console.log(
    "PAYMENT CREATE"
  );

  console.log(
    "================================================"
  );

  /* ==========================================================
     1. INDIA DATE
     ========================================================== */

  const indiaDate = getIndiaDateString();

  /*
    Example:

    indiaDate = "2026-09-07"
  */

  const datePart = indiaDate
    .split("-")
    .reverse()
    .join("");

  /*
    Example:

    2026-09-07
          ↓
    07092026
  */

  const paymentPrefix = "PYM-" + datePart + "-";

  console.log(
    "PAYMENT PREFIX:",
    paymentPrefix
  );


  /* ==========================================================
     2. FIND LAST PAYMENT OF TODAY
     ========================================================== */

  const lastPayment =
    await prisma.dy_payments_info.findFirst({

      where: {

        payment_id: {
          startsWith: paymentPrefix
        }

      },

      orderBy: {

        id: "desc"

      },

      select: {

        payment_id: true

      }

    });


  /* ==========================================================
     3. GENERATE NEXT SEQUENCE
     ========================================================== */

  let sequence = 1;

  if (
    lastPayment &&
    lastPayment.payment_id
  ) {

    /*
      Example:

      PYM-07092026-005

      split():

      ["PYM", "07092026", "005"]
    */

    const parts =
      lastPayment.payment_id.split("-");

    const lastSequence =
      Number(parts[2]);

    if (
      !Number.isNaN(lastSequence)
    ) {

      sequence =
        lastSequence + 1;

    }

  }


  /* ==========================================================
     4. GENERATE PAYMENT ID
     ========================================================== */

  const payment_id =
    paymentPrefix +
    String(sequence).padStart(3, "0");


  console.log(
    "GENERATED PAYMENT ID:",
    payment_id
  );


  /* ==========================================================
     5. CREATE PAYMENT DATA
     ========================================================== */

  const paymentData = {

    ...data,

    payment_id: payment_id

  };


  console.log(
    "FINAL PAYMENT DATA:"
  );

  console.log(
    paymentData
  );


  /* ==========================================================
     6. CREATE PAYMENT
     ========================================================== */

  const createdPayment =
    await prisma.dy_payments_info.create({

      data: paymentData

    });


  /* ==========================================================
     7. RETURN CREATED PAYMENT
     ========================================================== */

  console.log(
    "PAYMENT CREATED:"
  );

  console.log(
    createdPayment
  );


  return {

    data: createdPayment

  };

}
  /* ============================================================
     2. USER → ROLE → GUEST → BOOKING
  ============================================================ */

  if (modelName === "dy_user") {

    console.log(
      "================================================"
    );

    console.log(
      "USER + ROLE + GUEST + BOOKING CREATE"
    );

    console.log(
      "================================================"
    );

    /* ==========================================================
       SEPARATE NESTED DATA
    ========================================================== */

    const {
      guest,
      booking,
      role_id,
      ...userData
    } = data;

    /* ==========================================================
       VALIDATION
    ========================================================== */

    if (!userData.first_name) {

      throw new Error(
        "first_name is required"
      );

    }

    if (!userData.email_id) {

      throw new Error(
        "email_id is required"
      );

    }

    if (!userData.mobile_no) {

      throw new Error(
        "mobile_no is required"
      );

    }

    if (!guest) {

      throw new Error(
        "guest data is required"
      );

    }

    if (!booking) {

      throw new Error(
        "booking data is required"
      );

    }

    /* ==========================================================
       1️⃣ GENERATE UNIQUE UNIVERSAL USER ID
    ========================================================== */

    let univ_user_id;

    do {

      univ_user_id =
        generateUniversalUserId();

      const existingUser =
        await prisma.dy_user.findFirst({

          where: {
            univ_user_id:
              univ_user_id,
          },

          select: {
            id: true,
          },

        });

      if (!existingUser) {
        break;
      }

    } while (true);

    console.log(
      "NEW univ_user_id:",
      univ_user_id
    );

    /* ==========================================================
       2️⃣ CREATE USER
    ========================================================== */

    const finalUserData = {

      ...userData,

      univ_user_id:
        univ_user_id,

      signuptime:
        userData.signuptime
          ? new Date(
              userData.signuptime
            )
          : new Date(),

      last_updated:
        new Date(),

    };

    console.log(
      "USER DATA:",
      finalUserData
    );

    const createdUser =
      await prisma.dy_user.create({

        data:
          finalUserData,

      });

    console.log(
      "USER CREATED ID:",
      createdUser.id
    );

    console.log(
      "USER CREATED univ_user_id:",
      createdUser.univ_user_id
    );

    /* ==========================================================
       3️⃣ CREATE USER ROLE

       Default role = 4
    ========================================================== */

    const finalRoleId =
      role_id !== undefined &&
      role_id !== null &&
      role_id !== ""
        ? Number(role_id)
        : 4;

    const createdRole =
      await prisma.dy_user_roles.create({

        data: {

          user_id:
            createdUser.id,

          role_id:
            finalRoleId,

        },

      });

    console.log(
      "ROLE CREATED:",
      createdRole
    );

    /* ==========================================================
       4️⃣ VALIDATE GUEST PG
    ========================================================== */

    if (
      guest.pg_id === undefined ||
      guest.pg_id === null ||
      guest.pg_id === ""
    ) {

      throw new Error(
        "guest.pg_id is required"
      );

    }

    /* ==========================================================
       5️⃣ CREATE GUEST
    ========================================================== */

    const guestData = {

      guest_type:
        guest.guest_type !== undefined &&
        guest.guest_type !== null &&
        guest.guest_type !== ""
          ? Number(
              guest.guest_type
            )
          : null,

      guest_status:
        guest.guest_status !== undefined &&
        guest.guest_status !== null &&
        guest.guest_status !== ""
          ? Number(
              guest.guest_status
            )
          : null,

      perm_address:
        guest.perm_address ??
        null,

      pg_id:
        Number(
          guest.pg_id
        ),

      user_id:
        createdUser.id,

      emergency_contact:
        guest.emergency_contact ??
        null,

      emergency_contact_name:
        guest.emergency_contact_name ??
        null,

    };

    console.log(
      "GUEST DATA:",
      guestData
    );

    const createdGuest =
      await prisma.dy_pg_guest_info.create({

        data:
          guestData,

      });

    console.log(
      "GUEST CREATED ID:",
      createdGuest.id
    );

    /* ==========================================================
       6️⃣ VALIDATE BOOKING
    ========================================================== */

    if (
      booking.pg_id === undefined ||
      booking.pg_id === null ||
      booking.pg_id === ""
    ) {

      throw new Error(
        "booking.pg_id is required"
      );

    }

    /* ==========================================================
       7️⃣ GENERATE BOOKING NUMBER
    ========================================================== */

    const indiaDate =
      getIndiaDateString();

    const datePart =
      indiaDate.replace(
        /-/g,
        ""
      );

    const bookingPrefix =
      "BKG-" +
      datePart +
      "-";

    console.log(
      "BOOKING PREFIX:",
      bookingPrefix
    );

    /* ==========================================================
       FIND LAST BOOKING
    ========================================================== */

    const lastBooking =
      await prisma.dy_pg_bookings.findFirst({

        where: {

          bkg_no: {

            startsWith:
              bookingPrefix,

          },

        },

        orderBy: {

          id:
            "desc",

        },

        select: {

          bkg_no:
            true,

        },

      });

    /* ==========================================================
       NEXT SEQUENCE
    ========================================================== */

    let sequence = 1;

    if (
      lastBooking &&
      lastBooking.bkg_no
    ) {

      const parts =
        lastBooking.bkg_no.split("-");

      const lastSequence =
        Number(
          parts[2]
        );

      if (
        !Number.isNaN(
          lastSequence
        )
      ) {

        sequence =
          lastSequence + 1;

      }

    }

    /* ==========================================================
       BOOKING NUMBER
    ========================================================== */

    const bkg_no =
      bookingPrefix +
      String(
        sequence
      ).padStart(
        3,
        "0"
      );

    console.log(
      "GENERATED BOOKING NUMBER:",
      bkg_no
    );

    /* ==========================================================
       8️⃣ CREATE BOOKING
    ========================================================== */

    const bookingData = {

      bkg_no:
        bkg_no,

      pg_id:
        Number(
          booking.pg_id
        ),

      planned_check_in_date:
        booking.planned_check_in_date
          ? new Date(
              booking.planned_check_in_date
            )
          : null,

      planned_check_out_date:
        booking.planned_check_out_date
          ? new Date(
              booking.planned_check_out_date
            )
          : null,

      bkg_status:
        booking.bkg_status !== undefined &&
        booking.bkg_status !== null &&
        booking.bkg_status !== ""
          ? Number(
              booking.bkg_status
            )
          : null,

      create_time:
        new Date(),

      created_by:
        booking.created_by !== undefined &&
        booking.created_by !== null &&
        booking.created_by !== ""
          ? Number(
              booking.created_by
            )
          : createdUser.id,

      modified_by:
        booking.modified_by !== undefined &&
        booking.modified_by !== null &&
        booking.modified_by !== ""
          ? Number(
              booking.modified_by
            )
          : null,

      remarks:
        booking.remarks ??
        null,

      monthly_rent:
        booking.monthly_rent !== undefined &&
        booking.monthly_rent !== null &&
        booking.monthly_rent !== ""
          ? Number(
              booking.monthly_rent
            )
          : null,

      secuirty_deposit:
        booking.secuirty_deposit !== undefined &&
        booking.secuirty_deposit !== null &&
        booking.secuirty_deposit !== ""
          ? Number(
              booking.secuirty_deposit
            )
          : null,

      notice_period_time:
        booking.notice_period_time !== undefined &&
        booking.notice_period_time !== null &&
        booking.notice_period_time !== ""
          ? Number(
              booking.notice_period_time
            )
          : null,

      guest_id:
        createdGuest.id,

    };

    console.log(
      "BOOKING DATA:",
      bookingData
    );

    /* ==========================================================
       CREATE BOOKING
    ========================================================== */

    const createdBooking =
      await prisma.dy_pg_bookings.create({

        data:
          bookingData,

      });

    console.log(
      "BOOKING CREATED ID:",
      createdBooking.id
    );

    return {

      data: {

        user:
          createdUser,

        role:
          createdRole,

        guest:
          createdGuest,

        booking:
          createdBooking,

      },

    };

  }


  /* ============================================================
     3. STANDALONE BOOKING CREATE
  ============================================================ */

  if (modelName === "dy_pg_bookings") {

    const model =
      getModel(
        modelName,
        db,
        prisma
      );

    /* ==========================================================
       INDIA DATE
    ========================================================== */

    const indiaDate =
      getIndiaDateString();

    const datePart =
      indiaDate.replace(
        /-/g,
        ""
      );

    const bookingPrefix =
      "BKG-" +
      datePart +
      "-";

    /* ==========================================================
       FIND LAST BOOKING
    ========================================================== */

    const lastBooking =
      await model.findFirst({

        where: {

          bkg_no: {

            startsWith:
              bookingPrefix,

          },

        },

        orderBy: {

          id:
            "desc",

        },

        select: {

          bkg_no:
            true,

        },

      });

    /* ==========================================================
       SEQUENCE
    ========================================================== */

    let sequence = 1;

    if (
      lastBooking &&
      lastBooking.bkg_no
    ) {

      const parts =
        lastBooking.bkg_no.split("-");

      const lastSequence =
        Number(
          parts[2]
        );

      if (
        !Number.isNaN(
          lastSequence
        )
      ) {

        sequence =
          lastSequence + 1;

      }

    }

    /* ==========================================================
       BOOKING NUMBER
    ========================================================== */

    const bkg_no =
      bookingPrefix +
      String(
        sequence
      ).padStart(
        3,
        "0"
      );

    /* ==========================================================
       CREATE DATA
    ========================================================== */

    const createData = {

      ...data,

      bkg_no:
        bkg_no,

      create_time:
        new Date(),

    };

    /* ==========================================================
       CONVERT DATE FIELDS
    ========================================================== */

    const dateFields = [

      "bkg_date",

      "planned_check_in_date",

      "actual_check_in_date",

      "planned_check_out_date",

      "actual_check_out_date",

      "create_time",

      "modified_time",

    ];

    for (
      const field of dateFields
    ) {

      if (
        createData[field] &&
        typeof createData[field] ===
          "string"
      ) {

        createData[field] =
          new Date(
            createData[field]
          );

      }

    }

    /* ==========================================================
       CREATE BOOKING
    ========================================================== */

    const created =
      await model.create({

        data:
          createData,

      });

    return {

      data:
        created,

    };

  }


  /* ============================================================
     4. CREATE PG ALERT

     TABLE:
     dy_pg_alerts

     alert_receiver = OPTIONAL

     Example:

     {
       "alert_receiver": 15
     }

     → Database:
       alert_receiver = 15


     If not passed:

     {
       "alert_cat": 1,
       "alert_receiver_role": 2,
       "alert_title": "Rent Due",
       "alert_description": "Rent payment is due",
       "alert_priority": 1,
       "pg_id": 4,
       "alert_status": 1
     }

     → Database:
       alert_receiver = NULL
  ============================================================ */

  if (modelName === "dy_pg_alerts") {

    console.log(
      "================================================"
    );

    console.log(
      "PG ALERT CREATE"
    );

    console.log(
      "================================================"
    );

    /* ==========================================================
       REQUIRED FIELD VALIDATION
    ========================================================== */

    if (
      data.alert_cat === undefined ||
      data.alert_cat === null ||
      data.alert_cat === ""
    ) {

      throw new Error(
        "alert_cat is required"
      );

    }

    if (
      data.alert_receiver_role === undefined ||
      data.alert_receiver_role === null ||
      data.alert_receiver_role === ""
    ) {

      throw new Error(
        "alert_receiver_role is required"
      );

    }

    if (
      data.alert_title === undefined ||
      data.alert_title === null ||
      data.alert_title === ""
    ) {

      throw new Error(
        "alert_title is required"
      );

    }

    if (
      data.alert_description === undefined ||
      data.alert_description === null ||
      data.alert_description === ""
    ) {

      throw new Error(
        "alert_description is required"
      );

    }

    if (
      data.alert_priority === undefined ||
      data.alert_priority === null ||
      data.alert_priority === ""
    ) {

      throw new Error(
        "alert_priority is required"
      );

    }

    if (
      data.pg_id === undefined ||
      data.pg_id === null ||
      data.pg_id === ""
    ) {

      throw new Error(
        "pg_id is required"
      );

    }

    if (
      data.alert_status === undefined ||
      data.alert_status === null ||
      data.alert_status === ""
    ) {

      throw new Error(
        "alert_status is required"
      );

    }

    /* ==========================================================
       ALERT RECEIVER

       OPTIONAL FIELD

       Case 1:
         alert_receiver = 15
         → 15

       Case 2:
         alert_receiver = "15"
         → 15

       Case 3:
         alert_receiver = null
         → NULL

       Case 4:
         alert_receiver not passed
         → NULL
    ========================================================== */

    let alertReceiver = null;

    if (
      data.alert_receiver !== undefined &&
      data.alert_receiver !== null &&
      data.alert_receiver !== ""
    ) {

      alertReceiver =
        Number(
          data.alert_receiver
        );

      /* ========================================================
         VALIDATE RECEIVER
      ======================================================== */

      if (
        !Number.isInteger(
          alertReceiver
        ) ||
        alertReceiver <= 0
      ) {

        throw new Error(
          "alert_receiver must be a valid positive integer"
        );

      }

    }

    /* ==========================================================
       CREATE ALERT DATA
    ========================================================== */

    const alertData = {

      alert_cat:
        Number(
          data.alert_cat
        ),

      alert_receiver_role:
        Number(
          data.alert_receiver_role
        ),

      /*
       * IMPORTANT
       *
       * alertReceiver is either:
       *
       * 15
       *
       * OR
       *
       * null
       */
      alert_receiver:
        alertReceiver,

      alert_title:
        data.alert_title,

      alert_description:
        data.alert_description,

      alert_priority:
        Number(
          data.alert_priority
        ),

      pg_id:
        Number(
          data.pg_id
        ),

      alert_status:
        Number(
          data.alert_status
        ),

    };

    console.log(
      "FINAL ALERT DATA:"
    );

    console.log(
      alertData
    );

    /* ==========================================================
       CREATE ALERT
    ========================================================== */

    const createdAlert =
      await prisma.dy_pg_alerts.create({

        data:
          alertData,

      });

    /* ==========================================================
       LOG CREATED ALERT
    ========================================================== */

    console.log(
      "ALERT CREATED:"
    );

    console.log(
      createdAlert
    );

    /* ==========================================================
       RETURN CREATED ALERT
    ========================================================== */

    return {

      data:
        createdAlert,

    };

  }


  /* ============================================================
     NO SPECIAL CREATE
  ============================================================ */

  return null;

};


/* ==============================================================
   GENERATE UNIVERSAL USER ID
   ==============================================================

   Output example:

   de79dfd56242a491450561d99a060b74c398fd39842793de21da1526d68a6c84

   64 hexadecimal characters.

   Every call generates a NEW ID.
================================================================ */

/* ============================================================
   GENERATE UNIQUE UNIVERSAL USER ID
============================================================ */


const handleMediaUploadAndUpdate = async ({
  model,
  files,
  createdData,
  prisma
}) => {

  const pg_id = createdData.pg_id;

  /**
   * ─────────────────────────────
   * 1️⃣ GROUP FILES
   * ─────────────────────────────
   */
 const groupedFiles = files || {};

  const media = {};

  /**
   * ─────────────────────────────
   * 2️⃣ UPLOAD FILES
   * ─────────────────────────────
   */
  if (groupedFiles.images) {
    media.images = await s3Service.uploadImagess(
      groupedFiles.images,
      `Pgdata/${pg_id}/media/images/`
    );
  }

  if (groupedFiles.videos) {
    media.videos = await s3Service.uploadVideos(
      groupedFiles.videos,
      `Pgdata/${pg_id}/media/videos/`
    );
  }

  if (groupedFiles.documents) {
    const docs = await s3Service.uploadToS3(
      groupedFiles.documents,
      `Pgdata/${pg_id}/info/`
    );

    media.documents = docs.map(file => ({
      file_name: file.file_name,
      s3_key: file.key,
      s3_url: file.url
    }));
  }

  /**
   * ─────────────────────────────
   * 3️⃣ UPDATE DB PATH
   * ─────────────────────────────
   */
  await prisma[model].update({
    where: { id: createdData.id },
    data: {
      pg_documents_path: `Pgdata/${pg_id}`
    }
  });

  /**
   * ─────────────────────────────
   * 4️⃣ RETURN
   * ─────────────────────────────
   */
  return {
    id: createdData.id,
    data: createdData,
    media: Object.keys(media).length ? media : null
  };
};



const handleKycCreate = async ({ data, files, prisma }) => {
  let payload = data;

  // ✅ Parse string (form-data)
  if (typeof payload === "string") {
    payload = JSON.parse(payload);
  }

  const {
    guest_info,
    pg_info,
    kyc_type,
    kyc_number,
    kyc_document_expiry_time
  } = payload;

  if (!guest_info || !pg_info || !kyc_type || !kyc_number) {
    throw new Error(
      "guest_info, pg_info, kyc_type and kyc_number are required"
    );
  }

  /* ─────────────────────────────
     1️⃣ Fetch pg_id
  ───────────────────────────── */
  const pgRow = await prisma.dy_pg_info.findUnique({
    where: { id: Number(pg_info) },
    select: { pg_id: true }
  });

  if (!pgRow?.pg_id) {
    throw new Error(`pg_id not found for pg_info id ${pg_info}`);
  }

  const pg_id = pgRow.pg_id;

  /* ─────────────────────────────
     2️⃣ S3 PATH
  ───────────────────────────── */
  const documentsPath = `Pgdata/${pg_id}/kyc`;

  /* ─────────────────────────────
     3️⃣ Upload Files (✅ FIXED)
  ───────────────────────────── */
  let uploadedFiles = [];

  const kycFiles = files?.kyc_document_path || [];

  if (kycFiles.length > 0) {
    uploadedFiles = await s3Service.uploadToS3(
      kycFiles,
      documentsPath
    );
  }

  /* ─────────────────────────────
     4️⃣ DB DATA
  ───────────────────────────── */
  const created = await prisma.dy_pg_kyc_info.create({
    data: {
      guest_info,
      pg_info,
      kyc_type,
      kyc_number,
      kyc_document_expiry_time: kyc_document_expiry_time
        ? new Date(kyc_document_expiry_time).toISOString()
        : null,
      kyc_document_path: documentsPath
    }
  });

  /* ─────────────────────────────
     5️⃣ FINAL RESPONSE (✅ CLEAN)
  ───────────────────────────── */
  return {
    ...created,
    media: uploadedFiles.length
      ? uploadedFiles.map(file => ({
          file_name: file.file_name,
          s3_key: file.key,
          s3_url: file.url
        }))
      : []
  };
};
const handlePgBookingUpdate = async ({
  model,
  recordId,
  where,
  data,
  tx
}) => {
  // ============================================
  // 1. UPDATE BOOKING
  // ============================================

  const updated = await model.update({
    where:
      where && Object.keys(where).length
        ? where
        : { id: Number(recordId) },
    data
  });

  // ============================================
  // 2. GET OCCUPIED STATUS
  // ============================================

  const occupiedStatus = await tx.st_pg_cur_sts.findFirst({
    where: {
      status_code: "occupied"
    },
    select: {
      id: true
    }
  });

  if (!occupiedStatus) {
    throw new Error("Status 'occupied' not found in st_pg_cur_sts");
  }

  // ============================================
  // 3. WHEN BOOKING BECOMES OCCUPIED
  // ============================================

  if (
    updated.bkg_status === occupiedStatus.id &&
    updated.bed_id
  ) {
    // Find the bed using booking.bed_id
    const bed = await tx.dy_pg_bed_info.findUnique({
      where: {
        id: Number(updated.bed_id)
      }
    });

    if (!bed) {
      throw new Error(
        `Bed with id ${updated.bed_id} not found in dy_pg_bed_info`
      );
    }

    // ============================================
    // 4. UPDATE BED STATUS TO OCCUPIED
    // ============================================

    await tx.dy_pg_bed_info.update({
      where: {
        id: Number(updated.bed_id)
      },
      data: {
        bed_status: occupiedStatus.id
      }
    });
  }

  // ============================================
  // 5. RETURN BOOKING
  // ============================================

  return updated;
};


const handlePgInfoUpdate = async ({ model, recordId, data, files, tx }) => {

  const media = {};
  const dbUpdate = { ...data };

  /* ─────────────────────────────
     🔥 LIMIT CONFIG
  ───────────────────────────── */
  const LIMITS = {
    images: 5,
    videos: 2,
    documents: 2
  };

  /* ─────────────────────────────
     1️⃣ GROUP FILES
  ───────────────────────────── */
  const grouped = Array.isArray(files)
    ? files.reduce((acc, file) => {
        acc[file.fieldname] = acc[file.fieldname] || [];
        acc[file.fieldname].push(file);
        return acc;
      }, {})
    : files || {};

  /* ─────────────────────────────
     2️⃣ FETCH BASE PATH
  ───────────────────────────── */
  const old = await model.findUnique({
    where: { id: Number(recordId) },
    select: { pg_documents_path: true }
  });

  const basePath = old?.pg_documents_path;

  if (!basePath) {
    throw new Error("pg_documents_path not found");
  }

  /* ─────────────────────────────
     🔥 HELPER: ENFORCE LIMIT
  ───────────────────────────── */
  const validateLimit = (filesArr, type) => {
    if (filesArr.length > LIMITS[type]) {
      throw new Error(
        `${type} upload limit exceeded. Max allowed is ${LIMITS[type]}`
      );
    }
  };

  /* ─────────────────────────────
     3️⃣ DOCUMENTS (PDF)
  ───────────────────────────── */
  if (grouped.documents) {

    validateLimit(grouped.documents, "documents");

    const infoPath = `${basePath}/info`;

    // ✅ Delete old only if new uploaded
    const oldPdfs = await s3Service.listKeys(infoPath, ".pdf");
    if (oldPdfs.length) {
      await s3Service.deleteObjects(oldPdfs);
    }

    const docs = await s3Service.uploadToS3(grouped.documents, infoPath);

    media.documents = docs.map(file => ({
      file_name: file.file_name,
      s3_key: file.key,
      s3_url: file.url
    }));
  }

  /* ─────────────────────────────
     4️⃣ IMAGES
  ───────────────────────────── */
  if (grouped.images) {

    validateLimit(grouped.images, "images");

    const imgPath = `${basePath}/media/images/`;

    // ✅ Delete old only if new uploaded
    const oldImgs = await s3Service.listKeys(imgPath);
    if (oldImgs.length) {
      await s3Service.deleteObjects(oldImgs);
    }

    const uploadedImages = await s3Service.uploadImagess(
      grouped.images,
      imgPath
    );

    media.images = uploadedImages;
  }

  /* ─────────────────────────────
     5️⃣ VIDEOS
  ───────────────────────────── */
  if (grouped.videos) {

    validateLimit(grouped.videos, "videos");

    const videoPath = `${basePath}/media/videos/`;

    // ✅ Delete old only if new uploaded
    const oldVids = await s3Service.listKeys(videoPath);
    if (oldVids.length) {
      await s3Service.deleteObjects(oldVids);
    }

    const uploadedVideos = await s3Service.uploadVideos(
      grouped.videos,
      videoPath
    );

    media.videos = uploadedVideos;
  }

  /* ─────────────────────────────
     6️⃣ UPDATE DB
  ───────────────────────────── */
  const updated = await model.update({
    where: { id: Number(recordId) },
    data: dbUpdate
  });
// Get Approved status
const approvedStatus = await tx.st_pg_cur_sts.findFirst({
  where: {
    status_code: "approved"
  },
  select: {
    id: true
  }
});

if (
  approvedStatus &&
  old.pg_status !== approvedStatus.id &&
  updated.pg_status === approvedStatus.id
) {
  // Get pg_owner role from st_roles
  const pgOwnerRole = await tx.st_roles.findFirst({
    where: {
      role_name: "pg_owner"
    },
    select: {
      id: true
    }
  });

  if (!pgOwnerRole) {
    throw new Error("Role 'pg_owner' not found in st_roles");
  }

  // Check if user already has this role
  const existing = await tx.dy_user_roles.findFirst({
    where: {
      user_id: updated.pg_owner,
      role_id: pgOwnerRole.id
    }
  });

  if (!existing) {
    await tx.dy_user_roles.create({
      data: {
        user_id: updated.pg_owner,
        role_id: pgOwnerRole.id
      }
    });
  }
}
  /* ─────────────────────────────
     7️⃣ RESPONSE
  ───────────────────────────── */
  return {
    data: updated,
    media: Object.keys(media).length ? media : null
  };
};
const handlePgKycUpdate = async ({ model, recordId, data, files }) => {

  const media = {};
  const dbUpdate = { ...data };

  /* ─────────────────────────────
     🔥 LIMIT CONFIG (SAME STYLE)
  ───────────────────────────── */
  const LIMITS = {
    documents: 2
  };

  /* ─────────────────────────────
     1️⃣ GROUP FILES
  ───────────────────────────── */
  const grouped = Array.isArray(files)
    ? files.reduce((acc, file) => {
        acc[file.fieldname] = acc[file.fieldname] || [];
        acc[file.fieldname].push(file);
        return acc;
      }, {})
    : files || {};

  /* ─────────────────────────────
     🔥 HELPER: ENFORCE LIMIT
  ───────────────────────────── */
  const validateLimit = (filesArr, type) => {
    if (filesArr.length > LIMITS[type]) {
      throw new Error(
        `${type} upload limit exceeded. Max allowed is ${LIMITS[type]}`
      );
    }
  };

  /* ─────────────────────────────
     ✅ DATE FIX
  ───────────────────────────── */
  if (dbUpdate.kyc_document_expiry_time) {
    dbUpdate.kyc_document_expiry_time = new Date(
      dbUpdate.kyc_document_expiry_time
    ).toISOString();
  }

  const documents = grouped.kyc_document_path || [];

  /* ─────────────────────────────
     🔥 APPLY LIMIT
  ───────────────────────────── */
  if (documents.length) {
    validateLimit(documents, "documents");
  }

  /* ─────────────────────────────
     2️⃣ FETCH OLD PATH
  ───────────────────────────── */
  const old = await model.findUnique({
    where: { id: Number(recordId) },
    select: { kyc_document_path: true }
  });

  if (!old || !old.kyc_document_path) {
    throw new Error("kyc_document_path not found");
  }

  /* ─────────────────────────────
     🔥 FIX PATH (FILE → FOLDER)
  ───────────────────────────── */
  const fullPath = old.kyc_document_path;

  const kycPath = fullPath.includes(".")
    ? fullPath.substring(0, fullPath.lastIndexOf("/"))
    : fullPath;

  /* ─────────────────────────────
     3️⃣ NO FILE CASE
  ───────────────────────────── */
  if (!documents.length) {
    const updated = await model.update({
      where: { id: Number(recordId) },
      data: dbUpdate
    });

    return { data: updated, media: null };
  }

  /* ─────────────────────────────
     🔥 DELETE OLD DOCUMENTS
  ───────────────────────────── */
  const oldDocs = await s3Service.listKeys(kycPath, ".pdf");

  if (oldDocs.length) {
    await s3Service.deleteObjects(oldDocs);
  }

  /* ─────────────────────────────
     🔥 UPLOAD NEW DOCUMENTS
  ───────────────────────────── */
  const uploadedDocs = await s3Service.uploadToS3(documents, kycPath);

  media.documents = uploadedDocs.map(file => ({
    file_name: file.file_name,
    s3_key: file.key,
    s3_url: file.url
  }));

  /* ─────────────────────────────
     🔥 STORE ONLY FOLDER PATH
  ───────────────────────────── */
  dbUpdate.kyc_document_path = kycPath;

  /* ─────────────────────────────
     4️⃣ UPDATE DB
  ───────────────────────────── */
  const updated = await model.update({
    where: { id: Number(recordId) },
    data: dbUpdate
  });

  /* ─────────────────────────────
     5️⃣ RESPONSE
  ───────────────────────────── */
  return {
    data: updated,
    media: Object.keys(media).length ? media : null
  };
};

 export const parseQueryParams1 = (query = {}, modelMeta) => {
  const parsed = {};

  const RESERVED = new Set([
    "count",
    "sum",
    "avg",
    "min",
    "max",
    "groupBy",
    "sortBy",
    "sortOrder",
    "fields",
    "include",
    "page",
    "limit",
    "id",
    "noCache"
  ]);

  for (const [key, value] of Object.entries(query)) {

    // ==========================================
    // RESERVED QUERY PARAMETERS
    // ==========================================

    if (RESERVED.has(key)) {
      continue;
    }

    // ==========================================
    // UNKNOWN FIELD
    // ==========================================

    const field = modelMeta?.fields?.find(
      f => f.name === key
    );

    if (!field) {
      parsed[key] = value;
      continue;
    }

    // ==========================================
    // KEEP RAW VALUE
    //
    // IMPORTANT:
    // Type conversion is handled by
    // buildNestedWhere() using Prisma DMMF.
    // ==========================================

    parsed[key] = value;
  }

  return parsed;
};


export const parseQueryParams = (query, modelMeta) => {
  const result = {};

  const numericFields = modelMeta.fields
    .filter(field =>
      ["Int", "Float", "Decimal", "BigInt"].includes(field.type)
    )
    .map(field => field.name);

  const booleanFields = modelMeta.fields
    .filter(field => field.type === "Boolean")
    .map(field => field.name);

  const dateTimeFields = modelMeta.fields
    .filter(field => field.type === "DateTime")
    .map(field => field.name);

  Object.entries(query).forEach(([key, value]) => {

    /*
    ============================================================
    EMPTY VALUE
    ============================================================
    */

    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      return;
    }

    /*
    ============================================================
    ARRAY / COMMA-SEPARATED VALUES
    ============================================================

    Example:

      ?role_id=3,5

    becomes:

      role_id: {
        in: [3, 5]
      }

    ============================================================
    */

    if (
      typeof value === "string" &&
      value.includes(",")
    ) {

      const values =
        value
          .split(",")
          .map(v => v.trim())
          .filter(v => v !== "");

      /*
      ----------------------------------------------------------
      Numeric field
      ----------------------------------------------------------
      */

      if (numericFields.includes(key)) {

        const convertedValues =
          values.map(v => {

            const numberValue =
              Number(v);

            if (Number.isNaN(numberValue)) {
              throw new Error(
                `Invalid numeric value for ${key}: ${v}`
              );
            }

            return numberValue;
          });

        result[key] = {
          in: convertedValues
        };

        return;
      }

      /*
      ----------------------------------------------------------
      Boolean field
      ----------------------------------------------------------
      */

      if (booleanFields.includes(key)) {

        const convertedValues =
          values.map(v => {

            if (v === "true") {
              return true;
            }

            if (v === "false") {
              return false;
            }

            throw new Error(
              `Invalid boolean value for ${key}: ${v}`
            );
          });

        result[key] = {
          in: convertedValues
        };

        return;
      }

      /*
      ----------------------------------------------------------
      DateTime field
      ----------------------------------------------------------
      */

      if (dateTimeFields.includes(key)) {

        const convertedValues =
          values.map(v => {

            const dateValue =
              new Date(v);

            if (
              Number.isNaN(
                dateValue.getTime()
              )
            ) {
              throw new Error(
                `Invalid datetime value for ${key}: ${v}`
              );
            }

            return dateValue;
          });

        result[key] = {
          in: convertedValues
        };

        return;
      }

      /*
      ----------------------------------------------------------
      String field
      ----------------------------------------------------------

      Example:

        ?status=ACTIVE,INACTIVE

      becomes:

        status: {
          in: ["ACTIVE", "INACTIVE"]
        }

      ----------------------------------------------------------
      */

      result[key] = {
        in: values
      };

      return;
    }

    /*
    ============================================================
    SINGLE VALUE
    ============================================================
    */

    /*
    ------------------------------------------------------------
    Numeric
    ------------------------------------------------------------
    */

    if (numericFields.includes(key)) {

      const numberValue =
        Number(value);

      if (Number.isNaN(numberValue)) {

        throw new Error(
          `Invalid numeric value for ${key}: ${value}`
        );
      }

      result[key] =
        numberValue;

      return;
    }

    /*
    ------------------------------------------------------------
    Boolean
    ------------------------------------------------------------
    */

    if (booleanFields.includes(key)) {

      if (value === "true") {

        result[key] = true;

        return;
      }

      if (value === "false") {

        result[key] = false;

        return;
      }

      throw new Error(
        `Invalid boolean value for ${key}: ${value}`
      );
    }

    /*
    ------------------------------------------------------------
    DateTime
    ------------------------------------------------------------
    */

    if (dateTimeFields.includes(key)) {

      const dateValue =
        new Date(value);

      if (
        Number.isNaN(
          dateValue.getTime()
        )
      ) {

        throw new Error(
          `Invalid datetime value for ${key}: ${value}`
        );
      }

      result[key] =
        dateValue;

      return;
    }

    /*
    ============================================================
    NORMAL STRING
    ============================================================
    */

    result[key] =
      value;
  });

  return result;
};


// ============================================================
// INDIAN CURRENT DATE TIME
// ============================================================

const getIndianDateTime = () => {

  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",

    year: "numeric",
    month: "2-digit",
    day: "2-digit",

    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",

    hourCycle: "h23",
  }).formatToParts(now);


  const result = {};

  for (const part of parts) {

    if (part.type !== "literal") {

      result[part.type] = part.value;

    }

  }


  return (
    `${result.year}-${result.month}-${result.day} ` +
    `${result.hour}:${result.minute}:${result.second}`
  );

};


// ============================================================
// CHECK VALID DATE STRING
// ============================================================

const isValidDateValue = (value) => {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {

    return false;

  }


  const date = new Date(value);

  return !isNaN(date.getTime());

};


// ============================================================
// DYNAMIC PRISMA DATETIME FIELDS
//
// This reads Prisma's model metadata.
//
// Example:
//
// dy_pg_srv_reqs
//   request_create_date -> DateTime
//   request_eta_date    -> DateTime
//
// dy_pg_bookings
//   bkg_date
//   planned_check_in_date
//   actual_check_in_date
//   planned_check_out_date
//   actual_check_out_date
//   create_time
//   modified_time
//
// No model names are hard-coded.
// ============================================================

const getDateTimeFields = (
  prisma,
  modelName
) => {

  try {

    // Prisma runtime model metadata
    const runtimeModels =
      prisma?._runtimeDataModel?.models;


    if (!runtimeModels) {

      console.warn(
        "Prisma runtime model metadata not available"
      );

      return [];

    }


    const modelMeta =
      runtimeModels[modelName];


    if (!modelMeta) {

      console.warn(
        `Prisma model metadata not found: ${modelName}`
      );

      return [];

    }


    return modelMeta.fields
      .filter((field) => {

        return (
          field.kind === "scalar" &&
          field.type === "DateTime"
        );

      })
      .map((field) => field.name);

  }

  catch (error) {

    console.error(
      "Error getting DateTime fields:",
      error
    );

    return [];

  }

};


// ============================================================
// ADD DEFAULT INDIAN DATETIME DYNAMICALLY
//
// Rules:
//
// 1. Field exists in Prisma as DateTime
// 2. Frontend sends value
//      -> KEEP frontend value
//
// 3. Frontend sends null
//      -> KEEP null
//
// 4. Frontend does not send field
//      -> CURRENT INDIAN DATETIME
//
// 5. Works for every Prisma model
// ============================================================

const addDefaultDateTimes = (
  prisma,
  modelName,
  data
) => {

  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {

    return data;

  }


  const dateTimeFields =
    getDateTimeFields(
      prisma,
      modelName
    );


  console.log(
    `DateTime fields for ${modelName}:`,
    dateTimeFields
  );


  for (const fieldName of dateTimeFields) {

    // ========================================================
    // FRONTEND DID NOT SEND FIELD
    // ========================================================

    if (
      !Object.prototype.hasOwnProperty.call(
        data,
        fieldName
      )
    ) {

      data[fieldName] =
        getIndianDateTime();

      console.log(
        `Default Indian datetime added: ${modelName}.${fieldName} = ${data[fieldName]}`
      );

      continue;

    }


    // ========================================================
    // FRONTEND SENT NULL
    //
    // Respect explicit null.
    // ========================================================

    if (data[fieldName] === null) {

      console.log(
        `Keeping NULL: ${modelName}.${fieldName}`
      );

      continue;

    }


    // ========================================================
    // FRONTEND SENT EMPTY STRING
    //
    // Treat empty string as missing.
    // ========================================================

    if (data[fieldName] === "") {

      data[fieldName] =
        getIndianDateTime();

      console.log(
        `Empty datetime replaced: ${modelName}.${fieldName} = ${data[fieldName]}`
      );

      continue;

    }


    // ========================================================
    // FRONTEND SENT DATETIME
    //
    // Keep it.
    // ========================================================

    if (
      typeof data[fieldName] === "string" &&
      isValidDateValue(data[fieldName])
    ) {

      console.log(
        `Keeping frontend datetime: ${modelName}.${fieldName} = ${data[fieldName]}`
      );

      continue;

    }

  }


  return data;

};


// ============================================================
// CONVERT ONLY DATETIME FIELDS
//
// This is different from your old convertDateFields.
//
// We only convert fields that Prisma says are DateTime.
// Therefore normal strings such as:
//
// service_title
// service_description
// feedback_summary
//
// are NOT accidentally converted into Date objects.
// ============================================================

const convertDateFields = (
  prisma,
  modelName,
  obj
) => {

  if (
    !obj ||
    typeof obj !== "object" ||
    Array.isArray(obj)
  ) {

    return obj;

  }


  const dateTimeFields =
    getDateTimeFields(
      prisma,
      modelName
    );


  for (const fieldName of dateTimeFields) {

    const value =
      obj[fieldName];


    // ========================================================
    // NULL
    // ========================================================

    if (value === null) {

      continue;

    }


    // ========================================================
    // ALREADY DATE OBJECT
    // ========================================================

    if (value instanceof Date) {

      continue;

    }


    // ========================================================
    // STRING
    // ========================================================

    if (typeof value === "string") {

      if (
        value.trim() === ""
      ) {

        continue;

      }


      const parsedDate =
        new Date(value);


      if (
        !isNaN(parsedDate.getTime())
      ) {

        obj[fieldName] =
          parsedDate;

      }

    }

  }


  return obj;

};

/* ================================
   SPECIAL HANDLERS (UNCHANGED)
================================ */

// (👉 All your functions remain SAME — no logic touched)

// ... keep ALL your existing functions exactly same ...
// getBedInfo, getPgInfoWithAmenities, getGuestWithPgInfo,
// executeSpecialHandler, handleFileUpload,
// handleSpecialCreate, handleMediaUploadAndUpdate,
// handleKycCreate, handlePgInfoUpdate, handlePgKycUpdate


/* ================================
   EXPORTS (ESM)
================================ */

export {
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
   specialAllowedParams,
   generateBookingNumber ,
    formatIST,
  formatResponseDates,
  handlePgBookingUpdate,
  addDefaultDateTimes

};
