const mongoose = require("mongoose");
const { STATUSES, PROGRAM_TYPES, SOURCE_TYPES, EMAIL_TYPES } = require("../services/opportunityCandidateData");
const candidateSchema = new mongoose.Schema({
  title: { type: String, default: "", maxlength: 300 }, company: { type: String, default: "", maxlength: 240 },
  companyNormalized: { type: String, index: true }, companyLogo: { type: String, default: "" },
  programType: { type: String, enum: PROGRAM_TYPES, default: "unknown" }, majors: [String], cities: [String],
  remote: { type: Boolean, default: false }, description: String, responsibilities: [String], requirements: [String],
  applicationUrl: String, sourceUrl: String, sourceType: { type: String, enum: SOURCE_TYPES, default: "other" },
  postedAt: { type: Date, default: null }, deadline: { type: Date, default: null }, trainingStartDate: { type: Date, default: null },
  discoveredAt: { type: Date, default: Date.now }, rawContent: { type: String, maxlength: 50000, select: false },
  status: { type: String, enum: STATUSES, default: "new" }, confidenceScore: { type: Number, min: 0, max: 100, default: 0 },
  verification: {
    urlWorks: { type: Boolean, default: null }, officialSource: { type: Boolean, default: null },
    appearsOpen: { type: Boolean, default: null }, dateVerified: { type: Boolean, default: null }, companyVerified: { type: Boolean, default: null },
  },
  missingFields: [String], duplicateOf: { type: mongoose.Schema.Types.ObjectId, default: null, ref: "OpportunityCandidate" },
  existingOpportunityId: { type: mongoose.Schema.Types.ObjectId, ref: "opportunities", default: null },
  publishedOpportunityId: { type: mongoose.Schema.Types.ObjectId, ref: "opportunities", default: null },
  aiNotes: String, isDemo: { type: Boolean, default: false },
  demoExistingSnapshot: { type: mongoose.Schema.Types.Mixed, select: false },
  discoveredEmails: [{ _id: false, email: String, type: { type: String, enum: EMAIL_TYPES }, sourceUrl: String, confidence: { type: Number, min: 0, max: 100 } }],
}, { timestamps: true, optimisticConcurrency: true });
candidateSchema.index({ status: 1, discoveredAt: -1 });
candidateSchema.index({ discoveredAt: -1 });
candidateSchema.index({ sourceType: 1, programType: 1, discoveredAt: -1 });
candidateSchema.index({ cities: 1, confidenceScore: 1 });
candidateSchema.index({ applicationUrl: 1 });
module.exports = mongoose.model("OpportunityCandidate", candidateSchema);
