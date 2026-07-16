import User from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { verifyAccessToken } from "../services/tokenService.js";

function extractBearerToken(req) {
  const header = req.get("authorization") || "";

  if (!header.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim();
}

export async function authenticate(req, res, next) {
  try {
    const token = extractBearerToken(req);

    if (!token) {
      throw new AppError(401, "Akses membutuhkan token.");
    }

    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);

    if (!user) {
      throw new AppError(401, "User tidak ditemukan.");
    }

    if (user.status !== "active") {
      throw new AppError(403, "Akun tidak aktif.");
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new AppError(403, "Akses tidak diizinkan."));
      return;
    }

    next();
  };
}
