const assert = require("node:assert/strict");
const brave = require("../services/opportunityDiscovery/searchProviders/braveSearchProvider");
const { runSearchDiscovery, classifyUrl } = require("../services/opportunityDiscovery/searchDiscovery");
const { planQueries, searchSettings } = require("../services/opportunityDiscovery/queryPack");
const { runFromSearch } = require("../services/opportunityDiscovery/searchWorkflow");
const { inputSchema } = require("../services/opportunityCandidateData");

const source = { key: "official", company: "Official Company", name: "Official", active: true, reviewStatus: "approved",
  sourceType: "company", atsProvider: "generic", sourceUrl: "https://official.example/careers/", officialDomains: ["official.example"],
  careerDomains: [], metadata: { adapter: "generic", scopes: ["https://official.example/careers/"], aliases: [], maxPages: 8 } };
const direct = "https://official.example/careers/job/42?jobId=42";
const now = new Date("2026-09-30T12:00:00Z");
const posting = { "@type": "JobPosting", title: "Marketing Internship", description: "<p>University students.</p><h2>Responsibilities</h2><ul><li>Prepare campaigns.</li></ul><h2>Requirements</h2><ul><li>Enrolled in university.</li></ul>",
  datePosted: "2026-09-29", hiringOrganization: { name: source.company }, url: direct,
  jobLocation: { address: { addressCountry: "SA", addressLocality: "Riyadh" } } };
