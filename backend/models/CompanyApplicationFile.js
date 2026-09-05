const mongoose = require("mongoose");

const companyApplicationFileSchema = new mongoose.Schema(
  {
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "company_applications",
      default: null,
      index: true,
    },
    filename: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    originalFilename: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160,
    },
    contentType: {
      type: String,
      required: true,
      enum: ["application/pdf"],
    },
    size: {
      type: Number,
      required: true,
      min: 1,
      max: 10 * 1024 * 1024,
    },
    sha256: {
      type: String,
      required: true,
      trim: true,
      minlength: 64,
      maxlength: 64,
      index: true,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    data: {
      type: Buffer,
      required: true,
    },
    accessToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // Unused uploads are cleaned up automatically after one day.
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
      index: { expires: 0 },
    },
  },
  { timestamps: true }
);

companyApplicationFileSchema.index({ applicationId: 1, createdAt: -1 });

module.exports = mongoose.model(
  "company_application_files",
  companyApplicationFileSchema
);
