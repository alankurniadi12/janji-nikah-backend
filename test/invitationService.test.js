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
  const originalCountDocuments = Invitation.countDocuments;
  const originalAggregate = Invitation.aggregate;
  const calls = [];

  Invitation.countDocuments = async (query) => {
    calls.push({ countDocuments: query });
    return 25;
  };

  Invitation.find = (query) => {
    calls.push({ query });

    return {
      select(value) {
        calls.push({ select: value });
        return this;
      },
      sort(value) {
        calls.push({ sort: value });
        return this;
      },
      skip(value) {
        calls.push({ skip: value });
        return this;
      },
      limit(value) {
        calls.push({ limit: value });
        return [];
      }
    };
  };

  Invitation.aggregate = async (pipeline) => {
    calls.push({ aggregate: pipeline });
    return [{ _id: "draft", total: 3 }];
  };

  try {
    const data = await listMemberInvitations(
      { _id: new mongoose.Types.ObjectId(), username: "member" },
      { page: 2, limit: 10 }
    );

    assert.deepEqual(data.pagination, {
      page: 2,
      limit: 10,
      total: 25,
      totalPages: 3,
      hasPreviousPage: true,
      hasNextPage: true
    });
    assert.equal(data.summary.draft, 3);
  } finally {
    Invitation.find = originalFind;
    Invitation.countDocuments = originalCountDocuments;
    Invitation.aggregate = originalAggregate;
  }

  assert.deepEqual(calls.find((call) => call.sort).sort, { createdAt: -1, _id: -1 });
  assert.equal(calls.find((call) => call.skip).skip, 10);
  assert.equal(calls.find((call) => call.limit).limit, 10);
});
