const assert = require("node:assert/strict");
const staticCandidates = require("../data/autoApplyStaticEmailCandidates.json");
const { candidateKey, blockedInbox, detectedPurpose, validateReview, uniqueCandidates, coverage, coverageBreakdown } = require("../services/autoApplyEmailNetwork");

const now = new Date("2026-10-24T12:00:00.000Z");
const candidate = { company: "جهة اختبار", email: "training@example.org" };
const evidence = {
  channelType: "evergreen_training", verificationStatus: "verified", evidenceUrl: "https://example.org/coop",
  evidenceType: "official_training_page", evidenceTextSummary: "تقبل الجهة طلبات التدريب التعاوني عبر البريد المذكور.",
  evidenceDate: "2026-09-01", majors: ["نظم المعلومات"], cities: ["الرياض"], allMajors: false, allSaudi: false,
};

assert.equal(uniqueCandidates(staticCandidates).length, 171);
assert.equal(new Set(staticCandidates.map((row) => row.email)).size, 165);
assert.equal(new Set(staticCandidates.map((row) => require("../services/companyDirectorySeeds").normalizeCompanyComparable(row.company))).size, 167);
assert.equal(candidateKey("شركة أفق", "TRAINING@EXAMPLE.ORG"), candidateKey("شركه افق", "training@example.org"));
assert.equal(uniqueCandidates([candidate, { ...candidate, email: "TRAINING@example.org" }]).length, 1);
assert.equal(uniqueCandidates([candidate, { ...candidate, email: "mailto:training@example.org." }]).length, 1);
assert.equal(uniqueCandidates([{ company: "جهة", email: "info@example.org" }])[0].initialStatus, "rejected");
assert.equal(uniqueCandidates([{ company: "جهة", email: "careers@example.org" }])[0].initialStatus, "likely");

for (const email of ["info@example.org", "support@example.org", "customerservice@example.org", "complaints@example.org", "procurement@example.org", "media@example.org"]) {
  assert.equal(blockedInbox(email), true);
  assert.throws(() => validateReview(evidence, { ...candidate, email }, now));
}
assert.equal(detectedPurpose("careers@example.org"), "careers");
assert.equal(detectedPurpose("hr@example.org"), "hr");
assert.equal(detectedPurpose("training@example.org"), "training");

const evergreen = validateReview(evidence, candidate, now);
assert.equal(evergreen.acceptsTrainingApplications, true);
assert.equal(evergreen.expiresAt.toISOString().slice(0, 10), "2027-10-24");
assert.deepEqual(evergreen.majors, ["نظم المعلومات"]);
assert.deepEqual(evergreen.cities, ["الرياض"]);

assert.throws(() => validateReview({ ...evidence, evidenceType: "historical_official_training_announcement" }, candidate, now));
assert.throws(() => validateReview({ ...evidence, evidenceType: "official_training_announcement" }, candidate, now));
assert.throws(() => validateReview({ ...evidence, evidenceDate: "2024-01-01" }, candidate, now));
assert.throws(() => validateReview({ ...evidence, evidenceType: "official_careers_page", evidenceTextSummary: "أرسلوا السيرة إلى بريد التوظيف." }, candidate, now));
assert.equal(validateReview({ ...evidence, evidenceType: "official_careers_page" }, candidate, now).acceptsTrainingApplications, true);
assert.equal(validateReview({ ...evidence, evidenceType: "repeated_official_training_announcements" }, candidate, now).acceptsTrainingApplications, true);

const active = validateReview({ ...evidence, channelType: "active_opportunity", evidenceType: "official_training_announcement", expiresAt: "2026-12-01" }, candidate, now);
assert.equal(active.acceptsTrainingApplications, true);
assert.throws(() => validateReview({ ...evidence, channelType: "active_opportunity", evidenceType: "official_training_announcement", expiresAt: "2025-12-01" }, candidate, now));
assert.throws(() => validateReview({ ...evidence, channelType: "active_opportunity", evidenceType: "official_training_announcement", evidenceDate: "2024-01-01", expiresAt: "" }, candidate, now));
const likely = validateReview({ ...evidence, channelType: "hr_general", verificationStatus: "likely", evidenceType: "" }, candidate, now);
assert.equal(likely.acceptsTrainingApplications, false);
assert.equal(likely.verifiedAt, null);
assert.throws(() => validateReview({ ...evidence, verificationStatus: "rejected" }, candidate, now));
assert.equal(validateReview({ ...evidence, verificationStatus: "rejected", rejectionReason: "no_official_evidence", reviewerNote: "Official search did not confirm training applications." }, candidate, now).rejectionReason, "no_official_evidence");

const verifiedRows = [
  { ...evergreen, companyNormalized: "one" },
  { ...evergreen, companyNormalized: "one", email: "another@example.org" },
  { ...evergreen, companyNormalized: "two", majors: [], cities: [] },
  { ...evergreen, companyNormalized: "three", expiresAt: new Date("2025-01-01") },
  { ...active, companyNormalized: "four", majors: ["نظم المعلومات"], cities: ["جدة"] },
];
assert.deepEqual(coverage(verifiedRows, "evergreen_training", now), [{ major: "نظم المعلومات", city: "الرياض", companies: 1 }]);
assert.deepEqual(coverage(verifiedRows, "active_opportunity", now), [{ major: "نظم المعلومات", city: "جدة", companies: 1 }]);
assert.deepEqual(coverage([{ ...evergreen, companyNormalized: "one", majors: [], cities: [] }], "evergreen_training", now), []);
assert.equal(coverageBreakdown(verifiedRows, now).city.Riyadh, 1);
assert.equal(coverageBreakdown(verifiedRows, now).city.Unknown, 1);
assert.equal(coverageBreakdown(verifiedRows, now).major.Computing, 2);

console.log("Auto Apply email classification, deduplication, and coverage: PASS");
