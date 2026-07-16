import { Router } from "express";

import { publicCreditPackages } from "../controllers/creditPackageController.js";

export const creditPackageRoutes = Router();

creditPackageRoutes.get("/", publicCreditPackages);
