const assert = require("node:assert/strict");
const Opportunity = require("../models/Opportunity");
const Candidate = require("../models/OpportunityCandidate");
const State = require("../models/OpportunityAutopilotState");
const candidatesModule = require("../services/opportunityCandidates");
const management = require("../services/opportunityDiscovery/management");
const {
  createOpportunityAutopilot, autoPublishDecision, isStrictCoop, interpretRecheck, nextCheckState,
  currentDiscoverySlot, safeUpdateFields,
} = require("../services/opportunityDiscovery/autopilot");

const now = new Date("2026-11-23T09:30:00+03:00");
const confident = {
  _id: "c1", importedVia: "official_discovery", status: "ready_for_review", reviewStatus: "READY_FOR_REVIEW",
  title: "Cooperative Training Program 2026", company: "Example Co", programType: "coop",
  applicationUrl: "https://careers.example.com/jobs/1", sourceUrl: "https://careers.example.com/jobs/1",
  realJobPosting: true, pageAvailability: "AVAILABLE", applicationState: "OPEN", completenessScore: 85,
  verification: { officialSource: true, companyVerified: true, urlWorks: true, appearsOpen: true },
};

// Strict cooperative-training identity.
assert.equal(isStrictCoop({ title: "برنامج التدريب التعاوني" }), true);
assert.equal(isStrictCoop({ title: "تدريب تعاوني - تقنية المعلومات" }), true);
assert.equal(isStrictCoop({ title: "Co-op Student - Finance" }), true);
assert.equal(isStrictCoop({ title: "COOP Program" }), true);
assert.equal(isStrictCoop({ title: "Summer Internship" }), false);
assert.equal(isStrictCoop({ title: "التعاونية - برنامج تطوير الخريجين" }), false, "company name التعاونية is not co-op");
assert.equal(isStrictCoop({ title: "Cooperative Bank Graduate Program" }), false);
assert.equal(isStrictCoop({ title: "Student Trainee", programType: "coop", description: "6-month co-op for university students" }), true);
assert.equal(isStrictCoop({ title: "Student Trainee", programType: "unknown", description: "co-op" }), false);

// Auto-publish decisions: accepted.
assert.deepEqual(autoPublishDecision(confident, { now }), { action: "publish", reason: "CONFIDENT_COOP" });
assert.equal(autoPublishDecision({ ...confident, applicationState: "UNKNOWN_BUT_ACTIONABLE" }, { now }).action, "publish");
assert.equal(autoPublishDecision({ ...confident, deadline: new Date("2026-11-23T00:00:00+03:00") }, { now }).action, "publish", "deadline today is still open");
assert.equal(autoPublishDecision({ ...confident, status: "update_existing", existingOpportunityId: "o1" }, { now }).action, "update");
// Rejected / held for review.
assert.equal(autoPublishDecision({ ...confident, title: "Summer Internship 2026", programType: "summer" }, { now }).action, "reject_not_coop");
assert.equal(autoPublishDecision({ ...confident, title: "Graduate Development Program", programType: "graduate" }, { now }).action, "reject_not_coop");
assert.equal(autoPublishDecision({ ...confident, title: "Student Program", programType: "unknown" }, { now }).reason, "COOP_NOT_EXPLICIT");
assert.equal(autoPublishDecision({ ...confident, isDemo: true }, { now }).reason, "DEMO");
assert.equal(autoPublishDecision({ ...confident, importedVia: "manual" }, { now }).reason, "NOT_AUTOMATED_SOURCE");
assert.equal(autoPublishDecision({ ...confident, deadline: new Date("2026-11-20") }, { now }).reason, "DEADLINE_PASSED");
assert.equal(autoPublishDecision({ ...confident, verification: { ...confident.verification, officialSource: null } }, { now }).reason, "NOT_VERIFIED_OFFICIAL_OPEN");
assert.equal(autoPublishDecision({ ...confident, applicationState: "CLOSED" }, { now }).reason, "NOT_VERIFIED_OFFICIAL_OPEN");
assert.equal(autoPublishDecision({ ...confident, pageAvailability: "BLOCKED" }, { now }).reason, "NOT_VERIFIED_OFFICIAL_OPEN");
assert.equal(autoPublishDecision({ ...confident, contentQualityWarning: true }, { now }).reason, "CONTENT_QUALITY_WARNING");
assert.equal(autoPublishDecision({ ...confident, completenessScore: 40 }, { now }).reason, "LOW_COMPLETENESS");
assert.equal(autoPublishDecision({ ...confident, completenessScore: 40 }, { now, minCompleteness: 30 }).action, "publish");
assert.equal(autoPublishDecision({ ...confident, status: "duplicate" }, { now }).action, "review");
assert.equal(autoPublishDecision({ ...confident, status: "needs_verification", reviewStatus: "NEEDS_VERIFICATION" }, { now }).action, "review");

