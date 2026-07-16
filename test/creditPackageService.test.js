import assert from "node:assert/strict";
import test from "node:test";

import { toPublicCreditPackage } from "../src/services/creditPackageService.js";

test("formats credit package for API responses", () => {
  const creditPackage = toPublicCreditPackage({
    _id: { toString: () => "package-id" },
    name: "5 Kredit",
    creditAmount: 5,
    price: 120000,
    isActive: true,
    createdAt: new Date("2026-07-16T10:00:00.000Z"),
    updatedAt: new Date("2026-07-16T11:00:00.000Z")
  });

  assert.equal(creditPackage.id, "package-id");
  assert.equal(creditPackage.creditAmount, 5);
  assert.equal(creditPackage.price, 120000);
  assert.equal(creditPackage.isActive, true);
});
