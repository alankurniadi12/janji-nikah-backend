import Invitation from "../models/Invitation.js";
import CreditLedger from "../models/CreditLedger.js";
import User from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { toAbsoluteUploadUrl } from "../utils/fileUrl.js";
import { createInvitationSlugBase, normalizeSlug } from "../utils/slug.js";

const DRAFT_LIMIT = 3;
const PUBLISH_CREDIT_COST = 1;
const INVITATION_EXPIRE_AFTER_EVENT_DAYS = 5;

export function toPublicInvitation(invitation) {
  return {
    id: invitation._id.toString(),
    memberId: invitation.memberId?.toString?.() || invitation.memberId,
    status: invitation.status,
    slug: invitation.slug,
    title: invitation.title || createInvitationTitle(invitation.groom?.fullName, invitation.bride?.fullName),
    groom: invitation.groom,
    bride: invitation.bride,
    events: invitation.events,
    mainPhotoUrl: toAbsoluteUploadUrl(invitation.mainPhotoUrl),
    galleryPhotoUrls: (invitation.galleryPhotoUrls || []).map(toAbsoluteUploadUrl),
    themeId: invitation.themeId?.toString?.() || null,
    musicId: invitation.musicId?.toString?.() || null,
    envelope: invitation.envelope,
    publishedAt: invitation.publishedAt,
    lockedAt: invitation.lockedAt,
    expiresAt: invitation.expiresAt,
    expiredAt: invitation.expiredAt,
    summary: invitation.summary,
    createdAt: invitation.createdAt,
    updatedAt: invitation.updatedAt
  };
}

export async function listMemberInvitations(member) {
  const invitations = await Invitation.find({ memberId: member._id }).sort({ updatedAt: -1 }).lean();
  return invitations.map(toPublicInvitation);
}

export async function createDraftInvitation(member, payload = {}) {
  const draftCount = await Invitation.countDocuments({ memberId: member._id, status: "draft" });

  if (draftCount >= DRAFT_LIMIT) {
    throw new AppError(409, "Maksimal 3 draft undangan. Hapus atau publish salah satu draft dulu.");
  }

  const groomName = payload.groom?.fullName || "";
  const brideName = payload.bride?.fullName || "";
  const slugBase = createInvitationSlugBase(groomName, brideName);
  const slug = await createAvailableInvitationSlug(member._id, payload.slug || slugBase);

  const invitation = await Invitation.create({
    memberId: member._id,
    status: "draft",
    slug,
    title: createInvitationTitle(groomName, brideName),
    groom: normalizeCouple(payload.groom),
    bride: normalizeCouple(payload.bride),
    events: normalizeEvents(payload.events),
    envelope: normalizeEnvelope(payload.envelope)
  });

  return toPublicInvitation(invitation);
}

export async function getMemberInvitation(member, invitationId) {
  await lockInvitationIfNeeded(invitationId, member._id);
  const invitation = await Invitation.findOne({ _id: invitationId, memberId: member._id }).lean();

  if (!invitation) {
    throw new AppError(404, "Undangan tidak ditemukan.");
  }

  return toPublicInvitation(invitation);
}

export async function updateMemberInvitation(member, invitationId, payload) {
  const invitation = await Invitation.findOne({ _id: invitationId, memberId: member._id });

  if (!invitation) {
    throw new AppError(404, "Undangan tidak ditemukan.");
  }

  assertMainDataEditable(invitation);

  if (payload.groom !== undefined) invitation.groom = mergeCouple(invitation.groom, payload.groom);
  if (payload.bride !== undefined) invitation.bride = mergeCouple(invitation.bride, payload.bride);
  if (payload.title !== undefined || payload.groom !== undefined || payload.bride !== undefined) {
    invitation.title = createInvitationTitle(invitation.groom.fullName, invitation.bride.fullName);
  }
  if (payload.events !== undefined) invitation.events = normalizeEvents(payload.events);
  if (payload.themeId !== undefined) invitation.themeId = payload.themeId || null;
  if (payload.musicId !== undefined) invitation.musicId = payload.musicId || null;
  if (payload.envelope !== undefined) {
    invitation.envelope = normalizeEnvelope({
      ...invitation.envelope?.toObject?.(),
      ...payload.envelope
    });
  }

  if (payload.slug !== undefined) {
    invitation.slug = await createAvailableInvitationSlug(member._id, payload.slug, invitation._id);
  } else if (invitation.status === "draft" && shouldRefreshDraftSlug(payload)) {
    const slugBase = createInvitationSlugBase(invitation.groom.fullName, invitation.bride.fullName);
    invitation.slug = await createAvailableInvitationSlug(member._id, slugBase, invitation._id);
  }

  await invitation.save();

  return toPublicInvitation(invitation);
}

