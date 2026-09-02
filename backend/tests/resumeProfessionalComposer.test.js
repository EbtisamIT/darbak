const assert = require("assert");
const {
  buildDeterministicHeadline,
  compactVerifiedResumeFacts,
  composeProfessionalDraft,
  getEvidenceStrength,
  runProfessionalQualityGate,
  getQualityFailureSections,
} = require("../services/resumeProfessionalComposer");
const { createAgentInstructions } = require("../agents/darbakResumeAgent");

const assertArabicProfessionalWriting = ({ summary, bullets = [], skills = [] }) => {
  const bannedPhrases = /تشمل المهارات|تتضمن الخبرات|يمتلك أساسًا في|خلفية أكاديمية ضمن|تطبيق عملي من خلال|تشمل القدرات المثبتة|شغوف|طموح|متميز|سريع التعلم|قادر على العمل تحت الضغط|بيئة ديناميكية/u;
  assert.ok(!bannedPhrases.test(summary), `summary must avoid generic Arabic filler: ${summary}`);
  assert.ok(summary.split(/[.!؟]/u).filter(Boolean).length >= 2, "Arabic summary keeps a concise professional structure");
  assert.ok(summary.split(/[.!؟]/u).filter(Boolean).length <= 3, "Arabic summary is not overlong");
  assert.ok(bullets.every((bullet) => !/المسؤول عن/u.test(bullet)), "Arabic bullets avoid مسؤول عن");
  assert.ok(skills.filter((skill) => summary.includes(skill)).length <= 2, "Arabic summary does not repeat the skills list");
};

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
const reconciledExperiences = composeProfessionalDraft({
    language: "en",
    verifiedFacts: facts,
    draft: {
      ...composed,
      experiences: [{ sourceId: "unknown-experience", title: "Unverified role", organization: "Unknown Co", dates: "", location: "", bullets: [] }],
    },
  }).experiences;
assert.strictEqual(reconciledExperiences.length, 1, "a student's verified experience is never omitted");
assert.strictEqual(reconciledExperiences[0].title, "IT Intern");
assert.strictEqual(reconciledExperiences[0].organization, "Example Co");
assert.deepStrictEqual(reconciledExperiences[0].bullets, ["Supported technical operations."]);
assert.deepStrictEqual(composed.projects[0].bullets, ["Built a portal to organize student requests."]);
assert.deepStrictEqual(composed.skills.map((skill) => skill.name), ["React.js", "GitHub"]);
assert.strictEqual(composed.education[0].organization, "University of Jeddah");
assert.deepStrictEqual(composed.languages.map((language) => language.name), ["Arabic", "English"]);

const quality = runProfessionalQualityGate({ draft: composed, verifiedFacts: facts, language: "en" });
assert.strictEqual(quality.needsRepair, false);

const classifierFacts = {
  ...facts,
  projects: [{
    id: "arabic-classifier",
    title: "Arabic Text Classifier",
    description: "Prototype for Arabic text classification.",
    url: "",
  }],
  skills: ["Python", "Text Processing"],
};
const classifierDraft = composeProfessionalDraft({
  language: "en",
  verifiedFacts: classifierFacts,
  draft: {
    ...composed,
    projects: [{
      sourceId: "arabic-classifier",
      name: "Arabic Text Classifier",
      description: "",
      technologies: ["Python", "Text Processing"],
      bullets: [
        "Built a prototype to classify Arabic text into categories.",
        "Used Python and text processing techniques to implement the classification workflow.",
        "Developed an Arabic text classification prototype using Python and text processing.",
      ],
    }],
    skills: [{ name: "Python" }, { name: "Text Processing" }],
  },
});
assert.deepStrictEqual(
  classifierDraft.projects[0].bullets,
  [
    "Built a prototype to classify Arabic text into categories.",
    "Used Python and text processing techniques to implement the classification workflow.",
  ],
  "project bullets retain distinct build and method dimensions while dropping a semantic repeat"
);

const arabicClassifierDraft = composeProfessionalDraft({
  language: "ar",
  verifiedFacts: {
    ...classifierFacts,
    projects: [{ id: "arabic-classifier", title: "مصنف النصوص العربية", description: "نموذج أولي لتصنيف النصوص العربية.", url: "" }],
  },
  draft: {
    ...composed,
    projects: [{
      sourceId: "arabic-classifier",
      name: "مصنف النصوص العربية",
      description: "",
      technologies: ["Python"],
      bullets: [
        "بناء نموذج أولي لتصنيف النصوص العربية.",
        "استخدام Python وتقنيات معالجة النصوص لتنفيذ آلية التصنيف.",
        "تطوير نموذج أولي لتصنيف النصوص العربية باستخدام Python.",
      ],
    }],
    skills: [{ name: "Python" }],
  },
});
assert.deepStrictEqual(
  arabicClassifierDraft.projects[0].bullets,
  [
    "بناء نموذج أولي لتصنيف النصوص العربية.",
    "استخدام Python وتقنيات معالجة النصوص لتنفيذ آلية التصنيف.",
  ],
  "Arabic project bullets use the same distinct-dimension rule"
);

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
assert.strictEqual(copiedContext.needsRepair, false, "a weak copied context is a warning, not a blocked resume");
assert.deepStrictEqual(copiedContext.warnings, ["professional_context_copied_as_summary"]);

