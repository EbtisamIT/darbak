const assert = require("node:assert/strict");
const { allowedUrl, publicAddress, createReader } = require("../services/opportunityDiscovery/http");
const { structuredJobs, trainingType, sections, emails } = require("../services/opportunityDiscovery/extract");
const { verifyJob, freshness, confidence } = require("../services/opportunityDiscovery/verification");
const { runPipeline } = require("../services/opportunityDiscovery/pipeline");
const { greenhouseAdapter, leverAdapter } = require("../services/opportunityDiscovery/adapters");
const { inputSchema } = require("../services/opportunityCandidateData");

const source = { key: "test", name: "Test official", company: "Test Company", sourceType: "company", sourceUrl: "https://official.example/careers/",
  metadata: { scopes: ["https://official.example/careers/"], aliases: ["Test Company"], adapter: "generic", maxPages: 4, maxRequests: 8, maxCandidates: 5 } };
const body = "<p>University students enrolled in cooperative training gain practical experience.</p><h2>Responsibilities</h2><ul><li>Build accessible interfaces.</li><li>Test existing components.</li></ul><h2>Requirements</h2><ul><li>Enrolled in a university.</li></ul><h2>Majors</h2><ul><li>Computer Science</li></ul>";
const posting = { "@type": "JobPosting", title: "COOP Software Intern", hiringOrganization: { name: "Test Company" }, description: body,
  jobLocation: { address: { addressLocality: "Riyadh", addressCountry: "SA" } }, datePosted: "2026-09-25", validThrough: "2026-10-30",
  url: "https://official.example/careers/jobs/42?jobId=42&utm_source=chatgpt" };
const html = (job = posting, extra = "") => `<html><script type="application/ld+json">${JSON.stringify(job)}</script><main><h1>${job.title}</h1>${job.description}${extra}<a href="/careers/jobs/42/apply?requisitionId=42&utm_medium=chatgpt">Apply now</a></main></html>`;
const now = new Date("2026-09-29T12:00:00Z");
const reader = { requests: 1, read: async (url) => ({ text: html(), url, status: 200 }) };

