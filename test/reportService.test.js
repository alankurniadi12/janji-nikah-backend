import assert from "node:assert/strict";
import test from "node:test";

import { createDateRangeFilter } from "../src/services/reportService.js";

test("creates date range filter for reports", () => {
  const filter = createDateRangeFilter(
    {
      startDate: "2026-07-01T00:00:00.000Z",
      endDate: "2026-07-31T23:59:59.999Z"
    },
    "approvedAt"
  );

  assert.equal(filter.approvedAt.$gte.toISOString(), "2026-07-01T00:00:00.000Z");
  assert.equal(filter.approvedAt.$lte.toISOString(), "2026-07-31T23:59:59.999Z");
});

test("ignores invalid report dates", () => {
  const filter = createDateRangeFilter({ startDate: "bukan-tanggal" }, "createdAt");

  assert.deepEqual(filter, {});
});
