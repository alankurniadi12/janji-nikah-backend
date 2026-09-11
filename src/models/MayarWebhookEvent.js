import mongoose from "mongoose";

const { Schema } = mongoose;

const mayarWebhookEventSchema = new Schema(
  {
    providerTransactionId: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true
    },
    eventType: {
      type: String,
      default: "",
      trim: true
    },
    status: {
      type: String,
      enum: ["processing", "completed", "failed"],
      required: true,
      index: true
    },
    attemptCount: {
      type: Number,
      default: 0,
      min: 0
    },
    lastError: {
      type: String,
      default: ""
    },
    lockedUntil: {
      type: Date,
      default: null,
      index: true
    },
    completedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

const MayarWebhookEvent = mongoose.model("MayarWebhookEvent", mayarWebhookEventSchema);

export default MayarWebhookEvent;
