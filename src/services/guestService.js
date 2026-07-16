import crypto from "node:crypto";

import Guest from "../models/Guest.js";
import Invitation from "../models/Invitation.js";
import RSVP from "../models/RSVP.js";
import Wish from "../models/Wish.js";
import { AppError } from "../utils/AppError.js";
import { sanitizeGuestText } from "../utils/sanitizeText.js";

export function toPublicGuest(guest, invitation = null, member = null) {
  return {
    id: guest._id.toString(),
    invitationId: guest.invitationId?.toString?.() || guest.invitationId,
    name: guest.name,
    token: guest.token,
    sentStatus: guest.sentStatus,
    sentAt: guest.sentAt,
    openedAt: guest.openedAt,
    link: invitation && member ? `/${member.username}/${invitation.slug}/guest/${guest.token}` : null,
    createdAt: guest.createdAt,
    updatedAt: guest.updatedAt
  };
}

export function toPublicRsvp(rsvp) {
  if (!rsvp) return null;

  return {
    id: rsvp._id.toString(),
    invitationId: rsvp.invitationId?.toString?.() || rsvp.invitationId,
    guestId: rsvp.guestId?.toString?.() || rsvp.guestId,
    status: rsvp.status,
    createdAt: rsvp.createdAt,
    updatedAt: rsvp.updatedAt
  };
}

export function toPublicWish(wish) {
  return {
    id: wish._id.toString(),
    invitationId: wish.invitationId?.toString?.() || wish.invitationId,
    guestId: wish.guestId?.toString?.() || wish.guestId,
    displayName: wish.displayName,
    message: wish.message,
    isHidden: wish.isHidden,
    hiddenAt: wish.hiddenAt,
    createdAt: wish.createdAt
  };
}

export async function listInvitationGuests(member, invitationId) {
  const invitation = await findMemberInvitation(member, invitationId);
  const guests = await Guest.find({ invitationId: invitation._id }).sort({ createdAt: -1 }).lean();
  return guests.map((guest) => toPublicGuest(guest, invitation, member));
}

export async function createInvitationGuest(member, invitationId, payload) {
  const invitation = await findMemberInvitation(member, invitationId);
  const name = sanitizeGuestText(payload?.name, 100);

  if (!name) {
    throw new AppError(400, "Nama tamu wajib diisi.");
  }

  const guest = await Guest.create({
    invitationId: invitation._id,
    name,
    token: await createUniqueGuestToken()
  });

  return toPublicGuest(guest, invitation, member);
}

export async function bulkCreateInvitationGuests(member, invitationId, payload) {
  const invitation = await findMemberInvitation(member, invitationId);
  const names = parseBulkGuestNames(payload?.names);

  if (names.length === 0) {
    throw new AppError(400, "Daftar nama tamu wajib diisi.");
  }

  const guests = [];

  for (const name of names) {
    const guest = await Guest.create({
      invitationId: invitation._id,
      name,
      token: await createUniqueGuestToken()
    });
    guests.push(toPublicGuest(guest, invitation, member));
  }

  return guests;
}

export async function updateInvitationGuest(member, invitationId, guestId, payload) {
  const invitation = await findMemberInvitation(member, invitationId);
  const guest = await Guest.findOne({ _id: guestId, invitationId });

  if (!guest) {
    throw new AppError(404, "Tamu tidak ditemukan.");
  }

  const name = sanitizeGuestText(payload?.name, 100);

  if (!name) {
    throw new AppError(400, "Nama tamu wajib diisi.");
  }

  guest.name = name;
  await guest.save();

  return toPublicGuest(guest, invitation, member);
}

export async function deleteInvitationGuest(member, invitationId, guestId) {
  await findMemberInvitation(member, invitationId);
  const guest = await Guest.findOne({ _id: guestId, invitationId });

  if (!guest) {
    throw new AppError(404, "Tamu tidak ditemukan.");
  }

  await Promise.all([
    RSVP.deleteOne({ guestId: guest._id }),
    Wish.updateMany({ guestId: guest._id }, { $set: { deletedAt: new Date() } }),
    guest.deleteOne()
  ]);
}

export async function markGuestSent(member, invitationId, guestId) {
  const invitation = await findMemberInvitation(member, invitationId);
  const guest = await Guest.findOne({ _id: guestId, invitationId });

  if (!guest) {
    throw new AppError(404, "Tamu tidak ditemukan.");
  }

  guest.sentStatus = "sent";
  guest.sentAt = new Date();
  await guest.save();

  return toPublicGuest(guest, invitation, member);
}

export async function getGuestWhatsappMessage(member, invitationId, guestId) {
  const invitation = await findMemberInvitation(member, invitationId);
  const guest = await Guest.findOne({ _id: guestId, invitationId }).lean();

  if (!guest) {
    throw new AppError(404, "Tamu tidak ditemukan.");
  }

  const link = `/${member.username}/${invitation.slug}/guest/${guest.token}`;
  return {
    guest: toPublicGuest(guest, invitation, member),
    message: `Assalamu'alaikum ${guest.name},\n\nKami mengundang Anda untuk hadir di acara pernikahan ${invitation.groom.fullName} & ${invitation.bride.fullName}.\n\nBuka undangan:\n${link}`
  };
}

export async function listMemberWishes(member, invitationId) {
  await findMemberInvitation(member, invitationId);
  const wishes = await Wish.find({ invitationId, deletedAt: null }).sort({ createdAt: -1 }).lean();
  return wishes.map(toPublicWish);
}

export async function hideMemberWish(member, invitationId, wishId) {
  await findMemberInvitation(member, invitationId);
  const wish = await Wish.findOne({ _id: wishId, invitationId, deletedAt: null });

  if (!wish) {
    throw new AppError(404, "Ucapan tidak ditemukan.");
  }

  wish.isHidden = true;
  wish.hiddenAt = new Date();
  await wish.save();

  return toPublicWish(wish);
}

export async function deleteMemberWish(member, invitationId, wishId) {
  await findMemberInvitation(member, invitationId);
  const wish = await Wish.findOne({ _id: wishId, invitationId, deletedAt: null });

  if (!wish) {
    throw new AppError(404, "Ucapan tidak ditemukan.");
  }

  wish.deletedAt = new Date();
  await wish.save();
}

async function findMemberInvitation(member, invitationId) {
  const invitation = await Invitation.findOne({ _id: invitationId, memberId: member._id });

  if (!invitation) {
    throw new AppError(404, "Undangan tidak ditemukan.");
  }

  return invitation;
}

async function createUniqueGuestToken() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = crypto.randomBytes(16).toString("hex");

    if (!(await Guest.exists({ token }))) {
      return token;
    }
  }

  throw new AppError(500, "Gagal membuat token tamu.");
}

function parseBulkGuestNames(names) {
  const rawNames = Array.isArray(names) ? names : String(names || "").split(/\r?\n/);
  return [...new Set(rawNames.map((name) => sanitizeGuestText(name, 100)).filter(Boolean))];
}
