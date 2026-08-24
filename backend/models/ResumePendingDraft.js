const mongoose = require("mongoose");

const resumePendingDraftSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      index: true,
    },
    contact: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    accessCodeHash: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    draftType: {
      type: String,
      enum: ["base_resume", "tailored_resume"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending_review", "approved", "rejected", "expired"],
      default: "pending_review",
      index: true,
    },
    draft: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
    },
    sourceMap: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    validationResult: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    agentSessionId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    baseResumeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "resume_profiles",
      default: null,
    },
    opportunityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "opportunities",
      default: null,
    },
    companyName: {
      type: String,
      default: "",
      trim: true,
    },
    roleTitle: {
      type: String,
      default: "",
      trim: true,
    },
    changesSummary: {
      type: [String],
      default: [],
    },
    applicationPack: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

resumePendingDraftSchema.index({ contact: 1, accessCodeHash: 1, createdAt: -1 });
resumePendingDraftSchema.index(
  { agentSessionId: 1, draftType: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: "pending_review",
    },
  }
);

module.exports = mongoose.model("resume_pending_drafts", resumePendingDraftSchema);
