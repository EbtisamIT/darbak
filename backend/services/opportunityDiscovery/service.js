const Source = require("../../models/OpportunitySource");
const Run = require("../../models/OpportunityDiscoveryRun");
const Company = require("../../models/Company");
const { createOpportunityCandidate, fail } = require("../opportunityCandidates");
const { companyAliasesMatchName } = require("../companyDirectorySeeds");
const { SOURCES } = require("./sources");
const { runPipeline, emptySummary } = require("./pipeline");
const { registrySources, saveEmailLead } = require("./management");
const { configuredSearchProvider } = require("./search");
const { renderPage } = require("./browser");
const { executeSearch, runFromSearch, saveDiscoveryLead } = require("./searchWorkflow");
const { runOpportunityAutomation } = require("./automation");
const { admitRun, schedulingConfiguration, runMetrics } = require("./runControl");

async function initializeSources() {
  await Source.init();
  for (const source of SOURCES) await Source.updateOne({ key: source.key }, { $setOnInsert: source }, { upsert: true });
}
async function expireInterruptedRuns() {
  await Run.updateMany({ lock: "discovery", leaseUntil: { $lte: new Date() } }, {
    $set: { status: "interrupted", finishedAt: new Date(), error: "RUN_INTERRUPTED_OR_TIMED_OUT" }, $unset: { lock: 1 },
  });
}
async function execute(run) {
  const heartbeat = setInterval(() => Run.updateOne({ _id: run._id, lock: "discovery" },
    { $set: { leaseUntil: new Date(Date.now() + 15 * 60000) } }).catch(() =>
    console.error("Opportunity discovery lease renewal failed.")), 30000);
  heartbeat.unref();
  try {
    await initializeSources();
    // Oldest-checked first rotates bounded batches fairly as the registry grows.
    const sources = (await registrySources({ activeOnly: true })).sort((a, b) =>
      new Date(a.lastCheckedAt || 0) - new Date(b.lastCheckedAt || 0));
    if (run.runType === "search-only") { await executeSearch(run, sources, configuredSearchProvider()); return; }
    const companies = await Company.find({ logoUrl: { $nin: ["", null] } }).select("name nameAr nameEn aliases contentAliases logoUrl").lean();
    const options = {
      enrichment: true,
      ingest: async (data) => {
        if (!await Run.exists({ _id: run._id, lock: "discovery", leaseUntil: { $gt: new Date() } })) throw new Error("RUN_LEASE_LOST");
        return createOpportunityCandidate(data, { audit: { importedVia: "official_discovery" } });
      },
      saveLead: saveEmailLead,
      saveSearchLead: saveDiscoveryLead,
      browserRenderer: process.env.DISCOVERY_BROWSER_EXECUTABLE ? renderPage : undefined,
      getLogo: async (source) => {
        const matches = companies.filter((c) => companyAliasesMatchName(c, source.company));
        return matches.length === 1 ? matches[0].logoUrl : "";
      },
      onChecked: (source, date) => Source.updateOne({ key: source.key }, { $set: { lastCheckedAt: date } }),
      onSource: async (source, log, summary) => {
        const success = log.status === "success";
        await Source.updateOne({ key: source.key }, {
          $set: { lastError: success ? "" : log.error || log.warnings.join(", "),
            ...(success ? { lastSuccessAt: new Date(), failureCount: 0 } : {}),
            ...(log.found ? { lastOpportunityFoundAt: new Date() } : {}) },
          ...(!success ? { $inc: { failureCount: 1 } } : {}),
        });
        await Run.updateOne({ _id: run._id, lock: "discovery" }, { $push: { sources: log }, $set: { summary } });
        console.info("Opportunity discovery source", { key: source.key, status: log.status, found: log.found,
          durationMs: log.durationMs, requests: log.requests, error: log.error, warnings: log.warnings });
      },
    };
    const parent = run.runType === "full" ? await Run.findById(run.searchRunId).lean() : null;
    if (run.runType === "full" && !parent?.searchReport) throw new Error("SEARCH_REPORT_UNAVAILABLE");
    const result = run.runType === "automation" ? await runOpportunityAutomation(sources, {
      ...options, provider: configuredSearchProvider(), rotation: run.searchRotation,
      onSearch: (searchReport) => Run.updateOne({ _id: run._id }, { $set: { searchReport, summary: searchReport.summary } }),
    }) : parent ? await runFromSearch(sources, parent.searchReport, options) : await runPipeline(sources, options);
    await Run.updateOne({ _id: run._id, lock: "discovery" }, { $set: { status: result.status, summary: result.summary,
      sources: result.sources, ...(result.searchReport ? { searchReport: result.searchReport } : parent ? { searchReport: parent.searchReport } : {}), finishedAt: new Date() }, $unset: { lock: 1 } });
  } catch {
    await Run.updateOne({ _id: run._id }, { $set: { status: "failed", error: "DISCOVERY_RUN_FAILED", finishedAt: new Date() }, $unset: { lock: 1 } });
  } finally {
    clearInterval(heartbeat);
    await Run.updateOne({ _id: run._id }, { $set: { durationMs: Date.now() - new Date(run.startedAt || run.createdAt).getTime() } });
  }
}
async function startDiscovery({ mode = "search-only", searchRunId } = {}) {
  if (!["search-only", "full", "automation"].includes(mode)) fail(400, "اختاري search-only أو full أو automation.");
  if (["search-only", "automation"].includes(mode) && !configuredSearchProvider()) fail(503, "SEARCH_PROVIDER_NOT_CONFIGURED: أضيفي BRAVE_SEARCH_API_KEY إلى بيئة الباك إند.");
  if (mode === "full") {
    if (!/^[a-f0-9]{24}$/i.test(searchRunId || "")) fail(400, "اختاري تشغيل بحث مكتمل أولًا.");
    const parent = await Run.findOne({ _id: searchRunId, runType: "search-only", status: { $in: ["completed", "partial"] },
      createdAt: { $gt: new Date(Date.now() - 86400000) } }).lean();
    if (!parent?.searchReport?.results?.some((r) => r.accepted)) fail(422, "لا يوجد بحث حديث بروابط رسمية مؤهلة للاستخراج.");
  }
  await Run.init(); await expireInterruptedRuns();
  if (await Run.exists({ lock: "discovery" })) fail(409, "SKIP_ALREADY_RUNNING: يوجد تشغيل قيد التنفيذ.");
  const recent = await Run.findOne({ runType: { $ne: "known-url" }, createdAt: { $gt: new Date(Date.now() - 60000) } }).select("_id").lean();
  if (recent) fail(429, "انتظري دقيقة بين تشغيلات الاكتشاف.");
  let run;
  const previous = await Run.findOne({ runType: { $in: ["search-only", "automation"] } }).sort({ createdAt: -1 }).select("searchRotation").lean();
  run = await admitRun({ runType: mode, searchRunId: mode === "full" ? searchRunId : undefined,
    searchRotation: previous ? previous.searchRotation + 1 : 0,
    status: "running", lock: "discovery", leaseUntil: new Date(Date.now() + 15 * 60000), summary: emptySummary(), sources: [] });
  setImmediate(() => execute(run).catch(() => console.error("Opportunity discovery persistence failed; lease will expire.")));
  return run;
}
async function discoveryStatus() {
  await expireInterruptedRuns();
  const run = await Run.findOne({ runType: { $ne: "known-url" } }).sort({ createdAt: -1 }).select("-lock -__v").lean();
  const lastSearch = await Run.findOne({ runType: "search-only" }).sort({ createdAt: -1 }).select("_id status summary createdAt").lean();
  const history = await Run.find({ runType: { $ne: "known-url" } }).sort({ createdAt: -1 }).limit(10)
    .select("runType status startedAt createdAt finishedAt durationMs summary error").lean();
  return { run, lastSearch, recentRuns: history.map(runMetrics), scheduling: schedulingConfiguration(), sources: await registrySources(), searchConfigured: Boolean(process.env.DISCOVERY_SEARCH_PROVIDER_MODULE || process.env.BRAVE_SEARCH_API_KEY?.trim()),
    readiness: { databaseConnected: require("mongoose").connection.readyState === 1,
      importConfigured: (process.env.DARBAK_DISCOVERY_IMPORT_TOKEN || "").length >= 32,
      searchBudget: require("./queryPack").searchSettings(), deploymentCommit: process.env.RENDER_GIT_COMMIT || "local" },
    browserConfigured: Boolean(process.env.DISCOVERY_BROWSER_EXECUTABLE) };
}
module.exports = { startDiscovery, discoveryStatus, initializeSources };
