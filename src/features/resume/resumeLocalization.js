const arabicPattern = /[\u0600-\u06FF]/;

const normalizeLookupValue = (value = "") =>
  value
    .toString()
    .trim()
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ");

const englishMajorLabels = {
  "تقنيه المعلومات": "Information Technology",
  "علوم الحاسب": "Computer Science",
  "نظم المعلومات": "Information Systems",
  "هندسه البرمجيات": "Software Engineering",
  "المحاسبه": "Accounting",
  "اداره الاعمال": "Business Administration",
  "التسويق": "Marketing",
  "التصميم الجرافيكي": "Graphic Design",
};

const englishUniversityLabels = {
  "جامعه الامام محمد بن سعود الاسلاميه": "Imam Mohammad Ibn Saud Islamic University",
  "جامعه الملك سعود": "King Saud University",
  "جامعه الاميره نوره بنت عبدالرحمن": "Princess Nourah bint Abdulrahman University",
  "جامعه الملك عبدالعزيز": "King Abdulaziz University",
};

const englishCityLabels = {
  "الرياض": "Riyadh",
  "جده": "Jeddah",
  "الدمام": "Dammam",
  "الخبر": "Al Khobar",
  "مكه": "Makkah",
  "المدينه المنوره": "Madinah",
};

const englishSkillLabels = {
  "تطوير الويب": "Web Development",
  "واجهه وتجربه المستخدم": "UI/UX",
  "واجهات وتجربه المستخدم": "UI/UX",
  "نظام نود.جي اس": "Node.js",
  "نود جي اس": "Node.js",
  "تطوير ال": "Web Development",
  "تحليل البيانات": "Data Analysis",
};

const englishLanguageLabels = {
  "العربيه": "Arabic",
  "الانجليزيه": "English",
};

const englishLanguageLevelLabels = {
  "اللغه الام": "Native",
  "متقدم": "Advanced",
  "متوسط": "Intermediate",
  "مبتدئ": "Beginner",
};

const englishActivityLabels = {
  "مبرمجه": "Programmer",
};

const englishOrganizationLabels = {
  "نادي انجاز": "Injaz Club",
};

const localizedDegree = (value = "") => {
  const normalized = value.trim();
  if (/بكالوريوس/.test(normalized)) return "Bachelor's Degree";
  if (/دبلوم/.test(normalized)) return "Diploma";
  if (/ماجستير/.test(normalized)) return "Master's Degree";
  return "";
};

const localizedMajor = (value = "") => englishMajorLabels[normalizeLookupValue(value)] || "";

const localizedUniversity = (value = "") => englishUniversityLabels[normalizeLookupValue(value)] || "";

const localizedCity = (value = "") => englishCityLabels[normalizeLookupValue(value)] || "";

const localizedSkill = (value = "") => {
  const clean = value.toString().trim();
  const normalized = normalizeLookupValue(clean);
  if (englishSkillLabels[normalized]) return englishSkillLabels[normalized];
  if (!arabicPattern.test(clean)) return clean;

  const parts = clean.split(/[•|,،]/).map((part) => part.trim()).filter(Boolean);
  const translated = parts.map((part) => englishSkillLabels[normalizeLookupValue(part)] || (!arabicPattern.test(part) ? part : ""));
  return translated.length && translated.every(Boolean) ? translated.join(" • ") : "";
};

const localizedLanguage = (value = "") => englishLanguageLabels[normalizeLookupValue(value)] || "";

const localizedLanguageLevel = (value = "") => englishLanguageLevelLabels[normalizeLookupValue(value)] || "";

const localizedActivity = (value = "") => englishActivityLabels[normalizeLookupValue(value)] || "";

const localizedOrganization = (value = "") => englishOrganizationLabels[normalizeLookupValue(value)] || "";

const isGenericHeadline = (value = "") =>
  /^(?:متخصص\/?ة?\s+في\s+.+|طالب\/?ة?\s+.+|خريج\/?ة?\s+.+|intern|trainee|co-?op trainee)$/i.test(
    value.toString().trim()
  );

const derivedEnglishHeadline = (personal = {}, display = {}) => {
  const major = display.major || localizedMajor(personal.major);
  if (!major) return "";
  if (personal.studentStatus === "student") return `${major} Student`;
  if (personal.studentStatus === "graduate") return `${major} Graduate`;
  return `${major} Specialist`;
};

