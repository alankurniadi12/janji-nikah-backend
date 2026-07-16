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
      min: 100,
      max: 999
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
