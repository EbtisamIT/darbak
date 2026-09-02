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
  "جامعه جده": "University of Jeddah",
  "جامعه الملك خالد": "King Khalid University",
  "جامعه الملك فهد للبترول والمعادن": "King Fahd University of Petroleum and Minerals",
  "جامعه القصيم": "Qassim University",
  "جامعه ام القري": "Umm Al-Qura University",
  "جامعه طيبه": "Taibah University",
  "جامعه الطائف": "Taif University",
  "جامعه جازان": "Jazan University",
  "جامعه نجران": "Najran University",
  "جامعه تبوك": "University of Tabuk",
  "جامعه حائل": "University of Hail",
  "جامعه الجوف": "Jouf University",
  "جامعه الباحه": "Al Baha University",
  "جامعه الامير سطام بن عبدالعزيز": "Prince Sattam bin Abdulaziz University",
  "جامعه شقراء": "Shaqra University",
  "جامعه المجمعه": "Majmaah University",
  "جامعه بيشه": "University of Bisha",
  "جامعه حفر الباطن": "University of Hafr Al Batin",
  "الجامعه السعوديه الالكترونيه": "Saudi Electronic University",
  "جامعه الملك فيصل": "King Faisal University",
  "جامعه الامام عبدالرحمن بن فيصل": "Imam Abdulrahman Bin Faisal University",
  "جامعه اليمامه": "Al Yamamah University",
  "جامعه الامير سلطان": "Prince Sultan University",
  "جامعه الفيصل": "Alfaisal University",
  "جامعه دار العلوم": "Dar Al Uloom University",
  "جامعه عفت": "Effat University",
  "جامعه دار الحكمه": "Dar Al-Hekma University",
  "كليات التقنيه": "Technical Colleges",
};

