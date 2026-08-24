export const RESUME_SECTION_KEYS = [
  "summary",
  "education",
  "experience",
  "projects",
  "skills",
  "certifications",
  "volunteering",
  "languages",
];

export const RESUME_SECTION_META = {
  summary: {
    title: "النبذة المهنية",
    addLabel: "",
    emptyText: "اكتب نبذة مختصرة توضّح تخصصك واهتمامك المهني.",
  },
  education: {
    title: "التعليم",
    addLabel: "إضافة تعليم",
    emptyText: "أضف جامعتك أو مؤهلك الدراسي.",
  },
  experience: {
    title: "الخبرات",
    addLabel: "إضافة خبرة",
    emptyText: "أضف تدريبًا، عملًا جزئيًا، أو تجربة عملية.",
  },
  projects: {
    title: "المشاريع",
    addLabel: "إضافة مشروع",
    emptyText: "أضف مشروعًا جامعيًا أو عمليًا يوضح مهاراتك.",
  },
  skills: {
    title: "المهارات",
    addLabel: "إضافة مهارة",
    emptyText: "أضف المهارات والأدوات المرتبطة بتخصصك.",
  },
  certifications: {
    title: "الدورات والشهادات",
    addLabel: "إضافة شهادة",
    emptyText: "أضف الدورات والشهادات المهمة فقط.",
  },
  volunteering: {
    title: "الأنشطة والتطوع",
    addLabel: "إضافة نشاط",
    emptyText: "أضف نشاطًا أو عملًا تطوعيًا يدعم صورتك المهنية.",
  },
  languages: {
    title: "اللغات",
    addLabel: "إضافة لغة",
    emptyText: "أضف اللغات ومستوى إجادتك.",
  },
  links: {
    title: "الروابط",
    addLabel: "إضافة رابط",
    emptyText: "أضف LinkedIn أو GitHub أو ملفك المهني.",
  },
};

