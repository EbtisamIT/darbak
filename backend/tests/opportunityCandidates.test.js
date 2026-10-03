const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Candidate = require("../models/OpportunityCandidate");
const Opportunity = require("../models/Opportunity");
const Company = require("../models/Company");
const { cleanOpportunityUrl, inputSchema, matchOpportunity, candidateToOpportunity, buildCandidateDiff,
  hasAdditionalData, getMissingFields, isPublishable } = require("../services/opportunityCandidateData");
const { createOpportunityCandidate, classifyCandidate, publishCandidate, existingEmails } = require("../services/opportunityCandidates");
const { seedOpportunityCandidates } = require("../services/opportunityCandidateSeed");
const { createOpportunityCandidateRouter } = require("../services/opportunityCandidateRoutes");

const base = inputSchema.parse({
  title: "تدريب تعاوني تسويق", company: "أرامكو السعودية", cities: ["الرياض"], majors: ["التسويق"],
  programType: "coop", applicationUrl: "https://example.com/jobs/123?jobId=123&utm_source=chatgpt", sourceUrl: "https://example.com/jobs/123",
  verification: { urlWorks: true, officialSource: true, appearsOpen: true, dateVerified: true, companyVerified: true },
});
const existing = { _id: "000000000000000000000001", ...candidateToOpportunity(base) };

assert.equal(base.applicationUrl, "https://example.com/jobs/123?jobId=123");
const cleaned = new URL(cleanOpportunityUrl("https://example.com/?jobId=1&requisitionId=2&token=secret&utm_campaign=a&fbclid=x&gclid=y&referrer=z&via=chatgpt&chatgpt_tracking=1"));
assert.deepEqual([...cleaned.searchParams.keys()], ["jobId", "requisitionId", "token"]);
assert.equal(cleanOpportunityUrl("https://example.com/#/job/123"), "https://example.com/#/job/123");
assert.throws(() => cleanOpportunityUrl("javascript:alert(1)"));
assert.throws(() => inputSchema.parse({ applicationUrl: "https://user:pass@example.com" }));
assert.deepEqual(base.responsibilities, []);
assert.deepEqual(base.requirements, []);
assert.equal(base.deadline, null);
assert.ok(getMissingFields(base).includes("deadline"));
assert.ok(isPublishable(base));
assert.ok(!isPublishable({ ...base, verification: {} }));
assert.ok(!isPublishable({ ...base, deadline: new Date("2000-01-01") }));
assert.throws(() => inputSchema.parse({ confidenceScore: 101 }));
assert.throws(() => inputSchema.parse({ deadline: "2026-02-30" }));
assert.throws(() => inputSchema.parse({ discoveredEmails: [{ email: "bad" }] }));
assert.deepEqual(inputSchema.parse({ responsibilities: ["", "  ", "مهمة", "مهمة"] }).responsibilities, ["مهمة"]);
assert.ok(matchOpportunity(base, existing));
assert.equal(matchOpportunity(base, { ...existing, organizationName: "الخطوط السعودية" }), 0);
assert.equal(matchOpportunity(base, { ...existing, cities: ["جدة"] }), 0);
assert.equal(matchOpportunity(base, { ...existing, title: "برنامج الخريجين", programType: "graduate" }), 0);
assert.equal(matchOpportunity(base, { ...existing, applicationUrl: "", sourceUrl: "" }), 0, "title alone must not match");
assert.equal(matchOpportunity({ ...base, applicationUrl: "https://example.com/#/job/1", sourceUrl: "" },
  { ...existing, applicationUrl: "https://example.com/#/job/2", sourceUrl: "" }), 0, "SPA job identifiers must remain distinct");
assert.ok(hasAdditionalData({ ...base, deadline: new Date("2099-01-01") }, existing));
assert.equal(hasAdditionalData(base, existing), false);
assert.equal(matchOpportunity({ ...base, deadline: new Date("2099-01-01"), applicationUrl: "https://example.com/careers", sourceUrl: "" },
  { ...existing, deadline: new Date("2098-01-01"), applicationUrl: "https://example.com/careers", sourceUrl: "" }), 0);
assert.ok(buildCandidateDiff({ ...base, description: "وصف جديد" }, existing).some((v) => v.field === "note" && v.changed));
assert.equal(candidateToOpportunity(base).note, "", "no invented tasks/requirements");
assert.equal(candidateToOpportunity(base).sourceType, "admin");

