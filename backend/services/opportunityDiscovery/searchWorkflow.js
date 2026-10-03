const Run = require("../../models/OpportunityDiscoveryRun");
const Lead = require("../../models/OpportunityDiscoveryLead");
const { runSearchDiscovery, classifyUrl } = require("./searchDiscovery");
const { runPipeline } = require("./pipeline");

async function saveDiscoveryLead(item) {
  const data = { url: item.url, domain: item.domain, title: item.title, description: item.description,
    classification: item.classification, reason: item.reason, provider: item.provider,
    publishedAt: item.publishedAt, discoveredAt: item.firstDiscoveredAt, sourceKey: item.sourceKey };
  const verification = item.reviewStatus ? { reviewStatus: item.reviewStatus, pageAvailability: item.pageAvailability,
    applicationState: item.applicationState, reason: item.reason } : {};
  // Refresh diagnostics on an existing lead without changing its approval.
  if (verification.reason) delete data.reason;
  const result = await Lead.updateOne({ url: item.url }, { $setOnInsert: data,
    $set: { lastDiscoveredAt: new Date(), ...verification }, $addToSet: { discoveredByQueries: { $each: item.discoveredByQueries || [] } } }, { upsert: true });
  return Boolean(result.upsertedCount);
}
async function executeSearch(run, sources, provider) {
  const report = await runSearchDiscovery(sources, { provider, rotation: run.searchRotation, saveLead: saveDiscoveryLead });
  await Run.updateOne({ _id: run._id }, { $set: { searchReport: report, summary: report.summary,
    status: report.status, error: report.error, finishedAt: new Date() }, $unset: { lock: 1 } });
  return report;
}
async function runFromSearch(sources, report, options) {
  // A saved search report is not authorization: scopes may have been revoked.
  const selected = report.results.filter((r) => r.accepted).map((r) => {
    const trust = classifyUrl(r.url, sources);
    return { ...r, ...trust, accepted: ["official_company", "official_ats"].includes(trust.classification) };
  });
  const selectedKeys = new Set(selected.filter((r) => r.accepted).map((r) => r.sourceKey));
  const keys = require("./priority").prioritizeSources(sources.filter((source) => selectedKeys.has(source.key))).slice(0, 20).map((source) => source.key);
  const orderedSources = keys.map((key) => sources.find((s) => s.key === key));
  const result = await runPipeline(orderedSources, { ...options, searchResults: selected });
  const remaining = selected.filter((r) => !r.accepted || !keys.includes(r.sourceKey) ||
    selected.filter((other) => other.accepted && other.sourceKey === r.sourceKey).indexOf(r) >= (sources.find((s) => s.key === r.sourceKey)?.metadata.maxPages || 8));
  for (const row of remaining) result.sources.push({ key: row.sourceKey || "unapproved", name: "Search selection", status: "skipped", checked: false,
    details: [{ stage: "selection", url: row.url, code: row.accepted ? "EXTRACTION_BUDGET_REACHED" : "SOURCE_SCOPE_REVOKED" }] });
  result.summary = { ...result.summary, searchQueriesRun: report.summary.searchQueriesRun,
    searchResultsReceived: report.summary.searchResultsReceived, uniqueUrlsDiscovered: report.summary.uniqueUrlsDiscovered,
    officialUrlsClassified: report.summary.officialUrlsClassified,
    urlsDiscovered: report.summary.urlsDiscovered, officialUrlsAccepted: selected.filter((r) => r.accepted).length,
    urlsRejected: report.summary.urlsRejected + selected.filter((r) => !r.accepted).length,
    discoveryLeads: result.summary.discoveryLeads + report.summary.discoveryLeads, trainingSearchHints: report.summary.trainingSearchHints,
    recentTrainingHints: report.summary.recentTrainingHints, errors: result.summary.errors + report.summary.errors };
  result.summary.excludedOutsideSaudi += report.summary.excludedOutsideSaudi || 0;
  if (report.status === "partial" || remaining.length) result.status = "partial";
  return result;
}
module.exports = { executeSearch, runFromSearch, saveDiscoveryLead };
