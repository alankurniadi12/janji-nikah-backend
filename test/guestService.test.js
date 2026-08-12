import assert from "node:assert/strict";
import test from "node:test";

import { toPublicGuest, toPublicWish } from "../src/services/guestService.js";

test("formats guest personal link without requiring token exposure", () => {
  const guest = toPublicGuest(
    {
      _id: { toString: () => "guest-id" },
      invitationId: { toString: () => "invitation-id" },
      name: "Bapak Andi",
      token: "guest-token",
      sentStatus: "not_sent",
      sentAt: null,
      openedAt: null,
      createdAt: null,
      updatedAt: null
    },
    { slug: "raka-amara" },
    { username: "member-name" }
  );

  assert.equal(guest.link, "/member-name/raka-amara/guest/guest-token");
  assert.equal(guest.token, "guest-token");
});

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
