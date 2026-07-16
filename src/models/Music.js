import mongoose from "mongoose";

const { Schema } = mongoose;

const musicSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, default: "", trim: true },
    duration: { type: Number, default: 0, min: 0 },
    fileUrl: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true, index: true }
  },
  { timestamps: true }
);

const Music = mongoose.model("Music", musicSchema);

export default Music;
