import mongoose from "mongoose";

const { Schema } = mongoose;

const brandingProfileSchema = new Schema(
  {
    memberId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },
    businessName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },
    normalizedBusinessName: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true
    },
    instagram: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120
    },
    facebook: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120
    },
    tiktok: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120
    },
    whatsapp: {
      type: String,
      default: "",
      trim: true,
      maxlength: 30
    },
    selectedTemplate: {
      type: String,
      enum: ["elegant", "modern", "minimal"],
      default: "elegant"
    },
    promoPhotoUrl: {
      type: String,
      default: ""
    },
    promoAssets: {
      squareImageUrl: {
        type: String,
        default: ""
      },
      storyImageUrl: {
        type: String,
        default: ""
      },
      caption: {
        type: String,
        default: ""
      },
      generatedAt: {
        type: Date,
        default: null
      }
    }
  },
  {
    timestamps: true
  }
);

brandingProfileSchema.index({ normalizedBusinessName: 1, memberId: 1 });

const BrandingProfile = mongoose.model("BrandingProfile", brandingProfileSchema);

export default BrandingProfile;