const headlineConflict = runProfessionalQualityGate({
  draft: { ...composed, targetTitle: "Intern" },
  verifiedFacts: facts,
  language: "en",
});
assert.strictEqual(headlineConflict.needsRepair, false, "headline conflicts are corrected by the deterministic composer");
assert.deepStrictEqual(headlineConflict.autoFixes, ["headline_conflict"]);

const unsupportedSkill = runProfessionalQualityGate({
  draft: { ...composed, skills: [...composed.skills, { name: "Invented Skill" }] },
  verifiedFacts: facts,
  language: "en",
});
assert.strictEqual(unsupportedSkill.needsRepair, true, "an unsupported skill remains a safe hard failure");

const resilientQuality = runProfessionalQualityGate({
  draft: { ...composed, projects: [...composed.projects, null], experiences: [...composed.experiences, null], skills: [...composed.skills, null] },
  verifiedFacts: { ...facts, projects: [...facts.projects, null], experiences: [...facts.experiences, null] },
  language: "en",
});
assert.strictEqual(resilientQuality.needsRepair, false, "optional malformed list entries cannot crash the quality gate");

const missingProjectBullet = runProfessionalQualityGate({
  draft: { ...composed, projects: [{ ...composed.projects[0], bullets: [] }] },
  verifiedFacts: facts,
  language: "en",
});
assert.deepStrictEqual(getQualityFailureSections(missingProjectBullet.errors), ["projects"]);

const omittedProject = runProfessionalQualityGate({
  draft: { ...composed, projects: [] },
  verifiedFacts: facts,
  language: "en",
});
assert.strictEqual(omittedProject.needsRepair, false, "project selection is allowed; only a rendered project with a source description needs a bullet");

const properNoun = runProfessionalQualityGate({
  draft: {
    targetTitle: "Information Technology Graduate",
    professionalSummary: "Information Technology Graduate with experience at جامعة جدة.",
    education: [], experiences: [], projects: [], skills: [], certifications: [], volunteering: [], languages: [],
  },
  verifiedFacts: {
    personalInfo: { major: "Information Technology", studentStatus: "graduate" },
    education: [], projects: [], skills: [],
    experiences: [{ id: "exp-ar", title: "IT Intern", organization: "جامعة جدة", period: "2025", description: "" }],
  },
  language: "en",
});
assert.strictEqual(properNoun.languageMixing, false, "a verified Arabic proper noun does not fail an English resume");

// Arabic writer contract fixtures: these mock the structured Terra response.
// The composer must preserve concise professional wording while continuing to
// enforce deterministic identity and the student's verified facts.
const arabicCsStudent = {
  personalInfo: { major: "علوم الحاسب", studentStatus: "student", grammaticalGender: "masculine" },
  education: [],
  experiences: [],
  projects: [
    { id: "cs-project-1", title: "نظام إدارة المواعيد", description: "تطبيق ويب يتيح حجز المواعيد وتعديلها وإلغائها مع لوحة إدارة.", url: "" },
    { id: "cs-project-2", title: "تصنيف النصوص العربية", description: "نموذج أولي لتصنيف النصوص العربية.", url: "" },
  ],
  skills: ["Python", "React.js", "Node.js", "MongoDB", "Git", "REST APIs"],
};
const arabicCsDraft = composeProfessionalDraft({
  language: "ar",
  verifiedFacts: arabicCsStudent,
  draft: {
    professionalSummary: "طالب علوم حاسب طوّر مشاريع في تطبيقات الويب ومعالجة النصوص العربية. بنى نظامًا لإدارة المواعيد ونموذجًا أوليًا لتصنيف النصوص، مع تركيز على حلول برمجية عملية.",
    experiences: [],
    projects: [
      { sourceId: "cs-project-1", name: "نظام إدارة المواعيد", description: "", bullets: ["تطوير تطبيق ويب يتيح حجز المواعيد وتعديلها وإلغائها.", "إنشاء لوحة إدارة لمتابعة المواعيد وإدارتها."], technologies: ["React.js", "Node.js"], url: "" },
      { sourceId: "cs-project-2", name: "تصنيف النصوص العربية", description: "", bullets: ["بناء نموذج أولي لتصنيف النصوص العربية."], technologies: ["Python"], url: "" },
    ],
    skills: arabicCsStudent.skills,
  },
});
assert.strictEqual(arabicCsDraft.targetTitle, "طالب علوم الحاسب");
assertArabicProfessionalWriting({ summary: arabicCsDraft.professionalSummary, bullets: arabicCsDraft.projects.flatMap((project) => project.bullets), skills: arabicCsStudent.skills });
assert.ok(!arabicCsDraft.professionalSummary.includes("React.js") && !arabicCsDraft.professionalSummary.includes("Node.js"), "student summary prioritizes project evidence over tool listing");

