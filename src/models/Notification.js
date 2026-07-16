import mongoose from "mongoose";

const { Schema } = mongoose;

const notificationSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    default: null,
    index: true
  },
  roleTarget: {
    type: String,
    enum: ["admin", "member"],
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    trim: true
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: {
    type: Date,
    default: null
  },
  referenceType: {
    type: String,
    default: ""
  },
  referenceId: {
    type: Schema.Types.ObjectId,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
