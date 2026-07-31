import mongoose from "mongoose";

const { Schema } = mongoose;

const creditPackageSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    creditAmount: {
      type: Number,
      required: true,
      min: 1
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    promoCode: {
      type: String,
      default: "",
      trim: true,
      uppercase: true
    },
    startsAt: {
      type: Date,
      default: null,
      index: true
    },
    endsAt: {
      type: Date,
      default: null,
      index: true
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true
    }
  },
  {
    timestamps: true
  }
);

creditPackageSchema.index(
  { promoCode: 1 },
  {
    unique: true,
    partialFilterExpression: {
      promoCode: { $type: "string", $gt: "" },
      deletedAt: null
    }
  }
);

const CreditPackage = mongoose.model("CreditPackage", creditPackageSchema);

export default CreditPackage;
