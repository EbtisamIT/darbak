const mongoose = require("mongoose");

const channelTypes = Object.freeze(["EMAIL", "EXTERNAL_FORM", "COMPANY_PORTAL", "DARBAK_APPLICATION"]);
const verificationStatuses = Object.freeze(["VERIFIED", "LIKELY", "NEEDS_REVIEW", "REJECTED", "EXPIRED"]);
const date = { type: Date, default: null };

const observation = {
  companyName: { type: String, required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "companies", default: null },
  companyLogo: String,
  opportunityId: String,
  opportunityTitle: String,
  opportunityType: String,
  trainingType: String,
  channelType: { type: String, enum: channelTypes, required: true },
  destinationEmail: String,
  applicationUrl: String,
  majors: [String],
  fields: [String],
  cities: [String],
  allMajors: { type: Boolean, default: null },
  allSaudi: { type: Boolean, default: null },
  remote: { type: Boolean, default: null },
  emailTrainingConfirmed: { type: Boolean, default: null },
  educationLevels: [String],
  requiredDocuments: { type: [String], default: null },
  startDate: date,
  deadline: date,
  sourceUrl: String,
  sourceType: { type: String, required: true },
  evidenceText: String,
  evidencePublishedAt: date,
  verificationStatus: { type: String, enum: verificationStatuses, required: true },
  verificationReason: String,
  confidence: { type: Number, min: 0, max: 1, default: null },
  isActive: { type: Boolean, required: true },
  lastCheckedAt: date,
  expiresAt: date,
  contentHash: { type: String, required: true },
};

const historySchema = new mongoose.Schema({ ...observation, supersededAt: { type: Date, required: true } }, { _id: false });
const schema = new mongoose.Schema({
  ...observation,
  firstSeenAt: { type: Date, required: true },
  lastSeenAt: { type: Date, required: true },
  dedupeKey: { type: String, required: true, immutable: true },
  history: { type: [historySchema], default: [], select: false },
});

schema.index({ dedupeKey: 1 }, { unique: true });
schema.index({ verificationStatus: 1, isActive: 1, channelType: 1, expiresAt: 1, deadline: 1 });

module.exports = mongoose.model("AutoApplySupply", schema);
module.exports.channelTypes = channelTypes;
module.exports.verificationStatuses = verificationStatuses;
