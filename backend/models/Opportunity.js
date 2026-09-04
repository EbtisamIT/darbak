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
    cities: {
      type: [String],
      default: [],
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
    targetAudience: {
      type: String,
      enum: ["all", "women", "men", ""],
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
      enum: ["website", "email", "linkedin", "manual", "darbak", "other", ""],
      default: "",
    },
    isDarbakApplication: {
      type: Boolean,
      default: false,
      index: true,
    },
    companyApplicationCampaignId: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    applicationUrl: {
      type: String,
      default: "",
      trim: true,
    },
    logoUrl: {
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
    sourceType: {
      type: String,
      enum: ["admin", "visitor"],
      default: "admin",
      index: true,
    },
    submitterContact: {
      type: String,
      default: "",
      trim: true,
    },
    featured: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

opportunitySchema.index({ status: 1, featured: -1, createdAt: -1 });
opportunitySchema.index({ status: 1, deadline: 1 });
opportunitySchema.index({ status: 1, city: 1, createdAt: -1 });
opportunitySchema.index({ status: 1, cities: 1, createdAt: -1 });
opportunitySchema.index({ status: 1, specialties: 1, createdAt: -1 });
opportunitySchema.index({ status: 1, majorCategories: 1, createdAt: -1 });
opportunitySchema.index({ organizationName: 1 });
opportunitySchema.index({ companyApplicationCampaignId: 1, isDarbakApplication: 1 });

module.exports = mongoose.model("opportunities", opportunitySchema);
