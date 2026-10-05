const assert = require("assert");
const ApplicationTracker = require("../models/ApplicationTracker");
const CompanyApplication = require("../models/CompanyApplication");

const tracker = new ApplicationTracker({
  studentId: "507f1f77bcf86cd799439011",
  opportunityId: "507f1f77bcf86cd799439012",
  companyName: "شركة تدريب",
  roleTitle: "محلل أعمال",
  sourceType: "external_link",
  studentStatus: "applied",
});

assert.strictEqual(tracker.studentStatus, "applied");
assert.strictEqual(tracker.sourceType, "external_link");

const companyApplication = new CompanyApplication({
  companySlug: "test-company",
  organizationName: "شركة اختبار",
  fullName: "طالب اختبار",
  email: "student@example.com",
  normalizedEmail: "student@example.com",
});

assert.strictEqual(companyApplication.studentStatus, "applied");
console.log("application tracker tests passed");
const { manualFields, statusUpdate, followUpUpdate, trackerOpportunityFields, serializeTracker, markApplied, ensureTrackerIndex } = require("../services/applicationTracker");
const now = new Date("2026-10-03T09:00:00Z");
const manual = manualFields({ companyName: " جهة خارجية " }, now);
assert.strictEqual(manual.companyName, "جهة خارجية");
assert.strictEqual(manual.studentStatus, "applied");
assert.strictEqual(manual.appliedAt, now);
assert.strictEqual(manualFields({ companyName: "جهة", contactEmail: " Jobs@Example.com " }, now).contactEmail, "jobs@example.com");
assert.throws(() => manualFields({ companyName: "جهة", contactEmail: "invalid" }, now), /بريد الجهة/);
assert.strictEqual(followUpUpdate("sent", now).followUpSentAt, now);
assert.strictEqual(followUpUpdate("snooze", now).followUpSnoozedUntil.getTime(), now.getTime() + 3 * 86400000);
assert.strictEqual(followUpUpdate("dismiss", now).followUpDismissedAt, now);
assert.throws(() => followUpUpdate("unknown", now), /إجراء المتابعة/);
assert.deepStrictEqual(trackerOpportunityFields({ sourceType: "email" }, { logoUrl: "https://example.com/logo.png",
  applicationUrl: "mailto:jobs@example.com" }), { organizationLogoUrl: "https://example.com/logo.png", contactEmail: "jobs@example.com" });
assert.deepStrictEqual(trackerOpportunityFields({ sourceType: "external_link" }, { applicationUrl: "jobs@example.com" }),
  { contactEmail: "jobs@example.com" });
assert.deepStrictEqual(trackerOpportunityFields({ sourceType: "external_link" }, { applicationUrl: "https://example.com/apply" }), {});
assert.deepStrictEqual(trackerOpportunityFields({ sourceType: "darbak" }, { logoUrl: "https://example.com/logo.png",
  applicationUrl: "mailto:jobs@example.com" }), {});
assert.deepStrictEqual(trackerOpportunityFields({ sourceType: "email", contactEmail: "existing@example.com", organizationLogoUrl: "https://existing.test/logo.png" },
  { logoUrl: "https://example.com/logo.png", applicationUrl: "mailto:jobs@example.com" }), {});
assert.strictEqual(new ApplicationTracker({ ...manual, studentId: tracker.studentId }).validateSync(), undefined);
assert.throws(() => manualFields({ companyName: " " }), /اسم الجهة/);
assert.throws(() => statusUpdate({ studentStatus: "invented" }), /الحالة/);
assert.throws(() => statusUpdate({ followUpAt: "invalid" }), /التاريخ/);
assert.deepStrictEqual(statusUpdate({ note: " note ", companyStatus: "accepted" }, now), { note: "note", lastUpdatedAt: now });
const update = statusUpdate({ studentStatus: "interview", followUpAt: "2026-10-10T11:00:00+03:00", note: "مقابلة" }, now);
assert.strictEqual(update.studentStatus, "interview");
assert.strictEqual(update.followUpAt.toISOString(), "2026-10-10T08:00:00.000Z");
assert.strictEqual(serializeTracker({ ...manual, _id: tracker._id }).recordType, "tracker");
assert.deepStrictEqual(ApplicationTracker.schema.indexes().find(([, options]) => options.name === "tracker_student_opportunity_v2")[1].partialFilterExpression,
  { opportunityId: { $type: "objectId" } });

(async () => {
  const records = new Map();
  const Model = { findOneAndUpdate: async (filter, update) => {
    const key = `${filter.studentId}:${filter.opportunityId}`;
    const existing = records.get(key);
    if (!existing) records.set(key, update.$setOnInsert);
    return { value: records.get(key), lastErrorObject: { updatedExisting: Boolean(existing) } };
  } };
  const access = { accessUser: { _id: tracker.studentId }, email: "student@example.com" };
  const opportunity = { _id: tracker.opportunityId, organizationName: "شركة", title: "تدريب", cities: ["الرياض"], applicationMethod: "email",
    applicationUrl: "mailto:jobs@example.com", logoUrl: "https://example.com/logo.png" };
  const first = await markApplied(access, opportunity, Model, now);
  assert.strictEqual(first.alreadyExists, false);
  first.record.studentStatus = "interview";
  const second = await markApplied(access, opportunity, Model, new Date());
  assert.strictEqual(second.alreadyExists, true);
  assert.strictEqual(second.record.studentStatus, "interview", "Duplicate never resets manual progress");
  assert.strictEqual(records.size, 1);
  assert.ok(first.record.opportunityUrl.includes(String(opportunity._id)));
  assert.strictEqual(first.record.contactEmail, "jobs@example.com");
  assert.strictEqual(first.record.organizationLogoUrl, opportunity.logoUrl);
  await markApplied({ ...access, accessUser: { _id: "other-student" } }, opportunity, Model, now);
  assert.strictEqual(records.size, 2, "Ownership keys are student-scoped");
  const original = { ...ApplicationTracker.collection };
  const methods = ["createIndex", "indexes", "dropIndex"];
  const saved = Object.fromEntries(methods.map((method) => [method, ApplicationTracker.collection[method]]));
  const operations = [];
  ApplicationTracker.collection.createIndex = async () => operations.push("create-safe-index");
  ApplicationTracker.collection.indexes = async () => [{ name: "legacy", unique: true, key: { studentId: 1, opportunityId: 1 } }];
  ApplicationTracker.collection.dropIndex = async (name) => operations.push(`drop-${name}`);
  await ensureTrackerIndex();
  assert.deepStrictEqual(operations, ["create-safe-index", "drop-legacy"]);
  methods.forEach((method) => { ApplicationTracker.collection[method] = saved[method]; });
  assert.ok(original);
  const server = require("fs").readFileSync(require("path").join(__dirname, "../server.js"), "utf8");
  const handler = server.slice(server.indexOf("app.patch('/api/application-tracker/me/"), server.indexOf("app.post('/api/company-applications'"));
  assert.ok(handler.includes('return res.status(403)'), "Company status update is denied");
  assert.ok(handler.includes('sourceType: { $ne: "darbak" }'), "Forged tracker type cannot write legacy company records");
  assert.ok(handler.includes('$push: { statusHistory:'), "History is appended rather than replaced");
  assert.ok(handler.includes("/follow-up'"), "Follow-up uses an owned Tracker route");
  console.log("Application tracker PASS: manual validation, status/note/date, idempotency, ownership, partial index upgrade, company guard, history");
})().catch((error) => { console.error(error); process.exitCode = 1; });
