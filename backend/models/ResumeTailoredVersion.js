const mongoose = require("mongoose");

const resumeTailoredVersionSchema = new mongoose.Schema(
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
    baseResumeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "resume_profiles",
      default: null,
      index: true,
    },
    opportunityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "opportunities",
      default: null,
      index: true,
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
    resumePayload: {
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
    changesSummary: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ["approved", "deleted"],
      default: "approved",
      index: true,
    },
    approvedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

resumeTailoredVersionSchema.index({ contact: 1, accessCodeHash: 1, updatedAt: -1 });

module.exports = mongoose.model("resume_tailored_versions", resumeTailoredVersionSchema);
