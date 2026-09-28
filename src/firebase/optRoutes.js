// import { Router } from "express";
// import { sendOtp, verifyOtp } from "./otpcontroller.js";
// import verifyFirebaseToken from "./auth.js";

// const router = Router();

// // 🔓 Public (before login)
// router.post("/send-otp", sendOtp);
// router.post("/verify-otp", verifyOtp);

// // 🔒 Optional (after login → save mobile)
// router.post("/link-mobile", verifyFirebaseToken, async (req, res) => {
//   try {
//     const { uid } = req.firebaseUser;
//     const { phone } = req.body;

//     const user = await prisma.usersdata.findFirst({
//       where: { unique_id: uid },
//     });

//     if (!user) {
//       return res.status(404).json({ success: false });
//     }

//     const updated = await prisma.usersdata.update({
//       where: { id: user.id },
//       data: { mobile_no: phone },
//     });

//     return res.json({
//       success: true,
//       message: "Mobile linked successfully",
//       user: updated,
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ success: false });
//   }
// });

// export default router;



import { Router } from "express";

import {
  sendOtp,
  verifyOtp,
} from "./otpcontroller.js";

import verifyFirebaseToken from "./auth.js";

const router = Router();

// ============================================================
// SEND OTP
// ============================================================

router.post(
  "/send-otp",
  verifyFirebaseToken,
  sendOtp
);

// ============================================================
// VERIFY OTP
// ============================================================

router.post(
  "/verify-otp",
  verifyFirebaseToken,
  verifyOtp
);

export default router;