const assert = require("node:assert/strict");
const { testOpportunityUrl, counters } = require("../services/opportunityDiscovery/stages");
const { createReader } = require("../services/opportunityDiscovery/http");
const { APPLICATION_WARNING, availabilityFromError } = require("../services/opportunityApplicationPolicy");
const { isPublishable } = require("../services/opportunityCandidateData");
const { runOpportunityAutomation } = require("../services/opportunityDiscovery/automation");
const { prioritizeSources } = require("../services/opportunityDiscovery/priority");
const { planQueries } = require("../services/opportunityDiscovery/queryPack");
const { validateSource } = require("../services/opportunityDiscovery/registry");

const now = new Date("2026-10-02T00:00:00Z");
const source = { key: "teamtailor-test", name: "Example", company: "Example", active: true, reviewStatus: "approved",
  sourceType: "company", officialDomains: ["careers.example.test"], careerDomains: [], atsProvider: "teamtailor", searchQueries: [],
  metadata: { adapter: "teamtailor", scopes: ["https://careers.example.test/"], aliases: [], maxPages: 5 } };
const url = "https://careers.example.test/jobs/123-marketing-internship";
const posting = { "@type": "JobPosting", title: "Senior Students - Marketing Internship", url,
  hiringOrganization: { name: "Example" }, datePosted: "2026-09-07", jobLocation: { address: { addressLocality: "Riyadh", addressCountry: "SA" } },
  description: "<p>Senior university students seeking training.</p><h2>Requirements</h2><li>Basic Excel knowledge.</li>" };
const button = '<button data-action="click->form-overlay#showFormOverlay">Apply now 🎉</button>';
const html = (data = posting, cta = button) => `<script type="application/ld+json">${JSON.stringify(data)}</script><main>${cta}</main>`;
const reader = (value) => ({ read: async (link) => ({ url: link, status: 200, text: value }) });

