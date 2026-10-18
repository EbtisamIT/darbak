const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  experienceId: { type: mongoose.Schema.Types.ObjectId, ref: "experiences", required: true },
  campaignId: { type: String, required: true, default: "experience-reward-v1" },
  type: { type: String, required: true, default: "single_ats_resume" },
  status: { type: String, enum: ["available", "redeemed"], default: "available" },
  language: { type: String, enum: ["ar", "en", null], default: null },
  draft: { type: mongoose.Schema.Types.Mixed, default: null },
  announcementSeenAt: { type: Date, default: null },
  aiGenerationAttemptedAt: { type: Date, default: null },
  aiGeneratedAt: { type: Date, default: null },
  aiSuggestion: { type: mongoose.Schema.Types.Mixed, default: null },
  grantedAt: { type: Date, required: true, default: Date.now },
  redeemedAt: { type: Date, default: null },
  resumeSnapshotId: { type: mongoose.Schema.Types.ObjectId, default: null },
}, { timestamps: true });

schema.index({ userId: 1, campaignId: 1 }, { unique: true });
schema.index({ experienceId: 1, campaignId: 1 }, { unique: true });

module.exports = mongoose.model("ExperienceResumeReward", schema);
