import AuditLog from "../models/AuditLog.js";
import CreditLedger from "../models/CreditLedger.js";
import CreditPackage from "../models/CreditPackage.js";
import MayarWebhookEvent from "../models/MayarWebhookEvent.js";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { createMayarPaymentRequest, getMayarTransactionDetail } from "./mayarService.js";
import { buildActivePackageQuery, expireElapsedCreditPackages } from "./creditPackageService.js";

const TRANSACTION_EXPIRY_MS = 24 * 60 * 60 * 1000;
const WEBHOOK_LEASE_MS = 5 * 60 * 1000;
const DEFAULT_TRANSACTION_PAGE = 1;
const DEFAULT_TRANSACTION_LIMIT = 10;
const MAX_TRANSACTION_LIMIT = 50;
const TRANSACTION_STATUSES = [
  "waiting_payment",
  "waiting_verification",
  "success",
  "rejected",
  "expired"
];

export async function expirePendingTransactions(filter = {}) {
  await Transaction.updateMany(
    {
      ...filter,
      status: "waiting_payment",
      expiresAt: { $lte: new Date() }
    },
    {
      $set: {
        status: "expired"
      }
    }
  );
}

export function toPublicTransaction(transaction) {
  return {
    id: transaction._id.toString(),
    memberId: toIdString(transaction.memberId),
    packageId: toIdString(transaction.packageId),
    creditAmount: transaction.creditAmount,
    baseAmount: transaction.baseAmount,
    uniqueCode: transaction.uniqueCode,
    totalAmount: transaction.totalAmount,
    paymentMethod: transaction.paymentMethod || "manual_transfer",
    paymentProvider: transaction.paymentProvider || getDefaultPaymentProvider(transaction.paymentMethod),
    promoCode: transaction.promoCode || "",
    paymentProofUrl: transaction.paymentProofUrl,
    providerPaymentId: transaction.providerPaymentId || "",
    providerTransactionId: transaction.providerTransactionId || "",
    providerCheckoutUrl: transaction.providerCheckoutUrl || "",
    providerStatus: transaction.providerStatus || "",
    providerPaymentMethod: transaction.providerPaymentMethod || "",
    providerPaidAt: transaction.providerPaidAt || null,
    providerVerifiedAt: transaction.providerVerifiedAt || null,
    status: transaction.status,
    adminNote: transaction.adminNote,
    approvedBy: transaction.approvedBy?.toString?.() || null,
    approvedAt: transaction.approvedAt,
    rejectedBy: transaction.rejectedBy?.toString?.() || null,
    rejectedAt: transaction.rejectedAt,
    expiresAt: transaction.expiresAt,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt
  };
}

export function toPublicAdminTransaction(transaction) {
  const member = transaction.memberId && typeof transaction.memberId === "object" ? transaction.memberId : null;
  const creditPackage = transaction.packageId && typeof transaction.packageId === "object" ? transaction.packageId : null;

  return {
    ...toPublicTransaction(transaction),
    member: member
      ? {
          id: member._id.toString(),
          name: member.name,
          email: member.email,
          username: member.username,
          status: member.status,
          creditBalance: member.creditBalance
        }
      : null,
    package: creditPackage
      ? {
          id: creditPackage._id.toString(),
          name: creditPackage.name,
          creditAmount: creditPackage.creditAmount,
          price: creditPackage.price,
          isActive: creditPackage.isActive,
          promoCode: creditPackage.promoCode || "",
          startsAt: creditPackage.startsAt,
          endsAt: creditPackage.endsAt
        }
      : null
  };
}

