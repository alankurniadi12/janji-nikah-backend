import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { env } from "../config/env.js";
import BrandingProfile from "../models/BrandingProfile.js";
import { ensureDirectory, resolveUploadPath } from "../middlewares/upload.js";
import { AppError } from "../utils/AppError.js";
import { toRelativeUploadUrl, toUploadUrl } from "../utils/fileUrl.js";

const TEMPLATE_STYLES = {
  elegant: {
    background: "#F7F1EA",
    panel: "#FFFFFF",
    primary: "#7A3E4D",
    accent: "#C79A64",
    text: "#2F2527",
    muted: "#75676A"
  },
  modern: {
    background: "#EEF4F2",
    panel: "#FFFFFF",
    primary: "#1D5B55",
    accent: "#D69B45",
    text: "#1F2A29",
    muted: "#65716F"
  },
  minimal: {
    background: "#F4F4F0",
    panel: "#FFFFFF",
    primary: "#343434",
    accent: "#8F6A42",
    text: "#242424",
    muted: "#696969"
  }
};

const CAPTION_MODES = {
  soft: {
    label: "Soft selling",
    defaultOffer: "Bantu calon pengantin punya undangan digital yang rapi, cantik, dan mudah dibagikan.",
    defaultCta: "Konsultasi dulu boleh. Ceritakan konsep acaramu, nanti kami bantu siapkan undangannya."
  },
  direct: {
    label: "Hard selling",
    defaultOffer: "Butuh undangan digital pernikahan yang siap dibagikan tanpa ribet?",
    defaultCta: "Hubungi kami sekarang untuk mulai buat undangan digital pernikahanmu."
  },
  whatsapp: {
    label: "WhatsApp broadcast",
    defaultOffer: "Halo, kami bantu pembuatan undangan digital pernikahan dengan tampilan elegan dan link siap dibagikan.",
    defaultCta: "Balas pesan ini untuk tanya paket dan cek contoh undangan."
  }
};

export function normalizeBrandingName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function toPublicBrandingProfile(profile, warnings = []) {
  if (!profile) {
    return null;
  }

  return {
    id: profile._id.toString(),
    memberId: profile.memberId?.toString?.() || profile.memberId,
    businessName: profile.businessName,
    instagram: profile.instagram,
    facebook: profile.facebook,
    tiktok: profile.tiktok,
    whatsapp: profile.whatsapp,
    selectedTemplate: profile.selectedTemplate,
    promoPhotoUrl: profile.promoPhotoUrl || "",
    promoAssets: toPublicPromoAssets(profile.promoAssets),
    warnings,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt
  };
}

export async function getBrandingProfile(member) {
  const profile = await BrandingProfile.findOne({ memberId: member._id }).lean();
  const warnings = profile ? await getBusinessNameWarnings(member, profile.businessName) : [];

  return toPublicBrandingProfile(profile, warnings);
}

export async function upsertBrandingProfile(member, payload = {}) {
  const normalizedPayload = normalizeBrandingPayload(payload);
  const warnings = await getBusinessNameWarnings(member, normalizedPayload.businessName);

  const profile = await BrandingProfile.findOneAndUpdate(
    { memberId: member._id },
    {
      $set: {
        ...normalizedPayload,
        normalizedBusinessName: normalizeBrandingName(normalizedPayload.businessName)
      },
      $setOnInsert: {
        memberId: member._id
      }
    },
    { new: true, upsert: true, runValidators: true }
  ).lean();

  return toPublicBrandingProfile(profile, warnings);
}

export async function replaceBrandingPromoPhoto(member, file) {
  assertUploadedFile(file);

  const profile = await BrandingProfile.findOne({ memberId: member._id });

  if (!profile) {
    throw new AppError(404, "Profil branding belum dibuat.");
  }

  const directory = resolveUploadPath("members", member._id.toString(), "branding", "photos");
  const { publicUrl } = await processAndStorePromoPhoto(file, directory);
  const oldPhotoUrl = profile.promoPhotoUrl;

  profile.promoPhotoUrl = publicUrl;
  await profile.save();
  await deleteUploadByUrl(oldPhotoUrl);

  return toPublicBrandingProfile(profile);
}

