import { Router } from "express";

import { healthRoutes } from "./healthRoutes.js";

export const apiRoutes = Router();

apiRoutes.use("/health", healthRoutes);
