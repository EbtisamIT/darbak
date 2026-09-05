const mongoose = require("mongoose");

const campaignStatusValues = [
  "draft",
  "pending_review",
  "changes_requested",
  "open",
  "closed",
  "rejected",
  "archived",
];

const customQuestionSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "companies",
      default: null,
      index: true,
    },
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
    applicationNotificationEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      maxlength: 160,
    },
    applicationShareToken: {
      type: String,
      default: undefined,
      trim: true,
      unique: true,
      sparse: true,
      index: true,
      minlength: 48,
      maxlength: 160,
    },
    opportunityTitle: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    programType: { type: String, default: "", trim: true, maxlength: 100 },
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
    requirements: { type: String, default: "", trim: true, maxlength: 1600 },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    reviewMessage: { type: String, default: "", trim: true, maxlength: 800 },
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
companyApplicationCampaignSchema.index({ companyId: 1, status: 1, updatedAt: -1 });

module.exports = mongoose.model(
  "company_application_campaigns",
  companyApplicationCampaignSchema
);
