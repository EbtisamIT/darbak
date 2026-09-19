const RESUME_SOURCE_FACT_KEYS = Object.freeze([
  "personalInfo",
  "education",
  "experiences",
  "projects",
  "certifications",
  "volunteering",
  "languages",
  "links",
  "skills",
]);

const hasOwn = (source = {}, key = "") =>
  Object.prototype.hasOwnProperty.call(source || {}, key);

// `experiences` is the canonical runtime/storage field. `experience` remains a
// read-only compatibility alias for documents written by older releases.
const getCanonicalResumeExperiences = (resume = {}) => {
  const source = typeof resume?.toObject === "function" ? resume.toObject() : resume;
  if (hasOwn(source, "experiences")) {
    return Array.isArray(source.experiences) ? source.experiences : [];
  }
  return Array.isArray(source.experience) ? source.experience : [];
};

const pickDefined = (source = {}, keys = []) => Object.fromEntries(
  keys
    .filter((key) => Object.prototype.hasOwnProperty.call(source || {}, key))
    .map((key) => [key, source[key]]),
);

// ResumeProfile currently stores facts and approved Arabic presentation in one
// document. These selectors establish ownership without moving historical data.
const getResumeSourceFacts = (resume = {}) => {
  const facts = pickDefined(resume, RESUME_SOURCE_FACT_KEYS);
  if (hasOwn(resume, "experiences") || hasOwn(resume, "experience")) {
    facts.experiences = getCanonicalResumeExperiences(resume);
  }
  return facts;
};

const getResumeFactsWritePayload = (sanitizedResume = {}) =>
  getResumeSourceFacts(sanitizedResume);

const hasResumeProfileFacts = (resume = {}) => {
  const facts = getResumeSourceFacts(resume);
  const personalInfo = facts.personalInfo || {};
  const hasPersonalFact = Object.values(personalInfo).some((value) =>
    Array.isArray(value) ? value.length > 0 : Boolean(String(value || "").trim()),
  );
  return hasPersonalFact || [
    facts.education,
    facts.experiences,
    facts.projects,
    facts.certifications,
    facts.volunteering,
    facts.languages,
    facts.links,
    facts.skills,
  ].some((value) => Array.isArray(value) && value.length > 0);
};

const resolveResumeFactsOwnership = (resume = {}, portfolio = {}) => {
  const resumeOwnsFacts = hasResumeProfileFacts(resume);
  const fallbackUsed = !resumeOwnsFacts && Boolean(portfolio?._id || Object.keys(portfolio || {}).length);
  return {
    factsOwner: fallbackUsed ? "portfolio_legacy" : "resume",
    fallbackUsed,
    portfolio: fallbackUsed ? portfolio : {},
  };
};

const getArabicMasterPresentation = (resume = {}) => pickDefined(resume, [
  "summary",
  "education",
  "experience",
  "experiences",
  "projects",
  "certifications",
  "volunteering",
  "sectionOrder",
  "hiddenSections",
  "settings",
  "summaryProvenance",
]);

const getEnglishPresentation = (versionPayload = {}) => pickDefined(versionPayload, [
  "summary",
  "education",
  "experience",
  "experiences",
  "projects",
  "certifications",
  "volunteering",
  "sectionOrder",
  "hiddenSections",
  "settings",
  "localizedDisplay",
  "summaryProvenance",
]);

module.exports = {
  RESUME_SOURCE_FACT_KEYS,
  getCanonicalResumeExperiences,
  getResumeSourceFacts,
  getResumeFactsWritePayload,
  hasResumeProfileFacts,
  resolveResumeFactsOwnership,
  getArabicMasterPresentation,
  getEnglishPresentation,
};
