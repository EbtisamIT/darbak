const OpenAI = require("openai");
const { z } = require("zod");
const { zodTextFormat } = require("openai/helpers/zod");

const getRewardAiModel = () => process.env.OPENAI_EXPERIENCE_REWARD_MODEL || "gpt-5.6-luna";
const safeModelName = () => String(getRewardAiModel()).replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 80);
const safeRequestId = (value) => typeof value === "string" && /^[a-zA-Z0-9._-]{1,128}$/.test(value)
  ? value : null;
const safeProviderStatus = (value) => Number.isInteger(value) && value >= 100 && value <= 599
  ? value : null;
const safeIdentifier = (value) => /^[a-f\d]{24}$/i.test(String(value || "")) ? String(value) : null;

const classifyRewardAiFailure = (error, stage = "unknown") => {
  if (error?.internalErrorCode) return error.internalErrorCode;
  if (stage === "structured_output") return "OPENAI_STRUCTURED_OUTPUT_FAILED";
  if (stage === "json_parse" || error instanceof SyntaxError) return "OPENAI_RESPONSE_NOT_JSON";
  if (stage === "schema_validation" || ["INVALID_REWARD_AI_OUTPUT", "INVALID_REWARD_AI_BULLET"]
    .includes(error?.message)) return "OPENAI_SCHEMA_INVALID";
  if (stage === "fact_validation" || error?.message === "UNSUPPORTED_REWARD_AI_FACT") {
    return "OPENAI_FACT_VALIDATION_FAILED";
  }
  const status = safeProviderStatus(error?.status);
  const providerCode = String(error?.code || "").toLowerCase();
  if (error?.name === "APIConnectionTimeoutError" || ["etimedout", "timeout"].includes(providerCode)) {
    return "OPENAI_TIMEOUT";
  }
  if (status === 401 || status === 403 || providerCode === "invalid_api_key") return "OPENAI_AUTH_ERROR";
  if (status === 429 || providerCode === "rate_limit_exceeded") return "OPENAI_RATE_LIMIT";
  if (status === 404 || providerCode === "model_not_found") return "OPENAI_MODEL_NOT_FOUND";
  if (status === 400) return "OPENAI_BAD_REQUEST";
  if (stage === "provider_request") return "OPENAI_REQUEST_FAILED";
  return "UNKNOWN_AI_FAILURE";
};

const tagRewardAiFailure = (error, stage, startedAt, trace = {}) => {
  const tagged = new Error(classifyRewardAiFailure(error, stage));
  tagged.stage = stage;
  tagged.internalErrorCode = tagged.message;
  tagged.providerStatus = safeProviderStatus(error?.status) || trace.providerStatus || null;
  tagged.providerRequestId = safeRequestId(error?.request_id || error?._request_id) ||
    trace.providerRequestId || null;
  tagged.durationMs = Math.max(0, Date.now() - startedAt);
  return tagged;
};

const safeRewardAiFailure = (error, trace = {}, startedAt = Date.now()) => ({
  stage: error?.stage || "unknown",
  internalErrorCode: classifyRewardAiFailure(error, error?.stage),
  providerStatus: safeProviderStatus(error?.providerStatus || error?.status) ||
    trace.providerStatus || null,
  providerRequestId: safeRequestId(error?.providerRequestId || error?.request_id) ||
    trace.providerRequestId || null,
  model: safeModelName(),
  durationMs: Number.isFinite(error?.durationMs) ? error.durationMs : Math.max(0, Date.now() - startedAt),
});

const logRewardAiFailure = ({ error, trace, startedAt, userId, rewardId }) => {
  console.warn(JSON.stringify({ event: "experience_reward_ai_failure",
    ...safeRewardAiFailure(error, trace, startedAt),
    userId: safeIdentifier(userId), rewardId: safeIdentifier(rewardId) }));
};

const rewardSuggestionSchema = z.object({
  professionalSummary: z.string(),
  trainingBullets: z.array(z.string()).min(2).max(4),
}).strict();

const words = (value) => String(value || "").match(/\d+(?:[.,]\d+)?/g) || [];
const knownTools = ["python", "sql", "excel", "power bi", "react", "javascript",
  "figma", "tableau", "aws", "github", "html", "css", "powerpoint"];
const unsupportedTokens = (output, input) => {
  const known = new Set(words(input).map((part) => part.toLowerCase()));
  const unknownNumbers = words(output).filter((part) => !known.has(part.toLowerCase()));
  const lowerOutput = String(output || "").toLowerCase();
  const lowerInput = String(input || "").toLowerCase();
  return [...unknownNumbers, ...knownTools.filter((tool) =>
    lowerOutput.includes(tool) && !lowerInput.includes(tool))];
};

