import mongoose from "mongoose";

const { Schema } = mongoose;

const rsvpSchema = new Schema(
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
      unique: true,
      index: true
    },
    status: {
      type: String,
      enum: ["attending", "not_attending"],
      required: true
    }
  },
  {
    timestamps: true
  }
);

const RSVP = mongoose.model("RSVP", rsvpSchema);

export default RSVP;
