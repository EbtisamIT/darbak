import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import majors from "../majors";
import API_BASE_URL from "../config/api";
import TrainingGuideBanner from "../components/TrainingGuideBanner";
import { trackEvent } from "../utils/analytics";
import { requestPremiumAccess } from "../utils/premiumAccess";
import { getSavedItemIds, toggleSavedItem } from "../utils/savedItems";
import {
  buildExperiencesSeoPath,
  getSeoCityBySlug,
  getSeoSpecialtyBySlug,
} from "../utils/seoRoutes";
import { buildExperiencesSeoMeta, setPageSeo } from "../utils/seoMetadata";

const EXPERIENCES_CACHE_KEY = "darbak_experiences_cache_v2";
const INITIAL_VISIBLE_COUNT = 36;
const SHOW_TRAINING_GUIDE_BANNER = true;
const CITY_REGION_GROUPS = {
  "منطقة الرياض": [
    "الرياض",
    "الخرج",
    "الدرعية",
    "المجمعة",
    "الزلفي",
    "الدوادمي",
    "وادي الدواسر",
    "القويعية",
    "شقراء",
    "عفيف",
    "حوطة بني تميم",
  ],
  "منطقة مكة": [
    "جدة",
    "مكة المكرمة",
    "الطائف",
    "رابغ",
    "القنفذة",
    "الليث",
    "رنية",
    "تربة",
    "الخرمة",
    "بحرة",
  ],
  "منطقة المدينة": [
    "المدينة المنورة",
    "ينبع",
    "العلا",
    "خيبر",
    "بدر",
    "المهد",
    "الحناكية",
  ],
  الشرقية: [
    "الدمام",
    "الخبر",
    "الظهران",
    "الأحساء",
    "الجبيل",
    "القطيف",
    "رأس تنورة",
    "حفر الباطن",
    "الخفجي",
    "بقيق",
    "النعيرية",
    "قرية العليا",
  ],
  القصيم: [
    "بريدة",
    "عنيزة",
    "الرس",
    "المذنب",
    "البكيرية",
    "البدائع",
    "الأسياح",
    "رياض الخبراء",
  ],
  "منطقة عسير": [
    "أبها",
    "خميس مشيط",
    "بيشة",
    "محايل عسير",
    "النماص",
    "تنومة",
    "رجال ألمع",
    "سراة عبيدة",
    "ظهران الجنوب",
  ],
  "منطقة تبوك": ["تبوك", "الوجه", "ضباء", "أملج", "تيماء", "البدع"],
  "منطقة حائل": ["حائل"],
  "منطقة الحدود الشمالية": ["عرعر", "رفحاء", "طريف"],
  "منطقة جازان": [
    "جازان",
    "صبيا",
    "أبو عريش",
    "صامطة",
    "بيش",
    "الدرب",
    "فرسان",
  ],
  "منطقة نجران": ["نجران", "شرورة", "حبونا", "يدمة"],
  "منطقة الباحة": ["الباحة", "بلجرشي", "المندق", "العقيق", "المخواة"],
  "منطقة الجوف": ["سكاكا", "القريات", "دومة الجندل", "طبرجل"],
};
const CITY_FILTER_ALIASES = {
  "منطقة مكة المكرمة": "منطقة مكة",
  "منطقة المدينة المنورة": "منطقة المدينة",
  "المنطقة الشرقية": "الشرقية",
  شرقية: "الشرقية",
  "منطقة القصيم": "القصيم",
  قصيم: "القصيم",
};
const MAIN_CITY_FILTERS = [
  "الشرقية",
  "القصيم",
  "منطقة الرياض",
  "منطقة مكة",
  "منطقة المدينة",
  "منطقة عسير",
  "منطقة تبوك",
  "منطقة حائل",
  "منطقة الحدود الشمالية",
  "منطقة جازان",
  "منطقة نجران",
  "منطقة الباحة",
  "منطقة الجوف",
  "الرياض",
  "جدة",
  "مكة المكرمة",
  "المدينة المنورة",
  "الدمام",
  "الخبر",
  "الظهران",
  "الأحساء",
  "الجبيل",
  "الطائف",
  "أبها",
  "خميس مشيط",
  "جازان",
  "تبوك",
  "حائل",
  "بريدة",
  "عنيزة",
  "الرس",
  "نجران",
  "الباحة",
  "سكاكا",
  "عرعر",
  "ينبع",
  "الخرج",
  "العلا",
];

const getCompanySearchFromUrl = (search = "") => {
  try {
    return new URLSearchParams(search).get("company") || "";
  } catch {
    return "";
  }
};

const getInitialCompanySearch = () => {
  if (typeof window === "undefined") return "";
  return getCompanySearchFromUrl(window.location.search);
};

const getCachedExperiences = () => {
  if (typeof window === "undefined") return [];

  try {
    const cached = window.localStorage.getItem(EXPERIENCES_CACHE_KEY);
    if (!cached) return [];

    const parsed = JSON.parse(cached);
    return Array.isArray(parsed?.data) ? parsed.data : [];
  } catch {
    return [];
  }
};

const cacheExperiences = (data) => {
  if (typeof window === "undefined" || !Array.isArray(data)) return;

  try {
    window.localStorage.setItem(
      EXPERIENCES_CACHE_KEY,
      JSON.stringify({ data, cachedAt: Date.now() })
    );
  } catch {
    // Ignore storage quota or private browsing errors.
  }
};

