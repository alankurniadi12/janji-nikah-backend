const USERNAME_PATTERN = /^[a-z0-9-]+$/;
const MIN_USERNAME_LENGTH = 3;

export function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function validateUsername(username) {
  if (!username || username.length < MIN_USERNAME_LENGTH) {
    return "Username minimal 3 karakter.";
  }

  if (!USERNAME_PATTERN.test(username)) {
    return "Username hanya boleh memakai huruf kecil, angka, dan tanda strip.";
  }

  return null;
}

export function createUsernameBase(name, email) {
  const localPart = String(email || "").split("@")[0];
  const normalized = normalizeUsername(name) || normalizeUsername(localPart);

  return normalized.length >= MIN_USERNAME_LENGTH ? normalized : "member";
}

export function canChangeUsername(lastUsernameChangedAt, now = new Date()) {
  if (!lastUsernameChangedAt) {
    return true;
  }

  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  return now.getTime() - new Date(lastUsernameChangedAt).getTime() >= thirtyDaysMs;
}
