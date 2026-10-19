const mongoose = require("mongoose");

// A bounded event-count rollup. Unique-user and retention questions use the
// indexed event stream because summing daily uniques would double count users.
const schema = new mongoose.Schema({
  day: { type: String, required: true },
  eventName: { type: String, required: true },
  lifecycleStage: { type: String, default: "unknown" },
  major: { type: String, default: "" },
  city: { type: String, default: "" },
  source: { type: String, default: "" },
  count: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now },
});

schema.index({ day: 1, eventName: 1, lifecycleStage: 1, major: 1, city: 1, source: 1 }, { unique: true });
schema.index({ eventName: 1, day: 1 });

module.exports = mongoose.model("AnalyticsDaily", schema);
