const { cleanOpportunityUrl, getMissingFields } = require("../opportunityCandidateData");
const { allowedUrl } = require("./http");
const { strategyFor } = require("./strategies");
const { queriesFor, searchOpportunityUrls } = require("./search");
const { failureCode } = require("./failures");
const { emails, text, trainingType } = require("./extract");

const counterKeys = ["sourcesChecked", "searchQueriesRun", "urlsDiscovered", "officialUrlsAccepted", "urlsRejected",
  "pagesFetched", "fetchFailures", "trainingPagesDetected", "opportunitiesExtracted", "candidatesCreated",
  "duplicates", "updates", "emailLeads", "closedOpportunities", "errors", "opportunitiesFound", "newCandidates"];
const counters = () => Object.fromEntries(counterKeys.map((key) => [key, 0]));
function observeReader(reader, counts, details) {
  const seen = new Set();
  const wrap = (fn) => async (url) => {
    try {
      const page = await fn(url);
      if (!seen.has(url)) { counts.pagesFetched++; seen.add(url); }
      return page;
    } catch (e) {
      counts.fetchFailures++; details.push({ stage: "fetch", url, code: failureCode(e), reason: String(e.code || e.message).slice(0, 160) }); throw e;
    }
  };
  return { read: wrap(reader.read.bind(reader)), readAsset: wrap((reader.readAsset || reader.read).bind(reader)), get requests() { return reader.requests; } };
}
function acceptUrls(rows, source, counts, details) {
  const seen = new Set(), accepted = [];
  for (const row of rows.slice(0, 100)) {
    let url;
    try { const u = new URL(cleanOpportunityUrl(row.url)); u.hash = ""; url = u.href; } catch { url = String(row.url || "").slice(0, 3000); }
    if (seen.has(url)) continue; seen.add(url); counts.urlsDiscovered++;
    if (!allowedUrl(url, source) || (row.apiUrl && !allowedUrl(row.apiUrl, source))) {
      counts.urlsRejected++; details.push({ stage: "discovery", url, code: "POLICY_DENIED" }); continue;
    }
    counts.officialUrlsAccepted++; accepted.push({ ...row, url });
    details.push({ stage: "discovery", url, via: row.via, code: "OFFICIAL_URL_ACCEPTED" });
  }
  return accepted;
}
async function discoverUrls(source, reader, { searchProvider, counts = counters(), details = [] } = {}) {
  const rows = [], pages = [], warnings = [];
  // One failed careers page must not discard independently discovered search URLs.
  try {
    const result = await strategyFor(source).discoverJobs(source, reader);
    rows.push(...result.urls); pages.push(...result.pages); warnings.push(...result.warnings);
  } catch (e) { counts.errors++; warnings.push(failureCode(e)); }
  if (!searchProvider) warnings.push("SEARCH_PROVIDER_NOT_CONFIGURED");
  else for (const query of queriesFor(source).slice(0, source.metadata.maxQueries || 3)) {
    counts.searchQueriesRun++;
    try {
      const result = await searchOpportunityUrls(query, { provider: searchProvider });
      rows.push(...result.urls.map((url) => ({ url, via: "search" })));
      details.push({ stage: "search", query, count: result.urls.length, code: "SEARCH_COMPLETED" });
    } catch (e) { counts.errors++; details.push({ stage: "search", query, code: failureCode(e) }); }
  }
  return { urls: acceptUrls(rows, source, counts, details), pages, warnings };
}
async function extractOpportunity(reference, source, reader, { browserRenderer } = {}) {
  const adapter = strategyFor(source);
  let result = await adapter.extractJob(reference, source, reader);
  if (result.reason === "DYNAMIC_PAGE" && browserRenderer) {
    const rendered = await browserRenderer(reference.url, source, reader);
    result = await adapter.extractJob(reference, source, { ...reader, read: async (url) => url === reference.url ? rendered : reader.read(url) });
    result.fetchMethod = "browser";
  }
  return result;
}
async function verifyExtracted(job, source, reader, options) {
  const result = await strategyFor(source).verifyJob(job, source, reader, options);
  if (result.skip) return { ...result, code: failureCode(result.skip) };
  return { ...result, missingFields: getMissingFields(result.data), code: result.data.verification.appearsOpen === false ? "CLOSED" : "VERIFIED_FOR_REVIEW" };
}
function emailLeads(page, source) {
  if (!page || !allowedUrl(page.url, source)) return [];
  // No location/major inference from company identity or registry country.
  return emails(text(page.text), page.url).map((item) => ({ company: source.company, email: item.email,
    emailType: item.type, sourceUrl: item.sourceUrl, officialSource: true, confidence: item.confidence, status: "new" }));
}
async function testOpportunityUrl(source, url, { reader, browserRenderer, now = new Date(), logo = "" } = {}) {
  const counts = counters(), details = [], refs = acceptUrls([{ url, via: "known_url" }], source, counts, details);
  if (!refs.length) return { stage: "discovery", code: "POLICY_DENIED", results: [], counters: counts, details };
  const observed = observeReader(reader, counts, details);
  try {
    const extracted = await extractOpportunity(refs[0], source, observed, { browserRenderer });
    counts.opportunitiesExtracted = extracted.jobs.length;
    if (!extracted.jobs.length) {
      if (extracted.reason === "CLOSED") counts.closedOpportunities++;
      return { stage: "extraction", code: extracted.reason, fetchMethod: extracted.fetchMethod,
        results: [], leads: emailLeads(extracted.page, source), counters: counts, details };
    }
    const results = [];
    for (const job of extracted.jobs.slice(0, 5)) {
      if (trainingType(job.title, job.description)) counts.trainingPagesDetected++;
      const verified = await verifyExtracted(job, source, observed, { now, logo });
      if (verified.code === "CLOSED") counts.closedOpportunities++;
      results.push({ title: job.title, extracted: job, ...verified, fetchMethod: extracted.fetchMethod });
    }
    return { stage: "verification", code: "TEST_COMPLETED", results, counters: counts, details };
  } catch (e) { counts.errors++; return { stage: "extraction", code: failureCode(e), results: [], counters: counts, details }; }
}
module.exports = { counters, observeReader, acceptUrls, discoverUrls, extractOpportunity, verifyExtracted, emailLeads, testOpportunityUrl };
