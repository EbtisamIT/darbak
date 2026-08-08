const healthSpecialties = [
  "الطب والعلوم الصحية",
  "إدارة صحية",
  "تمريض",
  "صيدلة",
  "مختبرات",
  "أشعة",
  "علاج طبيعي",
  "تغذية",
  "إدارة الأعمال",
  "الموارد البشرية",
  "تقنية المعلومات",
];

const healthMajorCategories = [
  "الطب والعلوم الصحية",
  "المالية والإدارية",
  "الحاسب والتقنية",
];

// ضعي رابط صورة الشعار هنا لأي مستشفى يحتاج شعار مخصص.
const hospitalLogoUrls = {
  "HOSP-001": "",
  "HOSP-002": "",
  "HOSP-003": "",
  "HOSP-004": "",
  "HOSP-005": "",
  "HOSP-006": "",
  "HOSP-007": "",
  "HOSP-008": "",
  "HOSP-009": "",
  "HOSP-010": "",
  "HOSP-011": "",
  "HOSP-012": "",
  "HOSP-013": "",
  "HOSP-014": "",
  "HOSP-015": "",
  "HOSP-016": "",
  "HOSP-017": "",
  "HOSP-018": "",
  "HOSP-019": "",
  "HOSP-020": "",
  "HOSP-021": "",
  "HOSP-022": "",
  "HOSP-023": "",
  "HOSP-024": "",
  "HOSP-025": "",
  "HOSP-026": "",
  "HOSP-027": "",
  "HOSP-028": "",
};

const cityRegionMap = {
  الرياض: "منطقة الرياض",
  جدة: "منطقة مكة المكرمة",
  "مكة المكرمة": "منطقة مكة المكرمة",
  الدمام: "المنطقة الشرقية",
  الخبر: "المنطقة الشرقية",
  الجبيل: "المنطقة الشرقية",
  القطيف: "المنطقة الشرقية",
  الأحساء: "المنطقة الشرقية",
  بريدة: "منطقة القصيم",
  "المدينة المنورة": "منطقة المدينة المنورة",
  أبها: "منطقة عسير",
  حائل: "منطقة حائل",
};

const uniqueValues = (values = []) =>
  Array.from(new Set(values.filter(Boolean)));

const resolveRegions = (cities = [], regions = []) =>
  uniqueValues([
    ...regions,
    ...cities.map((city) => cityRegionMap[city]).filter(Boolean),
  ]);

const createHospitalSuggestion = ({
  id,
  name,
  email,
  domain,
  cities = [],
  regions = [],
  logoUrl = "",
  note,
}) => {
  const website = domain ? `https://${domain}` : "";
  const suggestionId = `HOSP-${id}`;
  const resolvedLogoUrl = logoUrl || hospitalLogoUrls[suggestionId] || "";
  const resolvedRegions = resolveRegions(cities, regions);
  const locationText =
    cities.length > 0
      ? cities.length > 3
        ? `فروع متعددة: ${cities.slice(0, 4).join("، ")} وغيرها حسب توفر الجهة.`
        : `الموقع: ${cities.join("، ")}.`
      : "الموقع يحتاج تأكيد قبل عرضه ضمن مدينة محددة.";

  return {
    id: suggestionId,
    source: "darbak_health_hospitals",
    sourceLabel: "اقتراحات جهات صحية",
    name,
    sector: "مستشفى / قطاع صحي",
    region: resolvedRegions[0] || "غير محدد",
    regions: resolvedRegions,
    city: cities[0] || "غير محدد",
    cities,
    logoUrl: resolvedLogoUrl,
    specialties: healthSpecialties,
    majorCategories: healthMajorCategories,
    contactType: "بريد تواصل أو تقديم",
    emails: [email],
    email,
    url: website,
    sourceUrl: website,
    applicationWindow: "تحقق من إعلان الجهة أو قناة التوظيف الرسمية",
    confidence: domain
      ? "متوسطة - مبنية على بريد الجهة المقدم"
      : "منخفضة - لا يوجد دومين رسمي واضح مرفق",
    premiumReady: true,
    lastVerified: "2026-08-08",
    usage:
      "استخدم وسيلة التواصل كنقطة بداية بعد التأكد من قناة الجهة الرسمية قبل الإرسال.",
    note:
      note ||
      `${locationText} جهة صحية مقترحة للطلاب الراغبين بالتدريب في المستشفيات والقطاع الصحي.`,
    guideSummary:
      "اقتراح جهة صحية يمكن التواصل معها للتدريب التعاوني حسب احتياج الجهة وتوفر المقاعد.",
  };
};