export async function generateBrandingAssets(member, payload = {}) {
  const profile = await BrandingProfile.findOne({ memberId: member._id });

  if (!profile) {
    throw new AppError(404, "Profil branding belum dibuat.");
  }

  const caption = generatePromoCaption(profile, payload);
  const directory = resolveUploadPath("members", member._id.toString(), "branding");
  const square = await generatePromoImage(profile, payload, directory, "square");
  const story = await generatePromoImage(profile, payload, directory, "story");
  const oldSquareImageUrl = profile.promoAssets?.squareImageUrl;
  const oldStoryImageUrl = profile.promoAssets?.storyImageUrl;

  profile.promoAssets = {
    squareImageUrl: square.publicUrl,
    storyImageUrl: story.publicUrl,
    caption,
    generatedAt: new Date()
  };
  await profile.save();
  await deleteUploadByUrl(oldSquareImageUrl);
  await deleteUploadByUrl(oldStoryImageUrl);

  return {
    profile: toPublicBrandingProfile(profile),
    assets: toPublicPromoAssets(profile.promoAssets)
  };
}

function toPublicPromoAssets(promoAssets = {}) {
  return {
    squareImageUrl: promoAssets.squareImageUrl || "",
    storyImageUrl: promoAssets.storyImageUrl || "",
    caption: promoAssets.caption || "",
    generatedAt: promoAssets.generatedAt || null
  };
}

export function generatePromoCaption(profile, payload = {}) {
  const businessName = profile.businessName;
  const mode = normalizeCaptionMode(payload.promoMode);
  const modeConfig = CAPTION_MODES[mode];
  const offer = sanitizeShortText(payload.offer || modeConfig.defaultOffer);
  const cta = sanitizeShortText(payload.cta || modeConfig.defaultCta);
  const contactLines = buildContactLines(profile);

  if (mode === "whatsapp") {
    return [
      offer,
      "",
      `Dengan ${businessName}, undangan bisa berisi detail acara, galeri foto, RSVP, ucapan tamu, dan amplop digital optional.`,
      "",
      cta,
      ...(contactLines.length ? ["", ...contactLines] : [])
    ].join("\n");
  }

  if (mode === "direct") {
    return [
      offer,
      "",
      `Di ${businessName}, kamu bisa dapat undangan digital yang:`,
      "- tampil elegan di HP tamu",
      "- punya link personal untuk daftar tamu",
      "- mendukung RSVP, ucapan, dan amplop digital optional",
      "- praktis dibagikan lewat WhatsApp",
      "",
      contactLines.length ? contactLines.join("\n") : "Hubungi kami untuk konsultasi.",
      "",
      cta
    ].join("\n");
  }

  return [
    offer,
    "",
    `${businessName} siap bantu menyiapkan undangan pernikahan digital yang praktis untuk tamu, RSVP, ucapan, dan amplop digital optional.`,
    "",
    contactLines.length ? contactLines.join("\n") : "Hubungi kami untuk konsultasi.",
    "",
    cta
  ].join("\n");
}

async function getBusinessNameWarnings(member, businessName) {
  const normalizedBusinessName = normalizeBrandingName(businessName);

  if (!normalizedBusinessName) {
    return [];
  }

  const duplicate = await BrandingProfile.exists({
    memberId: { $ne: member._id },
    normalizedBusinessName
  });

  return duplicate
    ? [
        {
          code: "business_name_used",
          message: "Nama bisnis ini sudah dipakai member lain. Kamu tetap bisa menyimpan, tapi sebaiknya pilih nama yang lebih unik."
        }
      ]
    : [];
}

function normalizeBrandingPayload(payload) {
  const businessName = sanitizeShortText(payload.businessName, 80);

  if (!businessName) {
    throw new AppError(400, "Nama bisnis wajib diisi.");
  }

  const selectedTemplate = payload.selectedTemplate || "minimal";

  if (!Object.hasOwn(TEMPLATE_STYLES, selectedTemplate)) {
    throw new AppError(400, "Template branding tidak valid.");
  }

  return {
    businessName,
    instagram: sanitizeShortText(payload.instagram, 120),
    facebook: sanitizeShortText(payload.facebook, 120),
    tiktok: sanitizeShortText(payload.tiktok, 120),
    whatsapp: sanitizePhone(payload.whatsapp),
    selectedTemplate
  };
}

