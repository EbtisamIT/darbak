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
  "waiting",
  "action_required",
  "accepted",
];

const applicationTrackerSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true, index: true },
    normalizedEmail: { type: String, default: "", trim: true, lowercase: true, index: true },
    opportunityId: { type: mongoose.Schema.Types.ObjectId, ref: "opportunities", required() { return this.sourceType !== "manual"; }, index: true },
    companyName: { type: String, required: true, trim: true, maxlength: 180 },
    roleTitle: { type: String, default: "", trim: true, maxlength: 180 },
    city: { type: String, default: "", trim: true, maxlength: 120 },
    sourceType: { type: String, enum: ["darbak", "external_link", "email", "manual"], default: "external_link" },
    studentStatus: { type: String, enum: studentStatusValues, default: "applied", index: true },
    appliedAt: { type: Date, default: Date.now, index: true },
    lastUpdatedAt: { type: Date, default: Date.now },
    organizationLogoUrl: { type: String, default: "" },
    contactEmail: { type: String, default: "", trim: true, lowercase: true, maxlength: 254 },
    opportunityUrl: { type: String, default: "" },
    applicationMethod: { type: String, default: "" },
    followUpAt: { type: Date, default: null },
    followUpSnoozedUntil: { type: Date, default: null },
    followUpSentAt: { type: Date, default: null },
    followUpDismissedAt: { type: Date, default: null },
    note: { type: String, default: "", maxlength: 500 },
    statusHistory: [{
      _id: false,
      status: String,
      changedAt: { type: Date, default: Date.now },
      followUpAt: Date,
      note: String,
    }],
  },
  { timestamps: true }
);

applicationTrackerSchema.index({ opportunityId: 1, studentId: 1 }, {
  unique: true,
  name: "tracker_student_opportunity_v2",
  partialFilterExpression: { opportunityId: { $type: "objectId" } },
});

module.exports = mongoose.model("application_trackers", applicationTrackerSchema);
module.exports.studentStatusValues = studentStatusValues;
