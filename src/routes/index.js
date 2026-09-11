import { Router } from "express";

import { adminRoutes } from "./adminRoutes.js";
import { authRoutes } from "./authRoutes.js";
import { creditPackageRoutes } from "./creditPackageRoutes.js";
import { musicRoutes, themeRoutes } from "./catalogRoutes.js";
import { healthRoutes } from "./healthRoutes.js";
import { memberRoutes } from "./memberRoutes.js";
import { publicInvitationRoutes } from "./publicInvitationRoutes.js";
import { webhookRoutes } from "./webhookRoutes.js";

export const apiRoutes = Router();

apiRoutes.use("/admin", adminRoutes);
apiRoutes.use("/auth", authRoutes);
apiRoutes.use("/credit-packages", creditPackageRoutes);
apiRoutes.use("/health", healthRoutes);
apiRoutes.use("/member", memberRoutes);
apiRoutes.use("/music", musicRoutes);
apiRoutes.use("/public", publicInvitationRoutes);
apiRoutes.use("/themes", themeRoutes);
apiRoutes.use("/webhooks", webhookRoutes);
