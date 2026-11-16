const mongoose = require("mongoose");

// A Gmail grant waits here until the student who started the link claims it
// from their own logged-in Darbak session. This stops a link started by one
// account from being completed in another student's browser.
const autoApplyGmailPendingLinkSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  linkCodeHash: { type: String, required: true, unique: true },
  emailAddress: { type: String, required: true, trim: true, lowercase: true },
  encryptedRefreshToken: { type: String, required: true, select: false },
  scopes: { type: [String], default: [] },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

autoApplyGmailPendingLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.AutoApplyGmailPendingLink
  || mongoose.model("AutoApplyGmailPendingLink", autoApplyGmailPendingLinkSchema);
