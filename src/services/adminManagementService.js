import AuditLog from "../models/AuditLog.js";
import CreditLedger from "../models/CreditLedger.js";
import Guest from "../models/Guest.js";
import Invitation from "../models/Invitation.js";
import Music from "../models/Music.js";
import RSVP from "../models/RSVP.js";
import Theme from "../models/Theme.js";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import Wish from "../models/Wish.js";
import { AppError } from "../utils/AppError.js";
import { toPublicInvitation } from "./invitationService.js";
import { toPublicUser } from "../utils/publicUser.js";

export async function listMembers({ status, q } = {}) {
  const query = { role: "member" };
  const searchRegex = buildSearchRegex(q);

  if (status) query.status = status;
  if (searchRegex) {
    query.$or = [
      { name: searchRegex },
      { email: searchRegex },
      { username: searchRegex }
    ];
  }

  const members = await User.find(query).sort({ createdAt: -1 }).limit(100).lean();
  return members.map(toPublicUser);
}

export async function getMemberDetail(memberId) {
  const member = await User.findOne({ _id: memberId, role: "member" }).lean();

  if (!member) {
    throw new AppError(404, "Member tidak ditemukan.");
  }

  const activity = await getMemberActivity(member._id);

  return {
    ...toPublicUser(member),
    activity
  };
}

export async function updateMemberStatus(admin, memberId, status) {
  if (!["active", "suspended", "blocked"].includes(status)) {
    throw new AppError(400, "Status member tidak valid.");
  }

  const member = await User.findOne({ _id: memberId, role: "member" });

  if (!member) {
    throw new AppError(404, "Member tidak ditemukan.");
  }

  const before = member.toObject();
  member.status = status;
  await member.save();

  await AuditLog.create({
    actorId: admin._id,
    action: "member.status_updated",
    targetType: "User",
    targetId: member._id,
    before,
    after: member.toObject(),
    note: `Status member diubah menjadi ${status}.`
  });

  return toPublicUser(member);
}

export async function adjustMemberCredits(admin, memberId, payload) {
  const amount = Number(payload?.amount);
  const reason = String(payload?.reason || "").trim();

  if (!Number.isInteger(amount) || amount === 0) {
    throw new AppError(400, "Jumlah adjustment kredit wajib berupa integer selain 0.");
  }

  if (!reason) {
    throw new AppError(400, "Alasan adjustment kredit wajib diisi.");
  }

  const member = await User.findOne({ _id: memberId, role: "member" });

  if (!member) {
    throw new AppError(404, "Member tidak ditemukan.");
  }

  if (member.creditBalance + amount < 0) {
    throw new AppError(409, "Saldo kredit tidak boleh negatif.");
  }

  const before = member.toObject();
  member.creditBalance += amount;
  await member.save();

  const ledger = await CreditLedger.create({
    memberId: member._id,
    type: "manual_adjustment",
    amount,
    balanceAfter: member.creditBalance,
    referenceType: "admin_action",
    referenceId: member._id,
    note: reason,
    createdBy: admin._id
  });

  await AuditLog.create({
    actorId: admin._id,
    action: "member.credit_adjusted",
    targetType: "User",
    targetId: member._id,
    before,
    after: member.toObject(),
    note: reason
  });

  return {
    member: toPublicUser(member),
    ledger: {
      id: ledger._id.toString(),
      amount: ledger.amount,
      balanceAfter: ledger.balanceAfter,
      note: ledger.note
    }
  };
}

