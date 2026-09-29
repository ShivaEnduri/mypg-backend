// import express from "express";
// import cors from "cors";
// import userRoutes from "./src/routes/pgroutes.js";
// import fireRoutes from "./src/firebase/routes.js";
// import otpRoutes from "./src/firebase/optRoutes.js";

// const app = express();

// // ── CORS ──────────────────────────────────────────────────────────────────────
// app.use(
//   cors({
//     origin: "http://localhost:5173",
//     methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
//     allowedHeaders: ["Content-Type", "Authorization"],
//   })
// );

// app.use(express.json());

// // ── Health API ─────────────────────────────────────────────────────────────────
// app.get("/api/health", async (req, res) => {
//   try {
//     // Example:
//     // await prisma.$queryRaw`SELECT 1`;

//     res.status(200).json({
//       success: true,
//       status: "UP",
//       server: "UP",
//       database: "UP",
//       timestamp: new Date().toISOString(),
//     });
//   } catch (error) {
//     res.status(503).json({
//       success: false,
//       status: "DOWN",
//       server: "UP",
//       database: "DOWN",
//       timestamp: new Date().toISOString(),
//       error: error.message,
//     });
//   }
// });

// // ── Routes ────────────────────────────────────────────────────────────────────
// app.use("/api/fire", fireRoutes);
// app.use("/api/otp", otpRoutes);
// app.use("/api", userRoutes);

// export default app;


import express from "express";
import cors from "cors";

import userRoutes
  from "./src/routes/pgroutes.js";

import fireRoutes
  from "./src/firebase/routes.js";

import otpRoutes
  from "./src/firebase/optRoutes.js";
  import  Aggregateroutes  from "./src/routes/aggregateroutes.js";

const app =
  express();

// /* ============================================================
//    CORS
// ============================================================ */

// app.use(
//   cors({
//     origin:
//       "http://localhost:5173",
      

//     methods: [
//       "GET",
//       "POST",
//       "PATCH",
//       "PUT",
//       "DELETE",
//       "OPTIONS",
//     ],

//     allowedHeaders: [
//       "Content-Type",
//       "Authorization",
//     ],
//   })
// );

/* ============================================================
   CORS
============================================================ */

const allowedOrigins = [
  // You can keep specific domains here if you want
  // "http://localhost:5173",
  // "https://my-2k1f2ldzz-shiva-enduris-projects.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests without an Origin header
      // (Postman, server-to-server, mobile apps, etc.)
      if (!origin) {
        return callback(null, true);
      }

      // Allow ALL origins
      return callback(null, true);
    },

    methods: [
      "GET",
      "POST",
      "PATCH",
      "PUT",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],

    credentials: true,
  })
);

// Handle preflight requests
app.options("*", cors());
/* ============================================================
   BODY
============================================================ */

app.use(
  express.json()
);

app.get("/api/health", async (req, res) => {
  try {
    // Example:
    // await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      success: true,
      status: "UP",
      server: "UP",
      database: "UP",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: "DOWN",
      server: "UP",
      database: "DOWN",
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

/* ============================================================
   PUBLIC AUTH ROUTES
============================================================ */

app.use(
  "/api/fire",
  fireRoutes
);

app.use(
  "/api/otp",
  otpRoutes
);

/* ============================================================
   PROTECTED PG / USER ROUTES
============================================================ */
app.use("/api/pg/aggregate",Aggregateroutes)
app.use(
  "/api",
  userRoutes
);

export default app;