const DEMO_PROGRAM = Object.freeze({
  id: "demo-coop-program",
  opportunityTitle: "برنامج التدريب التعاوني — تجريبي",
  programType: "تدريب تعاوني",
  city: "الرياض",
  specialties: ["نظم المعلومات"],
  status: "demo",
  isDemo: true,
  applicationCount: 1,
});

const DEMO_APPLICANTS = Object.freeze([
  {
    id: "demo-sara-alotaibi",
    fullName: "سارة العتيبي",
    major: "نظم المعلومات",
    university: "جامعة الملك سعود",
    city: "الرياض",
    email: "sara@example.com",
    status: "new",
    submittedAt: "2026-01-15T09:30:00.000Z",
    answers: [
      { label: "الفصل التدريبي المتوقع", value: "صيف 2026" },
      { label: "سبب الاهتمام بالبرنامج", value: "أرغب بتطبيق مهارات نظم المعلومات في بيئة عمل فعلية." },
    ],
    internalNote: "مثال توضيحي فقط لرحلة مراجعة الطلبات داخل البوابة.",
    isDemo: true,
  },
]);

const normalizePortalStatus = (status = "") => {
  const value = String(status).trim();
  if (["new", "submitted"].includes(value)) return "new";
  if (["reviewing", "reviewed", "under_review"].includes(value)) return "reviewing";
  if (value === "shortlisted") return "shortlisted";
  if (["interview", "accepted", "rejected"].includes(value)) return value;
  return "new";
};

const getPortalMetrics = (applicants = []) =>
  applicants.reduce(
    (metrics, applicant) => {
      metrics.total += 1;
      const status = normalizePortalStatus(applicant.status);
      if (status === "new") metrics.new += 1;
      if (status === "reviewing") metrics.reviewing += 1;
      if (status === "shortlisted") metrics.shortlisted += 1;
      return metrics;
    },
    { total: 0, new: 0, reviewing: 0, shortlisted: 0 }
  );

const buildCompanyPortalPresentation = ({
  demoEnabled = false,
  realApplicants = [],
  realApplicantCount,
  realMetrics,
  realProgramCount = 0,
} = {}) => {
  const real = Array.isArray(realApplicants) ? realApplicants : [];
  const hasRealApplicants = Number.isFinite(realApplicantCount)
    ? realApplicantCount > 0
    : real.length > 0;
  const hasRealPrograms = Number(realProgramCount) > 0;
  const demoMode = Boolean(demoEnabled) && !hasRealApplicants && !hasRealPrograms;
  const applicants = demoMode
    ? DEMO_APPLICANTS.map((applicant) => ({ ...applicant }))
    : real.map((applicant) => ({ ...applicant, isDemo: false }));

  return {
    demoMode,
    hasRealApplicants,
    hasRealPrograms,
    applicants,
    programs: demoMode ? [{ ...DEMO_PROGRAM }] : [],
    metrics: demoMode ? getPortalMetrics(applicants) : realMetrics || getPortalMetrics(applicants),
  };
};

module.exports = {
  DEMO_PROGRAM,
  DEMO_APPLICANTS,
  buildCompanyPortalPresentation,
  getPortalMetrics,
  normalizePortalStatus,
};
