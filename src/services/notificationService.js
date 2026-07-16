import Notification from "../models/Notification.js";
import { AppError } from "../utils/AppError.js";

export function toPublicNotification(notification) {
  return {
    id: notification._id.toString(),
    title: notification.title,
    message: notification.message,
    type: notification.type,
    isRead: notification.isRead,
    readAt: notification.readAt,
    referenceType: notification.referenceType,
    referenceId: notification.referenceId?.toString?.() || null,
    createdAt: notification.createdAt
  };
}

export async function getMemberNotifications(user, { limit = 20 } = {}) {
  const notifications = await Notification.find({
    $or: [{ userId: user._id }, { userId: null, roleTarget: "member" }],
    roleTarget: "member"
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return notifications.map(toPublicNotification);
}

export async function markMemberNotificationRead(user, notificationId) {
  const notification = await Notification.findOne({
    _id: notificationId,
    roleTarget: "member",
    userId: user._id
  });

  if (!notification) {
    throw new AppError(404, "Notifikasi tidak ditemukan.");
  }

  if (!notification.isRead) {
    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();
  }

  return toPublicNotification(notification);
}
