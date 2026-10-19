const assert = require("assert");
const mongoose = require("mongoose");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const AnalyticsDaily = require("../models/AnalyticsDaily");
const JourneyFeedback = require("../models/JourneyFeedback");
const User = require("../models/User");
const { parseRange, safeFilter, pct, authoritativeCount, buildIdentityFunnel, firstRecordedAt } = require("../services/adminAnalyticsV2");

const now = new Date("2026-10-19T12:00:00.000Z");
const today = parseRange({ range: "today" }, now);
assert.strictEqual(today.start.toISOString(), "2026-10-18T21:00:00.000Z");
assert.strictEqual(today.end.toISOString(), "2026-10-19T21:00:00.000Z");
assert.strictEqual(parseRange({ range: "7" }, now).end - parseRange({ range: "7" }, now).start, 7 * 86400000);
assert.strictEqual(parseRange({ range: "30" }, now).end - parseRange({ range: "30" }, now).start, 30 * 86400000);
assert.throws(() => parseRange({ range: "custom", from: "2026-01-01", to: "2026-10-19" }), /INVALID_DATE_RANGE/);
assert.strictEqual(pct(1, 4), 25);
assert.strictEqual(pct(1, 0), null);
assert.deepStrictEqual(safeFilter({ lifecycleStage: "admin", major: " نظم المعلومات " }), {
  lifecycleStage: "", major: "نظم المعلومات", city: "", source: "",
});

assert.deepStrictEqual(User.schema.path("lifecycleStage").enumValues, ["student", "graduate", "unknown"]);
assert.ok(AnalyticsEvent.schema.indexes().some(([keys, options]) => keys.eventKey === 1 && options.unique));
assert.ok(AnalyticsDaily.schema.indexes().some(([keys, options]) => keys.day === 1 && options.unique));
assert.ok(JourneyFeedback.schema.indexes().some(([keys, options]) => keys.rewardId === 1 && options.unique));
assert.ok(mongoose.Types.ObjectId.isValid(new mongoose.Types.ObjectId()));

(async () => {
  const firstDate = new Date("2026-10-01T10:00:00Z");
  const observedQuery = {
    sort: ({ createdAt }) => { assert.strictEqual(createdAt, 1); return observedQuery; },
    select: (field) => { assert.strictEqual(field, "createdAt"); return observedQuery; },
    lean: async () => ({ createdAt: firstDate }),
  };
  assert.strictEqual(await firstRecordedAt({ findOne: ({ eventName }) => {
    assert.strictEqual(eventName, "page_view"); return observedQuery;
  } }, "page_view"), firstDate);
  const missingQuery = { sort: () => missingQuery, select: () => missingQuery, lean: async () => null };
  assert.strictEqual(await firstRecordedAt({ findOne: () => missingQuery }, "missing"), null);
  const historical = { start: new Date("2025-01-01T21:00:00Z"), end: new Date("2025-01-03T21:00:00Z") };
  let directReads = 0;
  const Model = { countDocuments: async () => { directReads += 1; return 9; } };
  const completeRollup = { aggregate: async () => [{ coveredDays: 2, count: 7 }] };
  assert.strictEqual(await authoritativeCount({ Daily: completeRollup, Model,
    metric: "record_user_signup", range: historical }), 7);
  assert.strictEqual(directReads, 0);
  assert.strictEqual(await authoritativeCount({ Daily: { aggregate: async () => [{ coveredDays: 1, count: 5 }] }, Model,
    metric: "record_user_signup", range: historical }), 9);
  assert.strictEqual(directReads, 1);
  let rewardPipeline;
  const Reward = { aggregate: async (pipeline) => { rewardPipeline = pipeline; return [{ count: 2 }]; } };
  assert.strictEqual(await authoritativeCount({ Daily: null, Model: Reward,
    Experience: { collection: { name: "experiences" } }, metric: "record_reward_granted",
    range: historical }), 2);
  assert.ok(rewardPipeline.some((stage) => stage.$match?.["experience.qaTest"]));
  const stages = await buildIdentityFunnel({ aggregate: async () => [{ step0: 10, step1: 6, step2: 2, step3: 4 }] }, {}, [
    { label: "فتح", events: ["open"] },
    { label: "بدأ", events: ["start"] },
    { label: "AI اختياري", events: ["ai"], optional: true },
    { label: "عاين", events: ["preview"] },
  ]);
  assert.strictEqual(stages[1].fromPrevious, 60);
  assert.strictEqual(stages[2].fromPrevious, null);
  assert.strictEqual(stages[3].fromPrevious, 66.7);
  console.log("adminAnalyticsV2 tests passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
