const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true, index: true },
  type: { type: String, enum: ["academic_transcript", "training_letter", "other"], required: true },
  scope: { type: String, enum: ["general", "company_specific"], default: "general" },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "companies", default: null },
  fileRef: { type: String, required: true, trim: true },
  originalFilename: { type: String, required: true, trim: true },
  expiresAt: { type: Date, default: null },
}, { timestamps: true });

schema.index({ userId: 1, type: 1, companyId: 1 });

module.exports = mongoose.models.AutoApplyDocument || mongoose.model("AutoApplyDocument", schema);
