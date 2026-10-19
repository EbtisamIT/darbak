const assert = require("assert/strict");
const {
  buildRewardAiFacts, validateRewardAiOutput, generateRewardResumeSuggestions,
  requestRewardAiSuggestion, classifyRewardAiFailure, runRewardAiQaDiagnostic,
} = require("../services/experienceRewardResumeAi");

const draft = {
  major: "Information Systems", graduationYear: "2025", skills: ["Excel", "SQL"],
  projects: [{ title: "Dashboard", tools: ["Excel"], description: "Organized student data" }],
  trainingExperience: [{ title: "Data Intern", organization: "DataVolt", location: "Riyadh",
    period: "2025", tools: ["Excel", "SQL"],
    description: "Cleaned sales data using Excel\nPrepared SQL queries for the team" }],
};

const makeReward = () => {
  const row = { _id: "reward-1", userId: "user-1", campaignId: "experience-reward-v1",
    status: "available", language: "en", draft, aiGenerationAttemptedAt: null, aiSuggestion: null };
  return {
    row,
    findOne: () => ({ lean: async () => ({ ...row }) }),
    findOneAndUpdate: (query, update) => ({ lean: async () => {
      if (row.aiGenerationAttemptedAt || query.userId !== row.userId) return null;
      Object.assign(row, update.$set); return { ...row };
    } }),
    updateOne: async (_, update) => { Object.assign(row, update.$set); },
  };
};

