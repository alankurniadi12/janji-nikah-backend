import User from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import {
  canChangeUsername,
  createUsernameBase,
  normalizeUsername,
  validateUsername
} from "../utils/username.js";

export async function isUsernameReserved(username, excludedUserId = null) {
  const normalized = normalizeUsername(username);
  const query = {
    $or: [{ username: normalized }, { usernameHistory: normalized }]
  };

  if (excludedUserId) {
    query._id = { $ne: excludedUserId };
  }

  return Boolean(await User.exists(query));
}

export async function assertUsernameAvailable(username, excludedUserId = null) {
  const normalized = normalizeUsername(username);
  const validationMessage = validateUsername(normalized);

  if (validationMessage) {
    throw new AppError(400, validationMessage);
  }

  if (await isUsernameReserved(normalized, excludedUserId)) {
    throw new AppError(409, "Username sudah digunakan atau pernah digunakan.");
  }

  return normalized;
}

export async function createAvailableUsername(name, email) {
  const base = createUsernameBase(name, email);

  for (let suffix = 0; suffix < 100; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`;

    if (!(await isUsernameReserved(candidate))) {
      return candidate;
    }
  }

  throw new AppError(500, "Gagal membuat username otomatis.");
}

export async function applyUsernameChange(user, requestedUsername, now = new Date()) {
  const normalized = await assertUsernameAvailable(requestedUsername, user._id);

  if (normalized === user.username) {
    return user;
  }

  if (user.termsAcceptedAt && !canChangeUsername(user.lastUsernameChangedAt, now)) {
    throw new AppError(429, "Username hanya bisa diubah 1 kali setiap 30 hari.");
  }

  if (user.username && !user.usernameHistory.includes(user.username)) {
    user.usernameHistory.push(user.username);
  }

  user.username = normalized;
  user.lastUsernameChangedAt = now;

  return user;
}
