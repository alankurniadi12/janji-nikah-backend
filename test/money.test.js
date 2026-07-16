import assert from "node:assert/strict";
import test from "node:test";

import { calculateTotalAmount, createUniquePaymentCode } from "../src/utils/money.js";

test("creates a 3 digit payment code", () => {
  for (let index = 0; index < 50; index += 1) {
    const code = createUniquePaymentCode();

    assert.equal(Number.isInteger(code), true);
    assert.equal(code >= 100, true);
    assert.equal(code <= 999, true);
  }
});

test("calculates payment total from base amount and unique code", () => {
  assert.equal(calculateTotalAmount(25000, 163), 25163);
});
