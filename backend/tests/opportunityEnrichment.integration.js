// Temporary database only; no .env and no external fetching.
const assert = require("node:assert/strict");
const path = require("node:path");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require(path.join(process.env.INBOX_TEST_RUNTIME, "node_modules/mongodb-memory-server"));
const Candidate = require("../models/OpportunityCandidate");
const Opportunity = require("../models/Opportunity");
const Company = require("../models/Company");
const { createOpportunityCandidate, editCandidate } = require("../services/opportunityCandidates");
const { retryEnrichment } = require("../services/opportunityEnrichmentRetry");
const { candidateToOpportunity, inputSchema } = require("../services/opportunityCandidateData");
const source = { key: "example", company: "Example", active: true, reviewStatus: "approved", metadata: { scopes: ["https://official.example/"], aliases: [] } };
const base = { title: "COOP Intern", company: "Example", programType: "coop", applicationUrl: "https://official.example/jobs/1/apply", sourceUrl: "https://official.example/jobs/1",
  cities: ["الرياض"], majors: ["علوم الحاسب"], description: "Student opportunity in Saudi Arabia", responsibilities: ["Test software"], requirements: ["University student"],
  postedAt: new Date(), deadline: "2099-01-01", duration: "6 months", enrichmentVersion: 1, enrichedAt: new Date(),
  majorScope: "specific", rawMajors: ["Computer Science"], extractionEvidence: { responsibilities: { sourceUrl: "https://official.example/jobs/1", method: "html_section", heading: "Responsibilities" } },
  verification: { officialSource: true, companyVerified: true, appearsOpen: true, urlWorks: true, dateVerified: true } };
let repl;
(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(repl.getUri(), { dbName: "enrichment_regression" });
  for (const model of [Candidate, Opportunity, Company]) await model.init();
  const row = await createOpportunityCandidate(base);
  assert.equal(row.reviewStatus, "READY_FOR_REVIEW");
  assert.equal(row.completenessScore, 95);
  assert.equal(row.status, "ready");
  assert.equal((await Candidate.findById(row._id).lean()).extractionEvidence, undefined, "large evidence only on details request");
  assert.equal((await Candidate.findById(row._id).select("+extractionEvidence").lean()).extractionEvidence.responsibilities.heading, "Responsibilities");
  assert.equal((await createOpportunityCandidate(base)).reviewStatus, "DUPLICATE");
  const closed = await createOpportunityCandidate({ ...base, company: "Closed Example", verification: { ...base.verification, appearsOpen: false } });
  assert.equal(closed.status, "expired"); assert.equal(closed.reviewStatus, "CLOSED");
  const thin = await createOpportunityCandidate({ ...base, company: "Thin Example", requirements: [], majors: [], cities: [] });
  assert.equal(thin.status, "needs_review"); assert.equal(thin.reviewStatus, "NEEDS_DETAILS");
  const unknown = await createOpportunityCandidate({ ...base, company: "Unknown Example", verification: { ...base.verification, appearsOpen: null } });
  assert.equal(unknown.reviewStatus, "NEEDS_VERIFICATION");
  await editCandidate(row._id, { description: "Admin edited description" });
  const beforeCount = await Candidate.countDocuments();
  const enrich = async () => ({ results: [{ data: { ...base, description: "New extraction", responsibilities: ["Updated real task"] } }] });
  const retried = await retryEnrichment(row._id, { sources: [source], enrich });
  assert.equal(String(retried._id), String(row._id));
  assert.equal(await Candidate.countDocuments(), beforeCount);
  assert.equal(retried.description, "Admin edited description");
  assert.deepEqual([...retried.responsibilities], ["Updated real task"]);
  assert.equal(retried.extractionEvidence.description.method, "admin_review");
  const beforeFailure = JSON.stringify(await Candidate.findById(row._id).select("+rawContent +extractionEvidence").lean());
  await assert.rejects(retryEnrichment(row._id, { sources: [source], enrich: async () => { throw new Error("ROBOTS_DENIED"); } }));
  assert.equal(JSON.stringify(await Candidate.findById(row._id).select("+rawContent +extractionEvidence").lean()), beforeFailure);
  await assert.rejects(retryEnrichment(row._id, { sources: [{ ...source, active: false }], enrich }), /مصدر رسمي/);
  await assert.rejects(retryEnrichment(row._id, { sources: [source], enrich: async () => {
    await editCandidate(row._id, { requirements: ["Concurrent admin edit"] }); return enrich();
  } }), (error) => error.name === "VersionError");
  assert.equal((await Candidate.findById(row._id)).requirements[0], "Concurrent admin edit");
  const original = await Opportunity.create(candidateToOpportunity(inputSchema.parse({ ...base, company: "Published Example", deadline: null })));
  const originalSnapshot = JSON.stringify(await Opportunity.findById(original._id).lean());
  assert.equal((await createOpportunityCandidate({ ...base, company: "Published Example" })).reviewStatus, "UPDATE_EXISTING");
  assert.equal(JSON.stringify(await Opportunity.findById(original._id).lean()), originalSnapshot);
  assert.equal(await Opportunity.countDocuments(), 1, "automation did not publish");
  console.log("Enrichment Mongo PASS: evidence persistence, completeness/statuses, duplicate/update, same-row retry, manual edits, concurrent edit protection, failures preserve original, no publication.");
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await mongoose.disconnect(); if (repl) await repl.stop(); });
