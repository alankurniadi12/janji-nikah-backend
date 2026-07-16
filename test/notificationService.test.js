import assert from "node:assert/strict";
import test from "node:test";

import { toPublicNotification } from "../src/services/notificationService.js";

test("formats notification for API responses", () => {
  const createdAt = new Date("2026-07-16T10:00:00.000Z");
  const readAt = new Date("2026-07-16T11:00:00.000Z");

  const notification = toPublicNotification({
    _id: { toString: () => "notification-id" },
    title: "Pembayaran menunggu verifikasi",
    message: "Ada pembayaran baru yang perlu dicek.",
    type: "payment",
    isRead: true,
    readAt,
    referenceType: "transaction",
    referenceId: { toString: () => "transaction-id" },
    createdAt
  });

  assert.deepEqual(notification, {
    id: "notification-id",
    title: "Pembayaran menunggu verifikasi",
    message: "Ada pembayaran baru yang perlu dicek.",
    type: "payment",
    isRead: true,
    readAt,
    referenceType: "transaction",
    referenceId: "transaction-id",
    createdAt
  });
});
