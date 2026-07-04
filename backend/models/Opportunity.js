const mongoose = require("mongoose");

const opportunitySchema = new mongoose.Schema(
  {
    organizationName: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      default: "",
      trim: true,
    },
    majorCategories: {
      type: [String],
      default: [],
    },
    specialties: {
      type: [String],
      default: [],
    },
    trainingEnvironment: {
      type: String,
      enum: ["mixed", "women", "men", ""],
      default: "",
    },
    trainingMode: {
      type: String,
      enum: ["onsite", "remote", "hybrid", ""],
      default: "",
    },
    hasReward: {
      type: String,
      enum: ["yes", "no", ""],
      default: "",
    },
    applicationMethod: {
      type: String,
      enum: ["website", "email", "linkedin", "manual", "other", ""],
      default: "",
    },
    applicationUrl: {
      type: String,
      default: "",
      trim: true,
    },
    deadline: {
      type: Date,
    },
    sourceUrl: {
      type: String,
      default: "",
      trim: true,
    },
    note: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["active", "draft", "expired"],
      default: "active",
      index: true,
    },
    featured: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("opportunities", opportunitySchema);
