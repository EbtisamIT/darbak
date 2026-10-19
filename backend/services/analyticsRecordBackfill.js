const DAY_MS = 86400000;
const SOURCE = "__authoritative_record";

const metricDefinitions = [
  { name: "record_user_signup", model: "User", field: "createdAt", match: { contact: { $ne: "" }, isAdmin: { $ne: true } } },
  { name: "record_subscription", model: "Subscription", field: "createdAt", match: { status: { $ne: "pending" } } },
  { name: "record_application", model: "Tracker", field: "createdAt", match: {} },
  { name: "record_experience_submitted", model: "Experience", field: "createdAt", match: { qaTest: { $ne: true } } },
  { name: "record_experience_approved", model: "Experience", field: "reviewedAt", match: { status: "approved", qaTest: { $ne: true } } },
  { name: "record_experience_rejected", model: "Experience", field: "reviewedAt", match: { status: "rejected", qaTest: { $ne: true } } },
  { name: "record_interview_submitted", model: "Interview", field: "createdAt", match: {} },
  { name: "record_reward_granted", model: "Reward", field: "grantedAt", match: {}, excludeQa: true },
  { name: "record_reward_redeemed", model: "Reward", field: "redeemedAt", match: { status: "redeemed" }, excludeQa: true },
  { name: "record_reward_resume_finalized", model: "Snapshot", field: "finalizedAt", match: {}, excludeQa: true, viaReward: true },
];

const dayStart = (day) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day))) throw new Error("INVALID_BACKFILL_DATE");
  const date = new Date(`${day}T00:00:00+03:00`);
  if (Number.isNaN(date.getTime()) || new Date(date.getTime() + 3 * 3600000).toISOString().slice(0, 10) !== day) {
    throw new Error("INVALID_BACKFILL_DATE");
  }
  return date;
};

const boundedWindow = (from, to) => {
  const start = dayStart(from);
  const last = dayStart(to);
  const days = Math.round((last - start) / DAY_MS) + 1;
  if (days < 1 || days > 7) throw new Error("BACKFILL_WINDOW_MUST_BE_1_TO_7_DAYS");
  const today = new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10);
  if (to >= today) throw new Error("BACKFILL_COMPLETED_DAYS_ONLY");
  return { start, end: new Date(last.getTime() + DAY_MS), days };
};

const metricPipeline = (definition, window, collections) => {
  const pipeline = [
    { $match: { ...definition.match, [definition.field]: { $gte: window.start, $lt: window.end } } },
  ];
  if (definition.viaReward) {
    pipeline.push(
      { $lookup: { from: collections.reward, localField: "rewardId", foreignField: "_id", as: "reward" } },
      { $unwind: "$reward" },
      { $set: { experienceId: "$reward.experienceId" } }
    );
  }
  if (definition.excludeQa) {
    pipeline.push(
      { $lookup: { from: collections.experience, localField: "experienceId", foreignField: "_id", as: "experience" } },
      { $unwind: "$experience" },
      { $match: { "experience.qaTest": { $ne: true } } }
    );
  }
  pipeline.push({ $group: {
    _id: { $dateToString: { format: "%Y-%m-%d", date: `$${definition.field}`, timezone: "Asia/Riyadh" } },
    count: { $sum: 1 },
  } });
  return pipeline;
};

const backfillWindow = async (models, from, to, { confirm = false } = {}) => {
  const window = boundedWindow(from, to);
  const collections = { reward: models.Reward.collection.name, experience: models.Experience.collection.name };
  const preview = [];
  const operations = [];
  for (const definition of metricDefinitions) {
    const rows = await models[definition.model].aggregate(metricPipeline(definition, window, collections));
    const byDay = new Map(rows.map((row) => [row._id, Number(row.count || 0)]));
    for (let offset = 0; offset < window.days; offset += 1) {
      const day = new Date(window.start.getTime() + offset * DAY_MS + 3 * 3600000).toISOString().slice(0, 10);
      const count = byDay.get(day) || 0;
      const dimensions = { day, eventName: definition.name, lifecycleStage: "unknown", major: "", city: "", source: SOURCE };
      preview.push({ day, metric: definition.name, count });
      operations.push({ updateOne: { filter: dimensions, update: {
        $setOnInsert: dimensions, $set: { count, updatedAt: new Date() },
      }, upsert: true } });
    }
  }
  if (confirm && operations.length) await models.Daily.bulkWrite(operations, { ordered: false });
  return { from, to, dryRun: !confirm, metrics: metricDefinitions.length, days: window.days,
    rows: preview, total: preview.reduce((sum, row) => sum + row.count, 0) };
};

module.exports = { SOURCE, metricDefinitions, boundedWindow, metricPipeline, backfillWindow };
