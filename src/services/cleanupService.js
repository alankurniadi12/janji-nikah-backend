import fs from "node:fs/promises";
import path from "node:path";

import Guest from "../models/Guest.js";
import Invitation from "../models/Invitation.js";
import RSVP from "../models/RSVP.js";
import Wish from "../models/Wish.js";
import { env } from "../config/env.js";

const DEFAULT_CLEANUP_LIMIT = 50;

export function buildExpiredInvitationSummary(invitation) {
  const latestEventDate = getLatestEventDate(invitation.events);

  return {
    groomName: invitation.summary?.groomName || invitation.groom?.fullName || "",
    brideName: invitation.summary?.brideName || invitation.bride?.fullName || "",
    latestEventDate: invitation.summary?.latestEventDate || latestEventDate || null,
    themeName: invitation.summary?.themeName || "",
    publishedAt: invitation.summary?.publishedAt || invitation.publishedAt || null
  };
}

export async function cleanupExpiredInvitations({ now = new Date(), limit = DEFAULT_CLEANUP_LIMIT } = {}) {
  const invitations = await Invitation.find({
    status: { $in: ["active", "locked"] },
    expiresAt: { $lte: now }
  })
    .sort({ expiresAt: 1 })
    .limit(limit);

  const results = [];

  for (const invitation of invitations) {
    results.push(await cleanupExpiredInvitation(invitation, now));
  }

  return {
    processed: results.length,
    invitations: results
  };
}

async function cleanupExpiredInvitation(invitation, now) {
  const invitationId = invitation._id;
  const photoUrls = [invitation.mainPhotoUrl, ...(invitation.galleryPhotoUrls || [])].filter(Boolean);
  const summary = buildExpiredInvitationSummary(invitation);
  const [deletedGuests, deletedRsvps, deletedWishes] = await Promise.all([
    Guest.deleteMany({ invitationId }),
    RSVP.deleteMany({ invitationId }),
    Wish.deleteMany({ invitationId })
  ]);

  invitation.status = "expired";
  invitation.title = "";
  invitation.groom = { fullName: "", parentsName: "" };
  invitation.bride = { fullName: "", parentsName: "" };
  invitation.events = [];
  invitation.mainPhotoUrl = "";
  invitation.galleryPhotoUrls = [];
  invitation.musicId = null;
  invitation.envelope = {
    isEnabled: false,
    methods: [],
    updatedAfterLockAt: null
  };
  invitation.expiredAt = now;
  invitation.summary = summary;
  await invitation.save();
  await Promise.all(photoUrls.map(deleteUploadByUrl));

  return {
    id: invitationId.toString(),
    deletedGuests: deletedGuests.deletedCount || 0,
    deletedRsvps: deletedRsvps.deletedCount || 0,
    deletedWishes: deletedWishes.deletedCount || 0,
    deletedPhotos: photoUrls.length
  };
}

function getLatestEventDate(events = []) {
  return events.reduce((latest, event) => {
    if (!event?.date) return latest;
    const eventDate = new Date(event.date);

    if (Number.isNaN(eventDate.getTime())) {
      return latest;
    }

    return !latest || eventDate > latest ? eventDate : latest;
  }, null);
}

async function deleteUploadByUrl(publicUrl) {
  if (!publicUrl?.startsWith("/uploads/")) {
    return;
  }

  const relativePath = publicUrl.replace(/^\/uploads\//, "");
  const filePath = path.join(env.uploadDir, relativePath);

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}
