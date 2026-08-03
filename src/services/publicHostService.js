import Guest from "../models/Guest.js";
import Invitation from "../models/Invitation.js";
import RSVP from "../models/RSVP.js";
import User from "../models/User.js";
import Wish from "../models/Wish.js";
import { AppError } from "../utils/AppError.js";
import { toPublicGuest, toPublicRsvp, toPublicWish } from "./guestService.js";
import { lockInvitationIfNeeded, toPublicInvitation } from "./invitationService.js";

export async function getPublicHostDashboard(username, slug, token) {
  const member = await User.findOne({
    $or: [{ username }, { usernameHistory: username }],
    role: "member"
  }).lean();

  if (!member) {
    throw new AppError(404, "Laporan undangan tidak ditemukan.");
  }

  const redirectUsername = member.username !== username ? member.username : null;
  let invitation = await Invitation.findOne({
    memberId: member._id,
    slug
  })
    .select("+hostAccessToken")
    .lean();

  if (!invitation || !invitation.hostAccessToken || invitation.hostAccessToken !== token) {
    throw new AppError(404, "Laporan undangan tidak ditemukan.");
  }

  if (shouldLockInvitation(invitation)) {
    await lockInvitationIfNeeded(invitation._id);
    invitation = {
      ...invitation,
      status: "locked",
      lockedAt: new Date()
    };
  }

  if (!["active", "locked"].includes(invitation.status) || isInvitationExpired(invitation)) {
    return {
      isActive: false,
      reason: "expired",
      redirectUsername,
      invitation: {
        slug: invitation.slug,
        status: "expired",
        expiresAt: invitation.expiresAt,
        summary: invitation.summary
      }
    };
  }

  const [guests, rsvps, wishes] = await Promise.all([
    Guest.find({ invitationId: invitation._id }).sort({ createdAt: -1 }).lean(),
    RSVP.find({ invitationId: invitation._id }).lean(),
    Wish.find({ invitationId: invitation._id, isHidden: false, deletedAt: null })
      .sort({ createdAt: -1 })
      .lean()
  ]);
  const rsvpByGuestId = new Map(rsvps.map((rsvp) => [rsvp.guestId.toString(), rsvp]));
  const guestsWithRsvp = guests.map((guest) => {
    const rsvp = rsvpByGuestId.get(guest._id.toString());
    const publicGuest = toPublicGuest(guest);
    delete publicGuest.token;
    delete publicGuest.link;

    return {
      ...publicGuest,
      rsvp: toPublicRsvp(rsvp),
      rsvpStatus: rsvp?.status || "pending"
    };
  });

  return {
    isActive: true,
    redirectUsername,
    invitation: toPublicInvitation(invitation),
    summary: buildHostSummary(guests, rsvps, wishes),
    guests: guestsWithRsvp,
    wishes: wishes.map(toPublicWish)
  };
}

function buildHostSummary(guests, rsvps, wishes) {
  const attending = rsvps.filter((rsvp) => rsvp.status === "attending").length;
  const notAttending = rsvps.filter((rsvp) => rsvp.status === "not_attending").length;

  return {
    totalGuests: guests.length,
    openedGuests: guests.filter((guest) => Boolean(guest.openedAt)).length,
    attending,
    notAttending,
    pending: Math.max(guests.length - rsvps.length, 0),
    wishes: wishes.length
  };
}

function isInvitationExpired(invitation) {
  return invitation.expiresAt && new Date(invitation.expiresAt).getTime() <= Date.now();
}

function shouldLockInvitation(invitation) {
  return (
    invitation.status === "active" &&
    invitation.publishedAt &&
    new Date(invitation.publishedAt).getTime() <= Date.now() - 24 * 60 * 60 * 1000
  );
}
