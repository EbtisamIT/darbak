const { createReader } = require("./http");
const { counters, observeReader, discoverUrls, extractOpportunity, verifyExtracted, emailLeads } = require("./stages");
const { failureCode } = require("./failures");
const { trainingType } = require("./extract");

const emptySummary = counters;
async function runPipeline(sources, { ingest, saveLead = async () => false, getLogo = async () => "", readerFactory = createReader,
  searchProvider = null, browserRenderer, onSource = async () => {}, onChecked = async () => {}, now = () => new Date(),
  deadline = Date.now() + 8 * 60000 } = {}) {
  if (!ingest) throw new Error("INGESTION_SERVICE_REQUIRED");
  const summary = counters(), logs = [];
  for (const source of sources.slice(0, 20)) {
    if (Date.now() >= deadline) break;
    const started = Date.now(), counts = counters(), details = [];
    const log = { key: source.key, name: source.name, checked: true, status: "success", found: 0, skipped: 0, warnings: [], error: "", counters: counts, details };
    const reader = observeReader(readerFactory(source, { deadline: Math.min(deadline, Date.now() + 60000) }), counts, details);
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
      const discovery = await discoverUrls(source, reader, { searchProvider, counts, details });
      log.warnings.push(...discovery.warnings);
      const logo = await getLogo(source), seen = new Set(); let created = 0;
      for (const reference of discovery.urls.slice(0, source.metadata.maxPages || 8)) {
        if (Date.now() >= deadline) throw new Error("RUN_TIME_LIMIT");
        let stage = "extraction";
        try {
          const extracted = await extractOpportunity(reference, source, reader, { browserRenderer });
          counts.opportunitiesExtracted += extracted.jobs.length;
          if (!extracted.jobs.length) {
            if (extracted.reason === "CLOSED") counts.closedOpportunities++;
            log.skipped++; details.push({ stage: "extraction", url: reference.url, code: extracted.reason, fetchMethod: extracted.fetchMethod });
            await storeLeads(extracted.page); continue;
          }
          let eligible = false;
          for (const job of extracted.jobs) {
            const identity = `${job.sourceUrl}|${job.title}`;
            if (seen.has(identity)) continue; seen.add(identity);
            if (trainingType(job.title, job.description)) counts.trainingPagesDetected++;
            stage = "verification";
            const result = await verifyExtracted(job, source, reader, { now: now(), logo });
            if (result.skip || result.code === "CLOSED") {
              log.skipped++; if (result.code === "CLOSED") counts.closedOpportunities++;
              details.push({ stage: "verification", url: job.sourceUrl, title: job.title, code: result.code, reason: result.skip, fetchMethod: extracted.fetchMethod }); continue;
            }
            eligible = true; log.found++; counts.opportunitiesFound++;
            if (created >= (source.metadata.maxCandidates || 5)) {
              details.push({ stage: "candidate", url: job.sourceUrl, code: "CANDIDATE_LIMIT_REACHED" }); continue;
            }
            stage = "candidate";
            const candidate = await ingest({ ...result.data, aiNotes: `${result.data.aiNotes} fetchMethod=${extracted.fetchMethod}` }); created++;
            if (candidate.status === "duplicate") counts.duplicates++;
            else if (candidate.status === "update_existing") counts.updates++;
            else { counts.newCandidates++; counts.candidatesCreated++; }
            details.push({ stage: "candidate", url: job.sourceUrl, code: candidate.status, fetchMethod: extracted.fetchMethod });
          }
          if (!eligible) await storeLeads(extracted.page);
        } catch (e) {
          const code = stage === "candidate" ? "CANDIDATE_CREATION_FAILED" : failureCode(e);
          counts.errors++; log.warnings.push(code); details.push({ stage, url: reference.url, code });
        }
      }
      if (!discovery.urls.length) for (const page of discovery.pages) await storeLeads(page);
    } catch (e) { log.error = failureCode(e); counts.errors++; }
    log.status = counts.errors ? (counts.pagesFetched ? "partial" : "failed") : "success";
    log.durationMs = Date.now() - started; log.requests = reader.requests;
    log.warnings = [...new Set(log.warnings)].slice(0, 30); log.details = details.slice(0, 200);
    for (const key of Object.keys(summary)) summary[key] += counts[key];
    logs.push(log); await onSource(source, log, { ...summary });
  }
  return { summary, sources: logs, status: logs.some((log) => log.status !== "success") || sources.length > logs.length ? "partial" : "completed" };
}
module.exports = { runPipeline, emptySummary };
