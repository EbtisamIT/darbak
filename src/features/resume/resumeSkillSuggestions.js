import { normalizeDisplaySkills } from "./resumeSkillDisplay";

const generalSuggestions = ["حل المشكلات", "التواصل", "العمل الجماعي", "إدارة الوقت"];

const byContext = [
  { match: /نظم المعلومات|information systems|تحليل|data/iu, values: ["تحليل البيانات", "Microsoft Excel", "Power BI", "SQL"] },
  { match: /تقنية المعلومات|علوم الحاسب|حاسب|software|برمج/iu, values: ["Software Development", "SQL", "GitHub", "UI/UX"] },
  { match: /ادارة|إدارة|business|محاسب|account|مالي|finance/iu, values: ["Microsoft Excel", "تحليل البيانات", "إعداد التقارير"] },
];

const key = (value = "") => String(value || "").trim().toLocaleLowerCase("en");

// Suggestions are intentionally static context hints. They never alter skill
// membership: only the student's explicit click can add a value.
export const getResumeSkillSuggestions = ({ skills = [], personalInfo = {} } = {}) => {
  const selected = new Set(normalizeDisplaySkills(skills).map(key));
  const context = `${personalInfo.major || ""} ${personalInfo.academicTrack || ""}`;
  const contextual = byContext.filter((item) => item.match.test(context)).flatMap((item) => item.values);
  const seen = new Set();
  return [...contextual, ...generalSuggestions].filter((value) => {
    const normalized = key(value);
    if (!normalized || selected.has(normalized) || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
};