async function generatePromoImage(profile, payload, directory, format) {
  ensureDirectory(directory);

  const dimensions = format === "story" ? { width: 1080, height: 1920 } : { width: 1080, height: 1080 };
  const filePath = path.join(directory, `${format}-${crypto.randomUUID()}.webp`);
  const photoBuffer = await getPromoPhotoBuffer(profile.promoPhotoUrl);

  if (photoBuffer) {
    const photo = getPromoTemplateLayout(profile.selectedTemplate, dimensions, format, true).photo;
    const baseSvg = renderPromoSvg(profile, payload, dimensions, format, {
      hasPhoto: true,
      includeContent: false
    });
    const topSvg = renderPromoSvg(profile, payload, dimensions, format, {
      hasPhoto: true,
      includeBase: false
    });
    const photoLayer = await preparePromoPhotoLayer(photoBuffer, photo);

    await sharp(Buffer.from(baseSvg))
      .composite([
        {
          input: photoLayer,
          left: photo.x,
          top: photo.y
        },
        {
          input: Buffer.from(topSvg),
          left: 0,
          top: 0
        }
      ])
      .webp({ quality: 90 })
      .toFile(filePath);
  } else {
    const svg = renderPromoSvg(profile, payload, dimensions, format);

    await sharp(Buffer.from(svg)).webp({ quality: 90 }).toFile(filePath);
  }

  return {
    filePath,
    publicUrl: toUploadUrl(filePath)
  };
}

