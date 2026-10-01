// Runs exclusively against a temporary replica set. Never loads .env/MONGO_URI.
const assert = require("node:assert/strict");
const path = require("node:path");
const crypto = require("node:crypto");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require(path.join(process.env.INBOX_TEST_RUNTIME, "node_modules/mongodb-memory-server"));
const Candidate = require("../models/OpportunityCandidate");
const Opportunity = require("../models/Opportunity");
const Company = require("../models/Company");
const Lead = require("../models/OpportunityEmailLead");
const ImportRun = require("../models/OpportunityImportRun");
const { createOpportunityImportRouter } = require("../services/opportunityDiscovery/importRoutes");
const { createOpportunityCandidateRouter } = require("../services/opportunityCandidateRoutes");
const { inputSchema, candidateToOpportunity } = require("../services/opportunityCandidateData");
const { prepare } = require("../services/opportunityDiscovery/importBridge");

let repl, server;
const originalToken = process.env.DARBAK_DISCOVERY_IMPORT_TOKEN;
const token = crypto.randomBytes(32).toString("hex");
const fixture = (id, company = "Test Company") => ({ company, title: "COOP Software Intern",
  programType: "coop", cities: [" الرياض ", "الرياض"], majors: ["نظم المعلومات"],
  responsibilities: [], requirements: [], applicationUrl: `https://example.com/jobs/${id}?jobId=${id}&utm_source=chatgpt`,
  sourceUrl: `https://example.com/jobs/${id}`, sourceType: "company" });
const counts = async () => ({ candidates: await Candidate.countDocuments(), opportunities: await Opportunity.countDocuments(),
  leads: await Lead.countDocuments(), runs: await ImportRun.countDocuments() });

