const mongoose = require("mongoose");

const telegramContentItemSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["reassurance", "tip", "portfolio", "product"],
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: "",
      trim: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    ctaLabel: {
      type: String,
      default: "",
      trim: true,
    },
    ctaUrl: {
      type: String,
      default: "",
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastUsedAt: {
      type: Date,
      index: true,
    },
    usageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "telegram_content_items",
  telegramContentItemSchema
);
