// Isolated replica set only. Never reads .env/MONGO_URI; no live HTTP discovery.
const assert = require("node:assert/strict");
const path = require("node:path");
const mongoose = require("mongoose");
const express = require("express");
const { MongoMemoryReplSet } = require(path.join(process.env.INBOX_TEST_RUNTIME, "node_modules/mongodb-memory-server"));
const Candidate = require("../models/OpportunityCandidate");
const Opportunity = require("../models/Opportunity");
const Company = require("../models/Company");
const Source = require("../models/OpportunitySource");
const Run = require("../models/OpportunityDiscoveryRun");
const Lead = require("../models/OpportunityEmailLead");
const SearchLead = require("../models/OpportunityDiscoveryLead");
const { runSearchDiscovery } = require("../services/opportunityDiscovery/searchDiscovery");
const { saveDiscoveryLead, runFromSearch } = require("../services/opportunityDiscovery/searchWorkflow");
const { saveEmailLead, sourceExport } = require("../services/opportunityDiscovery/management");
const { SOURCES } = require("../services/opportunityDiscovery/sources");
const { initializeSources } = require("../services/opportunityDiscovery/service");
const { createOpportunityCandidate } = require("../services/opportunityCandidates");
const { createOpportunityCandidateRouter } = require("../services/opportunityCandidateRoutes");
const { runPipeline } = require("../services/opportunityDiscovery/pipeline");