export async function listAdminInvitations({ status, memberStatus, q } = {}) {
  const query = {};
  const searchRegex = buildSearchRegex(q);

  if (status) query.status = status;

  if (memberStatus) {
    const statusMembers = await User.find({ role: "member", status: memberStatus }).select("_id").lean();
    const statusMemberIds = statusMembers.map((member) => member._id);

    if (!statusMemberIds.length) {
      return {
        invitations: [],
        summary: await getInvitationSummary()
      };
    }

    query.memberId = { $in: statusMemberIds };
  }

  if (searchRegex) {
    const memberQuery = {
      role: "member",
      ...(memberStatus ? { status: memberStatus } : {}),
      $or: [
        { name: searchRegex },
        { email: searchRegex },
        { username: searchRegex }
      ]
    };
    const matchedMembers = await User.find(memberQuery).select("_id").lean();
    const memberIds = matchedMembers.map((member) => member._id);

    query.$or = [
      { title: searchRegex },
      { slug: searchRegex },
      { "groom.fullName": searchRegex },
      { "bride.fullName": searchRegex }
    ];

    if (memberIds.length) {
      query.$or.push({ memberId: { $in: memberIds } });
    }
  }

  const [invitations, summary] = await Promise.all([
    Invitation.find(query).sort({ createdAt: -1 }).limit(100).lean(),
    getInvitationSummary()
  ]);
  const memberIds = [...new Set(invitations.map((invitation) => invitation.memberId?.toString()).filter(Boolean))];
  const members = await User.find({ _id: { $in: memberIds } })
    .select("name email username status creditBalance")
    .lean();
  const memberMap = new Map(members.map((member) => [member._id.toString(), toMemberSummary(member)]));

  return {
    invitations: invitations.map((invitation) => ({
      ...toPublicInvitation(invitation),
      member: memberMap.get(invitation.memberId?.toString()) || null
    })),
    summary
  };
}

async function getInvitationSummary() {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const next7DaysEnd = addDays(now, 7);

  const [
    total,
    draft,
    active,
    locked,
    expired,
    publishedTotal,
    publishedThisMonth,
    expiringSoon
  ] = await Promise.all([
    Invitation.countDocuments(),
    Invitation.countDocuments({ status: "draft" }),
    Invitation.countDocuments({ status: "active" }),
    Invitation.countDocuments({ status: "locked" }),
    Invitation.countDocuments({ status: "expired" }),
    Invitation.countDocuments({ publishedAt: { $ne: null } }),
    Invitation.countDocuments({ publishedAt: { $gte: monthStart } }),
    Invitation.countDocuments({
      status: { $in: ["active", "locked"] },
      expiresAt: { $gte: now, $lte: next7DaysEnd }
    })
  ]);

  return {
    total,
    draft,
    active,
    locked,
    live: active + locked,
    inactive: expired,
    expired,
    publishedTotal,
    publishedThisMonth,
    expiringSoon
  };
}

