import { Router } from "express";

import { mayarWebhook } from "../controllers/transactionController.js";

export const webhookRoutes = Router();

webhookRoutes.post("/mayar", mayarWebhook);
