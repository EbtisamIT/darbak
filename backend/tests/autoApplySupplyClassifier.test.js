const assert = require("node:assert/strict");
const { test } = require("node:test");
const { classifyByPolicy } = require("../services/autoApplySupplyClassificationPolicy");
const { classificationHash, classifySupplyBatch, CLASSIFIER_VERSION, classifierSettings, errorDiagnostics } = require("../services/autoApplySupplyClassifier");
const { ingestSupply } = require("../services/autoApplySupply");
const { coopEmail, genericHr, arabicPortal } = require("./fixtures/autoApplySupplyClassification");

const now = new Date("2026-11-25T09:00:00Z");
const env = { AUTO_APPLY_SUPPLY_AI_ENABLED: "true", OPENAI_SUPPLY_CLASSIFIER_MODEL: "fixture-model" };
const quote = (field, value, text, sourceField = "evidenceText") => ({ field, value, quote: text, sourceField });
const ai = (override = {}) => ({
  isTrainingRelevant: true, companyName: null, opportunityTitle: null, trainingType: "coop", majors: [], fields: [],
  cities: [], remote: null, educationLevels: [], requiredDocuments: [], deadline: null, startDate: null,
  channelAssessment: "explicit_application", emailAcceptsTrainingApplications: true, evidenceStrength: "explicit",
  recommendedVerificationStatus: "VERIFIED", verificationReason: "fixture", confidence: 0.95, evidenceQuotes: [], ...override,
});

test("official evidence to send COOP applications to the exact email can be verified", () => {
  const outcome = classifyByPolicy(coopEmail, ai(), now);
  assert.equal(outcome.status, "VERIFIED");
  assert.equal(outcome.rule, "EXPLICIT_TRAINING_EMAIL");
  assert.equal(outcome.emailExplicitlySupported, true);
  assert.match(outcome.evidenceReferences[0].quote, /coop@example.org/);
  assert.equal(classifyByPolicy({ ...coopEmail, destinationEmail: "other@example.org" }, ai(), now).status, "LIKELY");
  assert.equal(classifyByPolicy({ ...coopEmail, sourceType: "search_engine_discovery" }, ai(), now).status, "LIKELY");
});

test("AI cannot promote generic HR or a coincidentally named inbox", () => {
  assert.equal(classifyByPolicy(genericHr, ai(), now).status, "LIKELY");
  const noExplicit = { ...coopEmail, evidenceText: "Saudi Arabia co-op for students. Please send your CV to coop@example.org.",
    emailEvidenceText: "Please send your CV to coop@example.org." };
  assert.equal(classifyByPolicy(noExplicit, ai(), now).status, "LIKELY");
  const mixed = { ...coopEmail, evidenceText: "The COOP program is in Saudi Arabia. Send your COOP application to alternate@example.org. For inquiries contact coop@example.org.",
    emailEvidenceText: "For inquiries contact coop@example.org." };
  assert.equal(classifyByPolicy(mixed, ai(), now).status, "LIKELY");
});

test("the Arabic program and official internship portal verify only an explicit application channel", () => {
  const outcome = classifyByPolicy(arabicPortal, ai({
    cities: ["الرياض"], majors: ["المحاسبة"], requiredDocuments: ["السيرة الذاتية"],
    evidenceQuotes: [quote("cities", "الرياض", "مكان التدريب: الرياض"), quote("majors", "المحاسبة", "التخصصات المقبولة: المحاسبة"),
      quote("requiredDocuments", "السيرة الذاتية", "يجب إرفاق السيرة الذاتية")],
  }), now);
  assert.equal(outcome.status, "VERIFIED");
  assert.deepEqual(outcome.extraction.cities, ["الرياض"]);
  assert.deepEqual(outcome.extraction.majors, ["المحاسبة"]);
  assert.deepEqual(outcome.extraction.requiredDocuments, ["السيرة الذاتية"]);
  const english = { ...arabicPortal, opportunityTitle: "Internship for students", evidenceText: "Internship for university students in Saudi Arabia.",
    applicationEvidenceText: "Apply now" };
  assert.equal(classifyByPolicy(english, ai({ trainingType: "internship" }), now).status, "VERIFIED");
  assert.equal(classifyByPolicy({ ...english, applicationEvidenceText: "" }, ai(), now).status, "LIKELY");
  assert.equal(classifyByPolicy({ ...english, applicationUrl: "" }, ai(), now).status, "REJECTED");
  const arabicMail = { ...arabicPortal, channelType: "EMAIL", applicationUrl: "", destinationEmail: "coop@example.org",
    emailEvidenceText: "أرسل السيرة الذاتية للتقديم على التدريب التعاوني إلى coop@example.org" };
  assert.equal(classifyByPolicy(arabicMail, ai(), now).status, "VERIFIED");
});