export async function deleteDraftInvitation(member, invitationId) {
  const invitation = await Invitation.findOne({ _id: invitationId, memberId: member._id });

  if (!invitation) {
    throw new AppError(404, "Undangan tidak ditemukan.");
  }

  if (invitation.status !== "draft") {
    throw new AppError(409, "Hanya draft undangan yang bisa dihapus.");
  }

  await invitation.deleteOne();
}

export async function previewMemberInvitation(member, invitationId) {
  const invitation = await Invitation.findOne({ _id: invitationId, memberId: member._id }).lean();

  if (!invitation) {
    throw new AppError(404, "Undangan tidak ditemukan.");
  }

  return {
    invitation: toPublicInvitation(invitation),
    previewUrl: `/${member.username}/${invitation.slug}?preview=true`
  };
}

export async function publishMemberInvitation(member, invitationId) {
  const invitation = await Invitation.findOne({ _id: invitationId, memberId: member._id });

  if (!invitation) {
    throw new AppError(404, "Undangan tidak ditemukan.");
  }

  if (invitation.status !== "draft") {
    throw new AppError(409, "Hanya draft undangan yang bisa dipublish.");
  }

  validateInvitationReadyToPublish(invitation);

  const creditedMember = await User.findOneAndUpdate(
    { _id: member._id, creditBalance: { $gte: PUBLISH_CREDIT_COST } },
    { $inc: { creditBalance: -PUBLISH_CREDIT_COST } },
    { new: true }
  );

  if (!creditedMember) {
    throw new AppError(402, "Kredit tidak cukup untuk publish undangan.");
  }

  const latestEventDate = getLatestEventDate(invitation.events);
  const publishedAt = new Date();
  invitation.status = "active";
  invitation.publishedAt = publishedAt;
  invitation.expiresAt = addDays(latestEventDate, INVITATION_EXPIRE_AFTER_EVENT_DAYS);
  invitation.summary = {
    groomName: invitation.groom.fullName,
    brideName: invitation.bride.fullName,
    latestEventDate,
    themeName: "",
    publishedAt
  };

  try {
    await invitation.save();
    await CreditLedger.create({
      memberId: member._id,
      type: "publish",
      amount: -PUBLISH_CREDIT_COST,
      balanceAfter: creditedMember.creditBalance,
      referenceType: "invitation",
      referenceId: invitation._id,
      note: "Publish undangan.",
      createdBy: member._id
    });
  } catch (error) {
    await User.updateOne({ _id: member._id }, { $inc: { creditBalance: PUBLISH_CREDIT_COST } });
    await Invitation.updateOne(
      { _id: invitation._id },
      {
        $set: {
          status: "draft",
          publishedAt: null,
          expiresAt: null,
          summary: {}
        }
      }
    );
    throw error;
  }

  return toPublicInvitation(invitation);
}

