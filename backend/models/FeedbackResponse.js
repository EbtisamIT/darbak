const mongoose = require("mongoose");

const feedbackResponseSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null, index: true },
    rating: { type: Number, required: true, min: 1, max: 4, index: true },
    feedbackText: { type: String, default: "", trim: true, maxlength: 1200 },
    originalFeedbackText: { type: String, default: "", trim: true, maxlength: 1200 },
    publicDisplayText: { type: String, default: "", trim: true, maxlength: 1200 },
    publicConsent: { type: Boolean, default: false, index: true },
    published: { type: Boolean, default: false, index: true },
    featured: { type: Boolean, default: false, index: true },
    displayOrder: { type: Number, default: 0 },
    major: { type: String, default: "", trim: true },
    city: { type: String, default: "", trim: true },
    studentStatus: { type: String, default: "", trim: true },
    subscriptionType: { type: String, default: "free", trim: true },
    pageContext: { type: String, default: "", trim: true, maxlength: 180 },
  },
  { timestamps: true }
);

feedbackResponseSchema.index({ createdAt: -1 });

module.exports = mongoose.model("feedback_responses", feedbackResponseSchema);
