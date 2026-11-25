const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  trigger: { type: String, enum: ["scheduler", "admin", "cli"], required: true },
  status: { type: String, enum: ["running", "completed", "partial", "failed", "interrupted"], required: true },
  lock: String,
  leaseUntil: Date,
  startedAt: { type: Date, required: true, expires: 30 * 86400 },
  finishedAt: Date,
  metrics: mongoose.Schema.Types.Mixed,
});

schema.index({ lock: 1 }, { unique: true, partialFilterExpression: { lock: { $type: "string" } } });
module.exports = mongoose.model("AutoApplySupplyRun", schema);
