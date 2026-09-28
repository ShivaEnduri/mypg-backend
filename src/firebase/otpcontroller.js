// import axios from "axios";

// const otpStore = {}; // ⚠️ Use Redis/DB in production

// // 🔹 SEND OTP
// export const sendOtp = async (req, res) => {
//   try {
//     const { phone } = req.body;

//     if (!phone) {
//       return res.status(400).json({
//         success: false,
//         message: "Phone number is required",
//       });
//     }

//     const otp = Math.floor(100000 + Math.random() * 900000);

//     await axios.post(
//       "https://www.fast2sms.com/dev/bulkV2",
//       {
//         route: "q", // Quick route (no DLT)
//         message: `Your OTP for Rufrent is ${otp}`,
//         language: "english",
//         flash: 0,
//         numbers: phone,
//       },
//       {
//         headers: {
//           authorization: process.env.FAST2SMS_API_KEY,
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     otpStore[phone] = {
//       otp,
//       expiresAt: Date.now() + 5 * 60 * 1000, // 5 mins
//     };

//     return res.json({
//       success: true,
//       message: "OTP sent successfully",
//     });
//   } catch (error) {
//     console.error("sendOtp error:", error.response?.data || error.message);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to send OTP",
//     });
//   }
// };

// // 🔹 VERIFY OTP
// export const verifyOtp = async (req, res) => {
//   try {
//     const { phone, otp } = req.body;

//     const record = otpStore[phone];

//     if (!record) {
//       return res.status(400).json({
//         success: false,
//         message: "OTP not found",
//       });
//     }

//     if (Date.now() > record.expiresAt) {
//       delete otpStore[phone];
//       return res.status(400).json({
//         success: false,
//         message: "OTP expired",
//       });
//     }

//     if (record.otp != otp) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid OTP",
//       });
//     }

//     delete otpStore[phone];

//     return res.json({
//       success: true,
//       message: "OTP verified successfully",
//     });
//   } catch (error) {
//     console.error("verifyOtp error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "OTP verification failed",
//     });
//   }
// };



import axios from "axios";
import { getPrismaClient } from "../prisma.js";

// ============================================================
// PRISMA
// ============================================================

const prisma = getPrismaClient("pg");

// ============================================================
// TEMP OTP STORE
//
// Development only.
// For production use Redis / database.
// ============================================================

const otpStore = new Map();

// ============================================================
// OTP CONFIG
// ============================================================

const OTP_EXPIRATION = 5 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

// ============================================================
// NORMALIZE PHONE
// ============================================================

const normalizePhone = (phone) => {
  return String(phone || "")
    .trim()
    .replace(/\s+/g, "");
};

// ============================================================
// PROFILE COMPLETENESS
// ============================================================

const checkProfileIncomplete = (user) => {
  if (!user) {
    return true;
  }

  return (
    !user.first_name ||
    !user.last_name ||
    !user.email_id ||
    !user.mobile_no ||
    Number(user.mobile_verified) !== 1 ||
    user.gender_id === null ||
    user.gender_id === undefined
  );
};

// ============================================================
// SEND OTP
// ============================================================

export const sendOtp = async (req, res) => {
  try {
    const { uid } = req.firebaseUser;
    const { phone } = req.body;

    // ========================================================
    // VALIDATE FIREBASE USER
    // ========================================================

    if (!uid) {
      return res.status(401).json({
        success: false,
        message: "Firebase user not found",
      });
    }

    // ========================================================
    // VALIDATE PHONE
    // ========================================================

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    const normalizedPhone = normalizePhone(phone);

    // ========================================================
    // INDIAN MOBILE VALIDATION
    // ========================================================

    if (!/^[6-9]\d{9}$/.test(normalizedPhone)) {
      return res.status(400).json({
        success: false,
        message:
          "Enter a valid 10 digit mobile number",
      });
    }

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
    // OPTIONAL:
    // If same number is already verified
    // ========================================================

    if (
      user.mobile_no === normalizedPhone &&
      Number(user.mobile_verified) === 1
    ) {
      return res.status(200).json({
        success: true,
        alreadyVerified: true,
        mobile_verified: 1,
        message:
          "Mobile number is already verified",
      });
    }

    // ========================================================
    // GENERATE OTP
    // ========================================================

    const otp = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    // ========================================================
    // SEND OTP THROUGH FAST2SMS
    // ========================================================

    await axios.post(
      "https://www.fast2sms.com/dev/bulkV2",
      {
        route: "q",

        message:
          `Your OTP for Rufrent is ${otp}`,

        language: "english",

        flash: 0,

        numbers: normalizedPhone,
      },
      {
        headers: {
          authorization:
            process.env.FAST2SMS_API_KEY,

          "Content-Type":
            "application/json",
        },
      }
    );

    // ========================================================
    // SAVE OTP
    // ========================================================

    otpStore.set(uid, {
      phone: normalizedPhone,

      otp,

      expiresAt:
        Date.now() + OTP_EXPIRATION,

      attempts: 0,
    });

    // ========================================================
    // RESPONSE
    // ========================================================

    return res.status(200).json({
      success: true,

      message:
        "OTP sent successfully",

      expiresIn: 300,
    });

  } catch (error) {
    console.error(
      "sendOtp error:",
      error.response?.data ||
        error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to send OTP",
    });
  }
};

