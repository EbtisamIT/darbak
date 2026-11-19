const mongoose = require("mongoose");

const autoApplyProductionGmailSmokeSchema = new mongoose.Schema({
  smokeKey: { type: String, required: true, unique: true, immutable: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
  recipientHash: { type: String, required: true, immutable: true },
  status: { type: String, enum: ["pending", "accepted", "failed"], required: true },
  providerMessageId: { type: String, default: "" },
  attemptedAt: { type: Date, required: true },
  acceptedAt: { type: Date, default: null },
  failureCode: { type: String, default: "" },
}, { timestamps: true });

module.exports = mongoose.models.AutoApplyProductionGmailSmoke ||
  mongoose.model("AutoApplyProductionGmailSmoke", autoApplyProductionGmailSmokeSchema);
