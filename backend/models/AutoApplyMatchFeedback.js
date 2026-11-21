const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true, index: true },
  packageId: { type: mongoose.Schema.Types.ObjectId, ref: "AutoApplyPackage", required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "companies", default: null },
  positive: { type: Boolean, required: true },
  reason: { type: String, enum: ["", "major", "field", "city", "documents", "company", "other"], default: "" },
}, { timestamps: true });

schema.index({ userId: 1, packageId: 1 }, { unique: true });

module.exports = mongoose.models.AutoApplyMatchFeedback || mongoose.model("AutoApplyMatchFeedback", schema);
