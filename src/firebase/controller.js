



// import { getPrismaClient } from "../prisma.js";
// import { auth } from "./firebase.js";

// const prisma = getPrismaClient("pg");

// // ----------------------------------------------------
// // Helper – split display name
// // ----------------------------------------------------
// const splitDisplayName = (displayName = "") => {
//   const parts = displayName.trim().split(/\s+/);

//   return {
//     first_name: parts[0] || "",
//     last_name: parts.slice(1).join(" ") || "",
//   };
// };

// // ----------------------------------------------------
// // Supported Providers
// // ----------------------------------------------------
// const SUPPORTED_PROVIDERS = [
//   "google.com",
//   "facebook.com",
//   "microsoft.com",
//   "twitter.com",
//   "github.com",
// ];

// const RELIABLE_NAME_PROVIDERS = [
//   "google.com",
//   "facebook.com",
// ];

// // ----------------------------------------------------
// // SOCIAL LOGIN
// // ----------------------------------------------------
// export const socialLogin = async (req, res) => {
//   try {
//     const { idToken } = req.body;

//     if (!idToken) {
//       return res.status(400).json({
//         success: false,
//         message: "idToken is required",
//       });
//     }

//     let decodedToken;

//     try {
//       decodedToken = await auth.verifyIdToken(idToken);
//     } catch (err) {
//       return res.status(401).json({
//         success: false,
//         message: "Invalid Firebase token",
//         error: err.message,
//       });
//     }

//     const { uid, email, name, firebase,email_verified } = decodedToken;

//     const provider = firebase?.sign_in_provider;

//     if (!SUPPORTED_PROVIDERS.includes(provider)) {
//       return res.status(400).json({
//         success: false,
//         message: `Unsupported provider: ${provider}`,
//       });
//     }

//     const shouldUseName = RELIABLE_NAME_PROVIDERS.includes(provider);

//     const {
//       first_name: tokenFirstName,
//       last_name: tokenLastName,
//     } = splitDisplayName(shouldUseName ? name : "");

    
//     const safeEmail = email ?? null;

//     let user = await prisma.dy_user.findFirst({
//       where: {
//         univ_user_id: uid,
//       },
//     });

//     let isNewUser = false;

//    if (user) {
//   user = await prisma.dy_user.update({
//     where: {
//       id: user.id,
//     },
//     data: {
//       rstatus: 1,
//       is_active: 1,

//       ...(safeEmail && {
//         email_id: safeEmail,
//         email_verified: 1,
//       }),

//       ...(tokenFirstName && {
//         first_name: user.first_name || tokenFirstName,
//       }),

//       ...(tokenLastName && {
//         last_name: user.last_name || tokenLastName,
//       }),
//     },
//   });
// } else {
//       isNewUser = true;

//       user = await prisma.dy_user.create({
//         data: {
//           univ_user_id: uid,
//           first_name: tokenFirstName,
//           last_name: tokenLastName,
//           email_id: safeEmail,
//           mobile_no: null,
//           gender_id: null,
//           rstatus: 1,
//           is_active: 1,
//           email_verified: email_verified ? 1 : 0,
//           mobile_verified: 1,
//         },
//       });
//     }

//     const isProfileIncomplete =
//       !user.first_name ||
//       !user.last_name ||
//       !user.mobile_no ||
//       !user.gender_id;

//     return res.status(200).json({
//       success: true,
//       message: isNewUser
//         ? "Account created successfully"
//         : "Login successful",
//       provider,
//       isNewUser,
//       isProfileIncomplete,
//       user,
//     });
//   } catch (error) {
//     console.error("socialLogin error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Internal server error",
//       error: error.message,
//     });
//   }
// };

// // ----------------------------------------------------
// // GET ME
// // ----------------------------------------------------
// export const getMe = async (req, res) => {
//   try {
//     const { uid } = req.firebaseUser;

//     const user = await prisma.dy_user.findFirst({
//       where: {
//         univ_user_id: uid,
//       },
//     });

//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       user,
//     });
//   } catch (error) {
//     console.error("getMe error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//     });
//   }
// };

// // ----------------------------------------------------
// // UPDATE PROFILE
// // ----------------------------------------------------
// export const updateProfile = async (req, res) => {
//   try {
//     const { uid } = req.firebaseUser;

//     const {
//       first_name,
//       last_name,
//       email_id,
//       mobile_no,
//       gender_id,
//     } = req.body;

//     const user = await prisma.dy_user.findFirst({
//       where: {
//         univ_user_id: uid,
//       },
//     });

