const mongoose = require("mongoose");

const telegramSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "default",
      unique: true,
      index: true,
    },
    autoPublishingEnabled: {
      type: Boolean,
      default: false,
    },
    draftApprovalRequired: {
      type: Boolean,
      default: true,
    },
    botPublishingEnabled: {
      type: Boolean,
      default: false,
    },
    opportunityTime: {
      type: String,
      default: "11:00",
      trim: true,
    },
    contentTime: {
      type: String,
      default: "19:00",
      trim: true,
    },
    contentDays: {
      type: [Number],
      default: [0, 2, 4],
    },
    maxPostsPerDay: {
      type: Number,
      default: 2,
      min: 1,
      max: 4,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("telegram_settings", telegramSettingsSchema);
