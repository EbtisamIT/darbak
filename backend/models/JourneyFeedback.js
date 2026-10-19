const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  kind: { type: String, enum: ["reward_resume", "experience_submission"], required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
  rewardId: { type: mongoose.Schema.Types.ObjectId, default: null },
  experienceId: { type: mongoose.Schema.Types.ObjectId, default: null },
  rating: { type: Number, min: 1, max: 4, default: null },
  ease: { type: String, enum: ["", "hard", "okay", "easy", "very_easy"], default: "" },
  barrier: { type: String, enum: ["", "many_questions", "unsure_what_to_write", "long_form", "technical_problem", "other"], default: "" },
  incentive: { type: String, enum: ["", "yes", "partly", "would_contribute_anyway"], default: "" },
  comment: { type: String, default: "", maxlength: 500 },
}, { timestamps: true });

schema.index({ kind: 1, rewardId: 1 }, { unique: true, partialFilterExpression: { rewardId: { $type: "objectId" } } });
schema.index({ kind: 1, experienceId: 1 }, { unique: true, partialFilterExpression: { experienceId: { $type: "objectId" } } });
schema.index({ kind: 1, createdAt: -1 });

module.exports = mongoose.model("JourneyFeedback", schema);
