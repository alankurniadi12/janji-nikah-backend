import assert from "node:assert/strict";
import test from "node:test";

import { createInvitationSlugBase, normalizeSlug } from "../src/utils/slug.js";

test("normalizes invitation slug", () => {
  assert.equal(normalizeSlug(" Andi & Sari!! "), "andi-sari");
  assert.equal(normalizeSlug("Akad Nikah 2026"), "akad-nikah-2026");
});

test("creates invitation slug base from couple first names", () => {
  assert.equal(createInvitationSlugBase("Andi Pratama", "Sari Lestari"), "andi-sari");
  assert.equal(createInvitationSlugBase("", ""), "undangan");
});
