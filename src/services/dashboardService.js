import CreditLedger from "../models/CreditLedger.js";
import Invitation from "../models/Invitation.js";
import Notification from "../models/Notification.js";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import { toPublicInvitation } from "./invitationService.js";
import { expirePendingTransactions, toPublicTransaction } from "./transactionService.js";

export async function getMemberDashboard(user) {
  const memberId = user._id;

  await expirePendingTransactions({ memberId });

  const now = new Date();
  const next7DaysEnd = addDays(now, 7);
  const [
    activeInvitations,
    lockedInvitations,
    draftInvitations,
    expiredInvitations,
    publishedInvitations,
    expiringSoonInvitations,
    unreadNotifications,
    latestTransaction,
    pendingTransactions,
    pendingTransactionCount,
    recentInvitations,
    serviceRevenue
  ] = await Promise.all([
    Invitation.countDocuments({ memberId, status: "active" }),
    Invitation.countDocuments({ memberId, status: "locked" }),
    Invitation.countDocuments({ memberId, status: "draft" }),
    Invitation.countDocuments({ memberId, status: "expired" }),
    Invitation.countDocuments({ memberId, publishedAt: { $ne: null } }),
    Invitation.countDocuments({
      memberId,
      status: { $in: ["active", "locked"] },
      expiresAt: { $gte: now, $lte: next7DaysEnd }
    }),
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
    Transaction.countDocuments({ memberId, status: { $in: ["waiting_payment", "waiting_verification"] } }),
    Invitation.find({ memberId })
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(5)
      .select("memberId status slug title servicePrice groom bride events publishedAt lockedAt expiresAt expiredAt summary createdAt updatedAt")
      .lean(),
    getMemberServiceRevenue(memberId)
  ]);
  const liveInvitations = activeInvitations + lockedInvitations;

  return {
    creditBalance: user.creditBalance,
    invitations: {
      active: activeInvitations,
      locked: lockedInvitations,
      live: liveInvitations,
      draft: draftInvitations,
      expired: expiredInvitations,
      total: liveInvitations + draftInvitations + expiredInvitations,
      publishedTotal: publishedInvitations,
      expiringSoon: expiringSoonInvitations
    },
    notifications: {
      unread: unreadNotifications
    },
    revenue: {
      serviceTotal: serviceRevenue.total,
      averageServicePrice: serviceRevenue.average,
      pricedInvitations: serviceRevenue.count
    },
    latestTransaction: latestTransaction ? toPublicTransaction(latestTransaction) : null,
    pendingTransactions: {
      total: pendingTransactionCount,
      items: pendingTransactions.map(toPublicTransaction)
    },
    recentInvitations: recentInvitations.map(toPublicInvitation),
    actions: {
      canCreateInvitation: draftInvitations < 3,
      draftLimit: 3,
      publishableCredits: user.creditBalance
    }
  };
}

