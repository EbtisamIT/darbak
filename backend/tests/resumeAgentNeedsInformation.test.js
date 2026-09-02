const assert = require("assert");
const {
  filterConfirmedQuestions,
  ensureActionableNeedsInformation,
  normalizeNeedsInformationOutput,
} = require("../agents/darbakResumeAgent");

const facts = {
  profile: {
    projects: [{ id: "project-1", title: "بوابة الطلاب", description: "" }],
    experiences: [{ id: "experience-1", title: "مساعدة مطورة", description: "" }],
  },
  resume: {},
  sources: [],
  answers: [],
};

{
  const normalized = normalizeNeedsInformationOutput({
    status: "needs_information",
    questions: [{ section: "projects", question: "اكتب وصفًا مختصرًا لما نفذته في بوابة الطلاب.", inputType: "text" }],
  }, facts);
  assert.strictEqual(normalized.questions[0].fieldKey, "project_description:project-1");
  assert.strictEqual(normalized.questions[0].inputType, "textarea");
  assert.strictEqual(normalized.questions[0].reason, "project_description_missing");
}

{
  const normalized = normalizeNeedsInformationOutput({
    status: "needs_information",
    questions: [{ section: "experiences", question: "ما المهام التي نفذتها كمساعدة مطورة؟" }],
  }, facts);
  assert.strictEqual(normalized.questions[0].fieldKey, "experience_description:experience-1");
  assert.strictEqual(normalized.questions[0].reason, "experience_description_missing");
}

{
  const optionalDoesNotBlock = normalizeNeedsInformationOutput({
    status: "draft_ready",
    draft: { professionalSummary: "مسودة صالحة." },
    missingInformation: [{ section: "summary", question: "ما المجال الذي تهتم به؟" }],
  }, facts);
  assert.strictEqual(optionalDoesNotBlock.status, "draft_ready");
}

{
  const unknown = normalizeNeedsInformationOutput({
    status: "needs_information",
    questions: [{ section: "general", question: "اذكر أي معلومات إضافية." }],
  }, facts);
  const actionable = ensureActionableNeedsInformation(unknown, {
    profile: {}, resume: {}, sources: [], answers: [],
  });
  assert.strictEqual(actionable.status, "cannot_continue");
  assert.strictEqual(actionable.questions.length, 0);
  assert.ok(actionable.warnings.includes("AGENT_UNMAPPABLE_MISSING_INFORMATION"));
}

{
  const normalized = normalizeNeedsInformationOutput({
    status: "needs_information",
    questions: [{ section: "projects", question: "اكتب وصفًا مختصرًا لما نفذته في بوابة الطلاب." }],
  }, facts);
  const afterAnswer = filterConfirmedQuestions(normalized, {
    ...facts,
    answers: [{ fieldKey: "project_description:project-1", answer: "بنيت واجهات لتنظيم الطلبات." }],
  });
  assert.deepStrictEqual(afterAnswer.questions, []);
}

console.log("resumeAgentNeedsInformation tests passed");
