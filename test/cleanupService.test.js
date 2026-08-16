import assert from "node:assert/strict";
import test from "node:test";

import { buildExpiredInvitationSummary } from "../src/services/cleanupService.js";

test("builds expired invitation summary before details are removed", () => {
  const summary = buildExpiredInvitationSummary({
    groom: { fullName: "Bima" },
    bride: { fullName: "Sari" },
    events: [
      { date: new Date("2026-08-01T00:00:00.000Z") },
      { date: new Date("2026-08-03T00:00:00.000Z") }
    ],
    servicePrice: 350000,
    publishedAt: new Date("2026-07-01T00:00:00.000Z"),
    summary: {}
  });

  assert.equal(summary.groomName, "Bima");
  assert.equal(summary.brideName, "Sari");
  assert.equal(summary.latestEventDate.toISOString(), "2026-08-03T00:00:00.000Z");
  assert.equal(summary.servicePrice, 350000);
  assert.equal(summary.publishedAt.toISOString(), "2026-07-01T00:00:00.000Z");
});

test("keeps existing summary fields when cleanup runs again", () => {
  const summary = buildExpiredInvitationSummary({
    groom: { fullName: "" },
    bride: { fullName: "" },
    events: [],
    publishedAt: null,
    summary: {
      groomName: "Bima",
      brideName: "Sari",
      latestEventDate: new Date("2026-08-03T00:00:00.000Z"),
      servicePrice: 450000,
      publishedAt: new Date("2026-07-01T00:00:00.000Z")
    }
  });

  assert.equal(summary.groomName, "Bima");
  assert.equal(summary.brideName, "Sari");
  assert.equal(summary.servicePrice, 450000);
});
