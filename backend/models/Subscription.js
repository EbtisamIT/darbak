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
      enum: ["pending", "active", "expired", "cancelled"],
      default: "active",
      index: true,
    },
    planId: {
      type: String,
      default: "monthly",
      trim: true,
      index: true,
    },
    priceSar: {
      type: Number,
      default: 5,
    },
    durationDays: {
      type: Number,
      default: 30,
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