const COMPANY_SEARCH_ALIASES = {
  // Generic government entity terms.
  وزاره: ["ministry", "minister"],
  الوزاره: ["ministry", "minister"],
  وزارات: ["ministries", "ministry"],
  ministry: ["وزاره", "الوزاره", "وزارات"],
  ministries: ["وزارات", "وزاره"],
  هيئه: ["authority", "commission", "agency"],
  الهيئه: ["authority", "commission", "agency"],
  authority: ["هيئه", "الهيئه"],
  commission: ["هيئه", "الهيئه"],
  agency: ["هيئه", "الهيئه"],
  صندوق: ["fund"],
  fund: ["صندوق"],
  مركز: ["center", "centre"],
  center: ["مركز"],
  centre: ["مركز"],
  جامعه: ["university"],
  university: ["جامعه"],
  امانه: ["municipality"],
  municipality: ["امانه", "بلديه"],
  بلديه: ["municipality"],
  الرياض: ["riyadh"],
  riyadh: ["الرياض"],

  // Common companies and national programs.
  علم: ["elm"],
  elm: ["علم"],
  stc: ["اس تي سي", "الاتصالات السعودية"],
  "اس تي سي": ["stc", "الاتصالات السعودية"],
  "الاتصالات السعودية": ["stc", "اس تي سي"],
  aramco: ["ارامكو", "أرامكو"],
  ارامكو: ["aramco", "أرامكو"],
  سابك: ["sabic"],
  sabic: ["سابك"],
  نيوم: ["neom"],
  neom: ["نيوم"],
  روشن: ["roshn"],
  roshn: ["روشن"],
  القديه: ["qiddiya"],
  qiddiya: ["القديه", "قديه"],
  الدرعيه: ["diriyah"],
  diriyah: ["الدرعيه"],
  هدف: ["hrdf", "صندوق تنميه الموارد البشريه"],
  hrdf: ["هدف", "صندوق تنمية الموارد البشرية"],
  منشات: ["monsha'at", "monshaat", "monshaat"],
  monshaat: ["منشآت", "منشات"],
  "monsha'at": ["منشآت", "منشات"],
  مسك: ["misk"],
  misk: ["مسك"],
  سدايا: ["sdaia"],
  sdaia: ["سدايا"],
  كاوست: ["kaust"],
  kaust: ["كاوست", "جامعه الملك عبدالله للعلوم والتقنيه"],

  // Ministries.
  "وزاره الصحه": ["moh", "ministry of health"],
  moh: ["وزارة الصحة"],
  "ministry of health": ["وزارة الصحة"],
  "وزاره التعليم": ["moe", "ministry of education"],
  moe: ["وزارة التعليم"],
  "ministry of education": ["وزارة التعليم"],
  "وزاره الماليه": ["mof", "ministry of finance"],
  mof: ["وزارة المالية"],
  "ministry of finance": ["وزارة المالية"],
  "وزاره العدل": ["moj", "ministry of justice"],
  moj: ["وزارة العدل"],
  "ministry of justice": ["وزارة العدل"],
  "وزاره الطاقه": ["ministry of energy"],
  "ministry of energy": ["وزارة الطاقة"],
  "وزاره الاستثمار": ["misa", "ministry of investment"],
  misa: ["وزارة الاستثمار"],
  "ministry of investment": ["وزارة الاستثمار"],
  "وزاره السياحه": ["ministry of tourism"],
  "ministry of tourism": ["وزارة السياحة"],
  "وزاره التجاره": ["mc", "ministry of commerce"],
  "ministry of commerce": ["وزارة التجارة"],
  "وزاره النقل": ["mot", "ministry of transport"],
  mot: ["وزارة النقل"],
  "ministry of transport": ["وزارة النقل"],
  "وزاره الاتصالات": ["mcit", "ministry of communications"],
  mcit: ["وزارة الاتصالات", "وزارة الاتصالات وتقنية المعلومات"],
  "ministry of communications": ["وزارة الاتصالات وتقنية المعلومات"],
  "وزاره الداخليه": ["moi", "ministry of interior"],
  moi: ["وزارة الداخلية"],
  "ministry of interior": ["وزارة الداخلية"],
  "وزاره الخارجيه": ["mofa", "ministry of foreign affairs"],
  mofa: ["وزارة الخارجية"],
  "ministry of foreign affairs": ["وزارة الخارجية"],
  "وزاره الموارد البشريه": ["mhrsd", "ministry of human resources"],
  mhrsd: ["وزارة الموارد البشرية", "وزارة الموارد البشرية والتنمية الاجتماعية"],
  "ministry of human resources": [
    "وزارة الموارد البشرية",
    "وزارة الموارد البشرية والتنمية الاجتماعية",
  ],
  "وزاره البيئه": ["mewa", "ministry of environment"],
  mewa: ["وزارة البيئة", "وزارة البيئة والمياه والزراعة"],
  "ministry of environment": ["وزارة البيئة والمياه والزراعة"],
  "وزاره الصناعه": ["mim", "ministry of industry"],
  mim: ["وزارة الصناعة", "وزارة الصناعة والثروة المعدنية"],
  "ministry of industry": ["وزارة الصناعة والثروة المعدنية"],
  "وزاره البلديات": ["momrah", "ministry of municipal"],
  momrah: ["وزارة البلديات", "وزارة الشؤون البلدية والقروية والإسكان"],
  "ministry of municipal": ["وزارة الشؤون البلدية والقروية والإسكان"],

  // Authorities, commissions, and public entities.
  "هيئه الحكومه الرقميه": ["dga", "digital government authority"],
  dga: ["هيئة الحكومة الرقمية"],
  "digital government authority": ["هيئة الحكومة الرقمية"],
  "هيئه الاتصالات": ["cst", "citc", "communications authority"],
  cst: ["هيئة الاتصالات", "هيئة الاتصالات والفضاء والتقنية"],
  citc: ["هيئة الاتصالات", "هيئة الاتصالات وتقنية المعلومات"],
  "communications authority": ["هيئة الاتصالات والفضاء والتقنية"],
  "هيئه السوق الماليه": ["cma", "capital market authority"],
  cma: ["هيئة السوق المالية"],
  "capital market authority": ["هيئة السوق المالية"],
  "هيئه الزكاه": ["zatca", "zakat tax customs authority"],
  زاتكا: ["zatca"],
  zatca: ["هيئة الزكاة", "هيئة الزكاة والضريبة والجمارك", "زاتكا"],
  "zakat tax customs authority": ["هيئة الزكاة والضريبة والجمارك"],
  "البنك المركزي": ["sama", "saudi central bank"],
  ساما: ["sama"],
  sama: ["البنك المركزي السعودي", "ساما"],
  "saudi central bank": ["البنك المركزي السعودي"],
  "هيئه الغذاء والدواء": ["sfda", "food and drug authority"],
  sfda: ["هيئة الغذاء والدواء"],
  "food and drug authority": ["هيئة الغذاء والدواء"],
  "الهيئه العامه للاحصاء": ["gastat", "general authority for statistics"],
  gastat: ["الهيئة العامة للإحصاء"],
  "general authority for statistics": ["الهيئة العامة للإحصاء"],
  "هيئه المحتوي المحلي": ["lcgpa", "local content"],
  lcgpa: ["هيئة المحتوى المحلي والمشتريات الحكومية"],
  "local content": ["هيئة المحتوى المحلي والمشتريات الحكومية"],
  "هيئه المدن والمناطق الاقتصاديه": ["ecza", "economic cities authority"],
  ecza: ["هيئة المدن والمناطق الاقتصادية الخاصة"],
  "economic cities authority": ["هيئة المدن والمناطق الاقتصادية الخاصة"],
  "هيئه تطوير بوابه الدرعيه": ["dgda", "diriyah gate"],
  dgda: ["هيئة تطوير بوابة الدرعية"],
  "diriyah gate": ["هيئة تطوير بوابة الدرعية"],
  "الهيئه الملكيه": ["royal commission"],
  "royal commission": ["الهيئة الملكية"],
  "الهيئه الملكيه لمدينه الرياض": ["rcrc", "royal commission for riyadh city"],
  rcrc: ["الهيئة الملكية لمدينة الرياض"],
  "royal commission for riyadh city": ["الهيئة الملكية لمدينة الرياض"],
  "امانه منطقه الرياض": ["riyadh municipality"],
  "riyadh municipality": ["أمانة منطقة الرياض"],
  "مطارات الرياض": ["riyadh airports"],
  "riyadh airports": ["مطارات الرياض"],
  "طيران الرياض": ["riyadh air"],
  "riyadh air": ["طيران الرياض"],
  "صندوق الاستثمارات العامه": ["pif", "public investment fund"],
  pif: ["صندوق الاستثمارات العامة"],
  "public investment fund": ["صندوق الاستثمارات العامة"],
  sadaia: ["سدايا", "هيئة البيانات والذكاء الاصطناعي", "sdaia"],
};

const MAJOR_SEARCH_ALIASES = {
  الحاسب: [
    "تقنيه",
    "تقنية",
    "it",
    "cs",
    "computer",
    "software",
    "programming",
    "برمجه",
    "برمجة",
    "ذكاء اصطناعي",
    "ai",
    "امن سيبراني",
    "cyber",
    "نظم معلومات",
    "علوم حاسب",
  ],
  الطب: ["صحه", "صحة", "health", "medical", "medicine", "تمريض", "صيدله"],
  الإدارة: ["اداره", "ادارة", "management", "admin", "administration"],
  "الموارد البشرية": ["موارد", "موارد بشرية", "hr", "human resources", "توظيف", "شؤون موظفين"],
  المالية: ["finance", "مالي", "ماليه", "استثمار", "investment", "بنوك", "banking"],
  المحاسبة: ["محاسبه", "accounting", "accountant", "audit", "مراجعه", "مراجعة"],
  التأمين: ["تامين", "تأمين", "insurance", "insurer", "claims", "مطالبات"],
  "إدارة المخاطر": ["مخاطر", "risk", "risk management", "compliance", "حوكمه", "حوكمة"],
  التسويق: ["marketing", "اعلان", "إعلان", "مبيعات", "sales", "تسويق رقمي"],
  "إدارة الأعمال": ["ادارة اعمال", "اداره اعمال", "business", "business administration", "mba"],
  الاقتصاد: ["economics", "اقتصاد", "تحليل اقتصادي", "economic"],
  "نظم المعلومات الإدارية": ["mis", "نظم معلومات اداريه", "نظم معلومات إدارية", "business information systems"],
  "سلاسل الإمداد واللوجستيات": ["لوجستيات", "logistics", "supply chain", "سلاسل امداد", "مشتريات"],
  "قانون ومحاماة": ["قانون", "محاماه", "محاماة", "law", "legal", "حقوق"],
  "الخدمة الاجتماعية": ["خدمه اجتماعيه", "خدمة اجتماعية", "social work", "social service", "اجتماع"],
  التصميم: ["design", "graphic", "ui", "ux", "تصميم جرافيك", "واجهات", "تجربة مستخدم"],
  "اللغة العربية": ["عربي", "arabic", "لغه عربيه", "لغة عربية"],
  "اللغة الإنجليزية": ["انجليزي", "انجليزيه", "english", "translation", "ترجمه"],
  "الشريعة والدين": ["شريعه", "دين", "اسلام", "islamic"],
  الهندسة: ["هندسه", "engineering", "engineer", "مهندس", "مدني", "كهرباء", "ميكانيكا"],
  العلوم: ["science", "علوم", "رياضيات", "math", "كيمياء", "chemistry", "فيزياء", "physics", "احياء", "أحياء", "biology"],
  "العلوم الصحية": ["health sciences", "مختبرات", "lab", "اشعه", "أشعة", "radiology", "علاج طبيعي", "physical therapy"],
  "العلوم البيئية": ["بيئه", "بيئة", "environment", "environmental", "استدامه", "استدامة"],
  "علوم الأغذية": ["اغذيه", "أغذية", "food science", "تغذيه", "تغذية", "nutrition"],
  "الصحافة والإعلام": [
    "اعلام",
    "إعلام",
    "صحافه",
    "صحافة",
    "media",
    "journalism",
    "علاقات عامه",
  ],
  "العلاقات العامة": ["علاقات", "علاقات عامه", "public relations", "pr", "اتصال مؤسسي"],
  "السياحة والضيافة": ["سياحه", "سياحة", "ضيافه", "ضيافة", "tourism", "hospitality", "hotel", "فنادق"],
  "الأمن والسلامة": ["امن", "أمن", "سلامه", "سلامة", "safety", "security", "hse"],
};

const normalizeSearchText = (value = "") =>
  value
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[أإآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ـ/g, "")
    .replace(/[\u064B-\u065F]/g, "")
    .replace(/\s+/g, " ");

const getCanonicalCityFilter = (city = "") => {
  const normalizedCity = normalizeSearchText(city);
  const matchedAlias = Object.entries(CITY_FILTER_ALIASES).find(
    ([alias]) => normalizeSearchText(alias) === normalizedCity
  );

  return matchedAlias?.[1] || city;
};

const getCityFilterScope = (city = "") => {
  if (!city) return [];

  const canonicalCity = getCanonicalCityFilter(city);
  const regionCities = CITY_REGION_GROUPS[canonicalCity];

  if (!regionCities) return [city];

  return [
    canonicalCity,
    city,
    ...Object.entries(CITY_FILTER_ALIASES)
      .filter(([, value]) => value === canonicalCity)
      .map(([alias]) => alias),
    ...regionCities,
  ];
};

const isUnclearMajorText = (value = "") => {
  const text = value.toString().trim();
  if (!text) return true;

  const letters = text.match(/[A-Za-z\u0600-\u06FF]/g) || [];
  return letters.length < 2;
};

const getReadableMajor = (exp = {}) =>
  isUnclearMajorText(exp.major) ? exp.majorCategory || exp.major : exp.major;

