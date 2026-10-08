const normalizeText = (value = "") =>
  String(value || "")
    .toLocaleLowerCase("ar")
    .replace(/[\u200e\u200f\u061c]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[\u064b-\u065f\u0640]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");

const majorAliases = [
  ["تقنية المعلومات", "تقنية معلومات", "IT", "Information Technology"],
  ["نظم المعلومات", "Information Systems"],
  ["نظم المعلومات الإدارية", "MIS", "Management Information Systems"],
  ["علوم الحاسب", "Computer Science", "CS"],
  ["هندسة البرمجيات", "Software Engineering"],
  ["الأمن السيبراني", "Cybersecurity"],
  ["علم البيانات", "علوم البيانات", "Data Science"],
  ["الذكاء الاصطناعي", "AI", "Artificial Intelligence"],
  ["المحاسبة", "Accounting"],
  ["المالية", "Finance"],
  ["إدارة الأعمال", "Business Administration"],
  ["التسويق", "Marketing"],
  ["الموارد البشرية", "HR", "Human Resources"],
];

const canonicalMajors = new Map(
  majorAliases.flatMap(([canonical, ...aliases]) =>
    [canonical, ...aliases].map((alias) => [normalizeText(alias), canonical])
  )
);

const relatedMajorPairs = [
  ["تقنية المعلومات", "نظم المعلومات"],
  ["نظم المعلومات", "نظم المعلومات الإدارية"],
  ["علوم الحاسب", "هندسة البرمجيات"],
  ["علم البيانات", "الذكاء الاصطناعي"],
  ["المحاسبة", "المالية"],
];

const relatedMajors = new Map();
relatedMajorPairs.forEach(([first, second]) => {
  relatedMajors.set(first, new Set([...(relatedMajors.get(first) || []), second]));
  relatedMajors.set(second, new Set([...(relatedMajors.get(second) || []), first]));
});

const generalMajorMarkers = new Set(
  ["__all_specialties__", "جميع التخصصات", "كل التخصصات", "عام", "all"].map(normalizeText)
);

export const normalizeMajor = (value = "") =>
  canonicalMajors.get(normalizeText(value)) || normalizeText(value);

export const classifyMajorMatch = (opportunity = {}, selectedMajor = "", selectedCategories = []) => {
  const specialties = opportunity.specialties || [];
  const categories = opportunity.majorCategories || [];
  if (!specialties.length && !categories.length) return "UNKNOWN";
  if (!selectedMajor) return "NONE";

  const selected = normalizeMajor(selectedMajor);
  const normalizedSpecialties = specialties.map(normalizeMajor);
  if (normalizedSpecialties.includes(selected)) return "EXACT";
  if (normalizedSpecialties.some((major) => relatedMajors.get(selected)?.has(major))) {
    return "RELATED";
  }
  const allValues = [...specialties, ...categories];
  if (allValues.some((value) => generalMajorMarkers.has(normalizeText(value)))) {
    return "BROAD";
  }
  const selectedCategoryKeys = new Set(selectedCategories.map(normalizeText));
  if (categories.some((category) => selectedCategoryKeys.has(normalizeText(category)))) {
    return "BROAD";
  }
  return "NONE";
};

const regionCities = {
  "منطقة الرياض": ["الرياض", "الدرعية", "الخرج"],
  "منطقة مكة المكرمة": ["جدة", "مكة المكرمة", "الطائف"],
  "منطقة المدينة المنورة": ["المدينة المنورة", "ينبع"],
  "المنطقة الشرقية": ["الخبر", "الدمام", "الظهران", "الأحساء", "الجبيل"],
  "منطقة القصيم": ["بريدة"],
  "منطقة عسير": ["أبها", "خميس مشيط"],
  "منطقة حائل": ["حائل"],
  "منطقة تبوك": ["تبوك"],
};

const regionAliases = {
  "المنطقة الشرقية": ["الشرقية", "منطقة الشرقية"],
  "منطقة مكة المكرمة": ["منطقة مكة"],
  "منطقة المدينة المنورة": ["منطقة المدينة"],
};

const canonicalLocations = new Map(
  Object.entries(regionCities).flatMap(([region, cities]) => [
    ...[region, ...(regionAliases[region] || [])].map((alias) => [normalizeText(alias), region]),
    ...cities.map((city) => [normalizeText(city), city]),
  ])
);
canonicalLocations.set(normalizeText("مكة"), "مكة المكرمة");
canonicalLocations.set(normalizeText("المدينة"), "المدينة المنورة");

const cityRegions = new Map(
  Object.entries(regionCities).flatMap(([region, cities]) =>
    cities.map((city) => [city, region])
  )
);

export const normalizeCity = (value = "") =>
  canonicalLocations.get(normalizeText(value)) || normalizeText(value);

const getOpportunityLocations = (opportunity = {}) => {
  const values = Array.isArray(opportunity.cities) && opportunity.cities.length
    ? opportunity.cities
    : [opportunity.city];
  return values
    .flatMap((value) => String(value || "").split(/[،,]/))
    .map(normalizeCity)
    .filter(Boolean);
};

export const classifyLocationMatch = (opportunity = {}, selectedCity = "") => {
  if (opportunity.trainingMode === "remote") return "REMOTE";
  const location = normalizeCity(selectedCity);
  const opportunityLocations = getOpportunityLocations(opportunity);
  if (!location || !opportunityLocations.length) return "UNKNOWN";

  const selectedRegion = cityRegions.get(location) ||
    (regionCities[location] ? location : "");
  if (!regionCities[location] && opportunityLocations.includes(location)) {
    return "EXACT_CITY";
  }
  if (selectedRegion && opportunityLocations.some((value) =>
    value === selectedRegion || cityRegions.get(value) === selectedRegion
  )) {
    return "SAME_REGION";
  }
  return "OTHER_CITY";
};
