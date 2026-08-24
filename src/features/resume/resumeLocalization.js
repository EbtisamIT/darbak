const arabicPattern = /[\u0600-\u06FF]/;

const localizedDegree = (value = "") => {
  const normalized = value.trim();
  if (/بكالوريوس/.test(normalized)) return "Bachelor's Degree";
  if (/دبلوم/.test(normalized)) return "Diploma";
  if (/ماجستير/.test(normalized)) return "Master's Degree";
  return "";
};

export const getEnglishReviewItems = (resume = {}) => {
  if (resume.settings?.language !== "en") return [];
  const localized = resume.localizedDisplay || {};
  const items = [];
  const personal = resume.personalInfo || {};
  const displayedName = localized.personalInfo?.fullName || personal.englishName || personal.fullName;
  if (!displayedName || arabicPattern.test(displayedName) || displayedName.trim().split(/\s+/).length < 2) {
    items.push({ label: "الاسم الرسمي بالإنجليزية", value: personal.fullName || "غير موجود", section: "personal", field: "fullName" });
  }
  ["headline", "major", "university"].forEach((field) => {
    const displayValue = localized.personalInfo?.[field];
    if (arabicPattern.test(personal[field] || "") && !displayValue) {
      const labels = { headline: "المسمى", major: "التخصص", university: "الجامعة" };
      items.push({ label: labels[field], value: personal[field], section: "personal", field });
    }
  });
  ["education", "experience", "projects", "certifications", "volunteering"].forEach((section) => {
    (resume[section] || []).forEach((entry) => {
      const values = localized.entries?.[`${section}:${entry.id}`] || {};
      ["title", "organization"].forEach((field) => {
        if (arabicPattern.test(entry[field] || "") && !values[field]) {
          const sectionLabels = {
            education: "التعليم",
            experience: "الخبرة",
            projects: "المشروع",
            certifications: "الشهادة",
            volunteering: "النشاط",
          };
          items.push({ label: field === "title" ? `اسم ${sectionLabels[section]}` : "اسم الجهة", value: entry[field], section, field, entryId: entry.id });
        }
      });
    });
  });
  return items;
};

export const getLocalizedResumeForDisplay = (resume = {}) => {
  if (resume.settings?.language !== "en") return resume;
  const localized = resume.localizedDisplay || {};
  const personal = { ...(resume.personalInfo || {}), ...(localized.personalInfo || {}) };
  personal.fullName = localized.personalInfo?.fullName || personal.englishName || personal.fullName;
  const sections = ["education", "experience", "projects", "certifications", "volunteering"];
  const next = { ...resume, personalInfo: personal };
  sections.forEach((section) => {
    next[section] = (resume[section] || []).map((entry) => ({
      ...entry,
      ...(localized.entries?.[`${section}:${entry.id}`] || {}),
    }));
  });
  next.experiences = next.experience || resume.experiences;
  return next;
};

export const buildEnglishLocalizedDisplay = (resume = {}) => {
  const personal = resume.personalInfo || {};
  const localized = { personalInfo: {}, entries: {} };
  if (personal.englishName) localized.personalInfo.fullName = personal.englishName;
  if (localizedDegree(personal.major)) localized.personalInfo.major = localizedDegree(personal.major);
  ["education", "experience", "projects", "certifications", "volunteering"].forEach((section) => {
    (resume[section] || []).forEach((entry) => {
      const values = {};
      if (localizedDegree(entry.title)) values.title = localizedDegree(entry.title);
      if (entry.title === "دربك") values.title = "Darbak";
      if (entry.organization === "دربك") values.organization = "Darbak";
      if (Object.keys(values).length) localized.entries[`${section}:${entry.id}`] = values;
    });
  });
  return localized;
};
