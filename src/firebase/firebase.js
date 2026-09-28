

// import admin from "firebase-admin";

// import {
//   readFileSync,
// } from "fs";

// import {
//   resolve,
//   dirname,
// } from "path";

// import {
//   fileURLToPath,
// } from "url";

// // ============================================================
// // PATH
// // ============================================================

// const __filename =
//   fileURLToPath(import.meta.url);

// const __dirname =
//   dirname(__filename);

// // ============================================================
// // INITIALIZE FIREBASE
// // ============================================================

// const initFirebase = () => {
//   // Already initialized
//   if (admin.apps.length > 0) {
//     return admin.apps[0];
//   }

//   // ----------------------------------------------------------
//   // Service account path
//   // ----------------------------------------------------------

//   const keyPath = resolve(
//     __dirname,
//     "../../serviceAccountKey.json"
//   );

//   let serviceAccount;

//   try {
//     serviceAccount = JSON.parse(
//       readFileSync(
//         keyPath,
//         "utf-8"
//       )
//     );
//   } catch (error) {
//     console.error(
//       "Firebase service account error:",
//       error
//     );

//     throw new Error(
//       `Cannot read serviceAccountKey.json at: ${keyPath}`
//     );
//   }

//   // ----------------------------------------------------------
//   // Initialize
//   // ----------------------------------------------------------

//   admin.initializeApp({
//     credential:
//       admin.credential.cert(
//         serviceAccount
//       ),
//   });

//   console.log(
//     "Firebase Admin SDK initialized"
//   );

//   return admin.apps[0];
// };

// // ============================================================
// // INIT
// // ============================================================

// initFirebase();

// // ============================================================
// // EXPORT
// // ============================================================

// export const auth =
//   admin.auth();

// export default admin;



import admin from "firebase-admin";

import {
  readFileSync,
} from "fs";

import {
  resolve,
  dirname,
} from "path";

import {
  fileURLToPath,
} from "url";

// ============================================================
// PATH
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================
// INITIALIZE FIREBASE
// ============================================================

const initFirebase = () => {
  // Already initialized
  if (admin.apps.length > 0) {
    return admin.apps[0];
  }

  let serviceAccount;

  // ==========================================================
  // RAILWAY / PRODUCTION
  // ==========================================================

  if (process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY) {

    console.log("Initializing Firebase using environment variables...");

    serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,

      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,

      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(
        /\\n/g,
        "\n"
      ),
    };
  }

  // ==========================================================
  // LOCAL DEVELOPMENT
  // ==========================================================

  else {

    console.log(
      "Firebase environment variables not found."
    );

    console.log(
      "Trying local serviceAccountKey.json..."
    );

    const keyPath = resolve(
      __dirname,
      "../../serviceAccountKey.json"
    );

    try {

      serviceAccount = JSON.parse(
        readFileSync(
          keyPath,
          "utf-8"
        )
      );

    } catch (error) {

      console.error(
        "Firebase service account error:",
        error
      );

      throw new Error(
        `Cannot initialize Firebase.

For Railway:
Set FIREBASE_PROJECT_ID,
FIREBASE_CLIENT_EMAIL,
and FIREBASE_PRIVATE_KEY.

For local development:
Make sure serviceAccountKey.json exists at:
${keyPath}`
      );
    }
  }

  // ==========================================================
  // INITIALIZE FIREBASE ADMIN
  // ==========================================================

  admin.initializeApp({
    credential:
      admin.credential.cert(
        serviceAccount
      ),
  });

  console.log(
    "Firebase Admin SDK initialized"
  );

  return admin.apps[0];
};

// ============================================================
// INIT
// ============================================================

initFirebase();

// ============================================================
// EXPORT
// ============================================================

export const auth = admin.auth();

export default admin;