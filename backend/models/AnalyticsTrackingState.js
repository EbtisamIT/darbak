const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  startedAt: { type: Date, required: true },
}, { versionKey: false });

module.exports = mongoose.model("AnalyticsTrackingState", schema);
