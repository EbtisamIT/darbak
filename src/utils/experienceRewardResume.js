import { normalizeResume } from "../features/resume/resumeDefaults";
import { cleanRewardDraft, splitRewardBullets } from "./experienceRewardResumeQuality";

const toBulletEntry = (entry) => ({
  ...entry,
  description: "",
  achievements: splitRewardBullets(entry.description).filter(Boolean).map((text, index) => ({
    id: `reward-bullet-${index}`, text,
  })),
});

const certificateMonths = {
  ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};
const certificateDate = (period, language) => {
  const match = String(period || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return period;
  const month = certificateMonths[language === "en" ? "en" : "ar"][Number(match[2]) - 1];
  return month ? `${month} ${match[1]}` : period;
};

// A display-only adapter for the existing ATS Classic renderer. Reward drafts
// never write to ResumeProfile or the subscribed resume editor.
export const toAtsClassicResume = (rawDraft, language) => {
  const draft = cleanRewardDraft(rawDraft);
  return normalizeResume({
  personalInfo: {
    fullName: draft.fullName,
    city: draft.city,
    email: draft.email,
    phone: draft.phone,
    major: draft.major,
    university: draft.university,
    graduationYear: draft.graduationYear,
    gpa: draft.gpa,
    linkedinUrl: draft.linkedin,
  },
  education: draft.major && draft.university ? [{ title: draft.major, organization: draft.university,
    period: draft.graduationYear, description: draft.gpa ? `GPA: ${draft.gpa}` : "" }] : [],
  experiences: [...draft.trainingExperience, ...draft.experience].filter((entry) =>
    entry.title || entry.organization).map(toBulletEntry),
  projects: draft.projects.filter((entry) => entry.title).map((entry) => ({
    ...toBulletEntry(entry),
    organization: "",
    technologies: entry.organization.split(/[,،]/).map((tool) => tool.trim()).filter(Boolean),
  })),
  certifications: draft.certifications.filter((entry) => entry.title).map((entry) => ({
    ...entry,
    organization: [entry.organization, certificateDate(entry.period, language)].filter(Boolean).join(" | "),
    period: "",
    description: "",
  })),
  skills: draft.skills,
  languages: draft.languages,
  settings: { language, template: "ats-classic" },
  });
};
