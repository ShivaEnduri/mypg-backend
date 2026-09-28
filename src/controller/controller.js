


import service from "../services/services.js";
import sendResponse from "../utils/response.js";
import getDB from "../utils/dbResolver.js";
import S3Service from "../utils/mediaservices.js";
import getTableName from "../utils/tableResolver.js";
import { flattenResponse } from "../utils/responseFormatter.js";
import { flattenResponseFor } from "../utils/responseFormatter.js";



const s3Service = new S3Service();


const handleAction = async (req, res) => {
  try {
    const { project, alias } = req.params;

    const model = getTableName(project, alias);
    const action = req.actionHandler;

    if (!action) {
      return sendResponse(res, {
        status: 400,
        success: false,
        message: "Invalid action mapping"
      });
    }

    console.log("BODY:", req.body);
console.log("FILES:", req.files);

   const {
  id,
  data,
  fields,
  payload,
  where = {},
  filters = {},
  include = {},
  page,
  limit,
  operations = []
} = req.body || {};

let parsedData = {};
// let finalId = id || req.query.id || req.params.id;
let finalId =
  id ??
  req.query.id ??
  req.params.id;

// ----------------------
// Support Frontend Payload
// ----------------------
if (payload) {
  // payload can be object or string
  const parsedPayload =
    typeof payload === "string"
      ? JSON.parse(payload)
      : payload;

  // id inside payload
  if (!finalId && parsedPayload.id !== undefined) {
    finalId = parsedPayload.id;
  }

  // Frontend sends fields
  if (parsedPayload.fields) {
    parsedData = parsedPayload.fields;
  }
  // Existing format
  else if (parsedPayload.data) {
    parsedData = parsedPayload.data;
  }
  // Fallback
  else {
    parsedData = parsedPayload;
  }
}
else if (fields) {
  parsedData =
    typeof fields === "string"
      ? JSON.parse(fields)
      : fields;
}

else if (data) {
  const parsed =
    typeof data === "string"
      ? JSON.parse(data)
      : data;

  // Extract id if present
  if (!finalId && parsed.id !== undefined) {
    finalId = parsed.id;
  }

  // Support { fields: {} }
  if (parsed.fields) {
    parsedData = parsed.fields;
  }
  // Support { data: {} }
  else if (parsed.data) {
    parsedData = parsed.data;
  }
  // Support plain object
  else {
    parsedData = parsed;
  }
}

console.log("Final ID:", finalId);
console.log("Parsed Data:", parsedData);

    // const parsedData =
    //   typeof data === "string" ? JSON.parse(data) : data;

    const prisma = getDB(project);

    /* =====================================================
       ✅ TRANSFORM HELPER
    ===================================================== */

    const applyTransform = async (data, modelForTransform = model) => {
      if (!data) return data;
      const items = Array.isArray(data) ? data : [data];
      return await flattenResponseFor(items, project, modelForTransform);
    };
    
    /* =====================================================
       ✅ TRANSACTION MODE
    ===================================================== */
    if (operations.length > 0) {
      const result = await prisma.$transaction(async (tx) => {
        const results = [];

        for (const op of operations) {
          const { model, action, id, data, where } = op;

          const parsedOpData =
            typeof data === "string" ? JSON.parse(data) : data;

            console.log("FINAL PARSED DATA:", parsedData);

          switch (action) {
            case "create":
              results.push(
                await service.create({
                  db: project,
                  model,
                  data: parsedOpData,
                  files: req.files,
                  prisma: tx
                })
              );
              break;

            case "update":
              result = await service.update(
                  project,
                  model,
                  {
                    id: finalId,
                    where,
                    data: parsedData
                  },
                  null,
                  req.files
                );
              break;

            case "delete":
              results.push(
                await service.remove(
                  project,
                  model,
                  { id, where },
                  tx
                )
              );
              break;

            default:
              throw new Error(`Unsupported action: ${action}`);
          }
        }

        return results;
      });

      return sendResponse(res, {
        data: applyTransform(result)
      });
    }

    /* =====================================================
       ✅ WRITE OPERATIONS
    ===================================================== */
    if (["create", "update", "delete"].includes(action)) {

      let result;

      if (action === "create") {
        result = await service.create({
          db: project,
          model,
          data: parsedData,
          files: req.files,
          prisma
        });
      }

      if (action === "update") {
        result = await service.update(
          project,
          model,
          {
            id: finalId,
            where,
            data: parsedData
          },
          null,
          req.files
        );
      }

      if (action === "delete") {
        const finalId = id || req.query.id;

        result = await service.remove(
          project,
          model,
          { id: finalId, where },
          prisma
        );
      }

      return sendResponse(res, {
        status: 200,
        message: `${action} successful`,
        data: result
      });
    }

    /* =====================================================
       ✅ READ OPERATIONS
    ===================================================== */
    let result;

    switch (action) {
   case "getAll":
  result = await service.getRecords(
    project,
    model,
    req,
    {
      filters,
      include,
      page,
      limit
    },
    prisma
  );

  return sendResponse(res, result);

      case "getPgMedia":
        result = await service.getPgInfoMedia({
          prisma,
          s3Service
        });
        break;

        case "getAmenities":
  result = await service.getAmenities(req, res);
  break;

      case "getPgKycDocs":
        result = await service.getPgKycDocuments({
          prisma,
          pg_info: req.query.pg_info,
          s3Service
        });
        break;

        case "getProjectDocuments":

        result = await service.getProjectDocuments({
            prisma,
            project_formatted_id:
                req.query.project_formatted_id,
            s3Service
        });

        break;
        
      default:
        return sendResponse(res, {
          status: 400,
          success: false,
          message: `Unsupported action: ${action}`
        });
    }

    return sendResponse(res, {
      data: applyTransform(result)
    });

  } catch (err) {
    console.error("❌ Controller Error:", err);

    return sendResponse(res, {
      status: 500,
      success: false,
      message: err.message
    });
  }
};

export default {
  handleAction
};