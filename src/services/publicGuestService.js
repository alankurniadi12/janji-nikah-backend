import Guest from "../models/Guest.js";
import Invitation from "../models/Invitation.js";
import RSVP from "../models/RSVP.js";
import Wish from "../models/Wish.js";
import { AppError } from "../utils/AppError.js";
import { sanitizeGuestText } from "../utils/sanitizeText.js";
import { toPublicGuest, toPublicRsvp, toPublicWish } from "./guestService.js";
import { getPublicInvitation } from "./publicInvitationService.js";

const MAX_WISH_MESSAGE_LENGTH = 500;

export async function getPublicGuestInvitation(username, slug, token) {
  const publicInvitation = await getPublicInvitation(username, slug);

  if (!publicInvitation.isActive) {
    return publicInvitation;
  }

  const guest = await findGuest(publicInvitation.invitation.id, token);
  const rsvp = await RSVP.findOne({ guestId: guest._id }).lean();
  const wishes = await Wish.find({
    invitationId: guest.invitationId,
    isHidden: false,
    deletedAt: null
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return {
    ...publicInvitation,
    guest: toPublicGuest(guest),
    rsvp: toPublicRsvp(rsvp),
    wishes: wishes.map(toPublicWish)
  };
}

export async function markPublicGuestOpened(username, slug, token) {
  const publicInvitation = await getPublicGuestInvitation(username, slug, token);

  if (!publicInvitation.isActive) {
    throw new AppError(409, "Undangan sudah tidak aktif.");
  }

  const guest = await Guest.findOne({ token, invitationId: publicInvitation.invitation.id });
  guest.openedAt = guest.openedAt || new Date();
  await guest.save();

  return {
    ...publicInvitation,
    guest: toPublicGuest(guest)
  };
}

export async function submitPublicRsvp(username, slug, token, payload) {
  const publicInvitation = await getPublicGuestInvitation(username, slug, token);

  if (!publicInvitation.isActive) {
    throw new AppError(409, "Undangan sudah tidak aktif.");
  }

  if (!["attending", "not_attending"].includes(payload?.status)) {
    throw new AppError(400, "RSVP hanya menerima attending atau not_attending.");
  }

  const guest = await findGuest(publicInvitation.invitation.id, token);
  const rsvp = await RSVP.findOneAndUpdate(
    { guestId: guest._id },
    {
      $set: {
        invitationId: guest.invitationId,
        guestId: guest._id,
        status: payload.status
      }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return toPublicRsvp(rsvp);
}

export async function submitPublicWish(username, slug, token, payload) {
  const publicInvitation = await getPublicGuestInvitation(username, slug, token);

  if (!publicInvitation.isActive) {
    return publicInvitation;
  }

  const guest = await findGuest(publicInvitation.invitation.id, token);
  const displayName = sanitizeGuestText(payload?.displayName || guest.name, 100);
  const rawMessage = String(payload?.message || "").trim();
  const message = sanitizeGuestText(rawMessage, MAX_WISH_MESSAGE_LENGTH);

  if (!displayName) {
    throw new AppError(400, "Nama ucapan wajib diisi.");
  }

  if (!message) {
    throw new AppError(400, "Ucapan wajib diisi.");
  }

  if (rawMessage.length > MAX_WISH_MESSAGE_LENGTH) {
    throw new AppError(400, `Ucapan maksimal ${MAX_WISH_MESSAGE_LENGTH} karakter.`);
  }

  const wish = await Wish.create({
    invitationId: guest.invitationId,
    guestId: guest._id,
    displayName,
    message
  });

  return toPublicWish(wish);
}

async function findGuest(invitationId, token) {
  const guest = await Guest.findOne({ invitationId, token });

  if (!guest) {
    throw new AppError(404, "Tamu tidak ditemukan.");
  }

  return guest;
}
