export const ACADEMIC_TRACK_OPTIONS = [
  { value: "business_analytics", ar: "تحليل الأعمال", en: "Business Analytics" },
  { value: "data_analytics", ar: "تحليل البيانات", en: "Data Analytics" },
  { value: "software_development", ar: "تطوير البرمجيات", en: "Software Development" },
  { value: "artificial_intelligence", ar: "الذكاء الاصطناعي", en: "Artificial Intelligence" },
  { value: "cybersecurity", ar: "الأمن السيبراني", en: "Cybersecurity" },
  { value: "computer_networks", ar: "الشبكات", en: "Computer Networks" },
  { value: "accounting", ar: "المحاسبة", en: "Accounting" },
  { value: "finance", ar: "المالية", en: "Finance" },
  { value: "marketing", ar: "التسويق", en: "Marketing" },
  { value: "human_resources", ar: "الموارد البشرية", en: "Human Resources" },
  { value: "project_management", ar: "إدارة المشاريع", en: "Project Management" },
  { value: "supply_chain", ar: "سلاسل الإمداد", en: "Supply Chain Management" },
  { value: "graphic_design", ar: "التصميم الجرافيكي", en: "Graphic Design" },
];

export const isAcademicTrackId = (value = "") =>
  ACADEMIC_TRACK_OPTIONS.some((track) => track.value === value);

export const getAcademicTrackLabel = (value = "", language = "ar") => {
  const track = ACADEMIC_TRACK_OPTIONS.find((candidate) => candidate.value === value);
  return track ? track[language === "en" ? "en" : "ar"] : "";
};