export async function getAdminDashboard() {
  await expirePendingTransactions();

  const now = new Date();
  const monthStart = startOfMonth(now);
  const last30DaysStart = addDays(now, -30);
  const next7DaysEnd = addDays(now, 7);

  const [
    totalMembers,
    activeMembers,
    suspendedMembers,
    blockedMembers,
    newMembersThisMonth,
    membersWithCredits,
    membersWithPublishedInvitations,
    waitingVerificationTransactions,
    waitingPaymentTransactions,
    expiredTransactions,
    successfulTransactions,
    monthlyRevenue,
    last30DaysRevenue,
    memberServiceRevenue,
    monthlyMemberServiceRevenue,
    monthlyCreditsSold,
    monthlyCreditsUsed,
    activeInvitations,
    draftInvitations,
    lockedInvitations,
    expiredInvitations,
    publishedThisMonth,
    expiringSoonInvitations,
    unreadNotifications,
    recentPendingTransactions,
    topPackages,
    topThemes
  ] = await Promise.all([
    User.countDocuments({ role: "member" }),
    User.countDocuments({ role: "member", status: "active" }),
    User.countDocuments({ role: "member", status: "suspended" }),
    User.countDocuments({ role: "member", status: "blocked" }),
    User.countDocuments({ role: "member", createdAt: { $gte: monthStart } }),
    User.countDocuments({ role: "member", creditBalance: { $gt: 0 } }),
    Invitation.distinct("memberId", { publishedAt: { $ne: null } }),
    Transaction.countDocuments({ status: "waiting_verification" }),
    Transaction.countDocuments({ status: "waiting_payment" }),
    Transaction.countDocuments({ status: "expired", updatedAt: { $gte: monthStart } }),
    Transaction.countDocuments({ status: "success" }),
    sumSuccessfulRevenue({ approvedAt: { $gte: monthStart } }),
    sumSuccessfulRevenue({ approvedAt: { $gte: last30DaysStart } }),
    sumInvitationServiceRevenue(),
    sumInvitationServiceRevenue({ publishedAt: { $gte: monthStart } }),
    sumCreditsSold({ approvedAt: { $gte: monthStart } }),
    sumCreditsUsed({ createdAt: { $gte: monthStart } }),
    Invitation.countDocuments({ status: { $in: ["active", "locked"] } }),
    Invitation.countDocuments({ status: "draft" }),
    Invitation.countDocuments({ status: "locked" }),
    Invitation.countDocuments({ status: "expired" }),
    Invitation.countDocuments({ publishedAt: { $gte: monthStart } }),
    Invitation.countDocuments({
      status: { $in: ["active", "locked"] },
      expiresAt: { $gte: now, $lte: next7DaysEnd }
    }),
    Notification.countDocuments({ roleTarget: "admin", isRead: false }),
    Transaction.find({ status: { $in: ["waiting_verification", "waiting_payment"] } })
      .sort({ status: -1, expiresAt: 1, createdAt: -1 })
      .limit(5)
      .populate("memberId", "name email username")
      .select("memberId packageId creditAmount baseAmount uniqueCode totalAmount paymentProofUrl status adminNote expiresAt createdAt updatedAt")
      .lean(),
    getTopPackages(monthStart),
    getTopThemes(monthStart)
  ]);
  const monthlyCreditUsageRate = monthlyCreditsSold > 0 ? Math.round((monthlyCreditsUsed / monthlyCreditsSold) * 100) : 0;

  return {
    members: {
      total: totalMembers,
      active: activeMembers,
      suspended: suspendedMembers,
      blocked: blockedMembers,
      newThisMonth: newMembersThisMonth,
      withCredits: membersWithCredits,
      withPublishedInvitations: membersWithPublishedInvitations.length,
      inactiveAfterSignup: Math.max(0, totalMembers - membersWithPublishedInvitations.length)
    },
    transactions: {
      waitingPayment: waitingPaymentTransactions,
      waitingVerification: waitingVerificationTransactions,
      expiredThisMonth: expiredTransactions,
      success: successfulTransactions
    },
    revenue: {
      thisMonth: monthlyRevenue,
      last30Days: last30DaysRevenue,
      memberServiceTotal: memberServiceRevenue.total,
      memberServiceThisMonth: monthlyMemberServiceRevenue.total,
      memberServicePricedInvitations: memberServiceRevenue.count
    },
    credits: {
      soldThisMonth: monthlyCreditsSold,
      usedThisMonth: monthlyCreditsUsed,
      usageRateThisMonth: monthlyCreditUsageRate
    },
    invitations: {
      active: activeInvitations,
      draft: draftInvitations,
      locked: lockedInvitations,
      expired: expiredInvitations,
      publishedThisMonth,
      expiringSoon: expiringSoonInvitations
    },
    notifications: {
      unread: unreadNotifications
    },
    actionItems: {
      total: waitingVerificationTransactions + waitingPaymentTransactions + expiringSoonInvitations + unreadNotifications,
      waitingVerification: waitingVerificationTransactions,
      waitingPayment: waitingPaymentTransactions,
      expiringSoonInvitations,
      unreadNotifications
    },
    recentPendingTransactions: recentPendingTransactions.map(toAdminDashboardTransaction),
    insights: {
      topPackages,
      topThemes
    }
  };
}

