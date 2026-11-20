import { Router } from "express";
import rateLimit from "express-rate-limit";

import {
  publicGuestInvitationDetail,
  publicGuestOpen,
  publicGuestRsvp,
  publicGuestWish,
  publicGuestWishUpdate
} from "../controllers/publicGuestController.js";
import { publicHostAddGuest, publicHostDashboard } from "../controllers/publicHostController.js";
import { publicInvitationDetail } from "../controllers/publicInvitationController.js";

export const publicInvitationRoutes = Router();
const hostGuestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, message: "Terlalu banyak tamu ditambahkan. Coba lagi beberapa menit lagi." }
});

publicInvitationRoutes.get("/invitations/:username/:slug", publicInvitationDetail);
publicInvitationRoutes.get("/invitations/:username/:slug/host/:token", publicHostDashboard);
publicInvitationRoutes.post("/invitations/:username/:slug/host/:token/guests", hostGuestLimiter, publicHostAddGuest);
publicInvitationRoutes.get("/invitations/:username/:slug/guest/:token", publicGuestInvitationDetail);
publicInvitationRoutes.post("/invitations/:username/:slug/guest/:token/open", publicGuestOpen);
publicInvitationRoutes.post("/invitations/:username/:slug/guest/:token/rsvp", publicGuestRsvp);
publicInvitationRoutes.post("/invitations/:username/:slug/guest/:token/wishes", publicGuestWish);
publicInvitationRoutes.patch("/invitations/:username/:slug/guest/:token/wishes/:wishId", publicGuestWishUpdate);
