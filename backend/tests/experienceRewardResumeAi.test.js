const assert = require("assert/strict");
const {
  buildRewardAiFacts, validateRewardAiOutput, generateRewardResumeSuggestions,
  requestRewardAiSuggestion,
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
  assert.throws(() => validateRewardAiOutput({ ...arabicSuggestion,
    trainingBullets: ["بيانات المبيعات باستخدام Excel", arabicSuggestion.trainingBullets[1]],
  }, arabicFacts), /INVALID_REWARD_AI_BULLET/);
  assert.throws(() => validateRewardAiOutput({ ...suggestion,
    trainingBullets: ["Improved sales by 60% using Python", suggestion.trainingBullets[1]],
  }, facts), /UNSUPPORTED_REWARD_AI_FACT/, "unsupported metric or technology rejected");

  let requests = 0;
  const client = { responses: { create: async (request) => {
    requests += 1;
    assert.equal(request.store, false);
    assert.equal(request.text.format.type, "json_schema");
    assert.match(request.instructions, /natural Arabic sentence order/);
    assert.deepEqual(request.text.format.schema.required, ["professionalSummary", "trainingBullets"]);
    return { output_text: JSON.stringify(suggestion) };
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

  const failedReward = makeReward();
  assert.equal((await requestRewardAiSuggestion({ userId: "user-1", Reward: failedReward,
    generate: async () => { throw new Error("provider unavailable"); } })).status, "failed");
  assert.equal(failedReward.row.status, "available", "provider failure does not consume reward");
  assert.equal((await requestRewardAiSuggestion({ userId: "user-1", Reward: failedReward,
    generate: async () => { throw new Error("unexpected second call"); } })).status, "already_attempted");
  console.log("Experience reward AI limits and factual guards: PASS");
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
