// Isolated Mongo only. Never loads environment credentials or runs discovery.
const assert = require("node:assert/strict");
const path = require("node:path");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require(path.join(process.env.INBOX_TEST_RUNTIME, "node_modules/mongodb-memory-server"));
const Run = require("../models/OpportunityDiscoveryRun");
const { admitRun, dayWindow, schedulingConfiguration, runMetrics } = require("../services/opportunityDiscovery/runControl");
let repl;
(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(repl.getUri(), { dbName: "run_control_tests" }); await Run.init();
  assert.equal(schedulingConfiguration({ MAX_DAILY_RUNS: "99", MAX_SEARCH_QUERIES_PER_RUN: "99" }).maxDailyRuns, 2);
  assert.equal(schedulingConfiguration({ DISCOVERY_MAX_SEARCH_QUERIES_PER_RUN: "99" }).maxSearchQueriesPerRun, 20);
  assert.equal(schedulingConfiguration().enabled, false);
  assert.equal(dayWindow(new Date("2026-10-01T21:01:00Z")).date, "2026-10-02");
  const payload = { runType: "automation", status: "running", lock: "discovery" };
  const attempts = await Promise.allSettled([admitRun(payload), admitRun(payload)]);
  assert.equal(attempts.filter((v) => v.status === "fulfilled").length, 1);
  assert.match(attempts.find((v) => v.status === "rejected").reason.message, /SKIP_ALREADY_RUNNING/);
  const first = attempts.find((v) => v.status === "fulfilled").value;
  await Run.updateOne({ _id: first._id }, { $set: { status: "completed", finishedAt: new Date() }, $unset: { lock: 1 } });
  const second = await admitRun(payload);
  await Run.updateOne({ _id: second._id }, { $set: { status: "failed", finishedAt: new Date() }, $unset: { lock: 1 } });
  await assert.rejects(admitRun(payload), /MAX_DAILY_RUNS/);
  assert.equal(await Run.countDocuments(), 2);
  const metrics = runMetrics({ createdAt: "2026-10-02T00:00:00Z", finishedAt: "2026-10-02T00:00:05Z", status: "completed", summary: { searchQueriesRun: 20, searchResultsReceived: 50, candidatesCreated: 2, duplicates: 1, updates: 1, errors: 0 } });
  assert.equal(metrics.durationMs, 5000); assert.equal(metrics.queries, 20);
  await Run.deleteMany({});
  // Existing pre-v1 runs consume daily quota, including failed runs.
  await Run.create({ runType: "automation", status: "completed" });
  await admitRun(payload);
  assert.equal(await Run.countDocuments(), 2);
  console.log("Run control Mongo PASS: cross-worker lock, atomic daily slots, failed/legacy quota, Riyadh boundary, disabled schedule, capped queries, metrics.");
})().catch((e) => { console.error(e); process.exitCode = 1; }).finally(async () => { await mongoose.disconnect(); if (repl) await repl.stop(); });
