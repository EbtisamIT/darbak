const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  getResumeSourceFacts,
  getResumeFactsWritePayload,
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

console.log("resume architecture contract tests passed");
