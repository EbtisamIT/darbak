const assert = require("assert");
const { getResumeFactsFreshness } = require("../services/resumeFactsFreshness");

const baseFacts = {
  personalInfo: { fullName: "طالب تجريبي", major: "علوم الحاسب", phone: "0550000000" },
  experiences: [],
  projects: [{ id: "project-1", title: "نظام حجز", description: "تطبيق ويب" }],
  certifications: [],
  skills: ["React.js"],
};

const first = getResumeFactsFreshness({ verifiedFacts: baseFacts, workflow: {} });
assert.strictEqual(first.changed, true);
assert.strictEqual(first.baselineMissing, true);

const unchanged = getResumeFactsFreshness({
  verifiedFacts: baseFacts,
  workflow: { lastBuiltFactsHash: first.currentHash, lastBuiltFactsSnapshot: first.currentSnapshot },
});
assert.strictEqual(unchanged.changed, false);

const changed = getResumeFactsFreshness({
  verifiedFacts: { ...baseFacts, certifications: [{ id: "cert-1", title: "شهادة" }] },
  workflow: { lastBuiltFactsHash: first.currentHash, lastBuiltFactsSnapshot: first.currentSnapshot },
});
assert.strictEqual(changed.changed, true);
assert.ok(changed.changes.includes("شهادة جديدة أو محدثة"));

console.log("resume facts freshness tests passed");
