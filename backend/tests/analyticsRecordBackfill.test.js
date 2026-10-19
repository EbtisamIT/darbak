const assert = require("assert");
const {
  SOURCE, metricDefinitions, boundedWindow, metricPipeline, backfillWindow,
} = require("../services/analyticsRecordBackfill");

assert.strictEqual(metricDefinitions.length, 10);
assert.ok(metricDefinitions.every((item) => item.name.startsWith("record_")));
assert.strictEqual(SOURCE, "__authoritative_record");
assert.throws(() => boundedWindow("2025-01-01", "2025-01-09"), /1_TO_7_DAYS/);
assert.throws(() => boundedWindow("2025-02-31", "2025-02-31"), /INVALID_BACKFILL_DATE/);
assert.ok(metricPipeline(metricDefinitions.find((item) => item.name === "record_reward_granted"),
  boundedWindow("2025-01-01", "2025-01-01"), { reward: "rewards", experience: "experiences" })
  .some((stage) => stage.$match?.["experience.qaTest"]));

const writes = [];
const fakeModel = (rows = []) => ({ collection: { name: "fake" }, aggregate: async () => rows });
const models = Object.fromEntries(["User", "Subscription", "Tracker", "Experience", "Interview", "Reward", "Snapshot"]
  .map((name) => [name, fakeModel(name === "User" ? [{ _id: "2025-01-01", count: 3 }] : [])]));
models.Daily = { bulkWrite: async (operations) => { writes.push(operations); } };

(async () => {
  const preview = await backfillWindow(models, "2025-01-01", "2025-01-02");
  assert.strictEqual(preview.dryRun, true);
  assert.strictEqual(preview.rows.length, 20);
  assert.strictEqual(preview.total, 3);
  assert.strictEqual(writes.length, 0);
  await backfillWindow(models, "2025-01-01", "2025-01-02", { confirm: true });
  await backfillWindow(models, "2025-01-01", "2025-01-02", { confirm: true });
  assert.strictEqual(writes.length, 2);
  assert.deepStrictEqual(writes[0].map((item) => item.updateOne.filter),
    writes[1].map((item) => item.updateOne.filter));
  assert.ok(writes[0].every((item) => item.updateOne.update.$set.count >= 0));
  assert.ok(writes[0].every((item) => item.updateOne.filter.source === SOURCE));
  console.log("analytics record backfill tests passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
