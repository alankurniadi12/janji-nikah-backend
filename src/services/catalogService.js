import AuditLog from "../models/AuditLog.js";
import Music from "../models/Music.js";
import Theme from "../models/Theme.js";
import { AppError } from "../utils/AppError.js";
import { toUploadUrl } from "../utils/fileUrl.js";

export function toPublicTheme(theme) {
  return {
    id: theme._id.toString(),
    name: theme.name,
    key: theme.key,
    thumbnailUrl: theme.thumbnailUrl,
    isActive: theme.isActive,
    isPublicDemo: theme.isPublicDemo,
    createdAt: theme.createdAt,
    updatedAt: theme.updatedAt
  };
}

export function toPublicMusic(music) {
  return {
    id: music._id.toString(),
    title: music.title,
    category: music.category,
    duration: music.duration,
    fileUrl: music.fileUrl,
    isActive: music.isActive,
    createdAt: music.createdAt,
    updatedAt: music.updatedAt
  };
}

export async function listActiveThemes() {
  const themes = await Theme.find({ isActive: true }).sort({ name: 1 }).lean();
  return themes.map(toPublicTheme);
}

export async function listPublicDemoThemes() {
  const themes = await Theme.find({ isActive: true, isPublicDemo: true }).sort({ name: 1 }).lean();
  return themes.map(toPublicTheme);
}

export async function listActiveMusic() {
  const music = await Music.find({ isActive: true }).sort({ title: 1 }).lean();
  return music.map(toPublicMusic);
}

export async function listAdminThemes() {
  const themes = await Theme.find().sort({ createdAt: -1 }).lean();
  return themes.map(toPublicTheme);
}

export async function createTheme(admin, payload) {
  validateThemePayload(payload, true);
  const theme = await Theme.create(payload);
  await logCatalogAction(admin, "theme.created", "Theme", theme._id, null, theme.toObject());
  return toPublicTheme(theme);
}

export async function updateTheme(admin, themeId, payload) {
  const theme = await Theme.findById(themeId);
  if (!theme) throw new AppError(404, "Tema tidak ditemukan.");
  validateThemePayload(payload, false);
  const before = theme.toObject();
  Object.assign(theme, pick(payload, ["name", "key", "thumbnailUrl", "isPublicDemo"]));
  await theme.save();
  await logCatalogAction(admin, "theme.updated", "Theme", theme._id, before, theme.toObject());
  return toPublicTheme(theme);
}

export async function setThemeStatus(admin, themeId, isActive) {
  const theme = await Theme.findById(themeId);
  if (!theme) throw new AppError(404, "Tema tidak ditemukan.");
  const before = theme.toObject();
  theme.isActive = Boolean(isActive);
  await theme.save();
  await logCatalogAction(admin, theme.isActive ? "theme.activated" : "theme.deactivated", "Theme", theme._id, before, theme.toObject());
  return toPublicTheme(theme);
}

export async function listAdminMusic() {
  const music = await Music.find().sort({ createdAt: -1 }).lean();
  return music.map(toPublicMusic);
}

export async function createMusic(admin, payload) {
  validateMusicPayload(payload, true);
  const music = await Music.create(normalizeMusicPayload(payload));
  await logCatalogAction(admin, "music.created", "Music", music._id, null, music.toObject());
  return toPublicMusic(music);
}

export async function createUploadedMusic(admin, payload, file) {
  if (!file) throw new AppError(400, "File MP3 wajib diupload.");

  const data = normalizeMusicPayload({
    ...payload,
    fileUrl: toUploadUrl(file.path)
  });
  validateMusicPayload(data, true);

  const music = await Music.create(data);
  await logCatalogAction(admin, "music.uploaded", "Music", music._id, null, music.toObject());
  return toPublicMusic(music);
}

export async function updateMusic(admin, musicId, payload) {
  const music = await Music.findById(musicId);
  if (!music) throw new AppError(404, "Musik tidak ditemukan.");
  validateMusicPayload(payload, false);
  const before = music.toObject();
  Object.assign(music, pick(normalizeMusicPayload(payload), ["title", "category", "duration", "fileUrl"]));
  await music.save();
  await logCatalogAction(admin, "music.updated", "Music", music._id, before, music.toObject());
  return toPublicMusic(music);
}

export async function setMusicStatus(admin, musicId, isActive) {
  const music = await Music.findById(musicId);
  if (!music) throw new AppError(404, "Musik tidak ditemukan.");
  const before = music.toObject();
  music.isActive = Boolean(isActive);
  await music.save();
  await logCatalogAction(admin, music.isActive ? "music.activated" : "music.deactivated", "Music", music._id, before, music.toObject());
  return toPublicMusic(music);
}

function validateThemePayload(payload, requireAll) {
  if (requireAll && !payload?.name) throw new AppError(400, "Nama tema wajib diisi.");
  if (requireAll && !payload?.key) throw new AppError(400, "Key tema wajib diisi.");
}

function validateMusicPayload(payload, requireAll) {
  if (requireAll && !payload?.title) throw new AppError(400, "Judul musik wajib diisi.");
  if (requireAll && !payload?.fileUrl) throw new AppError(400, "File URL musik wajib diisi.");
}

function normalizeMusicPayload(payload = {}) {
  const duration = Number(payload.duration);

  return {
    ...payload,
    title: payload.title?.trim?.() || payload.title,
    category: payload.category?.trim?.() || "",
    duration: Number.isFinite(duration) && duration >= 0 ? duration : 0
  };
}

function pick(source, keys) {
  return keys.reduce((result, key) => {
    if (source[key] !== undefined) result[key] = source[key];
    return result;
  }, {});
}

async function logCatalogAction(actor, action, targetType, targetId, before, after) {
  await AuditLog.create({ actorId: actor._id, action, targetType, targetId, before, after });
}
