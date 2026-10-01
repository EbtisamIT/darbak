const assert = require("node:assert/strict");
const { enrichExtractedJob, enrichOpportunityUrl, normalizeMajors, normalizeCities, explicitDate, labeledFacts, officialLogo, assessEnrichment } = require("../services/opportunityEnrichment");
const { sections, structuredJobs } = require("../services/opportunityDiscovery/extract");
const { inputSchema } = require("../services/opportunityCandidateData");
const { runPipeline } = require("../services/opportunityDiscovery/pipeline");
const { recoverOfficialSources, runOpportunityAutomation } = require("../services/opportunityDiscovery/automation");
const { counters } = require("../services/opportunityDiscovery/stages");
const now = new Date("2026-10-01T12:00:00Z");
const source = { key: "test", company: "Example Telecom", name: "Test source", sourceType: "company", active: true, reviewStatus: "approved",
  officialDomains: ["official.example"], careerDomains: ["official.example"], atsProvider: "generic", searchQueries: [],
  metadata: { adapter: "generic", aliases: ["Example Telecom"], scopes: ["https://official.example/"], maxPages: 5, selectors: { detail: "article.job" } } };
const url = "https://official.example/jobs/coop";
const html = `<article class="job"><h1>COOP Software Intern</h1><p>University students in Saudi Arabia can gain practical training with this placement.</p>
<p>Location: Riyadh, Saudi Arabia; Jeddah</p><h2>Key Responsibilities</h2><ul><li>Test software changes.</li><li>Document test results.</li></ul>
<h2>Who you are</h2><ul><li>Bachelor degree in Computer Science or Information Systems.</li><li>Currently enrolled at university.</li></ul>
<h2>Dates</h2><p>Date posted: 2026-09-25</p><p>Applications close 20 October 2026</p><p>Training starts: 2027-01-01</p><p>Duration: 6 months</p>
<p>Contact training@official.example</p><a href="/jobs/coop/apply?jobId=1&utm_source=chatgpt">Apply now</a></article>`;
const reader = { requests: 0, read: async (value) => ({ url: value, text: value.includes("/apply") ? "Apply now" : html }) };
async function main() {
  assert.deepEqual(normalizeCities(["Riyadh, Saudi Arabia", "Jeddah", "الرياض"]), ["الرياض", "جدة"]);
  assert.deepEqual(normalizeMajors(["CS", "Computer Science", "علوم الحاسب"]), { majors: ["علوم الحاسب"], majorScope: "specific" });
  assert.deepEqual(normalizeMajors(["all majors"]), { majors: [], majorScope: "all" });
  assert.deepEqual(normalizeMajors(["جميع التخصصات"]), { majors: [], majorScope: "all" });
  assert.deepEqual(normalizeMajors(["business-related majors"]), { majors: [], majorScope: "broad" });
  assert.deepEqual(normalizeMajors(["A bachelor degree is preferred but it is not required."]), { majors: [], majorScope: "unknown" });
  assert.equal(explicitDate("20 October 2026"), "2026-10-20T00:00:00.000Z");
  assert.equal(explicitDate("20 أكتوبر 2026"), "2026-10-20T00:00:00.000Z");
  assert.equal(explicitDate("31 February 2026"), null);
  assert.equal(explicitDate("10/11/26"), null, "ambiguous dates are not guessed");
  assert.equal(labeledFacts("Date posted: 2026-10-01").result.deadline, undefined);
  assert.equal(officialLogo("https://board.example/logo.png", source), "");
  assert.equal(officialLogo("https://official.example/logo.png?utm_source=chatgpt", source), "https://official.example/logo.png");
  assert.deepEqual(sections("<h2>Role responsibilities</h2><p>Do a real task.</p><h2>Candidate requirements</h2><p>Be a student.</p><h2>Benefits</h2><p>Free lunch</p>"),
    { responsibilities: ["Do a real task."], requirements: ["Be a student."], majors: [] });
  assert.deepEqual(sections("<h2>مهام المتدرب</h2><li>توثيق النتائج</li><h2>الفئة المستهدفة</h2><li>طلاب الجامعات</li>").requirements, ["طلاب الجامعات"]);
  const result = await enrichOpportunityUrl({ url, source, searchMetadata: { description: "FAKE DEADLINE 2028-01-01", title: "FAKE TITLE" } }, { reader, now, logo: "https://darbak.example/existing.png" });
  const data = result.results[0].data;
  assert.ok(data, JSON.stringify(result));
  assert.deepEqual(data.responsibilities, ["Test software changes.", "Document test results."]);
  assert.deepEqual(data.requirements, ["Bachelor degree in Computer Science or Information Systems.", "Currently enrolled at university."]);
  assert.deepEqual(data.cities, ["الرياض", "جدة"]);
  assert.deepEqual(new Set(data.majors), new Set(["علوم الحاسب", "نظم المعلومات"]));
  assert.equal(data.deadline, "2026-10-20T00:00:00.000Z");
  assert.equal(data.trainingStartDate, "2027-01-01T00:00:00.000Z");
  assert.equal(data.duration, "6 months");
  assert.equal(data.companyLogo, "https://darbak.example/existing.png");
  assert.equal(data.completenessScore, 100);
  assert.equal(data.reviewStatus, "READY_FOR_REVIEW");
  assert.equal(data.applicationUrl, "https://official.example/jobs/coop/apply?jobId=1");
  assert.equal(data.extractionEvidence.responsibilities.heading, "Key Responsibilities");
  assert.equal(data.extractionEvidence.deadline.rawText, "Applications close 20 October 2026");
  assert.equal(data.extractionEvidence.companyLogo.method, "darbak_company");
  assert.equal(data.discoveredEmails[0].email, "training@official.example");
  assert.ok(!JSON.stringify(data).includes("FAKE"));
  assert.ok(data.description.length <= 450);
  assert.ok(data.rawContent.includes("Duration: 6 months"));
  inputSchema.parse(data);
  const thinJob = { title: "Summer Internship", description: "University students in Saudi Arabia.", sourceUrl: url, actualPosting: true, applyVisible: true,
    applicationUrl: `${url}/apply`, companyLogo: "https://jobs.example/logo.png" };
  const thin = enrichExtractedJob(thinJob, source, { now });
  assert.deepEqual(thin.responsibilities, []);
  assert.deepEqual(thin.requirements, []);
  assert.equal(thin.deadline, undefined);
  assert.equal(thin.companyLogo, "");
  assert.equal(assessEnrichment({ ...thin, verification: { officialSource: true, companyVerified: true, appearsOpen: true, urlWorks: true } }).reviewStatus, "NEEDS_DETAILS");
  assert.equal(assessEnrichment({ ...data, applicationState: "UNKNOWN", verification: { ...data.verification, appearsOpen: null } }).reviewStatus, "NEEDS_VERIFICATION");
  assert.equal(assessEnrichment({ ...data, verification: { ...data.verification, appearsOpen: false } }).reviewStatus, "CLOSED");
  const unconfirmed = await enrichOpportunityUrl({ url, source }, { now, reader: { read: async (value) => {
    if (value.includes("apply")) throw new Error("REQUEST_TIMEOUT"); return { url: value, text: html };
  } } });
  assert.equal(unconfirmed.results[0].data.reviewStatus, "NEEDS_VERIFICATION");
  const closed = await enrichOpportunityUrl({ url, source }, { now, reader: { read: async (value) => ({ url: value, text: value.includes("apply") ? "Applications closed" : html }) } });
  assert.equal(closed.results[0].data.reviewStatus, "CLOSED");
  const generic = await enrichOpportunityUrl({ url, source: { ...source, metadata: { ...source.metadata, selectors: {} } } }, { now, reader: { read: async (value) => ({ url: value, text: "<h1>Careers</h1><p>Student opportunities</p>" }) } });
  assert.equal(generic.results.length, 0, "general program info must not become a candidate");
  const structured = structuredJobs(`<script type="application/ld+json">${JSON.stringify({ "@type": "JobPosting", title: "Internship", description: "<h2>Requirements</h2><li>University student</li>", datePosted: "2026-09-25", validThrough: "2026-11-01" })}</script>`, url, source)[0];
  assert.equal(structured.extractionEvidence.deadline.method, "structured_data");
  assert.equal(structured.extractionEvidence.deadline.rawText, "2026-11-01");
  const candidates = [];
  const pipeline = await runPipeline([source], { enrichment: true, now: () => now, readerFactory: () => reader,
    searchResults: [{ url, accepted: true, sourceKey: source.key }], ingest: async (item) => { candidates.push(item); return { ...item, status: "needs_review" }; } });
  assert.equal(candidates.length, 1);
  assert.equal(pipeline.summary.opportunitiesEnriched, 1);
  assert.equal(pipeline.summary.averageCompleteness, 95);
  assert.equal(pipeline.summary.readyForReview, 1);
  let calls = 0;
  const report = { results: [{ title: "Example Telecom COOP Intern", description: "Saudi Arabia", url: "https://bayt.com/jobs/1", classification: "trusted_job_board", trainingHint: true }], queries: [], summary: counters() };
  await recoverOfficialSources(report, [source], { budget: 1, provider: { name: "test", search: async () => { calls++; return [{ url, title: "COOP Intern", description: "SNIPPET MUST NOT BECOME FACTS" }]; } } });
  assert.equal(calls, 1); assert.equal(report.summary.officialSourcesResolved, 1);
  assert.equal(report.results[1].accepted, true);
  const automation = await runOpportunityAutomation([source], { provider: { name: "test", search: async () => [{ url, title: "COOP Intern" }] },
    settings: { maxQueries: 2, concurrency: 1, resultsPerQuery: 5 }, now: () => now, readerFactory: () => reader,
    saveSearchLead: async () => false, ingest: async (item) => ({ ...item, status: "needs_review" }) });
  assert.equal(automation.summary.opportunitiesEnriched, 1);
  if (process.env.ENRICHMENT_TEST_REPORT) require("node:fs").writeFileSync(process.env.ENRICHMENT_TEST_REPORT,
    JSON.stringify({ fixtureOnly: true, productionWrites: 0, examples: [data, unconfirmed.results[0].data, closed.results[0].data] }, null, 2));
  console.log("Enrichment PASS: real-field sections, dictionaries, dates, evidence, no snippet facts, completeness, review states, closed/unknown, recovery budget, automation pipeline.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
