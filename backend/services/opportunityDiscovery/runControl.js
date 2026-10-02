const Run = require("../../models/OpportunityDiscoveryRun");
const { fail } = require("../opportunityCandidates");

function schedulingConfiguration(env = process.env) {
  const requested = Number(env.MAX_DAILY_RUNS || env.DISCOVERY_MAX_DAILY_RUNS || 2);
  return { enabled: false, timezone: "Asia/Riyadh", times: ["08:00", "20:00"],
    maxDailyRuns: Number.isInteger(requested) && requested > 0 ? Math.min(requested, 2) : 2,
    maxSearchQueriesPerRun: require("./queryPack").searchSettings(env).maxQueries };
}
function dayWindow(now = new Date()) {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const start = new Date(`${date}T00:00:00+03:00`);
  return { date, start, end: new Date(start.getTime() + 86400000) };
}
async function admitRun(payload, now = new Date()) {
  const { date, start, end } = dayWindow(now);
  if (await Run.exists({ lock: "discovery" })) fail(409, "SKIP_ALREADY_RUNNING: يوجد تشغيل قيد التنفيذ.");
  // Count old records too. A unique daily slot and the unique global lease are
  // acquired together by a single insert, preventing cross-worker races.
  const used = await Run.countDocuments({ runType: { $ne: "known-url" }, createdAt: { $gte: start, $lt: end } });
  if (used >= schedulingConfiguration().maxDailyRuns) fail(429, "MAX_DAILY_RUNS: تم بلوغ حد التشغيل اليومي (بتوقيت الرياض).");
  try {
    return await Run.create({ ...payload, startedAt: now, budgetDay: date, dailySlot: used + 1 });
  } catch (error) {
    if (error.code !== 11000) throw error;
    if (await Run.exists({ lock: "discovery" })) fail(409, "SKIP_ALREADY_RUNNING: يوجد تشغيل قيد التنفيذ.");
    fail(429, "MAX_DAILY_RUNS: تم حجز حصة التشغيل بواسطة طلب آخر.");
  }
}
function runMetrics(run) {
  const s = run.summary || {}, startedAt = run.startedAt || run.createdAt;
  return { _id: run._id, runType: run.runType, status: run.status, startedAt, finishedAt: run.finishedAt,
    durationMs: run.durationMs ?? (run.finishedAt ? Math.max(0, new Date(run.finishedAt) - new Date(startedAt)) : null),
    queries: s.searchQueriesRun || 0, results: s.searchResultsReceived || 0,
    candidatesCreated: s.candidatesCreated || 0, duplicates: s.duplicates || 0, updates: s.updates || 0,
    errors: s.errors || (run.error ? 1 : 0) };
}
module.exports = { schedulingConfiguration, dayWindow, admitRun, runMetrics };