export const healthHospitalSuggestions = [
  createHospitalSuggestion({
    id: "001",
    name: "مستشفى سليمان الحبيب",
    email: "WeCare@drsulaimanalhabib.com",
    domain: "drsulaimanalhabib.com",
    cities: ["الرياض", "الخبر", "بريدة"],
  }),
  createHospitalSuggestion({
    id: "002",
    name: "مستشفى دلة",
    email: "webmaster@dallah-hospital.com",
    domain: "dallah-hospital.com",
    cities: ["الرياض"],
  }),
  createHospitalSuggestion({
    id: "003",
    name: "مستشفى الحمادي",
    email: "invest@alhammadi.com",
    domain: "alhammadi.com",
    cities: ["الرياض"],
  }),
  createHospitalSuggestion({
    id: "004",
    name: "مستشفى المشاري",
    email: "info@al-mishari.com.sa",
    domain: "al-mishari.com.sa",
    cities: ["الرياض"],
  }),
  createHospitalSuggestion({
    id: "005",
    name: "المركز التخصصي الطبي",
    email: "info@smc.com.sa",
    domain: "smc.com.sa",
    cities: ["الرياض"],
  }),
  createHospitalSuggestion({
    id: "006",
    name: "المستشفى السعودي الألماني",
    email: "jobs@sghgroup.net",
    domain: "sghgroup.net",
    cities: ["جدة", "الرياض", "الدمام", "المدينة المنورة", "أبها", "حائل"],
  }),
  createHospitalSuggestion({
    id: "007",
    name: "مستشفى المملكة",
    email: "info@khccgroup.com",
    domain: "khccgroup.com",
    cities: ["الرياض"],
  }),
  createHospitalSuggestion({
    id: "008",
    name: "مستشفيات ومراكز المغربي",
    email: "info@magrabi.com.sa",
    domain: "magrabi.com.sa",
    cities: ["جدة", "الرياض", "الدمام", "الخبر", "المدينة المنورة"],
  }),
  createHospitalSuggestion({
    id: "009",
    name: "مستشفى الهلال الأخضر",
    email: "info@gch.com.sa",
    domain: "gch.com.sa",
    cities: ["الرياض"],
  }),
  createHospitalSuggestion({
    id: "010",
    name: "مستشفى الفلاح",
    email: "info@alfalahh.com",
    domain: "alfalahh.com",
    cities: ["الرياض"],
  }),
  createHospitalSuggestion({
    id: "011",
    name: "مستشفى أوباجي",
    email: "info@obagisa.com",
    domain: "obagisa.com",
    cities: ["الرياض", "جدة", "الخبر"],
  }),
  createHospitalSuggestion({
    id: "012",
    name: "مستشفى دار الشفاء",
    email: "daralshefa@hotmail.com",
    note:
      "جهة صحية مقترحة، ولم يتم إرفاق دومين رسمي واضح معها لذلك يمكن رفع شعارها يدويًا لاحقًا.",
  }),
  createHospitalSuggestion({
    id: "013",
    name: "مستشفى سند",
    email: "info@sanadhospital.com",
    domain: "sanadhospital.com",
    cities: ["الرياض"],
  }),
  createHospitalSuggestion({
    id: "014",
    name: "مستشفى رعاية الرياض",
    email: "info@care.med.sa",
    domain: "care.med.sa",
    cities: ["الرياض"],
  }),
  createHospitalSuggestion({
    id: "015",
    name: "مستشفى المواساة",
    email: "management@mouwasat.com",
    domain: "mouwasat.com",
    cities: ["الدمام", "الخبر", "الجبيل", "القطيف", "الرياض", "المدينة المنورة"],
  }),
  createHospitalSuggestion({
    id: "016",
    name: "مستشفى فيكتوريا",
    email: "info@victoria-hos.com",
    domain: "victoria-hos.com",
    cities: ["الرياض"],
  }),
  createHospitalSuggestion({
    id: "017",
    name: "مستشفى عناية العائلة",
    email: "info@familycare.com.sa",
    domain: "familycare.com.sa",
    cities: ["الرياض"],
  }),
  createHospitalSuggestion({
    id: "018",
    name: "مستشفى رابية",
    email: "info@rabiahospital.com",
    domain: "rabiahospital.com",
    cities: ["الرياض"],
  }),
  createHospitalSuggestion({
    id: "019",
    name: "مستشفى النخبة",
    email: "marketing@elitehospitalsa.com",
    domain: "elitehospitalsa.com",
    cities: ["الرياض"],
  }),
  createHospitalSuggestion({
    id: "020",
    name: "مستشفى الصفوة ماجيستي",
    email: "info@safwahospital.com",
    domain: "safwahospital.com",
    cities: ["الرياض"],
  }),
  createHospitalSuggestion({
    id: "021",
    name: "مستشفى الجزيرة الطبي",
    email: "info@aljazeerahospital.com.sa",
    domain: "aljazeerahospital.com.sa",
    cities: ["الرياض"],
  }),
  createHospitalSuggestion({
    id: "022",
    name: "مستشفى الأسرة",
    email: "info@family-hospital.com",
    domain: "family-hospital.com",
    cities: ["الرياض"],
  }),
  createHospitalSuggestion({
    id: "023",
    name: "مستشفى أدمة",
    email: "info@adamahealthcare.com",
    domain: "adamahealthcare.com",
    cities: ["الرياض", "جدة", "الخبر"],
  }),
  createHospitalSuggestion({
    id: "024",
    name: "مستشفى الدارة",
    email: "info@aldaramed.com",
    domain: "aldaramed.com",
    cities: ["الرياض"],
  }),
  createHospitalSuggestion({
    id: "025",
    name: "مستشفى الدكتور محمد الفقيه",
    email: "info@dmf.med.sa",
    domain: "dmf.med.sa",
    cities: ["الرياض"],
  }),
  createHospitalSuggestion({
    id: "026",
    name: "مستشفى ديافيرم",
    email: "saudiarabia@diaverum.com",
    domain: "diaverum.com",
    cities: ["الرياض", "جدة", "الدمام", "الخبر", "المدينة المنورة", "بريدة"],
  }),
  createHospitalSuggestion({
    id: "027",
    name: "مستشفى الدكتور سليمان فقيه",
    email: "hr@fakeeh.care",
    domain: "fakeeh.care",
    cities: ["جدة", "الرياض"],
  }),
  createHospitalSuggestion({
    id: "028",
    name: "مستشفى الدكتور غسان نجيب فرعون",
    email: "medical@gnp.com.sa",
    domain: "gnp.com.sa",
    cities: ["جدة"],
  }),
];
