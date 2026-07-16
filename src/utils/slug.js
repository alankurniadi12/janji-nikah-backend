export function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function createInvitationSlugBase(groomName, brideName, fallback = "undangan") {
  const groom = normalizeSlug(groomName).split("-")[0] || "";
  const bride = normalizeSlug(brideName).split("-")[0] || "";
  const combined = normalizeSlug([groom, bride].filter(Boolean).join("-"));

  return combined || fallback;
}
