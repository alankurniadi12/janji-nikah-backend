import mongoose from "mongoose";

const { Schema } = mongoose;

const guestSchema = new Schema(
  {
    invitationId: {
      type: Schema.Types.ObjectId,
      ref: "Invitation",
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    sentStatus: {
      type: String,
      enum: ["not_sent", "sent"],
      default: "not_sent",
      required: true
    },
    sentAt: {
      type: Date,
      default: null
    },
    openedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

const Guest = mongoose.model("Guest", guestSchema);

export default Guest;
