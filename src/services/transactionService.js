import AuditLog from "../models/AuditLog.js";
import CreditLedger from "../models/CreditLedger.js";
import CreditPackage from "../models/CreditPackage.js";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { calculateTotalAmount, createUniquePaymentCode } from "../utils/money.js";

const TRANSACTION_EXPIRY_MS = 24 * 60 * 60 * 1000;

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
    memberId: transaction.memberId?.toString?.() || transaction.memberId,
    packageId: transaction.packageId?.toString?.() || transaction.packageId,
    creditAmount: transaction.creditAmount,
    baseAmount: transaction.baseAmount,
    uniqueCode: transaction.uniqueCode,
    totalAmount: transaction.totalAmount,
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

export async function createMemberTransaction(member, packageId) {
  if (!packageId) {
    throw new AppError(400, "Paket kredit wajib dipilih.");
  }

  const creditPackage = await CreditPackage.findOne({ _id: packageId, isActive: true });

  if (!creditPackage) {
    throw new AppError(404, "Paket kredit tidak aktif atau tidak ditemukan.");
  }

  const uniqueCode = createUniquePaymentCode();
  const transaction = await Transaction.create({
    memberId: member._id,
    packageId: creditPackage._id,
    creditAmount: creditPackage.creditAmount,
    baseAmount: creditPackage.price,
    uniqueCode,
    totalAmount: calculateTotalAmount(creditPackage.price, uniqueCode),
    status: "waiting_payment",
    expiresAt: new Date(Date.now() + TRANSACTION_EXPIRY_MS)
  });

  return toPublicTransaction(transaction);
}

export async function listMemberTransactions(member) {
  await expirePendingTransactions({ memberId: member._id });

  const transactions = await Transaction.find({ memberId: member._id }).sort({ createdAt: -1 }).lean();
  return transactions.map(toPublicTransaction);
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
  const transactions = await Transaction.find(query).sort({ createdAt: -1 }).lean();
  return transactions.map(toPublicTransaction);
}

export async function getAdminTransaction(transactionId) {
  await expirePendingTransactions({ _id: transactionId });

  const transaction = await Transaction.findById(transactionId).lean();

  if (!transaction) {
    throw new AppError(404, "Transaksi tidak ditemukan.");
  }

  return toPublicTransaction(transaction);
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

  return toPublicTransaction(approvedTransaction);
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

  return toPublicTransaction(transaction);
}
