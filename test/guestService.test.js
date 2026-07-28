import assert from "node:assert/strict";
import test from "node:test";

import { toPublicWish } from "../src/services/guestService.js";

test("formats wishes with RSVP status for API responses", () => {
  const createdAt = new Date("2026-07-28T08:00:00.000Z");
  const hiddenAt = new Date("2026-07-28T09:00:00.000Z");

  const wish = toPublicWish({
    _id: { toString: () => "wish-id" },
    invitationId: { toString: () => "invitation-id" },
    guestId: { toString: () => "guest-id" },
    displayName: "Bapak Andi",
    message: "Selamat menempuh hidup baru.",
    rsvpStatus: "attending",
    isHidden: true,
    hiddenAt,
    createdAt
  });

  assert.deepEqual(wish, {
    id: "wish-id",
    invitationId: "invitation-id",
    guestId: "guest-id",
    displayName: "Bapak Andi",
    message: "Selamat menempuh hidup baru.",
    rsvpStatus: "attending",
    isHidden: true,
    hiddenAt,
    createdAt
  });
});

test("formats wishes without RSVP as pending RSVP", () => {
  const createdAt = new Date("2026-07-28T08:00:00.000Z");

  const wish = toPublicWish({
    _id: { toString: () => "wish-id" },
    invitationId: { toString: () => "invitation-id" },
    guestId: { toString: () => "guest-id" },
    displayName: "Ibu Sari",
    message: "Semoga bahagia.",
    isHidden: false,
    hiddenAt: null,
    createdAt
  });

  assert.equal(wish.rsvpStatus, null);
});
