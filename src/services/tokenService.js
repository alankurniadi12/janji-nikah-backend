import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

export const REFRESH_COOKIE_NAME = "janji_nikah_refresh";

function signToken(user, type, expiresIn) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      type
    },
    env.jwtSecret,
    {
      expiresIn
    }
  );
}

export function createAccessToken(user) {
  return signToken(user, "access", env.jwtAccessExpiresIn);
}

export function createRefreshToken(user) {
  return signToken(user, "refresh", env.jwtRefreshExpiresIn);
}

export function verifyAccessToken(token) {
  return verifyTokenByType(token, "access");
}

export function verifyRefreshToken(token) {
  return verifyTokenByType(token, "refresh");
}

function verifyTokenByType(token, type) {
  try {
    const payload = jwt.verify(token, env.jwtSecret);

    if (payload.type !== type) {
      throw new AppError(401, "Token tidak valid.");
    }

    return payload;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(401, "Token tidak valid atau sudah kedaluwarsa.");
  }
}

export function setRefreshCookie(res, refreshToken) {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: env.nodeEnv === "production" ? "none" : "lax",
    signed: true,
    path: "/api/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

export function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: env.nodeEnv === "production" ? "none" : "lax",
    signed: true,
    path: "/api/auth"
  });
}
