import { Router } from "express";

import {
  adminAdjustMemberCredits,
  adminAuditLogs,
  adminDashboard,
  adminInvitationDetail,
  adminInvitations,
  adminMemberDetail,
  adminMembers,
  adminCreditReport,
  adminRevenueReport,
  adminThemeUsageReport,
  adminUnlockInvitation,
  adminUpdateMemberStatus
} from "../controllers/adminController.js";
import {
  adminCreateMusic,
  adminCreateTheme,
  adminMusic,
  adminSetMusicStatus,
  adminSetThemeStatus,
  adminThemes,
  adminUpdateMusic,
  adminUpdateTheme
} from "../controllers/catalogController.js";
import {
  adminCreateCreditPackage,
  adminCreditPackages,
  adminDeleteCreditPackage,
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
adminRoutes.get("/members", adminMembers);
adminRoutes.get("/members/:id", adminMemberDetail);
adminRoutes.patch("/members/:id/status", adminUpdateMemberStatus);
adminRoutes.post("/members/:id/credits/adjust", adminAdjustMemberCredits);
adminRoutes.get("/credit-packages", adminCreditPackages);
adminRoutes.post("/credit-packages", adminCreateCreditPackage);
adminRoutes.patch("/credit-packages/:id", adminUpdateCreditPackage);
adminRoutes.patch("/credit-packages/:id/status", adminSetCreditPackageStatus);
adminRoutes.post("/credit-packages/:id/delete", adminDeleteCreditPackage);
adminRoutes.delete("/credit-packages/:id", adminDeleteCreditPackage);
adminRoutes.get("/transactions", adminTransactions);
adminRoutes.get("/transactions/:id", adminTransactionDetail);
adminRoutes.post("/transactions/:id/approve", adminApproveTransaction);
adminRoutes.post("/transactions/:id/reject", adminRejectTransaction);
adminRoutes.get("/themes", adminThemes);
adminRoutes.post("/themes", adminCreateTheme);
adminRoutes.patch("/themes/:id", adminUpdateTheme);
adminRoutes.patch("/themes/:id/status", adminSetThemeStatus);
adminRoutes.get("/music", adminMusic);
adminRoutes.post("/music", adminCreateMusic);
adminRoutes.patch("/music/:id", adminUpdateMusic);
adminRoutes.patch("/music/:id/status", adminSetMusicStatus);
adminRoutes.get("/invitations", adminInvitations);
adminRoutes.get("/invitations/:id", adminInvitationDetail);
adminRoutes.post("/invitations/:id/unlock", adminUnlockInvitation);
adminRoutes.get("/reports/revenue", adminRevenueReport);
adminRoutes.get("/reports/credits", adminCreditReport);
adminRoutes.get("/reports/themes", adminThemeUsageReport);
adminRoutes.get("/audit-logs", adminAuditLogs);