let repl, server;
const originalFetch = global.fetch, originalKey = process.env.BRAVE_SEARCH_API_KEY;
(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(repl.getUri(), { dbName: "discovery_isolated_test" });
  for (const Model of [Candidate, Opportunity, Company, Source, Run, Lead, SearchLead]) await Model.init();
  const source = { key: "official", name: "Official", company: "Official Company", sourceType: "company", sourceUrl: "https://official.example/careers/",
    metadata: { adapter: "generic", aliases: [], scopes: ["https://official.example/careers/"], maxPages: 4 } };
  const posting = { "@type": "JobPosting", title: "COOP Software Intern", description: "University students gain practical training.",
    hiringOrganization: { name: source.company }, datePosted: new Date().toISOString(), url: "https://official.example/careers/jobs/1", jobLocation: { address: { addressLocality: "Riyadh", addressCountry: "SA" } } };
  const read = async (url) => ({ url, text: `<script type="application/ld+json">${JSON.stringify(posting)}</script><main><a href="/careers/jobs/1/apply">Apply now</a></main>` });
  const deps = { ingest: createOpportunityCandidate, readerFactory: () => ({ read, requests: 1 }) };
  const first = await runPipeline([source], deps);
  assert.equal(first.summary.newCandidates, 1);
  const second = await runPipeline([source], deps);
  assert.equal(second.summary.duplicates, 1);
  assert.equal(await Opportunity.countDocuments(), 0, "discovery must never publish");
  const original = await Opportunity.create({ organizationName: source.company, title: posting.title, cities: ["Riyadh"], status: "active", applicationUrl: "https://official.example/careers/jobs/1/apply", sourceUrl: posting.url, note: "" });
  const before = JSON.stringify(await Opportunity.findById(original._id).lean());
  const third = await runPipeline([source], deps);
  assert.equal(third.summary.updates, 1);
  assert.equal(JSON.stringify(await Opportunity.findById(original._id).lean()), before, "proposed update must not modify Opportunity");
  const searchSource = { ...source, active: true, reviewStatus: "approved", officialDomains: ["official.example"], atsProvider: "generic" };
  const report = await runSearchDiscovery([searchSource], { settings: { maxQueries: 1, concurrency: 1, resultsPerQuery: 10 }, saveLead: saveDiscoveryLead,
    provider: { name: "brave", search: async () => [{ title: posting.title, url: posting.url }, { title: "Internship", url: "https://unknown.example/jobs/1" }] } });
  assert.equal(await SearchLead.countDocuments(), 1);
  await saveDiscoveryLead(report.results.find((r) => !r.accepted)); assert.equal(await SearchLead.countDocuments(), 1);
  const full = await runFromSearch([searchSource], report, deps);
  assert.equal(full.summary.updates, 1);
  const searchedCandidate = await Candidate.findOne({ "searchDiscovery.provider": "brave" }).lean();
  assert.equal(searchedCandidate.searchDiscovery.discoveredByQueries.length, 1);
  assert.equal(JSON.stringify(await Opportunity.findById(original._id).lean()), before);
  const freshSource = { ...searchSource, key: "new-official", company: "New Official Company" };
  const freshPosting = { ...posting, title: "Summer Marketing Internship", url: "https://official.example/careers/jobs/2",
    hiringOrganization: { name: freshSource.company } };
  const freshReport = await runSearchDiscovery([freshSource], { settings: { maxQueries: 1, concurrency: 1, resultsPerQuery: 10 },
    provider: { name: "brave", search: async () => [{ title: freshPosting.title, url: freshPosting.url }] } });
  const freshFull = await runFromSearch([freshSource], freshReport, { ingest: createOpportunityCandidate,
    readerFactory: () => ({ read: async (u) => ({ url: u, text: `<script type="application/ld+json">${JSON.stringify(freshPosting)}</script><main><a href="${freshPosting.url}/apply">Apply now</a></main>` }) }) });
  assert.equal(freshFull.summary.candidatesCreated, 1);
  assert.equal((await Candidate.findOne({ company: freshSource.company }).lean()).searchDiscovery.provider, "brave");
  assert.equal(await Opportunity.countDocuments(), 1, "search end-to-end never publishes");
  await initializeSources(); await initializeSources();
  assert.equal(await Source.countDocuments(), 10);
  await Source.updateMany({}, { $set: { active: false } });
  await initializeSources(); assert.equal(await Source.countDocuments({ active: true }), 0, "initialization must preserve disabled sources");
  const app = express(); app.use(express.json());
  app.use("/api/admin/opportunity-candidates", createOpportunityCandidateRouter({ requireAdmin: (req, res, next) => req.headers["x-admin-password"] === "test" ? next() : res.sendStatus(401) }));
  await new Promise((r) => { server = app.listen(0, "127.0.0.1", r); });
  const url = `http://127.0.0.1:${server.address().port}/api/admin/opportunity-candidates/discovery`;
  assert.equal((await fetch(url)).status, 401);
  assert.equal((await fetch(`${url}/run`, { method: "POST" })).status, 401);
  const headers = { "x-admin-password": "test" };
  delete process.env.BRAVE_SEARCH_API_KEY;
  assert.equal((await fetch(`${url}/run`, { method: "POST", headers })).status, 503);
  process.env.BRAVE_SEARCH_API_KEY = "isolated-test-only";
  global.fetch = async (input, options) => new URL(input).hostname === "api.search.brave.com"
    ? { ok: true, json: async () => ({ type: "search", web: { results: [] } }) }
    : originalFetch(input, options);
  assert.equal((await fetch(`${url}/run`, { method: "POST", headers })).status, 202);
  assert.equal((await fetch(`${url}/run`, { method: "POST", headers })).status, 429);
  let status;
  for (let i = 0; i < 30; i++) {
    status = await (await fetch(url, { headers })).json();
    if (status.run.status !== "running") break;
    await new Promise((r) => setTimeout(r, 20));
  }
  assert.equal(status.run.status, "completed"); assert.equal(status.run.summary.sourcesChecked, 0);
  await Run.create({ status: "running", lock: "discovery", leaseUntil: new Date(Date.now() + 60000) });
  await assert.rejects(Run.create({ status: "running", lock: "discovery", leaseUntil: new Date(Date.now() + 60000) }), (e) => e.code === 11000);
  await Run.updateOne({ lock: "discovery" }, { $set: { leaseUntil: new Date(0) } });
  status = await (await fetch(url, { headers })).json();
  assert.equal(status.run.status, "interrupted");
  assert.equal(await Opportunity.countDocuments(), 1);
  const beforeCandidates = await Candidate.countDocuments();
  const lead = { company: "Official Company", email: "training@official.example", emailType: "training", sourceUrl: source.sourceUrl, officialSource: true, confidence: 90 };
  assert.equal(await saveEmailLead(lead), true);
  assert.equal(await saveEmailLead(lead), false);
  assert.equal(await Lead.countDocuments(), 1);
  assert.equal(await Candidate.countDocuments(), beforeCandidates, "leads never create candidates");
  const jsonHeaders = { ...headers, "content-type": "application/json" };
  const imported = { ...sourceExport(SOURCES[0]), key: "imported-test" };
  let response = await fetch(`${url}/sources/import`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ sources: [imported] }) });
  assert.equal(response.status, 200); assert.equal((await response.json()).added, 1);
  assert.equal((await Source.findOne({ key: imported.key })).active, false);
  response = await fetch(`${url}/sources/import`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ sources: [imported] }) });
  assert.equal((await response.json()).existing, 1);
  assert.equal((await fetch(`${url}/sources/${imported.key}/approve`, { method: "POST", headers: jsonHeaders, body: "{}" })).status, 400);
  assert.equal((await fetch(`${url}/sources/${imported.key}/approve`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ reviewedOfficialOwnership: true }) })).status, 200);
  assert.equal((await Source.findOne({ key: imported.key })).reviewStatus, "approved");
  assert.equal((await fetch(`${url}/test-url`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ sourceKey: "stc", url: "https://evil.example/jobs/42" }) }).then((r) => r.json())).code, "POLICY_DENIED");
  assert.equal(await Candidate.countDocuments(), beforeCandidates, "preview must not create candidates");
  assert.equal((await fetch(`${url}/leads`)).status, 401);
  assert.equal((await fetch(`${url}/search-leads`)).status, 401);
  assert.equal((await fetch(`${url}/sources/export`)).status, 401);
  assert.equal((await fetch(`${url}/test-url`, { method: "POST" })).status, 401);
  assert.equal(await Opportunity.countDocuments(), 1);
  console.log("Discovery integration PASS: real candidate dedup/update, no publication, registry idempotence, admin auth, lock and recovery");
})().catch((e) => { console.error(e); process.exitCode = 1; }).finally(async () => {
  if (server) await new Promise((r) => server.close(r)); await mongoose.disconnect(); if (repl) await repl.stop();
  global.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.BRAVE_SEARCH_API_KEY; else process.env.BRAVE_SEARCH_API_KEY = originalKey;
});
