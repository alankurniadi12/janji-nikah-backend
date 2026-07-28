import { OAuth2Client } from "google-auth-library";

import { env } from "../config/env.js";
import User from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { toPublicUser } from "../utils/publicUser.js";
import { createAccessToken, createRefreshToken, verifyRefreshToken } from "./tokenService.js";
import { applyUsernameChange, createAvailableUsername } from "./usernameService.js";

const googleClient = new OAuth2Client(env.googleClientId);

async function verifyGoogleIdToken(idToken) {
  if (!env.googleClientId) {
    throw new AppError(500, "Google OAuth belum dikonfigurasi.");
  }

  let ticket;

  try {
    ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.googleClientId
    });
  } catch (error) {
    throw new AppError(401, "Google ID token tidak valid.");
  }

  const payload = ticket.getPayload();

  if (!payload?.email || payload.email_verified !== true) {
    throw new AppError(401, "Akun Google belum terverifikasi.");
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name || payload.email.split("@")[0],
    avatarUrl: payload.picture || ""
  };
}

export async function loginWithGoogle(idToken) {
  if (!idToken) {
    throw new AppError(400, "Google ID token wajib dikirim.");
  }

  const googleProfile = await verifyGoogleIdToken(idToken);
  let user = await User.findOne({
    $or: [{ googleId: googleProfile.googleId }, { email: googleProfile.email }]
  });

  if (!user) {
    const username = await createAvailableUsername(googleProfile.name, googleProfile.email);

    user = await User.create({
      googleId: googleProfile.googleId,
      email: googleProfile.email,
      name: googleProfile.name,
      avatarUrl: googleProfile.avatarUrl,
      role: "member",
      status: "active",
      username,
      usernameHistory: []
    });
  } else {
    user.googleId = user.googleId || googleProfile.googleId;
    user.name = googleProfile.name;
    user.avatarUrl = googleProfile.avatarUrl;
    await user.save();
  }

  if (user.status !== "active") {
    throw new AppError(403, "Akun tidak aktif.");
  }

  return createAuthPayload(user);
}

export async function completeOnboarding(user, payload) {
  if (user.role !== "member") {
    throw new AppError(403, "Onboarding hanya untuk member.");
  }

  if (payload?.acceptTerms !== true) {
    throw new AppError(400, "Syarat layanan wajib disetujui.");
  }

  if (payload.username) {
    await applyUsernameChange(user, payload.username);
  }

  user.termsAcceptedAt = user.termsAcceptedAt || new Date();
  await user.save();

  return toPublicUser(user);
}

export async function refreshAuth(refreshToken) {
  if (!refreshToken) {
    throw new AppError(401, "Sesi login tidak ditemukan. Silakan masuk ulang.");
  }

  const payload = verifyRefreshToken(refreshToken);
  const user = await User.findById(payload.sub);

  if (!user) {
    throw new AppError(401, "User tidak ditemukan.");
  }

  if (user.status !== "active") {
    throw new AppError(403, "Akun tidak aktif.");
  }

  return createAuthPayload(user);
}

export function createAuthPayload(user) {
  return {
    user: toPublicUser(user),
    accessToken: createAccessToken(user),
    refreshToken: createRefreshToken(user)
  };
}
