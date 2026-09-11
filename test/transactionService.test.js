import assert from "node:assert/strict";
import test from "node:test";

import CreditPackage from "../src/models/CreditPackage.js";
import Transaction from "../src/models/Transaction.js";
import User from "../src/models/User.js";
import {
  listAdminTransactions,
  listMemberTransactions,
  processMayarWebhook,
  toPublicTransaction
} from "../src/services/transactionService.js";

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

test("formats Mayar provider fields for API responses", () => {
  const transaction = toPublicTransaction({
    _id: { toString: () => "transaction-id" },
    memberId: { toString: () => "member-id" },
    packageId: { toString: () => "package-id" },
    creditAmount: 5,
    baseAmount: 100000,
    uniqueCode: 0,
    totalAmount: 100000,
    paymentMethod: "mayar",
    paymentProvider: "mayar",
    providerPaymentId: "payment-id",
    providerTransactionId: "provider-transaction-id",
    providerCheckoutUrl: "https://checkout.example",
    providerStatus: "created",
    providerPaymentMethod: "",
    providerPaidAt: null,
    providerVerifiedAt: null,
    paymentProofUrl: "",
    status: "waiting_payment",
    adminNote: "",
    approvedBy: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    expiresAt: new Date("2026-07-17T10:00:00.000Z"),
    createdAt: new Date("2026-07-16T10:00:00.000Z"),
    updatedAt: new Date("2026-07-16T10:30:00.000Z")
  });

  assert.equal(transaction.paymentMethod, "mayar");
  assert.equal(transaction.paymentProvider, "mayar");
  assert.equal(transaction.providerCheckoutUrl, "https://checkout.example");
  assert.equal(transaction.providerTransactionId, "provider-transaction-id");
});

test("ignores Mayar payment webhook without verified transaction id", async () => {
  const result = await processMayarWebhook({
    event: "payment.received",
    data: {
      id: "webhook-id-only",
      status: "SUCCESS"
    }
  });

  assert.deepEqual(result, { processed: false, reason: "missing_transaction_id" });
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

test("filters admin transactions by search query and created date", async () => {
  const originalUpdateMany = Transaction.updateMany;
  const originalCountDocuments = Transaction.countDocuments;
  const originalFind = Transaction.find;
  const originalAggregate = Transaction.aggregate;
  const originalUserFind = User.find;
  const originalPackageFind = CreditPackage.find;
  const calls = [];

  Transaction.updateMany = async (query) => {
    calls.push({ updateMany: query });
  };

  Transaction.countDocuments = async (query) => {
    calls.push({ countDocuments: query });
    return 1;
  };

  Transaction.find = (query) => {
    calls.push({ query });

    return {
      sort() {
        return this;
      },
      skip() {
        return this;
      },
      limit() {
        return this;
      },
      populate() {
        return this;
      },
      lean() {
        return [];
      }
    };
  };

  Transaction.aggregate = async (pipeline) => {
    calls.push({ aggregate: pipeline });
    return [];
  };

  User.find = (query) => ({
    select(value) {
      calls.push({ userFind: query, userSelect: value });
      return this;
    },
    lean() {
      return [{ _id: "member-id" }];
    }
  });

  CreditPackage.find = (query) => ({
    select(value) {
      calls.push({ packageFind: query, packageSelect: value });
      return this;
    },
    lean() {
      return [{ _id: "package-id" }];
    }
  });

  try {
    await listAdminTransactions({
      page: 1,
      limit: 10,
      status: "waiting_verification",
      q: "raini",
      dateMode: "date",
      date: "2026-08-17"
    });
  } finally {
    Transaction.updateMany = originalUpdateMany;
    Transaction.countDocuments = originalCountDocuments;
    Transaction.find = originalFind;
    Transaction.aggregate = originalAggregate;
    User.find = originalUserFind;
    CreditPackage.find = originalPackageFind;
  }

  const query = calls.find((call) => call.countDocuments).countDocuments;

  assert.equal(query.status, "waiting_verification");
  assert.deepEqual(query.createdAt, {
    $gte: new Date("2026-08-17T00:00:00.000Z"),
    $lt: new Date("2026-08-18T00:00:00.000Z")
  });
  assert.ok(query.$or.some((condition) => condition.memberId));
  assert.ok(query.$or.some((condition) => condition.packageId));
  assert.ok(calls.find((call) => call.userFind));
  assert.ok(calls.find((call) => call.packageFind));
});