const buildRewardAiFacts = (draft = {}, language) => ({
  language,
  major: draft.major || "",
  graduationYear: draft.graduationYear || "",
  skills: draft.skills || [],
  projects: (draft.projects || []).map((item) => ({
    name: item.title || "", tools: item.tools || [], contributions: item.description || "",
  })),
  training: (draft.trainingExperience || []).slice(0, 1).map((item) => ({
    title: item.title || "", company: item.organization || "",
    city: item.location || "", period: item.period || "",
    tools: item.tools || [], responsibilities: item.description || "",
  })),
});

const validateRewardAiOutput = (result, facts) => {
  const summary = typeof result?.professionalSummary === "string" ? result.professionalSummary.trim() : "";
  const bullets = Array.isArray(result?.trainingBullets) ? result.trainingBullets
    .filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean) : [];
  const summaryLines = summary.split(/\r?\n/).filter(Boolean);
  if (!summary || summary.length > 450 || summaryLines.length > 3 || bullets.length < 2 || bullets.length > 4 ||
    bullets.some((item) => item.length > 260)) throw new Error("INVALID_REWARD_AI_OUTPUT");
  const startsWithAction = facts.language === "ar"
    ? /^(?:حللت|نظمت|نظفت|أعددت|وثقت|طورت|صممت|جمعت|راجعت|استخدمت|أنشأت|دعمت|نفذت|شاركت|ساهمت|تابعت|بنيت|اختبرت|نسقت|قدمت|حدّثت|حسّنت|استخرجت|رتبت|درست|أجريت)(?=\s|$|[،,.])/u
    : /^(?:Analyzed|Organized|Prepared|Documented|Developed|Designed|Collected|Reviewed|Used|Created|Supported|Implemented|Contributed|Monitored|Built|Tested|Coordinated|Updated|Improved|Extracted|Compiled|Cleaned|Wrote)\b/i;
  if (bullets.some((item) => !startsWithAction.test(item))) throw new Error("INVALID_REWARD_AI_BULLET");
  const source = JSON.stringify(facts);
  if (unsupportedTokens(`${summary} ${bullets.join(" ")}`, source).length) {
    throw new Error("UNSUPPORTED_REWARD_AI_FACT");
  }
  return { professionalSummary: summary, trainingBullets: bullets };
};

async function generateRewardResumeSuggestions(facts, clientOverride, trace = {}) {
  const startedAt = Date.now();
  if (!["ar", "en"].includes(facts.language) || !facts.training[0]?.responsibilities?.trim()) {
    throw tagRewardAiFailure(new Error("MISSING_REWARD_AI_FACTS"), "input_validation", startedAt);
  }
  let client;
  try {
    client = clientOverride || new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 15000,
      maxRetries: 0,
    });
  } catch (error) {
    const code = (process.env.OPENAI_API_KEY || "").trim()
      ? classifyRewardAiFailure(error, "provider_request") : "OPENAI_AUTH_ERROR";
    const tagged = tagRewardAiFailure(error, "provider_request", startedAt, trace);
    tagged.internalErrorCode = code;
    throw tagged;
  }
  let response;
  try {
    response = await client.responses.parse({
      model: getRewardAiModel(),
      store: false,
      max_output_tokens: 650,
      instructions: `You edit a single reward CV, not a job application. Return strict JSON only.
Use the supplied major, graduation year, skills, projects, training and tools where facts exist.
Write a natural, specific professional summary in 2–3 short lines in the requested language.
For Arabic: lead with the actual major and qualification; use natural Arabic sentence order.
Place English tool names in a short final clause or separate final line, never between an Arabic
verb and its object. Avoid generic openings such as "passionate" or "ambitious".
Write 2–4 concise training bullets. Start every bullet with a professional action verb in the
requested language. Rewrite only the supplied responsibilities; do not copy a conversational
experience narrative. Use ONLY supplied facts. Do not add metrics, technologies, goals,
seniority, achievements, or tasks absent from the input. If facts are sparse, stay brief.
Preserve technology names and numbers exactly.`,
      input: JSON.stringify(facts),
      text: { format: zodTextFormat(rewardSuggestionSchema, "experience_reward_resume") },
    });
  } catch (error) {
    const stage = error instanceof SyntaxError || error?.name === "ZodError"
      ? "structured_output" : "provider_request";
    trace.providerStatus = stage === "structured_output" ? 200 : safeProviderStatus(error?.status);
    trace.providerReached = Boolean(trace.providerStatus);
    if (stage === "structured_output") trace.structuredOutput = "FAIL";
    throw tagRewardAiFailure(error, stage, startedAt, trace);
  }
  trace.providerReached = true;
  trace.providerStatus = 200;
  trace.providerRequestId = safeRequestId(response?._request_id);
  const parsed = response.output_parsed;
  if (response.status !== "completed" || !parsed ||
    (response.output || []).some((item) => (item.content || []).some((part) => part.type === "refusal"))) {
    trace.structuredOutput = "FAIL";
    throw tagRewardAiFailure(new Error("STRUCTURED_OUTPUT_UNAVAILABLE"), "structured_output", startedAt, trace);
  }
  trace.structuredOutput = "PASS";
  trace.jsonParse = "PASS";
  if (!rewardSuggestionSchema.safeParse(parsed).success) {
    trace.schemaValidation = "FAIL";
    throw tagRewardAiFailure(new Error("INVALID_REWARD_AI_OUTPUT"), "schema_validation", startedAt, trace);
  }
  try {
    const suggestion = validateRewardAiOutput(parsed, facts);
    trace.schemaValidation = "PASS";
    trace.factValidation = "PASS";
    return suggestion;
  } catch (error) {
    const stage = error?.message === "UNSUPPORTED_REWARD_AI_FACT"
      ? "fact_validation" : "schema_validation";
    trace.schemaValidation = stage === "schema_validation" ? "FAIL" : "PASS";
    trace.factValidation = stage === "fact_validation" ? "FAIL" : "NOT_RUN";
    throw tagRewardAiFailure(error, stage, startedAt, trace);
  }
}

