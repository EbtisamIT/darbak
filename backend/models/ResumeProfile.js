const mongoose = require("mongoose");

const resumeEntrySchema = new mongoose.Schema(
  {
    id: { type: String, default: "", trim: true },
    title: { type: String, default: "", trim: true },
    subtitle: { type: String, default: "", trim: true },
    organization: { type: String, default: "", trim: true },
    period: { type: String, default: "", trim: true },
    startDate: { type: String, default: "", trim: true },
    endDate: { type: String, default: "", trim: true },
    isCurrent: { type: Boolean, default: false },
    location: { type: String, default: "", trim: true },
    url: { type: String, default: "", trim: true },
    description: { type: String, default: "", trim: true },
    details: { type: String, default: "", trim: true },
    achievements: {
      type: [
        {
          id: { type: String, default: "", trim: true },
          text: { type: String, default: "", trim: true },
          html: { type: String, default: "", trim: true },
        },
      ],
      default: [],
    },
  },
  { _id: true }
);

const resumeLanguageSchema = new mongoose.Schema(
  {
    id: { type: String, default: "", trim: true },
    name: { type: String, default: "", trim: true },
    level: { type: String, default: "", trim: true },
  },
  { _id: true }
);

const resumeLinkSchema = new mongoose.Schema(
  {
    id: { type: String, default: "", trim: true },
    label: { type: String, default: "", trim: true },
    url: { type: String, default: "", trim: true },
  },
  { _id: true }
);

const resumeProfileSchema = new mongoose.Schema(
  {
    contact: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    accessCodeHash: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      index: true,
    },
    personalInfo: {
      fullName: { type: String, default: "", trim: true },
      englishName: { type: String, default: "", trim: true },
      email: { type: String, default: "", trim: true, lowercase: true },
      phone: { type: String, default: "", trim: true },
      city: { type: String, default: "", trim: true },
      major: { type: String, default: "", trim: true },
      university: { type: String, default: "", trim: true },
      linkedinUrl: { type: String, default: "", trim: true },
      headline: { type: String, default: "", trim: true },
      portfolioUrl: { type: String, default: "", trim: true },
      githubUrl: { type: String, default: "", trim: true },
      personalUrl: { type: String, default: "", trim: true },
    },
    summary: {
      type: String,
      default: "",
      trim: true,
    },
    education: {
      type: [resumeEntrySchema],
      default: [],
    },
    experiences: {
      type: [resumeEntrySchema],
      default: [],
    },
    experience: {
      type: [resumeEntrySchema],
      default: [],
    },
    projects: {
      type: [resumeEntrySchema],
      default: [],
    },
    certifications: {
      type: [resumeEntrySchema],
      default: [],
    },
    volunteering: {
      type: [resumeEntrySchema],
      default: [],
    },
    languages: {
      type: [resumeLanguageSchema],
      default: [],
    },
    links: {
      type: [resumeLinkSchema],
      default: [],
    },
    skills: {
      type: [String],
      default: [],
    },
    sectionOrder: {
      type: [String],
      default: [
        "summary",
        "education",
        "experience",
        "projects",
        "skills",
        "certifications",
        "volunteering",
        "languages",
        "links",
      ],
    },
    hiddenSections: {
      type: [String],
      default: [],
    },
    settings: {
      language: { type: String, enum: ["ar", "en"], default: "ar" },
      direction: { type: String, enum: ["rtl", "ltr"], default: "rtl" },
      density: { type: String, enum: ["comfortable", "compact"], default: "comfortable" },
      fontSize: { type: String, enum: ["small", "medium", "large"], default: "medium" },
      template: {
        type: String,
        enum: ["clean", "modern", "formal"],
        default: "clean",
      },
      accentColor: { type: String, default: "#42cfc3", trim: true },
    },
    workflow: {
      source: {
        type: String,
        enum: ["portfolio", "scratch", "uploaded_resume", "agent", ""],
        default: "",
      },
      lastStep: { type: String, default: "", trim: true },
      isSetupComplete: { type: Boolean, default: false },
    },
    rawDraftInput: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    aiDraft: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    aiTailoredDraft: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    aiDraftStatus: {
      type: String,
      enum: ["none", "draft_ready", "approved"],
      default: "none",
      index: true,
    },
    aiDraftGeneratedAt: {
      type: Date,
    },
    aiDraftApprovedAt: {
      type: Date,
    },
    aiDraftUsage: {
      model: { type: String, default: "", trim: true },
      responseId: { type: String, default: "", trim: true },
      inputTokens: { type: Number, default: 0 },
      outputTokens: { type: Number, default: 0 },
      totalTokens: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

resumeProfileSchema.index(
  { contact: 1, accessCodeHash: 1 },
  {
    unique: true,
    partialFilterExpression: {
      contact: { $type: "string", $gt: "" },
      accessCodeHash: { $type: "string", $gt: "" },
    },
  }
);

module.exports = mongoose.model("resume_profiles", resumeProfileSchema);
