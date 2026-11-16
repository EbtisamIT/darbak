const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true, unique: true },
  educationLevel: { type: String, required: true },
  major: { type: String, default: "" },
  customMajor: { type: String, default: "" },
  preferredFields: { type: [String], default: [] },
  customField: { type: String, default: "" },
  preferredCities: { type: [String], default: [] },
  allowRemote: { type: Boolean, default: false },
  trainingTypes: { type: [String], default: [] },
  trainingStartDate: { type: Date, default: null },
  trainingDuration: { type: String, default: "" },
  excludedCompanyIds: { type: [String], default: [] },
  resumeSource: { type: String, enum: ["", "darbak_reward", "darbak_resume", "uploaded"], default: "" },
  resumeSnapshotId: { type: mongoose.Schema.Types.ObjectId, default: null },
  mode: { type: String, enum: ["review_first", "automatic"], default: "review_first" },
  paused: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model("AutoApplyProfile", schema);
