const mongoose = require("mongoose");

const campaignStatusValues = ["draft", "open", "closed", "archived"];

const customQuestionSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true,
      maxlength: 220,
    },
    required: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const companyApplicationCampaignSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
      index: true,
    },
    companySlug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
      index: true,
    },
    organizationName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
      index: true,
    },
    organizationLogoUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    opportunityTitle: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    city: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
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
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1600,
    },
    customQuestions: {
      type: [customQuestionSchema],
      default: [],
    },
    applicationDeadline: {
      type: Date,
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: campaignStatusValues,
      default: "draft",
      index: true,
    },
    allowDuplicateApplications: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: String,
      default: "admin",
      trim: true,
      maxlength: 80,
    },
    updatedBy: {
      type: String,
      default: "admin",
      trim: true,
      maxlength: 80,
    },
  },
  { timestamps: true }
);

companyApplicationCampaignSchema.index({
  organizationName: 1,
  opportunityTitle: 1,
});
companyApplicationCampaignSchema.index({
  status: 1,
  applicationDeadline: 1,
  updatedAt: -1,
});

module.exports = mongoose.model(
  "company_application_campaigns",
  companyApplicationCampaignSchema
);
