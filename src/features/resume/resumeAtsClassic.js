import { hasEntryContent } from "./resumeDefaults";

export const ATS_CLASSIC_TEMPLATE = "ats-classic";
export const ATS_CLASSIC_DENSITY_THRESHOLDS = Object.freeze({
  shortMax: 30,
  longMin: 48,
});

const entrySections = ["education", "experience", "projects", "certifications", "volunteering"];

const getSectionEntries = (resume = {}, section) => {
  if (section === "experience") return resume.experience || resume.experiences || [];
  return Array.isArray(resume[section]) ? resume[section] : [];
};

const getTextLength = (value) => String(value || "").replace(/<[^>]*>/g, "").trim().length;

const getEntryMetrics = (entry = {}) => {
  const achievements = Array.isArray(entry.achievements)
    ? entry.achievements.filter((achievement) => achievement?.text || achievement?.html)
    : [];
  const tools = getResumeEntryTools(entry);
  const characterCount = [
    entry.title,
    entry.subtitle,
    entry.organization,
    entry.location,
    entry.description,
    entry.details,
    entry.startDate,
    entry.endDate,
    entry.period,
    ...tools,
    ...achievements.flatMap((achievement) => [achievement.text, achievement.html]),
  ].reduce((total, value) => total + getTextLength(value), 0);
  const bulletCount = achievements.length || (entry.description || entry.details ? 1 : 0);

  return { characterCount, bulletCount };
};

export const isAtsClassicTemplate = (resume = {}) =>
  resume.settings?.template === ATS_CLASSIC_TEMPLATE;

export const getAtsClassicSectionOrder = (resume = {}) => {
  const hidden = new Set(Array.isArray(resume.hiddenSections) ? resume.hiddenSections : []);
  const experiences = resume.experience || resume.experiences || [];
  const hasExperience = experiences.some(hasEntryContent);
  const order = hasExperience
    ? ["summary", "experience", "education", "projects", "skills", "certifications", "volunteering", "languages"]
    : ["summary", "education", "projects", "skills", "certifications", "volunteering", "languages"];

  return order.filter((section) => !hidden.has(section));
};

export const getResumeEntryTools = (entry = {}) => {
  const values = [
    ...(Array.isArray(entry.tools) ? entry.tools : []),
    ...(Array.isArray(entry.technologies) ? entry.technologies : []),
  ].map((value) => String(value || "").trim()).filter(Boolean);
  return [...new Set(values)];
};

export const getAtsClassicDensityMetrics = (resume = {}) => {
  const hidden = new Set(Array.isArray(resume.hiddenSections) ? resume.hiddenSections : []);
  let sectionCount = resume.summary && !hidden.has("summary") ? 1 : 0;
  let entryCount = 0;
  let bulletCount = 0;
  let characterCount = getTextLength(resume.summary) + getTextLength(resume.personalInfo?.headline);

  entrySections.forEach((section) => {
    if (hidden.has(section)) return;
    const entries = getSectionEntries(resume, section).filter(hasEntryContent);
    if (!entries.length) return;
    sectionCount += 1;
    entryCount += entries.length;
    entries.forEach((entry) => {
      const metrics = getEntryMetrics(entry);
      bulletCount += metrics.bulletCount;
      characterCount += metrics.characterCount;
    });
  });

  if (!hidden.has("skills") && resume.skills?.length) {
    sectionCount += 1;
    characterCount += resume.skills.reduce((total, skill) => total + getTextLength(skill), 0);
  }
  if (!hidden.has("languages") && resume.languages?.some((item) => item?.name || item?.level)) {
    sectionCount += 1;
    characterCount += resume.languages.reduce(
      (total, item) => total + getTextLength(item?.name) + getTextLength(item?.level),
      0,
    );
  }

  const score = (sectionCount * 2) + (entryCount * 2) + (bulletCount * 1.2) + (characterCount / 160);
  return { sectionCount, entryCount, bulletCount, characterCount, score };
};

export const getAtsClassicDensityMode = (resume = {}) => {
  const { score } = getAtsClassicDensityMetrics(resume);
  if (score <= ATS_CLASSIC_DENSITY_THRESHOLDS.shortMax) return "short";
  if (score >= ATS_CLASSIC_DENSITY_THRESHOLDS.longMin) return "long";
  return "medium";
};
