import assert from "node:assert/strict";
import test from "node:test";

import {
  canChangeUsername,
  createUsernameBase,
  normalizeUsername,
  validateUsername
} from "../src/utils/username.js";

test("normalizes usernames to lowercase slug format", () => {
  assert.equal(normalizeUsername(" Rio Undangan!! "), "rio-undangan");
  assert.equal(normalizeUsername("A & S Wedding"), "a-s-wedding");
});

test("validates username rules", () => {
  assert.equal(validateUsername("ab"), "Username minimal 3 karakter.");
  assert.equal(
    validateUsername("nama_user"),
    "Username hanya boleh memakai huruf kecil, angka, dan tanda strip."
  );
  assert.equal(validateUsername("nama-user-123"), null);
});

test("creates username base from name or email", () => {
  assert.equal(createUsernameBase("Rio Undangan", "rio@example.com"), "rio-undangan");
  assert.equal(createUsernameBase("", "member.demo@example.com"), "member-demo");
});

test("allows username change only once every 30 days after first change", () => {
  const now = new Date("2026-07-16T00:00:00.000Z");

  assert.equal(canChangeUsername(null, now), true);
  assert.equal(canChangeUsername(new Date("2026-06-16T00:00:00.000Z"), now), true);
  assert.equal(canChangeUsername(new Date("2026-07-01T00:00:00.000Z"), now), false);
});
