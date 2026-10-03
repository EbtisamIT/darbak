const assert = require("node:assert/strict");
const { testOpportunityUrl, discoverUrls, counters } = require("../services/opportunityDiscovery/stages");
const { strategies } = require("../services/opportunityDiscovery/strategies");
const { runPipeline } = require("../services/opportunityDiscovery/pipeline");
const { validateSource, sourceExport } = require("../services/opportunityDiscovery/registry");
const { searchOpportunityUrls, queriesFor } = require("../services/opportunityDiscovery/search");
const { failureCode } = require("../services/opportunityDiscovery/failures");
const { renderPage } = require("../services/opportunityDiscovery/browser");
const { SOURCES } = require("../services/opportunityDiscovery/sources");
const source = { key: "test", name: "Official", company: "Test Company", sourceType: "company", sourceUrl: "https://official.example/careers/",
  officialDomains: ["official.example"], careerDomains: ["official.example"], metadata: { adapter: "generic", aliases: [], scopes: ["https://official.example/careers/"], maxPages: 8, maxQueries: 1 } };
const now = new Date("2026-09-30T12:00:00Z"), direct = "https://official.example/careers/job/42";
const job = { "@type": "JobPosting", title: "COOP Marketing Intern", hiringOrganization: { name: source.company },
  description: "<p>University students gain practical training. Contact coop@official.example</p><h2>Responsibilities</h2><p>Prepare campaigns.</p><h2>Requirements</h2><p>Enrolled at university.</p>",
  datePosted: "2026-09-29", validThrough: "2026-11-01", url: direct,
  jobLocation: { address: { addressCountry: "SA", addressLocality: "Riyadh" } } };
