const cleanText = (value = "", maxLength = 1600) => String(value || "")
  .replace(/\s+/gu, " ")
  .trim()
  .slice(0, maxLength);

const GENERATED_PRESENTATION_ID = /^(ai-|darbak-display-|translated-|generated-)/u;

const readText = (value) => cleanText(value?.text || value?.html || value, 700)
  .replace(/<[^>]+>/gu, " ")
  .replace(/\s+/gu, " ")
  .trim();

const isGeneratedPresentationValue = (value = {}) => (
  value && typeof value === "object" && (
    GENERATED_PRESENTATION_ID.test(cleanText(value.id, 120))
    || ["agent", "generated", "presentation", "translation"].includes(cleanText(value.source || value.provenance, 40).toLowerCase())
  )
);

const readList = (value, { allowGenerated = false } = {}) => {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values
    .filter((item) => allowGenerated || !isGeneratedPresentationValue(item))
    .map(readText)
    .filter(Boolean);
};

const uniqueText = (values = []) => {
  const seen = new Set();
  return values.filter((value) => {
    const key = cleanText(value, 700).toLocaleLowerCase("ar");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const hasGeneratedPresentation = (item = {}) => (
  ["agent", "generated", "presentation", "translation"].includes(cleanText(item.descriptionSource || item.source || item.provenance, 40).toLowerCase())
  || (Array.isArray(item.achievements) && item.achievements.some(isGeneratedPresentationValue))
);

const getSourceDescription = (item = {}) => {
  const explicitSource = cleanText(item.userSourceDescription, 1600);
  if (explicitSource) return explicitSource;
  return hasGeneratedPresentation(item) ? "" : cleanText(item.description || item.details, 1600);
};

const getSourceContributions = (item = {}, { includeDescription = true } = {}) => uniqueText([
  ...readList(item.userSourceContributions),
  ...readList(item.responsibilities),
  ...readList(item.tasks),
  ...readList(item.contribution),
  ...readList(item.contributions),
  ...readList(item.achievements),
  includeDescription ? getSourceDescription(item) : "",
].filter(Boolean));

const normalizeExperienceFacts = (item = {}) => {
  const description = getSourceDescription(item);
  const responsibilities = getSourceContributions(item);
  return {
    ...item,
    description,
    details: description,
    userSourceDescription: description,
    userSourceContributions: responsibilities,
    responsibilities,
  };
};

const normalizeProjectFacts = (item = {}) => {
  const description = getSourceDescription(item);
  const contributions = getSourceContributions(item, { includeDescription: false });
  return {
    ...item,
    description: description || contributions[0] || "",
    details: description || contributions[0] || "",
    userSourceDescription: description || contributions[0] || "",
    userSourceContributions: contributions,
    contributions,
  };
};

const normalizeActivityFacts = (item = {}) => {
  const description = getSourceDescription(item);
  const contributions = getSourceContributions(item);
  return {
    ...item,
    description,
    details: description,
    userSourceDescription: description,
    userSourceContributions: contributions,
    contributions,
  };
};

const normalizeResumeFactCollections = (facts = {}) => ({
  ...facts,
  experiences: (Array.isArray(facts.experiences || facts.experience) ? facts.experiences || facts.experience : [])
    .map(normalizeExperienceFacts),
  projects: (Array.isArray(facts.projects) ? facts.projects : []).map(normalizeProjectFacts),
  volunteering: (Array.isArray(facts.volunteering) ? facts.volunteering : []).map(normalizeActivityFacts),
});

const getNormalizationDiagnostics = (item = {}, itemType = "project") => {
  const fields = [
    "userSourceDescription", "userSourceContributions", "description", "details",
    "responsibilities", "tasks", "contribution", "contributions", "achievements",
  ].filter((field) => readList(item[field]).length > 0);
  const normalized = itemType === "experience"
    ? normalizeExperienceFacts(item)
    : itemType === "activity"
      ? normalizeActivityFacts(item)
      : normalizeProjectFacts(item);
  return {
    itemType,
    itemId: cleanText(item.id || item._id, 120),
    sourceFieldsDetected: fields,
    normalizedResponsibilityCount: normalized.responsibilities?.length || 0,
    normalizedContributionCount: normalized.contributions?.length || 0,
  };
};

module.exports = {
  getNormalizationDiagnostics,
  normalizeActivityFacts,
  normalizeExperienceFacts,
  normalizeProjectFacts,
  normalizeResumeFactCollections,
};
