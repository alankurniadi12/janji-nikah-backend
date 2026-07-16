import mongoose from "mongoose";

const { Schema } = mongoose;

const creditLedgerSchema = new Schema({
  memberId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ["purchase", "publish", "manual_adjustment"],
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true
  },
  balanceAfter: {
    type: Number,
    required: true,
    min: 0
  },
  referenceType: {
    type: String,
    enum: ["transaction", "invitation", "admin_action"],
    required: true
  },
  referenceId: {
    type: Schema.Types.ObjectId,
    required: true
  },
  note: {
    type: String,
    default: ""
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

const CreditLedger = mongoose.model("CreditLedger", creditLedgerSchema);

export default CreditLedger;