export function renderPromoSvg(profile, payload, dimensions, format, options = {}) {
  const style = TEMPLATE_STYLES[profile.selectedTemplate] || TEMPLATE_STYLES.elegant;
  const { width, height } = dimensions;
  const isStory = format === "story";
  const hasPhoto = Boolean(options.hasPhoto || options.photoDataUri);
  const includeBase = options.includeBase !== false;
  const includeContent = options.includeContent !== false;
  const layout = getPromoTemplateLayout(profile.selectedTemplate, dimensions, format, hasPhoto);
  const { panel, photo, overlay, contactBox } = layout;
  const title = sanitizeShortText(payload.headline || "Undangan Digital Pernikahan", 80);
  const subtitle = sanitizeShortText(payload.subheadline || "Cantik, praktis, dan siap dibagikan ke semua tamu.", 130);
  const contact = profile.whatsapp || profile.instagram || profile.tiktok || profile.facebook || "Hubungi kami";
  const contactLabel = profile.whatsapp ? "Konsultasi via WhatsApp" : "Konsultasi undangan digital";
  const titleLines = wrapText(title, layout.titleMaxCharacters, layout.titleMaxLines);
  const subtitleLines = wrapText(subtitle, layout.subtitleMaxCharacters, layout.subtitleMaxLines);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  ${includeBase ? `<rect width="${width}" height="${height}" fill="${style.background}"/>
  <circle cx="${width - 110}" cy="120" r="180" fill="${style.accent}" opacity="0.22"/>
  <circle cx="85" cy="${height - 90}" r="210" fill="${style.primary}" opacity="0.10"/>
  <rect x="${panel.x}" y="${panel.y}" width="${panel.width}" height="${panel.height}" rx="${panel.radius}" fill="${style.panel}"/>` : ""}
  ${includeContent && photo ? renderPhotoBorder(photo) : ""}
  ${includeContent ? `
  ${renderAccentPath(layout, style, hasPhoto)}
  ${overlay ? renderTextOverlay(overlay, style) : ""}
  <text x="${layout.textX}" y="${layout.yStart}" font-family="Arial, sans-serif" font-size="${layout.businessFontSize}" fill="${style.accent}" font-weight="700" letter-spacing="4">${escapeXml(profile.businessName.toUpperCase())}</text>
  ${renderTextLines(titleLines, layout.textX, layout.yStart + layout.titleOffset, layout.titleFontSize, layout.titleLineHeight, style.primary, 800)}
  ${renderTextLines(subtitleLines, layout.textX, layout.yStart + layout.titleOffset + (titleLines.length * layout.titleLineHeight) + layout.subtitleOffset, layout.subtitleFontSize, layout.subtitleLineHeight, style.muted, 400)}
  <rect x="${contactBox.x}" y="${contactBox.y}" width="${contactBox.width}" height="${contactBox.height}" rx="${contactBox.radius}" fill="${style.primary}"/>
  <text x="${contactBox.textX}" y="${contactBox.y + contactBox.primaryTextY}" font-family="Arial, sans-serif" font-size="${contactBox.primaryFontSize}" fill="#FFFFFF" font-weight="700">${escapeXml(contact)}</text>
  <text x="${contactBox.textX}" y="${contactBox.y + contactBox.secondaryTextY}" font-family="Arial, sans-serif" font-size="${contactBox.secondaryFontSize}" fill="#FFFFFF" opacity="0.82">${escapeXml(contactLabel)}</text>
  <text x="${layout.footerX}" y="${layout.footerY}" font-family="Arial, sans-serif" font-size="24" fill="${style.text}" opacity="0.55">Janji Nikah Partner</text>` : ""}
</svg>`;
}

function getPromoTemplateLayout(template, dimensions, format, hasPhoto) {
  const isStory = format === "story";
  const contentWidth = dimensions.width - 160;
  const basePanel = {
    x: 80,
    y: isStory ? 180 : 110,
    width: contentWidth,
    height: isStory ? 1560 : 860,
    radius: 42
  };

  if (!hasPhoto) {
    return {
      panel: basePanel,
      photo: null,
      overlay: null,
      textX: 140,
      yStart: isStory ? 500 : 270,
      businessFontSize: 34,
      titleFontSize: isStory ? 82 : 76,
      titleLineHeight: 88,
      titleOffset: 115,
      subtitleFontSize: isStory ? 38 : 34,
      subtitleLineHeight: 48,
      subtitleOffset: 95,
      titleMaxCharacters: isStory ? 21 : 18,
      titleMaxLines: 3,
      subtitleMaxCharacters: isStory ? 34 : 28,
      subtitleMaxLines: 4,
      contactBox: {
        x: 140,
        y: dimensions.height - (isStory ? 410 : 260),
        width: contentWidth - 120,
        height: isStory ? 190 : 145,
        radius: 28,
        textX: 180,
        primaryTextY: 85,
        secondaryTextY: isStory ? 145 : 135,
        primaryFontSize: isStory ? 42 : 36,
        secondaryFontSize: isStory ? 30 : 26
      },
      footerX: 140,
      footerY: dimensions.height - 90,
      accentVariant: "wave"
    };
  }

  if (template === "elegant") {
    const photoSize = isStory ? 760 : 520;
    return {
      panel: basePanel,
      photo: {
        x: (dimensions.width - photoSize) / 2,
        y: isStory ? 320 : 155,
        width: photoSize,
        height: photoSize,
        radius: 36
      },
      overlay: {
        x: 110,
        y: isStory ? 1035 : 610,
        width: contentWidth - 60,
        height: isStory ? 520 : 330,
        radius: 34
      },
      textX: 140,
      yStart: isStory ? 1135 : 665,
      businessFontSize: 34,
      titleFontSize: isStory ? 78 : 70,
      titleLineHeight: 84,
      titleOffset: 105,
      subtitleFontSize: isStory ? 36 : 31,
      subtitleLineHeight: 46,
      subtitleOffset: 70,
      titleMaxCharacters: isStory ? 22 : 19,
      titleMaxLines: isStory ? 2 : 1,
      subtitleMaxCharacters: isStory ? 36 : 30,
      subtitleMaxLines: isStory ? 2 : 0,
      contactBox: {
        x: 140,
        y: dimensions.height - (isStory ? 390 : 185),
        width: contentWidth - 120,
        height: isStory ? 180 : 105,
        radius: 24,
        textX: 180,
        primaryTextY: isStory ? 80 : 48,
        secondaryTextY: isStory ? 138 : 84,
        primaryFontSize: isStory ? 40 : 34,
        secondaryFontSize: isStory ? 28 : 24
      },
      footerX: 140,
      footerY: isStory ? dimensions.height - 90 : dimensions.height - 30,
      accentVariant: "corner"
    };
  }

  if (template === "modern") {
    const photoSize = isStory ? 650 : 420;
    return {
      panel: basePanel,
      photo: {
        x: (dimensions.width - photoSize) / 2,
        y: isStory ? 310 : 155,
        width: photoSize,
        height: photoSize,
        radius: photoSize / 2
      },
      overlay: {
        x: 110,
        y: isStory ? 980 : 545,
        width: contentWidth - 60,
        height: isStory ? 560 : 360,
        radius: 34
      },
      textX: 140,
      yStart: isStory ? 1080 : 610,
      businessFontSize: 34,
      titleFontSize: isStory ? 80 : 72,
      titleLineHeight: 86,
      titleOffset: 105,
      subtitleFontSize: isStory ? 36 : 31,
      subtitleLineHeight: 46,
      subtitleOffset: 70,
      titleMaxCharacters: isStory ? 22 : 19,
      titleMaxLines: isStory ? 2 : 1,
      subtitleMaxCharacters: isStory ? 36 : 30,
      subtitleMaxLines: isStory ? 2 : 0,
      contactBox: {
        x: 140,
        y: dimensions.height - (isStory ? 385 : 180),
        width: contentWidth - 120,
        height: isStory ? 180 : 105,
        radius: 52,
        textX: 180,
        primaryTextY: isStory ? 80 : 48,
        secondaryTextY: isStory ? 138 : 84,
        primaryFontSize: isStory ? 40 : 34,
        secondaryFontSize: isStory ? 28 : 24
      },
      footerX: 140,
      footerY: isStory ? dimensions.height - 90 : dimensions.height - 30,
      accentVariant: "circle"
    };
  }

  return getMinimalPhotoLayout(dimensions, format);
}

function getMinimalPhotoLayout(dimensions, format) {
  const isStory = format === "story";

  return {
    panel: {
      x: 80,
      y: isStory ? 180 : 110,
      width: dimensions.width - 160,
      height: isStory ? 1560 : 860,
      radius: 42
    },
    photo: {
      x: 80,
      y: isStory ? 180 : 110,
      width: dimensions.width - 160,
      height: isStory ? 1040 : 560,
      radius: 42
    },
    overlay: {
      x: 110,
      y: isStory ? 1085 : 585,
      width: dimensions.width - 220,
      height: isStory ? 470 : 300,
      radius: 34
    },
    textX: 140,
    yStart: isStory ? 1175 : 635,
    businessFontSize: 34,
    titleFontSize: isStory ? 82 : 76,
    titleLineHeight: 88,
    titleOffset: 115,
    subtitleFontSize: isStory ? 38 : 34,
    subtitleLineHeight: 48,
    subtitleOffset: 95,
    titleMaxCharacters: isStory ? 21 : 18,
    titleMaxLines: isStory ? 2 : 1,
    subtitleMaxCharacters: isStory ? 34 : 28,
    subtitleMaxLines: isStory ? 2 : 0,
    contactBox: {
      x: 140,
      y: isStory ? dimensions.height - 410 : dimensions.height - 205,
      width: dimensions.width - 280,
      height: isStory ? 190 : 110,
      radius: isStory ? 28 : 24,
      textX: 180,
      primaryTextY: isStory ? 85 : 50,
      secondaryTextY: isStory ? 145 : 88,
      primaryFontSize: isStory ? 42 : 36,
      secondaryFontSize: isStory ? 30 : 26
    },
    footerX: 140,
    footerY: isStory ? dimensions.height - 90 : dimensions.height - 35,
    accentVariant: "wave"
  };
}

function renderAccentPath(layout, style, hasPhoto) {
  if (layout.accentVariant === "circle" && layout.photo) {
    const cx = layout.photo.x + layout.photo.width / 2;
    const cy = layout.photo.y + layout.photo.height / 2;
    return `<circle cx="${cx}" cy="${cy}" r="${layout.photo.width / 2 + 34}" fill="none" stroke="${style.accent}" stroke-width="8" opacity="0.86"/>`;
  }

  if (layout.accentVariant === "corner" && layout.photo) {
    return `<path d="M${layout.photo.x + 35} ${layout.photo.y - 22} H${layout.photo.x + layout.photo.width - 35}" fill="none" stroke="${style.accent}" stroke-width="8" stroke-linecap="round" opacity="0.82"/>
  <path d="M${layout.photo.x - 22} ${layout.photo.y + 35} V${layout.photo.y + layout.photo.height - 35}" fill="none" stroke="${style.accent}" stroke-width="8" stroke-linecap="round" opacity="0.35"/>`;
  }

  const isStory = layout.panel.height > 1000;
  return `<path d="M170 ${isStory ? 310 : 220} C310 ${isStory ? 210 : 120}, 430 ${isStory ? 410 : 300}, 560 ${isStory ? 290 : 190} S820 ${isStory ? 220 : 150}, 910 ${isStory ? 330 : 240}" fill="none" stroke="${style.accent}" stroke-width="7" stroke-linecap="round" opacity="${hasPhoto ? 0.92 : 0.75}"/>`;
}

function renderPhotoBorder(photo) {
  return `<rect x="${photo.x}" y="${photo.y}" width="${photo.width}" height="${photo.height}" rx="${photo.radius}" fill="none" stroke="#FFFFFF" stroke-width="10" opacity="0.92"/>`;
}

function renderTextOverlay(overlay, style) {
  return `<rect x="${overlay.x}" y="${overlay.y}" width="${overlay.width}" height="${overlay.height}" rx="${overlay.radius}" fill="${style.panel}" opacity="0.94"/>
  <rect x="${overlay.x}" y="${overlay.y}" width="${overlay.width}" height="8" rx="4" fill="${style.accent}" opacity="0.90"/>`;
}

function buildContactLines(profile) {
  return [
    profile.whatsapp ? `WhatsApp: ${profile.whatsapp}` : "",
    profile.instagram ? `Instagram: ${profile.instagram}` : "",
    profile.tiktok ? `TikTok: ${profile.tiktok}` : "",
    profile.facebook ? `Facebook: ${profile.facebook}` : ""
  ].filter(Boolean);
}

function normalizeCaptionMode(value) {
  return Object.hasOwn(CAPTION_MODES, value) ? value : "soft";
}

function renderTextLines(lines, x, y, fontSize, lineHeight, fill, weight) {
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * lineHeight}" font-family="Arial, sans-serif" font-size="${fontSize}" fill="${fill}" font-weight="${weight}">${escapeXml(line)}</text>`
    )
    .join("\n  ");
}

