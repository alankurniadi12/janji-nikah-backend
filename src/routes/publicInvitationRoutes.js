import { Router } from "express";

import {
  publicGuestInvitationDetail,
  publicGuestOpen,
  publicGuestRsvp,
  publicGuestWish
} from "../controllers/publicGuestController.js";
import { publicInvitationDetail } from "../controllers/publicInvitationController.js";

export const publicInvitationRoutes = Router();

publicInvitationRoutes.get("/invitations/:username/:slug", publicInvitationDetail);
publicInvitationRoutes.get("/invitations/:username/:slug/guest/:token", publicGuestInvitationDetail);
publicInvitationRoutes.post("/invitations/:username/:slug/guest/:token/open", publicGuestOpen);
publicInvitationRoutes.post("/invitations/:username/:slug/guest/:token/rsvp", publicGuestRsvp);
publicInvitationRoutes.post("/invitations/:username/:slug/guest/:token/wishes", publicGuestWish);
