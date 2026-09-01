const assert = require("assert");
const {
  resumeAgentOutputSchema,
  buildGenerationCacheKey,
  getReusableDraftOutput,
  markAgentOutputCacheRejected,
  shouldRejectCachedDraft,
  buildAgentStageError,
  getRepairSectionForQuality,
  mergeQualityRepair,
  buildQualityRepairInput,
} = require("../agents/darbakResumeAgent");
const { runProfessionalQualityGate } = require("../services/resumeProfessionalComposer");

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
assert.strictEqual(markAgentOutputCacheRejected(session, key), true, "a rejected draft cache is marked unusable");
assert.strictEqual(getReusableDraftOutput(session, key), null, "a rejected draft is never reused on retry");
assert.strictEqual(
  shouldRejectCachedDraft({ validationResult: { valid: false }, quality: { needsRepair: false } }),
  true,
  "a claim-validation rejection also invalidates the cached raw draft"
);
assert.strictEqual(
  shouldRejectCachedDraft({ validationResult: { valid: true }, quality: { needsRepair: false } }),
  false,
  "an approved draft remains reusable without another model call"
);
session.collectedFacts.agentOutputCache = { key, output: parsed.data };

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
  initialGenerationSucceeded: false,
  repairAttempted: false,
  repairSucceeded: false,
  aiCalls: 0,
  qualityFailureRules: [],
  failedSections: [],
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

const qualityFacts = {
  personalInfo: { major: "Information Technology", studentStatus: "graduate" },
  projects: [{ id: "project-1", title: "QA Project", description: "Tracked student tasks in Microsoft Excel." }],
  skills: ["Microsoft Excel"],
};
const invalidProjectDraft = {
  ...draft,
  projects: [{ ...draft.projects[0], bullets: [] }],
};
const failedQuality = runProfessionalQualityGate({ draft: invalidProjectDraft, verifiedFacts: qualityFacts, language: "en" });
assert.strictEqual(getRepairSectionForQuality({ quality: failedQuality, draft: invalidProjectDraft, language: "en" }), "projects");
const repairedProjectDraft = mergeQualityRepair({
  draft: invalidProjectDraft,
  expectedSection: "projects",
  repair: {
    sectionKey: "projects",
    projects: [{ ...invalidProjectDraft.projects[0], bullets: ["Tracked student tasks in Microsoft Excel."] }],
  },
});
assert.strictEqual(
  runProfessionalQualityGate({ draft: repairedProjectDraft, verifiedFacts: qualityFacts, language: "en" }).needsRepair,
  false,
  "a project-only repair clears the failed quality rule without regenerating other sections"
);
const repairedOutput = resumeAgentOutputSchema.parse({ ...validOutput, draft: repairedProjectDraft });
const repairedSession = {
  ...session,
  collectedFacts: { ...session.collectedFacts, agentOutputCache: { key, output: repairedOutput } },
};
assert.strictEqual(
  getReusableDraftOutput(repairedSession, key)?.draft.projects[0].bullets.length,
  1,
  "a repaired draft replaces the reusable cache so refresh does not call the model again"
);
const summaryOnlyQuality = {
  needsRepair: false,
  errors: [],
  warnings: ["generic_summary"],
};
assert.strictEqual(
  getRepairSectionForQuality({ quality: summaryOnlyQuality, draft, language: "en" }),
  "",
  "a generic summary is a warning and does not trigger an extra AI repair"
);
assert.strictEqual(
  mergeQualityRepair({
    draft,
    expectedSection: "summary",
    repair: { sectionKey: "summary", professionalSummary: "Information Technology Graduate with documented project experience." },
  }).projects,
  draft.projects,
  "a summary repair leaves project content untouched"
);
const repairInput = JSON.parse(buildQualityRepairInput({
  sectionKey: "projects",
  draft: invalidProjectDraft,
  verifiedResumeFacts: qualityFacts,
  quality: failedQuality,
  language: "en",
}));
assert.deepStrictEqual(Object.keys(repairInput.failedSection), ["projects"], "repair input contains only the failed section");
assert.throws(
  () => mergeQualityRepair({ draft, expectedSection: "summary", repair: { sectionKey: "projects", projects: [] } }),
  /unexpected section/i,
  "an unexpected repair response never overwrites another section"
);

console.log("resumeAgentGenerationRecovery tests passed");
