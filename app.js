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
  "http://localhost:5173",
  "https://my-avas.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow Postman/server-to-server requests
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log("CORS blocked origin:", origin);

      return callback(
        new Error(`CORS blocked for origin: ${origin}`)
      );
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