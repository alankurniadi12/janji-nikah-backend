import { Router } from "express";

import { publicInvitationDetail } from "../controllers/publicInvitationController.js";

export const publicInvitationRoutes = Router();

publicInvitationRoutes.get("/invitations/:username/:slug", publicInvitationDetail);
