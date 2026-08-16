import {
  createMusic,
  createUploadedMusic,
  createTheme,
  deleteMusic,
  listActiveMusic,
  listActiveThemes,
  listAdminMusic,
  listAdminThemes,
  listPublicDemoThemes,
  setMusicStatus,
  setThemeStatus,
  updateMusic,
  updateTheme
} from "../services/catalogService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const publicThemes = asyncHandler(async (req, res) => {
  const themes = await listActiveThemes();
  res.json({ success: true, data: { themes } });
});

export const publicDemoThemes = asyncHandler(async (req, res) => {
  const themes = await listPublicDemoThemes();
  res.json({ success: true, data: { themes } });
});

export const publicMusic = asyncHandler(async (req, res) => {
  const music = await listActiveMusic();
  res.json({ success: true, data: { music } });
});

export const adminThemes = asyncHandler(async (req, res) => {
  const themes = await listAdminThemes();
  res.json({ success: true, data: { themes } });
});

export const adminCreateTheme = asyncHandler(async (req, res) => {
  const theme = await createTheme(req.user, req.body);
  res.status(201).json({ success: true, data: { theme } });
});

export const adminUpdateTheme = asyncHandler(async (req, res) => {
  const theme = await updateTheme(req.user, req.params.id, req.body);
  res.json({ success: true, data: { theme } });
});

export const adminSetThemeStatus = asyncHandler(async (req, res) => {
  const theme = await setThemeStatus(req.user, req.params.id, req.body.isActive);
  res.json({ success: true, data: { theme } });
});

export const adminMusic = asyncHandler(async (req, res) => {
  const music = await listAdminMusic();
  res.json({ success: true, data: { music } });
});

export const adminCreateMusic = asyncHandler(async (req, res) => {
  const music = await createMusic(req.user, req.body);
  res.status(201).json({ success: true, data: { music } });
});

export const adminUploadMusic = asyncHandler(async (req, res) => {
  const music = await createUploadedMusic(req.user, req.body, req.file);
  res.status(201).json({ success: true, data: { music } });
});

export const adminUpdateMusic = asyncHandler(async (req, res) => {
  const music = await updateMusic(req.user, req.params.id, req.body);
  res.json({ success: true, data: { music } });
});

export const adminSetMusicStatus = asyncHandler(async (req, res) => {
  const music = await setMusicStatus(req.user, req.params.id, req.body.isActive);
  res.json({ success: true, data: { music } });
});

export const adminDeleteMusic = asyncHandler(async (req, res) => {
  const music = await deleteMusic(req.user, req.params.id);
  res.json({ success: true, data: { music } });
});
