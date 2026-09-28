// // src/config/firebase.js

// import admin from "firebase-admin";
// import { readFileSync } from "fs";
// import { resolve, dirname } from "path";
// import { fileURLToPath } from "url";

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

// const initFirebase = () => {
//   if (admin.apps.length > 0) return admin.apps[0];

//   // Looks for serviceAccountKey.json in FIREBASE/ root folder
//   const keyPath = resolve(__dirname, "../../serviceAccountKey.json");

//   let serviceAccount;
//   try {
//     serviceAccount = JSON.parse(readFileSync(keyPath, "utf-8"));
//   } catch (err) {
//     throw new Error(`❌ Cannot read serviceAccountKey.json at: ${keyPath}`);
//   }

//   admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount),
//   });

//   console.log("✅ Firebase Admin SDK initialized");
//   return admin.apps[0];
// };

// initFirebase();

// export const auth = admin.auth();
// export default admin;



// src/config/firebase.js

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

const __filename =
  fileURLToPath(import.meta.url);

const __dirname =
  dirname(__filename);

// ============================================================
// INITIALIZE FIREBASE
// ============================================================

const initFirebase = () => {
  // Already initialized
  if (admin.apps.length > 0) {
    return admin.apps[0];
  }

  // ----------------------------------------------------------
  // Service account path
  // ----------------------------------------------------------

  const keyPath = resolve(
    __dirname,
    "../../serviceAccountKey.json"
  );

  let serviceAccount;

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
      `Cannot read serviceAccountKey.json at: ${keyPath}`
    );
  }

  // ----------------------------------------------------------
  // Initialize
  // ----------------------------------------------------------

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

export const auth =
  admin.auth();

export default admin;