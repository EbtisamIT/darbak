import contract from "./resumeFactsContract.json";

const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const pick = (value, keys) => Object.fromEntries(keys.filter((key) => own(value, key)).map((key) => [key, value[key]]));
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// This DTO has no presentation defaults, generated bullet fallback or locale.
// Hydration callers must supply the dedicated facts response, not a preview.
export const prepareResumeFactsForSave = (facts = {}) => {
  const result = { personalInfo: pick(facts.personalInfo || {}, contract.personalInfo) };
  contract.collections.forEach((section) => {
    const entries = section === "experiences"
      ? (own(facts, section) ? facts.experiences : facts.experience)
      : facts[section];
    result[section] = (Array.isArray(entries) ? entries : []).map((entry) => pick(entry, contract.entry));
  });
  ["languages", "links"].forEach((section) => {
    result[section] = (facts[section] || []).map((entry) => pick(entry, contract[section]));
  });
  result.skills = Array.isArray(facts.skills) ? [...facts.skills] : [];
  return result;
};

export const getResumeFactsFormState = (facts = {}) => {
  const source = prepareResumeFactsForSave(facts);
  return { ...source, experience: source.experiences };
};

// Only changed source fields cross the boundary, not the complete form state.
export const getResumeFactsPatch = (baseline = {}, next = {}) => {
  const before = prepareResumeFactsForSave(baseline);
  const after = prepareResumeFactsForSave(next);
  const patch = {};
  const personal = Object.fromEntries(Object.entries(after.personalInfo).filter(([key, value]) => !equal(before.personalInfo[key], value)));
  if (Object.keys(personal).length) patch.personalInfo = personal;
  [...contract.collections, "languages", "links"].forEach((section) => {
    if (equal(before[section], after[section])) return;
    const previous = new Map(before[section].map((entry) => [entry.id, entry]));
    patch[section] = after[section].map((entry) => ({
      id: entry.id,
      ...Object.fromEntries(Object.entries(entry).filter(([key, value]) => key !== "id" && !equal(previous.get(entry.id)?.[key], value))),
    }));
  });
  if (!equal(before.skills, after.skills)) patch.skills = after.skills;
  return patch;
};