test("expired or closed announcements cannot be revived by a recommendation", () => {
  const expired = { ...coopEmail, evidenceText: coopEmail.evidenceText + " Application deadline: 10 November 2026." };
  const outcome = classifyByPolicy(expired, ai(), now);
  assert.equal(outcome.status, "EXPIRED");
  assert.equal(outcome.effectiveDeadline.toISOString(), "2026-11-10T20:59:59.999Z");
  assert.equal(classifyByPolicy({ ...expired, evidenceText: coopEmail.evidenceText + " Applications are closed." }, ai(), now).status, "NEEDS_REVIEW");
  assert.equal(classifyByPolicy({ ...coopEmail, evidenceText: coopEmail.evidenceText +
    " Application deadline: November 24, 2026." }, ai({ deadline: "2026-12-31" }), now).status, "EXPIRED");
  assert.equal(classifyByPolicy({ ...arabicPortal, evidenceText: arabicPortal.evidenceText +
    " آخر موعد للتقديم: ٢٠ نوفمبر ٢٠٢٦." }, ai(), now).status, "EXPIRED");
  assert.equal(classifyByPolicy({ ...coopEmail, evidenceText: coopEmail.evidenceText +
    " Application deadline: 24/11/2026." }, ai(), now).status, "EXPIRED");
  assert.equal(classifyByPolicy({ ...coopEmail, evidenceText: coopEmail.evidenceText +
    " Application deadline: 03/04/2026." }, ai(), now).status, "NEEDS_REVIEW");
});

test("unsupported literal or ambiguous values and headquarters stay unknown", () => {
  const outcome = classifyByPolicy({ ...coopEmail, evidenceText: coopEmail.evidenceText + " Headquarters are located in Riyadh." },
    ai({ cities: ["Riyadh", "Jeddah"], majors: ["Information Systems"], fields: ["Data Analysis"],
      educationLevels: ["Bachelor"], requiredDocuments: ["GPA report"], deadline: "2028-11-25",
      evidenceQuotes: [quote("cities", "Riyadh", "Headquarters are located in Riyadh"), quote("cities", "Jeddah", "Training location: Jeddah"),
        quote("majors", "Information Systems", "Accepted majors: Information Systems"), quote("deadline", "2028-11-25", "Cooperative training")] }), now);
  for (const field of ["cities", "majors", "fields", "educationLevels", "requiredDocuments"]) assert.deepEqual(outcome.extraction[field], []);
  assert.equal(outcome.extraction.deadline, null);
  const careers = { ...coopEmail, opportunityTitle: "Careers", pageTitle: "Careers",
    evidenceText: "Explore roles with our Saudi Arabia careers team.", emailEvidenceText: "General inquiries" };
  assert.equal(classifyByPolicy(careers, ai(), now).status, "NEEDS_REVIEW");
});

