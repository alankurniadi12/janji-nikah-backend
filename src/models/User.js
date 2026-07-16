import mongoose from "mongoose";

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    googleId: {
      type: String,
      trim: true,
      sparse: true,
      unique: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    avatarUrl: {
      type: String,
      default: ""
    },
    role: {
      type: String,
      enum: ["admin", "member"],
      default: "member",
      required: true
    },
    status: {
      type: String,
      enum: ["active", "suspended", "blocked"],
      default: "active",
      required: true
    },
    username: {
      type: String,
      lowercase: true,
      trim: true,
      sparse: true,
      unique: true
    },
    usernameHistory: {
      type: [String],
      default: []
    },
    lastUsernameChangedAt: {
      type: Date,
      default: null
    },
    termsAcceptedAt: {
      type: Date,
      default: null
    },
    creditBalance: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

userSchema.index({ usernameHistory: 1 });

const User = mongoose.model("User", userSchema);

export default User;
