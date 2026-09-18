import { hasEntryContent } from "./resumeDefaults";

export const ATS_CLASSIC_TEMPLATE = "ats-classic";

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
