const mongoose = require("mongoose");

const connectedEmailAccountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  provider: { type: String, enum: ["gmail"], required: true },
  emailAddress: { type: String, required: true, trim: true, lowercase: true },
  status: { type: String, enum: ["connected", "expired", "revoked", "error"], default: "connected", index: true },
  encryptedRefreshToken: { type: String, required: true, select: false },
  scopes: { type: [String], default: [] },
  connectedAt: { type: Date, default: Date.now },
  lastValidatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

connectedEmailAccountSchema.index({ userId: 1, provider: 1 }, { unique: true });

module.exports = mongoose.models.ConnectedEmailAccount ||
  mongoose.model("ConnectedEmailAccount", connectedEmailAccountSchema);
