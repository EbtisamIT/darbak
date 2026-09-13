const assert = require("assert");
const {
  buildProfessionalSummaryPayload,
  normalizeProfessionalSummaryOutput,
  validateProfessionalSummary,
} = require("../agents/darbakResumeAgent");

const cases = [
  {
    name: "information systems student with strong projects",
    facts: {
      personalInfo: { studentStatus: "student", major: "نظم المعلومات الإدارية" },
      projects: [
        { id: "dashboard", title: "لوحة المبيعات", description: "تحليل بيانات المبيعات عبر لوحة Power BI." },
        { id: "prototype", title: "نظام حجز", description: "تصميم نموذج واجهات لنظام حجز باستخدام Figma." },
      ],
      skills: ["Power BI", "Figma"],
    },
    current: "طالبة نظم المعلومات الإدارية لديها خبرة تطبيقية في تحليل البيانات وتصميم الحلول الرقمية. أنجزت لوحة مبيعات باستخدام Power BI وصممت نموذج واجهات لنظام حجز باستخدام Figma.",
    generic: "طالبة نظم المعلومات الإدارية لديها خبرة في المشاريع.",
    genericMustBeRejected: true,
  },
  {
    name: "business student with moderate evidence",
    facts: {
      personalInfo: { studentStatus: "student", major: "إدارة الأعمال" },
      projects: [
        { id: "customer-study", title: "دراسة رضا العملاء", description: "تحليل استبيان رضا العملاء وتصنيف أسباب عدم الرضا." },
      ],
      skills: ["تحليل البيانات"],
    },
    current: "طالب إدارة أعمال لديه تجربة تطبيقية في تحليل استبيانات رضا العملاء. حلل نتائج الاستبيان وصنف أبرز أسباب عدم الرضا لعرضها في تقرير.",
    generic: "طالب إدارة أعمال لديه خبرة في المشاريع.",
    genericMustBeRejected: false,
  },
  {
    name: "graduate with internship experience",
    facts: {
      personalInfo: { studentStatus: "graduate", major: "المحاسبة" },
      experiences: [
        { id: "internship", title: "متدرب محاسبة", organization: "شركة خدمات", description: "مراجعة الفواتير وإعداد ملفات المصروفات." },
      ],
      skills: ["المحاسبة", "Microsoft Excel"],
    },
    current: "خريج محاسبة لديه خبرة تدريبية في مراجعة الفواتير وتجهيز ملفات المصروفات. عمل على تنظيم المستندات المالية ودعم الأعمال المحاسبية اليومية.",
    generic: "خريج محاسبة لديه خبرة تدريبية.",
    genericMustBeRejected: false,
  },
];

const results = cases.map((entry) => {
  const payload = buildProfessionalSummaryPayload({ verifiedResumeFacts: entry.facts, language: "ar" });
  const currentValidation = validateProfessionalSummary({
    result: normalizeProfessionalSummaryOutput({ summary: entry.current }),
    payload,
  });
  const genericValidation = validateProfessionalSummary({
    result: normalizeProfessionalSummaryOutput({ summary: entry.generic }),
    payload,
  });

  assert.strictEqual(currentValidation.valid, true, `${entry.name}: current strong summary remains valid`);
  assert.strictEqual(
    genericValidation.valid,
    !entry.genericMustBeRejected,
    `${entry.name}: diagnostic expectation for generic output changed; reassess the production feature flag`,
  );

  return {
    name: entry.name,
    currentValid: currentValidation.valid,
    genericRejected: !genericValidation.valid,
    evidenceStrength: payload.evidenceStrength,
    evidenceThemes: payload.evidenceThemes,
  };
});

assert.ok(
  results.some((result) => !result.genericRejected),
  "the current deterministic guard is not globally safe, so Improve Summary must remain disabled",
);

console.log("resumeSummaryImprovementSafety diagnostic passed", results);