(async () => {
  const invalid = prepare({ source: "test", runId: "invalid", opportunities: [
    { title: "Missing company", sourceUrl: "https://example.com" },
    { company: "Test", title: "Missing URL" },
    { ...fixture(1), requirements: "not an array" },
    { ...fixture(1), applicationUrl: "javascript:alert(1)" },
    { ...fixture(1), title: " " },
    { ...fixture(1), cities: null },
    { ...fixture(1), majors: "CS" },
    { ...fixture(1), responsibilities: {} },
  ] });
  assert.equal(invalid.errors.length, 8);
  assert.throws(() => prepare({ source: "test", runId: "large", opportunities: Array(26).fill(fixture(1)) }));
  assert.throws(() => prepare({ source: "test", runId: "empty" }));
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(repl.getUri(), { dbName: "opportunity_import_test" });
  for (const model of [Candidate, Opportunity, Company, Lead, ImportRun]) await model.init();
  const app = express(); app.use(express.json({ limit: "1mb" }));
  app.use("/api/internal/opportunity-discovery/import", createOpportunityImportRouter());
  app.use("/api/admin/opportunity-candidates", createOpportunityCandidateRouter({
    requireAdmin: (req, res, next) => req.get("x-admin-password") === "local-test" ? next() : res.sendStatus(401),
  }));
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const send = async (body, query = "", auth = token) => {
    const res = await fetch(`${origin}/api/internal/opportunity-discovery/import${query}`, { method: "POST",
      headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${auth}` } : {}) }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json() };
  };
  const batch = { source: "darbak_coop_sweep", runId: "five-record-demo", opportunities: [
    { ...fixture("new", "New Test Company"), duration: "8 weeks", verificationNotes: "Agent claims open",
      verification: { officialSource: true, urlWorks: true, appearsOpen: true, companyVerified: true, dateVerified: true },
      status: "ready", confidenceScore: 100, importedVia: "official_discovery", searchDiscovery: { provider: "brave" },
      discoveredEmails: [{ email: " Training@Example.com ", type: "training", sourceUrl: "https://example.com/?source=chatgpt", confidence: 70 }] },
    fixture("duplicate", "Duplicate Test Company"),
    { ...fixture("update", "Update Test Company"), deadline: "2099-01-01" },
    { company: "Review Test Company", title: "Student program", sourceUrl: "https://example.com/review" },
  ], emailLeads: [{ company: "Lead Test Company", email: " COOP@Example.com ", emailType: "coop",
    sourceUrl: "https://example.com/contact?utm_medium=chatgpt", officialSource: true, confidence: 100 }] };

  delete process.env.DARBAK_DISCOVERY_IMPORT_TOKEN;
  assert.equal((await send(batch)).status, 503);
  process.env.DARBAK_DISCOVERY_IMPORT_TOKEN = "too-short";
  assert.equal((await send(batch)).status, 503);
  process.env.DARBAK_DISCOVERY_IMPORT_TOKEN = token;
  assert.equal((await send(batch, "", null)).status, 401);
  assert.equal((await send(batch, "", "incorrect")).status, 401);
  assert.equal((await send(batch, "?dryRun=typo")).status, 400);
  assert.equal((await send({ ...batch, runId: "" })).status, 400);
  for (const index of [1, 2]) await Opportunity.create(candidateToOpportunity(inputSchema.parse(fixture(
    index === 1 ? "duplicate" : "update", index === 1 ? "Duplicate Test Company" : "Update Test Company"))));
  const publicBefore = JSON.stringify(await Opportunity.find().sort({ _id: 1 }).lean());
  const before = await counts();
  const dry = await send(batch, "?dryRun=true");
  assert.equal(dry.status, 200);
  assert.deepEqual(await counts(), before, "dry run makes no writes, including receipts and leads");
  assert.deepEqual(dry.body.results.slice(0, 4).map((row) => row.status), ["needs_review", "duplicate", "update_existing", "needs_review"]);
  const live = await send(batch);
  assert.equal(live.status, 200);
  assert.equal(live.body.created, 4);
  assert.equal(live.body.duplicates, 1);
  assert.equal(live.body.updates, 1);
  assert.equal(live.body.needsReview, 2);
  assert.equal(live.body.emailLeads.created, 1);
  assert.deepEqual(live.body.results.map((row) => row.status), dry.body.results.map((row) => row.status));
  const row = await Candidate.findOne({ company: "New Test Company" }).lean();
  assert.equal(row.importedVia, "agent");
  assert.equal(row.importRunId, batch.runId);
  assert.equal(row.importSource, batch.source);
  assert.ok(row.importedAt instanceof Date);
  assert.equal(row.status, "needs_review");
  assert.equal(row.confidenceScore, 0);
  assert.equal(row.verification.officialSource, null);
  assert.equal(row.verification.appearsOpen, null);
  assert.equal(row.searchDiscovery?.provider, undefined);
  assert.equal(row.duration, "8 weeks");
  assert.equal(row.verificationNotes, "Agent claims open");
  assert.deepEqual(row.cities, ["الرياض"]);
  assert.equal(row.discoveredEmails[0].email, "training@example.com");
  assert.equal(row.discoveredEmails[0].sourceUrl, "https://example.com/");
  assert.equal(row.applicationUrl, "https://example.com/jobs/new?jobId=new");
  const review = await Candidate.findOne({ company: "Review Test Company" }).lean();
  assert.deepEqual(review.responsibilities, []);
  assert.equal(review.deadline, null);
  const lead = await Lead.findOne().lean();
  assert.equal(lead.officialSource, false);
  assert.equal(lead.confidence, 0);
  assert.equal(lead.importedVia, "agent");
  assert.equal(await Candidate.countDocuments({ company: lead.company }), 0);
  const inboxResponse = await fetch(`${origin}/api/admin/opportunity-candidates`, { headers: { "x-admin-password": "local-test" } });
  const inbox = await inboxResponse.json();
  assert.equal(inbox.data.length, 4);
  assert.ok(inbox.data.every((item) => item.importedVia === "agent"));
  const after = await counts();
  const repeat = await send(batch);
  assert.equal(repeat.body.replayed, true);
  assert.deepEqual(await counts(), after);
  assert.equal((await send({ ...batch, opportunities: [fixture("changed")] })).status, 409);
  assert.deepEqual(await counts(), after);

  const concurrent = { source: batch.source, runId: "concurrent", opportunities: [fixture("concurrent", "Concurrent Test")] };
  const responses = await Promise.all([send(concurrent), send(concurrent)]);
  assert.ok(responses.every((response) => response.status === 200));
  assert.equal(responses.filter((response) => response.body.replayed).length, 1);
  assert.equal(await Candidate.countDocuments({ importRunId: concurrent.runId }), 1);

  const intra = { source: batch.source, runId: "intra", opportunities: [fixture("intra", "Intra Test"), fixture("intra", "Intra Test")] };
  const intraDry = await send(intra, "?dryRun=true"), intraSaved = await send(intra);
  assert.equal(intraDry.body.duplicates, 1);
  assert.equal(intraSaved.body.duplicates, 1);
  const bad = await send({ source: batch.source, runId: "invalid-item", opportunities: [fixture("valid", "Valid Test"), { title: "Bad" }] });
  assert.equal(bad.body.created, 1);
  assert.equal(bad.body.rejected, 1);
  assert.equal(bad.body.errors[0].index, 1);

  const onlyEmail = { source: batch.source, runId: "email-only", emailLeads: batch.emailLeads };
  const emailCount = await Candidate.countDocuments();
  assert.equal((await send(onlyEmail, "?dryRun=true")).body.emailLeads.existing, 1);
  assert.equal((await send(onlyEmail)).body.emailLeads.existing, 1);
  assert.equal(await Candidate.countDocuments(), emailCount);

  const rollbackBatch = { source: batch.source, runId: "rollback", opportunities: [fixture("rollback", "Rollback Test")],
    emailLeads: [{ company: "Rollback Lead", email: "hr@example.com", sourceUrl: "https://example.com" }] };
  const originalUpdate = Lead.updateOne, beforeRollback = await counts();
  Lead.updateOne = async () => { throw new Error("Simulated storage failure"); };
  try { assert.equal((await send(rollbackBatch)).status, 500); } finally { Lead.updateOne = originalUpdate; }
  assert.deepEqual(await counts(), beforeRollback, "failure rolls back every write including receipt");
  assert.equal((await send(rollbackBatch)).body.created, 1, "same run can retry after rollback");
  assert.equal(JSON.stringify(await Opportunity.find().sort({ _id: 1 }).lean()), publicBefore, "no publishing or updates to real opportunities");
  console.log("Import bridge PASS: auth, validation, isolated 4 candidates + 1 lead, dry run, matching, trust boundary, Inbox, retry, concurrent idempotency, rollback, no Opportunity writes.");
  console.log(JSON.stringify(live.body, null, 2));
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (originalToken === undefined) delete process.env.DARBAK_DISCOVERY_IMPORT_TOKEN;
  else process.env.DARBAK_DISCOVERY_IMPORT_TOKEN = originalToken;
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (repl) await repl.stop();
});
