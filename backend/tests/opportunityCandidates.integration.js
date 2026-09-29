// Optional isolated integration/preview harness. Never reads .env or MONGO_URI.
// INBOX_TEST_RUNTIME must point to a temporary installation of mongodb-memory-server.
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const vm = require("node:vm");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require(path.join(process.env.INBOX_TEST_RUNTIME, "node_modules/mongodb-memory-server"));
const Candidate = require("../models/OpportunityCandidate");
const Opportunity = require("../models/Opportunity");
const Company = require("../models/Company");
const { createOpportunityCandidateRouter } = require("../services/opportunityCandidateRoutes");
const { seedOpportunityCandidates } = require("../services/opportunityCandidateSeed");

const source = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
const sanitizer = source.slice(source.indexOf("const sanitizeOpportunityPayload ="), source.indexOf("const sanitizePortfolioText ="));
const sanitizeOpportunityPayload = vm.runInNewContext(`${sanitizer}\nsanitizeOpportunityPayload;`, {
  mongoose, normalizeArrayField: (v) => Array.isArray(v) ? v.filter(Boolean) : [],
  isGeneralSpecialtyValue: (v) => v === "__all_specialties__", isClosedByDeadline: (v) => new Date(v).getTime() < Date.now(),
});
const serve = process.argv.includes("--serve");
const password = "inbox-local-test";
let replset, server;
const close = async () => { if (server) await new Promise((resolve) => server.close(resolve)); await mongoose.disconnect(); if (replset) await replset.stop(); };

(async () => {
  replset = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replset.getUri(), { dbName: "opportunity_inbox_isolated_test" });
  await Candidate.init(); await Opportunity.init(); await Company.init();
  const app = express();
  app.use(require("cors")());
  app.use(express.json());
  app.use("/api/admin/opportunity-candidates", createOpportunityCandidateRouter({
    requireAdmin: (req, res, next) => req.headers["x-admin-password"] === password ? next() : res.status(401).json({ error: "Unauthorized" }),
    sanitizeOpportunityPayload, containsBlockedTerms: () => false,
  }));
  if (serve) app.use((req, res) => res.json({ data: [], total: 0 }));
  await new Promise((resolve) => { server = app.listen(serve ? 3111 : 0, "127.0.0.1", resolve); });
  const url = `http://127.0.0.1:${server.address().port}/api/admin/opportunity-candidates`;
  const request = async (method, route = "", data, authenticated = true) => {
    const response = await fetch(`${url}${route}`, { method, headers: { "Content-Type": "application/json", ...(authenticated ? { "x-admin-password": password } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
    return { status: response.status, body: await response.json() };
  };
  if (serve) {
    process.env.NODE_ENV = "development"; process.env.ENABLE_OPPORTUNITY_INBOX_SEED = "true";
    await seedOpportunityCandidates();
    console.log("Isolated demo API ready: http://127.0.0.1:3111 (no production connection)");
    process.once("SIGINT", () => close().then(() => process.exit(0)));
    process.once("SIGTERM", () => close().then(() => process.exit(0)));
    return;
  }
  assert.equal((await request("GET", "", null, false)).status, 401);
  assert.equal((await request("GET", "/invalid")).status, 400);
  const base = { title: "تدريب تعاوني اختبار", company: "جهة الاختبار", cities: ["الرياض"], majors: ["نظم المعلومات"],
    sourceType: "company", programType: "coop", description: "وصف الاختبار", applicationUrl: "https://example.com/jobs/123?jobId=123&utm_source=chatgpt", sourceUrl: "https://example.com/jobs/123",
    verification: { urlWorks: true, officialSource: true, appearsOpen: true, dateVerified: true, companyVerified: true } };
  const created = await request("POST", "", base);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.status, "ready");
  assert.equal(created.body.applicationUrl.includes("chatgpt"), false);
  const key = created.body._id;
  const duplicate = await request("POST", "", base);
  assert.equal(duplicate.body.status, "duplicate");
  assert.equal(duplicate.body.duplicateOf, key);
  const originalSave = Candidate.prototype.save;
  Candidate.prototype.save = async function (...args) {
    if (String(this._id) === key && this.status === "published") throw new Error("injected failure after public write");
    return originalSave.apply(this, args);
  };
  try {
    assert.equal((await request("POST", `/${key}/publish`, {})).status, 500);
    assert.equal(await Opportunity.countDocuments(), 0, "real transaction rolls back the inserted opportunity");
    assert.equal((await Candidate.findById(key)).status, "ready");
  } finally { Candidate.prototype.save = originalSave; }
  const published = await request("POST", `/${key}/publish`, {});
  assert.equal(published.status, 200, JSON.stringify(published.body));
  assert.equal(await Opportunity.countDocuments(), 1);
  assert.equal((await request("POST", `/${key}/publish`, {})).status, 200);
  assert.equal(await Opportunity.countDocuments(), 1);
  assert.equal((await request("PATCH", `/${key}`, { title: "no" })).status, 409);
  assert.equal((await request("POST", `/${key}/reject`, {})).status, 409);
  const proposal = await request("POST", "", { ...base, deadline: "2099-01-01" });
  assert.equal(proposal.body.status, "update_existing");
  const detail = await request("GET", `/${proposal.body._id}`);
  assert.ok(detail.body.diff.some((row) => row.field === "deadline" && row.changed));
  assert.equal((await request("POST", `/${proposal.body._id}/apply-update`, { fields: ["deadline"], expectedUpdatedAt: "2000-01-01" })).status, 409);
  const update = await request("POST", `/${proposal.body._id}/apply-update`, { fields: ["deadline"], expectedUpdatedAt: detail.body.existing.updatedAt });
  assert.equal(update.status, 200, JSON.stringify(update.body));
  assert.equal(await Opportunity.countDocuments(), 1);
  const publicRow = await Opportunity.findOne().lean();
  assert.equal(publicRow.note, base.description);
  assert.equal(publicRow.deadline.toISOString().slice(0, 10), "2099-01-01");
  const review = await request("POST", "", { company: "ناقصة" });
  assert.equal((await request("POST", `/${review.body._id}/publish`, {})).status, 422);
  const filtered = await request("GET", "?status=needs_review&company=" + encodeURIComponent("ناقصة"));
  assert.equal(filtered.body.total, 1);
  assert.equal("rawContent" in filtered.body.data[0], false);
  process.env.NODE_ENV = "production";
  assert.equal((await request("POST", "/seed", {})).status, 403);
  process.env.NODE_ENV = "development"; process.env.ENABLE_OPPORTUNITY_INBOX_SEED = "true";
  const demo = await request("POST", "/seed", {});
  assert.equal(demo.body.data.length, 5);
  assert.equal((await request("POST", `/${demo.body.data[0]._id}/publish`, {})).status, 409);
  assert.equal(await Opportunity.countDocuments(), 1);
  console.log("PASS: isolated MongoDB replica set + HTTP endpoints + real sanitizer + atomic publication + selected update + filters + auth + demo isolation.");
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { if (!serve || process.exitCode) await close(); });
