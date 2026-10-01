// Read-only smoke test: does not load .env, connect MongoDB, or create candidates.
const { SOURCES } = require("../services/opportunityDiscovery/sources");
const { runPipeline } = require("../services/opportunityDiscovery/pipeline");
const { createReader } = require("../services/opportunityDiscovery/http");
const { testOpportunityUrl } = require("../services/opportunityDiscovery/stages");
const { configuredSearchProvider } = require("../services/opportunityDiscovery/search");
const { renderPage } = require("../services/opportunityDiscovery/browser");
const { validateSource } = require("../services/opportunityDiscovery/registry");
const { runSearchDiscovery } = require("../services/opportunityDiscovery/searchDiscovery");
const { runFromSearch } = require("../services/opportunityDiscovery/searchWorkflow");

(async () => {
  const key = process.argv.find((arg) => arg.startsWith("--source="))?.split("=")[1];
  const file = process.argv.find((arg) => arg.startsWith("--registry="))?.slice(11);
  const registry = file ? JSON.parse(require("fs").readFileSync(file, "utf8")).map(validateSource) : SOURCES;
  const sources = registry.filter((source) => !key || source.key === key);
  if (!sources.length) throw new Error("Unknown registry key");
  const url = process.argv.find((arg) => arg.startsWith("--url="))?.slice(6);
  const browserRenderer = process.env.DISCOVERY_BROWSER_EXECUTABLE ? renderPage : undefined;
  // Explicit opt-in loads the server secret only, without using its database URI.
  if (process.argv.includes("--load-brave-env")) {
    const envFile = require("path").join(__dirname, "../.env");
    if (require("fs").existsSync(envFile)) {
      const env = require("dotenv").parse(require("fs").readFileSync(envFile));
      for (const name of ["BRAVE_SEARCH_API_KEY", "DISCOVERY_MAX_SEARCH_QUERIES_PER_RUN", "DISCOVERY_RESULTS_PER_QUERY", "DISCOVERY_SEARCH_CONCURRENCY"])
        if (env[name] && !process.env[name]) process.env[name] = env[name];
    }
  }
  if (process.argv.includes("--search-only")) {
    const report = await runSearchDiscovery(sources, { provider: configuredSearchProvider(),
      rotation: Number(process.argv.find((arg) => arg.startsWith("--rotation="))?.slice(11)) || 0 });
    const output = process.argv.find((arg) => arg.startsWith("--output="))?.slice(9);
    if (output) require("fs").writeFileSync(output, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2)); if (report.status === "failed") process.exitCode = 1; return;
  }
  const reportFile = process.argv.find((arg) => arg.startsWith("--full-from="))?.slice(12);
  if (reportFile) {
    const report = JSON.parse(require("fs").readFileSync(reportFile, "utf8"));
    if (!["completed", "partial"].includes(report.status) || !report.results?.some((r) => r.accepted)) throw new Error("SEARCH_ONLY_RESULTS_REQUIRED");
    let eligibleCandidates = 0;
    const result = await runFromSearch(sources, report, { browserRenderer,
      ingest: async (data) => { eligibleCandidates++; console.log(JSON.stringify({ verificationOnly: true, data })); return { status: "verification_only" }; } });
    result.summary.candidatesCreated = result.summary.newCandidates = 0;
    console.log(JSON.stringify({ verificationOnly: true, candidateWrites: 0, eligibleCandidates, ...result }, null, 2)); return;
  }
  if (url) {
    if (sources.length !== 1) throw new Error("Select exactly one --source for a known URL test");
    console.log(JSON.stringify(await testOpportunityUrl(sources[0], url, { reader: createReader(sources[0]), browserRenderer }), null, 2)); return;
  }
  if (process.argv.includes("--verify")) {
    for (const source of sources) {
      try {
        const page = await createReader(source).read(source.sourceUrl);
        console.log(JSON.stringify({ key: source.key, status: page.status, finalUrl: page.url, bytes: Buffer.byteLength(page.text) }));
      } catch (e) { console.log(JSON.stringify({ key: source.key, error: e.code || e.message })); }
    }
    return;
  }
  const result = await runPipeline(sources, {
    searchProvider: configuredSearchProvider(), browserRenderer,
    ingest: async (candidate) => {
      console.log(JSON.stringify({ dryRun: true, title: candidate.title, company: candidate.company,
        sourceUrl: candidate.sourceUrl, confidenceScore: candidate.confidenceScore, verification: candidate.verification }));
      return { status: "needs_review" };
    },
    onSource: async (_, log) => console.log(JSON.stringify(log)),
  });
  console.log(JSON.stringify({ dryRun: true, ...result.summary, status: result.status }));
})().catch((e) => { console.error(e.message); process.exitCode = 1; });