// Exercise the actual services with in-memory persistence boundaries. These
// doubles simulate atomic rollback; live replica-set verification is separate.
let opportunities = [], candidates = [], failure = false, serial = 10;
const id = () => (++serial).toString(16).padStart(24, "0");
const matches = (row, filter) => Object.entries(filter).every(([key, value]) => {
  if (value?.$ne !== undefined) return String(row[key]) !== String(value.$ne);
  if (value?.$nin) return !value.$nin.includes(row[key]);
  return row[key] === value;
});
const query = (value) => ({ select() { return this; }, session() { return this; }, lean() { return this; },
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
  async *cursor() { yield* value; },
});
const doc = (data, store) => {
  const record = { ...structuredClone(data), _id: data._id || id(), updatedAt: data.updatedAt || new Date(),
    toObject() { const { save, toObject, ...fields } = this; return structuredClone(fields); },
    async save() {
      if (failure && store === "candidates") throw new Error("simulated persistence failure");
      const target = store === "candidates" ? candidates : opportunities;
      const index = target.findIndex((v) => v._id === this._id);
      if (index < 0) target.push(this); else target[index] = this;
      return this;
    },
  };
  return record;
};
Candidate.find = (filter) => query(candidates.filter((v) => matches(v, filter)));
Candidate.findById = (key) => query(candidates.find((v) => v._id === key) || null);
Candidate.create = async (data) => { const record = doc(data, "candidates"); await record.save(); return record; };
Opportunity.find = () => query(opportunities);
Opportunity.findById = (key) => query(opportunities.find((v) => v._id === key) || null);
Opportunity.create = async (rows) => { const records = rows.map((v) => doc(v, "opportunities")); for (const record of records) await record.save(); return records; };
Company.find = () => query([]);
Company.distinct = async () => ["training@example.com"];
mongoose.connection.transaction = async (callback) => {
  const backup = [opportunities.map((v) => v.toObject ? v.toObject() : structuredClone(v)), candidates.map((v) => v.toObject())];
  try { await callback({}); } catch (error) {
    opportunities = backup[0].map((v) => doc(v, "opportunities")); candidates = backup[1].map((v) => doc(v, "candidates")); throw error;
  }
};
const publicationOptions = { sanitizeOpportunityPayload: (v) => v, containsBlockedTerms: () => false };

(async () => {
  await new Candidate(base).validate();
  assert.equal((await classifyCandidate(base)).status, "ready_for_review");
  opportunities = [existing];
  assert.equal((await classifyCandidate(base)).status, "duplicate");
  assert.equal((await classifyCandidate({ ...base, deadline: new Date("2099-01-01") })).status, "update_existing");
  opportunities = [existing, { ...existing, _id: id() }];
  assert.equal((await classifyCandidate(base)).status, "needs_verification", "ambiguous matches must be reviewed");
  opportunities = [];
  const candidate = await createOpportunityCandidate(base);
  assert.equal((await createOpportunityCandidate(base)).status, "duplicate", "inbox duplicate detected");
  failure = true;
  await assert.rejects(() => publishCandidate(candidate._id, publicationOptions), /persistence failure/);
  assert.equal(opportunities.length, 0, "rollback orphan opportunity");
  assert.equal(candidates[0].status, "ready_for_review", "failed publish keeps candidate unchanged");
  failure = false;
  await publishCandidate(candidate._id, publicationOptions);
  assert.equal(opportunities.length, 1);
  assert.equal(candidates[0].status, "published");
  await publishCandidate(candidate._id, publicationOptions);
  assert.equal(opportunities.length, 1, "repeat publication is idempotent");
  const update = await createOpportunityCandidate({ ...base, deadline: new Date("2099-01-01") });
  assert.equal(update.status, "update_existing");
  const updatedAt = opportunities[0].updatedAt;
  await assert.rejects(() => publishCandidate(update._id, { ...publicationOptions, mode: "update", fields: ["deadline"], expectedUpdatedAt: "2000-01-01" }), /تغيّرت الفرصة/);
  await publishCandidate(update._id, { ...publicationOptions, mode: "update", fields: ["deadline"], expectedUpdatedAt: updatedAt });
  assert.equal(opportunities.length, 1);
  assert.equal(new Date(opportunities[0].deadline).getUTCFullYear(), 2099);
  const mail = await existingEmails([{ discoveredEmails: [{ email: "training@example.com" }] }]);
  assert.ok(mail.has("training@example.com"));
  const router = createOpportunityCandidateRouter({ ...publicationOptions, requireAdmin: (req, res, next) => req.headers["x-admin-password"] === "test" ? next() : res.status(401).json({ error: "Unauthorized" }) });
  let code;
  router.stack[0].handle({ headers: {} }, { status(v) { code = v; return this; }, json() {} }, () => assert.fail("unauthorized reached handler"));
  assert.equal(code, 401, "all inbox routes behind existing admin guard");
  process.env.NODE_ENV = "production";
  process.env.ENABLE_OPPORTUNITY_INBOX_SEED = "true";
  await assert.rejects(seedOpportunityCandidates, /التطوير/);
  process.env.NODE_ENV = "development";
  opportunities = []; candidates = [];
  const demo = await seedOpportunityCandidates();
  assert.equal(demo.length, 5);
  assert.ok(demo.every((v) => v.isDemo));
  assert.deepEqual(demo.map((v) => v.status), ["ready_for_review", "needs_verification", "duplicate", "update_existing", "ready_for_review"]);
  assert.ok(demo[4].discoveredEmails[0].email.endsWith("@example.com"));
  await assert.rejects(() => publishCandidate(demo[0]._id, publicationOptions), /التجريبية/);
  assert.equal(opportunities.length, 0);
  assert.equal((await seedOpportunityCandidates()).length, 5, "seed rerun does not duplicate");
  console.log("Opportunity Inbox: normalization, matching, schema, auth, atomic publication, updates, idempotency, email and demo tests passed.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
