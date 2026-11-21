const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true, unique: true },
  totalReserved: { type: Number, default: 0, min: 0 },
  dayKey: { type: String, default: "" },
  dayReserved: { type: Number, default: 0, min: 0 },
}, { timestamps: true, versionKey: false });

module.exports = mongoose.models.AutoApplyPilotQuota || mongoose.model("AutoApplyPilotQuota", schema);