export async function createMemberTransaction(member, packageId, promoCode = "") {
  if (!packageId) {
    throw new AppError(400, "Paket kredit wajib dipilih.");
  }

  await expireElapsedCreditPackages();

  const creditPackage = await CreditPackage.findOne({
    _id: packageId,
    ...buildActivePackageQuery(new Date())
  });

  if (!creditPackage) {
    throw new AppError(404, "Paket kredit tidak aktif, belum mulai, sudah berakhir, atau tidak ditemukan.");
  }

  if (creditPackage.promoCode && normalizePromoCode(promoCode) !== creditPackage.promoCode) {
    throw new AppError(400, "Kode promo wajib diisi dan harus sesuai paket yang dipilih.");
  }

  if (creditPackage.price <= 0 && creditPackage.promoCode) {
    throw new AppError(409, "Paket promo gratis wajib diklaim dengan kode promo.");
  }

  if (creditPackage.price <= 0) {
    throw new AppError(409, "Paket gratis wajib memakai kode promo.");
  }

  const expiresAt = new Date(Date.now() + TRANSACTION_EXPIRY_MS);
  const transaction = new Transaction({
    memberId: member._id,
    packageId: creditPackage._id,
    creditAmount: creditPackage.creditAmount,
    baseAmount: creditPackage.price,
    uniqueCode: 0,
    totalAmount: creditPackage.price,
    paymentMethod: "mayar",
    paymentProvider: "mayar",
    promoCode: creditPackage.promoCode || "",
    status: "waiting_payment",
    expiresAt
  });
  const paymentRequest = await createMayarPaymentRequest({
    name: `Janji Nikah - ${creditPackage.name}`,
    amount: creditPackage.price,
    email: member.email,
    description: `${creditPackage.creditAmount} kredit Janji Nikah`,
    notes: `Transaksi ${transaction._id.toString()}`,
    redirectUrl: `${env.appUrl}/app/transactions/${transaction._id.toString()}`,
    expiredAt: expiresAt.toISOString(),
    extraData: {
      app: "janji-nikah",
      transactionId: transaction._id.toString(),
      memberId: member._id.toString(),
      packageId: creditPackage._id.toString(),
      creditAmount: creditPackage.creditAmount
    }
  });

  transaction.providerPaymentId = paymentRequest.id || "";
  transaction.providerTransactionId = paymentRequest.transactionId || "";
  transaction.providerCheckoutUrl = paymentRequest.link || "";
  transaction.providerStatus = "created";
  transaction.providerPayload = sanitizeProviderPayload(paymentRequest);
  await transaction.save();

  return toPublicTransaction(transaction);
}

export async function redeemMemberPromoCode(member, promoCode) {
  const normalizedPromoCode = normalizePromoCode(promoCode);

  if (!normalizedPromoCode) {
    throw new AppError(400, "Kode promo wajib diisi.");
  }

  await expireElapsedCreditPackages();

  const creditPackage = await CreditPackage.findOne({
    promoCode: normalizedPromoCode,
    ...buildActivePackageQuery(new Date())
  });

  if (!creditPackage) {
    throw new AppError(404, "Kode promo tidak valid, belum mulai, sudah berakhir, atau tidak aktif.");
  }

  if (creditPackage.price > 0) {
    throw new AppError(409, "Kode promo ini masih membutuhkan pembayaran manual.");
  }

  const alreadyRedeemed = await Transaction.exists({
    memberId: member._id,
    packageId: creditPackage._id,
    paymentMethod: "promo_code",
    status: "success"
  });

  if (alreadyRedeemed) {
    throw new AppError(409, "Kode promo ini sudah pernah diklaim oleh akun kamu.");
  }

  const creditedMember = await User.findByIdAndUpdate(
    member._id,
    { $inc: { creditBalance: creditPackage.creditAmount } },
    { new: true }
  );

  if (!creditedMember) {
    throw new AppError(404, "Member tidak ditemukan.");
  }

  const transaction = await Transaction.create({
    memberId: member._id,
    packageId: creditPackage._id,
    creditAmount: creditPackage.creditAmount,
    baseAmount: 0,
    uniqueCode: 0,
    totalAmount: 0,
    paymentMethod: "promo_code",
    paymentProvider: "promo",
    promoCode: normalizedPromoCode,
    status: "success",
    adminNote: `Klaim kode promo ${normalizedPromoCode}.`,
    approvedAt: new Date(),
    expiresAt: new Date()
  });

  await CreditLedger.create({
    memberId: member._id,
    type: "purchase",
    amount: creditPackage.creditAmount,
    balanceAfter: creditedMember.creditBalance,
    referenceType: "transaction",
    referenceId: transaction._id,
    note: `Klaim kode promo ${normalizedPromoCode}.`,
    createdBy: member._id
  });

  return toPublicTransaction(transaction);
}

export async function listMemberTransactions(member, params = {}) {
  await expirePendingTransactions({ memberId: member._id });

  const requestedPage = normalizePositiveInteger(params.page, DEFAULT_TRANSACTION_PAGE);
  const limit = Math.min(normalizePositiveInteger(params.limit, DEFAULT_TRANSACTION_LIMIT), MAX_TRANSACTION_LIMIT);
  const query = buildMemberTransactionListQuery(member, params);
  const total = await Transaction.countDocuments(query);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(requestedPage, totalPages);
  const skip = (page - 1) * limit;
  const [transactions, summary] = await Promise.all([
    Transaction.find(query).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    getMemberTransactionSummary(member._id)
  ]);

  return {
    transactions: transactions.map(toPublicTransaction),
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages
    },
    summary
  };
}

