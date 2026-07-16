import mongoose from "mongoose";

const { Schema } = mongoose;

const themeSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true, trim: true, lowercase: true, unique: true },
    thumbnailUrl: { type: String, default: "" },
    isActive: { type: Boolean, default: true, index: true },
    isPublicDemo: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

const Theme = mongoose.model("Theme", themeSchema);

export default Theme;
