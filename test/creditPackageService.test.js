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
    promoCode: "HEMAT",
    startsAt: new Date(Date.now() - 60_000),
    endsAt: new Date(Date.now() + 60_000),
    deletedAt: null,
    createdAt: new Date("2026-07-16T10:00:00.000Z"),
    updatedAt: new Date("2026-07-16T11:00:00.000Z")
  });

  assert.equal(creditPackage.id, "package-id");
  assert.equal(creditPackage.creditAmount, 5);
  assert.equal(creditPackage.price, 120000);
  assert.equal(creditPackage.isActive, true);
  assert.equal(creditPackage.promoCode, "HEMAT");
  assert.equal(creditPackage.isLimitedTime, true);
  assert.equal(creditPackage.isCurrentlyAvailable, true);
  assert.equal(creditPackage.availabilityStatus, "available");
  assert.ok(creditPackage.countdownEndsAt);
});

test("can hide promo code value for member package responses", () => {
  const creditPackage = toPublicCreditPackage(
    {
      _id: { toString: () => "package-id" },
      name: "Promo Gratis",
      creditAmount: 1,
      price: 0,
      isActive: true,
      promoCode: "RAHASIA",
      startsAt: null,
      endsAt: null,
      deletedAt: null,
      createdAt: new Date("2026-07-16T10:00:00.000Z"),
      updatedAt: new Date("2026-07-16T11:00:00.000Z")
    },
    { includePromoCode: false }
  );

  assert.equal(creditPackage.promoCode, "");
  assert.equal(creditPackage.hasPromoCode, true);
});