function wrapText(value, maxCharacters, maxLines) {
  const words = String(value || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (next.length > maxCharacters && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }

    if (lines.length === maxLines) break;
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  return lines;
}

function sanitizeShortText(value, maxLength = 160) {
  return String(value || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function sanitizePhone(value) {
  return String(value || "")
    .replace(/[^\d+\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 30);
}

async function processAndStorePromoPhoto(file, directory) {
  ensureDirectory(directory);

  const filePath = path.join(directory, `${crypto.randomUUID()}.webp`);

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

async function getPromoPhotoBuffer(publicUrl) {
  const filePath = uploadUrlToFilePath(publicUrl);

  if (!filePath) {
    return null;
  }

  try {
    return await fs.readFile(filePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function preparePromoPhotoLayer(photoBuffer, photo) {
  const mask = Buffer.from(
    `<svg width="${photo.width}" height="${photo.height}" viewBox="0 0 ${photo.width} ${photo.height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${photo.width}" height="${photo.height}" rx="${photo.radius}" fill="#FFFFFF"/>
    </svg>`
  );

  return sharp(photoBuffer)
    .rotate()
    .resize(photo.width, photo.height, {
      fit: "cover"
    })
    .composite([
      {
        input: mask,
        blend: "dest-in"
      }
    ])
    .png()
    .toBuffer();
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function deleteUploadByUrl(publicUrl) {
  const filePath = uploadUrlToFilePath(publicUrl);

  if (!filePath) return;

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

function uploadUrlToFilePath(publicUrl) {
  const relativeUrl = toRelativeUploadUrl(publicUrl);

  if (!relativeUrl?.startsWith("/uploads/")) {
    return "";
  }

  const relativePath = relativeUrl.replace(/^\/uploads\//, "");
  return path.join(resolveUploadPath(), relativePath);
}

function assertUploadedFile(file) {
  if (!file) {
    throw new AppError(400, "Foto promosi wajib diunggah.");
  }
}
