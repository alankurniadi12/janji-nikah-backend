import Invitation from "../models/Invitation.js";
import User from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { lockInvitationIfNeeded, toPublicInvitation } from "./invitationService.js";

export async function getPublicInvitation(username, slug, options = {}) {
  const user = await User.findOne({
    $or: [{ username }, { usernameHistory: username }],
    role: "member"
  }).lean();

  if (!user) {
    throw new AppError(404, "Undangan tidak ditemukan.");
  }

  const redirectUsername = user.username !== username ? user.username : null;

  let invitation = await Invitation.findOne({ memberId: user._id, slug }).lean();

  if (!invitation) {
    throw new AppError(404, "Undangan tidak ditemukan.");
  }

  if (shouldLockInvitation(invitation)) {
    await lockInvitationIfNeeded(invitation._id);
    invitation = {
      ...invitation,
      status: "locked",
      lockedAt: new Date()
    };
  }

  if (invitation.status === "expired" || isInvitationExpired(invitation)) {
    return {
      isActive: false,
      reason: "expired",
      redirectUsername,
      invitation: {
        slug: invitation.slug,
        status: "expired",
        summary: invitation.summary
      }
    };
  }

  if (options.preview) {
    return {
      isActive: false,
      isPreview: true,
      redirectUsername,
      invitation: toPublicInvitation(invitation)
    };
  }

  if (!["active", "locked"].includes(invitation.status)) {
    throw new AppError(404, "Undangan tidak ditemukan.");
  }

  return {
    isActive: true,
    redirectUsername,
    invitation: toPublicInvitation(invitation)
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
