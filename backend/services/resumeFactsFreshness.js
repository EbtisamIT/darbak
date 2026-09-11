const crypto = require("crypto");

const cleanText = (value) => typeof value === "string" ? value.trim() : "";

const normalizeEntry = (entry = {}) => ({
  id: cleanText(entry.id),
  title: cleanText(entry.title),
  organization: cleanText(entry.organization),
  period: cleanText(entry.period),
  startDate: cleanText(entry.startDate),
  endDate: cleanText(entry.endDate),
  isCurrent: Boolean(entry.isCurrent),
  location: cleanText(entry.location),
  description: cleanText(entry.description || entry.details),
  url: cleanText(entry.url),
  technologies: (Array.isArray(entry.technologies) ? entry.technologies : [])
    .map((technology) => cleanText(technology))
    .filter(Boolean)
    .sort(),
  achievements: (Array.isArray(entry.achievements) ? entry.achievements : [])
    .map((item) => cleanText(item?.text || item?.html))
    .filter(Boolean),
});

const normalizeFacts = (facts = {}) => ({
  personalInfo: Object.fromEntries(Object.entries(facts.personalInfo || {})
    .filter(([key]) => [
      "fullName", "email", "phone", "city", "major", "university", "degree",
      "studentStatus", "grammaticalGender", "graduationYear", "expectedGraduationYear",
      "studyStartYear", "gpa", "gpaScale", "academicTrack", "relevantCoursework",
    ].includes(key))
    .map(([key, value]) => [key, Array.isArray(value) ? value.map((item) => cleanText(item)).filter(Boolean) : cleanText(value)])),
  experiences: (facts.experiences || facts.experience || []).map(normalizeEntry),
  projects: (facts.projects || []).map(normalizeEntry),
  certifications: (facts.certifications || []).map(normalizeEntry),
  volunteering: (facts.volunteering || []).map(normalizeEntry),
  skills: (facts.skills || []).map((skill) => cleanText(skill)).filter(Boolean).sort(),
});

const stableJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
};

const buildResumeFactsSnapshot = (verifiedFacts = {}) => normalizeFacts(verifiedFacts);
const hashResumeFactsSnapshot = (snapshot = {}) => crypto.createHash("sha256").update(stableJson(snapshot)).digest("hex");

const getChangedFactSections = (previous = {}, current = {}) => [
  ["experiences", "خبرة جديدة أو محدثة"],
  ["projects", "مشروع محدث"],
  ["certifications", "شهادة جديدة أو محدثة"],
  ["volunteering", "نشاط جديد أو محدث"],
  ["skills", "مهارات محدثة"],
  ["personalInfo", "بيانات أساسية محدثة"],
].filter(([key]) => stableJson(previous[key] || (key === "personalInfo" ? {} : [])) !== stableJson(current[key] || (key === "personalInfo" ? {} : [])))
  .map(([, label]) => label);

const getResumeFactsFreshness = ({ verifiedFacts = {}, workflow = {} } = {}) => {
  const currentSnapshot = buildResumeFactsSnapshot(verifiedFacts);
  const currentHash = hashResumeFactsSnapshot(currentSnapshot);
  const lastBuiltSnapshot = workflow?.lastBuiltFactsSnapshot || null;
  const lastBuiltHash = cleanText(workflow?.lastBuiltFactsHash);
  const baselineMissing = !lastBuiltSnapshot || !lastBuiltHash;
  const changed = baselineMissing || lastBuiltHash !== currentHash;
  return {
    currentHash,
    lastBuiltHash,
    baselineMissing,
    changed,
    changes: changed && !baselineMissing ? getChangedFactSections(lastBuiltSnapshot, currentSnapshot) : [],
    currentSnapshot,
  };
};

module.exports = {
  buildResumeFactsSnapshot,
  hashResumeFactsSnapshot,
  getResumeFactsFreshness,
};
