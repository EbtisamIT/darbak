// Read-only live validation. No dotenv, models, database connection or writes.
const fs = require("node:fs");
const path = require("node:path");
const { createReader, pinnedRequest } = require("../services/opportunityDiscovery/http");
const { testOpportunityUrl } = require("../services/opportunityDiscovery/stages");

async function main() {
  const input = process.argv[2];
  const output = process.argv[3];
  if (!input || !output) throw new Error("Usage: node validateLiveOpportunities.js input.json output.json");
  const { testedAt, candidates } = JSON.parse(fs.readFileSync(input, "utf8"));
  const now = new Date(testedAt);
  if (!Number.isFinite(now.getTime())) throw new Error("A valid explicit validation date is required");
  const report = { testedAt, databaseWrites: 0, results: [] };
  for (const candidate of candidates) {
    const requests = [];
    const reader = createReader(candidate.source, {
      transport: async (url) => {
        const started = Date.now();
        try {
          const response = await pinnedRequest(url);
          requests.push({ url: url.href, status: response.status, durationMs: Date.now() - started });
          return response;
        } catch (error) {
          requests.push({ url: url.href, error: error.code || error.message, durationMs: Date.now() - started });
          throw error;
        }
      },
    });
    const result = await testOpportunityUrl(candidate.source, candidate.url, { reader, enrichment: true, now });
    report.results.push({ candidate, ...result, requests });
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ company: candidate.source.company, url: candidate.url, code: result.code,
      results: result.results.map((row) => ({ title: row.title, code: row.code, skip: row.skip,
        reviewStatus: row.data?.reviewStatus, completeness: row.data?.completenessScore,
        tasks: row.data?.responsibilities?.length, requirements: row.data?.requirements?.length })),
      failures: result.details.filter((row) => row.stage === "fetch"),
    }));
  }
}

if (require.main === module) main().catch((error) => { console.error(error.code || error.message); process.exitCode = 1; });
module.exports = { main };