// ============================================================
// VERIFY OTP
// ============================================================

export const verifyOtp = async (req, res) => {
  try {
    const { uid } = req.firebaseUser;
    const { otp } = req.body;

    // ========================================================
    // VALIDATE USER
    // ========================================================

    if (!uid) {
      return res.status(401).json({
        success: false,
        message:
          "Firebase user not found",
      });
    }

    // ========================================================
    // VALIDATE OTP
    // ========================================================

    if (
      otp === undefined ||
      otp === null ||
      String(otp).trim() === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "OTP is required",
      });
    }

    // ========================================================
    // GET STORED OTP
    // ========================================================

    const record = otpStore.get(uid);

    if (!record) {
      return res.status(400).json({
        success: false,
        message:
          "OTP not found or already used",
      });
    }

    // ========================================================
    // CHECK EXPIRATION
    // ========================================================

    if (Date.now() > record.expiresAt) {
      otpStore.delete(uid);

      return res.status(400).json({
        success: false,
        message: "OTP expired",
      });
    }

    // ========================================================
    // CHECK ATTEMPTS
    // ========================================================

    record.attempts += 1;

    if (
      record.attempts > MAX_OTP_ATTEMPTS
    ) {
      otpStore.delete(uid);

      return res.status(400).json({
        success: false,
        message:
          "Too many invalid OTP attempts. Please request a new OTP.",
      });
    }

    // ========================================================
    // VERIFY OTP
    // ========================================================

    if (
      String(record.otp) !==
      String(otp).trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
        attemptsRemaining:
          MAX_OTP_ATTEMPTS -
          record.attempts,
      });
    }

    // ========================================================
    // FIND USER
    // ========================================================

    const user =
      await prisma.dy_user.findFirst({
        where: {
          univ_user_id: uid,
        },
      });

    if (!user) {
      otpStore.delete(uid);

      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // ========================================================
    // UPDATE MOBILE
    //
    // OTP SUCCESS = MOBILE VERIFIED
    // ========================================================

    const updatedUser =
      await prisma.dy_user.update({
        where: {
          id: user.id,
        },

        data: {
          mobile_no:
            record.phone,

          mobile_verified: 1,

          is_active: 1,

          rstatus: 1,
        },
      });

    // ========================================================
    // DELETE OTP
    //
    // OTP CAN ONLY BE USED ONCE
    // ========================================================

    otpStore.delete(uid);

    // ========================================================
    // CHECK PROFILE
    // ========================================================

    const isProfileIncomplete =
      checkProfileIncomplete(
        updatedUser
      );

    // ========================================================
    // RESPONSE
    // ========================================================

    return res.status(200).json({
      success: true,

      message:
        "OTP verified successfully",

      mobile_no:
        updatedUser.mobile_no,

      mobile_verified: 1,

      email_id:
        updatedUser.email_id,

      email_verified:
        Number(
          updatedUser.email_verified
        ) === 1,

      isProfileIncomplete,

      user: updatedUser,
    });

  } catch (error) {
    console.error(
      "verifyOtp error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "OTP verification failed",
      error: error.message,
    });
  }
};