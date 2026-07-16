import { getMemberDashboard } from "../services/dashboardService.js";
import {
  getMemberNotifications,
  markMemberNotificationRead
} from "../services/notificationService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const memberDashboard = asyncHandler(async (req, res) => {
  const dashboard = await getMemberDashboard(req.user);

  res.json({
    success: true,
    data: dashboard
  });
});

export const memberNotifications = asyncHandler(async (req, res) => {
  const notifications = await getMemberNotifications(req.user);

  res.json({
    success: true,
    data: {
      notifications
    }
  });
});

export const readMemberNotification = asyncHandler(async (req, res) => {
  const notification = await markMemberNotificationRead(req.user, req.params.id);

  res.json({
    success: true,
    data: {
      notification
    }
  });
});
