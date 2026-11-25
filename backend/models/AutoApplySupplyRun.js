const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  trigger: { type: String, enum: ["scheduler", "admin", "cli", "canary"], required: true },
  status: { type: String, enum: ["running", "completed", "partial", "failed", "interrupted"], required: true },
  lock: String,
  leaseUntil: Date,
  startedAt: { type: Date, required: true },
  purgeAt: { type: Date, expires: 0 },
  canarySlot: Number,
  finishedAt: Date,
  metrics: mongoose.Schema.Types.Mixed,
});

schema.index({ lock: 1 }, { unique: true, partialFilterExpression: { lock: { $type: "string" } } });
schema.index({ canarySlot: 1 }, { unique: true, partialFilterExpression: { canarySlot: { $type: "number" } } });
module.exports = mongoose.model("AutoApplySupplyRun", schema);
