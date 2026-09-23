const mongoose = require("mongoose");

const studentStatusValues = [
  "saved",
  "applied",
  "under_review",
  "contacted",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
];

const applicationTrackerSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true, index: true },
    normalizedEmail: { type: String, default: "", trim: true, lowercase: true, index: true },
    opportunityId: { type: mongoose.Schema.Types.ObjectId, ref: "opportunities", required: true, index: true },
    companyName: { type: String, required: true, trim: true, maxlength: 180 },
    roleTitle: { type: String, default: "", trim: true, maxlength: 180 },
    city: { type: String, default: "", trim: true, maxlength: 120 },
    sourceType: { type: String, enum: ["darbak", "external_link", "email", "manual"], default: "external_link" },
    studentStatus: { type: String, enum: studentStatusValues, default: "applied", index: true },
    appliedAt: { type: Date, default: Date.now, index: true },
    lastUpdatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

applicationTrackerSchema.index({ studentId: 1, opportunityId: 1 }, { unique: true });

module.exports = mongoose.model("application_trackers", applicationTrackerSchema);
module.exports.studentStatusValues = studentStatusValues;
