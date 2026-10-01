const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  url: { type: String, required: true, maxlength: 3000, unique: true }, domain: String,
  title: String, description: String, classification: String, reason: String,
  provider: String, discoveredByQueries: [String], publishedAt: Date,
  discoveredAt: { type: Date, default: Date.now }, lastDiscoveredAt: Date,
  status: { type: String, enum: ["new", "approved", "rejected"], default: "new" },
  reviewStatus: { type: String, enum: ["NEEDS_VERIFICATION"] },
  pageAvailability: { type: String, enum: require("../services/opportunityApplicationPolicy").PAGE_AVAILABILITY },
  applicationState: { type: String, enum: require("../services/opportunityApplicationPolicy").APPLICATION_STATES },
  sourceKey: String,
}, { timestamps: true });
schema.index({ status: 1, discoveredAt: -1 });
module.exports = mongoose.model("OpportunityDiscoveryLead", schema);
