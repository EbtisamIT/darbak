const cleanText = (value) => String(value || "").replace(/\s+/g, " ").trim();

export const splitRewardBullets = (value) => String(value || "")
  .split(/\r?\n/)
  .map((line) => line.trim().replace(/^[•*-]\s*/, ""));

// Editing rows must preserve trailing and repeated spaces until blur/save.
export const splitRewardBulletRows = (value) => String(value || "").split(/\r?\n/);

const uniqueText = (values) => [...new Set(values.map(cleanText).filter(Boolean))];

const cleanDate = (value) => cleanText(value)
  .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
  .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
  .replace(/(\d{4})\s*[/.]\s*(\d{1,2})/g, (_, year, month) => `${year}-${month.padStart(2, "0")}`);

const cleanEntry = (entry = {}) => ({
  title: cleanText(entry.title),
  organization: cleanText(entry.organization),
  location: cleanText(entry.location),
  period: cleanDate(entry.period),
  description: uniqueText(splitRewardBullets(entry.description)).join("\n"),
  tools: uniqueText(entry.tools || []),
});
const hasCleanEntryContent = (entry) => Object.values(entry).some((value) =>
  Array.isArray(value) ? value.length > 0 : Boolean(value));

export const cleanRewardDraft = (draft = {}) => ({
  ...draft,
  fullName: cleanText(draft.fullName),
  city: cleanText(draft.city),
  email: cleanText(draft.email),
  phone: cleanText(draft.phone),
  linkedin: cleanText(draft.linkedin),
  professionalTitle: cleanText(draft.professionalTitle),
  professionalSummary: cleanText(draft.professionalSummary),
  major: cleanText(draft.major),
  university: cleanText(draft.university),
  educationCity: cleanText(draft.educationCity),
  degree: cleanText(draft.degree),
  graduationYear: cleanDate(draft.graduationYear),
  gpa: cleanText(draft.gpa),
  experience: (draft.experience || []).map(cleanEntry).filter(hasCleanEntryContent),
  trainingExperience: (draft.trainingExperience || []).slice(0, 1).map(cleanEntry),
  projects: (draft.projects || []).map(cleanEntry).filter(hasCleanEntryContent),
  certifications: (draft.certifications || []).map(cleanEntry).filter(hasCleanEntryContent),
  skills: uniqueText(draft.skills || []),
  languages: (draft.languages || []).map((item) => ({ name: cleanText(item.name), level: cleanText(item.level) }))
    .filter((item) => item.name),
});

export const hasUsableRewardContact = (draft = {}) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanText(draft.email)) ||
  /^\+?\d{8,15}$/.test(cleanText(draft.phone).replace(/[\s()-]/g, ""));

export const getRewardReadiness = (draft, language) => {
  const clean = cleanRewardDraft(draft);
  const training = clean.trainingExperience[0] || {};
  const projects = clean.projects || [];
  const checks = [
    { key: "contact", label: "الاسم ووسيلة التواصل", required: true,
      ready: Boolean(clean.fullName && hasUsableRewardContact(clean)) },
    { key: "university", label: "الجامعة", required: true, ready: Boolean(clean.university) },
    { key: "major", label: "التخصص", required: true, ready: Boolean(clean.major) },
    { key: "graduationYear", label: "سنة التخرج", required: true, ready: Boolean(clean.graduationYear) },
    { key: "educationCity", label: "مدينة الجامعة", required: true, ready: Boolean(clean.educationCity) },
    { key: "training", label: "تجربة التدريب ونقطة مساهمة واحدة على الأقل", required: true,
      ready: Boolean(training.organization && training.title && splitRewardBullets(training.description).filter(Boolean).length) },
    { key: "skills", label: "ثلاث مهارات على الأقل", required: true, ready: clean.skills.length >= 3 },
    { key: "language", label: "لغة السيرة", required: true, ready: ["ar", "en"].includes(language) },
    { key: "projects", label: "تفاصيل المشاريع المضافة", required: false,
      ready: !projects.length || projects.every((entry) => entry.title && entry.organization &&
        splitRewardBullets(entry.description).filter(Boolean).length) },
  ];
  return { checks, missing: checks.filter((check) => check.required && !check.ready).map((check) => check.label) };
};
