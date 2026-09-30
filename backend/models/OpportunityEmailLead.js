const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  company: { type: String, required: true }, companyNormalized: { type: String, required: true },
  email: { type: String, required: true, lowercase: true, trim: true }, emailType: String,
  city: String, majors: [String], sourceUrl: { type: String, required: true },
  officialSource: Boolean, confidence: Number, discoveredAt: { type: Date, default: Date.now },
  status: { type: String, enum: ["new", "existing", "approved", "rejected"], default: "new" },
}, { timestamps: true });
schema.index({ companyNormalized: 1, email: 1 }, { unique: true });
schema.index({ status: 1, discoveredAt: -1 });
module.exports = mongoose.model("OpportunityEmailLead", schema);
