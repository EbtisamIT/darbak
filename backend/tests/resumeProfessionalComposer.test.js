const assert = require("assert");
const {
  buildDeterministicHeadline,
  compactVerifiedResumeFacts,
  composeProfessionalDraft,
  runProfessionalQualityGate,
} = require("../services/resumeProfessionalComposer");

const facts = {
  personalInfo: {
    major: "Information Technology",
    studentStatus: "graduate",
    grammaticalGender: "feminine",
    degree: "Bachelor's",
    graduationYear: "2026",
  },
  education: [{ id: "edu-1", title: "Bachelor's", organization: "University of Jeddah", period: "2026", location: "Jeddah", description: "" }],
  experiences: [{ id: "exp-1", title: "IT Intern", organization: "Example Co", period: "2025", location: "Jeddah", description: "Supported technical operations." }],
  projects: [{ id: "project-1", title: "Student Portal", description: "Built a portal to organize student requests.", url: "" }],
  certifications: [],
  volunteering: [],
  languages: [{ name: "Arabic", level: "Native" }, { name: "English", level: "Advanced" }],
  skills: ["react js", "Git HUb", "UI/ UX", "Time managmaet"],
  professionalContext: "أحب إبراز مشروعي في بوابة الطلاب.",
};

assert.strictEqual(buildDeterministicHeadline(facts.personalInfo, "en"), "Information Technology Graduate");
assert.strictEqual(buildDeterministicHeadline(facts.personalInfo, "ar"), "خريجة Information Technology");

const composed = composeProfessionalDraft({
  language: "en",
  verifiedFacts: facts,
  draft: {
    targetTitle: "Intern",
    professionalSummary: "Information Technology Graduate with technical project experience.",
    education: [],
    experiences: [{ id: "exp-1", sourceId: "exp-1", title: "Wrong title", organization: "Wrong company", dates: "", location: "", bullets: ["Supported technical operations."] }],
    projects: [{ id: "project-1", sourceId: "project-1", name: "Student Portal", description: "", technologies: [], bullets: [], url: "" }],
    skills: [{ name: "React.js" }, { name: "GitHub" }, { name: "Communication" }],
    certifications: [],
    volunteering: [],
    languages: [],
    missingInformation: [],
    warnings: [],
    missingRequirements: [],
  },
});

assert.strictEqual(composed.targetTitle, "Information Technology Graduate");
assert.strictEqual(composed.experiences[0].organization, "Example Co");
assert.deepStrictEqual(composed.projects[0].bullets, ["Built a portal to organize student requests."]);
assert.deepStrictEqual(composed.skills.map((skill) => skill.name), ["React.js", "GitHub"]);
assert.strictEqual(composed.education[0].organization, "University of Jeddah");
assert.deepStrictEqual(composed.languages.map((language) => language.name), ["Arabic", "English"]);

const quality = runProfessionalQualityGate({ draft: composed, verifiedFacts: facts, language: "en" });
assert.strictEqual(quality.needsRepair, false);

const mixed = runProfessionalQualityGate({
  draft: { ...composed, professionalSummary: "Information Technology Graduate خريجة تقنية معلومات." },
  verifiedFacts: facts,
  language: "en",
});
assert.strictEqual(mixed.languageMixing, true);

const compact = compactVerifiedResumeFacts(facts, [{ fieldKey: "project_scope", answer: "Added request tracking." }]);
assert.strictEqual(compact.personalInfo.major, "Information Technology");
assert.strictEqual(compact.confirmedAnswers.length, 1);
assert.strictEqual(compact.professionalContext, "أحب إبراز مشروعي في بوابة الطلاب.");
assert.ok(!Object.prototype.hasOwnProperty.call(compact, "workflow"));

const copiedContext = runProfessionalQualityGate({
  draft: { ...composed, professionalSummary: facts.professionalContext },
  verifiedFacts: facts,
  language: "ar",
});
assert.strictEqual(copiedContext.needsRepair, true);

const resilientQuality = runProfessionalQualityGate({
  draft: { ...composed, projects: [...composed.projects, null], experiences: [...composed.experiences, null], skills: [...composed.skills, null] },
  verifiedFacts: { ...facts, projects: [...facts.projects, null], experiences: [...facts.experiences, null] },
  language: "en",
});
assert.strictEqual(resilientQuality.needsRepair, false, "optional malformed list entries cannot crash the quality gate");

console.log("resumeProfessionalComposer tests passed");
