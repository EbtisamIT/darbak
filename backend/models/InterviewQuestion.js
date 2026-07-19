const mongoose = require("mongoose");

const interviewQuestionSchema = new mongoose.Schema(
  {
    organizationName: {
      type: String,
      required: true,
      trim: true,
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

module.exports = mongoose.model("interview_questions", interviewQuestionSchema);