const html = (job) => `<script type="application/ld+json">${JSON.stringify(job)}</script><main><a href="${direct}">Apply now</a></main>`;
(async () => {
  await assert.rejects(brave.search("internship", { apiKey: "", fetchImpl: () => assert.fail("no key must not request") }), /SEARCH_PROVIDER_NOT_CONFIGURED/);
  let request;
  const rows = await brave.search("internship Saudi Arabia", { apiKey: "test-only", fetchImpl: async (url, options) => {
    request = { url, options }; return { ok: true, json: async () => ({ type: "search", web: { results: [
      { title: "<b>Marketing Internship</b>", description: "Students", url: `${direct}&utm_source=chatgpt#apply`, page_age: "2026-09-29" },
      { title: "Invalid", url: "javascript:alert(1)" },
    ] } }) };
  } });
  assert.equal(rows.length, 1); assert.equal(rows[0].url, direct); assert.equal(rows[0].title, "Marketing Internship");
  assert.equal(rows[0].provider, "brave"); assert.equal(rows[0].publishedAt, "2026-09-29T00:00:00.000Z");
  assert.equal(request.url.hostname, "api.search.brave.com"); assert.equal(request.url.searchParams.get("freshness"), "pm");
  assert.equal(request.url.searchParams.get("country"), "SA");
  assert.equal(request.url.searchParams.get("search_lang"), "en");
  assert.equal(request.options.headers["X-Subscription-Token"], "test-only"); assert.equal(request.options.redirect, "error");
  for (const [query, language] of [['"تدريب تعاوني" السعودية', "ar"], ["STC تدريب تعاوني", "ar"], ["site:stc.com.sa internship", "en"]]) {
    await brave.search(query, { apiKey: "test-only", freshness: "pw", fetchImpl: async (url) => {
      assert.equal(url.searchParams.get("country"), "SA");
      assert.equal(url.searchParams.get("search_lang"), language);
      assert.equal(url.searchParams.get("freshness"), "pw");
      return { ok: true, json: async () => ({ type: "search", web: { results: [] } }) };
    } });
  }
  assert.equal(brave.normalizeResult({ url: direct, age: "2 days ago" }, "q").publishedAt, null);
  for (const [status, code] of [[401, "SEARCH_AUTH_FAILED"], [429, "SEARCH_RATE_LIMITED"], [500, "SEARCH_HTTP_500"]])
    await assert.rejects(brave.search("q", { apiKey: "test-only", fetchImpl: async () => ({ ok: false, status }) }), new RegExp(code));
  const missing = await runSearchDiscovery([source], {});
  assert.equal(missing.error, "SEARCH_PROVIDER_NOT_CONFIGURED"); assert.equal(missing.summary.searchQueriesRun, 0);
  const settings = searchSettings({}); assert.deepEqual(settings, { maxQueries: 20, resultsPerQuery: 10, concurrency: 3 });
  assert.equal(searchSettings({ DISCOVERY_MAX_SEARCH_QUERIES_PER_RUN: "99999" }).maxQueries, 20);
  const many = Array.from({ length: 100 }, (_, i) => ({ ...source, key: `s${i}`, officialDomains: [`s${i}.example`] }));
  assert.equal(planQueries(many).length, 20); assert.notDeepEqual(planQueries(many, { rotation: 0 }), planQueries(many, { rotation: 1 }));
  assert.equal(new Set(planQueries(many).map((p) => p.query)).size, 20);
  assert.ok(planQueries(many).every((p) => p.freshness === "pm"));
  assert.equal(classifyUrl(direct, [source]).classification, "official_company");
  assert.equal(classifyUrl("https://official.example.evil.test/careers/job/42", [source]).classification, "unknown");
  assert.equal(classifyUrl("https://official.example/private", [source]).reason, "SOURCE_SCOPE_NOT_APPROVED");
  assert.equal(classifyUrl("https://jobs.lever.co/unapproved/job", [source]).reason, "ATS_TENANT_NOT_APPROVED");
  const ats = { ...source, key: "tenant", atsProvider: "lever", careerDomains: ["jobs.lever.co"], metadata: { ...source.metadata, scopes: ["https://jobs.lever.co/approved/"] } };
  assert.equal(classifyUrl("https://jobs.lever.co/approved/job", [ats]).classification, "official_ats");
  assert.equal(classifyUrl("https://jobs.lever.co/other/job", [ats]).classification, "unknown");
  assert.equal(classifyUrl("https://university.edu.sa/internship", [source]).classification, "university");
  assert.equal(classifyUrl("https://www.linkedin.com/jobs/42", [source]).classification, "social");
  assert.equal(classifyUrl("https://www.bayt.com/job/42", [source]).classification, "trusted_job_board");
  assert.equal(classifyUrl(direct, [source, { ...source, key: "ambiguous" }]).reason, "AMBIGUOUS_COMPANY_SCOPE");
  const leads = []; let calls = 0, running = 0, peak = 0;
  const report = await runSearchDiscovery([source], { now, settings: { maxQueries: 4, resultsPerQuery: 10, concurrency: 2 },
    saveLead: async (lead) => { leads.push(lead); return true; }, provider: { name: "brave", search: async () => {
      calls++; running++; peak = Math.max(peak, running); await new Promise((r) => setTimeout(r, 5)); running--;
      return [...rows, { ...rows[0], url: `${direct}&source=chatgpt` },
        { title: "Internship Saudi Arabia", url: "https://unknown.example/job/1" },
        { title: "Senior Manager", description: "Full time", url: "https://official.example/careers/job/2" }];
    } } });
  assert.equal(calls, 4); assert.equal(peak, 2); assert.equal(report.summary.searchResultsReceived, 16);
  assert.equal(report.summary.uniqueUrlsDiscovered, 3); assert.equal(report.summary.officialUrlsAccepted, 1);
  assert.equal(report.summary.officialUrlsClassified, 2);
  assert.equal(report.summary.pagesFetched, 0); assert.equal(report.summary.candidatesCreated, 0);
  assert.equal(report.results[0].discoveredByQueries.length, 4); assert.equal(leads.length, 1);
  assert.equal(report.results.find((r) => r.url.endsWith("/2")).reason, "NOT_TRAINING_SEARCH_RESULT");
  const reads = [], saved = [];
  const options = { now: () => now, readerFactory: () => ({ read: async (url) => { reads.push(url); return { url, text: html(posting) }; } }),
    ingest: async (data) => { saved.push(inputSchema.parse(data)); return { status: "needs_review" }; } };
  const full = await runFromSearch([source], report, options);
  assert.equal(full.summary.candidatesCreated, 1); assert.equal(full.summary.needsReview, 1); assert.equal(saved.length, 1);
  assert.equal(reads.length, 1, "URL dedup applies to extraction and verification");
  assert.equal(saved[0].searchDiscovery.discoveredByQueries.length, 4); assert.equal(saved[0].searchDiscovery.provider, "brave");
  assert.deepEqual(saved[0].responsibilities, ["Prepare campaigns."]);
  assert.equal(saved[0].postedAt.toISOString(), "2026-09-29T00:00:00.000Z");
  const closed = await runFromSearch([source], report, { ...options,
    readerFactory: () => ({ read: async (url) => ({ url, text: html({ ...posting, validThrough: "2026-09-01" }) }) }),
    ingest: (data) => { assert.equal(data.applicationState, "CLOSED"); return { status: "needs_verification" }; } });
  assert.equal(closed.summary.closedOpportunities, 1);
  const revoked = await runFromSearch([{ ...source, active: false }], report, { ...options, readerFactory: () => assert.fail("revoked source fetch") });
  assert.equal(revoked.summary.candidatesCreated, 0);
  for (const change of [{ jobLocation: undefined }, { title: "Senior Engineer" }]) {
    const rejected = await runFromSearch([source], report, { ...options,
      readerFactory: () => ({ read: async (url) => ({ url, text: html({ ...posting, ...change }) }) }), ingest: () => assert.fail("unqualified must not create") });
    assert.equal(rejected.summary.candidatesCreated, 0);
  }
  let limitedCalls = 0;
  const limited = await runSearchDiscovery([source], { settings, provider: { search: async () => { limitedCalls++; throw new Error("SEARCH_RATE_LIMITED"); } } });
  assert.ok(limitedCalls <= settings.concurrency); assert.equal(limited.status, "failed");
  console.log("Brave Discovery PASS: provider, missing key, budget, rotation, classification, dedup, search-only, full extraction and safeguards");
})().catch((e) => { console.error(e); process.exitCode = 1; });
