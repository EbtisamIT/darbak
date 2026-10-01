const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  source: { type: String, required: true, maxlength: 80 },
  runId: { type: String, required: true, maxlength: 160 },
  payloadHash: { type: String, required: true },
  summary: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true });

// Retain receipts: expiring them would allow an old run to be imported again.
schema.index({ source: 1, runId: 1 }, { unique: true });
module.exports = mongoose.model("OpportunityImportRun", schema);
