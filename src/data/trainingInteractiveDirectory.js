const CITY_REGION_MAP = {
  الرياض: "منطقة الرياض",
  جدة: "منطقة مكة المكرمة",
  "مكة المكرمة": "منطقة مكة المكرمة",
  مكة: "منطقة مكة المكرمة",
  الطائف: "منطقة مكة المكرمة",
  رابغ: "منطقة مكة المكرمة",
  "المدينة المنورة": "منطقة المدينة المنورة",
  المدينة: "منطقة المدينة المنورة",
  ينبع: "منطقة المدينة المنورة",
  العلا: "منطقة المدينة المنورة",
  الدمام: "المنطقة الشرقية",
  الخبر: "المنطقة الشرقية",
  الظهران: "المنطقة الشرقية",
  الأحساء: "المنطقة الشرقية",
  الهفوف: "المنطقة الشرقية",
  الجبيل: "المنطقة الشرقية",
  "حفر الباطن": "المنطقة الشرقية",
  أبها: "منطقة عسير",
  "خميس مشيط": "منطقة عسير",
  بيشة: "منطقة عسير",
  تبوك: "منطقة تبوك",
  حائل: "منطقة حائل",
  بريدة: "منطقة القصيم",
  نجران: "منطقة نجران",
  جازان: "منطقة جازان",
};

const SPECIALTY_PRESETS = {
  all: [
    "إدارة أعمال",
    "موارد بشرية",
    "تقنية معلومات",
    "نظم معلومات",
    "مالية",
    "محاسبة",
    "قانون",
    "إعلام واتصال",
    "تسويق",
  ],
  finance: [
    "مالية",
    "محاسبة",
    "اقتصاد",
    "إدارة أعمال",
    "نظم معلومات",
    "تقنية معلومات",
    "إدارة مخاطر",
  ],
  tech: [
    "علوم الحاسب",
    "نظم معلومات",
    "تقنية معلومات",
    "هندسة برمجيات",
    "أمن سيبراني",
    "علم البيانات",
    "تقنية اتصالات",
  ],
  law: ["قانون", "أنظمة", "شريعة", "إدارة أعمال"],
  engineering: [
    "هندسة",
    "هندسة كهربائية",
    "هندسة ميكانيكية",
    "هندسة صناعية",
    "هندسة مدنية",
    "إدارة أعمال",
    "تقنية معلومات",
  ],
  health: [
    "الطب والعلوم الصحية",
    "إدارة صحية",
    "صحة عامة",
    "تقنية معلومات",
    "إدارة أعمال",
  ],
  insurance: [
    "تأمين",
    "إدارة مخاطر",
    "مالية",
    "محاسبة",
    "إدارة أعمال",
    "تقنية معلومات",
  ],
  transport: [
    "سلاسل الإمداد",
    "إدارة أعمال",
    "هندسة",
    "تقنية معلومات",
    "مالية",
  ],
  tourism: ["السياحة والضيافة", "إدارة أعمال", "تسويق", "إعلام واتصال"],
  media: ["إعلام واتصال", "تسويق", "تصميم", "إدارة أعمال", "تقنية معلومات"],
  education: ["العلوم التربوية", "إدارة أعمال", "تقنية معلومات", "موارد بشرية"],
  government: [
    "إدارة أعمال",
    "موارد بشرية",
    "تقنية معلومات",
    "نظم معلومات",
    "مالية",
    "محاسبة",
    "قانون",
    "إعلام واتصال",
    "تسويق",
    "هندسة",
  ],
};

