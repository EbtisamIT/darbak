const mongoose = require("mongoose");
const { PACKAGE_STATUSES } = require("../services/autoApplyV1");

// One reviewable application draft per student and target (company + channel type).
// Rebuilt from its usage in autoApplyV1Routes after the original file was lost.
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true, index: true },
  targetKey: { type: String, required: true, trim: true },
  companyKey: { type: String, default: "", trim: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "companies", default: null },
  channelId: { type: mongoose.Schema.Types.ObjectId, ref: "AutoApplyEmailChannel", required: true },
  opportunityId: { type: mongoose.Schema.Types.ObjectId, ref: "opportunities", default: null },
  resumeSnapshotId: { type: mongoose.Schema.Types.ObjectId, ref: "AutoApplyResume", required: true },
  subject: { type: String, required: true, trim: true, maxlength: 300 },
  body: { type: String, required: true, trim: true, maxlength: 5000 },
  matchedFields: { type: [String], default: [] },
  matchReasons: { type: [String], default: [] },
  blockers: { type: [String], default: [] },
  eligibility: { type: String, enum: ["eligible", "needs_review", "not_eligible"], required: true },
  matchConfidence: { type: String, enum: ["high", "unknown", "low"], default: "unknown" },
  status: { type: String, enum: PACKAGE_STATUSES, default: "ready_for_review", index: true },
}, { timestamps: true });

schema.index({ userId: 1, targetKey: 1 }, { unique: true });

module.exports = mongoose.models.AutoApplyPackage || mongoose.model("AutoApplyPackage", schema);
