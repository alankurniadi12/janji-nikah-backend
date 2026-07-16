import assert from "node:assert/strict";
import test from "node:test";

import { toPublicTransaction } from "../src/services/transactionService.js";

test("formats transaction for API responses", () => {
  const transaction = toPublicTransaction({
    _id: { toString: () => "transaction-id" },
    memberId: { toString: () => "member-id" },
    packageId: { toString: () => "package-id" },
    creditAmount: 1,
    baseAmount: 25000,
    uniqueCode: 163,
    totalAmount: 25163,
    paymentProofUrl: "/uploads/transactions/member-id/proofs/proof.jpg",
    status: "waiting_verification",
    adminNote: "",
    approvedBy: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    expiresAt: new Date("2026-07-17T10:00:00.000Z"),
    createdAt: new Date("2026-07-16T10:00:00.000Z"),
    updatedAt: new Date("2026-07-16T10:30:00.000Z")
  });

  assert.equal(transaction.id, "transaction-id");
  assert.equal(transaction.memberId, "member-id");
  assert.equal(transaction.totalAmount, 25163);
  assert.equal(transaction.status, "waiting_verification");
});
