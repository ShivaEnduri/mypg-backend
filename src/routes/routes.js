






import express from "express";
import multer from "multer";
import controller from "../controller/controller.js";
import getTableName from "../utils/tableResolver.js";

const router = express.Router();

/* ===============================
   📦 Upload Config (BY ALIAS)
=============================== */
const uploadConfig = {
  "pg-info": [
    { name: "images", maxCount: 5 },
    { name: "videos", maxCount: 2 },
    { name: "documents", maxCount: 2 }
  ],

  "pg-kyc-info": [
    { name: "kyc_document_path", maxCount: 2 }
  ]
};

/* ===============================
   📦 Multer Setup
=============================== */
const baseUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/pdf",
      "video/mp4",
      "video/webm",
      "video/quicktime"
    ];

    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
  }
});

/* ===============================
   ⚡ Dynamic Upload Middleware
=============================== */
const dynamicUpload = (req, res, next) => {
  try {
    const { project, alias } = req.params;

    const modelName = getTableName(project, alias);

    if (!modelName) {
      return res.status(404).json({
        success: false,
        message: `Unknown module '${alias}' for project '${project}'`
      });
    }

    req.project = project;
    req.alias = alias;
    req.modelName = modelName;

    const fieldsConfig = uploadConfig[alias];

    if (!fieldsConfig) {
      return next();
    }

    baseUpload.fields(fieldsConfig)(req, res, (err) => {
      if (err) return next(err);

      console.log("📂 Project :", project);
      console.log("📂 Alias   :", alias);
      console.log("📂 Model   :", modelName);
      console.log("📁 Files   :", req.files || "No files");

      next();
    });

  } catch (err) {
    next(err);
  }
};

/* ===============================
   🛡 Async Wrapper
=============================== */
const wrapAsync = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/* ===============================
   🎯 ACTIONS
=============================== */
const actions = {
  getAllRecords: { method: "get", handler: "getAll" },
  addRecord: { method: "post", handler: "create" },
  updateRecord: { method: "put", handler: "update" },
  deleteRecord: { method: "delete", handler: "delete" },

  getPgMedia: { method: "get", handler: "getPgMedia" },
  getPgKycDocs: { method: "get", handler: "getPgKycDocs" },
  getProjectDocuments: { method: "get", handler: "getProjectDocuments"},
  getAmenities: { method: "get", handler: "getAmenities" }
};

/* ===============================
   🚀 Dynamic Routes
=============================== */
Object.entries(actions).forEach(([actionName, config]) => {
  router[config.method](
    `/:project/:alias/${actionName}`,
    dynamicUpload,
    wrapAsync(async (req, res) => {
      req.actionHandler = config.handler;
      return controller.handleAction(req, res);
    })
  );
});

/* ===============================
   ❌ Error Handler
=============================== */
router.use((err, req, res, next) => {
  console.error("❌", err);

  res.status(400).json({
    success: false,
    message: err.message || "Something went wrong",
    data: null
  });
});

export default router;