const MAJOR_CATEGORY_PRESETS = {
  all: [
    "الحاسب والتقنية",
    "المالية والإدارية",
    "القانون والسياسة",
    "الإعلام والإتصال",
    "الهندسة والطاقة",
  ],
  finance: ["المالية والإدارية", "الحاسب والتقنية"],
  tech: ["الحاسب والتقنية", "الهندسة والطاقة"],
  law: ["القانون والسياسة", "المالية والإدارية"],
  engineering: ["الهندسة والطاقة", "الحاسب والتقنية", "المالية والإدارية"],
  health: ["الطب والعلوم الصحية", "المالية والإدارية", "الحاسب والتقنية"],
  insurance: ["المالية والإدارية", "القانون والسياسة"],
  transport: ["المالية والإدارية", "الهندسة والطاقة", "الحاسب والتقنية"],
  tourism: ["السياحة والضيافة", "المالية والإدارية", "الإعلام والإتصال"],
  media: ["الإعلام والإتصال", "التصميم والفنون", "المالية والإدارية"],
  education: ["العلوم التربوية", "المالية والإدارية", "الحاسب والتقنية"],
  government: [
    "الحاسب والتقنية",
    "المالية والإدارية",
    "القانون والسياسة",
    "الإعلام والإتصال",
    "الهندسة والطاقة",
  ],
};

const splitCities = (value = "") =>
  value
    .split(/[،,-]/)
    .map((city) => city.trim())
    .filter(Boolean);

const uniqueValues = (values = []) =>
  Array.from(new Map(values.filter(Boolean).map((value) => [value, value])).values());

const getRegionsFromCities = (cities = []) => {
  if (cities.includes("كل المناطق")) return ["كل المناطق"];
  return uniqueValues(cities.map((city) => CITY_REGION_MAP[city]).filter(Boolean));
};

const normalizeEmails = (emails = []) =>
  Array.from(
    new Map(
      emails
        .filter(Boolean)
        .map((email) => email.trim())
        .filter((email) => email && email !== "-")
        .map((email) => [email.toLowerCase(), email])
    ).values()
  );

const buildOrganization = (item, index) => {
  const cities = item.national
    ? ["كل المناطق"]
    : uniqueValues(item.cities || splitCities(item.city || ""));
  const regions = item.national
    ? ["كل المناطق"]
    : uniqueValues([...(item.regions || []), ...getRegionsFromCities(cities)]);
  const emails = normalizeEmails(item.emails || []);
  const preset = item.preset || "government";

  return {
    id: `TI-${String(index + 1).padStart(3, "0")}`,
    source: "training_interactive_directory",
    sourceLabel: "دليل التدريب التفاعلي",
    name: item.name,
    sector: item.sector || "جهة تدريبية",
    region: regions[0] || "",
    regions,
    city: cities[0] || "",
    cities,
    specialties: uniqueValues([
      ...(SPECIALTY_PRESETS[preset] || SPECIALTY_PRESETS.government),
      ...(item.specialties || []),
    ]),
    majorCategories: uniqueValues([
      ...(MAJOR_CATEGORY_PRESETS[preset] || MAJOR_CATEGORY_PRESETS.government),
      ...(item.majorCategories || []),
    ]),
    contactType: item.contactType || (emails.length > 0 ? "إيميل تواصل/تقديم" : "عبر الموقع"),
    emails,
    email: emails[0] || "",
    url: item.url || "",
    sourceUrl: item.sourceUrl || item.url || "",
    applicationWindow: item.applicationWindow || "حسب إعلان الجهة",
    confidence: item.confidence || "متوسطة",
    premiumReady: true,
    lastVerified: "2026-08-07",
    usage:
      item.usage ||
      "تحقق من قناة الجهة الرسمية قبل الإرسال، واستخدم بيانات التواصل كنقطة بداية.",
    note:
      item.note ||
      "تحقق من قناة الجهة الرسمية قبل الإرسال، واستخدم بيانات التواصل كنقطة بداية.",
  };
};