async function sumSuccessfulRevenue(dateFilter = {}) {
  const [summary = {}] = await Transaction.aggregate([
    {
      $match: {
        status: "success",
        ...dateFilter
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$totalAmount" }
      }
    }
  ]);

  return summary.total || 0;
}

async function getMemberServiceRevenue(memberId) {
  const [summary = {}] = await Invitation.aggregate([
    {
      $match: {
        memberId,
        publishedAt: { $ne: null },
        servicePrice: { $gt: 0 }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$servicePrice" },
        count: { $sum: 1 },
        average: { $avg: "$servicePrice" }
      }
    }
  ]);

  return {
    total: summary.total || 0,
    count: summary.count || 0,
    average: Math.round(summary.average || 0)
  };
}

async function sumInvitationServiceRevenue(dateFilter = {}) {
  const [summary = {}] = await Invitation.aggregate([
    {
      $match: {
        publishedAt: { $ne: null },
        servicePrice: { $gt: 0 },
        ...dateFilter
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$servicePrice" },
        count: { $sum: 1 }
      }
    }
  ]);

  return {
    total: summary.total || 0,
    count: summary.count || 0
  };
}

async function sumCreditsSold(dateFilter = {}) {
  const [summary = {}] = await Transaction.aggregate([
    {
      $match: {
        status: "success",
        ...dateFilter
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$creditAmount" }
      }
    }
  ]);

  return summary.total || 0;
}

async function sumCreditsUsed(dateFilter = {}) {
  const [summary = {}] = await CreditLedger.aggregate([
    {
      $match: {
        type: "publish",
        ...dateFilter
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$amount" }
      }
    }
  ]);

  return Math.abs(summary.total || 0);
}

async function getTopPackages(monthStart) {
  const rows = await Transaction.aggregate([
    {
      $match: {
        status: "success",
        approvedAt: { $gte: monthStart }
      }
    },
    {
      $group: {
        _id: {
          packageId: "$packageId",
          creditAmount: "$creditAmount"
        },
        transactions: { $sum: 1 },
        revenue: { $sum: "$totalAmount" },
        creditsSold: { $sum: "$creditAmount" }
      }
    },
    { $sort: { transactions: -1, creditsSold: -1 } },
    { $limit: 3 }
  ]);

  return rows.map((row) => ({
    packageId: row._id.packageId?.toString?.() || null,
    name: `${row._id.creditAmount} kredit`,
    creditAmount: row._id.creditAmount,
    transactions: row.transactions,
    revenue: row.revenue,
    creditsSold: row.creditsSold
  }));
}

async function getTopThemes(monthStart) {
  const rows = await Invitation.aggregate([
    {
      $match: {
        publishedAt: { $gte: monthStart }
      }
    },
    {
      $group: {
        _id: "$themeId",
        published: { $sum: 1 }
      }
    },
    { $sort: { published: -1 } },
    { $limit: 3 },
    {
      $lookup: {
        from: "themes",
        localField: "_id",
        foreignField: "_id",
        as: "theme"
      }
    },
    {
      $unwind: {
        path: "$theme",
        preserveNullAndEmptyArrays: true
      }
    }
  ]);

  return rows.map((row) => ({
    themeId: row._id?.toString?.() || null,
    name: row.theme?.name || "Tanpa tema",
    key: row.theme?.key || null,
    published: row.published
  }));
}

function toAdminDashboardTransaction(transaction) {
  const publicTransaction = toPublicTransaction(transaction);
  const member = transaction.memberId && typeof transaction.memberId === "object" ? transaction.memberId : null;

  return {
    ...publicTransaction,
    member: member
      ? {
          id: member._id.toString(),
          name: member.name,
          email: member.email,
          username: member.username
        }
      : null
  };
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}
