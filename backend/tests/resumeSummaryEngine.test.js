const assert = require("assert");
const {
  buildProfessionalSummaryPayload,
  validateProfessionalSummary,
} = require("../agents/darbakResumeAgent");
const { composeProfessionalDraft } = require("../services/resumeProfessionalComposer");
const { mapDraftToResumePayload } = require("../services/resumeAiService");

const quality = {
  hasIdentity: true,
  hasEvidence: true,
  hasClearPositioning: true,
  hasGenericFiller: false,
  hasRepeatedIdeas: false,
  hasUnsupportedClaim: false,
  hasExcessiveToolListing: false,
  naturalLanguage: true,
  evidenceLinkedTools: true,
  noGenericClosing: true,
  everySentenceAddsValue: true,
  closingAddsNewValue: true,
  closingIsEvidenceLinked: true,
};

const fixture = ({ language, status, major, summary, experiences = [], projects = [], skills = [] }) => ({
  language,
  facts: {
    personalInfo: { studentStatus: status, major },
    education: [{ organization: language === "ar" ? "جامعة الملك خالد" : "King Khalid University" }],
    experiences,
    projects,
    skills,
  },
  result: { summary, quality },
});

const fixtures = [
  fixture({
    language: "ar", status: "student", major: "علوم الحاسب",
    projects: [{ id: "p1", title: "نظام مواعيد", description: "تطبيق لإدارة المواعيد." }, { id: "p2", title: "مصنف نصوص", description: "نموذج لتصنيف النصوص العربية." }],
    skills: ["Python", "React.js"],
    summary: "طالب علوم حاسب لديه خبرة تطبيقية من خلال مشاريع في تطبيقات الويب ومعالجة النصوص العربية. طوّر نظامًا لإدارة المواعيد ونموذجًا أوليًا لتصنيف النصوص. يوظف خبرته في تطوير تطبيقات الويب لبناء حلول برمجية عملية.",
  }),
  fixture({
    language: "ar", status: "graduate", major: "تقنية المعلومات",
    experiences: [{ id: "e1", title: "متدرب تقنية معلومات", organization: "شركة مثال", description: "دعم العمليات التقنية وإعداد التقارير." }],
    summary: "خريج تقنية معلومات لديه خبرة تدريبية في دعم العمليات التقنية وإعداد التقارير. عمل خلال التدريب على تنظيم المهام التشغيلية ومتابعتها.",
  }),
  fixture({
    language: "ar", status: "student", major: "إدارة الأعمال",
    projects: [{ id: "p1", title: "دراسة رضا العملاء", description: "دراسة أكاديمية عن رضا العملاء." }],
    summary: "طالب إدارة أعمال لديه تجربة أكاديمية في دراسة رضا العملاء. عمل على تنظيم وتحليل عناصر الدراسة. يوظف نتائج الدراسة في فهم احتياجات العملاء ضمن فرص الأعمال العملية.",
  }),
  fixture({
    language: "ar", status: "student", major: "المحاسبة",
    summary: "طالب محاسبة يدرس أساسيات المجال الأكاديمية. مهتم بفرص يطبق فيها ما يتعلمه في المحاسبة.",
  }),
  fixture({
    language: "ar", status: "graduate", major: "نظم المعلومات",
    experiences: [{ id: "e1", title: "متدرب نظم معلومات", organization: "شركة مثال", description: "متابعة بيانات الأنظمة." }],
    summary: "خريج نظم معلومات لديه خبرة تدريبية في متابعة بيانات الأنظمة. عمل على دعم المهام المرتبطة بتنظيم المعلومات.",
  }),
  fixture({
    language: "en", status: "student", major: "Computer Science",
    projects: [{ id: "p1", title: "Appointment System", description: "Web application for appointments." }, { id: "p2", title: "Text Classifier", description: "Arabic text classification prototype." }],
    skills: ["Python", "React.js"],
    summary: "Computer Science Student with practical project experience in web applications and Arabic text processing. Built an appointment management system and a text classification prototype. Applies web development experience to build practical software solutions.",
  }),
  fixture({
    language: "en", status: "graduate", major: "Information Technology",
    experiences: [{ id: "e1", title: "IT Intern", organization: "Example Co", description: "Supported technical operations." }],
    summary: "Information Technology Graduate with internship experience supporting technical operations. Contributed to organizing operational tasks and reports during the internship.",
  }),
  fixture({
    language: "en", status: "graduate", major: "Accounting",
    experiences: [{ id: "e1", title: "Accounting Intern", organization: "Example Co", description: "Reviewed invoices and prepared expense files." }],
    summary: "Accounting Graduate with internship experience reviewing invoices and preparing expense files. Supported day-to-day financial administration during the internship.",
  }),
  fixture({
    language: "en", status: "student", major: "Business Administration",
    projects: [{ id: "p1", title: "Customer Satisfaction Study", description: "Academic customer satisfaction study." }],
    summary: "Business Administration Student with academic project experience in customer satisfaction research. Organized and analyzed the study inputs. Applies customer research to support practical business analysis.",
  }),
  fixture({
    language: "en", status: "graduate", major: "Software Engineering",
    projects: [{ id: "p1", title: "Web Platform", description: "Web platform prototype." }],
    summary: "Software Engineering Graduate with practical project experience building web platforms. Developed a web platform prototype from project requirements. Applies web development experience to build practical software products.",
  }),
];