const arabicAccountingGraduate = {
  personalInfo: { major: "المحاسبة", studentStatus: "graduate", grammaticalGender: "feminine" },
  education: [],
  experiences: [{ id: "acc-exp-1", title: "متدربة محاسبة", organization: "شركة مثال", period: "2025", location: "جدة", description: "مراجعة الفواتير وإدخال القيود وتجهيز ملفات المصروفات." }],
  projects: [{ id: "acc-project-1", title: "تحليل القوائم المالية", description: "تحليل النسب المالية ومقارنة الأداء بين سنتين.", url: "" }],
  skills: ["Microsoft Excel", "Financial Reporting", "Accounting"],
};
const arabicAccountingDraft = composeProfessionalDraft({
  language: "ar",
  verifiedFacts: arabicAccountingGraduate,
  draft: {
    professionalSummary: "خريجة محاسبة لديها خبرة تدريبية في مراجعة الفواتير وإدخال القيود وتجهيز ملفات المصروفات. دعمت الأعمال المالية اليومية وطبقت مهاراتها في تحليل القوائم المالية وإعداد التقارير.",
    experiences: [{ sourceId: "acc-exp-1", title: "متدربة محاسبة", organization: "شركة مثال", bullets: ["مراجعة الفواتير وإدخال القيود وتجهيز ملفات المصروفات.", "دعم تنظيم الأعمال المالية اليومية."], dates: "", location: "" }],
    projects: [{ sourceId: "acc-project-1", name: "تحليل القوائم المالية", description: "", bullets: ["تحليل النسب المالية ومقارنة الأداء بين سنتين."], technologies: ["Microsoft Excel"], url: "" }],
    skills: arabicAccountingGraduate.skills,
  },
});
assert.strictEqual(arabicAccountingDraft.targetTitle, "خريجة المحاسبة");
assertArabicProfessionalWriting({ summary: arabicAccountingDraft.professionalSummary, bullets: arabicAccountingDraft.experiences[0].bullets, skills: arabicAccountingGraduate.skills });
assert.ok(arabicAccountingDraft.professionalSummary.includes("خبرة تدريبية"), "graduate summary makes documented internship the strongest evidence");

const arabicBusinessStudent = {
  personalInfo: { major: "إدارة الأعمال", studentStatus: "student", grammaticalGender: "masculine" },
  education: [],
  experiences: [],
  projects: [{ id: "biz-project-1", title: "دراسة رضا العملاء", description: "دراسة أكاديمية عن رضا العملاء.", url: "" }],
  skills: ["Microsoft Excel"],
};
const arabicBusinessDraft = composeProfessionalDraft({
  language: "ar",
  verifiedFacts: arabicBusinessStudent,
  draft: {
    professionalSummary: "طالب إدارة أعمال لديه مشروع أكاديمي في دراسة رضا العملاء، مع اهتمام بتطوير فهم عملي لاحتياجات العملاء وتحليلها.",
    experiences: [],
    projects: [{ sourceId: "biz-project-1", name: "دراسة رضا العملاء", description: "", bullets: ["إعداد دراسة أكاديمية عن رضا العملاء."], technologies: [], url: "" }],
    skills: arabicBusinessStudent.skills,
  },
});
assert.strictEqual(arabicBusinessDraft.targetTitle, "طالب إدارة الأعمال");
assert.ok(arabicBusinessDraft.professionalSummary.split(/[.!؟]/u).filter(Boolean).length <= 2, "limited facts use a short summary instead of filler");
assert.ok(!/شغوف|طموح|متميز/u.test(arabicBusinessDraft.professionalSummary));

