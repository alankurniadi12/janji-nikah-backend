import assert from "node:assert/strict";
import test from "node:test";

import Guest from "../src/models/Guest.js";
import Invitation from "../src/models/Invitation.js";
import RSVP from "../src/models/RSVP.js";
import Wish from "../src/models/Wish.js";
import { bulkCreateInvitationGuests, createInvitationGuest, deleteInvitationGuest, MAX_GUESTS_PER_INVITATION } from "../src/services/guestService.js";

function mockGuestCapacity(t, initialCount) {
  let count = initialCount;
  const invitation = { _id: "invitation-id", memberId: "member-id", slug: "raka-amara" };
  t.mock.method(Invitation, "findOne", async () => invitation);
  t.mock.method(Guest, "countDocuments", async () => initialCount);
  t.mock.method(Invitation, "updateOne", async (_query, update) => {
    count += update.$inc?.guestCount || 0;
    return { modifiedCount: 1 };
  });
  t.mock.method(Invitation, "findOneAndUpdate", async (query, update) => {
    if (count > query.guestCount.$lte) return null;
    count += update.$inc.guestCount;
    return invitation;
  });
  t.mock.method(Guest, "exists", async () => false);
  const create = t.mock.method(Guest, "create", async (payload) => ({
    _id: `guest-${count}`,
    ...payload
  }));
  return { create, getCount: () => count };
}

test("the 500th guest succeeds and concurrent 501st guest is rejected", async (t) => {
  const capacity = mockGuestCapacity(t, 499);
  const member = { _id: "member-id", username: "member" };
  const results = await Promise.allSettled([
    createInvitationGuest(member, "invitation-id", { name: "Ibu Sari" }),
    createInvitationGuest(member, "invitation-id", { name: "Pak Budi" })
  ]);

  assert.equal(MAX_GUESTS_PER_INVITATION, 500);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected")[0].reason.statusCode, 409);
  assert.equal(capacity.create.mock.callCount(), 1);
  assert.equal(capacity.getCount(), 500);
});

test("bulk creation rejects the full batch when it exceeds remaining capacity", async (t) => {
  const capacity = mockGuestCapacity(t, 499);
  const member = { _id: "member-id", username: "member" };

  await assert.rejects(
    bulkCreateInvitationGuests(member, "invitation-id", { names: "Ibu Sari\nPak Budi" }),
    { statusCode: 409 }
  );
  assert.equal(capacity.create.mock.callCount(), 0);
  assert.equal(capacity.getCount(), 499);
});

test("deleting one guest restores a slot at the limit", async (t) => {
  const capacity = mockGuestCapacity(t, 500);
  const member = { _id: "member-id", username: "member" };
  t.mock.method(Guest, "findOne", async () => ({ _id: "old-guest" }));
  t.mock.method(Guest, "deleteOne", async () => ({ deletedCount: 1 }));
  t.mock.method(RSVP, "deleteOne", async () => ({ deletedCount: 0 }));
  t.mock.method(Wish, "updateMany", async () => ({ modifiedCount: 0 }));

  await deleteInvitationGuest(member, "invitation-id", "old-guest");
  await createInvitationGuest(member, "invitation-id", { name: "Ibu Sari" });

  assert.equal(capacity.create.mock.callCount(), 1);
  assert.equal(capacity.getCount(), 500);
});
