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

const createHospitalSuggestion = ({
  id,
  name,
  email,
  domain,
  note,
}) => {
  const website = domain ? `https://${domain}` : "";

  return {
    id: `HOSP-${id}`,
    source: "darbak_health_hospitals",
    sourceLabel: "اقتراحات جهات صحية",
    name,
    sector: "مستشفى / قطاع صحي",
    region: "كل المناطق",
    regions: ["كل المناطق"],
    city: "كل المناطق",
    cities: ["كل المناطق"],
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
      "جهة صحية مقترحة للطلاب الراغبين بالتدريب في المستشفيات والقطاع الصحي.",
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
  }),
  createHospitalSuggestion({
    id: "002",
    name: "مستشفى دلة",
    email: "webmaster@dallah-hospital.com",
    domain: "dallah-hospital.com",
  }),
  createHospitalSuggestion({
    id: "003",
    name: "مستشفى الحمادي",
    email: "invest@alhammadi.com",
    domain: "alhammadi.com",
  }),
  createHospitalSuggestion({
    id: "004",
    name: "مستشفى المشاري",
    email: "info@al-mishari.com.sa",
    domain: "al-mishari.com.sa",
  }),
  createHospitalSuggestion({
    id: "005",
    name: "المركز التخصصي الطبي",
    email: "info@smc.com.sa",
    domain: "smc.com.sa",
  }),
  createHospitalSuggestion({
    id: "006",
    name: "المستشفى السعودي الألماني",
    email: "jobs@sghgroup.net",
    domain: "sghgroup.net",
  }),
  createHospitalSuggestion({
    id: "007",
    name: "مستشفى المملكة",
    email: "info@khccgroup.com",
    domain: "khccgroup.com",
  }),
  createHospitalSuggestion({
    id: "008",
    name: "مستشفيات ومراكز المغربي",
    email: "info@magrabi.com.sa",
    domain: "magrabi.com.sa",
  }),
  createHospitalSuggestion({
    id: "009",
    name: "مستشفى الهلال الأخضر",
    email: "info@gch.com.sa",
    domain: "gch.com.sa",
  }),
  createHospitalSuggestion({
    id: "010",
    name: "مستشفى الفلاح",
    email: "info@alfalahh.com",
    domain: "alfalahh.com",
  }),
  createHospitalSuggestion({
    id: "011",
    name: "مستشفى أوباجي",
    email: "info@obagisa.com",
    domain: "obagisa.com",
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
  }),
  createHospitalSuggestion({
    id: "014",
    name: "مستشفى رعاية الرياض",
    email: "info@care.med.sa",
    domain: "care.med.sa",
  }),
  createHospitalSuggestion({
    id: "015",
    name: "مستشفى المواساة",
    email: "management@mouwasat.com",
    domain: "mouwasat.com",
  }),
  createHospitalSuggestion({
    id: "016",
    name: "مستشفى فيكتوريا",
    email: "info@victoria-hos.com",
    domain: "victoria-hos.com",
  }),
  createHospitalSuggestion({
    id: "017",
    name: "مستشفى عناية العائلة",
    email: "info@familycare.com.sa",
    domain: "familycare.com.sa",
  }),
  createHospitalSuggestion({
    id: "018",
    name: "مستشفى رابية",
    email: "info@rabiahospital.com",
    domain: "rabiahospital.com",
  }),
  createHospitalSuggestion({
    id: "019",
    name: "مستشفى النخبة",
    email: "marketing@elitehospitalsa.com",
    domain: "elitehospitalsa.com",
  }),
  createHospitalSuggestion({
    id: "020",
    name: "مستشفى الصفوة ماجيستي",
    email: "info@safwahospital.com",
    domain: "safwahospital.com",
  }),
  createHospitalSuggestion({
    id: "021",
    name: "مستشفى الجزيرة الطبي",
    email: "info@aljazeerahospital.com.sa",
    domain: "aljazeerahospital.com.sa",
  }),
  createHospitalSuggestion({
    id: "022",
    name: "مستشفى الأسرة",
    email: "info@family-hospital.com",
    domain: "family-hospital.com",
  }),
  createHospitalSuggestion({
    id: "023",
    name: "مستشفى أدمة",
    email: "info@adamahealthcare.com",
    domain: "adamahealthcare.com",
  }),
  createHospitalSuggestion({
    id: "024",
    name: "مستشفى الدارة",
    email: "info@aldaramed.com",
    domain: "aldaramed.com",
  }),
  createHospitalSuggestion({
    id: "025",
    name: "مستشفى الدكتور محمد الفقيه",
    email: "info@dmf.med.sa",
    domain: "dmf.med.sa",
  }),
  createHospitalSuggestion({
    id: "026",
    name: "مستشفى ديافيرم",
    email: "saudiarabia@diaverum.com",
    domain: "diaverum.com",
  }),
  createHospitalSuggestion({
    id: "027",
    name: "مستشفى الدكتور سليمان فقيه",
    email: "hr@fakeeh.care",
    domain: "fakeeh.care",
  }),
  createHospitalSuggestion({
    id: "028",
    name: "مستشفى الدكتور غسان نجيب فرعون",
    email: "medical@gnp.com.sa",
    domain: "gnp.com.sa",
  }),
];