const englishCityLabels = {
  "الرياض": "Riyadh",
  "جده": "Jeddah",
  "الدمام": "Dammam",
  "الخبر": "Al Khobar",
  "مكه": "Makkah",
  "المدينه المنوره": "Madinah",
  "ابها": "Abha",
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
  "microsoft powerpointb": "Microsoft PowerPoint",
  "microsoft powerpoint": "Microsoft PowerPoint",
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

const hasEnglishStatusConflict = (summary = "", studentStatus = "") =>
  (studentStatus === "graduate" && /\bstudent\b/i.test(summary)) ||
  (studentStatus === "student" && /\bgraduate\b/i.test(summary));

const buildEnglishFactSummary = (resume = {}, personal = {}) => {
  const major = String(personal.major || "").trim();
  const degree = String(personal.degree || "").trim();
  const skills = getCleanEnglishSkills(resume.skills || []).slice(0, 3);
  const project = (resume.projects || []).find((entry) => entry?.title || entry?.name);
  const experience = (resume.experience || resume.experiences || []).find((entry) => entry?.title || entry?.organization);
  const identity = personal.studentStatus === "graduate"
    ? `Graduate in ${major}`
    : personal.studentStatus === "student"
      ? `Student of ${major}`
      : `${major} professional`;
  return [
    identity,
    degree ? `with a ${degree} background.` : ".",
    skills.length ? `Skills include ${skills.join(", ")}.` : "",
    project?.title ? `Project experience includes ${project.title}.` : experience?.title ? `Experience includes ${experience.title}.` : "",
  ].join(" ").replace(/\s+\./g, ".").trim();
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

const mergeLocalizedValues = (generated = {}, saved = {}) =>
  Object.entries(saved || {}).reduce(
    (merged, [key, value]) => (value === "" || value == null ? merged : { ...merged, [key]: value }),
    { ...generated },
  );

const stableEntryKey = (section, entryId) => `${section}:${entryId}`;
const stableAchievementKey = (section, entryId, achievementId) =>
  `${section}:${entryId}:${achievementId}`;

const getSourceEntry = (resume = {}, section, entry = {}) => {
  const facts = resume.verifiedResumeFacts?.[section] || [];
  return facts.find((candidate) => candidate?.id === entry.id) || entry;
};

const getReviewState = (resume = {}, key) =>
  resume.localizedDisplay?.review?.[key] || {};

const needsLocalizationReview = (resume, key, source, translated) => {
  if (!source || !translated || arabicPattern.test(translated)) return false;
  const review = getReviewState(resume, key);
  return review.source !== source || review.approved !== true;
};

const derivedEnglishHeadline = (personal = {}, display = {}) => {
  const major = display.major || localizedMajor(personal.major) || (!arabicPattern.test(personal.major || "") ? String(personal.major || "").trim() : "");
  if (!major) return "";
  if (personal.studentStatus === "student") return `${major} Student`;
  if (personal.studentStatus === "graduate") return `${major} Graduate`;
  return `${major} Specialist`;
};

const derivedArabicHeadline = (personal = {}) => {
  const major = String(personal.major || "").trim();
  if (!major) return "";
  const feminine = personal.grammaticalGender === "feminine";
  const masculine = personal.grammaticalGender === "masculine";
  if (personal.studentStatus === "graduate") return `${feminine ? "خريجة" : masculine ? "خريج" : "خريج/ة"} ${major}`;
  if (personal.studentStatus === "student") return `${feminine ? "طالبة" : masculine ? "طالب" : "طالب/ة"} ${major}`;
  return `${feminine ? "متخصصة" : masculine ? "متخصص" : "متخصص/ة"} في ${major}`;
};

// The API attaches this read-only snapshot after resolving Portfolio facts.
// Preview and PDF both enter through this module, so a stale editor/local draft
// cannot replace university, status, education, or project source content.
export const applyVerifiedResumeFacts = (resume = {}) => {
  const facts = resume.verifiedResumeFacts;
  if (!facts) return resume;
  const language = resume.settings?.language === "en" ? "en" : "ar";
  const personalInfo = { ...(resume.personalInfo || {}), ...(facts.personalInfo || {}) };
  const composeEntries = (section) => {
    const verified = facts[section] || [];
    if (!verified.length) return resume[section] || [];
    const current = new Map((resume[section] || []).map((entry) => [entry?.id, entry]));
    return verified.map((fact) => {
      const presentation = current.get(fact.id) || {};
      const description = language === "en"
        ? presentation.description || presentation.details || fact.description
        : fact.description;
      return {
        ...fact,
        description,
        details: description,
        achievements: presentation.achievements?.length ? presentation.achievements : fact.achievements,
      };
    });
  };
  const experiences = composeEntries("experiences");
  return {
    ...resume,
    personalInfo,
    education: composeEntries("education"),
    experiences,
    experience: experiences,
    projects: composeEntries("projects"),
    certifications: composeEntries("certifications"),
    volunteering: composeEntries("volunteering"),
    skills: facts.skills?.length ? facts.skills : resume.skills || [],
    languages: facts.languages?.length ? facts.languages : resume.languages || [],
    links: facts.links?.length ? facts.links : resume.links || [],
  };
};

export const getEnglishReviewItems = (resume = {}) => {
  resume = applyVerifiedResumeFacts(resume);
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
    achievements: {
      ...(buildEnglishLocalizedDisplay(resume).achievements || {}),
      ...(resume.localizedDisplay?.achievements || {}),
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
    items.push({ label: "الاسم الرسمي بالإنجليزية", value: personal.fullName || "غير موجود", section: "personal", field: "fullName", fieldKey: "personal.fullName" });
  }
  ["headline", "major", "university", "city"].forEach((field) => {
    const displayValue = localized.personalInfo?.[field];
    if (arabicPattern.test(personal[field] || "") && !displayValue) {
      const labels = { headline: "المسمى", major: "التخصص", university: "الجامعة", city: "المدينة" };
      items.push({ label: labels[field], value: personal[field], section: "personal", field, fieldKey: `personal.${field}` });
    }
  });
  if (arabicPattern.test(resume.summary || "")) {
    items.push({ label: "النبذة المهنية", value: resume.summary, section: "summary", field: "summary", fieldKey: "summary" });
  }
  ["education", "experience", "projects", "certifications", "volunteering"].forEach((section) => {
    (resume[section] || []).forEach((entry) => {
      const entryKey = stableEntryKey(section, entry.id);
      const values = localized.entries?.[entryKey] || {};
      const sourceEntry = getSourceEntry(resume, section, entry);
      ["title", "organization"].forEach((field) => {
        const educationOrganizationUsesLocalizedUniversity =
          section === "education" &&
          field === "organization" &&
          Boolean(localized.personalInfo?.university);
        const sourceValue = sourceEntry[field] || entry[field] || "";
        const translatedValue = values[field] || entry[field] || "";
        const isCanonicalValue = Boolean(
          (field === "title" && localizedDegree(sourceValue)) ||
          (field === "organization" && localizedUniversity(sourceValue)) ||
          (field === "organization" && localizedOrganization(sourceValue)) ||
          (section === "volunteering" && field === "title" && localizedActivity(sourceValue)),
        );
        if (arabicPattern.test(sourceValue) && !translatedValue && !educationOrganizationUsesLocalizedUniversity) {
          const sectionLabels = {
            education: "التعليم",
            experience: "الخبرة",
            projects: "المشروع",
            certifications: "الشهادة",
            volunteering: "النشاط",
          };
          items.push({ label: field === "title" ? `اسم ${sectionLabels[section]}` : "اسم الجهة", value: sourceValue, section, field, entryId: entry.id, fieldKey: `${section}.${entry.id}.${field}`, localizationState: "missing" });
        } else if (arabicPattern.test(sourceValue) && !isCanonicalValue && needsLocalizationReview(resume, `entries:${entryKey}:${field}`, sourceValue, translatedValue)) {
          items.push({
            label: field === "title" ? "ترجمة الاسم" : "ترجمة اسم الجهة",
            value: sourceValue,
            generatedValue: translatedValue,
            section,
            field,
            entryId: entry.id,
            fieldKey: `${section}.${entry.id}.${field}`,
            localizationState: "review",
          });
        }
      });
      const sourceDescription = sourceEntry.description || sourceEntry.details || "";
      const description = values.description || entry.description || entry.details || "";
      if (arabicPattern.test(sourceDescription) && !description) {
        items.push({ label: "وصف", value: sourceDescription, section, field: "description", entryId: entry.id, fieldKey: `${section}.${entry.id}.description`, localizationState: "missing" });
      } else if (arabicPattern.test(sourceDescription) && needsLocalizationReview(resume, `entries:${entryKey}:description`, sourceDescription, description)) {
        items.push({
          label: "ترجمة الوصف",
          value: sourceDescription,
          generatedValue: description,
          section,
          field: "description",
          entryId: entry.id,
          fieldKey: `${section}.${entry.id}.description`,
          localizationState: "review",
        });
      }
      (entry.achievements || []).forEach((achievement, index) => {
        const achievementId = achievement?.id || `${index}`;
        const sourceAchievement = (sourceEntry.achievements || []).find(
          (candidate, sourceIndex) => (candidate?.id || `${sourceIndex}`) === achievementId,
        );
        const sourceValue = sourceAchievement?.text || achievement?.text || "";
        const translatedValue = localized.achievements?.[stableAchievementKey(section, entry.id, achievementId)] || achievement?.text || "";
        if (arabicPattern.test(sourceValue) && !translatedValue) {
          items.push({ label: "نقطة", value: sourceValue, section, field: "achievement", entryId: entry.id, index, achievementId, fieldKey: `${section}.${entry.id}.achievements.${index}`, localizationState: "missing" });
        } else if (arabicPattern.test(sourceValue) && needsLocalizationReview(resume, `achievements:${stableAchievementKey(section, entry.id, achievementId)}`, sourceValue, translatedValue)) {
          items.push({
            label: "ترجمة نقطة",
            value: sourceValue,
            generatedValue: translatedValue,
            section,
            field: "achievement",
            entryId: entry.id,
            index,
            achievementId,
            fieldKey: `${section}.${entry.id}.achievements.${index}`,
            localizationState: "review",
          });
        }
      });
    });
  });
  (resume.skills || []).forEach((skill, index) => {
    const value = typeof skill === "string" ? skill : skill?.name || "";
    if (arabicPattern.test(value) && !localized.skills?.[index]) {
      items.push({ label: "مهارة", value, section: "skills", field: "skill", index, fieldKey: `skills.${index}` });
    }
  });
  (resume.languages || []).forEach((language, index) => {
    const value = language?.name || "";
    if (arabicPattern.test(value) && !localized.languages?.[index]?.name) {
      items.push({ label: "لغة", value, section: "languages", field: "name", index, fieldKey: `languages.${index}.name` });
    }
  });
  return items;
};

export const getLocalizedResumeForDisplay = (resume = {}) => {
  resume = applyVerifiedResumeFacts(resume);
  if (resume.settings?.language !== "en") {
    const personal = resume.personalInfo || {};
    const headline = derivedArabicHeadline(personal);
    const isStatusHeadline = /^(?:طالب(?:ة)?|خريج(?:ة)?|متخصص(?:ة)?|طالب\/ة|خريج\/ة|متخصص\/ة)\b/.test(String(personal.headline || "").trim());
    return headline && (!personal.headline || isStatusHeadline)
      ? { ...resume, personalInfo: { ...personal, headline } }
      : resume;
  }
  const generated = buildEnglishLocalizedDisplay(resume);
  const localized = {
    ...generated,
    ...(resume.localizedDisplay || {}),
    personalInfo: mergeLocalizedValues(generated.personalInfo, resume.localizedDisplay?.personalInfo),
    entries: {
      ...(generated.entries || {}),
      ...(resume.localizedDisplay?.entries || {}),
    },
    achievements: {
      ...(generated.achievements || {}),
      ...(resume.localizedDisplay?.achievements || {}),
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
  const confirmedHeadline = derivedEnglishHeadline(resume.personalInfo || {}, localized.personalInfo || {});
  if (confirmedHeadline) personal.headline = confirmedHeadline;
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
      localizedEntry.achievements = (localizedEntry.achievements || []).map((achievement, index) => {
        const achievementId = achievement?.id || `${index}`;
        const text = localized.achievements?.[stableAchievementKey(section, entry.id, achievementId)];
        return text ? { ...achievement, text, html: achievement.html || "" } : achievement;
      });
      return section === "projects"
        ? getDarbakProjectPresentation(localizedEntry, resume.summary)
        : localizedEntry;
    });
  });
  next.summary = hasEnglishStatusConflict(resume.summary, resume.personalInfo?.studentStatus)
    ? buildEnglishFactSummary(resume, personal)
    : getEnglishSummary(resume.summary, personal);
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
  const localized = { personalInfo: {}, entries: {}, achievements: {}, skills: {}, languages: {} };
  if (personal.englishName) localized.personalInfo.fullName = personal.englishName;
  const major = localizedMajor(personal.major);
  const university = localizedUniversity(personal.university);
  const city = localizedCity(personal.city);
  const degree = localizedDegree(personal.degree);
  if (major) localized.personalInfo.major = major;
  if (university) localized.personalInfo.university = university;
  if (city) localized.personalInfo.city = city;
  if (degree) localized.personalInfo.degree = degree;
  const headline = derivedEnglishHeadline(personal, localized.personalInfo);
  if (headline) localized.personalInfo.headline = headline;
  ["education", "experience", "projects", "certifications", "volunteering"].forEach((section) => {
    (resume[section] || []).forEach((entry) => {
      const values = {};
      // A title that is already English is a safe presentation fallback. Saved
      // localizedDisplay values still override this below, keyed by the stable
      // entry id rather than its array position.
      if (entry.title && !arabicPattern.test(entry.title)) values.title = entry.title;
      const description = entry.description || entry.details || "";
      if (description && !arabicPattern.test(description)) values.description = description;
      if (localizedDegree(entry.title)) values.title = localizedDegree(entry.title);
      if (section === "volunteering" && localizedActivity(entry.title)) values.title = localizedActivity(entry.title);
      if (entry.title === "دربك") values.title = "Darbak";
      if (entry.organization === "دربك") values.organization = "Darbak";
      if (localizedUniversity(entry.organization)) values.organization = localizedUniversity(entry.organization);
      if (localizedOrganization(entry.organization)) values.organization = localizedOrganization(entry.organization);
      if (localizedCity(entry.location)) values.location = localizedCity(entry.location);
      if (Object.keys(values).length) localized.entries[`${section}:${entry.id}`] = values;
      (entry.achievements || []).forEach((achievement, index) => {
        const text = achievement?.text || "";
        if (text && !arabicPattern.test(text)) {
          localized.achievements[stableAchievementKey(section, entry.id, achievement?.id || `${index}`)] = text;
        }
      });
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
