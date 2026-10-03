const { allowedUrl } = require("./http");
const { cleanOpportunityUrl } = require("../opportunityCandidateData");
const { searchOpportunityUrls } = require("./search");
const { planQueries, searchSettings } = require("./queryPack");
const { counters } = require("./stages");
const { candidateAdmission } = require("./admission");

const TRAINING = /\b(?:co-?op|cooperative training|internship|intern|student program|university program|summer training|trainee|industrial training)\b|تدريب تعاوني|تدريب صيفي|تدريب طلاب|برنامج طلاب|متدرب|فرصة تدريب|برنامج جامعي/i;
const ATS = /(?:^|\.)(?:greenhouse\.io|lever\.co|smartrecruiters\.com|myworkdayjobs\.com|oraclecloud\.com|successfactors\.(?:com|eu))$/i;
const SOCIAL = /(?:^|\.)(?:tiktok\.com|linkedin\.com|x\.com|twitter\.com|t\.me|telegram\.me|facebook\.com|instagram\.com)$/i;
// Classification only: never permission to fetch these job boards.
const JOB_BOARDS = new Set(["bayt.com", "www.bayt.com", "gulftalent.com", "www.gulftalent.com", "indeed.com", "sa.indeed.com"]);
function canonicalUrl(value) {
  try { const u = new URL(cleanOpportunityUrl(value)); u.hash = ""; u.searchParams.sort(); return u.href; } catch { return ""; }
}
function classifyUrl(url, sources) {
  let u; try { u = new URL(url); } catch { return { classification: "unknown", reason: "INVALID_URL" }; }
  if (u.protocol !== "https:" || (u.port && u.port !== "443")) return { classification: "unknown", reason: "POLICY_DENIED" };
  if (SOCIAL.test(u.hostname)) return { classification: "social", reason: "SOCIAL_NOT_FETCHED" };
  const matches = sources.filter((s) => s.active !== false && s.reviewStatus === "approved" && allowedUrl(url, s));
  if (matches.length > 1) return { classification: "unknown", reason: "AMBIGUOUS_COMPANY_SCOPE" };
  if (matches.length === 1) {
    const source = matches[0];
    return { classification: source.sourceType === "university" ? "university" :
      ATS.test(u.hostname) || ((source.atsProvider || source.metadata.adapter) !== "generic" && source.careerDomains?.includes(u.hostname)) ? "official_ats" : "official_company",
    sourceKey: source.key, reason: "APPROVED_SOURCE_SCOPE" };
  }
  if (/(?:^|\.)edu\.sa$/i.test(u.hostname)) return { classification: "university", reason: "UNIVERSITY_REVIEW_ONLY" };
  if (JOB_BOARDS.has(u.hostname)) return { classification: "trusted_job_board", reason: "JOB_BOARD_REVIEW_ONLY" };
  return { classification: "unknown", reason: ATS.test(u.hostname) ? "ATS_TENANT_NOT_APPROVED" : "SOURCE_SCOPE_NOT_APPROVED" };
}
async function runSearchDiscovery(sources, { provider, settings = searchSettings(), rotation = 0,
  now = new Date(), saveLead = async () => false } = {}) {
  const summary = counters(), queries = [], results = [], byUrl = new Map();
  if (!provider) return { status: "failed", error: "SEARCH_PROVIDER_NOT_CONFIGURED", summary, queries, results, rotation };
  const plan = planQueries(sources, { maxQueries: settings.maxQueries, rotation });
  let cursor = 0, stopCode = "";
  async function worker() {
    while (cursor < plan.length && !stopCode) {
      const index = cursor++, planned = plan[index]; summary.searchQueriesRun++;
      try {
        const response = await searchOpportunityUrls(planned.query, { provider, limit: settings.resultsPerQuery, freshness: planned.freshness });
        summary.searchResultsReceived += response.results.length;
        queries[index] = { ...planned, count: response.results.length, code: "SEARCH_COMPLETED" };
        for (const row of response.results) {
          const url = canonicalUrl(row.url); if (!url) continue;
          const text = (v, max) => String(v || "").replace(/<[^>]*>/g, " ").slice(0, max);
          const metadata = { title: text(row.title, 300), description: text(row.description, 800),
            publishedAt: row.publishedAt && Number.isFinite(Date.parse(row.publishedAt)) ? new Date(row.publishedAt).toISOString() : null,
            query: planned.query, provider: provider.name || "external" };
          if (byUrl.has(url)) {
            const existing = byUrl.get(url);
            if (!existing.discoveredByQueries.includes(planned.query)) existing.discoveredByQueries.push(planned.query);
            existing.searchResults.push({ publishedAt: metadata.publishedAt });
            existing.trainingHint ||= TRAINING.test(`${metadata.title} ${metadata.description}`);
            continue;
          }
          const item = { ...metadata, url, domain: new URL(url).hostname, ...classifyUrl(url, sources),
            trainingHint: TRAINING.test(`${metadata.title} ${metadata.description}`), discoveredByQueries: [planned.query],
            firstDiscoveredAt: now.toISOString(), searchResults: [{ publishedAt: metadata.publishedAt }] };
          byUrl.set(url, item);
        }
      } catch (e) {
        const code = /^SEARCH_|^INVALID_SEARCH_/.test(e.code || e.message) ? (e.code || e.message) : "SEARCH_FAILED";
        queries[index] = { ...planned, count: 0, code }; summary.errors++;
        if (["SEARCH_RATE_LIMITED", "SEARCH_AUTH_FAILED", "SEARCH_PROVIDER_NOT_CONFIGURED"].includes(code)) stopCode = code;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(settings.concurrency, plan.length) }, worker));
  for (const item of byUrl.values()) {
    if (["official_company", "official_ats"].includes(item.classification)) summary.officialUrlsClassified++;
    const source = sources.find((s) => s.key === item.sourceKey);
    const admission = candidateAdmission({ ...item, company: source?.company }, source);
    item.admissionReason = admission.reason;
    item.accepted = ["official_company", "official_ats"].includes(item.classification) && item.trainingHint && admission.accepted;
    if (!item.trainingHint) item.reason = "NOT_TRAINING_SEARCH_RESULT";
    else if (item.accepted) item.reason = "OFFICIAL_TRAINING_HINT_REQUIRES_EXTRACTION";
    else if (!admission.accepted) item.reason = admission.reason;
    if (item.trainingHint && admission.reason === "OUTSIDE_SAUDI") summary.excludedOutsideSaudi++;
    if (item.accepted) summary.officialUrlsAccepted++; else summary.urlsRejected++;
    item.recentHint = item.searchResults.some((r) => r.publishedAt && now - new Date(r.publishedAt) >= 0 && now - new Date(r.publishedAt) <= 31 * 86400000);
    if (!item.accepted && item.trainingHint && admission.reason !== "OUTSIDE_SAUDI" && await saveLead(item)) summary.discoveryLeads++;
    results.push(item);
  }
  summary.uniqueUrlsDiscovered = summary.urlsDiscovered = results.length;
  summary.trainingSearchHints = results.filter((r) => r.trainingHint).length;
  summary.recentTrainingHints = results.filter((r) => r.trainingHint && r.recentHint).length;
  return { status: summary.errors ? (results.length ? "partial" : "failed") : "completed", error: stopCode,
    summary, queries: queries.filter(Boolean), results: results.sort((a, b) => Number(b.accepted) - Number(a.accepted) || Number(b.recentHint) - Number(a.recentHint) || a.url.localeCompare(b.url)), rotation };
}
module.exports = { runSearchDiscovery, classifyUrl, canonicalUrl, TRAINING };
