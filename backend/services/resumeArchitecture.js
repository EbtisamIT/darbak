const RESUME_SOURCE_FACT_KEYS = Object.freeze([
  "personalInfo",
  "education",
  "experience",
  "experiences",
  "projects",
  "certifications",
  "volunteering",
  "languages",
  "links",
  "skills",
]);

const pickDefined = (source = {}, keys = []) => Object.fromEntries(
  keys
    .filter((key) => Object.prototype.hasOwnProperty.call(source || {}, key))
    .map((key) => [key, source[key]]),
);

// ResumeProfile currently stores facts and approved Arabic presentation in one
// document. These selectors establish ownership without moving historical data.
const getResumeSourceFacts = (resume = {}) => pickDefined(resume, RESUME_SOURCE_FACT_KEYS);

const getResumeFactsWritePayload = (sanitizedResume = {}) =>
  getResumeSourceFacts(sanitizedResume);

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
  getResumeSourceFacts,
  getResumeFactsWritePayload,
  getArabicMasterPresentation,
  getEnglishPresentation,
};