export async function getMemberTransaction(member, transactionId) {
  await expirePendingTransactions({ _id: transactionId, memberId: member._id });

  const transaction = await Transaction.findOne({ _id: transactionId, memberId: member._id }).lean();

  if (!transaction) {
    throw new AppError(404, "Transaksi tidak ditemukan.");
  }

  return toPublicTransaction(transaction);
}

export async function attachPaymentProof(member, transactionId, paymentProofUrl) {
  const transaction = await Transaction.findOne({ _id: transactionId, memberId: member._id });

  if (!transaction) {
    throw new AppError(404, "Transaksi tidak ditemukan.");
  }

  if (transaction.paymentMethod !== "manual_transfer") {
    throw new AppError(409, "Upload bukti transfer hanya tersedia untuk transaksi manual.");
  }

  if (transaction.status !== "waiting_payment") {
    throw new AppError(409, "Bukti pembayaran hanya bisa diunggah untuk transaksi manual yang menunggu pembayaran.");
  }

  if (transaction.expiresAt <= new Date()) {
    transaction.status = "expired";
    await transaction.save();
    throw new AppError(409, "Transaksi sudah kedaluwarsa.");
  }

  transaction.paymentProofUrl = paymentProofUrl;
  transaction.status = "waiting_verification";
  await transaction.save();

  return toPublicTransaction(transaction);
}

export async function listAdminTransactions(params = {}) {
  await expirePendingTransactions();

  const requestedPage = normalizePositiveInteger(params.page, DEFAULT_TRANSACTION_PAGE);
  const limit = Math.min(normalizePositiveInteger(params.limit, DEFAULT_TRANSACTION_LIMIT), MAX_TRANSACTION_LIMIT);
  const query = await buildAdminTransactionListQuery(params);
  const summaryQuery = await buildAdminTransactionListQuery({ ...params, status: "" });
  const total = await Transaction.countDocuments(query);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(requestedPage, totalPages);
  const skip = (page - 1) * limit;
  const [transactions, summary] = await Promise.all([
    Transaction.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .populate("memberId", "name email username status creditBalance")
      .populate("packageId", "name creditAmount price isActive promoCode startsAt endsAt")
      .lean(),
    getTransactionSummary(summaryQuery)
  ]);

  return {
    transactions: transactions.map(toPublicAdminTransaction),
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages
    },
    summary
  };
}

export async function getAdminTransaction(transactionId) {
  await expirePendingTransactions({ _id: transactionId });

  const transaction = await Transaction.findById(transactionId)
    .populate("memberId", "name email username status creditBalance")
    .populate("packageId", "name creditAmount price isActive promoCode startsAt endsAt")
    .lean();

  if (!transaction) {
    throw new AppError(404, "Transaksi tidak ditemukan.");
  }

  return toPublicAdminTransaction(transaction);
}

export async function approveTransaction(admin, transactionId, note = "") {
  const before = await Transaction.findById(transactionId).lean();

  if (!before) {
    throw new AppError(404, "Transaksi tidak ditemukan.");
  }

  if (before.paymentMethod !== "manual_transfer") {
    throw new AppError(409, "Transaksi Mayar diproses otomatis lewat webhook.");
  }

  if (before.status !== "waiting_verification") {
    throw new AppError(409, "Hanya transaksi manual menunggu verifikasi yang bisa diapprove.");
  }

  const approvedTransaction = await Transaction.findOneAndUpdate(
    { _id: transactionId, status: "waiting_verification" },
    {
      $set: {
        status: "success",
        adminNote: note,
        approvedBy: admin._id,
        approvedAt: new Date()
      }
    },
    { new: true }
  );

  if (!approvedTransaction) {
    throw new AppError(409, "Transaksi sudah diproses.");
  }

  const member = await User.findByIdAndUpdate(
    approvedTransaction.memberId,
    { $inc: { creditBalance: approvedTransaction.creditAmount } },
    { new: true }
  );

  if (!member) {
    throw new AppError(404, "Member tidak ditemukan.");
  }

  await CreditLedger.create({
    memberId: member._id,
    type: "purchase",
    amount: approvedTransaction.creditAmount,
    balanceAfter: member.creditBalance,
    referenceType: "transaction",
    referenceId: approvedTransaction._id,
    note: note || "Pembelian kredit disetujui admin.",
    createdBy: admin._id
  });

  await AuditLog.create({
    actorId: admin._id,
    action: "transaction.approved",
    targetType: "Transaction",
    targetId: approvedTransaction._id,
    before,
    after: approvedTransaction.toObject(),
    note
  });

  return getAdminTransaction(approvedTransaction._id);
}

