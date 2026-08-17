import Invitation from "../models/Invitation.js";
import BrandingProfile from "../models/BrandingProfile.js";
import Theme from "../models/Theme.js";
import User from "../models/User.js";
import Wish from "../models/Wish.js";
import { AppError } from "../utils/AppError.js";
import { toPublicWish } from "./guestService.js";
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
      invitation: await toPublicInvitationWithTheme(invitation, user),
      wishes: []
    };
  }

  if (!["active", "locked"].includes(invitation.status)) {
    throw new AppError(404, "Undangan tidak ditemukan.");
  }

  return {
    isActive: true,
    redirectUsername,
    invitation: await toPublicInvitationWithTheme(invitation, user),
    wishes: await listVisiblePublicWishes(invitation._id)
  };
}

async function toPublicInvitationWithTheme(invitation, member) {
  const [theme, brandingProfile] = await Promise.all([
    invitation.themeId ? Theme.findById(invitation.themeId).lean() : null,
    BrandingProfile.findOne({ memberId: member._id }).select("businessName").lean()
  ]);

  return {
    ...toPublicInvitation(invitation),
    creator: {
      displayName: brandingProfile?.businessName || member.name,
      memberName: member.name,
      businessName: brandingProfile?.businessName || "",
      username: member.username
    },
    theme: theme
      ? {
          id: theme._id.toString(),
          name: theme.name,
          key: theme.key,
          thumbnailUrl: theme.thumbnailUrl,
          isActive: theme.isActive,
          isPublicDemo: theme.isPublicDemo
        }
      : null
  };
}

async function listVisiblePublicWishes(invitationId) {
  const wishes = await Wish.find({
    invitationId,
    isHidden: false,
    deletedAt: null
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return wishes.map(toPublicWish);
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
