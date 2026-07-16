import { Router } from "express";

import {
  memberDashboard,
  memberNotifications,
  readMemberNotification
} from "../controllers/memberController.js";
import {
  memberCreateInvitation,
  memberDeleteInvitation,
  memberInvitationDetail,
  memberInvitations,
  memberPreviewInvitation,
  memberPublishInvitation,
  memberUpdateInvitation
} from "../controllers/invitationController.js";
import {
  memberCreateTransaction,
  memberTransactionDetail,
  memberTransactions,
  memberUploadPaymentProof
} from "../controllers/transactionController.js";
import { authenticate, requireRole } from "../middlewares/authMiddleware.js";
import { createImageUpload, resolveUploadPath } from "../middlewares/upload.js";

export const memberRoutes = Router();
const paymentProofUpload = createImageUpload((req) =>
  resolveUploadPath("transactions", req.user._id.toString(), "proofs")
);

memberRoutes.use(authenticate, requireRole("member"));
memberRoutes.get("/dashboard", memberDashboard);
memberRoutes.get("/invitations", memberInvitations);
memberRoutes.post("/invitations", memberCreateInvitation);
memberRoutes.get("/invitations/:id", memberInvitationDetail);
memberRoutes.patch("/invitations/:id", memberUpdateInvitation);
memberRoutes.delete("/invitations/:id", memberDeleteInvitation);
memberRoutes.post("/invitations/:id/preview", memberPreviewInvitation);
memberRoutes.post("/invitations/:id/publish", memberPublishInvitation);
memberRoutes.get("/notifications", memberNotifications);
memberRoutes.patch("/notifications/:id/read", readMemberNotification);
memberRoutes.post("/transactions", memberCreateTransaction);
memberRoutes.get("/transactions", memberTransactions);
memberRoutes.get("/transactions/:id", memberTransactionDetail);
memberRoutes.post(
  "/transactions/:id/payment-proof",
  paymentProofUpload.single("paymentProof"),
  memberUploadPaymentProof
);
