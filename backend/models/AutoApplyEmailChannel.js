const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "companies", default: null },
  company: { type: String, required: true, trim: true },
  companyNormalized: { type: String, required: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  channelType: { type: String, enum: ["active_opportunity", "evergreen_training", "hr_general", "unknown"], default: "unknown" },
  verificationStatus: { type: String, enum: ["verified", "likely", "unverified", "rejected"], default: "unverified" },
  acceptsTrainingApplications: { type: Boolean, default: false },
  majors: { type: [String], default: [] },
  allMajors: { type: Boolean, default: false },
  cities: { type: [String], default: [] },
  allSaudi: { type: Boolean, default: false },
  remote: { type: Boolean, default: false },
  evidenceUrl: { type: String, default: "" },
  evidenceType: { type: String, enum: ["", "official_training_page", "official_careers_page", "official_training_announcement", "repeated_official_training_announcements", "historical_official_training_announcement", "official_social_post", "official_company_reply"], default: "" },
  evidenceTextSummary: { type: String, default: "", maxlength: 1000 },
  reviewerNote: { type: String, default: "", maxlength: 500 },
  rejectionReason: { type: String, enum: ["", "support_only", "general_contact_only", "careers_but_no_training_evidence", "personal_employee_email", "expired_opportunity_only", "portal_required", "no_official_evidence"], default: "" },
  verifiedAt: { type: Date, default: null },
  evidenceDate: { type: Date, default: null },
  expiresAt: { type: Date, default: null },
  activeOpportunityId: { type: mongoose.Schema.Types.ObjectId, ref: "opportunities", default: null },
  sourceNames: { type: [String], default: [] },
}, { timestamps: true });

schema.index({ companyNormalized: 1, email: 1 }, { unique: true });
schema.index({ verificationStatus: 1, channelType: 1, expiresAt: 1 });

module.exports = mongoose.model("AutoApplyEmailChannel", schema);
