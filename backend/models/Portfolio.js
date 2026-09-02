const mongoose = require("mongoose");

const portfolioProjectSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: "",
      trim: true,
    },
    title: {
      type: String,
      default: "",
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    technologies: {
      type: [String],
      default: [],
    },
    url: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false }
);

const portfolioCertificationSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: "",
      trim: true,
    },
    title: {
      type: String,
      default: "",
      trim: true,
    },
    provider: {
      type: String,
      default: "",
      trim: true,
    },
    year: {
      type: String,
      default: "",
      trim: true,
    },
    credentialUrl: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false }
);

const portfolioExperienceSchema = new mongoose.Schema(
  {
    title: { type: String, default: "", trim: true },
    organization: { type: String, default: "", trim: true },
    period: { type: String, default: "", trim: true },
    description: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const portfolioLanguageSchema = new mongoose.Schema(
  {
    name: { type: String, default: "", trim: true },
    level: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const portfolioSchema = new mongoose.Schema(
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
      index: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    fullName: {
      type: String,
      default: "",
      trim: true,
    },
    major: {
      type: String,
      default: "",
      trim: true,
    },
    university: {
      type: String,
      default: "",
      trim: true,
    },
    city: {
      type: String,
      default: "",
      trim: true,
    },
    dateOfBirth: {
      type: String,
      default: "",
      trim: true,
    },
    degreeLevel: {
      type: String,
      default: "",
      trim: true,
    },
    studentStatus: {
      type: String,
      enum: ["", "student", "graduate", "expected_graduate"],
      default: "",
      trim: true,
    },
    grammaticalGender: {
      type: String,
      enum: ["", "feminine", "masculine"],
      default: "",
      trim: true,
    },
    graduationYear: { type: String, default: "", trim: true },
    expectedGraduationYear: { type: String, default: "", trim: true },
    studyStartYear: { type: String, default: "", trim: true },
    gpa: { type: String, default: "", trim: true },
    gpaScale: { type: String, default: "", trim: true },
    academicTrack: { type: String, default: "", trim: true },
    relevantCoursework: {
      type: [String],
      default: [],
    },
    professionalHeadline: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },
    readinessStatus: {
      type: String,
      default: "مستعد ومؤهل للمقابلات الشخصية",
      trim: true,
    },
    targetOrganizations: {
      type: [String],
      default: [],
    },
    bio: {
      type: String,
      default: "",
      trim: true,
    },
    skills: {
      type: [String],
      default: [],
    },
    projects: {
      type: [portfolioProjectSchema],
      default: [],
    },
    certifications: {
      type: [portfolioCertificationSchema],
      default: [],
    },
    experiences: { type: [portfolioExperienceSchema], default: [] },
    volunteering: { type: [portfolioExperienceSchema], default: [] },
    languages: { type: [portfolioLanguageSchema], default: [] },
    cvAssetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "portfolio_assets",
      default: null,
    },
    cvUrl: {
      type: String,
      default: "",
      trim: true,
    },
    linkedinUrl: {
      type: String,
      default: "",
      trim: true,
    },
    githubUrl: { type: String, default: "", trim: true },
    personalWebsite: { type: String, default: "", trim: true },
    targetTrainingField: { type: String, default: "", trim: true },
    trainingStart: { type: String, default: "", trim: true },
    trainingEnd: { type: String, default: "", trim: true },
    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    avatarAssetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "portfolio_assets",
      default: null,
    },
    avatarUrl: {
      type: String,
      default: "",
      trim: true,
    },
    isPublished: {
      type: Boolean,
      default: false,
      index: true,
    },
    viewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

portfolioSchema.index(
  { contact: 1, accessCodeHash: 1 },
  {
    unique: true,
    partialFilterExpression: {
      contact: { $type: "string", $gt: "" },
      accessCodeHash: { $type: "string", $gt: "" },
    },
  }
);

module.exports = mongoose.model("portfolios", portfolioSchema);
