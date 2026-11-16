const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  recipient: { type: String, required: true, trim: true, lowercase: true },
  filename: { type: String, required: true, trim: true },
  sha256: { type: String, required: true, trim: true },
  status: { type: String, enum: ["pending", "sent", "failed"], default: "pending" },
  providerMessageId: { type: String, default: "", trim: true },
  sentAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.models.AutoApplyGmailPdfTestSend ||
  mongoose.model("AutoApplyGmailPdfTestSend", schema);