// Updates: only an extended or newly known deadline is applied without review.
const existing = { title: confident.title, organizationName: "Example Co", deadline: new Date("2026-12-01") };
assert.deepEqual(safeUpdateFields({ ...confident, deadline: new Date("2026-12-20") }, existing), ["deadline"]);
assert.deepEqual(safeUpdateFields({ ...confident, deadline: new Date("2026-11-25") }, existing), [], "earlier deadline needs review");
assert.deepEqual(safeUpdateFields({ ...confident, deadline: new Date("2026-12-20") }, { ...existing, deadline: null }), ["deadline"]);

// Re-check interpretation is conservative: blocked/errors never close.
assert.equal(interpretRecheck({ pageAvailability: "GONE", results: [] }).outcome, "gone");
assert.equal(interpretRecheck({ code: "CLOSED", applicationState: "CLOSED", results: [] }).outcome, "closed");
assert.equal(interpretRecheck({ results: [{ code: "CLOSED", data: {} }] }).outcome, "closed");
assert.deepEqual(interpretRecheck({ results: [{ code: "VERIFIED_FOR_REVIEW", data: { deadline: "2026-12-30" } }] }), { outcome: "open", deadline: "2026-12-30" });
assert.equal(interpretRecheck({ pageAvailability: "BLOCKED", results: [] }).outcome, "inconclusive");
assert.equal(interpretRecheck({ pageAvailability: "ERROR", results: [] }).outcome, "inconclusive");
assert.deepEqual(nextCheckState({}, "closed"), { closedSignals: 1, shouldClose: false });
assert.deepEqual(nextCheckState({ closedSignals: 1 }, "gone"), { closedSignals: 2, shouldClose: true });
assert.deepEqual(nextCheckState({ closedSignals: 1 }, "inconclusive"), { closedSignals: 1, shouldClose: false });
assert.deepEqual(nextCheckState({ closedSignals: 1 }, "open"), { closedSignals: 0, shouldClose: false });

// Riyadh discovery slots.
assert.equal(currentDiscoverySlot(new Date("2026-11-23T07:59:00+03:00")), "");
assert.equal(currentDiscoverySlot(new Date("2026-11-23T08:00:00+03:00")), "2026-11-23T08:00");
assert.equal(currentDiscoverySlot(new Date("2026-11-23T23:10:00+03:00")), "2026-11-23T20:00");
assert.equal(currentDiscoverySlot(new Date("2026-11-23T22:30:00Z")), "", "01:30 Riyadh next day, before 08:00");

// Database flows with in-memory doubles.
const chain = (rows) => ({ select() { return this; }, sort() { return this; }, limit() { return this; }, lean: async () => rows });
const writes = [];
let invalidations = 0;
State.updateOne = async (...args) => { writes.push(["state", ...args]); return {}; };
Opportunity.updateOne = async (...args) => { writes.push(["opportunity", ...args]); return {}; };
Candidate.updateOne = async (...args) => { writes.push(["candidate", ...args]); return {}; };
const autopilot = createOpportunityAutopilot({ onPublish: () => { invalidations++; }, env: {}, log: { error: (...args) => console.error("Autopilot tick error:", ...args) } });

