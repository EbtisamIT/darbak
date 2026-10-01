const assert = require("node:assert/strict");
const { summarizeCandidates } = require("../services/opportunityCandidateSummary");
const { searchSettings } = require("../services/opportunityDiscovery/queryPack");
const { assessEnrichment } = require("../services/opportunityEnrichmentAssessment");
const { SOURCES } = require("../services/opportunityDiscovery/sources");

assert.deepEqual(searchSettings({}), { maxQueries: 20, resultsPerQuery: 10, concurrency: 3 });
const groups = [
  ["ready", "READY_FOR_REVIEW", 2], ["needs_review", "NEEDS_DETAILS", 3], ["needs_review", "NEEDS_VERIFICATION", 4],
  ["rejected", "READY_FOR_REVIEW", 10], ["published", "READY_FOR_REVIEW", 20], ["expired", "CLOSED", 1],
  ["duplicate", "DUPLICATE", 5], ["update_existing", "UPDATE_EXISTING", 6],
].map(([status, reviewStatus, count]) => ({ _id: { status, reviewStatus }, count }));
const summary = summarizeCandidates(groups, 7, 8);
assert.equal(summary.readyForReview, 2); assert.equal(summary.needsDetails, 3); assert.equal(summary.needsVerification, 4);
assert.equal(summary.closed, 1); assert.equal(summary.duplicate, 5); assert.equal(summary.update_existing, 6);
assert.equal(summary.discoveredToday, 7); assert.equal(summary.emailLeads, 8);
const factual = { company: "Example", title: "Internship", applicationUrl: "https://example.test/jobs/1", sourceUrl: "https://example.test/jobs/1",
  pageAvailability: "AVAILABLE", applicationState: "UNKNOWN_BUT_ACTIONABLE", realJobPosting: true,
  verification: { officialSource: true, companyVerified: true, urlWorks: true, appearsOpen: null },
  description: "Actual training advert", requirements: ["Actual student eligibility"], responsibilities: [] };
assert.equal(assessEnrichment(factual).reviewStatus, "READY_FOR_REVIEW", "missing logo, majors and dates must not block review");
assert.equal(assessEnrichment({ ...factual, description: "", requirements: [] }).reviewStatus, "NEEDS_DETAILS");
assert.equal(assessEnrichment({ ...factual, applicationState: "UNKNOWN" }).reviewStatus, "NEEDS_VERIFICATION");
assert.equal(SOURCES.find((row) => row.key === "chalhoub").atsProvider, "teamtailor");
console.log("Production readiness PASS: conservative budget, Inbox summaries, missing details, actionable state and Teamtailor source.");