const rawTrainingInteractiveOrganizations = [
  { name: "Plan A | marketing solutions", sector: "شركة", city: "الرياض", emails: ["hr@plana-sa.com"], preset: "media" },
  { name: "شركة الخشيم وشركاه", sector: "شركة محاماة", cities: ["الرياض", "جدة"], emails: ["contactus@alanli.com"], preset: "law" },
  { name: "شركة الضبعان وشركاه بالتعاون مع Evershed Sutherland", sector: "شركة محاماة", city: "الرياض", preset: "law" },
  { name: "P Legal in association AlEnezee Legal Counsel", sector: "شركة محاماة", city: "الرياض", emails: ["info@alinma.com"], preset: "law" },
  { name: "شركة الصعيب وشركاه للمحاماة", sector: "شركة محاماة", city: "الرياض", emails: ["soaib@soaiblaw.com"], preset: "law" },
  { name: "جدوى للاستثمار", sector: "شركة مالية", cities: ["الرياض", "جدة", "الخبر"], emails: ["info@jadwa.com"], preset: "finance" },
  { name: "تداول", sector: "شركة مالية", city: "الرياض", emails: ["Co.op.training@tadawul.com.sa"], preset: "finance" },
  { name: "تقنية", sector: "شركة تقنية", city: "الرياض", preset: "tech" },
  { name: "أديم المالية", sector: "شركة مالية", city: "الرياض", emails: ["hr@adeemcapital.com"], preset: "finance" },
  { name: "دراية المالية", sector: "شركة مالية", cities: ["الرياض", "جدة", "الدمام"], emails: ["HR@derayah.com"], preset: "finance" },
  { name: "فالكم المالية", sector: "شركة مالية", city: "الرياض", emails: ["hr@falcom.com.sa"], preset: "finance" },
  { name: "ثقة", sector: "شركة تقنية", city: "الرياض", emails: ["coop@thiqah.sa"], preset: "tech" },
  { name: "شركة معادن", sector: "شركة", cities: ["الرياض", "جدة", "الخبر", "الجبيل"], emails: ["info@maaden.com.sa"], preset: "engineering" },
  { name: "شركة كسب المالية", sector: "شركة مالية", city: "الرياض", emails: ["ialalwan@ksb.com.sa"], preset: "finance" },
  { name: "Saudi Credit Bureau (SIMAH) | سمة", sector: "شركة مالية", city: "الرياض", emails: ["kalmzaini@simah.com"], preset: "finance" },
  { name: "تكامل", sector: "شركة تقنية", city: "الرياض", url: "https://join.takamol.com.sa", preset: "tech" },
  { name: "tetco", sector: "شركة تعليمية تقنية", city: "الرياض", emails: ["career@tetco.sa"], preset: "tech" },
  { name: "وساطة كابيتال المالية", sector: "شركة مالية", city: "الرياض", emails: ["info@wasatah.com.sa"], preset: "finance" },
  { name: "نادك", sector: "شركة", city: "الرياض", emails: ["info@nadec.com.sa"], preset: "all" },
  { name: "شركة البنك السعودي الفرنسي", sector: "شركة مالية", city: "الرياض", preset: "finance" },
  { name: "ميدغلف للتأمين", sector: "شركة تأمين", city: "الرياض", emails: ["service@medgulf.com.sa"], preset: "insurance" },
  { name: "تكافل الراجحي", sector: "شركة تأمين", city: "الرياض", emails: ["customerservice@alrajhitakaful.com"], preset: "insurance" },
  { name: "بوبا العربية للتأمين", sector: "شركة تأمين", city: "الرياض", preset: "insurance" },
  { name: "شركة ولاء للتأمين", sector: "شركة تأمين", city: "الرياض", emails: ["walaa@walaa.com"], preset: "insurance" },
  { name: "الخطوط السعودية", sector: "شركة نقل", cities: ["الرياض", "جدة"], preset: "transport" },
  { name: "الشركة السعودية للخدمات الأرضية", sector: "شركة نقل", city: "الرياض", preset: "transport" },
  { name: "شركة خدمات الملاحة الجوية السعودية", sector: "شركة نقل", city: "جدة", preset: "transport" },
  { name: "مستشفى الملك خالد للعيون", sector: "صحي", city: "الرياض", emails: ["info@kkesh.med.sa"], preset: "health" },
  { name: "شركة بيان للمعلومات الائتمانية", sector: "شركة مالية", city: "الرياض", emails: ["care@bayancb.com"], preset: "finance" },
  { name: "كيورا", sector: "شركة صحية تقنية", city: "الرياض", emails: ["Jobs@cura.healthcare"], preset: "health" },
  { name: "ابوينت مي", sector: "شركة تقنية", city: "الرياض", emails: ["Abdullah@appointme.sa"], preset: "tech" },
  { name: "stc", sector: "شركة اتصالات", national: true, preset: "tech" },
  { name: "Mobily", sector: "شركة اتصالات", national: true, preset: "tech" },
  { name: "البحري", sector: "شركة نقل", city: "الرياض", preset: "transport" },
  { name: "سابك", sector: "شركة", city: "الرياض", preset: "engineering" },
  { name: "Aramco", sector: "شركة", city: "الظهران", emails: ["saempsa_webmaster@aramco.com"], preset: "engineering" },
  { name: "Saudi Railway Company", sector: "شركة نقل", national: true, emails: ["Training@sar.com.sa"], preset: "transport" },
  { name: "KPMG", sector: "شركة استشارية", cities: ["الرياض", "جدة", "الخبر"], preset: "finance" },
  { name: "EY", sector: "شركة استشارية", cities: ["الرياض", "جدة"], preset: "finance" },
  { name: "PWC", sector: "شركة استشارية", city: "الرياض", preset: "finance" },
  { name: "DELOITTE", sector: "شركة استشارية", cities: ["الرياض", "جدة", "الخبر"], emails: ["emakhdoum@deloitte.com"], preset: "finance" },
  { name: "سنابل للاستثمار | Sanabil Investments", sector: "شركة مالية", city: "الرياض", preset: "finance" },
  { name: "التعاونية", sector: "شركة تأمين", national: true, emails: ["info@tawuniya.com.sa"], preset: "insurance" },
  { name: "شركة ابو حيمد وال الشيخ والحقباني بالتعاون مع Clifford Chance", sector: "شركة محاماة", city: "الرياض", emails: ["Info.ASH@ashlawksa.com"], preset: "law" },
  { name: "شركة علم", sector: "شركة تقنية", city: "الرياض", preset: "tech" },
  { name: "شركة وقود التقنية", sector: "شركة تقنية", city: "جدة", preset: "tech" },
  { name: "شركة الكفاح القابضة", sector: "شركة", city: "الرياض", emails: ["info@alkifah.com"], preset: "engineering" },
  { name: "شركة لين لخدمات الأعمال", sector: "شركة تقنية", city: "الرياض", emails: ["info@lean.sa"], preset: "tech" },
  { name: "روابط القابضة", sector: "شركة", city: "الخبر", emails: ["info@rawabiholding.com"], preset: "engineering" },
  { name: "شركة تطوير للمباني", sector: "شركة", city: "الرياض", emails: ["info@tbc.sa"], preset: "engineering" },
  { name: "شركة قدرة", sector: "شركة", city: "الرياض", preset: "all" },
  { name: "شركة عبدالله الجذي للمحاماة", sector: "شركة محاماة", city: "الرياض", emails: ["info@aljendy.law"], preset: "law" },
  { name: "شركة قراجنا", sector: "شركة تقنية", city: "الرياض", preset: "tech" },
  { name: "شركة استشارية سعودية EPEC", sector: "شركة استشارية", city: "الدمام", emails: ["admin@educa.com.sa"], preset: "finance" },
  { name: "شركة PTWAY", sector: "شركة تقنية", city: "الرياض", emails: ["Info@ptway.net"], preset: "tech" },
  { name: "بوصلة", sector: "شركة", city: "جدة", emails: ["hi@bawsala.sa"], preset: "all" },
  { name: "نول", sector: "شركة تقنية", city: "الرياض", emails: ["hr@noul.net"], preset: "tech" },
  { name: "سمارت سوفت", sector: "شركة تقنية", city: "الرياض", emails: ["info@smatsoft.sa"], preset: "tech" },
  { name: "شركة تطوير التعليمية", sector: "شركة تعليمية", city: "الرياض", preset: "education" },
  { name: "ولاء بلس", sector: "شركة تقنية", city: "الرياض", emails: ["Jobs@walaplus.com"], preset: "tech" },
  { name: "مشروع مولني", sector: "شركة", city: "جدة", emails: ["hr@mawlny.com"], preset: "all" },
  { name: "DataLexing", sector: "شركة تقنية", city: "الرياض", emails: ["Info@datalexing.com"], preset: "tech" },
  { name: "المراعي", sector: "شركة", city: "الرياض", preset: "all" },
  { name: "الصندوق السعودي للتنمية", sector: "حكومي", city: "الرياض", emails: ["info@sfd.gov.sa"], preset: "government" },
  { name: "صندوق الاستثمارات العامة", sector: "حكومي", city: "الرياض", preset: "finance" },
  { name: "صندوق التنمية الزراعية", sector: "حكومي", national: true, preset: "finance" },
  { name: "صندوق التنمية الصناعية السعودي", sector: "حكومي", city: "الرياض", emails: ["info@sidf.gov.sa"], preset: "finance" },
  { name: "صندوق التنمية العقارية", sector: "حكومي", city: "الرياض", emails: ["info@housing.gov.sa"], preset: "finance" },
  { name: "صندوق التنمية الوطني", sector: "حكومي", city: "الرياض", emails: ["info@ndf.gov.sa"], preset: "finance" },
  { name: "صندوق تنمية الموارد البشرية", sector: "حكومي", city: "الرياض", preset: "government" },
  { name: "البنك الأهلي السعودي", sector: "بنك", national: true, emails: ["contactus@alahli.com"], preset: "finance" },
  { name: "البنك السعودي للاستثمار", sector: "بنك", national: true, preset: "finance" },
  { name: "مصرف الإنماء", sector: "بنك", national: true, emails: ["info@alinma.com"], preset: "finance" },
  { name: "البنك السعودي الفرنسي", sector: "بنك", national: true, preset: "finance" },
  { name: "بنك الرياض", sector: "بنك", national: true, preset: "finance" },
  { name: "مجموعة سامبا المالية", sector: "بنك", national: true, emails: ["customerCare@samba.com"], preset: "finance" },
  { name: "مصرف الراجحي", sector: "بنك", national: true, preset: "finance" },
  { name: "البنك العربي الوطني", sector: "بنك", national: true, preset: "finance" },
  { name: "بنك البلاد", sector: "بنك", national: true, url: "https://saifi.hrdf.org.sa", preset: "finance" },
  { name: "بنك الجزيرة", sector: "بنك", national: true, emails: ["Call_Center_Supervisor@BAJ.Com.SA"], preset: "finance" },
  { name: "الهيئة السعودية للبيانات والذكاء الاصطناعي", sector: "حكومي", city: "الرياض", emails: ["info@sdaia.gov.sa"], preset: "tech" },
  { name: "هيئة حقوق الإنسان السعودية", sector: "حكومي", city: "الرياض", emails: ["info@hrc.gov.sa"], preset: "law" },
  { name: "هيئة تنمية الصادرات السعودية", sector: "حكومي", city: "الرياض", emails: ["info@saudiexports.sa"], preset: "government" },
  { name: "هيئة تقويم التعليم والتدريب", sector: "حكومي", city: "الرياض", emails: ["Faq@etec.gov.sa"], preset: "education" },
  { name: "الهيئة الملكية لمدينة الرياض", sector: "حكومي", city: "الرياض", emails: ["info@rcrc.gov.sa"], preset: "government" },
  { name: "الهيئة السعودية للمواصفات والمقاييس والجودة", sector: "حكومي", cities: ["الرياض", "جدة", "جازان", "الدمام"], emails: ["info@saso.gov.sa"], preset: "engineering" },
  { name: "هيئة المدن الاقتصادية السعودية", sector: "حكومي", cities: ["مدينة الملك عبدالله الاقتصادية"], regions: ["منطقة مكة المكرمة"], emails: ["info@ecza.gov.sa"], preset: "government" },
  { name: "هيئة المحتوى المحلي والمشتريات الحكومية", sector: "حكومي", city: "الرياض", emails: ["info@lcgpa.gov.sa"], preset: "government" },
  { name: "هيئة السوق المالية", sector: "حكومي", city: "الرياض", emails: ["info@cma.org.sa"], preset: "finance" },
  { name: "هيئة الاتصالات وتقنية المعلومات", sector: "حكومي", city: "الرياض", emails: ["info@citc.gov.sa"], preset: "tech" },
  { name: "الهيئة الوطنية لمكافحة الفساد", sector: "حكومي", city: "الرياض", emails: ["info@nazaha.gov.sa"], preset: "government" },
  { name: "الهيئة الملكية لمحافظة العلا", sector: "حكومي", city: "العلا", emails: ["rcuinfo@rcu.gov.sa"], preset: "tourism" },
  { name: "الهيئة الملكية للجبيل وينبع", sector: "حكومي", cities: ["الرياض", "الجبيل", "ينبع"], preset: "engineering" },
  { name: "الهيئة العامة للمنافسة", sector: "حكومي", city: "الرياض", emails: ["info@gac.gov.sa"], preset: "law" },
  { name: "الهيئة العامة للغذاء والدواء", sector: "حكومي", city: "الرياض", emails: ["webmaster@sfda.gov.sa"], preset: "health" },
  { name: "الهيئة العامة للعقار", sector: "حكومي", city: "الرياض", emails: ["info@rega.gov.sa"], preset: "government" },
  { name: "الهيئة العامة للطيران المدني", sector: "حكومي", cities: ["الرياض", "جدة", "أبها"], emails: ["HR-Support@gaca.gov.sa"], preset: "transport" },
  { name: "الهيئة العامة للترفيه", sector: "حكومي", city: "الرياض", emails: ["info@gea.gov.sa"], preset: "media" },
  { name: "الهيئة العامة للإعلام المرئي والمسموع", sector: "حكومي", cities: ["الرياض", "الدمام"], emails: ["info@gcam.gov.sa"], preset: "media" },
  { name: "الهيئة العامة للإحصاء", sector: "حكومي", cities: ["الرياض", "الدمام", "الهفوف", "المدينة", "أبها", "مكة", "جدة", "حائل"], emails: ["info@stats.gov.sa"], preset: "finance" },
  { name: "الهيئة السعودية للملكية الفكرية", sector: "حكومي", city: "الرياض", emails: ["Recruitment@saip.gov.sa"], preset: "law" },
  { name: "الهيئة السعودية للمدن الصناعية ومناطق التقنية", sector: "حكومي", cities: ["الرياض", "الدمام"], emails: ["info@modon.gov.sa"], preset: "engineering" },
  { name: "الهيئة السعودية للفضاء", sector: "حكومي", city: "الرياض", emails: ["Info@ssc.gov.sa"], preset: "engineering" },
  { name: "الهلال الأحمر السعودي", sector: "حكومي", city: "الرياض", emails: ["info@srca.org.sa"], preset: "health" },
  { name: "الهيئة السعودية للتخصصات الصحية", sector: "حكومي", cities: ["الرياض", "أبها", "الدمام", "بريدة", "الأحساء", "نجران", "حفر الباطن"], preset: "health" },
  { name: "الهيئة الوطنية للأمن السيبراني", sector: "حكومي", city: "الرياض", emails: ["Info@nca.gov.sa"], preset: "tech" },
  { name: "الهيئة السعودية للسياحة", sector: "حكومي", cities: ["الرياض", "المدينة", "الدمام", "بيشة", "تبوك", "جازان"], preset: "tourism" },
  { name: "الهيئة العامة للمنشآت الصغيرة والمتوسطة (منشآت)", sector: "حكومي", cities: ["الرياض", "جدة"], emails: ["Info@monshaat.gov.sa"], preset: "government" },
  { name: "هيئة الزكاة والضريبة والجمارك", sector: "حكومي", cities: ["الرياض", "جدة", "بريدة", "الهفوف", "أبها", "مكة", "جازان", "حائل"], emails: ["care@customs.gov.sa", "info@gazt.gov.sa"], preset: "finance" },
  { name: "الهيئة العامة للأوقاف", sector: "حكومي", cities: ["الرياض", "جدة"], emails: ["info@awqaf.gov.sa"], preset: "government" },
  { name: "البنك المركزي السعودي", sector: "حكومي", city: "الرياض", emails: ["info@sama.gov.sa"], preset: "finance" },
  { name: "المؤسسة العامة لتحلية المياه المالحة", sector: "حكومي", city: "الرياض", emails: ["alhassan@swcc.gov.sa", "TCPR@swcc.gov.sa"], preset: "engineering" },
  { name: "المؤسسة العامة للتدريب التقني والمهني", sector: "حكومي", city: "الرياض", emails: ["cso@tvtc.gov.sa"], preset: "education" },
  { name: "المؤسسة العامة للتقاعد", sector: "حكومي", city: "الرياض", emails: ["governor@pension.gov.sa"], preset: "government" },
  { name: "مؤسسة الملك عبدالعزيز ورجاله للموهبة والإبداع", sector: "حكومي", city: "الرياض", emails: ["Info@mawhiba.org.sa"], preset: "education" },
  { name: "المركز السعودي لكفاءة الطاقة", sector: "حكومي", city: "الرياض", emails: ["info@seec.gov.sa"], preset: "engineering" },
  { name: "المركز الوطني للتصديق الرقمي", sector: "حكومي", city: "الرياض", emails: ["info@ncdc.gov.sa"], preset: "tech" },
  { name: "المركز الوطني للتنافسية", sector: "حكومي", city: "الرياض", emails: ["info@ncc.gov.sa"], preset: "government" },
  { name: "المركز الوطني للذكاء الاصطناعي", sector: "حكومي", city: "الرياض", emails: ["info@sdaia.gov.sa"], preset: "tech" },
  { name: "المركز الوطني للوثائق والمحفوظات", sector: "حكومي", city: "الرياض", emails: ["info@ncar.gov.sa"], preset: "government" },
  { name: "مركز الملك عبدالله للدراسات والبحوث البترولية", sector: "حكومي", city: "الرياض", emails: ["jobs@kapsarc.org"], preset: "engineering" },
  { name: "وزارة الخارجية", sector: "وزارة", city: "الرياض", emails: ["info@mofa.gov.sa"], preset: "government" },
  { name: "وزارة المالية", sector: "وزارة", city: "الرياض", emails: ["ccc@mof.gov.sa"], preset: "finance" },
  { name: "وزارة العدل", sector: "وزارة", city: "الرياض", emails: ["1950@moj.gov.sa"], preset: "law" },
  { name: "وزارة الموارد البشرية والتنمية الاجتماعية", sector: "وزارة", city: "الرياض", emails: ["info@hrsd.gov.sa"], preset: "government" },
  { name: "وزارة التعليم", sector: "وزارة", city: "الرياض", emails: ["contact@mohe.gov.sa", "info@mohe.gov.sa"], preset: "education" },
  { name: "وزارة الاقتصاد والتخطيط", sector: "وزارة", city: "الرياض", emails: ["info@mep.gov.sa"], preset: "finance" },
  { name: "وزارة الاستثمار", sector: "وزارة", city: "الرياض", emails: ["InvestorCare@misa.gov.sa"], preset: "finance" },
  { name: "وزارة الطاقة", sector: "وزارة", city: "الرياض", emails: ["webmaster@moenergy.gov.sa"], preset: "engineering" },
  { name: "وزارة الثقافة", sector: "وزارة", city: "الرياض", emails: ["info@moc.gov.sa"], preset: "media" },
  { name: "وزارة الشؤون البلدية والقروية والإسكان", sector: "وزارة", city: "الرياض", emails: ["info@housing.gov.sa"], preset: "engineering" },
  { name: "وزارة الإعلام", sector: "وزارة", city: "الرياض", emails: ["info@media.gov.sa"], preset: "media" },
  { name: "وزارة الاتصالات وتقنية المعلومات", sector: "وزارة", city: "الرياض", preset: "tech" },
  { name: "وزارة البيئة والمياه والزراعة", sector: "وزارة", city: "الرياض", preset: "engineering" },
  { name: "وزارة التجارة", sector: "وزارة", city: "الرياض", emails: ["CS@mc.gov.sa"], preset: "government" },
];

export const trainingInteractiveMeta = {
  sourceLabel: "دليل التدريب التفاعلي",
  organizationsCount: rawTrainingInteractiveOrganizations.length,
  lastVerified: "2026-08-07",
};

export const trainingInteractiveOrganizations =
  rawTrainingInteractiveOrganizations.map(buildOrganization);
