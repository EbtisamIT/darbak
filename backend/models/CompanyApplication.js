const mongoose = require("mongoose");

const applicationStatusValues = [
  "submitted",
  "under_review",
  "shortlisted",
  "interview",
  "accepted",
  "rejected",
  "withdrawn",
  // Legacy statuses kept so old records remain readable while the UI migrates.
  "new",
  "reviewed",
];

const portfolioSnapshotSchema = new mongoose.Schema(
  {
    fullName: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    contact: { type: String, default: "", trim: true, lowercase: true },
    phone: { type: String, default: "", trim: true },
    major: { type: String, default: "", trim: true },
    university: { type: String, default: "", trim: true },
    city: { type: String, default: "", trim: true },
    degreeLevel: { type: String, default: "", trim: true },
    readinessStatus: { type: String, default: "", trim: true },
    bio: { type: String, default: "", trim: true },
    skills: { type: [String], default: [] },
    projects: { type: [mongoose.Schema.Types.Mixed], default: [] },
    certifications: { type: [mongoose.Schema.Types.Mixed], default: [] },
    cvAssetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "portfolio_assets",
      default: null,
    },
    cvUrl: { type: String, default: "", trim: true },
    linkedinUrl: { type: String, default: "", trim: true },
    portfolioUrl: { type: String, default: "", trim: true },
    slug: { type: String, default: "", trim: true, lowercase: true },
  },
  { _id: false }
);

const customAnswerSchema = new mongoose.Schema(
  {
    question: { type: String, default: "", trim: true, maxlength: 220 },
    answer: { type: String, default: "", trim: true, maxlength: 1200 },
  },
  { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: applicationStatusValues,
      required: true,
    },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: String, default: "system", trim: true, maxlength: 80 },
    studentVisibleMessage: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
  },
  { _id: false }
);

const companyApplicationSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null,
      index: true,
    },
    portfolioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "portfolios",
      default: null,
      index: true,
    },
    campaignId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160,
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
      default: "",
      trim: true,
      maxlength: 180,
    },
    opportunityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "opportunities",
      default: null,
    },
    companyId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160,
      index: true,
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
    phone: {
      type: String,
      default: "",
      trim: true,
      maxlength: 40,
    },
    major: {
      type: String,
      default: "",
      trim: true,
      maxlength: 140,
    },
    university: {
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
    gpa: {
      type: String,
      default: "",
      trim: true,
      maxlength: 30,
    },
    gpaValue: {
      type: Number,
      default: null,
      min: 0,
    },
    gpaScale: {
      type: Number,
      default: null,
      enum: [4, 5, 100, null],
    },
    trainingInfo: {
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
    cvFileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "company_application_files",
      default: null,
      index: true,
    },
    cvUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    cvFilename: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160,
    },
    note: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1200,
    },
    customAnswers: {
      type: [customAnswerSchema],
      default: [],
    },
    consent: {
      type: Boolean,
      default: false,
    },
    portfolioSnapshot: {
      type: portfolioSnapshotSchema,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: applicationStatusValues,
      default: "submitted",
      index: true,
    },
    studentVisibleMessage: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },
    submittedAt: {
      type: Date,
      default: Date.now,
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
companyApplicationSchema.index({ studentId: 1, submittedAt: -1 });
companyApplicationSchema.index({ campaignId: 1, studentId: 1 });
companyApplicationSchema.index({ campaignId: 1, email: 1 });

module.exports = mongoose.model(
  "company_applications",
  companyApplicationSchema
);
