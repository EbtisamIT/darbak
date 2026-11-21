const assert = require("node:assert/strict");
const { validateProfile, evaluateChannel, applicationMessage, isCurrentVerifiedChannel } = require("../services/autoApplyV1");

const now = new Date("2026-11-01T12:00:00.000Z");
const profile = validateProfile({ educationLevel: "bachelor", major: "نظم المعلومات", preferredFields: ["تحليل البيانات"],
  preferredCities: ["الرياض"], allowRemote: false, trainingTypes: ["coop"], mode: "automatic" });
assert.equal(profile.mode, "review_first");
const channel = { company: "جهة اختبار", companyNormalized: "جهة اختبار", email: "training@example.org",
  verificationStatus: "verified", acceptsTrainingApplications: true, channelType: "evergreen_training",
  majors: ["Information Systems"], cities: ["Riyadh"], preferredFields: ["تحليل البيانات"] };

assert.equal(isCurrentVerifiedChannel(channel, now), true);
assert.equal(isCurrentVerifiedChannel({ ...channel, verificationStatus: "likely" }, now), false);
assert.equal(isCurrentVerifiedChannel({ ...channel, expiresAt: new Date("2026-10-01") }, now), false);
assert.equal(evaluateChannel(profile, channel, null, false, now).eligibility, "eligible");
assert.deepEqual(evaluateChannel(profile, channel, null, false, now).matchedFields, ["تحليل البيانات"]);
assert.equal(evaluateChannel(profile, { ...channel, majors: [] }, null, false, now).eligibility, "needs_review");
assert.equal(evaluateChannel(profile, { ...channel, cities: [] }, null, false, now).eligibility, "needs_review");
assert.equal(evaluateChannel(profile, { ...channel, preferredFields: [] }, null, false, now).eligibility, "needs_review");
assert.equal(evaluateChannel(profile, { ...channel, majors: ["المحاسبة"] }, null, false, now).eligibility, "not_eligible");
assert.equal(evaluateChannel(profile, { ...channel, cities: ["جدة"] }, null, false, now).eligibility, "not_eligible");
assert.equal(evaluateChannel(profile, channel, null, true, now), null);
assert.equal(evaluateChannel({ ...profile, excludedCompanyIds: ["جهة اختبار"] }, channel, null, false, now), null);
assert.equal(evaluateChannel(profile, { ...channel, cities: [], remote: true }, null, false, now).eligibility, "not_eligible");
assert.equal(evaluateChannel({ ...profile, allowRemote: true }, { ...channel, cities: [], remote: true }, null, false, now).eligibility, "eligible");
assert.equal(evaluateChannel(profile, channel, { educationLevels: ["diploma"] }, false, now).eligibility, "not_eligible");
assert.throws(() => validateProfile({ ...profile, preferredFields: [] }));
assert.throws(() => validateProfile({ ...profile, preferredFields: ["أخرى"] }));

const evergreen = applicationMessage({ profile, channel, studentName: "سارة" });
assert.match(evergreen.subject, /طلب تدريب تعاوني/);
assert.match(evergreen.body, /تحليل البيانات/);
assert.doesNotMatch(evergreen.body, /undefined|null/);
const specific = applicationMessage({ profile, channel, opportunity: { title: "تدريب محللة بيانات" }, studentName: "سارة" });
assert.match(specific.subject, /تدريب محللة بيانات/);
assert.match(specific.body, /جهة اختبار/);
assert.doesNotMatch(specific.body, /undefined|null/);

// No sending route, tracker mutation, ResumeProfile writer, or external-form automation.
const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "../services/autoApplyV1Routes.js"), "utf8");
assert.doesNotMatch(source, /sendMail|sendEmail|markApplied|ResumeProfile\.update|app\.post\(.+send/i);
console.log("Auto Apply V1 matching, messages, and dry-run boundaries: PASS");
