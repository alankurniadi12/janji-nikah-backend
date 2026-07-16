import AuditLog from "../models/AuditLog.js";
import CreditLedger from "../models/CreditLedger.js";
import Invitation from "../models/Invitation.js";
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

  return toPublicUser(member);
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