const getCompanySearchTerms = (value) => {
  const normalizedValue = normalizeSearchText(value);

  if (!normalizedValue) return [];

  const aliases = Object.entries(COMPANY_SEARCH_ALIASES).flatMap(
    ([company, alternatives]) => {
      const normalizedCompany = normalizeSearchText(company);
      const normalizedAlternatives = alternatives.map(normalizeSearchText);

      if (
        normalizedCompany.includes(normalizedValue) ||
        normalizedAlternatives.some((alias) => alias.includes(normalizedValue))
      ) {
        return [normalizedCompany, ...normalizedAlternatives];
      }

      return [];
    }
  );

  return Array.from(new Set([normalizedValue, ...aliases]));
};

const getMajorSearchTerms = (value) => {
  const normalizedValue = normalizeSearchText(value);

  if (!normalizedValue) return [];

  const aliases = Object.entries(MAJOR_SEARCH_ALIASES).flatMap(
    ([major, alternatives]) => {
      const normalizedMajor = normalizeSearchText(major);
      const normalizedAlternatives = alternatives.map(normalizeSearchText);

      if (
        normalizedMajor.includes(normalizedValue) ||
        normalizedAlternatives.some((alias) => alias.includes(normalizedValue))
      ) {
        return [normalizedMajor, ...normalizedAlternatives];
      }

      return [];
    }
  );

  return Array.from(new Set([normalizedValue, ...aliases]));
};

const ExperiencesPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const routeParams = useParams();
  const seoCity = getSeoCityBySlug(routeParams.citySlug)?.label || "";
  const seoSpecialty =
    getSeoSpecialtyBySlug(routeParams.majorSlug)?.label || "";
  const seoPath = buildExperiencesSeoPath({
    city: seoCity,
    specialty: seoSpecialty,
  });
  const [experiences, setExperiences] = useState(() => getCachedExperiences());
  const [loading, setLoading] = useState(() => getCachedExperiences().length === 0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedExperience, setSelectedExperience] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedMajors, setSelectedMajors] = useState([]);
  const [majorsMenuOpen, setMajorsMenuOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [companySearch, setCompanySearch] = useState(getInitialCompanySearch);
  const [sortOption, setSortOption] = useState(() =>
    getInitialCompanySearch() ? "relevance" : "latest"
  );
  const [selectedCity, setSelectedCity] = useState("");
  const [rewardFilter, setRewardFilter] = useState("");
  const [environmentFilter, setEnvironmentFilter] = useState("");
  const [fetchError, setFetchError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalExperiences, setTotalExperiences] = useState(
    () => getCachedExperiences().length
  );
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchAnalyticsVersion, setSearchAnalyticsVersion] = useState(0);
  const [savedItemIds, setSavedItemIds] = useState(() => getSavedItemIds());
  const lastTrackedExperienceSearchRef = useRef("");

  const steps = ["معلومات التدريب", "التقييم والتجربة"];

  useEffect(() => {
    setPageSeo(
      buildExperiencesSeoMeta({
        city: seoCity,
        specialty: seoSpecialty,
        path: seoPath,
      })
    );
  }, [seoCity, seoPath, seoSpecialty]);

  useEffect(() => {
    setSelectedMajors(seoSpecialty ? [seoSpecialty] : []);
    setSelectedCity(seoCity || "");
  }, [seoCity, seoSpecialty]);

  useEffect(() => {
    const companyFromUrl = getCompanySearchFromUrl(location.search);
    if (companyFromUrl) {
      setCompanySearch(companyFromUrl);
      setSortOption("relevance");
      return;
    }

    if (!location.search) {
      setCompanySearch("");
      setSortOption("latest");
    }
  }, [location.search]);

  useEffect(() => {
    const updateSavedItems = () => setSavedItemIds(getSavedItemIds());
    window.addEventListener("darbak:saved-items-updated", updateSavedItems);
    return () =>
      window.removeEventListener("darbak:saved-items-updated", updateSavedItems);
  }, []);

  const clearCompanySearch = () => {
    setCompanySearch("");
    if (getCompanySearchFromUrl(location.search)) {
      navigate("/experiences", { replace: true });
    }
  };

  const ratingLabels = {
    excellent: "😍 ممتازة ومثرية جدًا",
    nice: "😊 لطيفة وخفيفة",
    enriching: "💡 مثرية وتعلمت منها كثير",
    challenging: "🤔 متوسطة وفيها تحديات",
    notgood: "😕 غير مرضية",
  };

  const toggleMajor = (major) => {
    if (major === "الكل") {
      setSelectedMajors([]);
      setMajorsMenuOpen(false);
      return;
    }

    setSelectedMajors((prev) =>
      prev.includes(major)
        ? prev.filter((m) => m !== major)
        : [...prev, major]
    );
  };

  const normalizedCompanySearch = useMemo(
    () => normalizeSearchText(companySearch),
    [companySearch]
  );

  const searchTerms = useMemo(
    () =>
      Array.from(
        new Set([
          ...getCompanySearchTerms(companySearch),
          ...getMajorSearchTerms(companySearch),
        ])
      ),
    [companySearch]
  );

  const getSearchScore = useCallback((exp) => {
    if (searchTerms.length === 0) return 0;

    const searchableValues = [
      exp.organizationName,
      exp.companyName,
      exp.majorCategory,
      exp.major,
    ]
      .filter(Boolean)
      .map(normalizeSearchText);

    return searchTerms.reduce((score, term) => {
      const exactMatch = searchableValues.some((value) => value === term);
      const startsWithMatch = searchableValues.some((value) =>
        value.startsWith(term)
      );
      const includesMatch = searchableValues.some((value) =>
        value.includes(term)
      );

      if (exactMatch) return score + 6;
      if (startsWithMatch) return score + 4;
      if (includesMatch) return score + 2;
      return score;
    }, 0);
  }, [searchTerms]);

  const selectedMajorTerms = useMemo(
    () =>
      Array.from(
        new Set(
          selectedMajors.flatMap((selectedMajor) => {
            const majorItem = majors.find((item) => item.name === selectedMajor);
            return majorItem
              ? [majorItem.name, ...(majorItem.subMajors || [])]
              : [selectedMajor];
          })
        )
      ),
    [selectedMajors]
  );

  const selectedCityTerms = useMemo(
    () => new Set(getCityFilterScope(selectedCity).map(normalizeSearchText)),
    [selectedCity]
  );

  const filteredExperiences = useMemo(
    () =>
      experiences
        .filter((exp) => {
          const matchesMajor =
            selectedMajors.length === 0 ||
            selectedMajorTerms.includes(exp.major) ||
            selectedMajorTerms.includes(exp.majorCategory);
          const matchesCity =
            !selectedCity ||
            selectedCityTerms.has(normalizeSearchText(exp.city));

          const searchableNames = [
            exp.organizationName,
            exp.companyName,
            exp.majorCategory,
            exp.major,
          ].filter(Boolean);

          const normalizedSearchableNames =
            searchableNames.map(normalizeSearchText);

          const matchesSearch =
            normalizedCompanySearch.length === 0 ||
            normalizedSearchableNames.some((name) =>
              searchTerms.some((term) => name.includes(term))
            );
          const matchesReward =
            !rewardFilter || exp.hadReward === rewardFilter;
          const matchesEnvironment =
            !environmentFilter || exp.trainingEnvironment === environmentFilter;

          return (
            matchesMajor &&
            matchesCity &&
            matchesSearch &&
            matchesReward &&
            matchesEnvironment
          );
        })
        .sort((a, b) => {
          if (sortOption === "rating") {
            return (b.starRating || 0) - (a.starRating || 0);
          }

          if (sortOption === "relevance" && normalizedCompanySearch) {
            const scoreDiff = getSearchScore(b) - getSearchScore(a);
            if (scoreDiff !== 0) return scoreDiff;
          }

          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        }),
    [
      experiences,
      selectedMajors,
      selectedMajorTerms,
      selectedCity,
      selectedCityTerms,
      normalizedCompanySearch,
      searchTerms,
      rewardFilter,
      environmentFilter,
      sortOption,
      getSearchScore,
    ]
  );

  const visibleExperiences = useMemo(
    () => filteredExperiences,
    [filteredExperiences]
  );

  const fetchExperiencesPage = useCallback(
    async (nextPage = 1, { append = false } = {}) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        const { data } = await axios.get(`${API_BASE_URL}/api/experiences`, {
          params: {
            page: nextPage,
            limit: INITIAL_VISIBLE_COUNT,
            sort: sortOption,
            majors: selectedMajorTerms.join(","),
            city: selectedCity,
            terms: searchTerms.join("|"),
            hadReward: rewardFilter,
            trainingEnvironment: environmentFilter,
          },
        });

        const items = Array.isArray(data) ? data : data.data;

        if (!Array.isArray(items)) {
          throw new Error("Unexpected API response");
        }

        setExperiences((prev) => (append ? [...prev, ...items] : items));

        if (!append) {
          cacheExperiences(items);
        }

        setCurrentPage(data.page || nextPage);
        setTotalExperiences(data.total ?? items.length);
        setHasMore(Boolean(data.hasMore));
        setFetchError("");

        if (!append) {
          setSearchAnalyticsVersion((version) => version + 1);
        }
      } catch (err) {
        console.error(err);
        setFetchError("تعذر تحميل التجارب حاليًا. تأكدي من اتصال خدمة API.");
      } finally {
        setLoading(false);
        setIsRefreshing(false);
        setLoadingMore(false);
      }
    },
    [
      searchTerms,
      selectedMajorTerms,
      selectedCity,
      sortOption,
      rewardFilter,
      environmentFilter,
    ]
  );

  useEffect(() => {
    fetchExperiencesPage(1, { append: false });
  }, [fetchExperiencesPage]);

  useEffect(() => {
    if (searchAnalyticsVersion === 0) return;

    const trimmedSearch = companySearch.trim();
    const hasSearchQuery = normalizeSearchText(trimmedSearch).length >= 3;
    const hasAppliedFilters =
      selectedMajors.length > 0 ||
      selectedCity ||
      rewardFilter ||
      environmentFilter;

    if (!hasSearchQuery && !hasAppliedFilters) return;

    const searchSignature = JSON.stringify({
      query: hasSearchQuery ? normalizeSearchText(trimmedSearch) : "",
      majors: selectedMajors,
      city: selectedCity,
      rewardFilter,
      environmentFilter,
      sortOption,
    });

    const timer = window.setTimeout(() => {
      if (lastTrackedExperienceSearchRef.current === searchSignature) return;
      lastTrackedExperienceSearchRef.current = searchSignature;

      trackEvent("experience_search", {
        major: selectedMajors[0] || "",
        city: selectedCity,
        searchQuery: hasSearchQuery ? trimmedSearch : "",
        resultsCount: totalExperiences,
        metadata: {
          selectedMajors,
          rewardFilter,
          environmentFilter,
          sortOption,
          searchTerms,
          searchQuality: "settled",
          analyticsVersion: "v2",
        },
      });
    }, hasSearchQuery ? 900 : 450);

    return () => window.clearTimeout(timer);
  }, [
    companySearch,
    environmentFilter,
    rewardFilter,
    searchAnalyticsVersion,
    searchTerms,
    selectedCity,
    selectedMajors,
    sortOption,
    totalExperiences,
  ]);

  const loadMoreExperiences = () => {
    if (loadingMore || !hasMore) return;
    fetchExperiencesPage(currentPage + 1, { append: true });
  };

  const StarRating = ({ value = 0 }) => (
    <div
      style={{
        display: "flex",
        gap: "3px",
        margin: "8px 0",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "18px",
      }}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          aria-hidden="true"
          style={{
            color: star <= value ? "var(--app-brand)" : "rgba(148,163,184,0.35)",
            fontSize: "17px",
            lineHeight: 1,
            textShadow:
              star <= value ? "0 0 10px var(--app-brand-border)" : "none",
          }}
        >
          ★
        </span>
      ))}
    </div>
  );

  const selectedMajorsText =
    selectedMajors.length === 0 ? "كل التخصصات" : selectedMajors.join("، ");

  const activeFiltersCount = [
    selectedMajors.length > 0,
    selectedCity,
    rewardFilter,
    environmentFilter,
    sortOption !== "latest",
  ].filter(Boolean).length;

  const sortLabels = {
    latest: "الأحدث أولًا",
    rating: "الأعلى تقييمًا",
    relevance: "الأكثر صلة",
  };

  const rewardFilterLabels = {
    yes: "فيه مكافأة",
    no: "بدون مكافأة",
  };

  const environmentFilterLabels = {
    women: "بيئة نسائية",
    men: "بيئة رجالية",
    mixed: "بيئة مختلطة",
  };

  const clearAllFilters = () => {
    setSelectedMajors([]);
    clearCompanySearch();
    setSelectedCity("");
    setRewardFilter("");
    setEnvironmentFilter("");
    setSortOption("latest");
  };

  const MajorButton = ({ name, Icon, color = "var(--app-brand)", active, isAll }) => (
    <button
      type="button"
      onClick={() => toggleMajor(name)}
      className="major-filter-btn"
      style={{
        marginInline: "10px",
        padding: "14px 12px",
        borderRadius: "20px",
        border: isAll
          ? "1px solid var(--app-brand)"
          : "1px solid var(--app-border)",
        background: active ? "var(--app-brand)" : "var(--app-surface-2)",
        color: active ? "#07100e" : "var(--app-text)",
        fontWeight: isAll || active ? "bold" : "500",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        fontSize: "13px",
        minWidth: 0,
      }}
    >
      {Icon && <Icon size={18} color={active ? "#07100e" : color} />}
      <span className="major-filter-text">{name}</span>
    </button>
  );

  const InfoBox = ({ label, value, icon }) => (
    <div
      style={{
        background: "var(--app-card)",
        border: "1px solid var(--app-border)",
        borderRadius: "14px",
        padding: "14px",
        textAlign: "center",
        marginBottom: "12px",
      }}
    >
      <div
        style={{
          color: "var(--app-brand)",
          fontSize: "13px",
          fontWeight: "bold",
          marginBottom: "7px",
        }}
      >
        {icon} {label}
      </div>
      <div
        style={{
          color: "var(--app-text-soft)",
          fontSize: "14px",
          lineHeight: "1.7",
        }}
      >
        {value || "غير محدد"}
      </div>
    </div>
  );

  const optionalAnswerLabels = {
    yes: "نعم",
    no: "لا",
    not_sure: "غير مؤكد",
  };

  const rewardAnswerLabels = {
    yes: "نعم، بمكافأة",
    no: "لا، بدون مكافأة",
    not_sure: "غير واضح",
  };

  const formatRewardAmount = (value = "") => {
    const text = value.toString().trim();
    if (!text) return "";

    return text
      .replace(/\s+/g, " ")
      .replace(/\bSAR\b/gi, "ريال")
      .replace(/\bSR\b/gi, "ريال")
      .replace(/\bAED\b/gi, "درهم");
  };

  const getRewardDisplayValue = (exp = {}) => {
    if (exp.hadReward === "yes") {
      return formatRewardAmount(exp.rewardAmount) || "يوجد";
    }

    return (
      rewardAnswerLabels[exp.hadReward] ||
      optionalAnswerLabels[exp.hadReward] ||
      "غير مؤكد"
    );
  };

  const jobOfferAnswerLabels = {
    yes: "نعم، وصلني عرض",
    no: "لا، ما وصلني عرض",
    not_sure: "غير واضح",
  };

  const trainingEnvironmentLabels = {
    mixed: "مختلطة",
    women: "نساء",
    men: "رجال",
  };

  const trainingModeLabels = {
    onsite: "حضوري",
    remote: "عن بعد",
  };

  const sourceTypeLabels = {
    public_summary: "ملخص من مصدر عام",
    direct: "تجربة مباشرة من طالب",
  };

  const getExperienceSourceLabel = (exp = {}) =>
    sourceTypeLabels[exp.sourceType] ||
    (exp.howApplied === "غير مذكور"
      ? sourceTypeLabels.public_summary
      : sourceTypeLabels.direct);

  const getClearRewardAmount = (value = "") => {
    const text = formatRewardAmount(value);
    if (!text) return "";

    const normalizedText = text
      .replace(/[ً-ْ]/g, "")
      .replace(/ة/g, "ه")
      .replace(/[أإآ]/g, "ا")
      .toLowerCase();
    const unclearRewardPattern =
      /(غير واضح|غير مؤكد|لا اعلم|ما ادري|غير مذكور|يوجد|نعم|مكافاه|بمكافاه)/;
    const amountPattern =
      /([0-9٠-٩۰-۹]|ريال|ر\.س|﷼|\bSAR\b|\bSR\b|الف|الاف|الفين|مئه|مائه|ميه|مئتين|مائتين|ثلاثمئه|ثلاثمائه|اربعمئه|اربعمائه|خمسمئه|خمسمائه|ستمئه|ستمائه|سبعمئه|سبعمائه|ثمانمئه|ثمانمائه|تسعمئه|تسعمائه)/i;

    if (amountPattern.test(text) || amountPattern.test(normalizedText)) {
      return text;
    }

    return unclearRewardPattern.test(normalizedText) ? "" : "";
  };

  const getVisibleOutcomeBadges = (exp = {}) => {
    const badges = [];

    if (exp.hadReward === "yes") {
      badges.push({
        key: "reward",
        text: getClearRewardAmount(exp.rewardAmount) || "مكافأة",
        icon: "💰",
        color: "#f5b041",
        background: "rgba(245,176,65,0.14)",
        border: "rgba(245,176,65,0.34)",
      });
    }

    if (exp.wasHired === "yes") {
      badges.push({
        key: "hired",
        text: "عرض",
        icon: "💼",
        color: "#7ddbcd",
        background: "rgba(125,219,205,0.14)",
        border: "rgba(125,219,205,0.34)",
      });
    }

    return badges;
  };

  const OutcomeBadge = ({ badge }) => {
    if (!badge) return null;

    return (
      <div
        className="experience-outcome-badge"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "3px",
          width: "fit-content",
          maxWidth: "100%",
          minWidth: 0,
          boxSizing: "border-box",
          padding: "4px 8px",
          borderRadius: "999px",
          background: badge.background,
          border: `1px solid ${badge.border}`,
          color: badge.color,
          fontSize: "10px",
          fontWeight: "800",
          lineHeight: 1.2,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "3px",
            minWidth: 0,
            maxWidth: "100%",
          }}
        >
          <span aria-hidden="true">{badge.icon}</span>
          <span
            style={{
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {badge.text}
          </span>
        </span>
      </div>
    );
  };

  const SkeletonCard = () => (
    <div
      style={{
        background: "var(--app-surface-2)",
        borderRadius: "18px",
        height: "210px",
        animation: "pulse 1.4s infinite",
      }}
    />
  );

  const openExperienceDetails = (exp) => {
    trackEvent("experience_card_opened", {
      major: exp.major || exp.majorCategory || "",
      majorCategory: exp.majorCategory || "",
      city: exp.city || "",
      metadata: {
        organizationName: exp.organizationName || exp.companyName || "",
        starRating: exp.starRating || 0,
      },
    });

    requestPremiumAccess(
      {
        feature: "experience_details",
        title: exp.title || exp.organizationName || "",
        source: "experiences_page",
      },
      () => {
        setSelectedExperience(exp);
        setCurrentStep(1);
      }
    );
  };

  const getExperienceSavedId = (exp) =>
    `experience:${exp._id || exp.id || exp.title || exp.organizationName}`;

  const handleSaveExperience = (event, exp) => {
    event.stopPropagation();
    const id = getExperienceSavedId(exp);
    const isSaved = toggleSavedItem({
      id,
      type: "experience",
      title: exp.title || "تجربة تدريب",
      subtitle: exp.organizationName || exp.companyName || "",
      meta: [exp.city, getReadableMajor(exp)].filter(Boolean).join(" - "),
      url: `/experiences?company=${encodeURIComponent(
        exp.organizationName || exp.companyName || ""
      )}`,
    });

    setSavedItemIds((current) => {
      const next = new Set(current);
      if (isSaved) next.add(id);
      else next.delete(id);
      return next;
    });

    trackEvent(isSaved ? "saved_item_added" : "saved_item_removed", {
      major: exp.major || exp.majorCategory || "",
      city: exp.city || "",
      metadata: {
        type: "experience",
        organizationName: exp.organizationName || exp.companyName || "",
      },
    });
  };

  const renderStepContent = () => {
    const exp = selectedExperience;
    if (!exp) return null;

    if (currentStep === 1) {
      return (
        <div>
          <InfoBox
            icon="🏢"
            label="الجهة"
            value={exp.organizationName}
          />

          <InfoBox
            icon="📍"
            label="المدينة"
            value={exp.city}
          />

          <InfoBox
            icon="🎓"
            label="التخصص"
            value={getReadableMajor(exp)}
          />

          <InfoBox
            icon="⏱️"
            label="مدة التدريب"
            value={exp.duration}
          />

          <InfoBox
            icon="📝"
            label="طريقة التقديم"
            value={exp.howApplied}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: "10px",
            }}
          >
            {exp.trainingYear && (
              <InfoBox
                icon="📅"
                label="سنة التدريب"
                value={exp.trainingYear}
              />
            )}
            <InfoBox
              icon="💼"
              label="عرض توظيف؟"
              value={
                jobOfferAnswerLabels[exp.wasHired] ||
                optionalAnswerLabels[exp.wasHired] ||
                "غير مؤكد"
              }
            />
            <InfoBox
              icon="🎁"
              label="مكافأة التدريب؟"
              value={getRewardDisplayValue(exp)}
            />
            <InfoBox
              icon="👥"
              label="بيئة التدريب"
              value={trainingEnvironmentLabels[exp.trainingEnvironment]}
            />
            <InfoBox
              icon="💻"
              label="نوع التدريب"
              value={trainingModeLabels[exp.trainingMode]}
            />
            <InfoBox
              icon="💡"
              label="استفدت من التدريب؟"
              value={
                optionalAnswerLabels[exp.benefitedFromTraining] || "غير محدد"
              }
            />
            <InfoBox
              icon="✅"
              label="تنصح بالتدريب؟"
              value={optionalAnswerLabels[exp.wouldRecommend] || "غير محدد"}
            />
          </div>
        </div>
      );
    }

    return (
      <div>
        <div
          style={{
            background: "var(--app-card)",
            border: "1px solid var(--app-border)",
            borderRadius: "14px",
            padding: "16px",
            textAlign: "center",
            marginBottom: "14px",
          }}
        >
          <div
            style={{
              color: "var(--app-brand)",
              fontSize: "13px",
              fontWeight: "bold",
              marginBottom: "6px",
            }}
          >
            تقييم التجربة
          </div>

          <StarRating value={exp.starRating || 0} />
        </div>

        {Array.isArray(exp.ratings) && exp.ratings.length > 0 && (
          <div
            style={{
              background: "var(--app-card)",
              border: "1px solid var(--app-border)",
              borderRadius: "14px",
              padding: "16px",
              textAlign: "center",
              marginBottom: "14px",
            }}
          >
            <div
              style={{
                color: "var(--app-brand)",
                fontSize: "13px",
                fontWeight: "bold",
                marginBottom: "10px",
              }}
            >
              ✨ وصف سريع للتجربة
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              {exp.ratings.map((rating) => (
                <span
                  key={rating}
                  style={{
                    background: "var(--app-brand-soft)",
                    border: "1px solid var(--app-brand-border)",
                    color: "var(--app-text-soft)",
                    borderRadius: "999px",
                    padding: "7px 10px",
                    fontSize: "12px",
                    lineHeight: 1.5,
                  }}
                >
                  {ratingLabels[rating] || rating}
                </span>
              ))}
            </div>
          </div>
        )}

        <div
          style={{
            background: "var(--app-card)",
            border: "1px solid var(--app-border)",
            borderRadius: "14px",
            padding: "18px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              color: "var(--app-brand)",
              fontSize: "13px",
              fontWeight: "bold",
              marginBottom: "10px",
            }}
          >
            🧠 التجربة
          </div>

          <p
            style={{
              color: "var(--app-text-soft)",
              lineHeight: "1.9",
              fontSize: "14px",
              margin: 0,
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
            }}
          >
            {exp.description}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        background: "var(--app-bg)",
        minHeight: "100vh",
        color: "var(--app-text)",
        fontFamily: "'Cairo', sans-serif",
        direction: "rtl",
      }}
    >
      {/* ================= Majors ================= */}
      <div
        className="experiences-shell"
        style={{
          marginTop: 28,
          padding: "15px 12px",
        }}
      >
        {SHOW_TRAINING_GUIDE_BANNER && (
          <TrainingGuideBanner
            compact
            ariaLabel="إعلان ملف رحلة المتدرب"
            badges={["🌟 ملف يساعدك تختصر الطريق", "✅ من التقديم إلى التقرير"]}
            title="رحلة المتدرب: شاملة من التقديم إلى كتابة التقرير"
            description="إذا كنت في مرحلة البحث عن تدريب أو بدأت تجربتك، هذا الملف يرتب لك الطريق خطوة بخطوة: كيف تقدم، تتابع طلباتك، تستعد، وتكتب تقريرك بثقة."
            buttonText="استكشف الملف الآن"
            style={{ margin: "0 auto 18px", maxWidth: "980px" }}
          />
        )}

        {(seoCity || seoSpecialty) && (
          <section
            style={{
              maxWidth: "980px",
              margin: "0 auto 16px",
              padding: "14px 16px",
              borderRadius: "16px",
              border: "1px solid var(--app-border)",
              background: "var(--app-surface)",
              textAlign: "right",
            }}
          >
            <h1
              style={{
                margin: "0 0 6px",
                color: "var(--app-brand)",
                fontSize: "clamp(20px, 3vw, 30px)",
                lineHeight: 1.5,
              }}
            >
              تجارب تدريب {seoSpecialty || "الطلاب"}
              {seoCity ? ` في ${seoCity}` : ""}
            </h1>
            <p
              style={{
                margin: 0,
                color: "var(--app-text-soft)",
                lineHeight: 1.8,
                fontSize: "14px",
              }}
            >
              صفحة تجمع التجارب المطابقة من دربك حسب التخصص والمدينة، وتساعدك
              تقارن بين الجهات وتقرأ ملاحظات الطلاب قبل بداية التدريب.
            </p>
          </section>
        )}

        <div
          className={`experience-controls-sticky${
            mobileFiltersOpen ? " is-mobile-filters-open" : ""
          }`}
        >
          <div
            className="majors-grid"
            style={{
              display: "flex",
              gap: "8px",
              marginBottom: "18px",
              overflowX: "auto",
              overflowY: "hidden",
              padding: "2px 2px 10px",
              WebkitOverflowScrolling: "touch",
            }}
          >
            <MajorButton
              name="الكل"
              active={selectedMajors.length === 0}
              isAll
            />

            {majors.map(({ name, icon: Icon, color = "#7ddbcd" }) => {
              const active = selectedMajors.includes(name);
              return (
                <MajorButton
                  key={name}
                  name={name}
                  Icon={Icon}
                  color={color}
                  active={active}
                />
              );
            })}
          </div>

          <div
            className="experiences-search-bar"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              margin: "0 auto 22px",
              maxWidth: "980px",
            }}
          >
            <div
              style={{
                flex: 1,
                position: "relative",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  right: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--app-brand)",
                  fontSize: "16px",
                }}
              >
                🔎
              </span>
              <input
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
                placeholder="ابحث باسم الشركة، الجهة، أو التخصص"
                aria-label="ابحث باسم الشركة، الجهة، أو التخصص"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  background: "var(--app-surface-2)",
                  color: "var(--app-text)",
                  border: "1px solid var(--app-brand-border)",
                  borderRadius: "16px",
                  padding: "12px 44px 12px 14px",
                  outline: "none",
                  fontSize: "14px",
                  fontFamily: "inherit",
                  textAlign: "right",
                }}
              />
            </div>

            {companySearch && (
              <button
                type="button"
                onClick={clearCompanySearch}
                style={{
                  background: "transparent",
                  border: "1px solid var(--app-border)",
                  color: "var(--app-text-soft)",
                  borderRadius: "12px",
                  padding: "10px 12px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: "13px",
                }}
              >
                مسح
              </button>
            )}

            <select
              className="desktop-advanced-control"
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              aria-label="فلترة حسب المدينة"
              style={{
                background: "var(--app-surface-2)",
                color: "var(--app-text)",
                border: "1px solid var(--app-brand-border)",
                borderRadius: "12px",
                padding: "10px 12px",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "13px",
                outline: "none",
              }}
            >
              <option value="">كل المدن</option>
              {MAIN_CITY_FILTERS.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>

            <select
              className="desktop-advanced-control"
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
              aria-label="ترتيب التجارب"
              style={{
                background: "var(--app-surface-2)",
                color: "var(--app-text)",
                border: "1px solid var(--app-brand-border)",
                borderRadius: "12px",
                padding: "10px 12px",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "13px",
                outline: "none",
              }}
            >
              <option value="latest">الأحدث أولًا</option>
              <option value="rating">الأعلى تقييمًا</option>
              <option value="relevance">الأكثر صلة</option>
            </select>
          </div>

          <div
            className="mobile-filter-toggle-row"
            style={{
              display: "none",
            }}
          >
            <button
              type="button"
              onClick={() => setMobileFiltersOpen((open) => !open)}
              aria-expanded={mobileFiltersOpen}
              style={{
                background: mobileFiltersOpen
                  ? "var(--app-brand)"
                  : "var(--app-surface-2)",
                color: mobileFiltersOpen ? "#071315" : "var(--app-text)",
                border: "1px solid var(--app-brand-border)",
                borderRadius: "999px",
                padding: "8px 12px",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "12px",
                fontWeight: "800",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span aria-hidden="true">⚙</span>
              تصفية النتائج
              {activeFiltersCount > 0 && (
                <span
                  style={{
                    minWidth: "18px",
                    height: "18px",
                    borderRadius: "999px",
                    display: "inline-grid",
                    placeItems: "center",
                    background: mobileFiltersOpen
                      ? "rgba(7,19,21,0.14)"
                      : "var(--app-brand-soft)",
                    color: mobileFiltersOpen ? "#071315" : "var(--app-brand)",
                    fontSize: "11px",
                  }}
                >
                  {activeFiltersCount}
                </span>
              )}
            </button>

            <span
              style={{
                flex: 1,
                minWidth: 0,
                color: "var(--app-text-soft)",
                fontSize: "11.5px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                textAlign: "right",
              }}
            >
              {selectedMajors.length > 0 || selectedCity || rewardFilter || environmentFilter
                ? selectedMajorsText
                : "تخصص، مدينة، مكافأة، بيئة"}
            </span>
          </div>

          <div className="mobile-filter-panel-intro">
            <div>
              <strong>خيارات التصفية</strong>
              <span>تخصصات، مدن، ومؤشرات مختصرة</span>
            </div>
          </div>

          <div className="mobile-advanced-filters">
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              aria-label="فلترة حسب المدينة"
            >
              <option value="">كل المدن</option>
              {MAIN_CITY_FILTERS.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>

            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
              aria-label="ترتيب التجارب"
            >
              <option value="latest">الأحدث أولًا</option>
              <option value="rating">الأعلى تقييمًا</option>
              <option value="relevance">الأكثر صلة</option>
            </select>
          </div>

          <div
            className="mobile-majors-menu"
            style={{
              display: "none",
              marginBottom: "18px",
            }}
          >
            <button
              type="button"
              onClick={() => setMajorsMenuOpen((open) => !open)}
              style={{
                width: "100%",
                background: "var(--app-surface-2)",
                color: "var(--app-text)",
                border: "1px solid var(--app-brand-border)",
                borderRadius: "16px",
                padding: "12px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                cursor: "pointer",
                textAlign: "right",
              }}
            >
              <span
                style={{
                  display: "grid",
                  gap: "3px",
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    color: "var(--app-brand)",
                    fontSize: "12px",
                    fontWeight: "bold",
                  }}
                >
                  التخصصات
                </span>
                <span
                  style={{
                    color: "var(--app-text-soft)",
                    fontSize: "13px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {selectedMajorsText}
                </span>
              </span>
              <span
                style={{
                  color: "var(--app-brand)",
                  fontSize: "18px",
                  lineHeight: 1,
                  transform: majorsMenuOpen ? "rotate(180deg)" : "rotate(0)",
                  transition: "0.2s ease",
                }}
              >
                ▾
              </span>
            </button>

            {majorsMenuOpen && (
              <div
                className="mobile-majors-list"
                style={{
                  marginTop: "10px",
                  background: "var(--app-card)",
                  border: "1px solid var(--app-border)",
                  borderRadius: "16px",
                  padding: "10px",
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: "8px",
                }}
              >
                <MajorButton
                  name="الكل"
                  active={selectedMajors.length === 0}
                  isAll
                />

                {majors.map(({ name, icon: Icon, color = "#7ddbcd" }) => (
                  <MajorButton
                    key={name}
                    name={name}
                    Icon={Icon}
                    color={color}
                    active={selectedMajors.includes(name)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="quick-filter-heading">
            <span>فلاتر سريعة</span>
            <small>المكافأة وبيئة التدريب</small>
          </div>

          <div className="experience-filter-tabs">
            <button
              type="button"
              aria-pressed={rewardFilter === "yes"}
              className={`experience-filter-tab reward-tab${
                rewardFilter === "yes" ? " is-active" : ""
              }`}
              onClick={() =>
                setRewardFilter((current) => (current === "yes" ? "" : "yes"))
              }
            >
              <span aria-hidden="true">💰</span>
              مكافأة
            </button>

            {[
              { value: "women", label: "نسائية", icon: "♀" },
              { value: "men", label: "رجالية", icon: "♂" },
              { value: "mixed", label: "مختلطة", icon: "◐" },
            ].map((option) => {
              const active = environmentFilter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  className={`experience-filter-tab environment-tab ${option.value}-tab${
                    active ? " is-active" : ""
                  }`}
                  onClick={() =>
                    setEnvironmentFilter((current) =>
                      current === option.value ? "" : option.value
                    )
                  }
                >
                  <span aria-hidden="true">{option.icon}</span>
                  {option.label}
                </button>
              );
            })}
          </div>

          {(selectedMajors.length > 0 ||
            companySearch ||
            selectedCity ||
            rewardFilter ||
            environmentFilter ||
            sortOption !== "latest") && (
            <div
              className="active-filter-chips"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                flexWrap: "wrap",
                margin: "-8px 0 22px",
              }}
            >
              {selectedMajors.map((major) => (
                <button
                  key={major}
                  type="button"
                  onClick={() =>
                    setSelectedMajors((prev) => prev.filter((m) => m !== major))
                  }
                  style={{
                    background: "rgba(125,219,205,0.1)",
                    border: "1px solid rgba(125,219,205,0.28)",
                    color: "#dffaff",
                    borderRadius: "999px",
                    padding: "7px 10px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: "12px",
                  }}
                >
                  التخصص: {major} ✕
                </button>
              ))}

              {companySearch && (
                <button
                  type="button"
                  onClick={clearCompanySearch}
                  style={{
                    background: "rgba(250,204,21,0.09)",
                    border: "1px solid rgba(250,204,21,0.25)",
                    color: "#fef3c7",
                    borderRadius: "999px",
                    padding: "7px 10px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: "12px",
                  }}
                >
                  البحث: {companySearch} ✕
                </button>
              )}

              {selectedCity && (
                <button
                  type="button"
                  onClick={() => setSelectedCity("")}
                  style={{
                    background: "rgba(125,219,205,0.1)",
                    border: "1px solid rgba(125,219,205,0.28)",
                    color: "#dffaff",
                    borderRadius: "999px",
                    padding: "7px 10px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: "12px",
                  }}
                >
                  المدينة: {selectedCity} ✕
                </button>
              )}

              {rewardFilter && (
                <button
                  type="button"
                  onClick={() => setRewardFilter("")}
                  style={{
                    background: "rgba(245,158,11,0.09)",
                    border: "1px solid rgba(245,158,11,0.28)",
                    color: "#fde68a",
                    borderRadius: "999px",
                    padding: "7px 10px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: "12px",
                  }}
                >
                  المكافأة: {rewardFilterLabels[rewardFilter]} ✕
                </button>
              )}

              {environmentFilter && (
                <button
                  type="button"
                  onClick={() => setEnvironmentFilter("")}
                  style={{
                    background: "rgba(125,219,205,0.1)",
                    border: "1px solid rgba(125,219,205,0.28)",
                    color: "#dffaff",
                    borderRadius: "999px",
                    padding: "7px 10px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: "12px",
                  }}
                >
                  البيئة: {environmentFilterLabels[environmentFilter]} ✕
                </button>
              )}

              {sortOption !== "latest" && (
                <button
                  type="button"
                  onClick={() => setSortOption("latest")}
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "#e5e7eb",
                    borderRadius: "999px",
                    padding: "7px 10px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: "12px",
                  }}
                >
                  الترتيب: {sortLabels[sortOption]} ✕
                </button>
              )}

              <button
                type="button"
                onClick={clearAllFilters}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#9ca3af",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: "12px",
                }}
              >
                مسح الكل
              </button>
            </div>
          )}
        </div>

        {/* ================= Cards ================= */}
        {fetchError && (
          <div
            style={{
              textAlign: "center",
              margin: "0 auto 18px",
              padding: "12px",
              borderRadius: "14px",
              background: "rgba(244,63,94,0.08)",
              border: "1px solid rgba(244,63,94,0.25)",
              color: "#fecdd3",
              maxWidth: "620px",
              lineHeight: 1.7,
            }}
          >
            {fetchError}
          </div>
        )}

        {isRefreshing && experiences.length > 0 && !fetchError && (
          <div
            style={{
              textAlign: "center",
              margin: "0 auto 14px",
              color: "#9ca3af",
              fontSize: "12px",
            }}
          >
            يتم تحديث التجارب...
          </div>
        )}

        {loading ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
              gap: "20px",
            }}
          >
            {[...Array(6)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filteredExperiences.length === 0 ? (
          <div style={{ textAlign: "center", marginTop: "80px" }}>
            <p style={{ fontSize: "40px" }}>📭</p>
            <p>
              {companySearch
                ? "لا توجد تجارب مطابقة للبحث"
                : "لا توجد تجارب لهذا التخصص"}
            </p>
          </div>
        ) : (
          <>
            <div
              className="experience-cards-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(165px, 1fr))",
                gap: "14px",
              }}
            >
              {visibleExperiences.map((exp) => (
                <div
                  className="experience-card"
                  key={exp._id}
                  onClick={() => openExperienceDetails(exp)}
                  style={{
                    background:
                      "linear-gradient(180deg, var(--app-surface-2) 0%, var(--app-card) 100%)",
                    borderRadius: "20px",
                    padding: "14px",
                    border: "1px solid var(--app-border)",
                    cursor: "pointer",
                    textAlign: "center",
                    minHeight: "178px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    position: "relative",
                    boxShadow: "0 10px 25px var(--app-shadow)",
                    transition: "0.3s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-5px)";
                    e.currentTarget.style.boxShadow =
                      "0 15px 30px var(--app-shadow)";
                    e.currentTarget.style.border =
                      "1px solid var(--app-brand-border)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow =
                      "0 10px 25px var(--app-shadow)";
                    e.currentTarget.style.border =
                      "1px solid var(--app-border)";
                  }}
                >
                  <button
                    type="button"
                    className={`save-item-button ${
                      savedItemIds.has(getExperienceSavedId(exp)) ? "is-saved" : ""
                    }`}
                    onClick={(event) => handleSaveExperience(event, exp)}
                    aria-label={
                      savedItemIds.has(getExperienceSavedId(exp))
                        ? "إزالة التجربة من المحفوظات"
                        : "حفظ التجربة"
                    }
                    title={
                      savedItemIds.has(getExperienceSavedId(exp))
                        ? "محفوظة"
                        : "حفظ التجربة"
                    }
                  >
                    {savedItemIds.has(getExperienceSavedId(exp))
                      ? "♥ محفوظة"
                      : "♡ حفظ"}
                  </button>
                  <div>
                    <div
                      className="experience-title-box"
                      style={{
                        marginBottom: "10px",
                        minHeight: "40px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <h3
                        style={{
                          color: "var(--app-brand)",
                          fontSize: "16px",
                          margin: 0,
                          lineHeight: "1.45",
                          fontWeight: "800",
                        }}
                      >
                        {exp.title}
                      </h3>
                    </div>

                    <div
                      className="experience-card-info"
                      style={{
                        display: "grid",
                        gap: "8px",
                      }}
                    >
                      <div
                        className="experience-info-box"
                        style={{
                          background: "var(--app-input-bg)",
                          borderRadius: "12px",
                          padding: "8px",
                          border: "1px solid var(--app-border-soft)",
                        }}
                      >
                        <p
                          style={{
                            color: "var(--app-brand)",
                            fontSize: "11px",
                            margin: "0 0 4px",
                            fontWeight: "bold",
                          }}
                        >
                          🏢 الجهة
                        </p>
                        <p
                          style={{
                            fontSize: "12px",
                            color: "var(--app-text-soft)",
                            margin: 0,
                            fontWeight:"bold"

                          }}
                        >
                          {exp.organizationName}
                        </p>
                      </div>

                      <div
                        className="experience-info-box"
                        style={{
                          background: "var(--app-input-bg)",
                          borderRadius: "12px",
                          padding: "8px",
                          border: "1px solid var(--app-border-soft)",
                        }}
                      >
                        <p
                          style={{
                            color: "var(--app-brand)",
                            fontSize: "11px",
                            margin: "0 0 4px",
                            fontWeight: "bold",
                          }}
                        >
                          🎓 التخصص
                        </p>
                        <p
                          style={{
                            fontSize: "12px",
                            color: "var(--app-text-soft)",
                            margin: 0,
                            fontWeight:"bold"
                          }}
                        >
                          {getReadableMajor(exp)}
                        </p>
                      </div>
                    </div>

                  </div>

                  <div style={{ marginTop: "10px" }}>
                    <p
                      className="experience-source-label"
                      style={{
                        margin: "0 0 5px",
                        color: "var(--app-muted-2)",
                        fontSize: "10px",
                        lineHeight: 1.4,
                        fontWeight: 500,
                      }}
                    >
                      {getExperienceSourceLabel(exp)}
                    </p>

                    {getVisibleOutcomeBadges(exp).length > 0 && (
                      <div
                        className="experience-outcome-badges"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "5px",
                          minHeight: "24px",
                          marginBottom: "5px",
                          flexWrap: "wrap",
                        }}
                      >
                        {getVisibleOutcomeBadges(exp).map((badge) => (
                          <OutcomeBadge key={badge.key} badge={badge} />
                        ))}
                      </div>
                    )}

                    <StarRating value={exp.starRating || 0} />

                    <button
                      style={{
                        marginTop: "5px",
                        width: "100%",
                        padding: "7px",
                        borderRadius: "12px",
                        border: "1px solid var(--app-brand-border)",
                        background: "transparent",
                        color: "var(--app-brand)",
                        cursor: "pointer",
                        fontSize: "12px",
                        fontWeight: "bold",
                      }}
                    >
                      عرض التفاصيل
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {hasMore && (
              <div style={{ textAlign: "center", marginTop: "22px" }}>
                <button
                  type="button"
                  onClick={loadMoreExperiences}
                  disabled={loadingMore}
                  style={{
                    background: loadingMore ? "var(--app-brand-soft)" : "var(--app-brand)",
                    color: "#07100e",
                    border: "none",
                    borderRadius: "14px",
                    padding: "11px 24px",
                    cursor: loadingMore ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                    fontWeight: "bold",
                  }}
                >
                  {loadingMore ? "جاري التحميل..." : "عرض المزيد"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ================= Modal ================= */}
      {selectedExperience && (
        <div
          onClick={() => setSelectedExperience(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--app-overlay)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            className="experience-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--app-surface)",
              borderRadius: "22px",
              padding: "26px",
              width: "92%",
              maxWidth: "760px",
              maxHeight: "calc(100vh - 48px)",
              overflowY: "auto",
              boxSizing: "border-box",
              scrollbarGutter: "stable",
              border: "1px solid var(--app-border)",
              boxShadow: "0 20px 50px var(--app-shadow)",
              textAlign: "center",
              position: "relative",
            }}
          >
            <button
              type="button"
              onClick={() => setSelectedExperience(null)}
              aria-label="إغلاق التجربة"
              style={{
                position: "sticky",
                top: 0,
                marginRight: "auto",
                marginBottom: "-30px",
                width: "34px",
                height: "34px",
                borderRadius: "999px",
                border: "1px solid var(--app-border)",
                background: "var(--app-input-bg)",
                color: "var(--app-text-soft)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
                lineHeight: 1,
                zIndex: 3,
              }}
            >
              ×
            </button>
            <div
              style={{
                display: "flex",
                gap: "10px",
                justifyContent: "center",
                marginBottom: "18px",
                flexWrap: "wrap",
              }}
            >
              {steps.map((step, i) => (
                <div
                  key={i}
                  style={{
                    color: currentStep === i + 1 ? "#07100e" : "var(--app-muted)",
                    background:
                      currentStep === i + 1
                        ? "var(--app-brand)"
                        : "var(--app-input-bg)",
                    fontSize: "13px",
                    padding: "8px 12px",
                    borderRadius: "999px",
                    fontWeight: "bold",
                  }}
                >
                  {i + 1}. {step}
                </div>
              ))}
            </div>

            <p
              style={{
                margin: "-6px 0 16px",
                padding: "9px 12px",
                borderRadius: "12px",
                background: "var(--app-brand-soft)",
                border: "1px solid var(--app-brand-border)",
                color: "var(--app-text-soft)",
                fontSize: "12px",
                lineHeight: 1.7,
              }}
            >
              هذه تجربة شخصية لا تمثل الجهة بالضرورة، وقد تختلف حسب الوقت والظروف.
            </p>

            <div style={{ marginTop: "20px" }}>
              {renderStepContent()}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "10px",
                marginTop: "22px",
              }}
            >
              <button
                disabled={currentStep === 1}
                onClick={() => setCurrentStep((s) => s - 1)}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "12px",
                  border: "1px solid var(--app-border)",
                  background:
                    currentStep === 1
                      ? "var(--app-input-bg)"
                      : "transparent",
                  color: currentStep === 1 ? "var(--app-muted)" : "var(--app-text)",
                  cursor: currentStep === 1 ? "not-allowed" : "pointer",
                }}
              >
                السابق
              </button>

              {currentStep < 2 ? (
                <button
                  onClick={() => setCurrentStep((s) => s + 1)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "12px",
                    border: "none",
                    background: "var(--app-brand)",
                    color: "#07100e",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  التالي
                </button>
              ) : (
                <button
                  onClick={() => setSelectedExperience(null)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "12px",
                    border: "none",
                    background: "var(--app-brand)",
                    color: "#07100e",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  إغلاق
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= Responsive ================= */}
      <style>{`
        @keyframes pulse {
          0% { opacity: 0.4 }
          50% { opacity: 0.8 }
          100% { opacity: 0.4 }
        }

        .major-filter-btn:hover {
          border-color: rgba(125,219,205,0.45) !important;
        }

        .majors-grid .major-filter-btn {
          flex: 0 0 auto;
          min-width: 132px;
          max-width: 178px;
          margin-inline: 0 !important;
          border-radius: 999px !important;
          padding: 10px 13px !important;
          min-height: 40px;
        }

        .majors-grid .major-filter-btn svg {
          width: 16px;
          height: 16px;
          flex: 0 0 auto;
        }

        .majors-grid::-webkit-scrollbar {
          height: 6px;
        }

        .majors-grid::-webkit-scrollbar-track {
          background: var(--app-input-bg);
          border-radius: 999px;
        }

        .majors-grid::-webkit-scrollbar-thumb {
          background: var(--app-brand-border);
          border-radius: 999px;
        }

        .major-filter-text {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          min-width: 0;
        }

        .experience-controls-sticky {
          position: sticky;
          top: 0;
          z-index: 50;
          background: color-mix(in srgb, var(--app-bg) 94%, transparent);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--app-border-soft);
          margin: -15px -12px 18px;
          padding: 8px 12px 4px;
        }

        .mobile-filter-panel-intro,
        .mobile-advanced-filters {
          display: none;
        }

        .quick-filter-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          max-width: 980px;
          margin: -6px auto 9px;
          color: var(--app-text);
        }

        .quick-filter-heading span {
          font-size: 13px;
          font-weight: 900;
        }

        .quick-filter-heading small {
          color: var(--app-text-soft);
          font-size: 11px;
          font-weight: 700;
        }

        .experience-filter-tabs {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          flex-wrap: nowrap;
          max-width: 980px;
          margin: 0 auto 20px;
          overflow-x: auto;
          padding: 2px 2px 5px;
          -webkit-overflow-scrolling: touch;
        }

        .experience-filter-tabs::-webkit-scrollbar {
          display: none;
        }

        .experience-filter-tab {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          flex: 0 0 auto;
          min-width: 92px;
          border: 1px solid var(--app-border);
          background: color-mix(in srgb, var(--app-surface-2) 92%, transparent);
          color: var(--app-text);
          border-radius: 999px;
          padding: 9px 13px;
          cursor: pointer;
          font-family: inherit;
          font-size: 12px;
          font-weight: 800;
          line-height: 1.2;
          transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease,
            box-shadow 0.2s ease, transform 0.2s ease;
        }

        .experience-filter-tab span {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          border-radius: 999px;
          background: rgba(255,255,255,0.08);
          font-size: 12px;
          line-height: 1;
        }

        .experience-filter-tab:hover {
          transform: translateY(-1px);
          border-color: var(--app-brand-border);
        }

        .experience-filter-tab.is-active {
          color: #071315;
          border-color: transparent;
        }

        .experience-filter-tab.reward-tab.is-active {
          background: #f6c453;
          box-shadow: 0 10px 22px rgba(246,196,83,0.18);
        }

        .experience-filter-tab.women-tab.is-active {
          background: #f8b4cf;
          box-shadow: 0 10px 22px rgba(248,180,207,0.16);
        }

        .experience-filter-tab.men-tab.is-active {
          background: #8ec5ff;
          box-shadow: 0 10px 22px rgba(142,197,255,0.16);
        }

        .experience-filter-tab.mixed-tab.is-active {
          background: var(--app-brand);
          box-shadow: 0 10px 22px rgba(125,219,205,0.2);
        }

        .experience-modal::-webkit-scrollbar {
          width: 8px;
        }

        .experience-modal::-webkit-scrollbar-track {
          background: var(--app-input-bg);
          border-radius: 999px;
        }

        .experience-modal::-webkit-scrollbar-thumb {
          background: var(--app-brand-border);
          border-radius: 999px;
        }

        @media (min-width: 901px) {
          .experience-modal {
            text-align: right !important;
          }
        }

        @media (max-width: 900px) {
          .experiences-shell {
            margin-top: 18px !important;
            padding: 10px 10px 24px !important;
          }

          .experience-controls-sticky {
            margin: -10px -10px 12px;
            padding: 8px 10px 9px;
            border-radius: 0 0 20px 20px;
            border-bottom: 1px solid var(--app-border);
            box-shadow: 0 12px 28px rgba(0,0,0,0.18);
          }

          .majors-grid {
            display: none !important;
          }

          .mobile-filter-toggle-row {
            display: flex !important;
            align-items: center;
            gap: 8px;
            max-width: 980px;
            margin: 0 auto 8px;
            padding: 7px;
            border: 1px solid var(--app-border);
            border-radius: 16px;
            background: color-mix(in srgb, var(--app-surface-2) 92%, transparent);
            box-sizing: border-box;
          }

          .desktop-advanced-control {
            display: none !important;
          }

          .experience-controls-sticky:not(.is-mobile-filters-open) .experience-filter-tabs,
          .experience-controls-sticky:not(.is-mobile-filters-open) .quick-filter-heading,
          .experience-controls-sticky:not(.is-mobile-filters-open) .mobile-filter-panel-intro,
          .experience-controls-sticky:not(.is-mobile-filters-open) .mobile-advanced-filters {
            display: none !important;
          }

          .experience-controls-sticky.is-mobile-filters-open .mobile-filter-panel-intro {
            display: flex !important;
            align-items: center;
            justify-content: space-between;
            margin: 0 auto 8px;
            max-width: 980px;
            padding: 9px 11px;
            border: 1px solid var(--app-brand-border);
            border-radius: 16px;
            background: var(--app-brand-soft);
            box-sizing: border-box;
          }

          .mobile-filter-panel-intro strong {
            display: block;
            color: var(--app-brand);
            font-size: 12px;
            font-weight: 900;
            margin-bottom: 2px;
          }

          .mobile-filter-panel-intro span {
            color: var(--app-text-soft);
            font-size: 11px;
            font-weight: 700;
          }

          .experience-controls-sticky.is-mobile-filters-open .mobile-advanced-filters {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
            margin: 0 auto 8px;
            max-width: 980px;
          }

          .mobile-advanced-filters select {
            min-width: 0;
            width: 100%;
            min-height: 38px;
            background: var(--app-surface-2);
            color: var(--app-text);
            border: 1px solid var(--app-brand-border);
            border-radius: 12px;
            padding: 8px 9px;
            cursor: pointer;
            font-family: inherit;
            font-size: 12px;
            outline: none;
          }

          .mobile-majors-menu {
            display: none !important;
            margin-bottom: 8px !important;
          }

          .experience-controls-sticky.is-mobile-filters-open .mobile-majors-menu {
            display: block !important;
          }

          .mobile-majors-list .major-filter-btn {
            margin-inline: 0 !important;
            border-radius: 12px !important;
            padding: 9px 8px !important;
            min-height: 42px;
            font-size: 11px !important;
          }

          .mobile-majors-list .major-filter-btn svg {
            width: 15px;
            height: 15px;
            flex: 0 0 auto;
          }

          .experiences-search-bar {
            align-items: stretch !important;
            gap: 8px !important;
            margin-bottom: 8px !important;
            flex-wrap: wrap;
          }

          .experiences-search-bar > div:first-child {
            flex: 1 1 100% !important;
          }

          .experiences-search-bar input {
            border-radius: 14px !important;
            padding-top: 10px !important;
            padding-bottom: 10px !important;
            font-size: 13px !important;
          }

          .experiences-search-bar select,
          .experiences-search-bar button {
            flex: 1;
            min-height: 38px;
            border-radius: 12px !important;
            font-size: 12px !important;
          }

          .experience-filter-tabs {
            justify-content: flex-start;
            gap: 8px;
            margin: 0 0 12px;
            overflow-x: auto;
            flex-wrap: nowrap;
            padding-bottom: 4px;
            -webkit-overflow-scrolling: touch;
          }

          .quick-filter-heading {
            margin: 0 0 8px;
            padding: 0 2px;
          }

          .quick-filter-heading span {
            font-size: 12px;
          }

          .quick-filter-heading small {
            font-size: 10px;
          }

          .experience-filter-tabs::-webkit-scrollbar {
            display: none;
          }

          .experience-filter-tab {
            min-width: 76px;
            padding: 7px 10px;
            font-size: 11px;
          }

          .active-filter-chips {
            justify-content: flex-start !important;
            margin-top: -4px !important;
          }

          .experience-cards-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            gap: 8px !important;
          }

          .experience-card {
            min-height: 128px !important;
            border-radius: 12px !important;
            padding: 7px !important;
            box-shadow: 0 6px 14px rgba(0,0,0,0.2) !important;
          }

          .experience-title-box {
            min-height: 24px !important;
            padding: 0 !important;
            margin-bottom: 5px !important;
          }

          .experience-title-box h3 {
            font-size: 11px !important;
            line-height: 1.4 !important;
          }

          .experience-card-info {
            gap: 4px !important;
          }

          .experience-info-box {
            border-radius: 7px !important;
            padding: 4px !important;
          }

          .experience-info-box p:first-child {
            font-size: 8px !important;
            margin-bottom: 2px !important;
          }

          .experience-info-box p:last-child {
            font-size: 8px !important;
            line-height: 1.35 !important;
            overflow-wrap: anywhere;
          }

          .experience-card button {
            padding: 4px !important;
            font-size: 8px !important;
            border-radius: 7px !important;
            margin-top: 2px !important;
          }

          .experience-card span {
            font-size: 10px !important;
          }

          .experience-source-label {
            font-size: 6px !important;
            line-height: 1.2 !important;
            margin-bottom: 2px !important;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .experience-outcome-badges {
            gap: 2px !important;
            min-height: 14px !important;
            margin-bottom: 3px !important;
          }

          .experience-outcome-badge {
            padding: 2px 4px !important;
            font-size: 6px !important;
            max-width: 100%;
            border-radius: 999px !important;
            line-height: 1.1 !important;
          }

          .experience-outcome-badge span {
            font-size: inherit !important;
          }

          .experience-modal {
            width: 100% !important;
            max-height: 86vh;
            overflow-y: auto;
            border-radius: 18px !important;
            padding: 18px !important;
          }
        }

        @media (max-width: 430px) {
          .experience-cards-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 7px !important;
          }

          .experience-card {
            min-height: 122px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ExperiencesPage;
