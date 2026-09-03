const assert = require("assert");
const {
  buildEnglishSummaryFreshness,
  mergeMasterSummaryProvenance,
} = require("../services/resumeSummaryFreshness");

const generated = mergeMasterSummaryProvenance({
  incoming: { summaryWriterVersion: "v3" },
  nextSummary: "A new summary.",
  generated: true,
  now: new Date("2026-09-03T10:00:00.000Z"),
});
assert.strictEqual(generated.summaryWriterVersion, "v3");
assert.strictEqual(generated.summaryUpdatedAt, "2026-09-03T10:00:00.000Z");

const unchanged = mergeMasterSummaryProvenance({
  existing: generated,
  previousSummary: "A new summary.",
  nextSummary: "A new summary.",
  now: new Date("2026-09-03T11:00:00.000Z"),
});
assert.strictEqual(unchanged.summaryUpdatedAt, generated.summaryUpdatedAt, "Opening or saving an unchanged summary does not refresh freshness");

const edited = mergeMasterSummaryProvenance({
  existing: generated,
  previousSummary: "A new summary.",
  nextSummary: "A student-approved edit.",
  now: new Date("2026-09-03T12:00:00.000Z"),
});
assert.strictEqual(edited.summaryUpdatedAt, "2026-09-03T12:00:00.000Z", "A student edit updates only master freshness metadata");

assert.deepStrictEqual(
  buildEnglishSummaryFreshness({
    masterProvenance: edited,
    englishProvenance: {
      sourceSummaryUpdatedAt: generated.summaryUpdatedAt,
      sourceSummaryVersion: "v3",
    },
  }).needsLocalizationRefresh,
  true,
  "An older English summary is marked stale without rewriting it"
);

assert.deepStrictEqual(
  buildEnglishSummaryFreshness({
    masterProvenance: edited,
    englishProvenance: {
      sourceSummaryUpdatedAt: edited.summaryUpdatedAt,
      sourceSummaryVersion: "v3",
    },
  }).needsLocalizationRefresh,
  false,
  "A current English summary stays current"
);

assert.strictEqual(
  buildEnglishSummaryFreshness({
    masterProvenance: {},
    englishProvenance: {},
  }).needsLocalizationRefresh,
  false,
  "Legacy summaries are not auto-marked or rewritten"
);

console.log("resumeSummaryFreshness tests passed");
