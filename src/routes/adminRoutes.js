import { Router } from "express";

import { adminDashboard } from "../controllers/adminController.js";
import {
  adminCreateCreditPackage,
  adminCreditPackages,
  adminSetCreditPackageStatus,
  adminUpdateCreditPackage
} from "../controllers/creditPackageController.js";
import {
  adminApproveTransaction,
  adminRejectTransaction,
  adminTransactionDetail,
  adminTransactions
} from "../controllers/transactionController.js";
import { authenticate, requireRole } from "../middlewares/authMiddleware.js";

export const adminRoutes = Router();

adminRoutes.use(authenticate, requireRole("admin"));
adminRoutes.get("/dashboard", adminDashboard);
adminRoutes.get("/credit-packages", adminCreditPackages);
adminRoutes.post("/credit-packages", adminCreateCreditPackage);
adminRoutes.patch("/credit-packages/:id", adminUpdateCreditPackage);
adminRoutes.patch("/credit-packages/:id/status", adminSetCreditPackageStatus);
adminRoutes.get("/transactions", adminTransactions);
adminRoutes.get("/transactions/:id", adminTransactionDetail);
adminRoutes.post("/transactions/:id/approve", adminApproveTransaction);
adminRoutes.post("/transactions/:id/reject", adminRejectTransaction);
