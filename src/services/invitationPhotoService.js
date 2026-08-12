import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { env } from "../config/env.js";
import { ensureDirectory, resolveUploadPath } from "../middlewares/upload.js";
import Invitation from "../models/Invitation.js";
import { AppError } from "../utils/AppError.js";
import { toRelativeUploadUrl, toUploadUrl } from "../utils/fileUrl.js";
import { toPublicInvitation } from "./invitationService.js";

const GALLERY_LIMIT = 10;
const COUPLE_PHOTO_FIELDS = new Map([
  ["groom", "groom"],
  ["bride", "bride"]
]);

export async function replaceMainPhoto(member, invitationId, file) {
  assertUploadedFile(file);

  const invitation = await findEditableInvitation(member, invitationId);
  const directory = resolveUploadPath(
    "members",
    member._id.toString(),
    "invitations",
    invitation._id.toString(),
    "main"
  );
  const { filePath, publicUrl } = await processAndStoreImage(file, directory);
  const oldPhotoUrl = invitation.mainPhotoUrl;

  invitation.mainPhotoUrl = publicUrl;
  await invitation.save();
  await deleteUploadByUrl(oldPhotoUrl);

  return toPublicInvitation(invitation);
}

export async function replaceCouplePhoto(member, invitationId, role, file) {
  assertUploadedFile(file);

  const coupleField = COUPLE_PHOTO_FIELDS.get(role);

  if (!coupleField) {
    throw new AppError(400, "Jenis foto pengantin tidak valid.");
  }

  const invitation = await findEditableInvitation(member, invitationId);
  const directory = resolveUploadPath(
    "members",
    member._id.toString(),
    "invitations",
    invitation._id.toString(),
    "couple",
    coupleField
  );
  const { publicUrl } = await processAndStoreImage(file, directory);
  const oldPhotoUrl = invitation[coupleField]?.photoUrl;

  invitation[coupleField] = {
    ...(invitation[coupleField]?.toObject?.() || invitation[coupleField] || {}),
    photoUrl: publicUrl
  };
  await invitation.save();
  await deleteUploadByUrl(oldPhotoUrl);

  return toPublicInvitation(invitation);
}

export async function addGalleryPhoto(member, invitationId, file) {
  assertUploadedFile(file);

  const invitation = await findEditableInvitation(member, invitationId);

  if (invitation.galleryPhotoUrls.length >= GALLERY_LIMIT) {
    throw new AppError(409, `Maksimal ${GALLERY_LIMIT} foto galeri.`);
  }

  const directory = resolveUploadPath(
    "members",
    member._id.toString(),
    "invitations",
    invitation._id.toString(),
    "gallery"
  );
  const { publicUrl } = await processAndStoreImage(file, directory);

  invitation.galleryPhotoUrls.push(publicUrl);
  await invitation.save();

  return toPublicInvitation(invitation);
}

export async function deleteGalleryPhoto(member, invitationId, photoId) {
  const invitation = await findEditableInvitation(member, invitationId);
  const photoUrl = invitation.galleryPhotoUrls.find((url) => extractPhotoId(url) === photoId);

  if (!photoUrl) {
    throw new AppError(404, "Foto galeri tidak ditemukan.");
  }

  invitation.galleryPhotoUrls = invitation.galleryPhotoUrls.filter((url) => url !== photoUrl);
  await invitation.save();
  await deleteUploadByUrl(photoUrl);

  return toPublicInvitation(invitation);
}

export function extractPhotoId(photoUrl) {
  return path.basename(photoUrl, path.extname(photoUrl));
}

async function findEditableInvitation(member, invitationId) {
  const invitation = await Invitation.findOne({ _id: invitationId, memberId: member._id });

  if (!invitation) {
    throw new AppError(404, "Undangan tidak ditemukan.");
  }

  if (invitation.status === "expired") {
    throw new AppError(409, "Undangan sudah expired dan tidak bisa diedit.");
  }

  if (invitation.status === "locked") {
    throw new AppError(409, "Foto undangan sudah terkunci.");
  }

  if (invitation.publishedAt) {
    const editableUntil = new Date(invitation.publishedAt).getTime() + 24 * 60 * 60 * 1000;

    if (Date.now() > editableUntil) {
      throw new AppError(409, "Foto undangan hanya bisa diedit 24 jam setelah publish.");
    }
  }

  return invitation;
}

async function processAndStoreImage(file, directory) {
  ensureDirectory(directory);

  const fileName = `${crypto.randomUUID()}.webp`;
  const filePath = path.join(directory, fileName);

  await sharp(file.buffer)
    .rotate()
    .resize({
      width: env.imageMaxWidth,
      withoutEnlargement: true
    })
    .webp({ quality: env.imageQuality })
    .toFile(filePath);

  return {
    filePath,
    publicUrl: toUploadUrl(filePath)
  };
}

async function deleteUploadByUrl(publicUrl) {
  const relativeUrl = toRelativeUploadUrl(publicUrl);

  if (!relativeUrl?.startsWith("/uploads/")) {
    return;
  }

  const relativePath = relativeUrl.replace(/^\/uploads\//, "");
  const filePath = path.join(env.uploadDir, relativePath);

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

function assertUploadedFile(file) {
  if (!file) {
    throw new AppError(400, "Foto wajib diunggah.");
  }
}
