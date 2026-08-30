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

const englishSkillAliases = {
  "git hub": "GitHub",
  github: "GitHub",
  react: "React.js",
  "react.js": "React.js",
  "time managmaet": "Time Management",
  "time management": "Time Management",
  "ui/ ux": "UI/UX",
  "ui/ux": "UI/UX",
  "data analysis": "Data Analysis",
  "node.js": "Node.js",
  "web development": "Web Development",
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
  "مبرمجه": "Programming Volunteer",
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

const normalizeEnglishSkill = (value = "") => {
  const translated = localizedSkill(value);
  const clean = translated.toString().trim().replace(/\s*\/\s*/g, "/").replace(/\s+/g, " ");
  return englishSkillAliases[clean.toLowerCase()] || clean;
};

const skillDisplayKey = (value = "") =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

const getCleanEnglishSkills = (skills = []) => {
  const seen = new Set();
  return skills
    .flatMap((skill) => {
      const value = typeof skill === "string" ? skill : skill?.name || "";
      return value.split(/[•|,،]/).map((item) => normalizeEnglishSkill(item)).filter(Boolean);
    })
    .filter((skill) => {
      const key = skillDisplayKey(skill);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const entryText = (entry = {}) =>
  [
    entry.title,
    entry.subtitle,
    entry.organization,
    entry.period,
    entry.startDate,
    entry.endDate,
    entry.location,
    entry.description,
    ...(entry.achievements || []).map((achievement) => achievement.text || achievement.html || ""),
  ]
    .join("|")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const getDeduplicatedEntries = (entries = [], section = "", personal = {}) => {
  const seen = new Set();
  return entries.filter((entry) => {
    const key = section === "education"
      ? [
          entry.title || personal.degree,
          entry.organization || entry.subtitle || personal.university,
          entry.period || entry.endDate || personal.graduationYear,
        ]
          .join("|")
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim()
      : entryText(entry);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const getEnglishSummary = (summary = "", personal = {}) => {
  const clean = summary.toString().trim().replace(/\s+/g, " ");
  if (!clean) return "";
  const headline = personal.headline || derivedEnglishHeadline(personal, { major: personal.major });
  if (!headline || clean.toLowerCase().startsWith(headline.toLowerCase())) return clean;
  return `${headline}. ${clean}`;
};

const getDarbakProjectPresentation = (entry = {}, summary = "") => {
  if (entry.title !== "دربك" && entry.title !== "Darbak") return entry;
  const lines = [
    entry.description || entry.details,
    ...(entry.achievements || []).map((achievement) => achievement.text || ""),
    ...summary.split(/(?<=[.!?])\s+/).filter((line) => /\bdarbak\b/i.test(line)),
  ].map((line) => line.trim()).filter(Boolean);
  const uniqueLines = [...new Set(lines.map((line) => line.toLowerCase()))]
    .map((line) => lines.find((item) => item.toLowerCase() === line))
    .slice(0, 3);
  if (!uniqueLines.length) return entry;
  return {
    ...entry,
    description: "",
    details: "",
    achievements: uniqueLines.map((text, index) => ({ id: `darbak-display-${index}`, text, html: "" })),
  };
};

const localizedLanguage = (value = "") => englishLanguageLabels[normalizeLookupValue(value)] || "";

const localizedLanguageLevel = (value = "") => englishLanguageLevelLabels[normalizeLookupValue(value)] || "";

const localizedActivity = (value = "") => englishActivityLabels[normalizeLookupValue(value)] || "";

const localizedOrganization = (value = "") => englishOrganizationLabels[normalizeLookupValue(value)] || "";

const isGenericHeadline = (value = "") =>
  /^(?:(?:متخصص|طال(?:ب|بة)|خري(?:ج|جة))(?:ة)?(?:\s+في)?\s+.+|intern|trainee|co-?op trainee)$/i.test(
    value.toString().trim()
  );

const mergeLocalizedValues = (generated = {}, saved = {}) =>
  Object.entries(saved || {}).reduce(
    (merged, [key, value]) => (value === "" || value == null ? merged : { ...merged, [key]: value }),
    { ...generated },
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
    personalInfo: mergeLocalizedValues(
      buildEnglishLocalizedDisplay(resume).personalInfo,
      resume.localizedDisplay?.personalInfo,
    ),
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
        const educationOrganizationUsesLocalizedUniversity =
          section === "education" &&
          field === "organization" &&
          Boolean(localized.personalInfo?.university);
        if (arabicPattern.test(entry[field] || "") && !values[field] && !educationOrganizationUsesLocalizedUniversity) {
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
    personalInfo: mergeLocalizedValues(generated.personalInfo, resume.localizedDisplay?.personalInfo),
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
    const entries = getDeduplicatedEntries(resume[section] || [], section, personal);
    next[section] = entries.map((entry) => {
      const displayValues = localized.entries?.[`${section}:${entry.id}`] || {};
      const localizedEntry = { ...entry, ...displayValues };
      ["title", "subtitle", "organization", "location"].forEach((field) => {
        if (!displayValues[field] && arabicPattern.test(localizedEntry[field] || "")) {
          localizedEntry[field] = "";
        }
      });
      return section === "projects"
        ? getDarbakProjectPresentation(localizedEntry, resume.summary)
        : localizedEntry;
    });
  });
  next.summary = getEnglishSummary(resume.summary, personal);
  next.skills = getCleanEnglishSkills((resume.skills || []).map((skill, index) => {
    const source = typeof skill === "string" ? skill : skill?.name || "";
    return localized.skills?.[index] || (!arabicPattern.test(source) ? source : "");
  }));
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
      if (localizedUniversity(entry.organization)) values.organization = localizedUniversity(entry.organization);
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
