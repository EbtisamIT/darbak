const mongoose = require("mongoose");

const interviewQuestionSchema = new mongoose.Schema(
  {
    organizationName: {
      type: String,
      required: true,
      trim: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "companies",
      default: null,
      index: true,
    },
    city: {
      type: String,
      default: "",
      trim: true,
    },
    majorCategory: {
      type: String,
      default: "",
      trim: true,
    },
    major: {
      type: String,
      required: true,
      trim: true,
    },
    questions: {
      type: [String],
      default: [],
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: "أضف سؤال مقابلة واحدًا على الأقل",
      },
    },
    note: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    sourceType: {
      type: String,
      enum: ["direct", "public_summary"],
      default: "direct",
      index: true,
    },
    reviewedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

interviewQuestionSchema.index({ status: 1, companyId: 1, createdAt: -1 });

module.exports = mongoose.model("interview_questions", interviewQuestionSchema);