export const getEnglishReviewItems = (resume = {}) => {
  if (resume.settings?.language !== "en") return [];
  const localized = {
    ...buildEnglishLocalizedDisplay(resume),
    ...(resume.localizedDisplay || {}),
    personalInfo: {
      ...(buildEnglishLocalizedDisplay(resume).personalInfo || {}),
      ...(resume.localizedDisplay?.personalInfo || {}),
    },
    entries: {
      ...(buildEnglishLocalizedDisplay(resume).entries || {}),
      ...(resume.localizedDisplay?.entries || {}),
    },
    skills: {
      ...(buildEnglishLocalizedDisplay(resume).skills || {}),
      ...(resume.localizedDisplay?.skills || {}),
    },
    languages: {
      ...(buildEnglishLocalizedDisplay(resume).languages || {}),
      ...(resume.localizedDisplay?.languages || {}),
    },
  };
  const items = [];
  const personal = resume.personalInfo || {};
  const displayedName = localized.personalInfo?.fullName || personal.englishName || personal.fullName;
  if (!displayedName || arabicPattern.test(displayedName) || displayedName.trim().split(/\s+/).length < 2) {
    items.push({ label: "الاسم الرسمي بالإنجليزية", value: personal.fullName || "غير موجود", section: "personal", field: "fullName" });
  }
  ["headline", "major", "university", "city"].forEach((field) => {
    const displayValue = localized.personalInfo?.[field];
    if (arabicPattern.test(personal[field] || "") && !displayValue) {
      const labels = { headline: "المسمى", major: "التخصص", university: "الجامعة", city: "المدينة" };
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
  (resume.skills || []).forEach((skill, index) => {
    const value = typeof skill === "string" ? skill : skill?.name || "";
    if (arabicPattern.test(value) && !localized.skills?.[index]) {
      items.push({ label: "مهارة", value, section: "skills", field: "skill", index });
    }
  });
  (resume.languages || []).forEach((language, index) => {
    const value = language?.name || "";
    if (arabicPattern.test(value) && !localized.languages?.[index]?.name) {
      items.push({ label: "لغة", value, section: "languages", field: "name", index });
    }
  });
  return items;
};

export const getLocalizedResumeForDisplay = (resume = {}) => {
  if (resume.settings?.language !== "en") return resume;
  const generated = buildEnglishLocalizedDisplay(resume);
  const localized = {
    ...generated,
    ...(resume.localizedDisplay || {}),
    personalInfo: {
      ...(generated.personalInfo || {}),
      ...(resume.localizedDisplay?.personalInfo || {}),
    },
    entries: {
      ...(generated.entries || {}),
      ...(resume.localizedDisplay?.entries || {}),
    },
    skills: {
      ...(generated.skills || {}),
      ...(resume.localizedDisplay?.skills || {}),
    },
    languages: {
      ...(generated.languages || {}),
      ...(resume.localizedDisplay?.languages || {}),
    },
  };
  const personal = { ...(resume.personalInfo || {}), ...(localized.personalInfo || {}) };
  personal.fullName = localized.personalInfo?.fullName || personal.englishName || personal.fullName;
  const sections = ["education", "experience", "projects", "certifications", "volunteering"];
  const next = { ...resume, personalInfo: personal };
  sections.forEach((section) => {
    next[section] = (resume[section] || []).map((entry) => {
      const displayValues = localized.entries?.[`${section}:${entry.id}`] || {};
      const localizedEntry = { ...entry, ...displayValues };
      ["title", "subtitle", "organization", "location"].forEach((field) => {
        if (!displayValues[field] && arabicPattern.test(localizedEntry[field] || "")) {
          localizedEntry[field] = "";
        }
      });
      return localizedEntry;
    });
  });
  next.skills = (resume.skills || []).map((skill, index) => {
    const source = typeof skill === "string" ? skill : skill?.name || "";
    const display = localized.skills?.[index];
    return display || (!arabicPattern.test(source) ? source : "");
  }).filter(Boolean);
  next.languages = (resume.languages || []).map((language, index) => {
    const display = localized.languages?.[index] || {};
    const name = display.name || (!arabicPattern.test(language?.name || "") ? language?.name || "" : "");
    const level = display.level || (!arabicPattern.test(language?.level || "") ? language?.level || "" : "");
    return { ...language, name, level };
  }).filter((language) => language.name || language.level);
  next.experiences = next.experience || resume.experiences;
  return next;
};

export const buildEnglishLocalizedDisplay = (resume = {}) => {
  const personal = resume.personalInfo || {};
  const localized = { personalInfo: {}, entries: {}, skills: {}, languages: {} };
  if (personal.englishName) localized.personalInfo.fullName = personal.englishName;
  const major = localizedMajor(personal.major);
  const university = localizedUniversity(personal.university);
  const city = localizedCity(personal.city);
  if (major) localized.personalInfo.major = major;
  if (university) localized.personalInfo.university = university;
  if (city) localized.personalInfo.city = city;
  if (!personal.headline || isGenericHeadline(personal.headline)) {
    const headline = derivedEnglishHeadline(personal, localized.personalInfo);
    if (headline) localized.personalInfo.headline = headline;
  }
  ["education", "experience", "projects", "certifications", "volunteering"].forEach((section) => {
    (resume[section] || []).forEach((entry) => {
      const values = {};
      if (localizedDegree(entry.title)) values.title = localizedDegree(entry.title);
      if (section === "volunteering" && localizedActivity(entry.title)) values.title = localizedActivity(entry.title);
      if (entry.title === "دربك") values.title = "Darbak";
      if (entry.organization === "دربك") values.organization = "Darbak";
      if (localizedOrganization(entry.organization)) values.organization = localizedOrganization(entry.organization);
      if (localizedCity(entry.location)) values.location = localizedCity(entry.location);
      if (Object.keys(values).length) localized.entries[`${section}:${entry.id}`] = values;
    });
  });
  (resume.skills || []).forEach((skill, index) => {
    const value = typeof skill === "string" ? skill : skill?.name || "";
    const display = localizedSkill(value);
    if (display && display !== value) localized.skills[index] = display;
  });
  (resume.languages || []).forEach((language, index) => {
    const name = localizedLanguage(language?.name || "");
    const level = localizedLanguageLevel(language?.level || "");
    if (name || level) localized.languages[index] = { ...(name ? { name } : {}), ...(level ? { level } : {}) };
  });
  return localized;
};
