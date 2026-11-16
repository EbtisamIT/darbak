const mongoose = require("mongoose");

const autoApplyOAuthStateSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  provider: { type: String, enum: ["gmail"], required: true },
  stateHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

autoApplyOAuthStateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.AutoApplyOAuthState || mongoose.model("AutoApplyOAuthState", autoApplyOAuthStateSchema);
