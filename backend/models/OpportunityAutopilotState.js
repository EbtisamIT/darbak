const mongoose = require("mongoose");

// Singleton (_id "autopilot"): admin switch, slot bookkeeping, a short lease
// shared by every worker, and a capped log of automatic actions.
const actionSchema = new mongoose.Schema({
  at: { type: Date, default: Date.now },
  type: { type: String, enum: ["auto_published", "auto_updated", "auto_closed", "rejected_not_coop", "reopened", "publish_failed"] },
  opportunityId: { type: mongoose.Schema.Types.ObjectId, default: null },
  candidateId: { type: mongoose.Schema.Types.ObjectId, default: null },
  title: String, company: String, reason: String,
}, { _id: false });

const stateSchema = new mongoose.Schema({
  _id: { type: String, default: "autopilot" },
  enabled: { type: Boolean, default: false },
  lastDiscoverySlot: { type: String, default: "" },
  lastRecheckDay: { type: String, default: "" },
  lease: { owner: String, until: Date },
  lastTickAt: Date,
  lastDiscovery: { at: Date, slot: String, runId: String, error: String },
  lastAutoPublish: { at: Date, published: Number, updated: Number, rejectedNotCoop: Number, sentToReview: Number, failed: Number },
  lastRecheck: { at: Date, checked: Number, stillOpen: Number, closed: Number, deadlineExtended: Number, unverifiable: Number, inconclusive: Number },
  actions: { type: [actionSchema], default: [] },
}, { timestamps: true, collection: "opportunityautopilotstate" });

module.exports = mongoose.model("OpportunityAutopilotState", stateSchema);
