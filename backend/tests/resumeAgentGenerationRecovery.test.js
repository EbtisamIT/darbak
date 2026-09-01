const assert = require("assert");
const {
  resumeAgentOutputSchema,
  buildGenerationCacheKey,
  getReusableDraftOutput,
  buildAgentStageError,
} = require("../agents/darbakResumeAgent");

const draft = {
  targetTitle: "Information Technology Graduate",
  professionalSummary: "Information Technology Graduate with a documented student project.",
  education: [],
  experiences: [],
  projects: [{
    sourceId: "project-1",
    name: "QA Project",
    description: "A documented QA project.",
    technologies: [],
    bullets: ["Organized student tasks using Microsoft Excel."],
    url: "",
  }],
  skills: [{ name: "Microsoft Excel", evidenceSourceId: "verified_skills" }],
  certifications: [],
  volunteering: [],
  languages: [],
  missingInformation: [],
  warnings: [],
  missingRequirements: [],
};

const validOutput = {
  status: "draft_ready",
  message: "Draft ready",
  questions: [],
  draft,
  candidateAssessment: {},
  quality: {},
  applicationPack: {},
  missingInformation: [],
  warnings: [],
  changesSummary: [],
  validationStatus: {},
  pendingDraftId: "",
};

const parsed = resumeAgentOutputSchema.safeParse(validOutput);
assert.strictEqual(parsed.success, true, "a complete structured generation is accepted");

const session = {
  purpose: "create_resume",
  language: "en",
  collectedFacts: {
    answers: [{ fieldKey: "project_description", answer: "Organized student tasks in Microsoft Excel." }],
  },
};
const verifiedResumeFacts = {
  personalInfo: { major: "Information Technology", studentStatus: "graduate" },
  projects: [{ id: "project-1", title: "QA Project", description: "A documented QA project." }],
  skills: ["Microsoft Excel"],
};
const key = buildGenerationCacheKey({ session, verifiedResumeFacts, collectedFacts: session.collectedFacts });
session.collectedFacts.agentOutputCache = { key, output: parsed.data };
assert.strictEqual(getReusableDraftOutput(session, key)?.status, "draft_ready", "a valid model output is reusable after a later composer failure");
assert.strictEqual(getReusableDraftOutput(session, `${key}-changed`), null, "changed facts or answers invalidate the cache");

const malformed = resumeAgentOutputSchema.safeParse({ status: "draft_ready", draft: { bad: true } });
assert.strictEqual(malformed.success, false, "malformed model output is rejected without a corrupt draft");

const structuredError = buildAgentStageError("structured_output", Object.assign(new Error("structured output mismatch"), { name: "ModelBehaviorError" }), {
  modelCallStarted: true,
  modelCallSucceeded: true,
});
assert.strictEqual(structuredError.code, "INVALID_AGENT_RESPONSE");
assert.deepStrictEqual(structuredError.resumeAgentTrace, {
  stage: "structured_output",
  modelCallStarted: true,
  modelCallSucceeded: true,
  structuredOutputValid: false,
  composerCompleted: false,
  qualityGateCompleted: false,
  saveCompleted: false,
  reusedModelOutput: false,
  turns: 0,
  toolCalls: 0,
});

const composerError = buildAgentStageError("professional_composer", new Error("composer failed"), {
  modelCallStarted: true,
  modelCallSucceeded: true,
  structuredOutputValid: true,
});
assert.strictEqual(composerError.resumeAgentTrace.stage, "professional_composer", "a post-model composer failure keeps the exact safe stage");
assert.strictEqual(composerError.resumeAgentTrace.modelCallSucceeded, true, "a retry can reuse the saved structured output after composer failure");

console.log("resumeAgentGenerationRecovery tests passed");