async function run() {
  const facts = buildRewardAiFacts(draft, "en");
  assert.equal(facts.training[0].responsibilities, draft.trainingExperience[0].description);
  assert.equal(JSON.stringify(facts).includes("public experience narrative"), false);
  const suggestion = {
    professionalSummary: "Information Systems graduate with Excel and SQL training at DataVolt.",
    trainingBullets: ["Cleaned sales data using Excel", "Prepared SQL queries for the team"],
  };
  assert.deepEqual(validateRewardAiOutput(suggestion, facts), suggestion);
  const arabicFacts = buildRewardAiFacts({
    major: "نظم المعلومات", graduationYear: "2025", skills: ["Excel", "SQL"],
    projects: [{ title: "لوحة الأنشطة", tools: ["Excel"], description: "نظمت بيانات الأنشطة" }],
    trainingExperience: [{ title: "متدربة تحليل بيانات", organization: "شركة أفق التقنية",
      location: "الرياض", period: "2025", tools: ["Excel", "SQL"],
      description: "نظفت بيانات المبيعات باستخدام Excel\nأعددت استعلامات SQL للفريق" }],
  }, "ar");
  const arabicSuggestion = {
    professionalSummary: "خريجة نظم معلومات عام 2025، لديها خبرة تدريبية في تنظيم بيانات المبيعات.\nأدوات العمل: Excel، SQL.",
    trainingBullets: ["نظفت بيانات المبيعات باستخدام Excel", "أعددت استعلامات SQL للفريق"],
  };
  assert.deepEqual(validateRewardAiOutput(arabicSuggestion, arabicFacts), arabicSuggestion);
  for (const valid of [
    "حللت بيانات المبيعات باستخدام Excel.",
    "ساهمت في إعداد التقارير الأسبوعية.",
    "شاركت في تنظيم البيانات وتوثيقها.",
    "عملت على إعداد استعلامات SQL للفريق.",
    "دعمت الفريق في تحديث لوحة البيانات.",
  ]) {
    assert.equal(validateRewardAiOutput({ ...arabicSuggestion,
      trainingBullets: [valid, arabicSuggestion.trainingBullets[1]],
    }, arabicFacts).trainingBullets[0], valid);
  }
  for (const fragment of ["تحليل البيانات", "Excel وSQL", "التدريب في الشركة"]) {
    assert.throws(() => validateRewardAiOutput({ ...arabicSuggestion,
      trainingBullets: [fragment, arabicSuggestion.trainingBullets[1]],
    }, arabicFacts), (error) => error.validationRule === "BULLET_FRAGMENT_INVALID");
  }
  assert.throws(() => validateRewardAiOutput({ ...arabicSuggestion,
    trainingBullets: [arabicFacts.training[0].responsibilities, arabicSuggestion.trainingBullets[1]],
  }, arabicFacts), (error) => error.validationRule === "BULLET_NARRATIVE_COPY");
  assert.throws(() => validateRewardAiOutput({ ...suggestion,
    trainingBullets: ["Improved sales by 60% using Python", suggestion.trainingBullets[1]],
  }, facts), /UNSUPPORTED_REWARD_AI_FACT/, "unsupported metric or technology rejected");

  let requests = 0;
  const client = { responses: { parse: async (request) => {
    requests += 1;
    assert.equal(request.store, false);
    assert.equal(request.text.format.type, "json_schema");
    assert.equal(request.text.format.strict, true);
    assert.match(request.instructions, /natural Arabic sentence order/);
    assert.deepEqual(request.text.format.schema.required, ["professionalSummary", "trainingBullets"]);
    assert.equal(request.text.format.schema.additionalProperties, false);
    assert.equal(request.text.format.schema.properties.trainingBullets.minItems, 2);
    assert.equal(request.text.format.schema.properties.trainingBullets.maxItems, 4);
    return { status: "completed", output_parsed: suggestion, output_text: "not JSON" };
  } } };
  assert.deepEqual(await generateRewardResumeSuggestions(facts, client), suggestion);
  assert.equal(requests, 1, "summary and training rewrite use one request");

  const Reward = makeReward();
  let calls = 0;
  const generate = async () => { calls += 1; return suggestion; };
  assert.equal((await requestRewardAiSuggestion({ userId: "user-1", Reward, generate })).status, "ready");
  assert.equal(Reward.row.status, "available", "AI does not redeem reward");
  assert.equal((await requestRewardAiSuggestion({ userId: "user-1", Reward, generate })).status, "already_attempted");
  assert.equal(calls, 1, "duplicate request never calls model again");

  assert.equal(classifyRewardAiFailure({ status: 401 }, "provider_request"), "OPENAI_AUTH_ERROR");
  assert.equal(classifyRewardAiFailure({ status: 429 }, "provider_request"), "OPENAI_RATE_LIMIT");
  assert.equal(classifyRewardAiFailure({ status: 404 }, "provider_request"), "OPENAI_MODEL_NOT_FOUND");
  assert.equal(classifyRewardAiFailure({ status: 400 }, "provider_request"), "OPENAI_BAD_REQUEST");
  assert.equal(classifyRewardAiFailure({ name: "APIConnectionTimeoutError" }, "provider_request"), "OPENAI_TIMEOUT");
  assert.equal(classifyRewardAiFailure(new SyntaxError("secret raw response"), "json_parse"), "OPENAI_RESPONSE_NOT_JSON");
  assert.equal(classifyRewardAiFailure(new SyntaxError("secret raw response"), "structured_output"),
    "OPENAI_STRUCTURED_OUTPUT_FAILED");
  assert.equal(classifyRewardAiFailure(new Error("INVALID_REWARD_AI_OUTPUT"), "content_validation"),
    "OPENAI_CONTENT_INVALID");
  assert.equal(classifyRewardAiFailure(new Error("UNSUPPORTED_REWARD_AI_FACT"), "fact_validation"), "OPENAI_FACT_VALIDATION_FAILED");

  const structuredTrace = {};
  await assert.rejects(
    generateRewardResumeSuggestions(arabicFacts, { responses: {
      parse: async () => { throw new SyntaxError("secret raw response"); },
    } }, structuredTrace),
    (error) => error.internalErrorCode === "OPENAI_STRUCTURED_OUTPUT_FAILED" &&
      error.stage === "structured_output" && error.providerStatus === 200
  );
  assert.equal(structuredTrace.structuredOutput, "FAIL");
  const schemaTrace = {};
  await assert.rejects(
    generateRewardResumeSuggestions(arabicFacts, { responses: {
      parse: async () => ({ status: "completed", output_parsed: {
        professionalSummary: 42, trainingBullets: [] } }),
    } }, schemaTrace),
    (error) => error.internalErrorCode === "OPENAI_SCHEMA_INVALID" &&
      error.stage === "schema_validation"
  );
  assert.equal(schemaTrace.schemaValidation, "FAIL");
  const parsedClient = (output_parsed) => ({ responses: {
    parse: async () => ({ status: "completed", output_parsed }),
  } });
  const expectStructuralFailure = async (output, expectedSummary) => {
    await assert.rejects(generateRewardResumeSuggestions(arabicFacts, parsedClient(output)),
      (error) => {
        assert.equal(error.stage, "schema_validation");
        assert.equal(error.internalErrorCode, "OPENAI_SCHEMA_INVALID");
        for (const [key, value] of Object.entries(expectedSummary)) {
          assert.deepEqual(error.structuralSummary[key], value);
        }
        return true;
      });
  };
  await expectStructuralFailure({ professionalSummary: 42, trainingBullets: {} }, {
    professionalSummaryType: "number", trainingBulletsType: "object", trainingBulletsLength: null,
  });
  await expectStructuralFailure({ trainingBullets: arabicSuggestion.trainingBullets }, {
    missingKeys: ["professionalSummary"], professionalSummaryType: "undefined",
  });
  await expectStructuralFailure({ ...arabicSuggestion, secretCandidateText: "private content" }, {
    unexpectedKeys: ["<unexpected-key>"],
  });
  const expectContentFailure = async (output, validationRule) => {
    await assert.rejects(generateRewardResumeSuggestions(arabicFacts, parsedClient(output)),
      (error) => error.stage === "content_validation" &&
        error.internalErrorCode === "OPENAI_CONTENT_INVALID" &&
        error.validationRule === validationRule && !error.structuralSummary);
  };
  await expectContentFailure({ ...arabicSuggestion, professionalSummary: "   " }, "SUMMARY_EMPTY");
  await expectContentFailure({ ...arabicSuggestion, professionalSummary: "ن".repeat(451) }, "SUMMARY_TOO_LONG");
  await expectContentFailure({ ...arabicSuggestion, professionalSummary: "ن\nن\nن\nن" }, "SUMMARY_TOO_MANY_LINES");
  await expectContentFailure({ ...arabicSuggestion, trainingBullets: [arabicSuggestion.trainingBullets[0]] },
    "BULLET_COUNT_INVALID");
  await expectContentFailure({ ...arabicSuggestion, trainingBullets: Array(5).fill(arabicSuggestion.trainingBullets[0]) },
    "BULLET_COUNT_INVALID");
  await expectContentFailure({ ...arabicSuggestion, trainingBullets: ["", arabicSuggestion.trainingBullets[0]] },
    "BULLET_EMPTY");
  await expectContentFailure({ ...arabicSuggestion, trainingBullets: [
    `نظفت ${"ن".repeat(261)}`, arabicSuggestion.trainingBullets[1],
  ] }, "BULLET_TOO_LONG");
  await expectContentFailure({ ...arabicSuggestion, trainingBullets: [
    "تحليل البيانات", arabicSuggestion.trainingBullets[1],
  ] }, "BULLET_FRAGMENT_INVALID");
  await expectContentFailure({ ...arabicSuggestion, trainingBullets: [
    arabicFacts.training[0].responsibilities, arabicSuggestion.trainingBullets[1],
  ] }, "BULLET_NARRATIVE_COPY");
  assert.equal(classifyRewardAiFailure(new Error("UNSUPPORTED_REWARD_AI_FACT"), "fact_validation"),
    "OPENAI_FACT_VALIDATION_FAILED");
  for (const invalid of [
    { trainingBullets: arabicSuggestion.trainingBullets },
    { ...arabicSuggestion, extra: "unexpected" },
  ]) {
    await assert.rejects(generateRewardResumeSuggestions(arabicFacts, { responses: {
      parse: async () => ({ status: "completed", output_parsed: invalid }),
    } }), (error) => error.internalErrorCode === "OPENAI_SCHEMA_INVALID");
  }
  await assert.rejects(generateRewardResumeSuggestions(arabicFacts, { responses: {
    parse: async () => ({ status: "completed", output_parsed: null,
      output: [{ content: [{ type: "refusal" }] }] }),
  } }), (error) => error.internalErrorCode === "OPENAI_STRUCTURED_OUTPUT_FAILED");
  await assert.rejects(generateRewardResumeSuggestions(arabicFacts, { responses: {
    parse: async () => { const error = new Error("timeout"); error.name = "APIConnectionTimeoutError"; throw error; },
  } }), (error) => error.internalErrorCode === "OPENAI_TIMEOUT");
  const factTrace = {};
  await assert.rejects(
    generateRewardResumeSuggestions(arabicFacts, { responses: {
      parse: async () => ({ status: "completed", output_parsed: { ...arabicSuggestion,
        trainingBullets: ["نظفت بيانات المبيعات باستخدام Python", arabicSuggestion.trainingBullets[1]] } }),
    } }, factTrace),
    (error) => error.internalErrorCode === "OPENAI_FACT_VALIDATION_FAILED" &&
      error.stage === "fact_validation"
  );
  assert.equal(factTrace.factValidation, "FAIL");

  let structuralLog = "";
  const previousWarn = console.warn;
  console.warn = (line) => { structuralLog = line; };
  try {
    const failed = makeReward();
    assert.equal((await requestRewardAiSuggestion({ userId: "user-1", Reward: failed,
      generate: (input, _client, trace) => generateRewardResumeSuggestions(input,
        parsedClient({ ...suggestion, secretCandidateText: "private content" }), trace),
    })).status, "failed");
    const logged = JSON.parse(structuralLog);
    assert.equal(logged.internalErrorCode, "OPENAI_SCHEMA_INVALID");
    assert.deepEqual(logged.structuralSummary.unexpectedKeys, ["<unexpected-key>"]);
    assert.equal(structuralLog.includes("private content"), false);
    assert.equal(structuralLog.includes("secretCandidateText"), false);
  } finally {
    console.warn = previousWarn;
  }
  let contentLog = "";
  console.warn = (line) => { contentLog = line; };
  try {
    const failed = makeReward();
    assert.equal((await requestRewardAiSuggestion({ userId: "user-1", Reward: failed,
      generate: (input, _client, trace) => generateRewardResumeSuggestions(input,
        parsedClient({ ...suggestion, professionalSummary: "private content ".repeat(40) }), trace),
    })).status, "failed");
    const logged = JSON.parse(contentLog);
    assert.equal(logged.stage, "content_validation");
    assert.equal(logged.internalErrorCode, "OPENAI_CONTENT_INVALID");
    assert.equal(logged.validationRule, "SUMMARY_TOO_LONG");
    assert.equal(contentLog.includes("private content"), false);
  } finally {
    console.warn = previousWarn;
  }

  const diagnosticSuggestion = {
    professionalSummary: "خريج نظم معلومات عام 2025، لديه مهارات في تحليل البيانات باستخدام Excel وSQL.",
    trainingBullets: ["نظفت بيانات المبيعات باستخدام Excel", "أعددت استعلامات SQL للفريق"],
  };
  const diagnostic = await runRewardAiQaDiagnostic({ generate: async (fixedFacts, _client, trace) => {
    assert.equal(fixedFacts.language, "ar");
    assert.equal(fixedFacts.training[0].company, "جهة اختبار");
    trace.providerReached = true;
    trace.providerStatus = 200;
    trace.jsonParse = "PASS";
    trace.schemaValidation = "PASS";
    trace.factValidation = "PASS";
    return diagnosticSuggestion;
  } });
  assert.deepEqual(diagnostic.suggestion, diagnosticSuggestion);
  assert.equal(diagnostic.modelAccessible, true);
  assert.equal(diagnostic.internalErrorCode, null);

  let safeLog = "";
  const oldWarn = console.warn;
  console.warn = (line) => { safeLog = line; };
  try {
    const failedDiagnostic = await runRewardAiQaDiagnostic({ generate: async (_facts, _client, trace) => {
      trace.providerStatus = 404;
      trace.providerReached = true;
      const error = new Error("secret raw provider response and resume text");
      error.status = 404;
      error.request_id = "req_test123";
      throw error;
    } });
    assert.equal(failedDiagnostic.internalErrorCode, "OPENAI_MODEL_NOT_FOUND");
    assert.equal(failedDiagnostic.modelAccessible, false);
    assert.equal(failedDiagnostic.providerStatus, 404);
    assert.equal(JSON.parse(safeLog).event, "experience_reward_ai_failure");
    assert.equal(JSON.parse(safeLog).providerRequestId, "req_test123");
    assert.equal(safeLog.includes("secret raw"), false);
    assert.equal(safeLog.includes("resume text"), false);
  } finally {
    console.warn = oldWarn;
  }

  const failedReward = makeReward();
  assert.equal((await requestRewardAiSuggestion({ userId: "user-1", Reward: failedReward,
    generate: async () => { throw new Error("provider unavailable"); } })).status, "failed");
  assert.equal(failedReward.row.status, "available", "provider failure does not consume reward");
  assert.equal((await requestRewardAiSuggestion({ userId: "user-1", Reward: failedReward,
    generate: async () => { throw new Error("unexpected second call"); } })).status, "already_attempted");
  console.log("Experience reward AI limits and factual guards: PASS");
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
