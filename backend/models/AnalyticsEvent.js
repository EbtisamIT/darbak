const mongoose = require("mongoose");

const AnalyticsEventSchema = new mongoose.Schema(
  {
    eventName: { type: String, required: true, index: true, trim: true },
    visitorId: { type: String, index: true, trim: true },
    // Internal user identifier only. It is never returned to the client and
    // lets admin analytics distinguish subscriber usage from anonymous visits.
    actorId: { type: String, index: true, trim: true },
    page: { type: String, trim: true },
    deviceType: {
      type: String,
      enum: ["mobile", "tablet", "desktop", "unknown"],
      default: "unknown",
      index: true,
    },
    major: { type: String, trim: true, index: true },
    majorCategory: { type: String, trim: true },
    city: { type: String, trim: true, index: true },
    searchQuery: { type: String, trim: true },
    resultsCount: { type: Number, default: 0 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

AnalyticsEventSchema.index({ createdAt: -1 });
AnalyticsEventSchema.index({ eventName: 1, createdAt: -1 });
AnalyticsEventSchema.index({ actorId: 1, createdAt: -1 });
AnalyticsEventSchema.index({ visitorId: 1, createdAt: -1 });
AnalyticsEventSchema.index({ eventName: 1, actorId: 1, createdAt: -1 });
AnalyticsEventSchema.index({ eventName: 1, "metadata.experienceId": 1 });
AnalyticsEventSchema.index({ eventName: 1, "metadata.opportunityId": 1 });
AnalyticsEventSchema.index({ eventName: 1, "metadata.organizationName": 1 });

module.exports = mongoose.model("AnalyticsEvent", AnalyticsEventSchema);
