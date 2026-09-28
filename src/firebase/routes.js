

import { Router } from "express";
import {
  socialLogin,
  getMe,
  updateProfile,
  deactivateAccount,
} from "./controller.js";
import verifyFirebaseToken from "./auth.js";

const router = Router();

// ── Public ────────────────────────────────────────────────────────────────────
// The client calls this immediately after signing in with any social provider.
// Body: { idToken: "<Firebase ID token>" }
router.post("/social-login", socialLogin);

// ── Protected (valid Firebase ID token required) ─────────────────────────────
router.get("/me", verifyFirebaseToken, getMe);
router.patch("/profile", verifyFirebaseToken, updateProfile);
router.delete("/account", verifyFirebaseToken, deactivateAccount);

export default router;
