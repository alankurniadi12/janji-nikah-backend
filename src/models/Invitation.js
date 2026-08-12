import mongoose from "mongoose";
import crypto from "node:crypto";

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

const envelopeMethodSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["bank", "ewallet"],
      required: true
    },
    providerName: {
      type: String,
      required: true,
      trim: true
    },
    accountNumber: {
      type: String,
      required: true,
      trim: true
    },
    accountHolder: {
      type: String,
      required: true,
      trim: true
    }
  },
  { _id: false }
);

const loveStoryItemSchema = new Schema(
  {
    title: {
      type: String,
      default: "",
      trim: true
    },
    date: {
      type: String,
      default: "",
      trim: true
    },
    description: {
      type: String,
      default: "",
      trim: true
    },
    photoUrl: {
      type: String,
      default: "",
      trim: true
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
      parentsName: { type: String, default: "" },
      photoUrl: { type: String, default: "" }
    },
    bride: {
      fullName: { type: String, default: "" },
      parentsName: { type: String, default: "" },
      photoUrl: { type: String, default: "" }
    },
    events: {
      type: [eventSchema],
      default: []
    },
    mainPhotoUrl: {
      type: String,
      default: ""
    },
    galleryPhotoUrls: {
      type: [String],
      default: []
    },
    loveStory: {
      type: [loveStoryItemSchema],
      default: []
    },
    dressCode: {
      enabled: { type: Boolean, default: false },
      note: { type: String, default: "", trim: true },
      colors: { type: [String], default: [] }
    },
    themeId: {
      type: Schema.Types.ObjectId,
      ref: "Theme",
      default: null
    },
    musicId: {
      type: Schema.Types.ObjectId,
      ref: "Music",
      default: null
    },
    envelope: {
      isEnabled: { type: Boolean, default: false },
      methods: { type: [envelopeMethodSchema], default: [] },
      updatedAfterLockAt: { type: Date, default: null }
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
    },
    hostAccessToken: {
      type: String,
      default: () => crypto.randomBytes(24).toString("hex"),
      select: false,
      index: true
    }
  },
  {
    timestamps: true
  }
);

invitationSchema.index({ memberId: 1, slug: 1 }, { unique: true });

const Invitation = mongoose.model("Invitation", invitationSchema);

export default Invitation;
