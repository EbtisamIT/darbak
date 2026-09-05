const DEMO_APPLICANTS = Object.freeze([
  {
    id: "demo-sara-alotaibi",
    fullName: "سارة العتيبي",
    major: "نظم معلومات",
    university: "جامعة الملك سعود",
    email: "sara@example.com",
    status: "reviewing",
    isDemo: true,
  },
  {
    id: "demo-faisal-khaled",
    fullName: "فيصل خالد",
    major: "علوم حاسب",
    university: "جامعة الإمام محمد بن سعود الإسلامية",
    email: "faisal@example.com",
    status: "shortlisted",
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
} = {}) => {
  const real = Array.isArray(realApplicants) ? realApplicants : [];
  const hasRealApplicants = Number.isFinite(realApplicantCount)
    ? realApplicantCount > 0
    : real.length > 0;
  const demoMode = Boolean(demoEnabled) && !hasRealApplicants;
  const applicants = demoMode
    ? DEMO_APPLICANTS.map((applicant) => ({ ...applicant }))
    : real.map((applicant) => ({ ...applicant, isDemo: false }));

  return {
    demoMode,
    hasRealApplicants,
    applicants,
    metrics: demoMode ? getPortalMetrics(applicants) : realMetrics || getPortalMetrics(applicants),
  };
};

module.exports = {
  DEMO_APPLICANTS,
  buildCompanyPortalPresentation,
  getPortalMetrics,
  normalizePortalStatus,
};
