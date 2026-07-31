import AuditLog from "../models/AuditLog.js";
import CreditLedger from "../models/CreditLedger.js";
import Invitation from "../models/Invitation.js";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { toPublicInvitation } from "./invitationService.js";
import { toPublicUser } from "../utils/publicUser.js";

export async function listMembers({ status, q } = {}) {
  const query = { role: "member" };

  if (status) query.status = status;
  if (q) {
    query.$or = [
      { name: new RegExp(q, "i") },
      { email: new RegExp(q, "i") },
      { username: new RegExp(q, "i") }
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

export async function listAdminInvitations({ status } = {}) {
  const query = status ? { status } : {};
  const invitations = await Invitation.find(query).sort({ createdAt: -1 }).limit(100).lean();
  return invitations.map(toPublicInvitation);
}

export async function getAdminInvitation(invitationId) {
  const invitation = await Invitation.findById(invitationId).lean();

  if (!invitation) {
    throw new AppError(404, "Undangan tidak ditemukan.");
  }

  return toPublicInvitation(invitation);
}

export async function unlockInvitation(admin, invitationId, note = "") {
  const invitation = await Invitation.findById(invitationId);

  if (!invitation) {
    throw new AppError(404, "Undangan tidak ditemukan.");
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
    note
  });

  return toPublicInvitation(invitation);
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
