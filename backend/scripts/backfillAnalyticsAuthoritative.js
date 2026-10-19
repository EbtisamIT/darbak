require("dotenv").config();
const mongoose = require("mongoose");
const { backfillWindow } = require("../services/analyticsRecordBackfill");

const args = process.argv.slice(2);
const value = (name) => args[args.indexOf(name) + 1];
const from = args.includes("--from") ? value("--from") : "";
const to = args.includes("--to") ? value("--to") : "";
const confirm = args.includes("--confirm");

if (!process.env.MONGO_URI) {
  process.stderr.write("MONGO_URI is required. No records changed.\n");
  process.exitCode = 1;
} else {
  (async () => {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
    const result = await backfillWindow({
      User: require("../models/User"),
      Subscription: require("../models/Subscription"),
      Tracker: require("../models/ApplicationTracker"),
      Experience: require("../models/Experience"),
      Interview: require("../models/InterviewQuestion"),
      Reward: require("../models/ExperienceResumeReward"),
      Snapshot: require("../models/ExperienceResumeSnapshot"),
      Daily: require("../models/AnalyticsDaily"),
    }, from, to, { confirm });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  })().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }).finally(() => mongoose.disconnect());
}
