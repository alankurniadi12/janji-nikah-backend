import {
  approveTransaction,
  attachPaymentProof,
  createMemberTransaction,
  getAdminTransaction,
  getMemberTransaction,
  listAdminTransactions,
  listMemberTransactions,
  processMayarWebhook,
  redeemMemberPromoCode,
  refreshMayarTransaction,
  rejectTransaction
} from "../services/transactionService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { toUploadUrl } from "../utils/fileUrl.js";

export const memberCreateTransaction = asyncHandler(async (req, res) => {
  const transaction = await createMemberTransaction(req.user, req.body.packageId, req.body.promoCode || "");

  res.status(201).json({
    success: true,
    data: {
      transaction
    }
  });
});

export const memberRedeemPromoCode = asyncHandler(async (req, res) => {
  const transaction = await redeemMemberPromoCode(req.user, req.body.promoCode);

  res.status(201).json({
    success: true,
    data: {
      transaction
    }
  });
});

export const memberTransactions = asyncHandler(async (req, res) => {
  const data = await listMemberTransactions(req.user, req.query);

  res.json({
    success: true,
    data
  });
});

export const memberTransactionDetail = asyncHandler(async (req, res) => {
  const transaction = await getMemberTransaction(req.user, req.params.id);

  res.json({
    success: true,
    data: {
      transaction
    }
  });
});

export const memberRefreshMayarTransaction = asyncHandler(async (req, res) => {
  const transaction = await refreshMayarTransaction(req.user, req.params.id);

  res.json({
    success: true,
    data: {
      transaction
    }
  });
});

export const memberUploadPaymentProof = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400).json({
      success: false,
      message: "Bukti pembayaran wajib diunggah."
    });
    return;
  }

  const transaction = await attachPaymentProof(req.user, req.params.id, toUploadUrl(req.file.path));

  res.json({
    success: true,
    data: {
      transaction
    }
  });
});

export const adminTransactions = asyncHandler(async (req, res) => {
  const data = await listAdminTransactions(req.query);

  res.json({
    success: true,
    data
  });
});

export const adminTransactionDetail = asyncHandler(async (req, res) => {
  const transaction = await getAdminTransaction(req.params.id);

  res.json({
    success: true,
    data: {
      transaction
    }
  });
});

export const adminApproveTransaction = asyncHandler(async (req, res) => {
  const transaction = await approveTransaction(req.user, req.params.id, req.body.adminNote || "");

  res.json({
    success: true,
    data: {
      transaction
    }
  });
});

export const adminRejectTransaction = asyncHandler(async (req, res) => {
  const transaction = await rejectTransaction(req.user, req.params.id, req.body.adminNote || "");

  res.json({
    success: true,
    data: {
      transaction
    }
  });
});

export const mayarWebhook = asyncHandler(async (req, res) => {
  const result = await processMayarWebhook(req.body);

  res.json({
    success: true,
    data: result
  });
});
