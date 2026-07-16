import { Router } from "express";

import { authRoutes } from "./authRoutes.js";
import { healthRoutes } from "./healthRoutes.js";

export const apiRoutes = Router();

apiRoutes.use("/auth", authRoutes);
apiRoutes.use("/health", healthRoutes);
