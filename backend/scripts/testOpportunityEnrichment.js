// Network-only smoke test. Never loads credentials or connects to MongoDB.
const fs = require("node:fs");
const { SOURCES } = require("../services/opportunityDiscovery/sources");
const { createReader } = require("../services/opportunityDiscovery/http");
const { testOpportunityUrl } = require("../services/opportunityDiscovery/stages");

(async () => {
  const selected = ["stc", "aramco", "snb", "alrajhi"];
  const results = [];
  // Test-only tenant: official Bosch careers names SmartRecruiters as its
  // recruiting provider (https://jobs.bosch.com/en/). Not added to production.
  const bosch = { key: "bosch-smoke", company: "Bosch Group", sourceType: "ats", active: true, reviewStatus: "approved",
    officialDomains: ["www.bosch.com", "jobs.bosch.com"], careerDomains: ["jobs.smartrecruiters.com"], atsProvider: "smartrecruiters",
    atsIdentifiers: { apiUrl: "https://api.smartrecruiters.com/v1/companies/BoschGroup/postings" },
    metadata: { adapter: "smartrecruiters", aliases: ["Bosch", "Bosch Group", "Robert Bosch"], maxRequests: 8,
      scopes: ["https://jobs.smartrecruiters.com/BoschGroup/", "https://api.smartrecruiters.com/v1/companies/BoschGroup/", "https://jobs.smartrecruiters.com/oneclick-ui/company/BoschGroup/"] } };
  const sources = [...selected.map((key) => SOURCES.find((row) => row.key === key)),
    ...["744000095392785-business-management-intern", "744000095392835-software-development-intern"].map((slug) =>
      ({ ...bosch, sourceUrl: `https://jobs.smartrecruiters.com/BoschGroup/${slug}` }))];
  for (const source of sources) {
    const result = await testOpportunityUrl(source, source.sourceUrl, { reader: createReader(source), enrichment: true });
    results.push({ company: source.company, url: source.sourceUrl, ...result });
    console.log(source.company, result.code, result.results.map((row) => row.data?.reviewStatus || row.code).join(","));
  }
  const output = process.argv[2];
  if (output) fs.writeFileSync(output, JSON.stringify({ testedAt: new Date(), databaseWrites: 0, results }, null, 2));
  else console.log(JSON.stringify(results, null, 2));
})().catch((error) => { console.error(error.code || error.message); process.exitCode = 1; });
