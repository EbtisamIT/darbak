const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  runType: { type: String, default: "discovery", enum: ["discovery", "known-url", "search-only", "full", "automation"] },
  searchRotation: { type: Number, default: 0 },
  searchReport: mongoose.Schema.Types.Mixed,
  searchRunId: { type: mongoose.Schema.Types.ObjectId, ref: "OpportunityDiscoveryRun" },
  status: { type: String, enum: ["running", "completed", "partial", "failed", "interrupted"], required: true },
  // Unique partial index is the cross-process lease; never use only a JS boolean.
  lock: String, leaseUntil: Date, startedAt: Date, finishedAt: Date, durationMs: Number,
  budgetDay: String, dailySlot: Number,
  summary: mongoose.Schema.Types.Mixed,
  sources: [{ _id: false, key: String, name: String, checked: Boolean, status: String, found: Number,
    durationMs: Number, requests: Number, skipped: Number, warnings: [String], error: String,
    counters: mongoose.Schema.Types.Mixed, details: [mongoose.Schema.Types.Mixed] }],
  error: String,
}, { timestamps: true });
schema.index({ lock: 1 }, { unique: true, partialFilterExpression: { lock: { $type: "string" } } });
schema.index({ budgetDay: 1, dailySlot: 1 }, { unique: true, partialFilterExpression: { budgetDay: { $type: "string" }, dailySlot: { $type: "number" } } });
schema.index({ runType: 1, createdAt: -1 });
schema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 86400 });
module.exports = mongoose.model("OpportunityDiscoveryRun", schema);
