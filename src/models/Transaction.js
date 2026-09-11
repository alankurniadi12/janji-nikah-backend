import mongoose from "mongoose";

const { Schema } = mongoose;

const transactionSchema = new Schema(
  {
    memberId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    packageId: {
      type: Schema.Types.ObjectId,
      ref: "CreditPackage",
      default: null
    },
    creditAmount: {
      type: Number,
      required: true,
      min: 1
    },
    baseAmount: {
      type: Number,
      required: true,
      min: 0
    },
    uniqueCode: {
      type: Number,
      required: true,
      min: 0,
      max: 999
    },
    paymentMethod: {
      type: String,
      enum: ["manual_transfer", "promo_code", "mayar"],
      default: "manual_transfer",
      required: true,
      index: true
    },
    paymentProvider: {
      type: String,
      enum: ["manual", "promo", "mayar"],
      default: "manual",
      required: true,
      index: true
    },
    promoCode: {
      type: String,
      default: "",
      trim: true,
      uppercase: true
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },
    paymentProofUrl: {
      type: String,
      default: ""
    },
    providerPaymentId: {
      type: String,
      default: "",
      trim: true,
      index: true
    },
    providerTransactionId: {
      type: String,
      default: "",
      trim: true,
      index: true
    },
    providerCheckoutUrl: {
      type: String,
      default: "",
      trim: true
    },
    providerStatus: {
      type: String,
      default: "",
      trim: true
    },
    providerPaymentMethod: {
      type: String,
      default: "",
      trim: true
    },
    providerPaidAt: {
      type: Date,
      default: null
    },
    providerVerifiedAt: {
      type: Date,
      default: null
    },
    providerPayload: {
      type: Schema.Types.Mixed,
      default: null
    },
    status: {
      type: String,
      enum: ["waiting_payment", "waiting_verification", "success", "rejected", "expired"],
      default: "waiting_payment",
      required: true,
      index: true
    },
    adminNote: {
      type: String,
      default: ""
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    approvedAt: {
      type: Date,
      default: null
    },
    rejectedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    rejectedAt: {
      type: Date,
      default: null
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

const Transaction = mongoose.model("Transaction", transactionSchema);

export default Transaction;
