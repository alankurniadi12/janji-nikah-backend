import mongoose from "mongoose";

const { Schema } = mongoose;

const auditLogSchema = new Schema({
  actorId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    default: null,
    index: true
  },
  action: {
    type: String,
    required: true,
    index: true
  },
  targetType: {
    type: String,
    required: true
  },
  targetId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  before: {
    type: Schema.Types.Mixed,
    default: null
  },
  after: {
    type: Schema.Types.Mixed,
    default: null
  },
  note: {
    type: String,
    default: ""
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;
