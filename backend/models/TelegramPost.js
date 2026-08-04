const mongoose = require("mongoose");

const telegramPostSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "opportunity",
        "experience",
        "reassurance",
        "tip",
        "portfolio",
        "product",
      ],
      required: true,
      index: true,
    },
    sourceType: {
      type: String,
      enum: ["opportunity", "experience", "template", "manual", ""],
      default: "",
      index: true,
    },
    sourceId: {
      type: String,
      default: "",
      trim: true,
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
    status: {
      type: String,
      enum: ["draft", "scheduled", "published", "failed"],
      default: "draft",
      index: true,
    },
    scheduledAt: {
      type: Date,
      index: true,
    },
    publishedAt: {
      type: Date,
      index: true,
    },
    telegramMessageId: {
      type: String,
      default: "",
      trim: true,
    },
    createdAutomatically: {
      type: Boolean,
      default: false,
      index: true,
    },
    errorMessage: {
      type: String,
      default: "",
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

telegramPostSchema.index(
  { sourceType: 1, sourceId: 1, type: 1, status: 1 },
  { partialFilterExpression: { sourceId: { $type: "string", $ne: "" } } }
);

module.exports = mongoose.model("telegram_posts", telegramPostSchema);