async function requestRewardAiSuggestion({ userId, Reward, generate = generateRewardResumeSuggestions }) {
  const reward = await Reward.findOne({ userId, campaignId: "experience-reward-v1", status: "available" }).lean();
  if (!reward) return { status: "unavailable" };
  if (reward.aiGenerationAttemptedAt) return { status: "already_attempted", suggestion: reward.aiSuggestion || null };
  const facts = buildRewardAiFacts(reward.draft || {}, reward.language);
  if (!facts.training[0]?.responsibilities?.trim()) return { status: "missing_facts" };
  const claimed = await Reward.findOneAndUpdate(
    { _id: reward._id, userId, status: "available", aiGenerationAttemptedAt: null },
    { $set: { aiGenerationAttemptedAt: new Date() } }, { new: true }
  ).lean();
  if (!claimed) return { status: "already_attempted" };
  const trace = {};
  const startedAt = Date.now();
  try {
    const suggestion = validateRewardAiOutput(await generate(facts, undefined, trace), facts);
    await Reward.updateOne({ _id: reward._id, userId, status: "available" },
      { $set: { aiSuggestion: suggestion, aiGeneratedAt: new Date() } });
    return { status: "ready", suggestion };
  } catch (error) {
    logRewardAiFailure({ error, trace, startedAt, userId, rewardId: reward._id });
    return { status: "failed" };
  }
}

// Fixed, non-personal QA facts. This path never reads or writes a reward.
const QA_DIAGNOSTIC_FACTS = Object.freeze({
  language: "ar", major: "نظم المعلومات", graduationYear: "2025",
  skills: ["Excel", "SQL", "تحليل البيانات"],
  projects: [{ name: "لوحة الأنشطة", tools: [], contributions: "نظمت بيانات الأنشطة" }],
  training: [{ title: "", company: "جهة اختبار", city: "", period: "", tools: ["Excel", "SQL"],
    responsibilities: "نظفت بيانات المبيعات باستخدام Excel\nأعددت استعلامات SQL للفريق" }],
});

async function runRewardAiQaDiagnostic({ generate = generateRewardResumeSuggestions } = {}) {
  const trace = {};
  const startedAt = Date.now();
  const base = { apiKeyConfigured: Boolean((process.env.OPENAI_API_KEY || "").trim()),
    configuredModel: safeModelName() };
  try {
    const suggestion = await generate(QA_DIAGNOSTIC_FACTS, undefined, trace);
    return { ...base, providerReachable: true, modelAccessible: true,
      providerStatus: trace.providerStatus || 200, internalErrorCode: null,
      structuredOutput: trace.structuredOutput || "PASS",
      jsonParse: trace.jsonParse || "PASS", schemaValidation: trace.schemaValidation || "PASS",
      factValidation: trace.factValidation || "PASS", durationMs: Math.max(0, Date.now() - startedAt),
      suggestion };
  } catch (error) {
    const safe = safeRewardAiFailure(error, trace, startedAt);
    logRewardAiFailure({ error, trace, startedAt, userId: null, rewardId: null });
    return { ...base, providerReachable: Boolean(trace.providerReached || safe.providerStatus),
      modelAccessible: safe.internalErrorCode === "OPENAI_MODEL_NOT_FOUND" ? false
        : trace.providerReached && safe.stage !== "provider_request" ? true : null,
      providerStatus: safe.providerStatus, internalErrorCode: safe.internalErrorCode,
      structuredOutput: trace.structuredOutput || "NOT_RUN",
      jsonParse: trace.jsonParse || "NOT_RUN", schemaValidation: trace.schemaValidation || "NOT_RUN",
      factValidation: trace.factValidation || "NOT_RUN", durationMs: safe.durationMs };
  }
}

module.exports = {
  buildRewardAiFacts, validateRewardAiOutput, generateRewardResumeSuggestions,
  requestRewardAiSuggestion, classifyRewardAiFailure, logRewardAiFailure, runRewardAiQaDiagnostic,
};