export async function rejectTransaction(admin, transactionId, note = "") {
  if (!note.trim()) {
    throw new AppError(400, "Catatan penolakan wajib diisi.");
  }

  const transaction = await Transaction.findById(transactionId);

  if (!transaction) {
    throw new AppError(404, "Transaksi tidak ditemukan.");
  }

  if (transaction.paymentMethod !== "manual_transfer") {
    throw new AppError(409, "Transaksi Mayar diproses otomatis lewat webhook.");
  }

  if (transaction.status !== "waiting_verification") {
    throw new AppError(409, "Hanya transaksi manual menunggu verifikasi yang bisa ditolak.");
  }

  const before = transaction.toObject();
  transaction.status = "rejected";
  transaction.adminNote = note;
  transaction.rejectedBy = admin._id;
  transaction.rejectedAt = new Date();
  await transaction.save();

  await AuditLog.create({
    actorId: admin._id,
    action: "transaction.rejected",
    targetType: "Transaction",
    targetId: transaction._id,
    before,
    after: transaction.toObject(),
    note
  });

  return getAdminTransaction(transaction._id);
}

export async function processMayarWebhook(payload = {}) {
  const eventType = typeof payload.event === "string" ? payload.event : "";

  if (eventType !== "payment.received") {
    return { processed: false, reason: "ignored_event" };
  }

  const providerTransactionId = getMayarWebhookTransactionId(payload);

  if (!providerTransactionId) {
    return { processed: false, reason: "missing_transaction_id" };
  }

  const localTransaction = await Transaction.findOne({
    providerTransactionId,
    paymentMethod: "mayar"
  })
    .select("_id status")
    .lean();

  if (!localTransaction) {
    return { processed: false, reason: "unknown_transaction" };
  }

  if (localTransaction.status === "success") {
    return { processed: false, reason: "already_success" };
  }

  const claim = await claimMayarWebhookEvent(providerTransactionId, eventType);

  if (!claim.claimed) {
    return { processed: false, reason: claim.reason };
  }

  try {
    const providerTransaction = await getMayarTransactionDetail(providerTransactionId);
    const result = await fulfillMayarTransaction(providerTransaction, payload);
    await completeMayarWebhookEvent(providerTransactionId);
    return result;
  } catch (error) {
    await failMayarWebhookEvent(providerTransactionId, error);
    throw error;
  }
}

export async function refreshMayarTransaction(member, transactionId) {
  const transaction = await Transaction.findOne({
    _id: transactionId,
    memberId: member._id,
    paymentMethod: "mayar"
  });

  if (!transaction) {
    throw new AppError(404, "Transaksi Mayar tidak ditemukan.");
  }

  if (transaction.status === "success") {
    return toPublicTransaction(transaction);
  }

  if (!transaction.providerTransactionId) {
    throw new AppError(409, "Transaksi Mayar belum memiliki ID pembayaran.");
  }

  const providerTransaction = await getMayarTransactionDetail(transaction.providerTransactionId);

  if (providerTransaction.status !== "paid") {
    await updateMayarPendingStatus(transaction, providerTransaction);
    return toPublicTransaction(transaction);
  }

  await fulfillMayarTransaction(providerTransaction, { event: "manual.refresh" });
  return getMemberTransaction(member, transactionId);
}

function toIdString(value) {
  if (!value) {
    return null;
  }

  if (value._id) {
    return value._id.toString();
  }

  if (typeof value.toString === "function" && value.toString !== Object.prototype.toString) {
    return value.toString();
  }

  return value;
}

function getDefaultPaymentProvider(paymentMethod) {
  if (paymentMethod === "promo_code") return "promo";
  if (paymentMethod === "mayar") return "mayar";
  return "manual";
}

function normalizePromoCode(value) {
  return String(value || "").trim().toUpperCase();
}

function buildMemberTransactionListQuery(member, params = {}) {
  const query = { memberId: member._id };

  if (TRANSACTION_STATUSES.includes(params.status)) {
    query.status = params.status;
  }

  return query;
}

