

// src/middleware/verifyFirebaseToken.js

import { auth } from "./firebase.js";

const verifyFirebaseToken = async (
  req,
  res,
  next
) => {
  try {
    const authHeader =
      req.headers.authorization;

    // --------------------------------------------------------
    // Authorization header
    // --------------------------------------------------------

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message:
          "Authorization header is required",
      });
    }

    // --------------------------------------------------------
    // Bearer token
    // --------------------------------------------------------

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message:
          "Expected Authorization: Bearer <firebaseIdToken>",
      });
    }

    const idToken =
      authHeader.substring(7).trim();

    if (!idToken) {
      return res.status(401).json({
        success: false,
        message: "Firebase token is missing",
      });
    }

    // --------------------------------------------------------
    // Verify Firebase token
    // --------------------------------------------------------

    const decodedToken =
      await auth.verifyIdToken(idToken);

    // --------------------------------------------------------
    // Attach Firebase user
    // --------------------------------------------------------

    req.firebaseUser = decodedToken;

    next();

  } catch (error) {
    console.error(
      "Token verification failed:",
      error.message
    );

    return res.status(401).json({
      success: false,
      message:
        "Invalid or expired Firebase token",
    });
  }
};

export default verifyFirebaseToken;