export async function lockInvitationIfNeeded(invitationId, memberId = null) {
  if (!invitationId) {
    return;
  }

  const query = {
    _id: invitationId,
    status: "active",
    publishedAt: { $lte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
  };

  if (memberId) {
    query.memberId = memberId;
  }

  await Invitation.updateOne(query, {
    $set: {
      status: "locked",
      lockedAt: new Date()
    }
  });
}

export async function createAvailableInvitationSlug(memberId, requestedSlug, excludedInvitationId = null) {
  const base = normalizeSlug(requestedSlug) || "undangan";

  for (let suffix = 0; suffix < 100; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`;
    const query = { memberId, slug: candidate };

    if (excludedInvitationId) {
      query._id = { $ne: excludedInvitationId };
    }

    if (!(await Invitation.exists(query))) {
      return candidate;
    }
  }

  throw new AppError(500, "Gagal membuat slug undangan.");
}

function assertMainDataEditable(invitation) {
  if (invitation.status === "expired") {
    throw new AppError(409, "Undangan sudah expired dan tidak bisa diedit.");
  }

  if (invitation.status === "locked") {
    throw new AppError(409, "Data utama undangan sudah terkunci.");
  }

  if (invitation.publishedAt) {
    const editableUntil = new Date(invitation.publishedAt).getTime() + 24 * 60 * 60 * 1000;

    if (Date.now() > editableUntil) {
      throw new AppError(409, "Data utama undangan hanya bisa diedit 24 jam setelah publish.");
    }
  }
}

function shouldRefreshDraftSlug(payload) {
  return payload.groom?.fullName !== undefined || payload.bride?.fullName !== undefined;
}

function createInvitationTitle(groomName, brideName) {
  const groom = groomName?.trim();
  const bride = brideName?.trim();

  if (groom && bride) {
    return `${groom} & ${bride}`;
  }

  return groom || bride || "Draft undangan";
}

function normalizeCouple(couple = {}) {
  return {
    fullName: couple.fullName || "",
    parentsName: couple.parentsName || ""
  };
}

function mergeCouple(current = {}, next = {}) {
  return {
    fullName: next.fullName !== undefined ? next.fullName : current.fullName || "",
    parentsName: next.parentsName !== undefined ? next.parentsName : current.parentsName || ""
  };
}

function normalizeEvents(events = []) {
  if (!Array.isArray(events)) {
    throw new AppError(400, "Data acara harus berupa array.");
  }

  return events.map((event) => ({
    type: event.type,
    date: event.date,
    startTime: event.startTime,
    endTime: event.endTime || "",
    address: event.address,
    googleMapsUrl: event.googleMapsUrl || ""
  }));
}

function normalizeEnvelope(envelope = {}) {
  const methods = Array.isArray(envelope.methods) ? envelope.methods : [];

  if (envelope.isEnabled && methods.length === 0) {
    throw new AppError(400, "Minimal isi satu metode amplop digital jika fitur diaktifkan.");
  }

  return {
    isEnabled: Boolean(envelope.isEnabled),
    methods: methods.map((method) => ({
      type: method.type,
      providerName: method.providerName,
      accountNumber: method.accountNumber,
      accountHolder: method.accountHolder
    }))
  };
}

function validateInvitationReadyToPublish(invitation) {
  const missingFields = [];

  if (!invitation.groom?.fullName) missingFields.push("nama lengkap pengantin pria");
  if (!invitation.groom?.parentsName) missingFields.push("nama orang tua pengantin pria");
  if (!invitation.bride?.fullName) missingFields.push("nama lengkap pengantin wanita");
  if (!invitation.bride?.parentsName) missingFields.push("nama orang tua pengantin wanita");
  if (!invitation.mainPhotoUrl) missingFields.push("foto utama");

  if (!Array.isArray(invitation.events) || invitation.events.length === 0) {
    missingFields.push("minimal satu acara");
  } else {
    invitation.events.forEach((event, index) => {
      if (!event.type) missingFields.push(`jenis acara ${index + 1}`);
      if (!event.date) missingFields.push(`tanggal acara ${index + 1}`);
      if (!event.startTime) missingFields.push(`jam mulai acara ${index + 1}`);
      if (!event.address) missingFields.push(`alamat acara ${index + 1}`);
    });
  }

  if (missingFields.length > 0) {
    throw new AppError(400, `Lengkapi data sebelum publish: ${missingFields.join(", ")}.`);
  }
}

function getLatestEventDate(events) {
  return events
    .map((event) => new Date(event.date))
    .sort((left, right) => right.getTime() - left.getTime())[0];
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