async function buildAdminTransactionListQuery(params = {}) {
  const query = {};
  const createdAtRange = buildCreatedAtRange(params);
  const searchConditions = await buildAdminTransactionSearchConditions(params.q);

  if (TRANSACTION_STATUSES.includes(params.status)) {
    query.status = params.status;
  }

  if (createdAtRange) {
    query.createdAt = createdAtRange;
  }

  if (searchConditions.length) {
    query.$or = searchConditions;
  }

  return query;
}

function normalizePositiveInteger(value, fallback) {
  const number = Number(value);

  if (!Number.isInteger(number) || number < 1) {
    return fallback;
  }

  return number;
}

async function getMemberTransactionSummary(memberId) {
  return getTransactionSummary({ memberId });
}

async function buildAdminTransactionSearchConditions(value) {
  const query = cleanText(value);

  if (!query) {
    return [];
  }

  const searchRegex = buildSearchRegex(query);
  const [members, packages] = await Promise.all([
    User.find({
      role: "member",
      $or: [
        { name: searchRegex },
        { email: searchRegex },
        { username: searchRegex }
      ]
    })
      .select("_id")
      .lean(),
    CreditPackage.find({
      $or: [
        { name: searchRegex },
        { promoCode: searchRegex }
      ]
    })
      .select("_id")
      .lean()
  ]);
  const conditions = [
    { promoCode: searchRegex },
    { adminNote: searchRegex }
  ];
  const digitsOnlyQuery = query.replace(/\D/g, "");
  const numericQuery = Number(digitsOnlyQuery);

  if (members.length) {
    conditions.push({ memberId: { $in: members.map((member) => member._id) } });
  }

  if (packages.length) {
    conditions.push({ packageId: { $in: packages.map((creditPackage) => creditPackage._id) } });
  }

  if (/^[0-9a-f]{24}$/i.test(query)) {
    conditions.push({ _id: query });
  }

  if (digitsOnlyQuery && Number.isInteger(numericQuery) && numericQuery >= 0) {
    conditions.push({ totalAmount: numericQuery }, { uniqueCode: numericQuery });
  }

  return conditions;
}

function buildCreatedAtRange({ dateMode, date, month } = {}) {
  if (dateMode === "date" && isDateInput(date)) {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { $gte: start, $lt: end };
  }

  if (dateMode === "month" && isMonthInput(month)) {
    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    return { $gte: start, $lt: end };
  }

  return null;
}

function buildSearchRegex(value) {
  return new RegExp(escapeRegex(value), "i");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isDateInput(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isMonthInput(value) {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value);
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function getTransactionSummary(match = {}) {
  const rows = await Transaction.aggregate([
    { $match: match },
    { $group: { _id: "$status", total: { $sum: 1 } } }
  ]);
  const summary = {
    total: 0,
    waiting_payment: 0,
    waiting_verification: 0,
    success: 0,
    rejected: 0,
    expired: 0
  };

  rows.forEach((row) => {
    if (Object.prototype.hasOwnProperty.call(summary, row._id)) {
      summary[row._id] = row.total;
    }
    summary.total += row.total;
  });

  return summary;
}

function sanitizeProviderPayload(payload = {}) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  return JSON.parse(JSON.stringify(payload));
}

function getMayarWebhookTransactionId(payload = {}) {
  const data = payload.data && typeof payload.data === "object" ? payload.data : {};
  const candidates = [
    data.transactionId,
    data.paymentLinkTransactionId
  ];
  const value = candidates.find((candidate) => typeof candidate === "string" && candidate.trim());
  return value ? value.trim() : "";
}

async function claimMayarWebhookEvent(providerTransactionId, eventType) {
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + WEBHOOK_LEASE_MS);
  const event = await MayarWebhookEvent.findOneAndUpdate(
    {
      providerTransactionId,
      $or: [
        { status: "failed" },
        { status: "processing", lockedUntil: { $lte: now } }
      ]
    },
    {
      $set: {
        eventType,
        status: "processing",
        lockedUntil,
        lastError: ""
      },
      $inc: {
        attemptCount: 1
      },
      $setOnInsert: {
        providerTransactionId
      }
    },
    {
      new: true
    }
  );

  if (event) {
    return { claimed: true };
  }

  const existing = await MayarWebhookEvent.findOne({ providerTransactionId }).lean();

  if (existing?.status === "completed") {
    return { claimed: false, reason: "already_completed" };
  }

  if (existing?.status === "processing" && existing.lockedUntil > now) {
    return { claimed: false, reason: "already_processing" };
  }

  try {
    await MayarWebhookEvent.create({
      providerTransactionId,
      eventType,
      status: "processing",
      attemptCount: 1,
      lockedUntil
    });
  } catch (error) {
    if (error?.code === 11000) {
      return { claimed: false, reason: "already_processing" };
    }

    throw error;
  }

  return { claimed: true };
}