export const makeId = (prefix = "item") =>
  `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

export const emptyAchievement = () => ({
  id: makeId("ach"),
  text: "",
  html: "<p></p>",
});

export const emptyEntry = (prefix = "entry") => ({
  id: makeId(prefix),
  title: "",
  subtitle: "",
  organization: "",
  period: "",
  startDate: "",
  endDate: "",
  isCurrent: false,
  location: "",
  url: "",
  description: "",
  details: "",
  achievements: [emptyAchievement()],
});

export const emptyLanguage = () => ({
  id: makeId("language"),
  name: "",
  level: "",
});

export const emptyLink = (label = "") => ({
  id: makeId("link"),
  label,
  url: "",
});

export const createEmptyResume = () => ({
  personalInfo: {
    fullName: "",
    englishName: "",
    email: "",
    phone: "",
    city: "",
    major: "",
    university: "",
    headline: "",
    linkedinUrl: "",
    portfolioUrl: "",
    githubUrl: "",
    personalUrl: "",
  },
  summary: "",
  education: [],
  experience: [],
  experiences: [],
  projects: [],
  skills: [],
  certifications: [],
  volunteering: [],
  languages: [],
  links: [],
  sectionOrder: RESUME_SECTION_KEYS,
  hiddenSections: [],
  settings: {
    language: "ar",
    direction: "rtl",
    density: "comfortable",
    fontSize: "medium",
    template: "clean",
    accentColor: "#42cfc3",
  },
  access: {
    aiResumeUsageCount: 0,
    aiResumeUsageLimit: 0,
    aiResumeUsageResetAt: null,
  },
});

export const stripHtml = (value = "") =>
  value
    .toString()
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s{2,}/g, " ")
    .trim();

export const escapeHtml = (value = "") =>
  value
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export const hasEntryContent = (entry = {}) =>
  Boolean(
    entry.title ||
      entry.subtitle ||
      entry.organization ||
      entry.period ||
      entry.startDate ||
      entry.endDate ||
      entry.location ||
      entry.url ||
      entry.description ||
      entry.details ||
      (entry.achievements || []).some((achievement) =>
        Boolean(achievement.text || stripHtml(achievement.html))
      )
  );

const normalizeAchievement = (achievement = {}) => {
  const html = achievement.html || (achievement.text ? `<p>${escapeHtml(achievement.text)}</p>` : "<p></p>");
  return {
    id: achievement.id || makeId("ach"),
    text: achievement.text || stripHtml(html),
    html,
  };
};

export const normalizeEntry = (entry = {}, prefix = "entry") => {
  const details = entry.description || entry.details || "";
  const achievements = Array.isArray(entry.achievements)
    ? entry.achievements.map(normalizeAchievement)
    : [];

  return {
    id: entry.id || entry._id || makeId(prefix),
    title: entry.title || "",
    subtitle: entry.subtitle || "",
    organization: entry.organization || entry.subtitle || "",
    period: entry.period || "",
    startDate: entry.startDate || "",
    endDate: entry.endDate || "",
    isCurrent: Boolean(entry.isCurrent),
    location: entry.location || "",
    url: entry.url || "",
    description: details,
    details,
    achievements: achievements.length
      ? achievements
      : details
      ? [{ id: makeId("ach"), text: details, html: `<p>${escapeHtml(details)}</p>` }]
      : [emptyAchievement()],
  };
};

const normalizeEntries = (entries = [], prefix = "entry") =>
  (Array.isArray(entries) ? entries : []).map((entry) => normalizeEntry(entry, prefix));

const normalizeSectionOrder = (order = []) => {
  const clean = (Array.isArray(order) ? order : []).filter((section) =>
    RESUME_SECTION_KEYS.includes(section)
  );
  return [...clean, ...RESUME_SECTION_KEYS.filter((section) => !clean.includes(section))];
};

export const normalizeResume = (resume = {}) => {
  const base = createEmptyResume();
  const experience = resume.experience || resume.experiences || [];
  const settings = {
    ...base.settings,
    ...(resume.settings || {}),
  };
  settings.language = settings.language === "en" ? "en" : "ar";
  settings.direction = settings.language === "en" ? "ltr" : settings.direction || "rtl";
  settings.template = ["clean", "modern", "formal"].includes(settings.template)
    ? settings.template
    : "clean";

  return {
    ...base,
    ...resume,
    personalInfo: {
      ...base.personalInfo,
      ...(resume.personalInfo || {}),
    },
    summary: resume.summary || "",
    education: normalizeEntries(resume.education, "edu"),
    experience: normalizeEntries(experience, "exp"),
    experiences: normalizeEntries(experience, "exp"),
    projects: normalizeEntries(resume.projects, "project"),
    certifications: normalizeEntries(resume.certifications, "cert"),
    volunteering: normalizeEntries(resume.volunteering, "vol"),
    languages: (Array.isArray(resume.languages) ? resume.languages : []).map((language) => ({
      id: language.id || language._id || makeId("language"),
      name: language.name || "",
      level: language.level || "",
    })),
    links: (Array.isArray(resume.links) ? resume.links : []).map((link) => ({
      id: link.id || link._id || makeId("link"),
      label: link.label || "",
      url: link.url || "",
    })),
    skills: Array.isArray(resume.skills) ? resume.skills : [],
    sectionOrder: normalizeSectionOrder(resume.sectionOrder),
    hiddenSections: (Array.isArray(resume.hiddenSections) ? resume.hiddenSections : []).filter(
      (section) => RESUME_SECTION_KEYS.includes(section)
    ),
    // Localized display values belong to a derived resume version. Keep them in
    // state so an English presentation never falls back to the Arabic facts.
    localizedDisplay: resume.localizedDisplay || {},
    settings,
    access: {
      ...base.access,
      ...(resume.access || {}),
    },
  };
};

export const prepareResumeForSave = (resume = {}) => {
  const normalized = normalizeResume(resume);
  return {
    personalInfo: normalized.personalInfo,
    summary: normalized.summary,
    education: normalized.education.filter(hasEntryContent),
    experience: normalized.experience.filter(hasEntryContent),
    experiences: normalized.experience.filter(hasEntryContent),
    projects: normalized.projects.filter(hasEntryContent),
    certifications: normalized.certifications.filter(hasEntryContent),
    volunteering: normalized.volunteering.filter(hasEntryContent),
    languages: normalized.languages.filter((language) => language.name || language.level),
    links: normalized.links.filter((link) => link.label || link.url),
    skills: normalized.skills.filter(Boolean),
    sectionOrder: normalized.sectionOrder,
    hiddenSections: normalized.hiddenSections,
    settings: normalized.settings,
    localizedDisplay: normalized.localizedDisplay || {},
  };
};

export const getVisibleSectionOrder = (resume = {}) =>
  normalizeSectionOrder(resume.sectionOrder).filter(
    (section) => !(resume.hiddenSections || []).includes(section)
  );

export const getResumeDirection = (resume = {}) =>
  resume.settings?.language === "en" || resume.settings?.direction === "ltr" ? "ltr" : "rtl";

export const formatResumeDateRange = (entry = {}, language = "ar") => {
  if (entry.period) return entry.period;
  const currentLabel = language === "en" ? "Present" : "حتى الآن";
  const separator = language === "en" ? " - " : " - ";
  return [entry.startDate, entry.isCurrent ? currentLabel : entry.endDate]
    .filter(Boolean)
    .join(separator);
};

export const getResumeFileName = (resume = {}) => {
  const language = resume.settings?.language === "en" ? "en" : "ar";
  const fallback = language === "en" ? "student-name" : "اسم-الطالب";
  const name = (resume.personalInfo?.fullName || fallback)
    .toString()
    .trim()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return `CV-${name || fallback}-${language}.pdf`;
};
