const assert = require("node:assert/strict");
const { candidateAdmission } = require("../services/opportunityDiscovery/admission");
const { runOpportunityAutomation } = require("../services/opportunityDiscovery/automation");
const { runPipeline } = require("../services/opportunityDiscovery/pipeline");

const source = { key: "stc", company: "STC", country: "SA", active: true, reviewStatus: "approved",
  sourceType: "company", officialDomains: ["stc.com.sa"], careerDomains: [],
  metadata: { aliases: ["Saudi Telecom Company"], adapter: "generic", scopes: ["https://stc.com.sa/"] } };
const check = (data) => candidateAdmission(data, source);
assert.equal(check({ company: "STC", title: "Internship" }).accepted, true);
assert.equal(check({ title: "Internship Riyadh" }).accepted, true);
assert.equal(check({ title: "تدريب تعاوني", cities: ["الخرج"] }).accepted, true);
assert.equal(check({ title: "Internship KSA" }).accepted, true);
assert.equal(check({ title: "Internship", url: "https://stc.com.sa/jobs/1" }).accepted, true);
assert.equal(check({ title: "Internship", url: "https://www.mim.gov.sa/jobs/1" }).accepted, true);
assert.equal(check({ company: "غير محددة", title: "Internship", discoveredByQueries: ["internship Saudi Arabia"] }).accepted, false);
for (const country of ["Tamil Nadu", "India", "UAE", "Egypt", "Qatar", "Dubai"]) {
  assert.equal(check({ company: "STC", title: `${country} Internship`, description: "Saudi Arabia search result" }).reason, "OUTSIDE_SAUDI");
}
assert.equal(check({ company: "STC", title: "Internship", cities: ["Doha"] }).reason, "OUTSIDE_SAUDI");
assert.equal(check({ company: "STC", title: "Internship", description: "Location: India" }).reason, "OUTSIDE_SAUDI");
assert.equal(check({ company: "STC", title: "India remote internship", description: "Open to students from Saudi Arabia" }).accepted, true);
assert.equal(check({ company: "STC", title: "India remote internship", description: "Our clients include Saudi Arabia" }).accepted, false);
assert.equal(check({ company: "STC", title: "Internship", description: "We have offices in India. This role is in Riyadh." }).accepted, true);
assert.equal(check({ title: "Training Riyadh", url: "https://www.tiktok.com/discover/training-riyadh" }).reason, "SOCIAL_AGGREGATION");
assert.equal(check({ title: "Internship", url: "https://www.linkedin.com/posts/123" }).reason, "SOCIAL_WITHOUT_EVIDENCE");
assert.equal(check({ title: "Internship Riyadh", url: "https://www.linkedin.com/posts/123" }).accepted, true);
assert.equal(check({ company: "STC", title: "Internship", url: "https://x.com/stc/status/123" }).accepted, true);
assert.equal(check({ title: "Internship Riyadh", url: "https://secondary.example/job/123" }).accepted, true);

(async () => {
  const saved = [], leads = [];
  const rows = [
    { title: "Tamil Nadu Cooperative Training Guide", url: "https://outside.example/job/1" },
    { title: "Training Internship Riyadh", url: "https://www.tiktok.com/discover/riyadh" },
    { title: "Internship", url: "https://unknown.example/job/1" },
    { title: "Internship Riyadh", url: "https://secondary.example/job/1" },
  ];
  const result = await runOpportunityAutomation([source], {
    settings: { maxQueries: 1, resultsPerQuery: 10, concurrency: 1 },
    provider: { name: "test", search: async () => rows },
    saveSearchLead: async (lead) => { leads.push(lead); return true; },
    ingest: async (data) => { saved.push(data); return { status: "needs_verification" }; },
  });
  assert.equal(saved.length, 1, "Only the Saudi secondary lead enters Inbox");
  assert.equal(saved[0].sourceUrl, "https://secondary.example/job/1");
  assert.equal(saved[0].company, "");
  assert.equal(saved[0].cities, undefined, "No city inferred from a search title");
  assert.equal(saved[0].requirements, undefined, "No invented requirements");
  assert.equal(result.summary.excludedOutsideSaudi, 1);
  assert.equal(result.summary.discoveryLeads, 3);
  assert.equal(result.summary.needsVerification, 1);
  assert.ok(!leads.some((lead) => lead.url.includes("outside.example")));
  assert.ok(result.searchReport.recoveryDetails.some((row) => row.code === "SOCIAL_AGGREGATION"));
  const url = "https://stc.com.sa/jobs/foreign-internship";
  const job = { "@type": "JobPosting", title: "Internship", hiringOrganization: { name: "STC" },
    description: "Location: India. University students can apply.", url,
    jobLocation: { address: { addressLocality: "India", addressCountry: "IN" } } };
  const foreign = await runPipeline([source], {
    searchResults: [{ accepted: true, sourceKey: source.key, url, title: "Internship", via: "search" }],
    readerFactory: () => ({ read: async () => ({ url, status: 200, text: `<script type="application/ld+json">${JSON.stringify(job)}</script>` }) }),
    ingest: () => assert.fail("Foreign location extracted from an official posting must not reach Inbox"),
  });
  assert.equal(foreign.summary.excludedOutsideSaudi, 1);
  assert.equal(foreign.summary.candidatesCreated, 0);
  console.log("Opportunity admission PASS: Saudi evidence, query isolation, foreign locations, remote exception, social leads, secondary candidate");
})().catch((error) => { console.error(error); process.exitCode = 1; });
