import AuditLog from "../models/AuditLog.js";
import CreditLedger from "../models/CreditLedger.js";
import CreditPackage from "../models/CreditPackage.js";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { calculateTotalAmount, createUniquePaymentCode } from "../utils/money.js";
import { buildActivePackageQuery, expireElapsedCreditPackages } from "./creditPackageService.js";

const TRANSACTION_EXPIRY_MS = 24 * 60 * 60 * 1000;
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
    promoCode: transaction.promoCode || "",
    paymentProofUrl: transaction.paymentProofUrl,
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

  const uniqueCode = createUniquePaymentCode();
  const transaction = await Transaction.create({
    memberId: member._id,
    packageId: creditPackage._id,
    creditAmount: creditPackage.creditAmount,
    baseAmount: creditPackage.price,
    uniqueCode,
    totalAmount: calculateTotalAmount(creditPackage.price, uniqueCode),
    paymentMethod: "manual_transfer",
    promoCode: creditPackage.promoCode || "",
    status: "waiting_payment",
    expiresAt: new Date(Date.now() + TRANSACTION_EXPIRY_MS)
  });

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

  if (transaction.status !== "waiting_payment") {
    throw new AppError(409, "Bukti pembayaran hanya bisa diunggah untuk transaksi menunggu pembayaran.");
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

export async function listAdminTransactions({ status } = {}) {
  await expirePendingTransactions();

  const query = status ? { status } : {};
  const transactions = await Transaction.find(query)
    .sort({ createdAt: -1 })
    .populate("memberId", "name email username status creditBalance")
    .populate("packageId", "name creditAmount price isActive promoCode startsAt endsAt")
    .lean();
  return transactions.map(toPublicAdminTransaction);
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

  if (before.status !== "waiting_verification") {
    throw new AppError(409, "Hanya transaksi menunggu verifikasi yang bisa diapprove.");
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

  if (transaction.status !== "waiting_verification") {
    throw new AppError(409, "Hanya transaksi menunggu verifikasi yang bisa ditolak.");
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

function normalizePositiveInteger(value, fallback) {
  const number = Number(value);

  if (!Number.isInteger(number) || number < 1) {
    return fallback;
  }

  return number;
}

async function getMemberTransactionSummary(memberId) {
  const rows = await Transaction.aggregate([
    { $match: { memberId } },
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
