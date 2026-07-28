import mongoose from "mongoose";

const { Schema } = mongoose;

const wishSchema = new Schema(
  {
    invitationId: {
      type: Schema.Types.ObjectId,
      ref: "Invitation",
      required: true,
      index: true
    },
    guestId: {
      type: Schema.Types.ObjectId,
      ref: "Guest",
      required: true,
      index: true
    },
    displayName: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    rsvpStatus: {
      type: String,
      enum: ["attending", "not_attending", null],
      default: null
    },
    isHidden: {
      type: Boolean,
      default: false,
      index: true
    },
    hiddenAt: {
      type: Date,
      default: null
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

const Wish = mongoose.model("Wish", wishSchema);

export default Wish;