function buildSearchRegex(value) {
  const trimmedValue = String(value || "").trim();

  if (!trimmedValue) {
    return null;
  }

  return new RegExp(escapeRegExp(trimmedValue.slice(0, 80)), "i");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function getAdminInvitation(invitationId) {
  const invitation = await Invitation.findById(invitationId).lean();

  if (!invitation) {
    throw new AppError(404, "Undangan tidak ditemukan.");
  }

  return toAdminInvitationDetail(invitation);
}

export async function unlockInvitation(admin, invitationId, note = "") {
  const trimmedNote = String(note || "").trim();

  if (!trimmedNote) {
    throw new AppError(400, "Catatan unlock undangan wajib diisi.");
  }

  const invitation = await Invitation.findById(invitationId);

  if (!invitation) {
    throw new AppError(404, "Undangan tidak ditemukan.");
  }

  if (invitation.status !== "locked") {
    throw new AppError(409, "Hanya undangan terkunci yang bisa di-unlock.");
  }

  const before = invitation.toObject();
  invitation.status = "active";
  invitation.lockedAt = null;
  await invitation.save();

  await AuditLog.create({
    actorId: admin._id,
    action: "invitation.unlocked",
    targetType: "Invitation",
    targetId: invitation._id,
    before,
    after: invitation.toObject(),
    note: trimmedNote
  });

  return toAdminInvitationDetail(invitation.toObject());
}

export async function listAuditLogs() {
  const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(100).lean();
  return logs.map((log) => ({
    id: log._id.toString(),
    actorId: log.actorId?.toString?.() || null,
    action: log.action,
    targetType: log.targetType,
    targetId: log.targetId?.toString?.() || null,
    before: log.before,
    after: log.after,
    note: log.note,
    createdAt: log.createdAt
  }));
}

async function getMemberActivity(memberId) {
  const [transactions, invitations, creditLedgers] = await Promise.all([
    Transaction.find({ memberId })
      .sort({ updatedAt: -1 })
      .limit(8)
      .select("creditAmount totalAmount uniqueCode status adminNote approvedAt rejectedAt expiresAt createdAt updatedAt")
      .lean(),
    Invitation.find({ memberId })
      .sort({ updatedAt: -1 })
      .limit(8)
      .select("status slug title groom bride publishedAt lockedAt expiresAt expiredAt createdAt updatedAt")
      .lean(),
    CreditLedger.find({ memberId })
      .sort({ createdAt: -1 })
      .limit(8)
      .select("type amount balanceAfter referenceType referenceId note createdAt")
      .lean()
  ]);
  const items = [
    ...transactions.map(toTransactionActivity),
    ...invitations.map(toInvitationActivity),
    ...creditLedgers.map(toCreditLedgerActivity)
  ].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

  return {
    items: items.slice(0, 15),
    summary: {
      transactions: transactions.length,
      invitations: invitations.length,
      creditEvents: creditLedgers.length
    }
  };
}

async function toAdminInvitationDetail(invitation) {
  const [member, theme, music, stats, recentGuests, recentWishes, creditLedgers] = await Promise.all([
    User.findById(invitation.memberId).select("name email username status creditBalance createdAt").lean(),
    invitation.themeId ? Theme.findById(invitation.themeId).lean() : null,
    invitation.musicId ? Music.findById(invitation.musicId).lean() : null,
    getInvitationStats(invitation._id),
    Guest.find({ invitationId: invitation._id }).sort({ updatedAt: -1 }).limit(8).lean(),
    Wish.find({ invitationId: invitation._id }).sort({ updatedAt: -1 }).limit(8).lean(),
    CreditLedger.find({ referenceType: "invitation", referenceId: invitation._id })
      .sort({ createdAt: -1 })
      .limit(8)
      .lean()
  ]);
  const publicInvitation = toPublicInvitation(invitation);

  return {
    ...publicInvitation,
    member: member ? toMemberSummary(member) : null,
    theme: theme ? toThemeSummary(theme) : null,
    music: music ? toMusicSummary(music) : null,
    statistics: stats,
    recentGuests: recentGuests.map(toGuestSummary),
    recentWishes: recentWishes.map(toWishSummary),
    creditLedgers: creditLedgers.map(toCreditLedgerSummary),
    links: {
      publicPath: member?.username && publicInvitation.slug ? `/${member.username}/${publicInvitation.slug}` : "",
      previewPath: member?.username && publicInvitation.slug ? `/${member.username}/${publicInvitation.slug}?preview=true` : ""
    },
    permissions: {
      canUnlock: publicInvitation.status === "locked"
    }
  };
}

async function getInvitationStats(invitationId) {
  const [guestCount, sentGuestCount, openedGuestCount, attendingCount, notAttendingCount, wishCount, hiddenWishCount, deletedWishCount] =
    await Promise.all([
      Guest.countDocuments({ invitationId }),
      Guest.countDocuments({ invitationId, sentStatus: "sent" }),
      Guest.countDocuments({ invitationId, openedAt: { $exists: true, $ne: null } }),
      RSVP.countDocuments({ invitationId, status: "attending" }),
      RSVP.countDocuments({ invitationId, status: "not_attending" }),
      Wish.countDocuments({ invitationId, deletedAt: null }),
      Wish.countDocuments({ invitationId, isHidden: true, deletedAt: null }),
      Wish.countDocuments({ invitationId, deletedAt: { $exists: true, $ne: null } })
    ]);

  return {
    guests: {
      total: guestCount,
      sent: sentGuestCount,
      opened: openedGuestCount
    },
    rsvp: {
      attending: attendingCount,
      notAttending: notAttendingCount,
      total: attendingCount + notAttendingCount
    },
    wishes: {
      total: wishCount,
      visible: Math.max(0, wishCount - hiddenWishCount),
      hidden: hiddenWishCount,
      deleted: deletedWishCount
    }
  };
}

function toMemberSummary(member) {
  return {
    id: member._id.toString(),
    name: member.name,
    email: member.email,
    username: member.username,
    status: member.status,
    creditBalance: member.creditBalance,
    createdAt: member.createdAt
  };
}

function toThemeSummary(theme) {
  return {
    id: theme._id.toString(),
    name: theme.name,
    key: theme.key,
    thumbnailUrl: theme.thumbnailUrl,
    isActive: theme.isActive,
    isPublicDemo: theme.isPublicDemo
  };
}

function toMusicSummary(music) {
  return {
    id: music._id.toString(),
    title: music.title,
    artist: music.artist || "",
    category: music.category,
    duration: music.duration,
    isActive: music.isActive
  };
}

function toGuestSummary(guest) {
  return {
    id: guest._id.toString(),
    name: guest.name,
    sentStatus: guest.sentStatus,
    sentAt: guest.sentAt,
    openedAt: guest.openedAt,
    createdAt: guest.createdAt,
    updatedAt: guest.updatedAt
  };
}

function toWishSummary(wish) {
  return {
    id: wish._id.toString(),
    displayName: wish.displayName,
    message: wish.message,
    rsvpStatus: wish.rsvpStatus,
    isHidden: wish.isHidden,
    hiddenAt: wish.hiddenAt,
    deletedAt: wish.deletedAt,
    createdAt: wish.createdAt,
    updatedAt: wish.updatedAt
  };
}

function toCreditLedgerSummary(ledger) {
  return {
    id: ledger._id.toString(),
    type: ledger.type,
    amount: ledger.amount,
    balanceAfter: ledger.balanceAfter,
    note: ledger.note,
    createdAt: ledger.createdAt
  };
}

function toTransactionActivity(transaction) {
  return {
    id: `transaction-${transaction._id.toString()}`,
    type: "transaction",
    title: transactionTitle(transaction.status),
    description: `${transaction.creditAmount} kredit · total bayar ${transaction.totalAmount} · kode unik ${transaction.uniqueCode}`,
    status: transaction.status,
    amount: transaction.totalAmount,
    creditAmount: transaction.creditAmount,
    note: transaction.adminNote || "",
    referenceId: transaction._id.toString(),
    createdAt: transaction.updatedAt || transaction.createdAt
  };
}

function toInvitationActivity(invitation) {
  return {
    id: `invitation-${invitation._id.toString()}`,
    type: "invitation",
    title: invitationTitle(invitation.status),
    description: `${invitation.title || createInvitationLabel(invitation)} · /${invitation.slug}`,
    status: invitation.status,
    referenceId: invitation._id.toString(),
    createdAt: invitation.updatedAt || invitation.createdAt
  };
}

function toCreditLedgerActivity(ledger) {
  return {
    id: `credit-${ledger._id.toString()}`,
    type: "credit",
    title: creditLedgerTitle(ledger.type),
    description: `${ledger.amount > 0 ? "+" : ""}${ledger.amount} kredit · saldo akhir ${ledger.balanceAfter}`,
    status: ledger.type,
    amount: ledger.amount,
    balanceAfter: ledger.balanceAfter,
    note: ledger.note || "",
    referenceType: ledger.referenceType,
    referenceId: ledger.referenceId?.toString?.() || null,
    createdAt: ledger.createdAt
  };
}

function transactionTitle(status) {
  const titles = {
    waiting_payment: "Transaksi dibuat",
    waiting_verification: "Bukti pembayaran diunggah",
    success: "Pembayaran diapprove",
    rejected: "Pembayaran ditolak",
    expired: "Transaksi expired"
  };

  return titles[status] || "Aktivitas transaksi";
}

function invitationTitle(status) {
  const titles = {
    draft: "Draft undangan dibuat/diperbarui",
    active: "Undangan aktif",
    locked: "Undangan terkunci",
    expired: "Undangan expired"
  };

  return titles[status] || "Aktivitas undangan";
}

function creditLedgerTitle(type) {
  const titles = {
    purchase: "Kredit pembelian masuk",
    publish: "Kredit dipakai publish",
    manual_adjustment: "Adjustment kredit manual"
  };

  return titles[type] || "Aktivitas kredit";
}

function createInvitationLabel(invitation) {
  const groomName = invitation.groom?.fullName || invitation.summary?.groomName || "";
  const brideName = invitation.bride?.fullName || invitation.summary?.brideName || "";
  const names = [groomName, brideName].filter(Boolean).join(" & ");

  return names || "Undangan";
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}