fixtures.forEach((entry, index) => {
  const payload = buildProfessionalSummaryPayload({ verifiedResumeFacts: entry.facts, language: entry.language });
  const validation = validateProfessionalSummary({ result: entry.result, payload });
  assert.deepStrictEqual(validation.errors, [], `fixture ${index + 1} produces a concise, evidence-based summary`);
  assert.ok(payload.strongestEvidence.length <= 2, "Summary payload stays compact");
});

const generic = fixtures[0];
const genericPayload = buildProfessionalSummaryPayload({ verifiedResumeFacts: generic.facts, language: "ar" });
const genericValidation = validateProfessionalSummary({
  result: { summary: "طالب شغوف يسعى إلى تطوير خبرته في بيئة ديناميكية.", quality },
  payload: genericPayload,
});
assert.ok(genericValidation.errors.includes("summary_banned_phrase"), "generic filler is rejected deterministically");

const mixedLanguage = fixtures[5];
const mixedPayload = buildProfessionalSummaryPayload({ verifiedResumeFacts: mixedLanguage.facts, language: "en" });
const mixedValidation = validateProfessionalSummary({
  result: { summary: "Computer Science Student لديه practical project experience.", quality },
  payload: mixedPayload,
});
assert.ok(mixedValidation.errors.includes("summary_language_mixing"), "English summary cannot contain Arabic prose");

const faisalAr = fixtures[0];
const faisalArPayload = buildProfessionalSummaryPayload({ verifiedResumeFacts: faisalAr.facts, language: "ar" });
assert.strictEqual(faisalArPayload.evidenceStrength, "strong", "Faisal Arabic fixture has strong project evidence");
assert.ok(
  validateProfessionalSummary({
    result: {
      summary: "طالب علوم حاسب لديه خبرة تطبيقية من خلال مشاريع في تطبيقات الويب. طوّر نظامًا لإدارة المواعيد ونموذجًا أوليًا لتصنيف النصوص. يركز على تطوير خبرته في تطوير البرمجيات.",
      quality,
    },
    payload: faisalArPayload,
  }).errors.includes("summary_tentative_positioning"),
  "strong Arabic evidence rejects tentative positioning"
);

const faisalEn = fixtures[5];
const faisalEnPayload = buildProfessionalSummaryPayload({ verifiedResumeFacts: faisalEn.facts, language: "en" });
assert.strictEqual(faisalEnPayload.evidenceStrength, "strong", "Faisal English fixture has strong project evidence");
assert.ok(
  validateProfessionalSummary({
    result: {
      summary: "Computer Science Student with practical project experience in web applications. Built an appointment management system and a text classification prototype. Focused on building experience in software development and web applications.",
      quality,
    },
    payload: faisalEnPayload,
  }).errors.includes("summary_tentative_positioning"),
  "strong English evidence rejects tentative positioning"
);