(async () => {
  assert.deepEqual(sections(body).responsibilities, ["Build accessible interfaces.", "Test existing components."]);
  assert.deepEqual(sections(body).requirements, ["Enrolled in a university."]);
  const jobs = structuredJobs(html(), posting.url, source);
  const result = await verifyJob(jobs[0], source, reader, { now });
  const candidate = inputSchema.parse(result.data);
  assert.equal(candidate.programType, "coop");
  assert.equal(candidate.verification.appearsOpen, true);
  assert.equal(candidate.applicationUrl.includes("chatgpt"), false);
  assert.equal(new URL(candidate.applicationUrl).searchParams.get("requisitionId"), "42");
  assert.deepEqual(candidate.cities, ["Riyadh"]);
  assert.equal(candidate.confidenceScore, 100);
  assert.equal(trainingType("Senior Engineer", body), null);
  assert.equal(trainingType("Internship Program Manager", body), null);
  assert.equal(trainingType("Trainee", "Permanent role with five years of experience"), null);
  assert.equal((await verifyJob({ ...jobs[0], actualPosting: false }, source, reader, { now })).skip, "NOT_A_TRAINING_POSTING");
  assert.equal((await verifyJob({ ...jobs[0], companyName: "Other Company" }, source, reader, { now })).skip, "COMPANY_MISMATCH");
  assert.equal((await verifyJob({ ...jobs[0], countries: ["US"] }, source, reader, { now })).skip, "OUTSIDE_SAUDI_ARABIA");
  const closed = await verifyJob({ ...jobs[0], closed: true }, source, reader, { now });
  assert.equal(closed.skip, "CLOSED");
  const broken = await verifyJob(jobs[0], source, { read: async () => { const e = new Error("HTTP_404"); e.code = "HTTP_404"; throw e; } }, { now });
  assert.equal(broken.skip, "OPEN_STATUS_UNCONFIRMED");
  assert.equal(freshness({ ...jobs[0], postedAt: "2024-01-01" }, now).skip, true);
  assert.equal(freshness({ ...jobs[0], title: "Internship 2024", postedAt: null }, now).skip, true);
  assert.equal(freshness({ ...jobs[0], description: "Applications for the 2024 intake are welcome.", postedAt: null }, now).skip, true);
  assert.equal(freshness({ ...jobs[0], title: "Internship 2024", postedAt: "2026-09-25" }, now).skip, false);
  const noDate = await verifyJob({ ...jobs[0], postedAt: null, deadline: null }, source, reader, { now });
  assert.equal(noDate.data.postedAt, null); assert.equal(noDate.data.verification.dateVerified, null);
  assert.deepEqual(emails("Contact coop@official.example or personal@official.example", posting.url).map((v) => v.email), ["coop@official.example"]);
  assert.equal(confidence(candidate, true), candidate.confidenceScore);
  assert.equal(allowedUrl("https://official.example.evil.test/careers/", source), false);
  assert.equal(allowedUrl("https://official.example/private", source), false);
  assert.equal(allowedUrl("http://official.example/careers/", source), false);
  for (const address of ["127.0.0.1", "10.0.0.1", "169.254.169.254", "::1", "::ffff:127.0.0.1", "fc00::1"]) assert.equal(publicAddress(address), false);
  assert.equal(publicAddress("1.1.1.1"), true);
  const calls = [];
  const safe = createReader(source, { wait: async () => {}, transport: async (url) => {
    calls.push(url.href);
    return url.pathname === "/robots.txt" ? { status: 200, headers: {}, text: "User-agent: *\nDisallow: /careers/private" } :
      { status: 302, headers: { location: "https://127.0.0.1/private" }, text: "" };
  } });
  await assert.rejects(safe.read("https://official.example/careers/private"), /ROBOTS_DISALLOWED/);
  await assert.rejects(safe.read(source.sourceUrl), /UNAPPROVED_URL_SCOPE/);
  assert.equal(calls.some((u) => u.includes("127.0.0.1")), false);
  const listing = `<script type="application/ld+json">${JSON.stringify([posting, { ...posting, title: "COOP Analyst", url: "https://official.example/careers/jobs/2" }])}</script><main><a href="/careers/jobs/42/apply">Apply now</a></main>`;
  const listingJobs = structuredJobs(listing, source.sourceUrl, source);
  assert.equal(listingJobs[1].applicationUrl, "https://official.example/careers/jobs/2", "a listing must not assign one job's apply link to another job");
  assert.equal(listingJobs[1].applyVisible, false);
  const ingested = [];
  const run = await runPipeline([source], { readerFactory: () => reader, now: () => now,
    ingest: async (data) => { ingested.push(data); return { status: "duplicate" }; } });
  assert.equal(ingested.length, 1); assert.equal(run.summary.duplicates, 1);
  const failedRun = await runPipeline([source], { readerFactory: () => ({ requests: 1, read: async () => { throw new Error("HTTP_503"); } }), ingest: async () => assert.fail("must not ingest") });
  assert.equal(failedRun.summary.errors, 1); assert.equal(failedRun.sources[0].status, "failed");
  const regular = await runPipeline([source], { now: () => now, readerFactory: () => ({ requests: 1, read: async (url) => ({ url, text: html({ ...posting, title: "Senior Engineer" }) }) }), ingest: async () => assert.fail("ordinary job must not ingest") });
  assert.equal(regular.summary.opportunitiesFound, 0);
  const apiSource = { ...source, metadata: { ...source.metadata, scopes: ["https://official.example/"], maxCandidates: 5 } };
  const gh = await greenhouseAdapter(apiSource, { read: async (url) => ({ text: JSON.stringify(url.includes("/42") ?
    { title: posting.title, content: body, company_name: "Test Company", absolute_url: posting.url, first_published: posting.datePosted } :
    { jobs: [{ id: 42, internal_job_id: 3, title: posting.title }, { id: 12, internal_job_id: null, title: "COOP talent community" }] }) }) });
  assert.equal(gh.jobs.length, 1); assert.equal(gh.jobs[0].responsibilities.length, 2);
  const leverRow = { id: "42", text: posting.title, description: body, hostedUrl: posting.url, applyUrl: posting.url, createdAt: now.getTime() };
  const lever = await leverAdapter(apiSource, { read: async (url) => ({ url, text: JSON.stringify(url.includes("/42") ? leverRow : [leverRow]) }) });
  assert.equal(lever.jobs.length, 1); assert.equal(lever.jobs[0].requirements.length, 1);
  console.log("Opportunity discovery: extraction, classification, freshness, ingestion, adapters and network guards PASS");
})().catch((e) => { console.error(e); process.exitCode = 1; });