const html = (posting = job) => `<script type="application/ld+json">${JSON.stringify(posting)}</script><main><a href="${direct}/apply?jobId=42&utm_source=chatgpt">Apply now</a></main>`;
const reader = (body = html()) => ({ read: async (url) => ({ url, text: body, status: 200 }), requests: 1 });
(async () => {
  const preview = await testOpportunityUrl(source, direct, { reader: reader(), now });
  assert.equal(preview.results[0].data.title, job.title);
  assert.deepEqual(preview.results[0].data.responsibilities, ["Prepare campaigns."]);
  assert.deepEqual(preview.results[0].data.requirements, ["Enrolled at university."]);
  assert.equal(preview.results[0].data.discoveredEmails[0].email, "coop@official.example");
  assert.ok(!preview.results[0].data.applicationUrl.includes("chatgpt"));
  assert.equal(preview.results[0].fetchMethod, "structured_data");
  assert.equal(preview.results[0].data.verification.appearsOpen, true);
  assert.equal((await testOpportunityUrl(source, direct, { reader: reader(html({ ...job, title: "Senior Marketing Manager" })), now })).results[0].code, "NOT_TRAINING");
  assert.equal((await testOpportunityUrl(source, direct, { reader: reader(html({ ...job, datePosted: "2024-01-01" })), now })).results[0].data.verification.dateVerified, false);
  assert.equal((await testOpportunityUrl(source, direct, { reader: reader(html({ ...job, validThrough: "2026-09-01" })), now })).results[0].code, "CLOSED");
  assert.equal((await testOpportunityUrl(source, "https://evil.example/jobs/42", { reader: { read: () => assert.fail("unofficial network call") } })).code, "POLICY_DENIED");
  for (const error of ["ROBOTS_DISALLOWED", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "REQUEST_TIMEOUT"]) {
    const failed = await testOpportunityUrl(source, direct, { reader: { read: async () => { throw Object.assign(new Error(error), { code: error }); } },
      browserRenderer: () => assert.fail("browser cannot retry access failures") });
    assert.equal(failed.code, failureCode(error));
  }
  const dynamic = '<div id="root"></div><script src="/app.js"></script>';
  const rendered = await testOpportunityUrl(source, direct, { reader: reader(dynamic), now, browserRenderer: async () => ({ url: direct, text: html(), fetchMethod: "browser" }) });
  assert.equal(rendered.results[0].fetchMethod, "browser");
  const noBrowser = await testOpportunityUrl(source, direct, { reader: reader(dynamic), now });
  assert.equal(noBrowser.code, "DYNAMIC_PAGE");
  const filled = await testOpportunityUrl(source, direct, { reader: reader('<div class="jobDisplayShell"><h1 id="job-title">Marketing Internship</h1><div class="job">Sorry, this position has been filled.</div></div>'), now });
  assert.equal(filled.code, "CLOSED"); assert.equal(filled.counters.closedOpportunities, 1);
  let launched = false;
  await assert.rejects(renderPage(direct, source, { read: async () => { throw new Error("ROBOTS_DISALLOWED"); } }, { chromium: { launch: () => { launched = true; } } }));
  assert.equal(launched, false);
  assert.equal((await searchOpportunityUrls("coop")).skipped, "SEARCH_PROVIDER_NOT_CONFIGURED");
  assert.ok(queriesFor(source).includes('"تدريب تعاوني" السعودية'));
  const counts = counters(), details = [];
  const discovery = await discoverUrls(source, { read: async () => { throw new Error("REQUEST_TIMEOUT"); } }, { counts, details,
    searchProvider: { search: async () => [{ url: `${direct}?utm_source=chatgpt` }, { url: direct }, { url: "https://evil.example/job/1" }] } });
  assert.equal(discovery.urls.length, 1); assert.equal(counts.urlsDiscovered, 2); assert.equal(counts.urlsRejected, 1);
  assert.equal(counts.searchQueriesRun, 1);
  assert.equal(discovery.urls[0].url, direct);
  const saved = [];
  const run = await runPipeline([source], { now: () => now, ingest: async () => ({ status: "duplicate" }), readerFactory: () => reader(), saveLead: async (lead) => { saved.push(lead); return true; } });
  assert.equal(run.summary.duplicates, 1); assert.equal(saved.length, 0, "opportunity emails stay with candidate");
  const leadRun = await runPipeline([source], { ingest: () => assert.fail("email is not a job"), readerFactory: () => reader("<main>Contact training@official.example</main>"), saveLead: async (lead) => { saved.push(lead); return true; } });
  assert.equal(leadRun.summary.emailLeads, 1); assert.equal(saved[0].city, undefined);
  const closed = await runPipeline([source], { now: () => now, readerFactory: () => reader(html({ ...job, validThrough: "2026-09-01" })), ingest: (data) => {
    assert.equal(data.applicationState, "CLOSED");
    return { status: "needs_verification" };
  } });
  assert.equal(closed.summary.closedOpportunities, 1);
  for (const unavailable of [false, true]) {
    const preserved = [];
    await runPipeline([source], {
      searchResults: [{ accepted: true, sourceKey: source.key, url: direct, title: "Marketing Internship",
        discoveredByQueries: ["internship Saudi Arabia"], provider: "test" }],
      readerFactory: () => unavailable ? { read: async () => { throw new Error("ROBOTS_DISALLOWED"); } } : reader("<main>Content unavailable</main>"),
      ingest: async (value) => {
        const parsed = require("../services/opportunityCandidateData").inputSchema.parse(value);
        preserved.push(parsed);
        return { status: "needs_verification" };
      },
    });
    assert.equal(preserved.length, 1, "uncertain Saudi training link is preserved for review");
    assert.equal(preserved[0].sourceUrl, direct);
    assert.equal(preserved[0].applicationUrl, "");
    assert.equal(preserved[0].description, "");
    assert.deepEqual(preserved[0].responsibilities, []);
    assert.deepEqual(preserved[0].requirements, []);
    assert.deepEqual(preserved[0].cities, []);
    assert.deepEqual(preserved[0].majors, []);
    assert.equal(preserved[0].deadline, null);
    assert.notEqual(preserved[0].verification.officialSource, true);
  }
  for (const s of SOURCES) assert.equal(validateSource(sourceExport(s)).active, false);
  const imported = validateSource({ ...sourceExport(SOURCES[0]), key: "new-source" });
  assert.equal(imported.reviewStatus, "pending");
  assert.throws(() => validateSource({ ...sourceExport(SOURCES[0]), scopes: ["https://jobs.smartrecruiters.com/"], careerDomains: ["jobs.smartrecruiters.com"] }), /TENANT/);
  const api = { ...source, atsProvider: "smartrecruiters", atsIdentifiers: { apiUrl: "https://official.example/careers/postings" } };
  const apiReader = { read: async (url) => ({ url, text: JSON.stringify(url.endsWith("/postings") ?
    { content: [{ id: 12345678, name: "Marketing Internship", ref: "https://official.example/careers/postings/12345678" }] } :
    { name: "Marketing Internship", company: { name: source.company }, location: { city: "Riyadh", country: "SA" }, releasedDate: "2026-09-29",
      applyUrl: direct, postingUrl: direct, jobAd: { sections: { jobDescription: { text: job.description }, qualifications: { text: "<p>University student.</p>" } } } }) }) };
  const urls = await strategies.smartrecruiters.discoverJobs(api, apiReader);
  const extracted = await strategies.smartrecruiters.extractJob(urls.urls[0], api, apiReader);
  assert.equal(extracted.fetchMethod, "ats_api"); assert.deepEqual(extracted.jobs[0].requirements, ["University student."]);
  assert.deepEqual(extracted.jobs[0].responsibilities, ["Prepare campaigns."]);
  assert.equal(extracted.jobs[0].title, "Marketing Internship");
  console.log("Hybrid Discovery PASS: known URL, separate stages, search domains, API extraction, browser denial, email isolation, imports, counters");
})().catch((e) => { console.error(e); process.exitCode = 1; });
