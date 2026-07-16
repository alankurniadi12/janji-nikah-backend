import mongoose from "mongoose";

const { Schema } = mongoose;

const eventSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["akad", "resepsi"],
      required: true
    },
    date: {
      type: Date,
      required: true
    },
    startTime: {
      type: String,
      required: true
    },
    endTime: {
      type: String,
      default: ""
    },
    address: {
      type: String,
      required: true
    },
    googleMapsUrl: {
      type: String,
      default: ""
    }
  },
  { _id: false }
);

const invitationSchema = new Schema(
  {
    memberId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ["draft", "active", "locked", "expired"],
      default: "draft",
      required: true,
      index: true
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    title: {
      type: String,
      default: ""
    },
    groom: {
      fullName: { type: String, default: "" },
      parentsName: { type: String, default: "" }
    },
    bride: {
      fullName: { type: String, default: "" },
      parentsName: { type: String, default: "" }
    },
    events: {
      type: [eventSchema],
      default: []
    },
    publishedAt: {
      type: Date,
      default: null
    },
    lockedAt: {
      type: Date,
      default: null
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true
    },
    expiredAt: {
      type: Date,
      default: null
    },
    summary: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

invitationSchema.index({ memberId: 1, slug: 1 }, { unique: true });

const Invitation = mongoose.model("Invitation", invitationSchema);

export default Invitation;