test("remote applicants require Saudi eligibility; Saudi headquarters do not override foreign location", () => {
  const remote = { ...arabicPortal, opportunityTitle: "Remote Internship for students", pageTitle: "Remote Internship",
    applicationEvidenceText: "Apply now", evidenceText: "Remote internship open to applicants based in Saudi Arabia." };
  const output = ai({ remote: true, trainingType: "internship",
    evidenceQuotes: [quote("remote", "true", "Remote internship open to applicants based in Saudi Arabia")] });
  assert.equal(classifyByPolicy(remote, output, now).status, "VERIFIED");
  assert.equal(classifyByPolicy(remote, output, now).extraction.remote, true);
  assert.equal(classifyByPolicy({ ...remote, evidenceText: "Remote internship. Our headquarters are in Saudi Arabia." }, output, now)
    .rule, "REMOTE_SAUDI_UNCONFIRMED");
  assert.equal(classifyByPolicy({ ...remote, opportunityTitle: "Internship for students", pageTitle: "Internship",
    evidenceText: "Internship for university students. Training in Dubai. Our headquarters are in Saudi Arabia." }, output, now).status, "REJECTED");
});

function memoryStore(items) {
  const state = new Map(items.map((item) => [item._id, structuredClone(item)]));
  return {
    state,
    list: async () => [...state.values()].map((item) => structuredClone(item)),
    async claim(record, { hash, attemptId, now }) {
      const current = state.get(record._id);
      if (current.contentHash !== record.contentHash || current.classificationAttempt?.retryAfter > now) return false;
      current.classificationAttempt = { id: attemptId, hash, retryAfter: new Date(+now + 10000) };
      return true;
    },
    async apply(record, result) {
      const current = state.get(record._id);
      if (current.contentHash !== record.contentHash) return false;
      delete current.classificationAttempt;
      Object.assign(current, { classificationHash: result.hash, classifierVersion: CLASSIFIER_VERSION,
        classification: result.evaluation, verificationStatus: result.evaluation.status, classifiedAt: result.now });
      return true;
    },
    async fail(record, _attemptId, code) { state.get(record._id).classificationAttempt.failureCode = code; },
  };
}

const call = (store, replies, options = {}) => classifySupplyBatch({ env, store, clock: () => now, client: {
  responses: { async parse(body, request) {
    assert.equal(body.text.format.type, "json_schema");
    assert.equal(body.text.format.strict, true);
    assert.equal(body.store, false);
    assert.equal(request.maxRetries, 0);
    const result = replies.shift();
    if (result instanceof Error) throw result;
    return { status: "completed", model: "fixture-model", output_parsed: result, usage: { input_tokens: 10, output_tokens: 4 } };
  } },
}, ...options });

test("unchanged classifications, closed records and existing verified legacy data skip AI", async () => {
  const old = { ...arabicPortal, _id: "legacy", verificationStatus: "VERIFIED" };
  const duplicate = { ...coopEmail, classificationHash: classificationHash(coopEmail, env.OPENAI_SUPPLY_CLASSIFIER_MODEL) };
  const rejected = { ...genericHr, verificationStatus: "REJECTED" };
  const expired = { ...genericHr, _id: "expired", verificationStatus: "EXPIRED" };
  const store = memoryStore([old, duplicate, rejected, expired]);
  const result = await call(store, []);
  assert.equal(result.aiCalls, 0);
  assert.equal(result.skippedUnchanged, 1);
  assert.deepEqual(store.state.get(old._id), old);
});

test("changed evidence reclassifies; malformed output and provider failure never mutate verification", async () => {
  const store = memoryStore([coopEmail, genericHr, arabicPortal]);
  const result = await call(store, [{ fabricated: true }, new Error("raw provider text"), ai()]);
  assert.equal(result.aiCalls, 3);
  assert.equal(result.failedClassifications, 2);
  assert.equal(result.successfulClassifications, 1);
  assert.equal(result.inputTokens, 20);
  assert.equal(store.state.get(coopEmail._id).verificationStatus, "NEEDS_REVIEW");
  assert.equal(store.state.get(genericHr._id).verificationStatus, "NEEDS_REVIEW");
  assert.equal(store.state.get(arabicPortal._id).verificationStatus, "VERIFIED");
  assert.deepEqual(result.failureCodes, ["SUPPLY_AI_RESPONSE_INVALID", "SUPPLY_AI_UNKNOWN_ERROR"]);
  assert.doesNotMatch(JSON.stringify(result), /raw provider text/);
  assert.equal((await call(store, [])).aiCalls, 0);
  const changed = store.state.get(coopEmail._id);
  Object.assign(changed, { contentHash: "updated-content" });
  delete changed.classificationAttempt;
  assert.equal((await call(store, [ai()])).successfulClassifications, 1);
});

