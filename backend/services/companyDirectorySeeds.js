const normalizeCompanyComparable = (value = "") =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[أإآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ـ/g, "")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const companyAliasesMatchName = (company = {}, organizationName = "") => {
  const candidate = normalizeCompanyComparable(organizationName);
  if (!candidate) return false;

  const aliases = [
    company.name,
    company.nameAr,
    company.nameEn,
    ...(Array.isArray(company.aliases) ? company.aliases : []),
    ...(Array.isArray(company.contentAliases) ? company.contentAliases : []),
  ]
    .map(normalizeCompanyComparable)
    .filter((value) => value.length >= 3);

  return aliases.some((alias) => candidate === alias || candidate.includes(alias));
};

// These are public directory records, not company-portal accounts. The city is
// intentionally empty because each page represents a national organization.
const DIRECTORY_COMPANY_SEEDS = [
  {
    name: "أرامكو السعودية",
    nameEn: "Saudi Aramco",
    slug: "aramco",
    sector: "الطاقة",
    website: "https://www.aramco.com/",
    shortDescription: "تجارب ومقابلات وفرص التدريب المرتبطة بأرامكو السعودية.",
    aliases: ["أرامكو", "ارامكو", "أرامكو السعودية", "شركة أرامكو السعودية", "Aramco", "Saudi Aramco", "Saudi Arabian Oil Company"],
  },
  {
    name: "STC",
    nameAr: "شركة الاتصالات السعودية",
    nameEn: "Saudi Telecom Company",
    slug: "stc",
    sector: "الاتصالات والتقنية",
    website: "https://www.stc.com.sa/",
    shortDescription: "تجارب ومقابلات وفرص التدريب في STC.",
    aliases: ["STC", "اس تي سي", "شركة الاتصالات السعودية", "الاتصالات السعودية", "Saudi Telecom Company", "Saudi Telecommunications Company"],
  },
  {
    name: "سابك",
    nameEn: "SABIC",
    slug: "sabic",
    sector: "الصناعة والكيميائيات",
    website: "https://www.sabic.com/",
    shortDescription: "تجارب ومقابلات وفرص التدريب في سابك.",
    aliases: ["سابك", "SABIC", "Saudi Basic Industries Corporation", "الشركة السعودية للصناعات الأساسية"],
  },
  {
    name: "علم",
    nameEn: "Elm",
    slug: "elm",
    sector: "التقنية والتحول الرقمي",
    website: "https://www.elm.sa/",
    shortDescription: "تجارب ومقابلات وفرص التدريب في شركة علم.",
    aliases: ["علم", "Elm", "شركة علم", "Elm Company"],
  },
  {
    name: "سدايا",
    nameEn: "SDAIA",
    slug: "sdaia",
    sector: "البيانات والذكاء الاصطناعي",
    website: "https://sdaia.gov.sa/",
    shortDescription: "تجارب ومقابلات وفرص التدريب المرتبطة بسدايا.",
    aliases: ["سدايا", "SDAIA", "الهيئة السعودية للبيانات والذكاء الاصطناعي", "Saudi Data and AI Authority"],
  },
  {
    name: "نيوم",
    nameEn: "NEOM",
    slug: "neom",
    sector: "التطوير والمشاريع الكبرى",
    website: "https://www.neom.com/",
    shortDescription: "تجارب ومقابلات وفرص التدريب في نيوم.",
    aliases: ["نيوم", "NEOM", "شركة نيوم"],
  },
  {
    name: "صندوق الاستثمارات العامة",
    nameEn: "Public Investment Fund",
    slug: "pif",
    sector: "الاستثمار",
    website: "https://www.pif.gov.sa/",
    shortDescription: "تجارب ومقابلات وفرص التدريب المرتبطة بصندوق الاستثمارات العامة.",
    aliases: ["صندوق الاستثمارات العامة", "PIF", "Public Investment Fund"],
  },
  {
    name: "البنك الأهلي السعودي",
    nameEn: "Saudi National Bank",
    slug: "snb",
    sector: "الخدمات المالية",
    website: "https://www.alahli.com/",
    shortDescription: "تجارب ومقابلات وفرص التدريب في البنك الأهلي السعودي.",
    aliases: ["البنك الأهلي السعودي", "البنك الأهلي", "البنك الاهلي", "SNB", "Saudi National Bank", "AlAhli Bank", "البنك الوطني السعودي"],
  },
  {
    name: "مصرف الراجحي",
    nameEn: "Al Rajhi Bank",
    slug: "al-rajhi-bank",
    sector: "الخدمات المالية",
    website: "https://www.alrajhibank.com.sa/",
    shortDescription: "تجارب ومقابلات وفرص التدريب في مصرف الراجحي.",
    aliases: ["مصرف الراجحي", "بنك الراجحي", "الراجحي", "Al Rajhi Bank", "Alrajhi Bank"],
  },
  {
    name: "بنك الرياض",
    nameEn: "Riyad Bank",
    slug: "riyad-bank",
    sector: "الخدمات المالية",
    website: "https://www.riyadbank.com/",
    shortDescription: "تجارب ومقابلات وفرص التدريب في بنك الرياض.",
    aliases: ["بنك الرياض", "Riyad Bank", "Riyadh Bank"],
  },
  {
    name: "البنك المركزي السعودي",
    nameEn: "Saudi Central Bank",
    slug: "sama",
    sector: "الخدمات المالية",
    website: "https://www.sama.gov.sa/",
    shortDescription: "تجارب ومقابلات وفرص التدريب في البنك المركزي السعودي.",
    aliases: ["البنك المركزي السعودي", "ساما", "SAMA", "Saudi Central Bank", "Saudi Arabian Monetary Authority"],
  },
  {
    name: "هيئة السوق المالية",
    nameEn: "Capital Market Authority",
    slug: "cma",
    sector: "القطاع المالي",
    website: "https://cma.org.sa/",
    shortDescription: "تجارب ومقابلات وفرص التدريب في هيئة السوق المالية.",
    aliases: ["هيئة السوق المالية", "CMA", "Capital Market Authority"],
  },
  {
    name: "التأمينات الاجتماعية",
    nameEn: "GOSI",
    slug: "gosi",
    sector: "الخدمات الحكومية",
    website: "https://www.gosi.gov.sa/",
    shortDescription: "تجارب ومقابلات وفرص التدريب في التأمينات الاجتماعية.",
    aliases: ["التأمينات الاجتماعية", "التأمينات", "التامينات", "GOSI", "General Organization for Social Insurance"],
  },
  {
    name: "أكوا باور",
    nameEn: "ACWA Power",
    slug: "acwa-power",
    sector: "الطاقة والمياه",
    website: "https://www.acwapower.com/",
    shortDescription: "تجارب ومقابلات وفرص التدريب في أكوا باور.",
    aliases: ["أكوا باور", "اكوا باور", "ACWA Power", "Acwa Power"],
  },
  {
    name: "القدية",
    nameEn: "Qiddiya",
    slug: "qiddiya",
    sector: "التطوير والمشاريع الكبرى",
    website: "https://qiddiya.com/",
    shortDescription: "تجارب ومقابلات وفرص التدريب في القدية.",
    aliases: ["القدية", "Qiddiya", "Qiddiya Investment Company"],
  },
  {
    name: "البحر الأحمر الدولية",
    nameEn: "Red Sea Global",
    slug: "red-sea-global",
    sector: "التطوير والسياحة",
    website: "https://www.redseaglobal.com/",
    shortDescription: "تجارب ومقابلات وفرص التدريب في البحر الأحمر الدولية.",
    aliases: ["البحر الأحمر الدولية", "البحر الاحمر الدولية", "Red Sea Global", "RSG"],
  },
  {
    name: "الخطوط السعودية",
    nameEn: "Saudia",
    slug: "saudia",
    sector: "الطيران",
    website: "https://www.saudia.com/",
    shortDescription: "تجارب ومقابلات وفرص التدريب في الخطوط السعودية.",
    aliases: ["الخطوط السعودية", "الخطوط السعوديه", "السعودية", "السعوديه", "Saudia", "Saudi Arabian Airlines"],
  },
  {
    name: "طيران ناس",
    nameEn: "flynas",
    slug: "flynas",
    sector: "الطيران",
    website: "https://www.flynas.com/",
    shortDescription: "تجارب ومقابلات وفرص التدريب في طيران ناس.",
    aliases: ["طيران ناس", "طيرانناس", "flynas", "Flynas"],
  },
  {
    name: "موبايلي",
    nameEn: "Mobily",
    slug: "mobily",
    sector: "الاتصالات",
    website: "https://www.mobily.com.sa/",
    shortDescription: "تجارب ومقابلات وفرص التدريب في موبايلي.",
    aliases: ["موبايلي", "Mobily", "شركة اتحاد اتصالات"],
  },
  {
    name: "زين السعودية",
    nameEn: "Zain KSA",
    slug: "zain",
    sector: "الاتصالات",
    website: "https://sa.zain.com/",
    shortDescription: "تجارب ومقابلات وفرص التدريب في زين السعودية.",
    aliases: ["زين", "زين السعودية", "زين السعوديه", "Zain", "Zain KSA", "Zain Saudi Arabia"],
  },
];

module.exports = {
  DIRECTORY_COMPANY_SEEDS,
  companyAliasesMatchName,
  normalizeCompanyComparable,
};