//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     const updated = await prisma.dy_user.update({
//       where: {
//         id: user.id,
//       },
//       data: {
//         ...(first_name !== undefined && { first_name }),
//         ...(last_name !== undefined && { last_name }),
//         ...(email_id !== undefined && { email_id }),
//         ...(mobile_no !== undefined && { mobile_no }),
//         ...(gender_id !== undefined && { gender_id }),
//       },
//     });

//     return res.status(200).json({
//       success: true,
//       message: "Profile updated successfully",
//       user: updated,
//     });
//   } catch (error) {
//     console.error("updateProfile error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message,
//     });
//   }
// };

// // ----------------------------------------------------
// // DEACTIVATE ACCOUNT
// // ----------------------------------------------------
// export const deactivateAccount = async (req, res) => {
//   try {
//     const { uid } = req.firebaseUser;

//     const user = await prisma.dy_user.findFirst({
//       where: {
//         univ_user_id: uid,
//       },
//     });

//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     await prisma.dy_user.update({
//       where: {
//         id: user.id,
//       },
//       data: {
//         rstatus: 0,
//         is_active: 0,
//       },
//     });

//     return res.status(200).json({
//       success: true,
//       message: "Account deactivated",
//     });
//   } catch (error) {
//     console.error("deactivateAccount error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message,
//     });
//   }
// };



import { getPrismaClient } from "../prisma.js";
import { auth } from "./firebase.js";

const prisma = getPrismaClient("pg");

// ============================================================
// HELPERS
// ============================================================

const splitDisplayName = (displayName = "") => {
  const parts = String(displayName)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return {
    first_name: parts[0] || "",
    last_name: parts.slice(1).join(" ") || "",
  };
};


// ============================================================
// SUPPORTED PROVIDERS
// ============================================================

const SUPPORTED_PROVIDERS = [
  "google.com",
  "facebook.com",
  "microsoft.com",
  "twitter.com",
  "github.com",
];


// ============================================================
// PROVIDER EMAIL
// ============================================================

const getProviderEmail = (firebaseUser, provider) => {
  if (!firebaseUser?.providerData) {
    return null;
  }

  const providerUser = firebaseUser.providerData.find(
    (item) => item.providerId === provider
  );

  return providerUser?.email || null;
};


// ============================================================
// PROFILE COMPLETENESS
//
// IMPORTANT:
// This determines whether frontend should show
// "Complete your profile".
//
// Once all required information is saved,
// this becomes false on every future login.
// ============================================================

const checkProfileIncomplete = (user) => {
  if (!user) {
    return true;
  }

  return (
    !user.first_name ||
    !user.last_name ||
    !user.mobile_no ||
    Number(user.mobile_verified) !== 1 ||
    user.gender_id === null ||
    user.gender_id === undefined
  );
};


// ============================================================
// SOCIAL LOGIN
// ============================================================

