import { Router } from "express";

import {
  memberDashboard,
  memberNotifications,
  readMemberNotification
} from "../controllers/memberController.js";
import {
  memberBrandingProfile,
  memberGenerateBranding,
  memberUpsertBrandingProfile
} from "../controllers/brandingController.js";
import {
  memberBulkCreateGuests,
  memberCreateGuest,
  memberDeleteGuest,
  memberDeleteWish,
  memberGuestWhatsappMessage,
  memberGuests,
  memberHideWish,
  memberMarkGuestSent,
  memberUpdateGuest,
  memberWishes
} from "../controllers/guestController.js";
import {
  memberCreateInvitation,
  memberDeleteInvitation,
  memberDeleteGalleryPhoto,
  memberInvitationDetail,
  memberInvitations,
  memberPreviewInvitation,
  memberPublishInvitation,
  memberUploadGalleryPhoto,
  memberUploadMainPhoto,
  memberUpdateInvitation
} from "../controllers/invitationController.js";
import {
  memberCreateTransaction,
  memberTransactionDetail,
  memberTransactions,
  memberUploadPaymentProof
} from "../controllers/transactionController.js";
import { authenticate, requireRole } from "../middlewares/authMiddleware.js";
import {
  createImageUpload,
  createMemoryImageUpload,
  resolveUploadPath
} from "../middlewares/upload.js";

export const memberRoutes = Router();
const paymentProofUpload = createImageUpload((req) =>
  resolveUploadPath("transactions", req.user._id.toString(), "proofs")
);
const invitationPhotoUpload = createMemoryImageUpload();

memberRoutes.use(authenticate, requireRole("member"));
memberRoutes.get("/branding", memberBrandingProfile);
memberRoutes.put("/branding", memberUpsertBrandingProfile);
memberRoutes.post("/branding/generate", memberGenerateBranding);
memberRoutes.get("/dashboard", memberDashboard);
memberRoutes.get("/invitations", memberInvitations);
memberRoutes.post("/invitations", memberCreateInvitation);
memberRoutes.get("/invitations/:id", memberInvitationDetail);
memberRoutes.patch("/invitations/:id", memberUpdateInvitation);
memberRoutes.delete("/invitations/:id", memberDeleteInvitation);
memberRoutes.post("/invitations/:id/preview", memberPreviewInvitation);
memberRoutes.post("/invitations/:id/publish", memberPublishInvitation);
memberRoutes.get("/invitations/:id/guests", memberGuests);
memberRoutes.post("/invitations/:id/guests", memberCreateGuest);
memberRoutes.post("/invitations/:id/guests/bulk", memberBulkCreateGuests);
memberRoutes.patch("/invitations/:id/guests/:guestId", memberUpdateGuest);
memberRoutes.delete("/invitations/:id/guests/:guestId", memberDeleteGuest);
memberRoutes.post("/invitations/:id/guests/:guestId/mark-sent", memberMarkGuestSent);
memberRoutes.get("/invitations/:id/guests/:guestId/whatsapp-message", memberGuestWhatsappMessage);
memberRoutes.post(
  "/invitations/:id/photos/main",
  invitationPhotoUpload.single("photo"),
  memberUploadMainPhoto
);
memberRoutes.post(
  "/invitations/:id/photos/gallery",
  invitationPhotoUpload.single("photo"),
  memberUploadGalleryPhoto
);
memberRoutes.delete("/invitations/:id/photos/gallery/:photoId", memberDeleteGalleryPhoto);
memberRoutes.get("/invitations/:id/wishes", memberWishes);
memberRoutes.patch("/invitations/:id/wishes/:wishId/hide", memberHideWish);
memberRoutes.delete("/invitations/:id/wishes/:wishId", memberDeleteWish);
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