test("provider diagnostics distinguish schema, timeout and provider errors without echoing raw values", () => {
  const diagnostic = errorDiagnostics({ status: 400, type: "invalid_request_error", code: "invalid_json_schema",
    request_id: "req_fixture", message: "private payload", headers: { Authorization: "secret" } }, "fixture-model", "provider_request");
  assert.equal(diagnostic.code, "SUPPLY_AI_SCHEMA_ERROR");
  assert.equal(diagnostic.kind, "schema_error");
  assert.equal(diagnostic.providerStatus, 400);
  assert.equal(diagnostic.requestId, "req_fixture");
  assert.doesNotMatch(JSON.stringify(diagnostic), /private payload|Authorization|secret/);
  assert.equal(errorDiagnostics({ name: "Error", cause: { code: "UND_ERR_CONNECT_TIMEOUT" } }, "fixture-model", "provider_request").code, "SUPPLY_AI_TIMEOUT");
  for (const [status, code] of [[401, "SUPPLY_AI_AUTH_FAILED"], [429, "SUPPLY_AI_RATE_LIMITED"], [404, "SUPPLY_AI_MODEL_ERROR"]]) {
    assert.equal(errorDiagnostics({ status }, "fixture-model", "provider_request").code, code);
  }
});

test("batch limit and deterministic expiry protect cost; a newer observation cannot be overwritten", async () => {
  const expired = { ...coopEmail, _id: "expired", deadline: new Date("2026-11-24T00:00:00Z") };
  const store = memoryStore([expired, coopEmail, arabicPortal]);
  const first = await call(store, [ai()], { env: { ...env, AUTO_APPLY_SUPPLY_MAX_AI_CLASSIFICATIONS_PER_RUN: "1" } });
  assert.equal(first.aiCalls, 1);
  assert.deepEqual(first.statuses, { EXPIRED: 1, VERIFIED: 1 });
  const stale = await call(store, [], { client: { responses: { async parse() {
    store.state.get(arabicPortal._id).contentHash = "new-evidence-while-in-flight";
    return { output_parsed: ai() };
  } } } });
  assert.equal(stale.staleClassifications, 1);
  assert.equal(store.state.get(arabicPortal._id).verificationStatus, "NEEDS_REVIEW");
  assert.equal(classifierSettings({}).enabled, false);
  assert.equal(classifierSettings({}).maxCalls, 20);
});

test("canonical re-ingestion keeps same-content verification and archives classification on change", async () => {
  let row;
  const model = { findOne: () => ({ lean: async () => row && structuredClone(row) }),
    async create(entry) { row = { ...entry, _id: "row", __v: 0 }; return row; },
    findOneAndUpdate: (_query, update) => ({ lean: async () => {
      Object.assign(row, update.$set);
      if (update.$push) (row.history ||= []).push(update.$push.history);
      for (const field of Object.keys(update.$unset || {})) delete row[field];
      return row;
    } }),
  };
  const { verificationStatus, ...observation } = coopEmail;
  await ingestSupply(observation, { now, model });
  Object.assign(row, { verificationStatus: "VERIFIED", verificationReason: "Explicit application evidence",
    classificationHash: "previous-classification", classification: { contentHash: row.contentHash, emailExplicitlySupported: true } });
  assert.equal((await ingestSupply(observation, { now, model })).action, "duplicate");
  assert.equal(row.verificationStatus, "VERIFIED");
  await ingestSupply({ ...observation, evidenceText: "New announcement for Saudi Arabia", emailEvidenceText: "" }, { now, model });
  assert.equal(row.verificationStatus, "NEEDS_REVIEW");
  assert.equal(row.classification, undefined);
  assert.equal(row.history[0].classificationHash, "previous-classification");
});
