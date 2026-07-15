import majors from "../majors";

export const seoCities = [
  { slug: "riyadh", label: "الرياض" },
  { slug: "jeddah", label: "جدة" },
  { slug: "makkah", label: "مكة المكرمة" },
  { slug: "madinah", label: "المدينة المنورة" },
  { slug: "dammam", label: "الدمام" },
  { slug: "khobar", label: "الخبر" },
  { slug: "dhahran", label: "الظهران" },
  { slug: "eastern-province", label: "المنطقة الشرقية" },
  { slug: "qassim", label: "منطقة القصيم" },
  { slug: "abha", label: "أبها" },
  { slug: "jazan", label: "جازان" },
  { slug: "tabuk", label: "تبوك" },
  { slug: "hail", label: "حائل" },
  { slug: "najran", label: "نجران" },
];

export const seoSpecialties = [
  { slug: "computer-science", label: "علوم الحاسب" },
  { slug: "information-systems", label: "نظم المعلومات" },
  { slug: "information-technology", label: "تقنية المعلومات" },
  { slug: "software-engineering", label: "هندسة البرمجيات" },
  { slug: "cybersecurity", label: "الأمن السيبراني" },
  { slug: "data-science", label: "علم البيانات" },
  { slug: "business-administration", label: "إدارة الأعمال" },
  { slug: "human-resources", label: "الموارد البشرية" },
  { slug: "accounting", label: "المحاسبة" },
  { slug: "finance", label: "المالية" },
  { slug: "marketing", label: "التسويق" },
  { slug: "law", label: "قانون ومحاماة" },
  { slug: "industrial-engineering", label: "الهندسة الصناعية" },
  { slug: "mechanical-engineering", label: "الهندسة الميكانيكية" },
  { slug: "electrical-engineering", label: "الهندسة الكهربائية" },
  { slug: "environmental-engineering", label: "هندسة بيئية" },
  { slug: "nursing", label: "التمريض" },
  { slug: "public-health", label: "الصحة العامة" },
  { slug: "translation", label: "الترجمة" },
  { slug: "graphic-design", label: "تصميم الجرافيك" },
];

const normalizeText = (value = "") =>
  value
    .toString()
    .trim()
    .replace(/[أإآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ");

const specialtyLabels = new Set(
  majors.flatMap((major) => [major.name, ...(major.subMajors || [])])
);

export const getSeoCityBySlug = (slug = "") =>
  seoCities.find((city) => city.slug === slug) || null;

export const getSeoSpecialtyBySlug = (slug = "") => {
  const specialty = seoSpecialties.find((item) => item.slug === slug);
  if (!specialty) return null;

  const hasSpecialty = specialtyLabels.has(specialty.label);
  return hasSpecialty ? specialty : null;
};

export const getSeoSlugForCity = (cityLabel = "") =>
  seoCities.find((city) => city.label === cityLabel)?.slug || "";

export const getSeoSlugForSpecialty = (specialtyLabel = "") => {
  const normalizedLabel = normalizeText(specialtyLabel);
  return (
    seoSpecialties.find(
      (specialty) => normalizeText(specialty.label) === normalizedLabel
    )?.slug || ""
  );
};

export const buildExperiencesSeoPath = ({ city = "", specialty = "" } = {}) => {
  const citySlug = getSeoSlugForCity(city);
  const specialtySlug = getSeoSlugForSpecialty(specialty);

  if (citySlug && specialtySlug) {
    return `/experiences/city/${citySlug}/major/${specialtySlug}`;
  }

  if (citySlug) return `/experiences/city/${citySlug}`;
  if (specialtySlug) return `/experiences/major/${specialtySlug}`;
  return "/experiences";
};

export const buildTrainingFinderSeoPath = ({ city = "", specialty = "" } = {}) => {
  const citySlug = getSeoSlugForCity(city);
  const specialtySlug = getSeoSlugForSpecialty(specialty);

  if (citySlug && specialtySlug) {
    return `/where-to-train/city/${citySlug}/major/${specialtySlug}`;
  }

  if (citySlug) return `/where-to-train/city/${citySlug}`;
  if (specialtySlug) return `/where-to-train/major/${specialtySlug}`;
  return "/where-to-train";
};
