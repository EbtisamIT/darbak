const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    accessCodeHash: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "active", "expired", "cancelled", "suspended", "refunded"],
      default: "active",
      index: true,
    },
    planId: {
      type: String,
      default: "monthly",
      trim: true,
      index: true,
    },
    planKey: {
      type: String,
      default: "darbak_plus",
      trim: true,
      index: true,
    },
    entitlements: {
      type: [String],
      default: ["darbak_plus"],
    },
    priceSar: {
      type: Number,
      default: 5,
    },
    campaignId: { type: String, default: "", trim: true, maxlength: 120 },
    originalPriceSar: { type: Number, default: 0, min: 0 },
    paidPriceSar: { type: Number, default: 0, min: 0 },
    durationDays: {
      type: Number,
      default: 30,
    },
    startsAt: {
      type: Date,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ["manual", "moyasar", "tap", ""],
      default: "manual",
    },
    providerPaymentId: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    sourceType: {
      type: String,
      enum: ["", "moyasar", "manual", "compensation", "free"],
      default: "",
      trim: true,
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
      index: true,
    },
    renewalCancelledAt: { type: Date },
    suspendedAt: { type: Date },
    suspendedReason: { type: String, default: "", trim: true, maxlength: 500 },
    refund: {
      status: {
        type: String,
        enum: ["none", "requested", "approved", "rejected", "exceptional", "closed"],
        default: "none",
      },
      requestedAt: { type: Date },
      decidedAt: { type: Date },
      reason: { type: String, default: "", trim: true, maxlength: 1000 },
      adminNote: { type: String, default: "", trim: true, maxlength: 1000 },
      refundedAmountSar: { type: Number, default: 0, min: 0 },
    },
    adminEvents: {
      type: [
        {
          type: { type: String, default: "", trim: true, maxlength: 80 },
          label: { type: String, default: "", trim: true, maxlength: 300 },
          reason: { type: String, default: "", trim: true, maxlength: 500 },
          amountSar: { type: Number, default: 0, min: 0 },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    termsAcceptedAt: { type: Date },
    termsVersion: { type: String, default: "", trim: true, maxlength: 80 },
    privacyPolicyAcceptedAt: { type: Date },
    privacyPolicyVersion: { type: String, default: "", trim: true, maxlength: 80 },
    refundPolicyAcceptedAt: { type: Date },
    refundPolicyVersion: { type: String, default: "", trim: true, maxlength: 80 },
    isUpgrade: {
      type: Boolean,
      default: false,
      index: true,
    },
    upgradedFromPlanKey: {
      type: String,
      default: "",
      trim: true,
    },
    aiResumeUsageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    aiResumeUsageLimit: {
      type: Number,
      default: 0,
      min: 0,
    },
    aiResumeUsageResetAt: {
      type: Date,
    },
    accessResetTokenHash: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    accessResetExpiresAt: {
      type: Date,
    },
    accessResetRequestedAt: {
      type: Date,
    },
    accessResetUsedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("subscriptions", subscriptionSchema);
