import assert from "node:assert/strict";
import test from "node:test";

import mongoose from "mongoose";

import Invitation from "../src/models/Invitation.js";
import { listMemberInvitations, toPublicInvitation } from "../src/services/invitationService.js";

test("formats enabled quote with Ar-Rum 21 defaults", () => {
  const publicInvitation = toPublicInvitation({
    _id: new mongoose.Types.ObjectId(),
    memberId: new mongoose.Types.ObjectId(),
    status: "draft",
    slug: "raka-amara",
    servicePrice: 250000,
    groom: { fullName: "Raka", parentsName: "" },
    bride: { fullName: "Amara", parentsName: "" },
    events: [],
    galleryPhotoUrls: [],
    loveStory: [],
    dressCode: { enabled: false, note: "", colors: [] },
    quote: { enabled: true, text: "", source: "" },
    envelope: { isEnabled: false, methods: [] },
    summary: {}
  });

  assert.equal(publicInvitation.quote.enabled, true);
  assert.equal(publicInvitation.servicePrice, 250000);
  assert.match(publicInvitation.quote.text, /pasangan-pasangan/);
  assert.equal(publicInvitation.quote.source, "QS. Ar-Rum: 21");
});

test("lists member invitations by newest created date", async () => {
  const originalFind = Invitation.find;
  const calls = [];

  Invitation.find = (query) => {
    calls.push({ query });

    return {
      select(value) {
        calls.push({ select: value });
        return this;
      },
      sort(value) {
        calls.push({ sort: value });
        return [];
      }
    };
  };

  try {
    await listMemberInvitations({ _id: new mongoose.Types.ObjectId(), username: "member" });
  } finally {
    Invitation.find = originalFind;
  }

  assert.deepEqual(calls.find((call) => call.sort).sort, { createdAt: -1, _id: -1 });
});
