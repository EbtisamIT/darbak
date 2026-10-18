const OpenAI = require("openai");

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["professionalSummary", "trainingBullets"],
  properties: {
    professionalSummary: { type: "string" },
    trainingBullets: { type: "array", items: { type: "string" } },
  },
};

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

async function generateRewardResumeSuggestions(facts, clientOverride) {
  if (!["ar", "en"].includes(facts.language) || !facts.training[0]?.responsibilities?.trim()) {
    throw new Error("MISSING_REWARD_AI_FACTS");
  }
  const client = clientOverride || new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 15000,
    maxRetries: 0,
  });
  const response = await client.responses.create({
    model: process.env.OPENAI_EXPERIENCE_REWARD_MODEL || "gpt-5.6-luna",
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
    text: { format: { type: "json_schema", name: "experience_reward_resume", strict: true, schema: OUTPUT_SCHEMA } },
  });
  const output = response.output_text || (response.output || [])
    .flatMap((item) => item.content || []).map((item) => item.text || "").join("");
  return validateRewardAiOutput(JSON.parse(output), facts);
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
  try {
    const suggestion = validateRewardAiOutput(await generate(facts), facts);
    await Reward.updateOne({ _id: reward._id, userId, status: "available" },
      { $set: { aiSuggestion: suggestion, aiGeneratedAt: new Date() } });
    return { status: "ready", suggestion };
  } catch {
    return { status: "failed" };
  }
}

module.exports = {
  buildRewardAiFacts, validateRewardAiOutput, generateRewardResumeSuggestions,
  requestRewardAiSuggestion,
};
