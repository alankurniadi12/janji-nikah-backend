import { Router } from "express";

import { midtransWebhook } from "../controllers/transactionController.js";

export const webhookRoutes = Router();

webhookRoutes.post("/midtrans", midtransWebhook);
