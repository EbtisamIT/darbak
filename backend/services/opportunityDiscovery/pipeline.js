const { createReader } = require("./http");
const { counters, observeReader, discoverUrls, extractOpportunity, verifyExtracted, emailLeads } = require("./stages");
const { failureCode } = require("./failures");
const { trainingType } = require("./extract");
const { prioritizeSources } = require("./priority");

const emptySummary = counters;
async function runPipeline(sources, { ingest, saveLead = async () => false, getLogo = async () => "", readerFactory = createReader,
  searchProvider = null, browserRenderer, onSource = async () => {}, onChecked = async () => {}, now = () => new Date(),
  searchResults, enrichment = false,
  saveSearchLead = async () => false,
  deadline = Date.now() + 8 * 60000 } = {}) {
  if (!ingest) throw new Error("INGESTION_SERVICE_REQUIRED");
  const summary = counters(), logs = [], fetched = new Map(), blockedSearchLeads = [];
  for (const source of prioritizeSources(sources).slice(0, 20)) {
    if (Date.now() >= deadline) break;
    const started = Date.now(), counts = counters(), details = [];
    const log = { key: source.key, name: source.name, checked: true, status: "success", found: 0, skipped: 0, warnings: [], error: "", counters: counts, details };
    const baseReader = readerFactory(source, { deadline: Math.min(deadline, Date.now() + 60000) });
    const memo = (fn) => (url) => {
      // Recheck ownership even when an earlier source already fetched this URL.
      if (!require("./http").allowedUrl(url, source)) throw new Error("UNAPPROVED_URL_SCOPE");
      const key = require("./searchDiscovery").canonicalUrl(url);
      if (!fetched.has(key)) fetched.set(key, Promise.resolve().then(() => fn(key)));
      return fetched.get(key);
    };
    const reader = observeReader({ read: memo(baseReader.read.bind(baseReader)),
      readAsset: memo((baseReader.readAsset || baseReader.read).bind(baseReader)), get requests() { return baseReader.requests; } }, counts, details);
    counts.sourcesChecked = 1;
    const leadsSeen = new Set();
    async function storeLeads(page) {
      for (const lead of emailLeads(page, source)) {
        if (leadsSeen.has(lead.email)) continue; leadsSeen.add(lead.email);
        if (await saveLead(lead)) counts.emailLeads++;
      }
    }
    try {
      await onChecked(source, now());
      const discovery = searchResults ? { urls: searchResults.filter((r) => r.accepted && r.sourceKey === source.key)
        .map((r) => ({ ...r, via: "search" })), pages: [], warnings: [] } :
        await discoverUrls(source, reader, { searchProvider, counts, details });
      log.warnings.push(...discovery.warnings);
      const logo = await getLogo(source), seen = new Set(); let created = 0;
      for (const reference of discovery.urls.slice(0, source.metadata.maxPages || 8)) {
        if (Date.now() >= deadline) throw new Error("RUN_TIME_LIMIT");
        let stage = "extraction";
        try {
          const extracted = await extractOpportunity(reference, source, reader, { browserRenderer });
          counts.opportunitiesExtracted += extracted.jobs.length;
          if (extracted.jobs.length) counts.pagesExtracted++;
          if (!extracted.jobs.length) {
            if (extracted.reason === "CLOSED") counts.closedOpportunities++;
            log.skipped++; details.push({ stage: "extraction", url: reference.url, code: extracted.reason, fetchMethod: extracted.fetchMethod });
            await storeLeads(extracted.page); continue;
          }
          let eligible = false;
          for (const job of extracted.jobs) {
            const identity = `${job.sourceUrl}|${job.title}`;
            if (seen.has(identity)) continue;
            if (trainingType(job.title, job.description)) counts.trainingPagesDetected++;
            stage = enrichment ? "enrichment_verification" : "verification";
            const result = await verifyExtracted(job, source, reader, { now: now(), logo, enrichment, fetchMethod: extracted.fetchMethod });
            if (result.skip || (result.code === "CLOSED" && !enrichment)) {
              if (["CLOSED", "OLD_OPPORTUNITY", "NOT_TRAINING"].includes(result.code)) seen.add(identity);
              log.skipped++; if (result.code === "CLOSED") counts.closedOpportunities++;
              if (result.code === "OLD_OPPORTUNITY") counts.oldOpportunities++;
              details.push({ stage: "verification", url: job.sourceUrl, title: job.title, code: result.code, reason: result.skip, fetchMethod: extracted.fetchMethod }); continue;
            }
            seen.add(identity); eligible = true; log.found++; counts.opportunitiesFound++;
            if (enrichment) {
              counts.opportunitiesEnriched++; counts.completenessTotal += result.data.completenessScore;
              if (result.code === "CLOSED") counts.closedOpportunities++;
            }
            if (created >= (source.metadata.maxCandidates || 5)) {
              details.push({ stage: "candidate", url: job.sourceUrl, code: "CANDIDATE_LIMIT_REACHED" }); continue;
            }
            stage = "candidate";
            const searchDiscovery = reference.via === "search" && reference.discoveredByQueries ? {
              provider: reference.provider, resultTitle: reference.title || "", resultDescription: reference.description || "",
              resultPublishedAt: reference.publishedAt || null, firstDiscoveredAt: reference.firstDiscoveredAt,
              discoveredByQueries: reference.discoveredByQueries, classification: reference.classification,
            } : undefined;
            const candidate = await ingest({ ...result.data, ...(searchDiscovery ? { searchDiscovery } : {}), aiNotes: `${result.data.aiNotes} fetchMethod=${extracted.fetchMethod}` }); created++;
            if (candidate.status === "duplicate") counts.duplicates++;
            else if (candidate.status === "update_existing") counts.updates++;
            else { counts.newCandidates++; counts.candidatesCreated++; }
            if (candidate.status === "needs_review") counts.needsReview++;
            const reviewCounter = { READY_FOR_REVIEW: "readyForReview", NEEDS_DETAILS: "needsDetails", NEEDS_VERIFICATION: "needsVerification" }[candidate.reviewStatus];
            if (reviewCounter) counts[reviewCounter]++;
            details.push({ stage: "candidate", url: job.sourceUrl, code: candidate.reviewStatus || candidate.status,
              candidateId: String(candidate._id || ""), completenessScore: candidate.completenessScore, missingFields: candidate.missingFields, fetchMethod: extracted.fetchMethod });
          }
          if (!eligible) await storeLeads(extracted.page);
        } catch (e) {
          const code = stage === "candidate" ? "CANDIDATE_CREATION_FAILED" : failureCode(e);
          counts.errors++; log.warnings.push(code); details.push({ stage, url: reference.url, code });
          if (code === "ROBOTS_DENIED" && reference.via === "search") {
            const lead = { ...reference, sourceKey: source.key, reason: code, accepted: false,
              reviewStatus: "NEEDS_VERIFICATION", pageAvailability: "BLOCKED", applicationState: "UNKNOWN" };
            blockedSearchLeads.push(lead);
            if (await saveSearchLead(lead)) counts.discoveryLeads++;
            details.push({ stage: "lead", url: reference.url, code: "NEEDS_VERIFICATION", reason: code });
          }
        }
      }
      if (!discovery.urls.length) for (const page of discovery.pages) await storeLeads(page);
    } catch (e) { log.error = failureCode(e); counts.errors++; }
    log.status = counts.errors ? (counts.pagesFetched ? "partial" : "failed") : "success";
    log.durationMs = Date.now() - started; log.requests = reader.requests;
    log.warnings = [...new Set(log.warnings)].slice(0, 30); log.details = details.slice(0, 200);
    for (const key of Object.keys(summary)) summary[key] += counts[key];
    summary.averageCompleteness = summary.opportunitiesEnriched ? Math.round(summary.completenessTotal / summary.opportunitiesEnriched) : 0;
    logs.push(log); await onSource(source, log, { ...summary });
  }
  return { summary, sources: logs, blockedSearchLeads,
    status: logs.some((log) => log.status !== "success") || sources.length > logs.length ? "partial" : "completed" };
}
module.exports = { runPipeline, emptySummary };
