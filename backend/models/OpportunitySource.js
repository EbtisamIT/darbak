const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  name: String, company: String, companyNormalized: String, baseUrl: String, sourceUrl: String,
  sourceType: { type: String, enum: ["company", "ats", "university", "other"] },
  country: String, active: { type: Boolean, default: false }, trustScore: Number,
  officialDomains: [String], careerDomains: [String], atsProvider: String,
  atsIdentifiers: mongoose.Schema.Types.Mixed, searchQueries: [String],
  reviewStatus: { type: String, enum: ["pending", "approved"], default: "pending" },
  approvalEvidence: [String], reviewedAt: Date,
  lastCheckedAt: Date, lastSuccessAt: Date, lastOpportunityFoundAt: Date,
  lastError: String, failureCount: { type: Number, default: 0 }, metadata: mongoose.Schema.Types.Mixed,
}, { timestamps: true });
module.exports = mongoose.model("OpportunitySource", schema);