async function main() {
  const result = await testOpportunityUrl(source, url, { reader: reader(html()), enrichment: true, now });
  const data = result.results[0].data;
  assert.equal(data.pageAvailability, "AVAILABLE");
  assert.equal(data.applicationState, "UNKNOWN_BUT_ACTIONABLE");
  assert.equal(data.verification.appearsOpen, null, "actionable must not claim a verified final form");
  assert.equal(data.reviewStatus, "READY_FOR_REVIEW");
  assert.deepEqual(data.verificationWarnings, [APPLICATION_WARNING]);
  assert.equal(data.extractionEvidence.applicationUrl.method, "html_cta");
  assert.equal(data.extractionEvidence.applicationUrl.rawText, "Apply now");
  assert.ok(isPublishable(data), "an explicit admin publication is allowed after review");
  assert.deepEqual(data.responsibilities, [], "no duties invented");
  assert.deepEqual(data.majors, [], "no major inferred from a marketing title");
  assert.equal(data.deadline, null);
  const unknown = await testOpportunityUrl(source, url, { reader: reader(html(posting, "")), enrichment: true, now });
  assert.equal(unknown.results[0].data.applicationState, "UNKNOWN");
  assert.equal(unknown.results[0].data.reviewStatus, "NEEDS_VERIFICATION");
  const disabled = await testOpportunityUrl(source, url, { reader: reader(html(posting, '<button disabled>Apply now</button>')), enrichment: true, now });
  assert.equal(disabled.results[0].data.applicationState, "UNKNOWN");
  const open = await testOpportunityUrl(source, url, { reader: reader(html(posting, `<a href="${url}/apply">Apply now</a>`)), enrichment: true, now });
  assert.equal(open.results[0].data.applicationState, "OPEN");
  for (const change of [{ description: "University students. Position closed." },
    { description: "University students. This position is no longer active. Either the position was filled, or the ad has expired." },
    { validThrough: "2026-09-01" }]) {
    const closed = await testOpportunityUrl(source, url, { reader: reader(html({ ...posting, ...change })), enrichment: true, now });
    assert.equal(closed.results[0].data.applicationState, "CLOSED");
    assert.equal(closed.results[0].data.reviewStatus, "CLOSED");
    assert.equal(isPublishable(closed.results[0].data, now), false);
  }
  const staleStructured = await testOpportunityUrl(source, url, { reader: reader(html(posting,
    '<h1>This position is no longer active</h1><p>Either the position was filled, or the ad has expired.</p>')), enrichment: true, now });
  assert.equal(staleStructured.results[0].data.applicationState, "CLOSED", "visible closure wins over stale JSON-LD");
  assert.equal(staleStructured.results[0].data.extractionEvidence.applicationState.method, "visible_html_closure");
  assert.match(staleStructured.results[0].data.extractionEvidence.applicationState.rawText, /no longer active/);
  for (const status of [404, 410]) {
    const gone = await testOpportunityUrl(source, url, { reader: { read: async () => { throw new Error(`HTTP_${status}`); } }, enrichment: true, now });
    assert.equal(gone.pageAvailability, "GONE"); assert.equal(gone.applicationState, "CLOSED"); assert.equal(gone.code, "CLOSED");
  }
  for (const [error, state] of [["ROBOTS_DISALLOWED", "BLOCKED"], ["REQUEST_TIMEOUT", "ERROR"], ["TLS_ERROR", "ERROR"]]) {
    assert.equal(availabilityFromError(error), state);
    const failure = await testOpportunityUrl(source, url, { reader: { read: async () => { throw new Error(error); } }, enrichment: true, now });
    assert.equal(failure.pageAvailability, state); assert.equal(failure.applicationState, "UNKNOWN"); assert.equal(failure.results.length, 0);
  }
  for (const change of [{ datePosted: "2024-01-01" }, { title: "Marketing Director" }, { hiringOrganization: { name: "Other" } }]) {
    const rejected = await testOpportunityUrl(source, url, { reader: reader(html({ ...posting, ...change })), enrichment: true, now });
    assert.equal(rejected.results[0].data, undefined);
  }
  assert.equal(validateSource({ key: source.key, name: source.name, company: source.company, sourceUrl: url,
    officialDomains: source.officialDomains, atsProvider: "teamtailor", aliases: [], scopes: source.metadata.scopes,
    approvalEvidence: [url] }).atsProvider, "teamtailor");
  const tiers = ["oracle", "teamtailor", "lever", "smartrecruiters", "greenhouse"].map((atsProvider) => ({ ...source, key: atsProvider, atsProvider }));
  assert.deepEqual(prioritizeSources(tiers).map((row) => row.key), ["teamtailor", "lever", "greenhouse", "oracle", "smartrecruiters"]);
  const planned = planQueries(tiers.map((row) => ({ ...row, officialDomains: [`${row.key}.test`] })), { maxQueries: 10, rotation: 1 });
  assert.deepEqual(planned.filter((row) => row.sourceKey).slice(0, 3).map((row) => row.sourceKey), ["lever", "greenhouse", "teamtailor"]);

  // A robots-denied API creates a lead, then independently reads an approved
  // company-owned mirror. No blocked page content is fetched or reused.
  const blockedUrl = "https://jobs.smartrecruiters.com/Example/12345678-marketing-internship";
  const blockedSource = { ...source, key: "blocked", atsProvider: "smartrecruiters", careerDomains: ["jobs.smartrecruiters.com", "api.smartrecruiters.com"],
    atsIdentifiers: { apiUrl: "https://api.smartrecruiters.com/v1/companies/Example/postings" }, metadata: { ...source.metadata,
      adapter: "smartrecruiters", scopes: [...source.metadata.scopes, "https://jobs.smartrecruiters.com/Example/", "https://api.smartrecruiters.com/v1/companies/Example/postings"] } };
  const leads = [], requests = [], candidates = [];
  let searches = 0;
  const run = await runOpportunityAutomation([blockedSource], { settings: { maxQueries: 4, resultsPerQuery: 5, concurrency: 1 },
    provider: { name: "test", search: async () => {
      searches++;
      return searches === 1 ? [{ title: posting.title, url: blockedUrl }] : [
        { title: posting.title, url },
        { title: posting.title, url: "https://jobs.smartrecruiters.com/Example/12345679-marketing-internship" },
        { title: "Software Internship", url: "https://careers.example.test/jobs/999-other" },
      ];
    } }, saveSearchLead: async (lead) => { leads.push(lead); return true; },
    ingest: async (value) => { candidates.push(value); return { ...value, status: "ready" }; }, now: () => now,
    readerFactory: (current) => createReader(current, { wait: async () => {}, transport: async (link) => {
      requests.push(link.href);
      if (link.pathname === "/robots.txt") return { url: link.href, status: 200, headers: {}, text: "User-agent: *\n" +
        (link.hostname === "api.smartrecruiters.com" ? "Disallow: /" : "Allow: /") };
      return { url: link.href, status: 200, headers: { "content-type": "text/html" }, text: html() };
    } }),
  });
  assert.equal(candidates.length, 1); assert.equal(candidates[0].sourceUrl, url);
  assert.equal(candidates[0].reviewStatus, "READY_FOR_REVIEW");
  assert.ok(leads.some((lead) => lead.url === blockedUrl && lead.reviewStatus === "NEEDS_VERIFICATION" && lead.pageAvailability === "BLOCKED"));
  assert.equal(requests.some((link) => link.includes("smartrecruiters.com") && !link.endsWith("robots.txt")), false);
  assert.equal(run.summary.candidatesCreated, 1);
  assert.equal(run.summary.officialSourcesResolved, 1);
  assert.ok(searches <= 4);
  assert.ok(run.summary.discoveryLeads >= 1);
  assert.equal(run.searchReport.results.find((row) => row.url.endsWith("999-other")).accepted, false, "a different posting is not a recovered mirror");
  assert.ok(counters().candidatesCreated === 0);
  console.log("Application policy PASS: Teamtailor CTA, actionable/unknown/open/closed, availability, no invented facts, priorities, robots lead and official recovery.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