(async () => {
  // Auto-publish: confident co-op published, internship rejected, unclear held.
  Candidate.find = () => chain([
    confident,
    { ...confident, _id: "c2", title: "Summer Internship", programType: "summer" },
    { ...confident, _id: "c3", completenessScore: 20 },
  ]);
  const published = [];
  candidatesModule.publishCandidate = async (id, options) => { published.push([id, options.mode]); return { publishedOpportunityId: "o-new" }; };
  const counts = await autopilot.autoPublishPending({ now });
  assert.deepEqual(counts, { published: 1, updated: 0, rejectedNotCoop: 1, sentToReview: 1, failed: 0 });
  assert.deepEqual(published, [["c1", "publish"]]);
  assert.ok(writes.some(([model, filter, update]) => model === "candidate" && filter._id === "c2" && update.$set.status === "rejected"));
  assert.ok(writes.some(([model, filter, update]) => model === "opportunity" && filter._id === "o-new" && update.$set.automationCheck.autoPublished));
  const decisions = writes.filter(([model, , update]) => model === "candidate" && update.$set.autopilot).map(([, f, u]) => [f._id, u.$set.autopilot.decision]);
  assert.deepEqual(decisions, [["c1", "publish"], ["c2", "reject_not_coop"], ["c3", "review"]]);
  assert.equal(invalidations, 1);

  // A publish failure keeps the candidate in review and is logged.
  writes.length = 0;
  Candidate.find = () => chain([confident]);
  candidatesModule.publishCandidate = async () => { throw new Error("توجد فرصة مطابقة"); };
  assert.equal((await autopilot.autoPublishPending({ now })).failed, 1);
  assert.ok(writes.some(([model, , update]) => model === "state" && update.$push?.actions.$each[0].type === "publish_failed"));

  // Re-check: closes only after the second consecutive closed signal.
  writes.length = 0; invalidations = 0;
  const source = { key: "example", company: "Example Co", active: true, reviewStatus: "approved", officialDomains: ["careers.example.com"],
    careerDomains: ["careers.example.com"], allowedPathPrefixes: ["/"], metadata: { adapter: "generic" } };
  const searchDiscovery = require("../services/opportunityDiscovery/searchDiscovery");
  const originalClassify = searchDiscovery.classifyUrl;
  searchDiscovery.classifyUrl = (url) => (url.includes("careers.example.com") ? { sourceKey: "example" } : { classification: "unknown" });
  Opportunity.find = () => chain([
    { _id: "o1", title: "Co-op A", sourceUrl: "https://careers.example.com/jobs/1", automationCheck: { closedSignals: 1 } },
    { _id: "o2", title: "Co-op B", sourceUrl: "https://careers.example.com/jobs/2", automationCheck: { closedSignals: 0 } },
    { _id: "o3", title: "Co-op C", sourceUrl: "https://careers.example.com/jobs/3", deadline: new Date("2026-12-01") },
    { _id: "o4", title: "Co-op D", sourceUrl: "https://careers.example.com/jobs/4", automationCheck: { closedSignals: 1 } },
    { _id: "o5", title: "Manual", sourceUrl: "https://unknown.example.org/post" },
  ]);
  const responses = {
    "https://careers.example.com/jobs/1": { pageAvailability: "GONE", results: [] },
    "https://careers.example.com/jobs/2": { code: "CLOSED", applicationState: "CLOSED", results: [] },
    "https://careers.example.com/jobs/3": { results: [{ code: "VERIFIED_FOR_REVIEW", data: { deadline: "2026-12-20" } }] },
    "https://careers.example.com/jobs/4": { pageAvailability: "BLOCKED", results: [] },
  };
  const recheck = await autopilot.recheckPublishedOpportunities({ now, sources: [source], check: async (s, url) => responses[url] });
  searchDiscovery.classifyUrl = originalClassify;
  assert.deepEqual(recheck, { checked: 4, stillOpen: 1, closed: 1, deadlineExtended: 1, unverifiable: 1, inconclusive: 1 });
  const opportunityWrites = Object.fromEntries(writes.filter(([m]) => m === "opportunity").map(([, f, u]) => [f._id, u.$set]));
  assert.equal(opportunityWrites.o1.status, "expired");
  assert.equal(opportunityWrites.o1["automationCheck.closedReason"], "SOURCE_PAGE_REMOVED");
  assert.equal(opportunityWrites.o2.status, undefined, "first closed signal does not close");
  assert.equal(opportunityWrites.o2["automationCheck.closedSignals"], 1);
  assert.equal(new Date(opportunityWrites.o3.deadline).toISOString().slice(0, 10), "2026-12-20");
  assert.equal(opportunityWrites.o4.status, undefined, "blocked source never closes");
  assert.equal(opportunityWrites.o4["automationCheck.closedSignals"], 1);
  assert.equal(opportunityWrites.o5["automationCheck.lastResult"], "unverifiable");
  assert.equal(invalidations, 1);

  // Tick is a no-op while disabled.
  const mongoose = require("mongoose");
  Object.defineProperty(mongoose.connection, "readyState", { value: 1, configurable: true });
  State.findById = () => ({ lean: async () => ({ _id: "autopilot", enabled: false }), select() { return this; } });
  assert.deepEqual(await autopilot.tick({ now }), { skipped: "DISABLED" });
  const forced = createOpportunityAutopilot({ env: { OPPORTUNITY_AUTOPILOT_DISABLED: "true" }, log: { error() {} } });
  assert.deepEqual(await forced.tick({ now }), { skipped: "DISABLED_BY_ENV" });

  // Enabled tick: starts the due discovery slot once, publishes, re-checks once per day.
  State.findById = () => ({ lean: async () => ({ _id: "autopilot", enabled: true, lastDiscoverySlot: "", lastRecheckDay: "" }) });
  State.findOneAndUpdate = async () => ({ _id: "autopilot" });
  Candidate.find = () => chain([]);
  Opportunity.find = () => chain([]);
  management.registrySources = async () => [];
  let discoveryStarts = 0;
  const report = await autopilot.tick({ now, startDiscovery: async ({ mode }) => { assert.equal(mode, "automation"); discoveryStarts++; return { _id: "run1" }; } });
  assert.equal(discoveryStarts, 1);
  assert.deepEqual(report.discovery, { slot: "2026-11-23T08:00", runId: "run1" });
  assert.ok(report.recheck, "daily re-check runs after 06:00 Riyadh");
  State.findById = () => ({ lean: async () => ({ _id: "autopilot", enabled: true, lastDiscoverySlot: "2026-11-23T08:00", lastRecheckDay: "2026-11-23" }) });
  const second = await autopilot.tick({ now, startDiscovery: async () => { discoveryStarts++; return { _id: "run2" }; } });
  assert.equal(discoveryStarts, 1, "same slot is not run twice");
  assert.equal(second.recheck, undefined, "re-check runs once per Riyadh day");
  State.findOneAndUpdate = async () => null;
  assert.deepEqual(await autopilot.tick({ now }), { skipped: "BUSY" });

  console.log("Opportunity autopilot PASS: strict co-op filter, confident auto-publish, safe updates, two-signal closure, slots and lease.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
