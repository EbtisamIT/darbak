const mongoose = require("mongoose");

const resumeAgentSessionSchema = new mongoose.Schema(
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
    sessionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    purpose: {
      type: String,
      enum: ["create_resume", "tailor_resume"],
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ["professional_profile", "existing_resume", "new_information"],
      default: "professional_profile",
    },
    language: {
      type: String,
      enum: ["ar", "en"],
      default: "ar",
    },
    status: {
      type: String,
      enum: ["collecting_information", "generating", "awaiting_review", "completed", "failed"],
      default: "collecting_information",
      index: true,
    },
    collectedFacts: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    answeredQuestionIds: {
      type: [String],
      default: [],
    },
    pendingQuestions: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    pendingDraftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "resume_pending_drafts",
      default: null,
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
    lastResponseId: {
      type: String,
      default: "",
      trim: true,
    },
    usage: {
      model: { type: String, default: "", trim: true },
      turns: { type: Number, default: 0 },
      toolCalls: { type: Number, default: 0 },
      inputTokens: { type: Number, default: 0 },
      outputTokens: { type: Number, default: 0 },
      totalTokens: { type: Number, default: 0 },
      durationMs: { type: Number, default: 0 },
      toolsUsed: { type: [String], default: [] },
      failureReason: { type: String, default: "", trim: true },
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

resumeAgentSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
resumeAgentSessionSchema.index({ contact: 1, accessCodeHash: 1, updatedAt: -1 });

module.exports = mongoose.model("resume_agent_sessions", resumeAgentSessionSchema);
