const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    contact: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      index: true,
    },
    visitorId: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    accessCodeHash: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    isPremium: {
      type: Boolean,
      default: false,
      index: true,
    },
    isAdmin: {
      type: Boolean,
      default: false,
      index: true,
    },
    premiumExpiresAt: {
      type: Date,
    },
    lastViewedDate: {
      type: String,
      default: "",
      trim: true,
    },
    dailyViewsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastViewedItemKey: {
      type: String,
      default: "",
      trim: true,
    },
    dailyViewItemKeys: {
      type: [String],
      default: [],
    },
    subscriptionReminderLastShownAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

userSchema.index(
  { contact: 1, accessCodeHash: 1 },
  {
    unique: true,
    partialFilterExpression: {
      contact: { $type: "string", $gt: "" },
      accessCodeHash: { $type: "string", $gt: "" },
    },
  }
);
userSchema.index(
  { visitorId: 1 },
  {
    unique: true,
    partialFilterExpression: { visitorId: { $type: "string", $gt: "" } },
  }
);

module.exports = mongoose.model("users", userSchema);