async function completeMayarWebhookEvent(providerTransactionId) {
  await MayarWebhookEvent.updateOne(
    { providerTransactionId },
    {
      $set: {
        status: "completed",
        lockedUntil: null,
        completedAt: new Date(),
        lastError: ""
      }
    }
  );
}

async function failMayarWebhookEvent(providerTransactionId, error) {
  await MayarWebhookEvent.updateOne(
    { providerTransactionId },
    {
      $set: {
        status: "failed",
        lockedUntil: null,
        lastError: error?.message || "Webhook Mayar gagal diproses."
      }
    }
  );
}

async function fulfillMayarTransaction(providerTransaction, sourcePayload = {}) {
  if (!providerTransaction?.id) {
    throw new AppError(400, "Payload transaksi Mayar tidak valid.");
  }

  if (providerTransaction.status !== "paid") {
    return { processed: false, reason: "not_paid" };
  }

  const before = await Transaction.findOne({
    providerTransactionId: providerTransaction.id,
    paymentMethod: "mayar"
  }).lean();

  if (!before) {
    throw new AppError(404, "Transaksi lokal untuk pembayaran Mayar tidak ditemukan.");
  }

  if (before.totalAmount !== providerTransaction.amount) {
    throw new AppError(409, "Nominal pembayaran Mayar tidak sesuai transaksi lokal.");
  }

  if (before.status === "success") {
    return { processed: false, reason: "already_success" };
  }

  if (before.status !== "waiting_payment") {
    throw new AppError(409, "Transaksi lokal Mayar sudah tidak bisa diproses.");
  }

  const providerVerifiedAt = new Date();
  const approvedTransaction = await Transaction.findOneAndUpdate(
    {
      _id: before._id,
      providerTransactionId: providerTransaction.id,
      paymentMethod: "mayar",
      status: "waiting_payment"
    },
    {
      $set: {
        status: "success",
        approvedAt: providerVerifiedAt,
        providerStatus: providerTransaction.status,
        providerPaymentMethod: providerTransaction.paymentMethod || "",
        providerPaidAt: providerTransaction.updatedAt ? new Date(providerTransaction.updatedAt) : providerVerifiedAt,
        providerVerifiedAt,
        providerPayload: sanitizeProviderPayload({
          transaction: providerTransaction,
          webhookEvent: sourcePayload?.event || ""
        }),
        adminNote: "Pembayaran Mayar terverifikasi otomatis."
      }
    },
    { new: true }
  );

  if (!approvedTransaction) {
    return { processed: false, reason: "already_processed" };
  }

  const member = await User.findByIdAndUpdate(
    approvedTransaction.memberId,
    { $inc: { creditBalance: approvedTransaction.creditAmount } },
    { new: true }
  );

  if (!member) {
    throw new AppError(404, "Member tidak ditemukan.");
  }

  await CreditLedger.create({
    memberId: member._id,
    type: "purchase",
    amount: approvedTransaction.creditAmount,
    balanceAfter: member.creditBalance,
    referenceType: "transaction",
    referenceId: approvedTransaction._id,
    note: "Pembelian kredit terverifikasi otomatis oleh Mayar.",
    createdBy: member._id
  });

  await AuditLog.create({
    actorId: null,
    action: "transaction.mayar_paid",
    targetType: "Transaction",
    targetId: approvedTransaction._id,
    before,
    after: approvedTransaction.toObject(),
    note: "Pembayaran Mayar terverifikasi otomatis."
  });

  return { processed: true, transactionId: approvedTransaction._id.toString() };
}

async function updateMayarPendingStatus(transaction, providerTransaction) {
  transaction.providerStatus = providerTransaction.status || transaction.providerStatus;
  transaction.providerPaymentMethod = providerTransaction.paymentMethod || transaction.providerPaymentMethod;
  transaction.providerVerifiedAt = new Date();
  transaction.providerPayload = sanitizeProviderPayload({ transaction: providerTransaction });

  if (providerTransaction.status === "expired") {
    transaction.status = "expired";
  }

  await transaction.save();
}
