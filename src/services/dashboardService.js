import Invitation from "../models/Invitation.js";
import Notification from "../models/Notification.js";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import { expirePendingTransactions, toPublicTransaction } from "./transactionService.js";

export async function getMemberDashboard(user) {
  const memberId = user._id;

  await expirePendingTransactions({ memberId });

  const [
    activeInvitations,
    draftInvitations,
    expiredInvitations,
    unreadNotifications,
    latestTransaction,
    pendingTransactions,
    pendingTransactionCount
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
      .select("memberId packageId creditAmount baseAmount uniqueCode totalAmount paymentProofUrl status adminNote expiresAt createdAt updatedAt")
      .lean(),
    Transaction.find({ memberId, status: { $in: ["waiting_payment", "waiting_verification"] } })
      .sort({ status: 1, expiresAt: 1, createdAt: -1 })
      .limit(3)
      .select("memberId packageId creditAmount baseAmount uniqueCode totalAmount paymentProofUrl status adminNote expiresAt createdAt updatedAt")
      .lean(),
    Transaction.countDocuments({ memberId, status: { $in: ["waiting_payment", "waiting_verification"] } })
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
    latestTransaction: latestTransaction ? toPublicTransaction(latestTransaction) : null,
    pendingTransactions: {
      total: pendingTransactionCount,
      items: pendingTransactions.map(toPublicTransaction)
    },
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
