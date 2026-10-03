// Isolated database only. Never reads .env or a production Mongo URI.
const assert = require("node:assert/strict");
const path = require("node:path");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require(path.join(process.env.INBOX_TEST_RUNTIME, "node_modules/mongodb-memory-server"));
const Candidate = require("../models/OpportunityCandidate");
const Opportunity = require("../models/Opportunity");
const { createOpportunityCandidate, editCandidate, publishCandidate } = require("../services/opportunityCandidates");
const { candidateToOpportunity } = require("../services/opportunityCandidateData");
const { fields, normalizeDraft } = require("../services/opportunityInboxDraft");
const { importOpportunities, prepare } = require("../services/opportunityDiscovery/importBridge");
let repl;
(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(repl.getUri(), { dbName: "simplified_inbox" });
  await Promise.all([Candidate.init(), Opportunity.init()]);
  const facts = { organizationName: "Test Company", title: "COOP Accounting", cities: [], specialties: [],
    note: "", sourceUrl: "https://example.com/jobs/123?utm_source=chatgpt&jobId=123",
    applicationUrl: "", deadline: null, trainingMode: "", hasReward: "", featured: false };
  const candidate = await createOpportunityCandidate(facts);
  assert.equal(candidate.status, "needs_verification");
  assert.deepEqual(candidate.responsibilities, []);
  assert.deepEqual(candidate.requirements, []);
  const draft = candidateToOpportunity(candidate.toObject());
  assert.equal(draft.note, ""); assert.deepEqual(draft.cities, []); assert.deepEqual(draft.specialties, []);
  assert.equal(draft.sourceUrl, "https://example.com/jobs/123?jobId=123");
  assert.equal(draft.deadline, null);
  assert.ok(Object.keys(draft).every((key) => fields.includes(key)));
  assert.ok(!Object.hasOwn(draft, "responsibilities"));
  const edited = await editCandidate(candidate._id, { opportunityDraft: { ...draft,
    cities: ["الرياض"], specialties: ["المحاسبة"], majorCategories: ["المالية والإدارية"],
    note: "المهام:\n- Support bookkeeping.\n\nالشروط:\n- Accounting student.",
    trainingEnvironment: "mixed", targetAudience: "all", trainingMode: "hybrid", hasReward: "yes",
    applicationMethod: "website", applicationUrl: "https://example.com/jobs/123/apply?utm_medium=chatgpt&jobId=123",
    logoUrl: "https://example.com/logo.png", featured: true, submitterContact: "hr@example.com" } });
  const expected = edited.opportunityDraft.toObject();
  assert.equal(edited.status, "needs_verification", "editing facts does not assert verification");
  assert.equal(expected.city, "الرياض");
  const options = { sanitizeOpportunityPayload: (value) => value, containsBlockedTerms: () => false };
  await publishCandidate(edited._id, options);
  const published = await Opportunity.findById((await Candidate.findById(edited._id)).publishedOpportunityId).lean();
  for (const field of fields) assert.deepEqual(published[field] ?? null, expected[field] ?? null, field);
  await publishCandidate(edited._id, options);
  assert.equal(await Opportunity.countDocuments(), 1, "publication is idempotent");
  const duplicate = await createOpportunityCandidate(expected);
  assert.equal(duplicate.status, "duplicate");
  await assert.rejects(() => publishCandidate(duplicate._id, options), /حالة المرشح/);
  const update = await createOpportunityCandidate({ ...expected, deadline: "2099-01-01" });
  assert.equal(update.status, "update_existing");
  await publishCandidate(update._id, { ...options, mode: "update", fields: ["deadline"], expectedUpdatedAt: published.updatedAt });
  assert.equal(await Opportunity.countDocuments(), 1);
  const legacy = await createOpportunityCandidate({ company: "Legacy", title: "Intern", sourceUrl: "https://example.com/jobs/legacy",
    responsibilities: ["Actual task"], requirements: ["Actual eligibility"], duration: "8 weeks" });
  assert.match(legacy.opportunityDraft.note, /Actual task/);
  assert.match(legacy.opportunityDraft.note, /Actual eligibility/);
  assert.match(legacy.opportunityDraft.note, /8 weeks/);
  assert.equal(legacy.opportunityDraft.trainingMode, "", "no inferred onsite mode");
  const legacyEdit = await editCandidate(legacy._id, { description: "Updated actual description" });
  assert.match(legacyEdit.opportunityDraft.note, /Updated actual description/);
  assert.match(legacyEdit.opportunityDraft.note, /Actual task/);
  assert.equal((await createOpportunityCandidate({ title: "Unknown company internship", sourceUrl: "https://example.com/jobs/unknown" })).status, "needs_verification");
  assert.equal((await createOpportunityCandidate({ title: "Unknown company internship", sourceUrl: "https://example.com/jobs/unknown?utm_source=chatgpt" })).status, "duplicate");
  assert.throws(() => normalizeDraft({ cities: "not an array", hasReward: "invalid" }));
  assert.throws(() => normalizeDraft({ sourceUrl: "javascript:alert(1)" }));
  const body = { source: "darbak_coop_sweep", runId: "canonical-import", opportunities: [{ ...facts,
    organizationName: "Import Test", sourceType: "admin", status: "ready_for_review", featured: true,
    isDarbakApplication: true, companyApplicationCampaignId: String(new mongoose.Types.ObjectId()),
    verification: { officialSource: true }, evidenceLinks: ["https://example.com/proof?utm_source=chatgpt"] }] };
  assert.equal(prepare(body).errors.length, 0);
  const before = await Candidate.countDocuments();
  const dry = await importOpportunities(body, { dryRun: true });
  assert.equal(dry.results[0].status, "needs_verification");
  assert.equal(await Candidate.countDocuments(), before);
  const imported = await importOpportunities(body);
  const row = await Candidate.findById(imported.results[0].candidateId).lean();
  assert.equal(row.verification.officialSource, null);
  assert.equal(row.opportunityDraft.featured, false);
  assert.equal(row.opportunityDraft.isDarbakApplication, false);
  assert.ok(row.evidenceLinks.includes("https://example.com/proof"));
  assert.ok(row.evidenceLinks.every((url) => !url.includes("utm_")));
  assert.equal((await importOpportunities(body)).replayed, true);
  console.log("Simplified Inbox PASS: canonical form parity, empty facts, legacy mapping, unverified publish, duplicate/update, safe import, dry run and idempotency.");
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await mongoose.disconnect(); if (repl) await repl.stop(); });
