const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true, index: true },
  source: { type: String, enum: ["darbak_reward", "darbak_resume", "uploaded"], required: true },
  filename: { type: String, default: "resume.pdf" },
  sha256: { type: String, required: true },
  pdf: { type: Buffer, required: true },
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false });

module.exports = mongoose.model("AutoApplyResume", schema);
