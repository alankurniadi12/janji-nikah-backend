import Invitation from "../models/Invitation.js";
import Notification from "../models/Notification.js";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import { expirePendingTransactions } from "./transactionService.js";

export async function getMemberDashboard(user) {
  const memberId = user._id;

  await expirePendingTransactions({ memberId });

  const [
    activeInvitations,
    draftInvitations,
    expiredInvitations,
    unreadNotifications,
    latestTransaction
  ] = await Promise.all([
    Invitation.countDocuments({ memberId, status: { $in: ["active", "locked"] } }),
    Invitation.countDocuments({ memberId, status: "draft" }),
    Invitation.countDocuments({ memberId, status: "expired" }),
    Notification.countDocuments({
      $or: [{ userId: memberId }, { userId: null, roleTarget: "member" }],
      roleTarget: "member",
      isRead: false
    }),
    Transaction.findOne({ memberId })
      .sort({ createdAt: -1 })
      .select("creditAmount totalAmount status createdAt")
      .lean()
  ]);

  return {
    creditBalance: user.creditBalance,
    invitations: {
      active: activeInvitations,
      draft: draftInvitations,
      expired: expiredInvitations
    },
    notifications: {
      unread: unreadNotifications
    },
    latestTransaction: latestTransaction || null,
    actions: {
      canCreateInvitation: draftInvitations < 3,
      draftLimit: 3
    }
  };
}

export async function getAdminDashboard() {
  const [
    activeMembers,
    suspendedMembers,
    blockedMembers,
    waitingVerificationTransactions,
    successfulTransactions,
    activeInvitations,
    draftInvitations,
    expiredInvitations,
    unreadNotifications
  ] = await Promise.all([
    User.countDocuments({ role: "member", status: "active" }),
    User.countDocuments({ role: "member", status: "suspended" }),
    User.countDocuments({ role: "member", status: "blocked" }),
    Transaction.countDocuments({ status: "waiting_verification" }),
    Transaction.countDocuments({ status: "success" }),
    Invitation.countDocuments({ status: { $in: ["active", "locked"] } }),
    Invitation.countDocuments({ status: "draft" }),
    Invitation.countDocuments({ status: "expired" }),
    Notification.countDocuments({ roleTarget: "admin", isRead: false })
  ]);

  return {
    members: {
      active: activeMembers,
      suspended: suspendedMembers,
      blocked: blockedMembers
    },
    transactions: {
      waitingVerification: waitingVerificationTransactions,
      success: successfulTransactions
    },
    invitations: {
      active: activeInvitations,
      draft: draftInvitations,
      expired: expiredInvitations
    },
    notifications: {
      unread: unreadNotifications
    }
  };
}
