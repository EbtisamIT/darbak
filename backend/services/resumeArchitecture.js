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

const ARABIC_PRESENTATION_ENTRY_KEYS = Object.freeze([
  "description",
  "details",
  "achievements",
]);

const ARABIC_PRESENTATION_SETTING_KEYS = Object.freeze([
  "density",
  "fontSize",
  "template",
  "accentColor",
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

const toPlainObject = (value = {}) =>
  typeof value?.toObject === "function" ? value.toObject() : value;

const getPresentationEntries = (resume = {}, key = "projects") => {
  const source = toPlainObject(resume);
  const entries = key === "experiences"
    ? getCanonicalResumeExperiences(source)
    : Array.isArray(source?.[key])
      ? source[key]
      : [];
  return entries.map((entry = {}) => ({
    id: entry.id || entry._id?.toString?.() || "",
    ...pickDefined(entry, ARABIC_PRESENTATION_ENTRY_KEYS),
  }));
};

const mergePresentationEntries = (existing = [], incoming = []) => {
  const incomingById = new Map(
    (Array.isArray(incoming) ? incoming : [])
      .map((entry) => [entry?.id || entry?._id?.toString?.() || "", entry])
      .filter(([id]) => Boolean(id)),
  );
  return (Array.isArray(existing) ? existing : []).map((entry = {}) => {
    const id = entry.id || entry._id?.toString?.() || "";
    const next = incomingById.get(id);
    return next
      ? { ...entry, ...pickDefined(next, ARABIC_PRESENTATION_ENTRY_KEYS) }
      : entry;
  });
};

// ResumeProfile currently stores facts and approved Arabic presentation in one
// document. These selectors establish ownership without moving historical data.
const getResumeSourceFacts = (resume = {}) => {
  const source = toPlainObject(resume);
  const facts = pickDefined(source, RESUME_SOURCE_FACT_KEYS);
  if (hasOwn(source, "experiences") || hasOwn(source, "experience")) {
    facts.experiences = getCanonicalResumeExperiences(source);
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

const getArabicMasterPresentation = (resume = {}) => {
  const source = toPlainObject(resume);
  return {
    ...pickDefined(source, [
      "summary",
      "sectionOrder",
      "hiddenSections",
      "summaryProvenance",
    ]),
    experiences: getPresentationEntries(source, "experiences"),
    projects: getPresentationEntries(source, "projects"),
    volunteering: getPresentationEntries(source, "volunteering"),
    settings: {
      ...pickDefined(source.settings || {}, ARABIC_PRESENTATION_SETTING_KEYS),
      language: "ar",
      direction: "rtl",
    },
  };
};

// ResumeProfile remains compatibility storage for the approved Arabic
// presentation. This whitelist is the only payload the generic Master editor
// may persist: source facts and English localization state cannot cross it.
const getArabicMasterWritePayload = (incoming = {}, existing = {}) => {
  const next = getArabicMasterPresentation(incoming);
  const current = toPlainObject(existing);
  const experiences = mergePresentationEntries(
    getCanonicalResumeExperiences(current),
    getCanonicalResumeExperiences(incoming),
  );
  return {
    ...pickDefined(next, ["summary", "sectionOrder", "hiddenSections", "summaryProvenance"]),
    experiences,
    projects: mergePresentationEntries(current.projects, incoming.projects),
    volunteering: mergePresentationEntries(current.volunteering, incoming.volunteering),
    settings: next.settings,
  };
};

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
  getArabicMasterWritePayload,
  getEnglishPresentation,
};
