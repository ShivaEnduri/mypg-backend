
import service from "../services/pgservices.js";
import sendResponse from "../utils/response.js";
import getDB from "../utils/dbResolver.js";
import S3Service from "../utils/mediaservices.js";
import getTableName from "../utils/tableResolver.js";
import {
  flattenResponse,
  flattenResponseFor
} from "../utils/responseFormatter.js";

const s3Service = new S3Service();

/**
 * ============================================================
 * HANDLE ACTION
 * ============================================================
 *
 * Supports:
 *
 * 1. CREATE
 * 2. SINGLE UPDATE
 * 3. BULK UPDATE
 * 4. DELETE
 * 5. GET ALL
 * 6. GET PG MEDIA
 * 7. GET AMENITIES
 * 8. GET PG KYC DOCUMENTS
 * 9. GET PROJECT DOCUMENTS
 * 10. TRANSACTION OPERATIONS
 *
 * ============================================================
 */




const handleAction = async (req, res) => {
  try {
    const { project, alias } = req.params;

    /**
     * ========================================================
     * RESOLVE MODEL
     * ========================================================
     */
    const model = getTableName(project, alias);

    /**
     * Action is assigned by your route middleware
     */
    const action = req.actionHandler;

    if (!action) {
      return sendResponse(res, {
        status: 400,
        success: false,
        message: "Invalid action mapping"
      });
    }

    /**
     * ========================================================
     * DEBUG REQUEST
     * ========================================================
     */
    console.log("\n================================================");
    console.log("REQUEST");
    console.log("================================================");

    console.log("PROJECT:", project);
    console.log("ALIAS:", alias);
    console.log("MODEL:", model);
    console.log("ACTION:", action);
    console.log("BODY:", req.body);
    console.log("FILES:", req.files);

    /**
     * ========================================================
     * EXTRACT REQUEST BODY
     * ========================================================
     */
    const {
      id,
      data,
      fields,
      payload,

      /**
       * BULK UPDATE
       */
      updates = [],

      where = {},
      filters = {},
      include = {},

      page,
      limit,

      operations = []
    } = req.body || {};

    /**
     * ========================================================
     * FINAL ID
     * ========================================================
     */
    let finalId =
      id ??
      req.query?.id ??
      req.params?.id;

    /**
     * ========================================================
     * PARSED DATA
     * ========================================================
     */
    let parsedData = {};

    /**
     * ========================================================
     * PAYLOAD
     * ========================================================
     */
    if (
      payload !== undefined &&
      payload !== null
    ) {
      let parsedPayload;

      try {
        parsedPayload =
          typeof payload === "string"
            ? JSON.parse(payload)
            : payload;
      } catch (error) {
        return sendResponse(res, {
          status: 400,
          success: false,
          message: "Invalid JSON in payload"
        });
      }

      /**
       * ------------------------------------------------------
       * ID inside payload
       * ------------------------------------------------------
       */
      if (
        finalId === undefined ||
        finalId === null
      ) {
        if (
          parsedPayload &&
          parsedPayload.id !== undefined
        ) {
          finalId =
            parsedPayload.id;
        }
      }

      /**
       * ------------------------------------------------------
       * payload.fields
       * ------------------------------------------------------
       */
      if (
        parsedPayload &&
        parsedPayload.fields
      ) {
        parsedData =
          parsedPayload.fields;
      }

      /**
       * ------------------------------------------------------
       * payload.data
       * ------------------------------------------------------
       */
      else if (
        parsedPayload &&
        parsedPayload.data
      ) {
        parsedData =
          parsedPayload.data;
      }

      /**
       * ------------------------------------------------------
       * payload plain object
       * ------------------------------------------------------
       */
      else {
        parsedData =
          parsedPayload;
      }
    }

    /**
     * ========================================================
     * FIELDS
     * ========================================================
     */
    else if (
      fields !== undefined &&
      fields !== null
    ) {
      try {
        parsedData =
          typeof fields === "string"
            ? JSON.parse(fields)
            : fields;
      } catch (error) {
        return sendResponse(res, {
          status: 400,
          success: false,
          message: "Invalid JSON in fields"
        });
      }
    }

    /**
     * ========================================================
     * DATA
     * ========================================================
     */
    else if (
      data !== undefined &&
      data !== null
    ) {
      let parsed;

      try {
        parsed =
          typeof data === "string"
            ? JSON.parse(data)
            : data;
      } catch (error) {
        return sendResponse(res, {
          status: 400,
          success: false,
          message: "Invalid JSON in data"
        });
      }

      /**
       * ------------------------------------------------------
       * Extract ID from data
       * ------------------------------------------------------
       */
      if (
        (
          finalId === undefined ||
          finalId === null
        ) &&
        parsed &&
        parsed.id !== undefined
      ) {
        finalId =
          parsed.id;
      }

      /**
       * ------------------------------------------------------
       * data.fields
       * ------------------------------------------------------
       */
      if (
        parsed &&
        parsed.fields
      ) {
        parsedData =
          parsed.fields;
      }

      /**
       * ------------------------------------------------------
       * data.data
       * ------------------------------------------------------
       */
      else if (
        parsed &&
        parsed.data
      ) {
        parsedData =
          parsed.data;
      }

      /**
       * ------------------------------------------------------
       * plain data
       * ------------------------------------------------------
       */
      else {
        parsedData =
          parsed;
      }
    }

    /**
     * ========================================================
     * DEBUG PARSED DATA
     * ========================================================
     */
    console.log("\n================================================");
    console.log("PARSED REQUEST");
    console.log("================================================");

    console.log("Final ID:", finalId);
    console.log("Parsed Data:", parsedData);
    console.log("Updates:", updates);

    /**
     * ========================================================
     * DATABASE
     * ========================================================
     */
    const prisma =
      getDB(project);

    /**
     * ========================================================
     * TRANSFORM HELPER
     * ========================================================
     */
    const applyTransform = async (
      data,
      modelForTransform = model
    ) => {
      if (!data) {
        return data;
      }

      const items =
        Array.isArray(data)
          ? data
          : [data];

      return await flattenResponseFor(
        items,
        project,
        modelForTransform
      );
    };

    /**
     * ========================================================
     * 1. BULK UPDATE
     * ========================================================
     *
     * Supported formats:
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
     * OR:
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
     *
     * `fields` is preferred.
     * `data` remains backward compatible.
     */
    if (
      action === "update" &&
      Array.isArray(updates) &&
      updates.length > 0
    ) {
      console.log(
        "\n================================================"
      );

      console.log(
        "BULK UPDATE"
      );

      console.log(
        "================================================"
      );

      console.log(
        "MODEL:",
        model
      );

      console.log(
        "NUMBER OF UPDATES:",
        updates.length
      );

      /**
       * ======================================================
       * VALIDATE BULK ARRAY
       * ======================================================
       */
      for (
        let index = 0;
        index < updates.length;
        index++
      ) {
        const item =
          updates[index];

        console.log(
          `\nValidating bulk item ${index + 1}`
        );

        console.log(
          "ITEM:",
          item
        );

        /**
         * ----------------------------------------------------
         * Validate item
         * ----------------------------------------------------
         */
        if (
          !item ||
          typeof item !== "object" ||
          Array.isArray(item)
        ) {
          return sendResponse(res, {
            status: 400,
            success: false,
            message:
              `Invalid update item at index ${index}`
          });
        }

        /**
         * ----------------------------------------------------
         * Validate ID or WHERE
         * ----------------------------------------------------
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
          return sendResponse(res, {
            status: 400,
            success: false,
            message:
              `Update item at index ${index} requires id or where`
          });
        }

        /**
         * ----------------------------------------------------
         * GET UPDATE FIELDS
         * ----------------------------------------------------
         *
         * Preferred:
         *
         *   item.fields
         *
         * Backward compatible:
         *
         *   item.data
         */
        const itemData =
          item.fields ??
          item.data;

        console.log(
          "BULK ITEM FIELDS:",
          itemData
        );

        /**
         * ----------------------------------------------------
         * Validate fields/data
         * ----------------------------------------------------
         */
        if (
          !itemData ||
          typeof itemData !== "object" ||
          Array.isArray(itemData) ||
          Object.keys(itemData).length === 0
        ) {
          return sendResponse(res, {
            status: 400,
            success: false,
            message:
              `Update fields are required at index ${index}`
          });
        }
      }

      /**
       * ======================================================
       * CALL SERVICE BULK UPDATE
       * ======================================================
       */
      const result =
        await service.update(
          project,
          model,
          {
            updates
          },
          null,
          req.files
        );

      console.log(
        "\n================================================"
      );

      console.log(
        "BULK UPDATE RESULT"
      );

      console.log(
        "================================================"
      );

      console.log(
        result
      );

      /**
       * ======================================================
       * RESPONSE
       * ======================================================
       */
      return sendResponse(res, {
        status: 200,
        success: true,
        message:
          "Bulk update successful",
        data: result
      });
    }

    /**
     * ========================================================
     * 2. TRANSACTION MODE
     * ========================================================
     */
    if (
      Array.isArray(operations) &&
      operations.length > 0
    ) {
      console.log(
        "\n================================================"
      );

      console.log(
        "TRANSACTION MODE"
      );

      console.log(
        "================================================"
      );

      const result =
        await prisma.$transaction(
          async (tx) => {
            const results = [];

            for (
              let index = 0;
              index < operations.length;
              index++
            ) {
              const op =
                operations[index];

              if (
                !op ||
                typeof op !== "object" ||
                Array.isArray(op)
              ) {
                throw new Error(
                  `Invalid operation at index ${index}`
                );
              }

              const {
                model:
                  operationModel,

                action:
                  operationAction,

                id:
                  operationId,

                data:
                  operationData,

                fields:
                  operationFields,

                where:
                  operationWhere = {},

                updates:
                  operationUpdates
              } = op;

              /**
               * ------------------------------------------------
               * Model for operation
               * ------------------------------------------------
               */
              const targetModel =
                operationModel ||
                model;

              /**
               * ------------------------------------------------
               * Determine operation data
               *
               * fields preferred
               * data backward compatible
               * ------------------------------------------------
               */
              let parsedOpData =
                operationFields ??
                operationData;

              /**
               * Parse string data
               */
              if (
                typeof parsedOpData ===
                "string"
              ) {
                try {
                  parsedOpData =
                    JSON.parse(
                      parsedOpData
                    );
                } catch (error) {
                  throw new Error(
                    `Invalid JSON data at operation ${index}`
                  );
                }
              }

              console.log(
                "TRANSACTION OPERATION:",
                {
                  index,
                  model:
                    targetModel,
                  action:
                    operationAction,
                  id:
                    operationId,
                  where:
                    operationWhere,
                  data:
                    parsedOpData
                }
              );

              /**
               * ==============================================
               * CREATE
               * ==============================================
               */
              if (
                operationAction ===
                "create"
              ) {
                results.push(
                  await service.create({
                    db:
                      project,

                    model:
                      targetModel,

                    data:
                      parsedOpData,

                    files:
                      req.files,

                    prisma:
                      tx
                  })
                );

                continue;
              }

              /**
               * ==============================================
               * UPDATE
               * ==============================================
               */
              if (
                operationAction ===
                "update"
              ) {
                results.push(
                  await service.update(
                    project,
                    targetModel,
                    {
                      id:
                        operationId,

                      where:
                        operationWhere,

                      data:
                        parsedOpData,

                      updates:
                        operationUpdates
                    },
                    tx,
                    req.files
                  )
                );

                continue;
              }

              /**
               * ==============================================
               * DELETE
               * ==============================================
               */
              if (
                operationAction ===
                "delete"
              ) {
                results.push(
                  await service.remove(
                    project,
                    targetModel,
                    {
                      id:
                        operationId,

                      where:
                        operationWhere
                    },
                    tx
                  )
                );

                continue;
              }

              /**
               * Unsupported operation
               */
              throw new Error(
                `Unsupported action "${operationAction}" at operation ${index}`
              );
            }

            return results;
          }
        );

      /**
       * ======================================================
       * TRANSACTION RESPONSE
       * ======================================================
       */
      return sendResponse(res, {
        status: 200,
        success: true,
        message:
          "Transaction successful",
        data:
          await applyTransform(
            result
          )
      });
    }

    /**
     * ========================================================
     * 3. WRITE OPERATIONS
     * ========================================================
     */
    if (
      [
        "create",
        "update",
        "delete"
      ].includes(action)
    ) {
      let result;

      /**
       * ======================================================
       * CREATE
       * ======================================================
       */
      if (
        action === "create"
      ) {
        if (
          !parsedData ||
          typeof parsedData !== "object" ||
          Array.isArray(parsedData)
        ) {
          return sendResponse(res, {
            status: 400,
            success: false,
            message:
              "Create data is required"
          });
        }

        result =
          await service.create({
            db:
              project,

            model:
              model,

            data:
              parsedData,

            files:
              req.files,

            prisma:
              prisma
          });
      }

      /**
       * ======================================================
       * SINGLE UPDATE
       * ======================================================
       */
      if (
        action === "update"
      ) {
        /**
         * ----------------------------------------------------
         * Validate ID/where
         * ----------------------------------------------------
         */
        const hasWhere =
          where &&
          typeof where === "object" &&
          !Array.isArray(where) &&
          Object.keys(where).length > 0;

        const hasId =
          finalId !== undefined &&
          finalId !== null &&
          finalId !== "";

        if (
          !hasId &&
          !hasWhere
        ) {
          return sendResponse(res, {
            status: 400,
            success: false,
            message:
              "Update requires id or where"
          });
        }

        /**
         * ----------------------------------------------------
         * Validate data
         * ----------------------------------------------------
         */
        if (
          !parsedData ||
          typeof parsedData !== "object" ||
          Array.isArray(parsedData) ||
          Object.keys(parsedData).length === 0
        ) {
          return sendResponse(res, {
            status: 400,
            success: false,
            message:
              "Update data is required"
          });
        }

        console.log(
          "\n================================================"
        );

        console.log(
          "SINGLE UPDATE"
        );

        console.log(
          "================================================"
        );

        console.log(
          "MODEL:",
          model
        );

        console.log(
          "ID:",
          finalId
        );

        console.log(
          "WHERE:",
          where
        );

        console.log(
          "DATA:",
          parsedData
        );

        /**
         * ----------------------------------------------------
         * SERVICE UPDATE
         * ----------------------------------------------------
         */
        result =
          await service.update(
            project,
            model,
            {
              id:
                finalId,

              where:
                where,

              data:
                parsedData
            },
            null,
            req.files
          );
      }

      /**
       * ======================================================
       * DELETE
       * ======================================================
       */
      if (
        action === "delete"
      ) {
        const deleteId =
          id ??
          req.query?.id ??
          req.params?.id;

        const hasWhere =
          where &&
          typeof where === "object" &&
          !Array.isArray(where) &&
          Object.keys(where).length > 0;

        if (
          (
            deleteId === undefined ||
            deleteId === null ||
            deleteId === ""
          ) &&
          !hasWhere
        ) {
          return sendResponse(res, {
            status: 400,
            success: false,
            message:
              "Delete requires id or where"
          });
        }

        result =
          await service.remove(
            project,
            model,
            {
              id:
                deleteId,

              where:
                where
            },
            prisma
          );
      }

      /**
       * ======================================================
       * WRITE RESPONSE
       * ======================================================
       */
      return sendResponse(res, {
        status: 200,
        success: true,
        message:
          `${action} successful`,
        data:
          result
      });
    }

    /**
     * ========================================================
     * 4. READ OPERATIONS
     * ========================================================
     */
    let result;

    switch (action) {

      /**
       * ======================================================
       * GET ALL
       * ======================================================
       */
      case "getAll":

        result =
          await service.getRecords(
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

        return sendResponse(
          res,
          result
        );

      /**
       * ======================================================
       * GET PG MEDIA
       * ======================================================
       */
      case "getPgMedia":

        result =
          await service.getPgInfoMedia({
            prisma,
            s3Service
          });

        break;

      /**
       * ======================================================
       * GET AMENITIES
       * ======================================================
       */
      case "getAmenities":

        result =
          await service.getAmenities(
            req,
            res
          );

        break;

      /**
       * ======================================================
       * GET PG KYC DOCUMENTS
       * ======================================================
       */
      case "getPgKycDocs":

        result =
          await service.getPgKycDocuments({
            prisma,
            pg_info:
              req.query.pg_info,
            s3Service
          });

        break;

      /**
       * ======================================================
       * GET PROJECT DOCUMENTS
       * ======================================================
       */
      case "getProjectDocuments":

        result =
          await service.getProjectDocuments({
            prisma,

            project_formatted_id:
              req.query.project_formatted_id,

            s3Service
          });

        break;

      /**
       * ======================================================
       * UNKNOWN ACTION
       * ======================================================
       */
      default:

        return sendResponse(res, {
          status: 400,
          success: false,
          message:
            `Unsupported action: ${action}`
        });
    }

    /**
     * ========================================================
     * TRANSFORM READ RESPONSE
     * ========================================================
     */
    return sendResponse(res, {
      data:
        await applyTransform(
          result
        )
    });

  } catch (err) {

    console.error(
      "\n❌ Controller Error:",
      err
    );

    console.error(
      "Error Stack:",
      err.stack
    );

    return sendResponse(res, {
      status: 500,
      success: false,
      message:
        err.message
    });
  }
};

export default {
  handleAction
};