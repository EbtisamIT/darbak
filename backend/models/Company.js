const mongoose = require("mongoose");

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 180, index: true },
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
