const assert = require("node:assert/strict");
const { test } = require("node:test");
const { dynamicSource } = require("../services/autoApplySupplyDynamicSearch");
const { resolveEmployer, geographyClass, followupLinks } = require("../services/autoApplySupplyResolution");
const { resolveApplicationChannels, storedCanaryObservation } = require("../services/autoApplySupplyChannelFollowup");
const { classifyByPolicy } = require("../services/autoApplySupplyClassificationPolicy");
const { reviseCanarySupply } = require("../services/autoApplySupply");
const { extractPage } = require("../services/autoApplySupplyExtraction");
const { priorCanaryIds, canaryReadiness, repairCanaryIdentities } = require("../services/autoApplySupplyCanary");

const article = "https://www.wadhaef-sa.com/100.html";
const title = "تدريب تعاوني في شركة المثال – ينبع | وظائف السعودية";
const ats = "https://jobs.lever.co/example/fixture-id";
const training = "Cooperative training for university students in Saudi Arabia.";
const ai = { isTrainingRelevant: true, evidenceQuotes: [], evidenceStrength: "explicit", channelAssessment: "explicit_application" };

test("Arabic secondary authorship is not employer identity; unsupported names stay unknown", () => {
  const source = dynamicSource(article, { company: "وظائف السعودية" });
  assert.deepEqual(resolveEmployer({ source, title, url: article }), {
    employerName: "المثال", publisherName: "وظائف السعودية", sourceDomain: "www.wadhaef-sa.com", sourceRole: "SECONDARY_DISCOVERY",
  });
  assert.equal(resolveEmployer({ source, title: "تدريب تعاوني | وظائف السعودية", url: article }).employerName, null);
  assert.equal(resolveEmployer({ source, title: "برنامج التدريب التعاوني بمجموعة شركات جهة التعليم القابضة – الرياض",
    url: article }).employerName, "جهة التعليم القابضة");
  assert.equal(resolveEmployer({ source, title, url: article, structuredEmployer: "Structured Employer" }).employerName, "Structured Employer");
  assert.equal(resolveEmployer({ url: ats, title: "Cooperative Training", body: "Students train for at least 8 weeks." }).employerName, null);
  assert.equal(resolveEmployer({ url: ats, title: "Graduate Program", body: "Graduate development and training at the same time." }).employerName, null);
  assert.equal(resolveEmployer({ url: ats, title: "Cooperative Training at Example Employer", body: "Train for at least 8 weeks." }).employerName, "Example Employer");
});

test("post-run identity repair restores only the corrupted identities with matching immutable history", async () => {
  const id = "1".repeat(24), unrelated = "2".repeat(24);
  const row = { _id: id, sourceRole: "OFFICIAL_EMPLOYER", companyName: "least 8\u00a0weeks", sourceUrl: ats,
    verificationStatus: "LIKELY", history: [{ companyName: "Example Employer", sourceUrl: ats }] };
  const run = { metrics: { reprocess: [{ id, originalCompany: "Example Employer", action: "updated" },
    { id: unrelated, originalCompany: "Publisher", action: "updated" }] } };
  const found = [];
  const result = await repairCanaryIdentities(run, {
    model: { findById: (key) => ({ select: () => ({ lean: async () => key === id ? row :
      { companyName: "Actual Employer", sourceRole: "SECONDARY_DISCOVERY", publisherName: "Publisher" } }) }) },
    restore: async (before, name) => { found.push(before._id); return { ...before, companyName: name }; },
  });
  assert.deepEqual(result, [{ restoredCompany: "Example Employer", status: "LIKELY" }]);
  assert.deepEqual(found, [id]);
});

test("deterministic geography rejects Sweden and preserves unknown and explicit Saudi remote eligibility", () => {
  for (const [data, expected] of [
    [{ title: "Power+ Graduate Development Program in Sweden", evidence: "We have offices in Saudi Arabia." }, "NON_SAUDI"],
    [{ title: "تدريب تعاوني – الرياض" }, "SAUDI"],
    [{ title: "Student Internship", evidence: "Our headquarters are in Saudi Arabia." }, "UNKNOWN"],
    [{ title: "Remote internship", evidence: "Remote internship open to candidates based in Saudi Arabia." }, "REMOTE_SAUDI_ELIGIBLE"],
    [{ title: "Remote internship", evidence: "Flexible hours." }, "UNKNOWN"],
  ]) assert.equal(geographyClass(data), expected);
  const result = classifyByPolicy({ companyName: "Employer", geographyStatus: "NON_SAUDI", channelType: "COMPANY_PORTAL",
    applicationUrl: ats, sourceUrl: ats, sourceType: "public_ats_job_page" }, ai);
  assert.equal(result.status, "REJECTED");
});

