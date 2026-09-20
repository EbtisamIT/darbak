const textValue = (value) => String(value?.text || value?.html || value || "")
  .replace(/<[^>]+>/gu, " ")
  .replace(/\s+/gu, " ")
  .trim();

const isGenerated = (value) => value && typeof value === "object" && (
  /^(ai-|darbak-display-|translated-|generated-)/u.test(String(value.id || ""))
  || ["agent", "generated", "presentation", "translation"].includes(String(value.source || value.provenance || "").toLowerCase())
);

const valuesOf = (value) => (Array.isArray(value) ? value : value ? [value] : [])
  .filter((item) => !isGenerated(item))
  .map(textValue)
  .filter(Boolean);

const unique = (values) => Array.from(new Map(values.map((value) => [value.toLocaleLowerCase("ar"), value])).values());

const normalizeSource = (item = {}, { includeDescription = true } = {}) => {
  const generatedPresentation = ["agent", "generated", "presentation", "translation"].includes(String(item.descriptionSource || item.source || item.provenance || "").toLowerCase())
    || (Array.isArray(item.achievements) && item.achievements.some(isGenerated));
  const description = textValue(item.userSourceDescription || (generatedPresentation ? "" : item.description || item.details));
  const contributions = unique([
    ...valuesOf(item.userSourceContributions),
    ...valuesOf(item.responsibilities),
    ...valuesOf(item.tasks),
    ...valuesOf(item.contribution),
    ...valuesOf(item.contributions),
    ...valuesOf(item.achievements),
    includeDescription ? description : "",
  ].filter(Boolean));
  return { description, contributions };
};

export const normalizeExperienceFacts = (item = {}) => {
  const source = normalizeSource(item);
  return {
    ...item,
    userSourceDescription: source.description,
    userSourceContributions: source.contributions,
    responsibilities: source.contributions,
  };
};

export const normalizeProjectFacts = (item = {}) => {
  const source = normalizeSource(item, { includeDescription: false });
  return {
    ...item,
    userSourceDescription: source.description || source.contributions[0] || "",
    userSourceContributions: source.contributions,
    contributions: source.contributions,
  };
};

export const normalizeActivityFacts = (item = {}) => {
  const source = normalizeSource(item);
  return {
    ...item,
    userSourceDescription: source.description,
    userSourceContributions: source.contributions,
    contributions: source.contributions,
  };
};

export const normalizeFactsForSection = (item = {}, section = "") => {
  if (/^(exp|experience)/u.test(section)) return normalizeExperienceFacts(item);
  if (/^(vol|volunteering|activity)/u.test(section)) return normalizeActivityFacts(item);
  if (/project/u.test(section)) return normalizeProjectFacts(item);
  return item;
};
