const mongoose = require("mongoose");

const suggestionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 1000,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("suggestions", suggestionSchema);
