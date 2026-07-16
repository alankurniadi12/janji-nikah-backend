import Invitation from "../models/Invitation.js";
import { AppError } from "../utils/AppError.js";
import { createInvitationSlugBase, normalizeSlug } from "../utils/slug.js";

const DRAFT_LIMIT = 3;

export function toPublicInvitation(invitation) {
  return {
    id: invitation._id.toString(),
    memberId: invitation.memberId?.toString?.() || invitation.memberId,
    status: invitation.status,
    slug: invitation.slug,
    title: invitation.title,
    groom: invitation.groom,
    bride: invitation.bride,
    events: invitation.events,
    mainPhotoUrl: invitation.mainPhotoUrl,
    galleryPhotoUrls: invitation.galleryPhotoUrls,
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
    title: payload.title || "",
    groom: normalizeCouple(payload.groom),
    bride: normalizeCouple(payload.bride),
    events: normalizeEvents(payload.events),
    envelope: normalizeEnvelope(payload.envelope)
  });

  return toPublicInvitation(invitation);
}

export async function getMemberInvitation(member, invitationId) {
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

  if (payload.title !== undefined) invitation.title = payload.title;
  if (payload.groom !== undefined) invitation.groom = mergeCouple(invitation.groom, payload.groom);
  if (payload.bride !== undefined) invitation.bride = mergeCouple(invitation.bride, payload.bride);
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
