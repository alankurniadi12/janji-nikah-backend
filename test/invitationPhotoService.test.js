import assert from "node:assert/strict";
import test from "node:test";

import { extractPhotoId } from "../src/services/invitationPhotoService.js";

test("extracts gallery photo id from upload URL", () => {
  assert.equal(
    extractPhotoId("/uploads/members/member-id/invitations/invitation-id/gallery/photo-id.webp"),
    "photo-id"
  );
});
