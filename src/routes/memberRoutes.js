import { Router } from "express";

import {
  memberDashboard,
  memberNotifications,
  readMemberNotification
} from "../controllers/memberController.js";
import { authenticate, requireRole } from "../middlewares/authMiddleware.js";

export const memberRoutes = Router();

memberRoutes.use(authenticate, requireRole("member"));
memberRoutes.get("/dashboard", memberDashboard);
memberRoutes.get("/notifications", memberNotifications);
memberRoutes.patch("/notifications/:id/read", readMemberNotification);
