const normalize = (value = "") => String(value || "")
  .trim()
  .toLocaleLowerCase("en")
  .replace(/[إأآ]/g, "ا")
  .replace(/ى/g, "ي")
  .replace(/ة/g, "ه")
  .replace(/\s+/g, " ");

const languageLabels = {
  ar: {
    "العربيه": "العربية",
    arabic: "العربية",
    "الانجليزيه": "الإنجليزية",
    english: "الإنجليزية",
  },
  en: {
    "العربيه": "Arabic",
    arabic: "Arabic",
    "الانجليزيه": "English",
    english: "English",
  },
};

const levelLabels = {
  ar: {
    "اللغه الام": "اللغة الأم",
    native: "اللغة الأم",
    advanced: "متقدم",
    "متقدم": "متقدم",
    intermediate: "متوسط",
    "متوسط": "متوسط",
    beginner: "مبتدئ",
    "مبتدئ": "مبتدئ",
  },
  en: {
    "اللغه الام": "Native",
    native: "Native",
    advanced: "Advanced",
    "متقدم": "Advanced",
    intermediate: "Intermediate",
    "متوسط": "Intermediate",
    beginner: "Beginner",
    "مبتدئ": "Beginner",
  },
};

// Presentation-only localization. Source language values stay exactly as the
// student saved them and are never written back through this helper.
export const getResumeLanguageDisplay = (language = {}, displayLanguage = "ar") => {
  const locale = displayLanguage === "en" ? "en" : "ar";
  const name = String(language?.name || "").trim();
  const level = String(language?.level || "").trim();
  return {
    name: languageLabels[locale][normalize(name)] || name,
    level: levelLabels[locale][normalize(level)] || level,
  };
};
