const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  getResumeSourceFacts,
  getResumeFactsWritePayload,
  getCanonicalResumeExperiences,
  hasResumeProfileFacts,
  resolveResumeFactsOwnership,
  getArabicMasterPresentation,
  getEnglishPresentation,
} = require("../services/resumeArchitecture");

const mixedResume = {
  personalInfo: { fullName: "طالبة", major: "نظم المعلومات" },
  summary: "نبذة عربية معتمدة",
  projects: [{ id: "project-1", title: "مشروع", userSourceDescription: "حللت البيانات" }],
  skills: ["Power BI"],
  sectionOrder: ["summary", "projects", "skills"],
  settings: { language: "ar", direction: "rtl" },
  localizedDisplay: { entries: { "projects:project-1": { title: "Project" } } },
  summaryProvenance: { summaryWriterVersion: "v3" },
};

const facts = getResumeSourceFacts(mixedResume);
assert.deepStrictEqual(facts.personalInfo, mixedResume.personalInfo);
assert.deepStrictEqual(facts.projects, mixedResume.projects);
assert.deepStrictEqual(facts.skills, mixedResume.skills);
assert.strictEqual(facts.summary, undefined);
assert.strictEqual(facts.localizedDisplay, undefined);
assert.strictEqual(facts.settings, undefined);

const factsWrite = getResumeFactsWritePayload(mixedResume);
assert.deepStrictEqual(factsWrite, facts);

// `experiences` is the only canonical write field. The singular field remains
// accepted only when reading a legacy object.
const legacyExperience = [{ id: "legacy-exp", title: "Legacy internship" }];
assert.deepStrictEqual(getCanonicalResumeExperiences({ experience: legacyExperience }), legacyExperience);
assert.deepStrictEqual(getResumeFactsWritePayload({ experience: legacyExperience }), {
  experiences: legacyExperience,
});
assert.strictEqual(getResumeFactsWritePayload({ experience: legacyExperience }).experience, undefined);
assert.deepStrictEqual(
  getCanonicalResumeExperiences({ experiences: [{ id: "canonical" }], experience: legacyExperience }),
  [{ id: "canonical" }],
);

const resumeFacts = { personalInfo: { fullName: "طالبة" }, projects: [{ id: "resume-project" }] };
const portfolioFacts = { _id: "portfolio-legacy", projects: [{ id: "portfolio-project" }] };
assert.strictEqual(hasResumeProfileFacts(resumeFacts), true);
assert.deepStrictEqual(resolveResumeFactsOwnership(resumeFacts, portfolioFacts), {
  factsOwner: "resume",
  fallbackUsed: false,
  portfolio: {},
});
assert.deepStrictEqual(resolveResumeFactsOwnership({}, portfolioFacts), {
  factsOwner: "portfolio_legacy",
  fallbackUsed: true,
  portfolio: portfolioFacts,
});

const arabicPresentation = getArabicMasterPresentation(mixedResume);
assert.strictEqual(arabicPresentation.summary, mixedResume.summary);
assert.deepStrictEqual(arabicPresentation.sectionOrder, mixedResume.sectionOrder);
assert.strictEqual(arabicPresentation.localizedDisplay, undefined);

const englishPresentation = getEnglishPresentation(mixedResume);
assert.deepStrictEqual(englishPresentation.localizedDisplay, mixedResume.localizedDisplay);
assert.strictEqual(englishPresentation.summary, mixedResume.summary);

// Route-level contract locks: reads cannot write, and item-level English
// approval cannot touch ResumeProfile or the Arabic master.
const serverSource = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
const between = (start, end) => serverSource.slice(
  serverSource.indexOf(start),
  serverSource.indexOf(end, serverSource.indexOf(start)),
);
const masterReadRoute = between(
  "app.get('/api/resume/me'",
  "app.put('/api/resume/me'",
);
assert(!/ResumeProfile\.(?:findOneAndUpdate|updateOne|create)/.test(masterReadRoute));
assert(!/\.save\s*\(/.test(masterReadRoute));

const englishApprovalRoute = between(
  "app.patch('/api/resume/english/localizations/:key'",
  "app.put('/api/resume-agent/tailored-versions/:id'",
);
assert.strictEqual(
  (englishApprovalRoute.match(/ResumeTailoredVersion\.findOneAndUpdate/g) || []).length,
  1,
);
assert(!/ResumeProfile\.(?:findOneAndUpdate|updateOne|create)/.test(englishApprovalRoute));

const enrichmentPersistence = between(
  "const persistResumeEnrichmentUpdate",
  "const mergeResumeAgentUsage",
);
assert.strictEqual((enrichmentPersistence.match(/await resume\.save\(\)/g) || []).length, 1);
assert(/legacyPortfolio && structuredAnswers\.length/.test(enrichmentPersistence));
assert(!/portfolio\.save\s*\(/.test(enrichmentPersistence));
assert(!/source\.save\s*\(/.test(enrichmentPersistence));

const applicationPackFactsSave = between(
  "app.put('/api/resume-agent/tailored-versions/:id/application-pack'",
  "app.delete('/api/resume-agent/tailored-versions/:id'",
);
assert(!/Portfolio\.updateOne/.test(applicationPackFactsSave));
assert(/ResumeProfile\.updateOne/.test(applicationPackFactsSave));

console.log("resume architecture contract tests passed");
