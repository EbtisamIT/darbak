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
  try {
    await initializeSources();
    // Oldest-checked first rotates bounded batches fairly as the registry grows.
    const sources = (await registrySources({ activeOnly: true })).sort((a, b) =>
      new Date(a.lastCheckedAt || 0) - new Date(b.lastCheckedAt || 0)).slice(0, 20);
    const companies = await Company.find({ logoUrl: { $nin: ["", null] } }).select("name nameAr nameEn aliases contentAliases logoUrl").lean();
    const result = await runPipeline(sources, {
      ingest: createOpportunityCandidate,
      saveLead: saveEmailLead, searchProvider: configuredSearchProvider(),
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
        console.info("Opportunity discovery source", JSON.stringify(log));
      },
    });
    await Run.updateOne({ _id: run._id, lock: "discovery" }, { $set: { status: result.status, summary: result.summary, finishedAt: new Date() }, $unset: { lock: 1 } });
  } catch {
    await Run.updateOne({ _id: run._id }, { $set: { status: "failed", error: "DISCOVERY_RUN_FAILED", finishedAt: new Date() }, $unset: { lock: 1 } });
  }
}
async function startDiscovery() {
  await Run.init(); await expireInterruptedRuns();
  const recent = await Run.findOne({ runType: { $ne: "known-url" }, createdAt: { $gt: new Date(Date.now() - 60000) } }).select("_id").lean();
  if (recent) fail(429, "انتظري دقيقة بين تشغيلات الاكتشاف.");
  let run;
  try { run = await Run.create({ status: "running", lock: "discovery", leaseUntil: new Date(Date.now() + 15 * 60000), summary: emptySummary(), sources: [] }); }
  catch (e) { if (e.code === 11000) fail(409, "يوجد اكتشاف قيد التشغيل بالفعل."); throw e; }
  setImmediate(() => execute(run).catch(() => console.error("Opportunity discovery persistence failed; lease will expire.")));
  return run;
}
async function discoveryStatus() {
  await expireInterruptedRuns();
  const run = await Run.findOne({ runType: { $ne: "known-url" } }).sort({ createdAt: -1 }).select("-lock -__v").lean();
  return { run, sources: await registrySources(), searchConfigured: Boolean(process.env.DISCOVERY_SEARCH_PROVIDER_MODULE),
    browserConfigured: Boolean(process.env.DISCOVERY_BROWSER_EXECUTABLE) };
}
module.exports = { startDiscovery, discoveryStatus, initializeSources };
