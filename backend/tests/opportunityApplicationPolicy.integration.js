// Creates and destroys an isolated local replica set; never loads .env.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require(path.join(process.env.INBOX_TEST_RUNTIME, "node_modules/mongodb-memory-server"));
const Candidate = require("../models/OpportunityCandidate");
const Opportunity = require("../models/Opportunity");
const Company = require("../models/Company");
const DiscoveryLead = require("../models/OpportunityDiscoveryLead");
const { createOpportunityCandidate } = require("../services/opportunityCandidates");
const { inputSchema, candidateToOpportunity } = require("../services/opportunityCandidateData");
const { saveDiscoveryLead } = require("../services/opportunityDiscovery/searchWorkflow");
let repl;

(async () => {
  const reportPath = process.argv[2];
  if (!reportPath) throw new Error("Pass the read-only live extraction report as the first argument");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const data = report.results.flatMap((row) => row.results.filter((item) => item.data).map((item) => item.data));
  assert.equal(data.length, 2);
  assert.equal(data.filter((row) => row.applicationState === "UNKNOWN_BUT_ACTIONABLE" && row.reviewStatus === "READY_FOR_REVIEW").length, 1);
  assert.equal(data.filter((row) => row.applicationState === "CLOSED" && row.reviewStatus === "CLOSED").length, 1);
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = repl.getUri();
  assert.ok(["127.0.0.1", "localhost"].includes(new URL(uri).hostname));
  await mongoose.connect(uri, { dbName: "teamtailor_live_policy_test" });
  for (const model of [Candidate, Opportunity, Company, DiscoveryLead]) await model.init();
  const results = [];
  for (const input of data) {
    const first = await createOpportunityCandidate(input, { audit: { importedVia: "official_discovery" } });
    if (input.applicationState === "CLOSED") {
      assert.equal(first.status, "expired"); assert.equal(first.reviewStatus, "CLOSED");
      assert.equal(first.applicationState, "CLOSED");
      assert.equal(first.verification.appearsOpen, false);
      results.push({ title: input.title, candidate: first.status, reviewStatus: first.reviewStatus,
        applicationState: first.applicationState, duplicate: "not tested: posting closed", update: "not tested: posting closed" });
      continue;
    }
    assert.equal(first.status, "ready"); assert.equal(first.reviewStatus, "READY_FOR_REVIEW");
    assert.equal(first.pageAvailability, "AVAILABLE"); assert.equal(first.applicationState, "UNKNOWN_BUT_ACTIONABLE");
    assert.equal(first.verification.appearsOpen, null);
    assert.equal(first.verificationWarnings[0], "حالة نموذج التقديم لم تُتحقق آليًا");
    const duplicate = await createOpportunityCandidate(input);
    assert.equal(duplicate.status, "duplicate"); assert.equal(duplicate.reviewStatus, "DUPLICATE");
    assert.equal(String(duplicate.duplicateOf), String(first._id));
    assert.equal(await Opportunity.countDocuments(), 0, "candidate ingestion never publishes");
    // Simulate an older local Opportunity missing the real extracted sections.
    // The new payload is the live data, with no fabricated replacement facts.
    const older = inputSchema.parse({ ...input, responsibilities: [], requirements: [], description: "" });
    const baseline = await Opportunity.create(candidateToOpportunity(older));
    const snapshot = JSON.stringify(await Opportunity.findById(baseline._id).lean());
    const update = await createOpportunityCandidate(input);
    assert.equal(update.status, "update_existing"); assert.equal(update.reviewStatus, "UPDATE_EXISTING");
    assert.equal(String(update.existingOpportunityId), String(baseline._id));
    assert.equal(snapshot, JSON.stringify(await Opportunity.findById(baseline._id).lean()), "proposed updates never mutate an Opportunity");
    results.push({ title: input.title, candidate: first.status, reviewStatus: first.reviewStatus,
      applicationState: first.applicationState, duplicate: duplicate.status, update: update.status });
  }
  const lead = { url: "https://jobs.smartrecruiters.com/Example/12345678-internship", domain: "jobs.smartrecruiters.com", title: "Internship",
    provider: "brave", classification: "official_ats", firstDiscoveredAt: new Date(), discoveredByQueries: ["internship Saudi Arabia"] };
  await saveDiscoveryLead(lead);
  await DiscoveryLead.updateOne({ url: lead.url }, { $set: { status: "rejected" } });
  await saveDiscoveryLead({ ...lead, reason: "ROBOTS_DENIED", reviewStatus: "NEEDS_VERIFICATION", pageAvailability: "BLOCKED", applicationState: "UNKNOWN" });
  const storedLead = await DiscoveryLead.findOne({ url: lead.url }).lean();
  assert.equal(storedLead.status, "rejected"); assert.equal(storedLead.reviewStatus, "NEEDS_VERIFICATION");
  assert.equal(storedLead.pageAvailability, "BLOCKED"); assert.equal(await DiscoveryLead.countDocuments(), 1);
  assert.equal(await Candidate.countDocuments({ status: "published" }), 0);
  const summary = { database: "temporary local MongoDB, destroyed after test", productionWrites: 0,
    liveOpportunities: results, publishedCandidates: 0, updateSimulation: "Older local fixtures omit factual sections; proposed changes are never applied." };
  if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await mongoose.disconnect(); if (repl) await repl.stop();
});