const strongPositioningFacts = {
  personalInfo: { major: "علوم الحاسب", studentStatus: "student", grammaticalGender: "masculine" },
  education: [],
  experiences: [],
  projects: [
    { id: "strong-1", title: "تطبيق ويب", description: "تطبيق لإدارة المواعيد.", url: "" },
    { id: "strong-2", title: "منصة طلابية", description: "منصة لتنظيم طلبات الطلاب.", url: "" },
  ],
  skills: ["React.js", "Node.js"],
};
const strongPositioningDraft = composeProfessionalDraft({
  language: "ar",
  verifiedFacts: strongPositioningFacts,
  draft: { professionalSummary: "طالب علوم حاسب بنى مشاريع تطبيقية في الويب. يتجه نحو تطوير البرمجيات وتطبيقات الويب باستخدام React.js وNode.js.", experiences: [], projects: [], skills: [] },
});
assert.strictEqual(getEvidenceStrength(strongPositioningFacts), "strong");
assert.ok(!/يتجه نحو|يسعى إلى|يطمح إلى/u.test(strongPositioningDraft.professionalSummary), "strong evidence uses direct positioning");
assert.ok(strongPositioningDraft.professionalSummary.includes("يركز على تطوير البرمجيات"));

const moderatePositioningFacts = {
  personalInfo: { major: "نظم المعلومات", studentStatus: "student", grammaticalGender: "feminine" },
  education: [],
  experiences: [],
  projects: [{ id: "moderate-1", title: "لوحة بيانات", description: "لوحة لعرض البيانات.", url: "" }],
  skills: ["Power BI"],
};
const moderatePositioningDraft = composeProfessionalDraft({
  language: "ar",
  verifiedFacts: moderatePositioningFacts,
  draft: { professionalSummary: "طالبة نظم معلومات لديها مشروع في عرض البيانات. تهتم بتطوير خبرتها في تحليل البيانات.", experiences: [], projects: [], skills: [] },
});
assert.strictEqual(getEvidenceStrength(moderatePositioningFacts), "moderate");
assert.ok(moderatePositioningDraft.professionalSummary.includes("تهتم بتطوير خبرتها"), "moderate evidence keeps an appropriately measured direction");

const limitedPositioningFacts = {
  personalInfo: { major: "إدارة الأعمال", studentStatus: "student", grammaticalGender: "masculine" },
  education: [],
  experiences: [],
  projects: [],
  skills: [],
};
const limitedPositioningDraft = composeProfessionalDraft({
  language: "ar",
  verifiedFacts: limitedPositioningFacts,
  draft: { professionalSummary: "طالب إدارة أعمال. مهتم بفرص في الأعمال الإدارية.", experiences: [], projects: [], skills: [] },
});
assert.strictEqual(getEvidenceStrength(limitedPositioningFacts), "limited");
assert.ok(limitedPositioningDraft.professionalSummary.includes("مهتم بفرص في"), "limited evidence does not overstate experience");

const technicalWriterCleanup = composeProfessionalDraft({
  language: "en",
  verifiedFacts: {
    personalInfo: { major: "Computer Science", studentStatus: "student" },
    education: [],
    experiences: [],
    projects: [{ id: "tech-project-1", title: "Web Application", description: "Built a web application.", url: "" }],
    certifications: [],
    volunteering: [],
    languages: [],
    skills: ["FireBase", "figma", "react.js", "node.js", "github", "power bi", "microsoft excel"],
  },
  draft: {
    professionalSummary: "Computer Science Student with documented skills in FireBase and figma. Based on available information, built web applications with verified capabilities in react.js and node.js. Computer Science Student with documented skills in FireBase and figma.",
    experiences: [],
    projects: [{ sourceId: "tech-project-1", name: "Web Application", description: "", bullets: ["Built a web application with documented skills in react.js."], technologies: ["FireBase", "figma", "react.js", "node.js"], url: "" }],
    skills: ["FireBase", "figma", "react.js", "node.js", "github", "power bi", "microsoft excel"],
  },
});
assert.deepStrictEqual(technicalWriterCleanup.skills.map((skill) => skill.name), ["Firebase", "Figma", "React.js", "Node.js", "GitHub", "Power BI", "Microsoft Excel"]);
assert.ok(!/في نطاق المهارات الموثقة|بحسب المعلومات المتاحة|وفق البيانات المقدمة|القدرات المثبتة|المعلومات الموثقة/u.test(technicalWriterCleanup.professionalSummary));
assert.ok(!/documented skills|verified skills|verified capabilities|based on available information|according to provided data/iu.test(technicalWriterCleanup.professionalSummary));
assert.ok(!/documented skills/iu.test(technicalWriterCleanup.projects[0].bullets[0]));
assert.ok(technicalWriterCleanup.professionalSummary.includes("practical experience using"), "English summary replaces validator language with professional wording");
assert.strictEqual((technicalWriterCleanup.professionalSummary.match(/Computer Science Student/g) || []).length, 1, "summary removes repeated ideas and stays concise");

const instructions = createAgentInstructions();
assert.ok(instructions.includes("قواعد الكتابة العربية المهنية"), "writer prompt contains the Arabic professional-writing contract");
assert.ok(instructions.includes("لا تحوّل النبذة إلى قائمة Skills"), "writer prompt prevents skill-list prose");

console.log("resumeProfessionalComposer tests passed");
