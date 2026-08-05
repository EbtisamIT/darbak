const mongoose = require("mongoose");

const companyApplicationSchema = new mongoose.Schema(
  {
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
    opportunityTitle: {
      type: String,
      default: "",
      trim: true,
      maxlength: 180,
    },
    opportunityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "opportunities",
      default: null,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 160,
      index: true,
    },
    major: {
      type: String,
      default: "",
      trim: true,
      maxlength: 140,
    },
    city: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    portfolioUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },
    linkedinUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },
    note: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1200,
    },
    consent: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["new", "reviewed", "shortlisted", "rejected"],
      default: "new",
      index: true,
    },
    source: {
      type: String,
      default: "darbak_apply_page",
      trim: true,
      maxlength: 80,
    },
  },
  { timestamps: true }
);

companyApplicationSchema.index({ organizationName: 1, createdAt: -1 });
companyApplicationSchema.index({ email: 1, organizationName: 1 });

module.exports = mongoose.model(
  "company_applications",
  companyApplicationSchema
);
