import assert from "node:assert/strict";
import test from "node:test";

import mongoose from "mongoose";

import { toPublicInvitation } from "../src/services/invitationService.js";

test("formats enabled quote with Ar-Rum 21 defaults", () => {
  const publicInvitation = toPublicInvitation({
    _id: new mongoose.Types.ObjectId(),
    memberId: new mongoose.Types.ObjectId(),
    status: "draft",
    slug: "raka-amara",
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
  assert.match(publicInvitation.quote.text, /pasangan-pasangan/);
  assert.equal(publicInvitation.quote.source, "QS. Ar-Rum: 21");
});
