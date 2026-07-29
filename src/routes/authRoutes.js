import { Router } from "express";

import {
  getMe,
  googleLogin,
  logout,
  onboardMember,
  refreshSession,
  updateSettings
} from "../controllers/authController.js";
import { authenticate } from "../middlewares/authMiddleware.js";

export const authRoutes = Router();

authRoutes.post("/google", googleLogin);
authRoutes.get("/me", authenticate, getMe);
authRoutes.post("/refresh", refreshSession);
authRoutes.post("/logout", logout);
authRoutes.post("/onboarding", authenticate, onboardMember);
authRoutes.patch("/settings", authenticate, updateSettings);
