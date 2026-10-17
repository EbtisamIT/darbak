const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  rewardId: { type: mongoose.Schema.Types.ObjectId, ref: "ExperienceResumeReward", required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  language: { type: String, enum: ["ar", "en"], required: true },
  resumeData: { type: mongoose.Schema.Types.Mixed, required: true },
  pdf: { type: Buffer, required: true },
  finalizedAt: { type: Date, required: true, default: Date.now },
}, { versionKey: false });

module.exports = mongoose.model("ExperienceResumeSnapshot", schema);
