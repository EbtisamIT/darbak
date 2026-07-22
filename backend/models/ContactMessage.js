const mongoose = require("mongoose");

const contactMessageSchema = new mongoose.Schema(
  {
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 1800,
    },
    contact: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160,
    },
    emailStatus: {
      type: String,
      enum: ["not_configured", "sent", "failed"],
      default: "not_configured",
    },
    emailError: {
      type: String,
      default: "",
      trim: true,
      maxlength: 600,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("contact_messages", contactMessageSchema);