test("direct channels are retained without promoting secondary publisher evidence", () => {
  const html = '<main><h1>' + title + '</h1><p>برنامج تدريب تعاوني لطلاب الجامعات في السعودية.</p><a href="' + ats + '">التقديم الآن</a></main>';
  const rows = extractPage({ url: article, text: html }, dynamicSource(article, { company: "وظائف السعودية" }), { quality: true });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].channelType, "COMPANY_PORTAL");
  assert.equal(rows[0].companyName, "المثال");
  assert.equal(rows[0].geographyStatus, "SAUDI");
  assert.notEqual(classifyByPolicy(rows[0], ai).status, "VERIFIED");
});

test("one-hop ATS posting provides independently attributable application evidence, without reading the next hop", async () => {
  const readUrls = [];
  const metadata = { "@type": "JobPosting", title: "Cooperative Training", url: ats, description: training, hiringOrganization: { name: "Example Employer" } };
  const result = await resolveApplicationChannels({
    html: '<a href="' + ats + '">Cooperative Training</a>', anchorUrl: article, publisherName: "وظائف السعودية",
    anchorTitle: "Cooperative Training", candidates: [], sources: [],
    read: async (_source, url) => {
      readUrls.push(url);
      return { url, text: '<title>Cooperative Training</title><script type="application/ld+json">' + JSON.stringify(metadata) +
        '</script><main><h1>Cooperative Training</h1><p>' + training + '</p><a href="' + ats + '/apply">Apply now</a></main>' };
    },
  });
  assert.deepEqual(readUrls, [ats]);
  const row = result.find((value) => value.applicationUrl === ats + "/apply");
  assert.equal(row.companyName, "Example Employer");
  assert.equal(row.sourceRole, "OFFICIAL_ATS");
  assert.equal(row.discoverySourceUrl, article);
  assert.equal(row.officialApplicationSourceUrl, ats);
  assert.equal(classifyByPolicy(row, ai).status, "VERIFIED");
  assert.notEqual(classifyByPolicy({ ...row, applicationUrl: "https://jobs.lever.co/careers" }, ai).status, "VERIFIED");
});

test("follow-up scope rejects unsafe links and limits discovery to three distinct targets", () => {
  const destinations = ["https://localhost/jobs", "https://127.0.0.1/jobs", "file:///tmp/sample", "https://example.net/jobs",
    ...Array.from({ length: 5 }, (_, index) => "https://jobs.lever.co/example/" + index)];
  const html = destinations.map((url) => '<a href="' + url + '">Apply now</a>').join("");
  assert.deepEqual(followupLinks({ html, pageUrl: article }).map((row) => row.url), destinations.slice(4, 7));
});

test("exact canary correction preserves ID and history and handles duplicate identity without merging", async () => {
  const previous = { _id: "fixture", __v: 5, companyName: "وظائف السعودية", opportunityTitle: title,
    channelType: "COMPANY_PORTAL", applicationUrl: ats, sourceUrl: article, sourceType: "dynamic_search_page",
    evidenceText: "برنامج تدريب تعاوني", verificationStatus: "LIKELY", isActive: true, contentHash: "original" };
  const input = storedCanaryObservation(previous, []);
  assert.equal(input.companyName, "المثال");
  assert.equal(input.publisherName, "وظائف السعودية");
  let written = 0;
  const model = { findOneAndUpdate(query, update, options) {
    assert.deepEqual(query, { _id: "fixture", __v: 5, contentHash: "original", verificationStatus: "LIKELY" });
    assert.equal(update.$set.companyName, "المثال");
    assert.equal(update.$push.history.companyName, "وظائف السعودية");
    assert.equal(options.overwriteImmutable, true);
    written += 1;
    return { lean: async () => ({ _id: "fixture" }) };
  } };
  assert.equal((await reviseCanarySupply(previous, input, { model })).action, "updated");
  assert.equal((await reviseCanarySupply({ ...previous, verificationStatus: "VERIFIED" }, input, { model })).action, "skipped");
  assert.equal(written, 1);
  const ids = ["1", "2", "3", "4"].map((n) => n.repeat(24));
  const prior = { canarySlot: 3, finishedAt: new Date(), metrics: { candidateIds: ids.slice(0, 3), retryCandidateIds: ids.slice(3) } };
  assert.deepEqual(priorCanaryIds(prior), ids);
  assert.equal(canaryReadiness({}, [prior]).nextSlot, 4);
  assert.equal(canaryReadiness({}, [prior, { canarySlot: 4 }]).nextSlot, null);
});
