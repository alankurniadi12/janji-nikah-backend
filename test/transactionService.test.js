import assert from "node:assert/strict";
import test from "node:test";

import Transaction from "../src/models/Transaction.js";
import { listAdminTransactions, listMemberTransactions, toPublicTransaction } from "../src/services/transactionService.js";

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

test("lists member transactions with pagination and status filter", async () => {
  const originalUpdateMany = Transaction.updateMany;
  const originalCountDocuments = Transaction.countDocuments;
  const originalFind = Transaction.find;
  const originalAggregate = Transaction.aggregate;
  const calls = [];

  Transaction.updateMany = async (query) => {
    calls.push({ updateMany: query });
  };

  Transaction.countDocuments = async (query) => {
    calls.push({ countDocuments: query });
    return 21;
  };

  Transaction.find = (query) => {
    calls.push({ query });

    return {
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
        return this;
      },
      lean() {
        calls.push({ lean: true });
        return [];
      }
    };
  };

  Transaction.aggregate = async (pipeline) => {
    calls.push({ aggregate: pipeline });
    return [{ _id: "success", total: 8 }];
  };

  try {
    const member = { _id: "member-id" };
    const data = await listMemberTransactions(member, { page: 2, limit: 10, status: "success" });

    assert.deepEqual(data.pagination, {
      page: 2,
      limit: 10,
      total: 21,
      totalPages: 3,
      hasPreviousPage: true,
      hasNextPage: true
    });
    assert.equal(data.summary.success, 8);
  } finally {
    Transaction.updateMany = originalUpdateMany;
    Transaction.countDocuments = originalCountDocuments;
    Transaction.find = originalFind;
    Transaction.aggregate = originalAggregate;
  }

  assert.deepEqual(calls.find((call) => call.countDocuments).countDocuments, {
    memberId: "member-id",
    status: "success"
  });
  assert.deepEqual(calls.find((call) => call.sort).sort, { createdAt: -1, _id: -1 });
  assert.equal(calls.find((call) => call.skip).skip, 10);
  assert.equal(calls.find((call) => call.limit).limit, 10);
});

test("lists admin transactions with pagination, status filter, and related summaries", async () => {
  const originalUpdateMany = Transaction.updateMany;
  const originalCountDocuments = Transaction.countDocuments;
  const originalFind = Transaction.find;
  const originalAggregate = Transaction.aggregate;
  const calls = [];

  Transaction.updateMany = async (query) => {
    calls.push({ updateMany: query });
  };

  Transaction.countDocuments = async (query) => {
    calls.push({ countDocuments: query });
    return 6;
  };

  Transaction.find = (query) => {
    calls.push({ query });

    return {
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
        return this;
      },
      populate(path, select) {
        calls.push({ populate: { path, select } });
        return this;
      },
      lean() {
        calls.push({ lean: true });
        return [];
      }
    };
  };

  Transaction.aggregate = async (pipeline) => {
    calls.push({ aggregate: pipeline });
    return [{ _id: "waiting_verification", total: 4 }];
  };

  try {
    const data = await listAdminTransactions({ page: 2, limit: 5, status: "waiting_verification" });

    assert.deepEqual(data.pagination, {
      page: 2,
      limit: 5,
      total: 6,
      totalPages: 2,
      hasPreviousPage: true,
      hasNextPage: false
    });
    assert.equal(data.summary.waiting_verification, 4);
  } finally {
    Transaction.updateMany = originalUpdateMany;
    Transaction.countDocuments = originalCountDocuments;
    Transaction.find = originalFind;
    Transaction.aggregate = originalAggregate;
  }

  assert.deepEqual(calls.find((call) => call.countDocuments).countDocuments, {
    status: "waiting_verification"
  });
  assert.deepEqual(calls.find((call) => call.sort).sort, { createdAt: -1, _id: -1 });
  assert.equal(calls.find((call) => call.skip).skip, 5);
  assert.equal(calls.find((call) => call.limit).limit, 5);
  assert.equal(calls.filter((call) => call.populate).length, 2);
});
