const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true, index: true },
  packageId: { type: mongoose.Schema.Types.ObjectId, ref: "AutoApplyPackage", required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, default: null },
  opportunityId: { type: mongoose.Schema.Types.ObjectId, default: null },
  channelId: { type: mongoose.Schema.Types.ObjectId, required: true },
  resumeSnapshotId: { type: mongoose.Schema.Types.ObjectId, ref: "AutoApplyResume", required: true },
  originalTargetEmail: { type: String, required: true, lowercase: true, trim: true },
  actualRecipient: { type: String, required: true, lowercase: true, trim: true },
  senderEmail: { type: String, required: true, lowercase: true, trim: true },
  filename: { type: String, required: true, trim: true },
  resumeSha256: { type: String, required: true, trim: true },
  subjectSha256: { type: String, required: true, trim: true },
  bodySha256: { type: String, required: true, trim: true },
  status: { type: String, enum: ["pending", "accepted", "failed"], default: "pending", index: true },
  isTest: { type: Boolean, default: true, index: true },
  attemptCount: { type: Number, default: 1 },
  providerMessageId: { type: String, default: "", trim: true },
  lastErrorCode: { type: String, default: "", trim: true },
  acceptedAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false });

schema.index({ userId: 1, packageId: 1 }, { unique: true });

module.exports = mongoose.model("AutoApplySend", schema);
