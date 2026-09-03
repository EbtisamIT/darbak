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
    summary: "طالب علوم حاسب لديه خبرة تطبيقية من خلال مشاريع في تطبيقات الويب ومعالجة النصوص العربية. طوّر نظامًا لإدارة المواعيد ونموذجًا أوليًا لتصنيف النصوص. يركز على بناء حلول برمجية عملية.",
  }),
  fixture({
    language: "ar", status: "graduate", major: "تقنية المعلومات",
    experiences: [{ id: "e1", title: "متدرب تقنية معلومات", organization: "شركة مثال", description: "دعم العمليات التقنية وإعداد التقارير." }],
    summary: "خريج تقنية معلومات لديه خبرة تدريبية في دعم العمليات التقنية وإعداد التقارير. عمل خلال التدريب على تنظيم المهام التشغيلية ومتابعتها. يركز على تطوير حلول تقنية عملية.",
  }),
  fixture({
    language: "ar", status: "student", major: "إدارة الأعمال",
    projects: [{ id: "p1", title: "دراسة رضا العملاء", description: "دراسة أكاديمية عن رضا العملاء." }],
    summary: "طالب إدارة أعمال لديه تجربة أكاديمية في دراسة رضا العملاء. عمل على تنظيم وتحليل عناصر الدراسة. مهتم بفرص تساعده على تطوير خبرته العملية في إدارة الأعمال.",
  }),
  fixture({
    language: "ar", status: "student", major: "المحاسبة",
    summary: "طالب محاسبة يدرس أساسيات المجال الأكاديمية. مهتم بفرص تساعده على بناء خبرة عملية في المحاسبة.",
  }),
  fixture({
    language: "ar", status: "graduate", major: "نظم المعلومات",
    experiences: [{ id: "e1", title: "متدرب نظم معلومات", organization: "شركة مثال", description: "متابعة بيانات الأنظمة." }],
    summary: "خريج نظم معلومات لديه خبرة تدريبية في متابعة بيانات الأنظمة. عمل على دعم المهام المرتبطة بتنظيم المعلومات. يركز على تطوير حلول رقمية عملية.",
  }),
  fixture({
    language: "en", status: "student", major: "Computer Science",
    projects: [{ id: "p1", title: "Appointment System", description: "Web application for appointments." }, { id: "p2", title: "Text Classifier", description: "Arabic text classification prototype." }],
    skills: ["Python", "React.js"],
    summary: "Computer Science Student with practical project experience in web applications and Arabic text processing. Built an appointment management system and a text classification prototype. Focuses on building practical software solutions.",
  }),
  fixture({
    language: "en", status: "graduate", major: "Information Technology",
    experiences: [{ id: "e1", title: "IT Intern", organization: "Example Co", description: "Supported technical operations." }],
    summary: "Information Technology Graduate with internship experience supporting technical operations. Contributed to organizing operational tasks and reports during the internship. Focuses on practical technology solutions.",
  }),
  fixture({
    language: "en", status: "graduate", major: "Accounting",
    experiences: [{ id: "e1", title: "Accounting Intern", organization: "Example Co", description: "Reviewed invoices and prepared expense files." }],
    summary: "Accounting Graduate with internship experience reviewing invoices and preparing expense files. Supported day-to-day financial administration during the internship. Focuses on practical financial reporting and analysis.",
  }),
  fixture({
    language: "en", status: "student", major: "Business Administration",
    projects: [{ id: "p1", title: "Customer Satisfaction Study", description: "Academic customer satisfaction study." }],
    summary: "Business Administration Student with academic project experience in customer satisfaction research. Organized and analyzed the study inputs. Interested in practical business and customer-focused opportunities.",
  }),
  fixture({
    language: "en", status: "graduate", major: "Software Engineering",
    projects: [{ id: "p1", title: "Web Platform", description: "Web platform prototype." }],
    summary: "Software Engineering Graduate with practical project experience building web platforms. Developed a web platform prototype from documented project requirements. Focuses on building practical software products.",
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
