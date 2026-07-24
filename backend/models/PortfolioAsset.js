const mongoose = require("mongoose");

const portfolioAssetSchema = new mongoose.Schema(
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
    portfolioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "portfolios",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["avatar", "cv"],
      required: true,
      index: true,
    },
    filename: {
      type: String,
      default: "",
      trim: true,
    },
    contentType: {
      type: String,
      required: true,
      trim: true,
    },
    size: {
      type: Number,
      required: true,
      min: 0,
    },
    data: {
      type: Buffer,
      required: true,
    },
  },
  { timestamps: true }
);

portfolioAssetSchema.index({ portfolioId: 1, type: 1, updatedAt: -1 });

module.exports = mongoose.model("portfolio_assets", portfolioAssetSchema);
