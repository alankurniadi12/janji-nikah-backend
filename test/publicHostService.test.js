import assert from "node:assert/strict";
import test from "node:test";

import Guest from "../src/models/Guest.js";
import Invitation from "../src/models/Invitation.js";
import User from "../src/models/User.js";
import { addPublicHostGuest } from "../src/services/publicHostService.js";

function mockHostLookup(t, invitation) {
  t.mock.method(User, "findOne", () => ({ lean: async () => ({ _id: "member-id", username: "member" }) }));
  t.mock.method(Invitation, "findOne", (query) => {
    if (query.slug) {
      return { select: () => ({ lean: async () => invitation }) };
    }
    return Promise.resolve(invitation);
  });
}

test("host link adds a guest and returns only the personal link", async (t) => {
  const invitation = {
    _id: "invitation-id",
    memberId: "member-id",
    slug: "raka-amara",
    status: "locked",
    hostAccessToken: "host-secret",
    expiresAt: new Date(Date.now() + 60_000)
  };
  mockHostLookup(t, invitation);
  t.mock.method(Guest, "exists", async () => false);
  const create = t.mock.method(Guest, "create", async (payload) => ({
    _id: "guest-id",
    ...payload,
    sentStatus: "not_sent",
    sentAt: null,
    openedAt: null
  }));

  const guest = await addPublicHostGuest("member", "raka-amara", "host-secret", { name: "  Ibu <Sari>  " });

  assert.equal(create.mock.callCount(), 1);
  assert.equal(create.mock.calls[0].arguments[0].name, "Ibu Sari");
  assert.equal(guest.link.startsWith("/member/raka-amara/guest/"), true);
  assert.equal(guest.name, "Ibu Sari");
  assert.equal(Object.hasOwn(guest, "token"), false);
});

test("host link rejects the wrong token before adding a guest", async (t) => {
  mockHostLookup(t, {
    _id: "invitation-id",
    slug: "raka-amara",
    status: "locked",
    hostAccessToken: "host-secret",
    expiresAt: new Date(Date.now() + 60_000)
  });
  const create = t.mock.method(Guest, "create", async () => ({}));

  await assert.rejects(
    addPublicHostGuest("member", "raka-amara", "wrong-token", { name: "Ibu Sari" }),
    { statusCode: 404 }
  );
  assert.equal(create.mock.callCount(), 0);
});

test("host link cannot add guests after invitation expiry", async (t) => {
  mockHostLookup(t, {
    _id: "invitation-id",
    slug: "raka-amara",
    status: "locked",
    hostAccessToken: "host-secret",
    expiresAt: new Date(Date.now() - 60_000)
  });
  const create = t.mock.method(Guest, "create", async () => ({}));

  await assert.rejects(
    addPublicHostGuest("member", "raka-amara", "host-secret", { name: "Ibu Sari" }),
    { statusCode: 410 }
  );
  assert.equal(create.mock.callCount(), 0);
});