export const socialLogin = async (req, res) => {
  try {
    const { idToken } = req.body;

    // ========================================================
    // 1. VALIDATE TOKEN
    // ========================================================

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: "idToken is required",
      });
    }


    // ========================================================
    // 2. VERIFY FIREBASE TOKEN
    // ========================================================

    let decodedToken;

    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (error) {
      console.error(
        "Firebase token verification error:",
        error.message
      );

      return res.status(401).json({
        success: false,
        message: "Invalid or expired Firebase token",
      });
    }


    // ========================================================
    // 3. FIREBASE UID
    // ========================================================

    const uid = decodedToken.uid;

    if (!uid) {
      return res.status(401).json({
        success: false,
        message: "Firebase UID not found",
      });
    }


    // ========================================================
    // 4. GET FIREBASE USER
    // ========================================================

    let firebaseUser;

    try {
      firebaseUser = await auth.getUser(uid);
    } catch (error) {
      console.error(
        "Firebase getUser error:",
        error.message
      );

      return res.status(401).json({
        success: false,
        message: "Unable to retrieve Firebase user",
      });
    }


    // ========================================================
    // 5. PROVIDER
    // ========================================================

    const provider =
      decodedToken.firebase?.sign_in_provider ||
      firebaseUser.providerData?.[0]?.providerId ||
      null;


    if (!SUPPORTED_PROVIDERS.includes(provider)) {
      return res.status(400).json({
        success: false,
        message: `Unsupported provider: ${provider}`,
      });
    }


    // ========================================================
    // 6. FIND PROVIDER DATA
    //
    // This is IMPORTANT for your case.
    //
    // Your Firebase response contains:
    //
    // providerData: [
    //   {
    //     providerId: "google.com",
    //     email: "jaswanthkumarreddy111@gmail.com"
    //   }
    // ]
    // ========================================================

    const providerUser =
      firebaseUser.providerData?.find(
        (item) =>
          item.providerId === provider
      );


    // ========================================================
    // 7. GET EMAIL
    //
    // Priority:
    //
    // 1. Firebase user email
    // 2. Provider email
    // 3. ID token email
    // ========================================================

    const firebaseEmail =
      firebaseUser.email ||
      providerUser?.email ||
      decodedToken.email ||
      null;


    // ========================================================
    // 8. EMAIL VERIFIED
    // ========================================================

    let firebaseEmailVerified =
      firebaseUser.emailVerified === true ||
      decodedToken.email_verified === true;


    // ========================================================
    // GOOGLE PROVIDER
    //
    // Google authenticated email is considered verified
    // when the email comes from the Google provider.
    // ========================================================

    if (
      provider === "google.com" &&
      providerUser?.email
    ) {
      firebaseEmailVerified = true;
    }


    // ========================================================
    // 9. DISPLAY NAME
    // ========================================================

    const displayName =
      firebaseUser.displayName ||
      decodedToken.name ||
      providerUser?.displayName ||
      "";


    const {
      first_name: firebaseFirstName,
      last_name: firebaseLastName,
    } = splitDisplayName(displayName);


    // ========================================================
    // 10. DEBUG
    // ========================================================

    console.log("========================================");
    console.log("FIREBASE LOGIN");
    console.log("========================================");

    console.log("UID:", uid);

    console.log(
      "TOKEN EMAIL:",
      decodedToken.email
    );

    console.log(
      "TOKEN EMAIL VERIFIED:",
      decodedToken.email_verified
    );

    console.log(
      "FIREBASE USER EMAIL:",
      firebaseUser.email
    );

    console.log(
      "FIREBASE USER EMAIL VERIFIED:",
      firebaseUser.emailVerified
    );

    console.log(
      "PROVIDER:",
      provider
    );

    console.log(
      "PROVIDER EMAIL:",
      providerUser?.email
    );

    console.log(
      "FINAL EMAIL:",
      firebaseEmail
    );

    console.log(
      "FINAL EMAIL VERIFIED:",
      firebaseEmailVerified
    );

    console.log(
      "DISPLAY NAME:",
      displayName
    );

    console.log("========================================");


    // ========================================================
    // 11. FIND DATABASE USER
    // ========================================================

    let user = await prisma.dy_user.findFirst({
      where: {
        univ_user_id: uid,
      },
    });


    let isNewUser = false;


    // ========================================================
    // 12. CREATE NEW USER
    // ========================================================

    if (!user) {
      isNewUser = true;

      console.log(
        "Creating new dy_user:",
        uid
      );


      user = await prisma.dy_user.create({
        data: {
          // Firebase UID
          univ_user_id: uid,

          // Google/Firebase name
          first_name:
            firebaseFirstName || null,

          last_name:
            firebaseLastName || null,

          // Google email
          email_id:
            firebaseEmail || null,

          // User has not completed mobile verification
          mobile_no: null,

          mobile_verified: 0,

          // Google email is verified
          email_verified:
            firebaseEmailVerified ? 1 : 0,

          // Optional fields
          ref_code: null,
           signuptime: new Date(),

          passwd: null,

          gender_id: null,

          customer_id: null,

          project_category: null,

          // Account active
          is_active: 1,

          rstatus: 1,
        },
      });


      console.log(
        "NEW USER CREATED:",
        user
      );
    }


    // ========================================================
    // 13. EXISTING USER
    // ========================================================

    else {
      console.log(
        "Existing user found:",
        user.id
      );


      // ------------------------------------------------------
      // Build update object
      // ------------------------------------------------------

      const updateData = {
        // Reactivate account
        is_active: 1,
        rstatus: 1,
      };


      // ------------------------------------------------------
      // EMAIL
      //
      // Always update if Firebase has email.
      //
      // This fixes your existing row where email_id is NULL.
      // ------------------------------------------------------

      if (firebaseEmail) {
        updateData.email_id =
          firebaseEmail;
      }


      // ------------------------------------------------------
      // EMAIL VERIFIED
      // ------------------------------------------------------

      if (firebaseEmailVerified) {
        updateData.email_verified = 1;
      }


      // ------------------------------------------------------
      // FIRST NAME
      //
      // Don't overwrite user's manually edited name.
      // ------------------------------------------------------

      if (
        !user.first_name &&
        firebaseFirstName
      ) {
        updateData.first_name =
          firebaseFirstName;
      }


      // ------------------------------------------------------
      // LAST NAME
      // ------------------------------------------------------

      if (
        !user.last_name &&
        firebaseLastName
      ) {
        updateData.last_name =
          firebaseLastName;
      }


      console.log(
        "DATABASE UPDATE:",
        updateData
      );


      // ------------------------------------------------------
      // UPDATE USER
      // ------------------------------------------------------

      user = await prisma.dy_user.update({
        where: {
          id: user.id,
        },

        data: updateData,
      });


      console.log(
        "USER AFTER UPDATE:",
        user
      );
    }


    // ========================================================
    // 14. CHECK PROFILE
    // ========================================================

    const isProfileIncomplete =
      checkProfileIncomplete(user);


    // ========================================================
    // 15. RESPONSE
    // ========================================================

    return res.status(200).json({
      success: true,

      message: isNewUser
        ? "Account created successfully"
        : "Login successful",

      provider,

      isNewUser,

      isProfileIncomplete,

      user,
    });

  } catch (error) {
    console.error(
      "socialLogin error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


// ============================================================
// GET ME
// ============================================================

export const getMe = async (req, res) => {
  try {
    const { uid } = req.firebaseUser;

    if (!uid) {
      return res.status(401).json({
        success: false,
        message: "Firebase UID not found",
      });
    }


    const user = await prisma.dy_user.findFirst({
      where: {
        univ_user_id: uid,
      },
    });


    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }


    const isProfileIncomplete =
      checkProfileIncomplete(user);


    return res.status(200).json({
      success: true,

      isProfileIncomplete,

      user,
    });

  } catch (error) {
    console.error(
      "getMe error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ============================================================
// UPDATE PROFILE
// ============================================================

export const updateProfile = async (req, res) => {
  try {
    const { uid } = req.firebaseUser;

    if (!uid) {
      return res.status(401).json({
        success: false,
        message: "Firebase UID not found",
      });
    }


    const {
      first_name,
      last_name,
      email_id,
      mobile_no,
      gender_id,
    } = req.body;


    // ========================================================
    // FIND USER
    // ========================================================

    const user = await prisma.dy_user.findFirst({
      where: {
        univ_user_id: uid,
      },
    });


    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }


    // ========================================================
    // BUILD UPDATE DATA
    // ========================================================

    const updateData = {};


    // ========================================================
    // FIRST NAME
    // ========================================================

    if (first_name !== undefined) {
      updateData.first_name =
        String(first_name).trim();
    }


    // ========================================================
    // LAST NAME
    // ========================================================

    if (last_name !== undefined) {
      updateData.last_name =
        String(last_name).trim();
    }


    // ========================================================
    // EMAIL
    //
    // Normally email should come from Firebase.
    // But allow profile update if your application requires it.
    // ========================================================

    if (email_id !== undefined) {
      updateData.email_id =
        String(email_id).trim();
    }


    // ========================================================
    // MOBILE
    // ========================================================

    if (mobile_no !== undefined) {
      updateData.mobile_no =
        String(mobile_no).trim();
    }


    // ========================================================
    // GENDER
    //
    // Database column is INT.
    // Frontend may send "1".
    // Convert "1" -> 1.
    // ========================================================

    if (
      gender_id !== undefined &&
      gender_id !== null &&
      gender_id !== ""
    ) {
      const parsedGenderId =
        Number(gender_id);


      if (
        !Number.isInteger(
          parsedGenderId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "gender_id must be an integer",
        });
      }


      updateData.gender_id =
        parsedGenderId;
    }


    // ========================================================
    // UPDATE
    // ========================================================

    const updatedUser =
      await prisma.dy_user.update({
        where: {
          id: user.id,
        },

        data: updateData,
      });


    // ========================================================
    // PROFILE STATUS
    // ========================================================

    const isProfileIncomplete =
      checkProfileIncomplete(
        updatedUser
      );


    return res.status(200).json({
      success: true,

      message:
        "Profile updated successfully",

      isProfileIncomplete,

      user: updatedUser,
    });

  } catch (error) {
    console.error(
      "updateProfile error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ============================================================
// DEACTIVATE ACCOUNT
// ============================================================

export const deactivateAccount = async (req, res) => {
  try {
    const { uid } = req.firebaseUser;


    if (!uid) {
      return res.status(401).json({
        success: false,
        message: "Firebase UID not found",
      });
    }


    const user = await prisma.dy_user.findFirst({
      where: {
        univ_user_id: uid,
      },
    });


    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }


    await prisma.dy_user.update({
      where: {
        id: user.id,
      },

      data: {
        rstatus: 0,
        is_active: 0,
      },
    });


    return res.status(200).json({
      success: true,
      message: "Account deactivated",
    });

  } catch (error) {
    console.error(
      "deactivateAccount error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};