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
      min: 1,
      unique: true
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
    }
  },
  {
    timestamps: true
  }
);

const CreditPackage = mongoose.model("CreditPackage", creditPackageSchema);

export default CreditPackage;