const genericToolLinking = validateProfessionalSummary({
  result: {
    summary: "Computer Science Student with practical project experience. Uses web development tools such as React.js and Node.js to build practical digital solutions.",
    quality: {
      ...quality,
      evidenceLinkedTools: false,
      noGenericClosing: false,
      everySentenceAddsValue: false,
    },
  },
  payload: faisalEnPayload,
});
assert.ok(genericToolLinking.errors.includes("summary_tools_not_evidence_linked"), "generic tool lists fail editorial review");
assert.ok(genericToolLinking.errors.includes("summary_generic_closing"), "generic closing fails editorial review");

const saraPayload = buildProfessionalSummaryPayload({
  language: "ar",
  verifiedResumeFacts: {
    personalInfo: { studentStatus: "student", major: "نظم المعلومات الإدارية" },
    projects: [{ id: "power-bi", title: "تحليل أعمال", description: "مشروع Power BI لتحليل بيانات الأعمال." }],
    skills: ["Power BI"],
  },
});
const saraClosing = "طالبة نظم المعلومات الإدارية لديها تجربة تطبيقية في تحليل الأعمال والبيانات. طوّرت مشروعًا باستخدام Power BI لتحليل بيانات الأعمال. توظف تحليل الأعمال والبيانات في تطوير حلول رقمية عملية.";
assert.deepStrictEqual(
  validateProfessionalSummary({ result: { summary: saraClosing, quality }, payload: saraPayload }).errors,
  [],
  "Sara uses an evidence-linked value closing",
);

const genericClosing = validateProfessionalSummary({
  result: {
    summary: "طالبة نظم المعلومات الإدارية لديها تجربة تطبيقية في تحليل الأعمال. طوّرت مشروعًا باستخدام Power BI. تركز على تطوير حلول رقمية عملية.",
    quality,
  },
  payload: saraPayload,
});
assert.ok(genericClosing.errors.includes("summary_generic_closing"), "generic direction-only closing is rejected");

const saraEnglishPayload = buildProfessionalSummaryPayload({
  language: "en",
  verifiedResumeFacts: {
    personalInfo: { studentStatus: "student", major: "Management Information Systems" },
    projects: [{ id: "power-bi", title: "Business Analysis", description: "Power BI project for business data analysis." }],
    skills: ["Power BI"],
  },
});
const saraEnglishClosing = "Management Information Systems Student with hands-on project experience in business and data analysis. Built a Power BI project to analyze business data. Applies business and data analysis to build practical digital solutions.";
assert.deepStrictEqual(
  validateProfessionalSummary({ result: { summary: saraEnglishClosing, quality }, payload: saraEnglishPayload }).errors,
  [],
  "Sara English uses an evidence-linked value closing",
);
assert.ok(fixtures[0].result.summary.includes("يوظف خبرته"), "Faisal uses a direct evidence-linked Arabic closing");
assert.ok(fixtures[3].result.summary.includes("مهتم بفرص يطبق فيها"), "limited evidence keeps a measured closing");

const solMarker = "SOL_V3_SUMMARY_MARKER";
const markerFacts = {
  personalInfo: {
    fullName: "QA Candidate",
    major: "Computer Science",
    studentStatus: "student",
  },
  education: [],
  experiences: [],
  projects: [],
  certifications: [],
  volunteering: [],
  languages: [],
  skills: [],
};
const composedMarkerDraft = composeProfessionalDraft({
  language: "en",
  verifiedFacts: markerFacts,
  preserveSummary: true,
  draft: {
    professionalSummary: solMarker,
    experiences: [],
    projects: [],
    skills: [],
    certifications: [],
    volunteering: [],
    languages: [],
  },
});
assert.strictEqual(composedMarkerDraft.professionalSummary, solMarker, "Sol V3 summary survives the composer unchanged");
const mappedMarkerResume = mapDraftToResumePayload(
  composedMarkerDraft,
  { personalInfo: markerFacts.personalInfo, settings: {} },
  { basic: markerFacts.personalInfo },
  "en",
);
assert.strictEqual(mappedMarkerResume.summary, solMarker, "Sol V3 summary reaches the canonical master payload unchanged");

console.log("resumeSummaryEngine tests passed");
