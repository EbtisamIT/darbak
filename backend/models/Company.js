const mongoose = require("mongoose");

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 180, index: true },
    nameAr: { type: String, default: "", trim: true, maxlength: 180 },
    nameEn: { type: String, default: "", trim: true, maxlength: 180 },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
      index: true,
    },
    logoUrl: { type: String, default: "", trim: true, maxlength: 500 },
    shortDescription: { type: String, default: "", trim: true, maxlength: 600 },
    sector: { type: String, default: "", trim: true, maxlength: 120 },
    city: { type: String, default: "", trim: true, maxlength: 120 },
    website: { type: String, default: "", trim: true, maxlength: 500 },
    contactName: { type: String, default: "", trim: true, maxlength: 160 },
    contactEmail: { type: String, default: "", trim: true, lowercase: true, maxlength: 160 },
    status: {
      type: String,
      enum: ["trial", "active", "inactive"],
      default: "trial",
      index: true,
    },
    // Companies stay private to their program portal unless the admin opts in
    // to showing their content in the student-facing company directory.
    showInStudentDirectory: { type: Boolean, default: false, index: true },
    contentAliases: {
      type: [String],
      default: [],
      validate: {
        validator: (items) => Array.isArray(items) && items.length <= 20,
        message: "يمكن إضافة 20 اسمًا بديلًا كحد أقصى.",
      },
    },
    // `contentAliases` is kept for older portal records. New directory and
    // linking code reads `aliases` first and mirrors the values for safety.
    aliases: {
      type: [String],
      default: [],
      validate: {
        validator: (items) => Array.isArray(items) && items.length <= 20,
        message: "يمكن إضافة 20 اسمًا بديلًا كحد أقصى.",
      },
    },
    isPublished: { type: Boolean, default: false, index: true },
    demoPortalEnabled: { type: Boolean, default: false },
    demoPortalDismissedAt: { type: Date, default: null },
    portalAccessToken: {
      type: String,
      default: undefined,
      unique: true,
      sparse: true,
      index: true,
      minlength: 48,
      maxlength: 160,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("companies", companySchema);
