import { Router } from "express";

import { adminDashboard } from "../controllers/adminController.js";
import { authenticate, requireRole } from "../middlewares/authMiddleware.js";

export const adminRoutes = Router();

adminRoutes.use(authenticate, requireRole("admin"));
adminRoutes.get("/dashboard", adminDashboard);
