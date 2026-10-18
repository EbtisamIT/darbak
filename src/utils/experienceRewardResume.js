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

export const deriveRewardProfessionalTitle = (major, language = "ar") => {
  const value = String(major || "").trim();
  if (!value) return "";
  if (language === "en") return `${value} Graduate`;
  const known = {
    "التصميم": "مصمم/ة",
    "تصميم الجرافيك": "مصمم/ة جرافيك",
    "نظم المعلومات": "أخصائي/ة نظم معلومات",
    "نظم المعلومات الإدارية": "أخصائي/ة نظم معلومات إدارية",
    "علم البيانات": "محلل/ة بيانات",
  };
  return known[value] || `متخصص/ة في ${value}`;
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
    degree: draft.degree,
    headline: draft.professionalTitle || deriveRewardProfessionalTitle(draft.major, language),
    linkedinUrl: draft.linkedin,
  },
  summary: draft.professionalSummary,
  education: draft.major && draft.university ? [{ title: draft.degree || draft.major,
    organization: draft.university, location: draft.educationCity,
    period: draft.graduationYear, description: "" }] : [],
  experiences: [...draft.trainingExperience, ...draft.experience].filter((entry) =>
    entry.title || entry.organization).map(toBulletEntry),
  projects: draft.projects.filter((entry) => entry.title).map((entry) => ({
    ...toBulletEntry(entry),
    organization: "",
    technologies: entry.tools?.length ? entry.tools :
      entry.organization.split(/[,،]/).map((tool) => tool.trim()).filter(Boolean),
  })),
  certifications: draft.certifications.filter((entry) => entry.title).map((entry) => ({
    ...entry,
    organization: entry.organization,
    period: certificateDate(entry.period, language),
    description: "",
  })),
  skills: draft.skills,
  languages: draft.languages,
  settings: { language, template: "ats-classic" },
  });
};
