import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import axios from "axios";
import majors from "../majors";
import API_BASE_URL from "../config/api";
import AnimatedCount from "../components/AnimatedCount";
import ShareButton from "../components/ShareButton";
import PremiumInlineNotice from "../components/PremiumInlineNotice";
import { guideUrl } from "../components/TrainingGuideBanner";
import {
  darbakGuideMeta,
  darbakGuideOrganizations,
} from "../data/darbakGuideSuggestions";
import { darbakContactDirectoryOrganizations } from "../data/darbakContactDirectory";
import { trackEvent } from "../utils/analytics";
import { getAccessHeaders, requestPremiumAccess } from "../utils/premiumAccess";
import {
  getSavedItemIds,
  getSavedItemUpdateState,
  markSavedItemSeen,
  toggleSavedItem,
} from "../utils/savedItems";
import {
  formatRelativeArabicTime,
  hasMeaningfulUpdate,
} from "../utils/dateDisplay";
import {
  buildTrainingFinderSeoPath,
  getSeoCityBySlug,
  getSeoSpecialtyBySlug,
} from "../utils/seoRoutes";
import { buildTrainingFinderSeoMeta, setPageSeo } from "../utils/seoMetadata";

export const cityOptions = [
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
  "نجران",
  "جازان",
  "تبوك",
  "حائل",
  "بريدة",
  "الباحة",
  "سكاكا",
  "عرعر",
  "ينبع",
  "الخرج",
  "العلا",
];

const pageFont = "'Aniq', 'Cairo', sans-serif";
const SHOW_TRAINING_FINDER_FAQ = false;
const LOCKED_OPPORTUNITY_PREVIEW =
  "هذه معاينة مختصرة للفرصة. فعّل دربك+ للوصول إلى تفاصيل الفرصة وروابط التقديم المباشرة.";

const emptyOpportunityRequest = {
  organizationName: "",
  title: "",
  city: "",
  specialty: "",
  applicationUrl: "",
  sourceUrl: "",
  deadline: "",
  applicationMethod: "",
  note: "",
  submitterContact: "",
};

const trainingFinderFaqItems = [
  {
    question: "هل ظهور الجهة يعني توفر تدريب حاليًا؟",
    answer:
      "لا، ظهور الجهة يعني أن طلابًا سبق وشاركوا تجربة تدريب فيها أو أنها جهة مناسبة كبداية بحث. التوفر الحالي يعتمد على إعلان الجهة أو تواصلها الرسمي.",
  },
  {
    question: "إذا ما ظهرت تجارب لتخصصي، هل يعني ما له جهات؟",
    answer:
      "أبدًا. قاعدة دربك تتوسع مع مشاركات الطلاب، وقد تكون الفرص موجودة لكن ما وصلتنا تجارب كافية عنها بعد.",
  },
  {
    question: "أبدأ بالتقديم من الموقع أو الإيميل؟",
    answer:
      "ابدأ بالموقع الرسمي إذا كان فيه برنامج تدريب واضح، وإذا ما لقيت رابطًا مباشرًا جرّب الإيميل المهني أو تواصل لينكدإن باختصار واحترام.",
  },
  {
    question: "ليش بعض النتائج اقتراحات وليست من تجارب دربك؟",
    answer:
      "نضيف الاقتراحات عشان تعطيك نقطة بداية أوسع، لكنها منفصلة عن تجارب دربك ولا تعني توفر فرصة حالية.",
  },
  {
    question: "كيف أساعد طلاب تخصصي؟",
    answer:
      "إذا تدربت في جهة، مشاركة تجربتك تضيف مسارًا جديدًا لطلاب بعدك وتخلي نتائج الصفحة أذكى وأقرب للواقع.",
  },
];

const normalizeName = (value = "") =>
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

const uniqueValues = (values = []) =>
  Array.from(
    new Map(
      values
        .filter(Boolean)
        .map((value) => [normalizeName(value), value])
    ).values()
  );

const uniqueEmails = (emails = []) =>
  Array.from(
    new Map(
      emails
        .filter(Boolean)
        .map((email) => [email.toString().trim().toLowerCase(), email.toString().trim()])
    ).values()
  );

const mergeGuideDirectoryOrganizations = (organizations = []) => {
  const organizationMap = new Map();

  organizations.forEach((organization) => {
    const key = normalizeName(organization.name);
    if (!key) return;

    const current = organizationMap.get(key);
    if (!current) {
      const emails = uniqueEmails(organization.emails || [organization.email]);
      organizationMap.set(key, {
        ...organization,
        emails,
        email: organization.email || emails[0] || "",
      });
      return;
    }

    const emails = uniqueEmails([
      ...(current.emails || []),
      current.email,
      ...(organization.emails || []),
      organization.email,
    ]);

    organizationMap.set(key, {
      ...current,
      emails,
      email: current.email || emails[0] || "",
      regions: uniqueValues([
        ...(current.regions || []),
        current.region,
        ...(organization.regions || []),
        organization.region,
      ]),
      cities: uniqueValues([
        ...(current.cities || []),
        current.city,
        ...(organization.cities || []),
        organization.city,
      ]),
      specialties: uniqueValues([
        ...(current.specialties || []),
        ...(organization.specialties || []),
      ]),
      contactType: current.contactType || organization.contactType || "",
      sourceLabel: current.sourceLabel || organization.sourceLabel || "",
      note: current.note || organization.note || "",
      usage: current.usage || organization.usage || "",
      guideSummary: current.guideSummary || organization.guideSummary || "",
    });
  });

  return Array.from(organizationMap.values());
};

const guideDirectoryOrganizations = mergeGuideDirectoryOrganizations([
  ...darbakGuideOrganizations,
  ...darbakContactDirectoryOrganizations,
]);

const guideDirectoryEmailCount = uniqueEmails(
  guideDirectoryOrganizations.flatMap((organization) => organization.emails || [])
).length;

const createReadableSlug = (value = "") => {
  const slug = normalizeName(value)
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || "training-opportunity";
};

const buildOpportunityDetailPath = (opportunity = {}) => {
  const opportunityId = opportunity._id || opportunity.id || "";
  const slug = createReadableSlug(
    [opportunity.organizationName, opportunity.title].filter(Boolean).join(" ")
  );

  return opportunityId
    ? `/where-to-train/opportunity/${encodeURIComponent(slug)}/${opportunityId}`
    : "/where-to-train";
};

const regionCities = {
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
  "منطقة مكة المكرمة": [
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
  "منطقة المدينة المنورة": [
    "المدينة المنورة",
    "ينبع",
    "العلا",
    "خيبر",
    "بدر",
    "المهد",
    "الحناكية",
  ],
  "المنطقة الشرقية": [
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
  "منطقة القصيم": [
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

const regionDisplayNames = {
  "منطقة مكة المكرمة": "منطقة مكة",
  "منطقة المدينة المنورة": "منطقة المدينة",
  "المنطقة الشرقية": "الشرقية",
  "منطقة القصيم": "القصيم",
};

const regionAliases = {
  الشرقية: "المنطقة الشرقية",
  شرقية: "المنطقة الشرقية",
  القصيم: "منطقة القصيم",
  قصيم: "منطقة القصيم",
  عسير: "منطقة عسير",
  تبوك: "منطقة تبوك",
  حائل: "منطقة حائل",
  جازان: "منطقة جازان",
  نجران: "منطقة نجران",
  الباحة: "منطقة الباحة",
  الجوف: "منطقة الجوف",
  "منطقة مكة": "منطقة مكة المكرمة",
  "منطقة المدينة": "منطقة المدينة المنورة",
};

const getRegionDisplayName = (regionName = "") =>
  regionDisplayNames[regionName] || regionName;

const getCanonicalRegionName = (cityName = "") => {
  if (!cityName) return "";
  if (regionCities[cityName]) return cityName;

  const normalizedCityName = normalizeName(cityName);
  const matchedAlias = Object.entries(regionAliases).find(
    ([alias]) => normalizeName(alias) === normalizedCityName
  );

  return matchedAlias?.[1] || "";
};

const regionOptions = Object.keys(regionCities).map((regionName) => ({
  label: getRegionDisplayName(regionName),
  value: getRegionDisplayName(regionName),
}));

const cityToSuggestionRegion = new Map(
  Object.entries(regionCities).flatMap(([region, cities]) =>
    cities.map((cityName) => [cityName, region])
  )
);

const resolveSuggestionRegion = (cityName) => {
  if (!cityName) return "";
  const regionName = getCanonicalRegionName(cityName);
  if (regionName) return regionName;
  return cityToSuggestionRegion.get(cityName) || "";
};

const getSelectedCityScope = (cityName) => {
  if (!cityName) return [];
  const regionName = getCanonicalRegionName(cityName);
  if (regionName) {
    return [
      regionName,
      getRegionDisplayName(regionName),
      ...regionCities[regionName],
    ];
  }

  const containingRegion = cityToSuggestionRegion.get(cityName);
  if (!containingRegion) return [cityName];

  return [
    cityName,
    containingRegion,
    getRegionDisplayName(containingRegion),
  ];
};

const isNationalGuideOrganization = (organization = {}) =>
  [organization.region, organization.city, ...(organization.regions || [])].some(
    (value) => normalizeName(value) === normalizeName("كل المناطق")
  );

const guideOrganizationMatchesLocation = (
  organization = {},
  selectedCityScope = [],
  suggestionRegion = "",
  cityName = ""
) => {
  if (!cityName) return true;
  if (isNationalGuideOrganization(organization)) return true;

  const allowedLocations = new Set(
    [
      cityName,
      suggestionRegion,
      getRegionDisplayName(suggestionRegion),
      ...selectedCityScope,
    ]
      .filter(Boolean)
      .map(normalizeName)
  );
  const organizationLocations = [
    organization.city,
    organization.region,
    ...(organization.cities || []),
    ...(organization.regions || []),
  ]
    .filter(Boolean)
    .map(normalizeName);

  return organizationLocations.some((locationName) =>
    allowedLocations.has(locationName)
  );
};

const getGuideOrganizationLocationText = (organization = {}) => {
  const cities = (organization.cities || []).filter(
    (cityName) => normalizeName(cityName) !== normalizeName("كل المناطق")
  );
  if (cities.length > 0) return cities.slice(0, 3).join("، ");

  const regions = (organization.regions || [])
    .filter((regionName) => normalizeName(regionName) !== normalizeName("كل المناطق"))
    .map(getRegionDisplayName);
  if (regions.length > 0) return regions.slice(0, 3).join("، ");

  return "كل المناطق";
};

const getGuideSpecialtyPreview = (organization = {}, fallback = "") => {
  const specialties = organization.specialties || [];
  if (specialties.length === 0) return fallback || "تخصصات متعددة";
  const preview = specialties.slice(0, 3).join("، ");
  return specialties.length > 3 ? `${preview} +${specialties.length - 3}` : preview;
};

const entityIncludesAny = (entity = {}, keywords = []) => {
  const text = [
    entity.name,
    entity.organizationName,
    entity.title,
    entity.sector,
    entity.note,
    entity.contactType,
    entity.applicationMethod,
    entity.applicationWindow,
    entity.usage,
    ...(entity.specialties || []),
    ...(entity.majorCategories || []),
    ...(entity.majors || []),
    ...(entity.methods || []),
  ]
    .filter(Boolean)
    .join(" ");
  const normalizedText = normalizeName(text);

  return keywords.some((keyword) =>
    normalizedText.includes(normalizeName(keyword))
  );
};

const isGovernmentEntity = (entity) =>
  entityIncludesAny(entity, [
    "حكومي",
    "وزارة",
    "هيئة",
    "امانة",
    "أمانة",
    "جامعة",
    "ديوان",
    "صندوق",
    "مركز وطني",
    "المركز الوطني",
    "بلدية",
    "الهيئة الملكية",
  ]);

const isTechEntity = (entity) =>
  !isGovernmentEntity(entity) &&
  entityIncludesAny(entity, [
    "تقنية",
    "تقني",
    "حلول رقمية",
    "برمجيات",
    "بيانات",
    "ذكاء اصطناعي",
    "امن سيبراني",
    "أمن سيبراني",
    "اتصالات",
    "نظم معلومات",
    "حاسب",
    "it",
    "software",
    "digital",
  ]);

const isConsultingEntity = (entity) =>
  entityIncludesAny(entity, [
    "استشارات",
    "استشارية",
    "مراجعة",
    "محاسبة ومراجعة",
    "ey",
    "ernst",
    "kpmg",
    "pwc",
    "deloitte",
    "accenture",
    "bcg",
    "mckinsey",
    "bain",
  ]);

const acceptsWithoutAnnouncement = (entity) =>
  entityIncludesAny(entity, [
    "ايميل",
    "إيميل",
    "بريد",
    "ارسال",
    "إرسال",
    "تواصل مباشر",
    "تدريب مباشر",
    "يدوي",
    "manual",
    "email",
  ]);

const formatInteractionCount = (count = 0) => {
  const numericCount = Number(count) || 0;
  if (numericCount >= 1000) return `${(numericCount / 1000).toFixed(1)}k`;
  return numericCount.toString();
};

const getInteractionStat = (item = {}, key) =>
  Number(item.interactionStats?.[key]) || 0;

const getOpportunityCardStats = (opportunity = {}) => {
  const engagement =
    getInteractionStat(opportunity, "engagement") ||
    Number(opportunity.interactionCount) ||
    0;
  const applies = getInteractionStat(opportunity, "applies");
  const saves = getInteractionStat(opportunity, "saves");

  return [
    { key: "engagement", icon: "👁", label: "تفاعل", value: engagement },
    ...(applies > 0
      ? [{ key: "applies", icon: "↗", label: "تقديم", value: applies }]
      : []),
    ...(saves > 0
      ? [{ key: "saves", icon: "♥", label: "حفظ", value: saves }]
      : []),
  ].filter((stat) => Number(stat.value) > 0);
};

const dedupeOrganizations = (organizations = []) =>
  Array.from(
    new Map(
      organizations.map((organization) => [
        `${normalizeName(organization.name)}-${organization.url}`,
        organization,
      ])
    ).values()
  );

const getOrganizationDomain = (url = "") => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

const getOrganizationLogoUrl = (url = "") => {
  const domain = getOrganizationDomain(url);
  if (!domain) return "";
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
};

const getOrganizationLogoUrlFromDomain = (domain = "") => {
  const cleanDomain = domain.toString().trim().replace(/^@/, "");
  if (!cleanDomain || !cleanDomain.includes(".")) return "";
  return `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=128`;
};

const getFirstEmailDomain = (emails = []) => {
  const email = emails.find((value) => value && value.includes("@")) || "";
  return email.split("@")[1] || "";
};

const getOrganizationInitial = (name = "") => {
  const firstLetter = name.trim().replace(/[^\u0600-\u06FFA-Za-z0-9]/g, "")[0];
  return firstLetter || "د";
};

const OrganizationLogo = ({ name, url, imageUrl }) => {
  const [hasImageError, setHasImageError] = useState(false);
  const logoUrl = imageUrl || getOrganizationLogoUrl(url);
  const initial = getOrganizationInitial(name);

  useEffect(() => {
    setHasImageError(false);
  }, [logoUrl]);

  return (
    <span
      className="suggested-organization-logo"
      aria-hidden="true"
    >
      {logoUrl && !hasImageError ? (
        <span className="organization-logo-image-frame">
          <img
            src={logoUrl}
            alt=""
            width="28"
            height="28"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setHasImageError(true)}
          />
        </span>
      ) : (
        <span className="organization-logo-initial">{initial}</span>
      )}
    </span>
  );
};

const opportunityLabels = {
  trainingEnvironment: {
    mixed: "مختلطة",
    women: "نساء",
    men: "رجال",
    "": "غير محدد",
  },
  trainingMode: {
    onsite: "حضوري",
    remote: "عن بعد",
    hybrid: "مختلط",
    "": "غير محدد",
  },
  hasReward: {
    yes: "مكافأة",
    no: "بدون مكافأة",
    "": "غير محدد",
  },
  applicationMethod: {
    website: "موقع",
    email: "إيميل",
    linkedin: "لينكدإن",
    manual: "يدوي",
    other: "أخرى",
    "": "غير محدد",
  },
};

const getOpportunityLabel = (field, value) =>
  opportunityLabels[field]?.[value || ""] || "غير محدد";

const hiddenOpportunityLabels = new Set([
  "",
  "غير محدد",
  "غير واضح",
  "غير مذكور",
  "not specified",
  "unknown",
]);

const getOpportunityDisplayLabel = (field, value) => {
  const label = getOpportunityLabel(field, value);
  return hiddenOpportunityLabels.has(String(label).trim().toLowerCase())
    ? ""
    : label;
};

const formatOpportunityDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getOpportunityUpdateTimestamp = (opportunity = {}) =>
  opportunity.updatedAt || opportunity.createdAt;

const getOpportunityFreshnessLabel = (opportunity = {}) => {
  if (hasMeaningfulUpdate(opportunity.createdAt, opportunity.updatedAt)) {
    const relativeUpdate = formatRelativeArabicTime(opportunity.updatedAt);
    return relativeUpdate ? `تم التحديث ${relativeUpdate}` : "";
  }

  const relativeCreate = formatRelativeArabicTime(opportunity.createdAt);
  return relativeCreate ? `أضيفت ${relativeCreate}` : "";
};

const getOpportunityApplicationState = (deadline, status = "") => {
  if (status === "expired") return { label: "مغلق", tone: "closed" };
  if (!deadline) return { label: "مفتوح", tone: "open" };

  const deadlineDate = new Date(deadline);
  if (Number.isNaN(deadlineDate.getTime())) {
    return { label: "مفتوح", tone: "open" };
  }

  deadlineDate.setHours(23, 59, 59, 999);
  return deadlineDate < new Date()
    ? { label: "مغلق", tone: "closed" }
    : { label: "مفتوح", tone: "open" };
};

const getOpportunityCreatedAtTimestamp = (opportunity = {}) => {
  const date = new Date(opportunity.createdAt || opportunity.updatedAt || "");
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const isOpportunityRecentlyAdded = (opportunity = {}, days = 14) => {
  const createdAt = getOpportunityCreatedAtTimestamp(opportunity);
  if (!createdAt) return false;

  return Date.now() - createdAt <= days * 24 * 60 * 60 * 1000;
};

const opportunityQuickFilters = [
  { key: "reward", value: "yes", label: "بمكافأة" },
  { key: "freshness", value: "recent", label: "فرص جديدة" },
  { key: "mode", value: "onsite", label: "حضوري" },
  { key: "status", value: "open", label: "مفتوح" },
  { key: "status", value: "closed", label: "مغلق" },
];

const getOpportunityCities = (opportunity = {}) => {
  const cities = Array.isArray(opportunity.cities)
    ? opportunity.cities.filter(Boolean)
    : [];

  return cities.length > 0 ? cities : opportunity.city ? [opportunity.city] : [];
};

const getOpportunityCityText = (opportunity = {}) => {
  const cities = getOpportunityCities(opportunity);
  if (cities.length === 0) return "";
  if (cities.length <= 2) return cities.join("، ");
  return `${cities.slice(0, 2).join("، ")} +${cities.length - 2}`;
};

export const specializationOptions = Array.from(
  majors
    .reduce((optionsMap, majorGroup) => {
      (majorGroup.subMajors || []).forEach((specialization) => {
        const key = normalizeName(specialization);
        const existingOption = optionsMap.get(key);

        if (existingOption) {
          if (!existingOption.categories.includes(majorGroup.name)) {
            existingOption.categories.push(majorGroup.name);
          }
          return;
        }

        optionsMap.set(key, {
          value: specialization,
          label: specialization,
          categories: [majorGroup.name],
        });
      });

      return optionsMap;
    }, new Map())
    .values()
).sort((a, b) => a.label.localeCompare(b.label, "ar"));

export const suggestedOrganizationsByRegion = {
  "منطقة الرياض": [
    { name: "stc", url: "https://www.stc.com.sa/", note: "اتصالات وتقنية" },
    { name: "شركة علم", url: "https://www.elm.sa/", note: "حلول رقمية" },
    { name: "سدايا", url: "https://sdaia.gov.sa/", note: "بيانات وذكاء اصطناعي" },
    { name: "منشآت", url: "https://www.monshaat.gov.sa/", note: "ريادة وأعمال" },
    { name: "القدية", url: "https://www.qiddiya.com/", note: "ترفيه ومشاريع كبرى" },
  ],
  "منطقة مكة المكرمة": [
    { name: "الخطوط السعودية", url: "https://www.saudia.com/", note: "طيران وتشغيل" },
    { name: "بوبا العربية", url: "https://www.bupa.com.sa/", note: "تأمين وصحة" },
    { name: "مجموعة صافولا", url: "https://www.savola.com/", note: "أعمال وسلاسل إمداد" },
    { name: "جامعة الملك عبدالعزيز", url: "https://www.kau.edu.sa/", note: "تعليم وإدارة" },
    { name: "كدانة", url: "https://kidana.com.sa/", note: "تطوير المشاعر" },
    { name: "جامعة أم القرى", url: "https://uqu.edu.sa/", note: "تعليم وبحث" },
  ],
  "منطقة المدينة المنورة": [
    { name: "هيئة تطوير منطقة المدينة المنورة", url: "https://mda.gov.sa/", note: "تطوير حضري" },
    { name: "رؤى المدينة", url: "https://www.ruaalmadinah.com/", note: "تطوير وضيافة" },
    { name: "جامعة طيبة", url: "https://www.taibahu.edu.sa/", note: "تعليم وبحث" },
    { name: "الهيئة الملكية لمحافظة العلا", url: "https://www.rcu.gov.sa/", note: "ثقافة وسياحة" },
    { name: "الهيئة الملكية للجبيل وينبع", url: "https://www.rcjy.gov.sa/", note: "صناعة وإدارة مدن" },
  ],
  "المنطقة الشرقية": [
    { name: "أرامكو", url: "https://www.aramco.com/", note: "طاقة وهندسة" },
    { name: "سابك", url: "https://www.sabic.com/", note: "صناعة وكيمياء" },
    { name: "معادن", url: "https://www.maaden.com.sa/", note: "تعدين وصناعة" },
    { name: "الهيئة الملكية للجبيل وينبع", url: "https://www.rcjy.gov.sa/", note: "صناعة وإدارة مدن" },
    { name: "جامعة الملك فهد للبترول والمعادن", url: "https://www.kfupm.edu.sa/", note: "تعليم وتقنية" },
  ],
  "منطقة القصيم": [
    { name: "جامعة القصيم", url: "https://www.qu.edu.sa/", note: "تعليم وبحث" },
    { name: "غرفة القصيم", url: "https://www.qcc.org.sa/", note: "أعمال وتدريب" },
    { name: "المراعي", url: "https://www.almarai.com/", note: "أغذية وتشغيل" },
    { name: "وزارة البيئة والمياه والزراعة", url: "https://www.mewa.gov.sa/", note: "زراعة وبيئة" },
    { name: "صندوق التنمية الزراعية", url: "https://www.adf.gov.sa/", note: "تمويل وزراعة" },
  ],
  "منطقة عسير": [
    { name: "هيئة تطوير عسير", url: "https://www.asda.gov.sa/", note: "تطوير وسياحة" },
    { name: "جامعة الملك خالد", url: "https://www.kku.edu.sa/", note: "تعليم وبحث" },
    { name: "أمانة منطقة عسير", url: "https://www.ars.gov.sa/", note: "خدمات بلدية" },
    { name: "وزارة السياحة", url: "https://mt.gov.sa/", note: "سياحة وضيافة" },
    { name: "السودة للتطوير", url: "https://www.soudah.sa/", note: "سياحة ومشاريع كبرى" },
  ],
  "منطقة تبوك": [
    { name: "نيوم", url: "https://www.neom.com/", note: "مشاريع كبرى وتقنية" },
    { name: "البحر الأحمر الدولية", url: "https://www.redseaglobal.com/", note: "سياحة واستدامة" },
    { name: "أمالا", url: "https://www.amaala.com/", note: "سياحة وضيافة" },
    { name: "جامعة تبوك", url: "https://www.ut.edu.sa/", note: "تعليم وبحث" },
    { name: "وزارة البيئة والمياه والزراعة", url: "https://www.mewa.gov.sa/", note: "بيئة وزراعة" },
  ],
  "منطقة حائل": [
    { name: "جامعة حائل", url: "https://www.uoh.edu.sa/", note: "تعليم وبحث" },
    { name: "المراعي", url: "https://www.almarai.com/", note: "أغذية وتشغيل" },
    { name: "وزارة البيئة والمياه والزراعة", url: "https://www.mewa.gov.sa/", note: "زراعة وبيئة" },
    { name: "صندوق التنمية الزراعية", url: "https://www.adf.gov.sa/", note: "تمويل وزراعة" },
  ],
  "منطقة الحدود الشمالية": [
    { name: "جامعة الحدود الشمالية", url: "https://www.nbu.edu.sa/", note: "تعليم وبحث" },
    { name: "أمانة منطقة الحدود الشمالية", url: "https://arar-mu.momah.gov.sa/", note: "خدمات بلدية" },
    { name: "معادن", url: "https://www.maaden.com.sa/", note: "تعدين وصناعة" },
    { name: "وزارة البيئة والمياه والزراعة", url: "https://www.mewa.gov.sa/", note: "بيئة وزراعة" },
  ],
  "منطقة جازان": [
    { name: "جامعة جازان", url: "https://www.jazanu.edu.sa/", note: "تعليم وبحث" },
    { name: "غرفة جازان", url: "https://www.jazancci.org.sa/", note: "أعمال وتدريب" },
    { name: "أمانة منطقة جازان", url: "https://www.jazan.sa/", note: "خدمات بلدية" },
    { name: "أرامكو", url: "https://www.aramco.com/", note: "طاقة وتشغيل" },
    { name: "وزارة البيئة والمياه والزراعة", url: "https://www.mewa.gov.sa/", note: "بيئة وزراعة" },
  ],
  "منطقة نجران": [
    { name: "جامعة نجران", url: "https://www.nu.edu.sa/", note: "تعليم وبحث" },
    { name: "أمانة منطقة نجران", url: "https://www.najran.gov.sa/", note: "خدمات بلدية" },
    { name: "وزارة البيئة والمياه والزراعة", url: "https://www.mewa.gov.sa/", note: "بيئة وزراعة" },
    { name: "صندوق التنمية الزراعية", url: "https://www.adf.gov.sa/", note: "تمويل وزراعة" },
  ],
  "منطقة الباحة": [
    { name: "جامعة الباحة", url: "https://bu.edu.sa/", note: "تعليم وبحث" },
    { name: "أمانة منطقة الباحة", url: "https://baha.gov.sa/", note: "خدمات بلدية" },
    { name: "وزارة السياحة", url: "https://mt.gov.sa/", note: "سياحة وضيافة" },
    { name: "وزارة البيئة والمياه والزراعة", url: "https://www.mewa.gov.sa/", note: "بيئة وزراعة" },
  ],
  "منطقة الجوف": [
    { name: "جامعة الجوف", url: "https://www.ju.edu.sa/", note: "تعليم وبحث" },
    { name: "نادك", url: "https://nadec.com/", note: "زراعة وأغذية" },
    { name: "وزارة البيئة والمياه والزراعة", url: "https://www.mewa.gov.sa/", note: "بيئة وزراعة" },
    { name: "صندوق التنمية الزراعية", url: "https://www.adf.gov.sa/", note: "تمويل وزراعة" },
  ],
};

export const suggestedOrganizationsByMajorCategory = {
  "الطب والعلوم الصحية": [
    { name: "وزارة الصحة", url: "https://www.moh.gov.sa/", note: "صحة عامة وإدارة صحية" },
    { name: "الهيئة العامة للغذاء والدواء", url: "https://www.sfda.gov.sa/", note: "رقابة ومختبرات وصحة" },
    { name: "مستشفى الملك فيصل التخصصي", url: "https://www.kfshrc.edu.sa/", note: "رعاية صحية وبحث" },
    { name: "مجلس الضمان الصحي", url: "https://chi.gov.sa/", note: "تأمين صحي وتنظيم" },
    { name: "بوبا العربية", url: "https://www.bupa.com.sa/", note: "تأمين وخدمات صحية" },
    { name: "مجموعة الدكتور سليمان الحبيب", url: "https://hmg.com/", note: "تشغيل صحي ومستشفيات" },
    { name: "دله الصحية", url: "https://www.dallah-health.com/", note: "رعاية صحية وتشغيل" },
  ],
  "الهندسة والطاقة": [
    { name: "أرامكو", url: "https://www.aramco.com/", note: "طاقة وهندسة وتشغيل" },
    { name: "سابك", url: "https://www.sabic.com/", note: "صناعة وكيمياء وهندسة" },
    { name: "معادن", url: "https://www.maaden.com.sa/", note: "تعدين وصناعة" },
    { name: "الشركة السعودية للكهرباء", url: "https://www.se.com.sa/", note: "طاقة كهربائية وتشغيل" },
    { name: "أكوا باور", url: "https://www.acwapower.com/", note: "طاقة ومياه واستدامة" },
    { name: "الهيئة الملكية للجبيل وينبع", url: "https://www.rcjy.gov.sa/", note: "مدن صناعية وهندسة" },
    { name: "نيوم", url: "https://www.neom.com/", note: "مشاريع كبرى وتقنية" },
    { name: "البحر الأحمر الدولية", url: "https://www.redseaglobal.com/", note: "استدامة ومشاريع" },
  ],
  "الحاسب والتقنية": [
    { name: "سدايا", url: "https://sdaia.gov.sa/", note: "بيانات وذكاء اصطناعي" },
    { name: "هيئة الحكومة الرقمية", url: "https://dga.gov.sa/", note: "تحول رقمي وحوكمة" },
    { name: "هيئة الاتصالات والفضاء والتقنية", url: "https://www.cst.gov.sa/", note: "تقنية واتصالات وتنظيم" },
    { name: "stc", url: "https://www.stc.com.sa/", note: "اتصالات وتقنية" },
    { name: "شركة علم", url: "https://www.elm.sa/", note: "حلول رقمية ومنتجات" },
    { name: "زين السعودية", url: "https://sa.zain.com/", note: "اتصالات وتقنية" },
    { name: "موبايلي", url: "https://www.mobily.com.sa/", note: "اتصالات وتقنية" },
    { name: "SITE", url: "https://site.sa/", note: "أمن سيبراني وتقنية" },
  ],
  "القانون والسياسة": [
    { name: "وزارة العدل", url: "https://www.moj.gov.sa/", note: "قانون وخدمات عدلية" },
    { name: "ديوان المظالم", url: "https://www.bog.gov.sa/", note: "قضاء إداري وأنظمة" },
    { name: "النيابة العامة", url: "https://pp.gov.sa/", note: "أنظمة وعدالة جنائية" },
    { name: "هيئة حقوق الإنسان", url: "https://www.hrc.gov.sa/", note: "حقوق وأنظمة" },
    { name: "هيئة الخبراء بمجلس الوزراء", url: "https://www.boe.gov.sa/", note: "تشريعات وسياسات" },
    { name: "وزارة الخارجية", url: "https://www.mofa.gov.sa/", note: "سياسة وعلاقات دولية" },
    { name: "هيئة السوق المالية", url: "https://cma.org.sa/", note: "أنظمة مالية وتنظيم" },
  ],
  "المالية والإدارية": [
    { name: "البنك المركزي السعودي", url: "https://www.sama.gov.sa/", note: "مالية وبنوك وتنظيم" },
    { name: "هيئة السوق المالية", url: "https://cma.org.sa/", note: "أسواق مالية وحوكمة" },
    { name: "تداول السعودية", url: "https://www.saudiexchange.sa/", note: "أسواق مالية وعمليات" },
    { name: "صندوق الاستثمارات العامة", url: "https://www.pif.gov.sa/", note: "استثمار وإدارة" },
    { name: "وزارة المالية", url: "https://www.mof.gov.sa/", note: "مالية عامة وإدارة" },
    { name: "هيئة الزكاة والضريبة والجمارك", url: "https://zatca.gov.sa/", note: "ضريبة وجمارك وامتثال" },
    { name: "EY", url: "https://www.ey.com/ar_sa", note: "استشارات ومراجعة" },
    { name: "PwC الشرق الأوسط", url: "https://www.pwc.com/m1/en/countries/saudi-arabia.html", note: "استشارات ومراجعة" },
    { name: "Deloitte الشرق الأوسط", url: "https://www.deloitte.com/middle-east/en/about/locations/saudi-arabia.html", note: "استشارات ومراجعة" },
    { name: "KPMG السعودية", url: "https://kpmg.com/sa/", note: "استشارات ومراجعة" },
  ],
  "السياحة والضيافة": [
    { name: "وزارة السياحة", url: "https://mt.gov.sa/", note: "سياحة وتنظيم" },
    { name: "الهيئة السعودية للسياحة", url: "https://www.sta.gov.sa/", note: "تسويق وتجارب سياحية" },
    { name: "البحر الأحمر الدولية", url: "https://www.redseaglobal.com/", note: "سياحة وضيافة واستدامة" },
    { name: "أمالا", url: "https://www.amaala.com/", note: "وجهات سياحية فاخرة" },
    { name: "رؤى المدينة", url: "https://www.ruaalmadinah.com/", note: "ضيافة وتطوير وجهات" },
    { name: "كدانة", url: "https://kidana.com.sa/", note: "تطوير المشاعر وخدمات" },
    { name: "الهيئة الملكية لمحافظة العلا", url: "https://www.rcu.gov.sa/", note: "ثقافة وسياحة" },
    { name: "السودة للتطوير", url: "https://www.soudah.sa/", note: "سياحة ومشاريع كبرى" },
  ],
  "الإعلام والإتصال": [
    { name: "وزارة الإعلام", url: "https://media.gov.sa/", note: "إعلام واتصال حكومي" },
    { name: "هيئة الإذاعة والتلفزيون", url: "https://www.sba.sa/", note: "إنتاج وبث إعلامي" },
    { name: "وكالة الأنباء السعودية", url: "https://www.spa.gov.sa/", note: "صحافة وأخبار" },
    { name: "الهيئة العامة لتنظيم الإعلام", url: "https://gc.gov.sa/", note: "تنظيم إعلامي" },
    { name: "MBC", url: "https://www.mbc.net/", note: "إعلام وإنتاج" },
    { name: "المجموعة السعودية للأبحاث والإعلام", url: "https://www.srmg.com/", note: "إعلام ونشر" },
    { name: "هيئة الاتصالات والفضاء والتقنية", url: "https://www.cst.gov.sa/", note: "اتصال وتقنية وتنظيم" },
  ],
  "اللغات والآداب": [
    { name: "وزارة الثقافة", url: "https://www.moc.gov.sa/", note: "ثقافة ومبادرات" },
    { name: "هيئة الأدب والنشر والترجمة", url: "https://lpt.moc.gov.sa/", note: "أدب ونشر وترجمة" },
    { name: "مجمع الملك سلمان العالمي للغة العربية", url: "https://ksaa.gov.sa/", note: "لغة عربية ومحتوى" },
    { name: "مكتبة الملك فهد الوطنية", url: "https://www.kfnl.gov.sa/", note: "مكتبات ومعلومات" },
    { name: "دارة الملك عبدالعزيز", url: "https://www.darah.org.sa/", note: "توثيق وتاريخ" },
    { name: "هيئة التراث", url: "https://heritage.moc.gov.sa/", note: "تراث ومحتوى ثقافي" },
  ],
  "التصميم والفنون": [
    { name: "وزارة الثقافة", url: "https://www.moc.gov.sa/", note: "ثقافة وفنون" },
    { name: "هيئة فنون العمارة والتصميم", url: "https://archdesign.moc.gov.sa/", note: "تصميم وعمارة" },
    { name: "هيئة الفنون البصرية", url: "https://visualarts.moc.gov.sa/", note: "فنون بصرية" },
    { name: "هيئة الأفلام", url: "https://film.moc.gov.sa/", note: "إنتاج وصناعة أفلام" },
    { name: "معهد مسك للفنون", url: "https://miskartinstitute.org/", note: "فنون وتطوير إبداعي" },
    { name: "إثراء", url: "https://www.ithra.com/", note: "ثقافة وإبداع" },
    { name: "بوابة الدرعية", url: "https://www.diriyah.sa/", note: "تصميم وتجارب ثقافية" },
  ],
  "العلوم الأساسية": [
    { name: "كاوست", url: "https://www.kaust.edu.sa/", note: "بحث وعلوم متقدمة" },
    { name: "مدينة الملك عبدالعزيز للعلوم والتقنية", url: "https://www.kacst.gov.sa/", note: "بحث وابتكار" },
    { name: "هيئة المساحة الجيولوجية السعودية", url: "https://sgs.gov.sa/", note: "جيولوجيا وعلوم أرض" },
    { name: "المركز الوطني للأرصاد", url: "https://ncm.gov.sa/", note: "أرصاد وبيانات" },
    { name: "الهيئة العامة للغذاء والدواء", url: "https://www.sfda.gov.sa/", note: "مختبرات ورقابة" },
    { name: "المركز الوطني للرقابة على الالتزام البيئي", url: "https://ncec.gov.sa/", note: "بيئة واستدامة" },
  ],
  "العلوم الإنسانية": [
    { name: "دارة الملك عبدالعزيز", url: "https://www.darah.org.sa/", note: "تاريخ وتوثيق" },
    { name: "هيئة التراث", url: "https://heritage.moc.gov.sa/", note: "تراث وأبحاث" },
    { name: "وزارة الثقافة", url: "https://www.moc.gov.sa/", note: "ثقافة ومشاريع" },
    { name: "مكتبة الملك فهد الوطنية", url: "https://www.kfnl.gov.sa/", note: "مكتبات ومعلومات" },
    { name: "الهيئة الملكية لمحافظة العلا", url: "https://www.rcu.gov.sa/", note: "تراث وسياحة" },
    { name: "مجمع الملك سلمان العالمي للغة العربية", url: "https://ksaa.gov.sa/", note: "لغة ومحتوى" },
  ],
  "العلوم الإجتماعية": [
    { name: "وزارة الموارد البشرية والتنمية الاجتماعية", url: "https://www.hrsd.gov.sa/", note: "تنمية اجتماعية وعمل" },
    { name: "هيئة حقوق الإنسان", url: "https://www.hrc.gov.sa/", note: "حقوق ومجتمع" },
    { name: "مركز الملك سلمان للإغاثة", url: "https://www.ksrelief.org/", note: "عمل إنساني وتنمية" },
    { name: "جمعية إنسان", url: "https://ensanonline.com/", note: "خدمة اجتماعية" },
    { name: "مؤسسة مسك", url: "https://misk.org.sa/", note: "تمكين شباب ومبادرات" },
    { name: "جمعية الأطفال ذوي الإعاقة", url: "https://dca.org.sa/", note: "خدمة اجتماعية ورعاية" },
  ],
  "العلوم التربوية": [
    { name: "وزارة التعليم", url: "https://www.moe.gov.sa/", note: "تعليم وسياسات" },
    { name: "هيئة تقويم التعليم والتدريب", url: "https://etec.gov.sa/", note: "تقويم وتعليم" },
    { name: "المركز الوطني للتعليم الإلكتروني", url: "https://nelc.gov.sa/", note: "تعليم رقمي" },
    { name: "موهبة", url: "https://www.mawhiba.org/", note: "تعليم وموهوبون" },
    { name: "مؤسسة مسك", url: "https://misk.org.sa/", note: "تعليم وتمكين" },
    { name: "جامعة الملك سعود", url: "https://ksu.edu.sa/", note: "تعليم وبحث" },
  ],
  "العلوم الزراعية": [
    { name: "وزارة البيئة والمياه والزراعة", url: "https://www.mewa.gov.sa/", note: "زراعة وبيئة ومياه" },
    { name: "صندوق التنمية الزراعية", url: "https://www.adf.gov.sa/", note: "تمويل زراعي" },
    { name: "نادك", url: "https://nadec.com/", note: "زراعة وأغذية" },
    { name: "المراعي", url: "https://www.almarai.com/", note: "أغذية وتشغيل" },
    { name: "المركز الوطني لتنمية الغطاء النباتي", url: "https://www.ncv.gov.sa/", note: "بيئة واستدامة" },
    { name: "الهيئة العامة للغذاء والدواء", url: "https://www.sfda.gov.sa/", note: "غذاء ورقابة" },
  ],
  "العلوم الرياضية": [
    { name: "وزارة الرياضة", url: "https://www.mos.gov.sa/", note: "رياضة وإدارة" },
    { name: "اللجنة الأولمبية والبارالمبية السعودية", url: "https://olympic.sa/", note: "رياضة واتحادات" },
    { name: "الاتحاد السعودي لكرة القدم", url: "https://www.saff.com.sa/", note: "إدارة رياضية" },
    { name: "الاتحاد السعودي للرياضة للجميع", url: "https://sportsforall.com.sa/", note: "برامج ومبادرات رياضية" },
    { name: "معهد إعداد القادة", url: "https://leadersinstitute.sa/", note: "تدريب وقيادة رياضية" },
    { name: "نادي الهلال", url: "https://alhilal.com/", note: "إدارة رياضية وتسويق" },
  ],
};

const organizationHomepageEntries = [
  ...guideDirectoryOrganizations
    .filter((organization) => organization.url || organization.sourceUrl)
    .map((organization) => [
      organization.name,
      organization.url || organization.sourceUrl,
    ]),
  ...Object.values(suggestedOrganizationsByRegion)
    .flat()
    .map((organization) => [organization.name, organization.url]),
  ...Object.values(suggestedOrganizationsByMajorCategory)
    .flat()
    .map((organization) => [organization.name, organization.url]),
  ["علم", "https://www.elm.sa/"],
  ["elm", "https://www.elm.sa/"],
  ["اس تي سي", "https://www.stc.com.sa/"],
  ["الاتصالات السعودية", "https://www.stc.com.sa/"],
  ["أرامكو", "https://www.aramco.com/"],
  ["ارامكو", "https://www.aramco.com/"],
  ["aramco", "https://www.aramco.com/"],
  ["سابك", "https://www.sabic.com/"],
  ["sabic", "https://www.sabic.com/"],
  ["هيئة السوق المالية", "https://cma.org.sa/"],
  ["الهيئة السوق المالية", "https://cma.org.sa/"],
  ["cma", "https://cma.org.sa/"],
  ["زين", "https://sa.zain.com/"],
  ["شركة زين", "https://sa.zain.com/"],
  ["zain", "https://sa.zain.com/"],
  ["EY", "https://www.ey.com/ar_sa"],
  ["EY (Ernst & Young)", "https://www.ey.com/ar_sa"],
  ["Ernst & Young", "https://www.ey.com/ar_sa"],
  ["ارامكو", "https://www.aramco.com/"],
  ["معادن", "https://www.maaden.com.sa/"],
  ["maaden", "https://www.maaden.com.sa/"],
  ["سدايا", "https://sdaia.gov.sa/"],
  ["sdaia", "https://sdaia.gov.sa/"],
  ["منشآت", "https://www.monshaat.gov.sa/"],
  ["منشات", "https://www.monshaat.gov.sa/"],
  ["مسك", "https://misk.org.sa/"],
  ["misk", "https://misk.org.sa/"],
];

const organizationHomepageMap = new Map(
  organizationHomepageEntries.map(([name, url]) => [normalizeName(name), url])
);

const getOrganizationLookupKeys = (value = "") => {
  const normalized = normalizeName(value);
  const withoutGenericPrefix = normalized.replace(
    /^(شركه|شركة|الهيئه|هيئه|الوزاره|وزاره|جامعه|غرفه|امانه)\s+/,
    ""
  );

  return Array.from(
    new Set([
      normalized,
      withoutGenericPrefix,
      normalized.replace(/\s+بالرياض$/, ""),
      normalized.replace(/\s+بجده$/, ""),
      normalized.replace(/\s+بمكه$/, ""),
      normalized.replace(/\s+بالمدينه$/, ""),
    ].filter(Boolean))
  );
};

const resolveOrganizationHomepageUrl = (organizationName) => {
  const lookupKeys = getOrganizationLookupKeys(organizationName);
  const directUrl = lookupKeys
    .map((key) => organizationHomepageMap.get(key))
    .find(Boolean);

  if (directUrl) return directUrl;

  const normalizedOrganization = normalizeName(organizationName);
  if (normalizedOrganization.length < 4) return "";

  return organizationHomepageEntries.find(([name]) => {
    const normalizedName = normalizeName(name);
    return (
      normalizedName.length >= 4 &&
      (normalizedOrganization.includes(normalizedName) ||
        normalizedName.includes(normalizedOrganization))
    );
  })?.[1] || "";
};

export default function TrainingFinderPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const routeParams = useParams();
  const [searchParams] = useSearchParams();
  const routeOpportunityId = routeParams.opportunityId || "";
  const routeSpecialty =
    getSeoSpecialtyBySlug(routeParams.majorSlug)?.label || "";
  const routeCity = getSeoCityBySlug(routeParams.citySlug)?.label || "";
  const querySpecialty = searchParams.get("major") || "";
  const queryCity = searchParams.get("city") || "";
  const initialSpecialty = routeSpecialty || querySpecialty;
  const initialCity = routeCity || queryCity;
  const seoPath = buildTrainingFinderSeoPath({
    city: routeCity,
    specialty: routeSpecialty,
  });
  const [selectedSpecialty, setSelectedSpecialty] = useState(() =>
    specializationOptions.some((option) => option.value === initialSpecialty)
      ? initialSpecialty
      : ""
  );
  const [city, setCity] = useState(initialCity);
  const [targets, setTargets] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(false);
  const [error, setError] = useState("");
  const [faqExpanded, setFaqExpanded] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState(null);
  const [selectedGuideOrganization, setSelectedGuideOrganization] =
    useState(null);
  const [showSearchInsightModal, setShowSearchInsightModal] = useState(false);
  const [activeResultsTab, setActiveResultsTab] = useState("opportunities");
  const [opportunityFilters, setOpportunityFilters] = useState({
    status: "",
    reward: "",
    mode: "",
    freshness: "",
  });
  const [showOpportunityRequestModal, setShowOpportunityRequestModal] =
    useState(false);
  const [opportunityRequest, setOpportunityRequest] = useState(
    emptyOpportunityRequest
  );
  const [savingOpportunityRequest, setSavingOpportunityRequest] = useState(false);
  const [opportunityRequestMessage, setOpportunityRequestMessage] = useState("");
  const [savedItemIds, setSavedItemIds] = useState(() => getSavedItemIds());
  const handledRouteOpportunityIdRef = useRef("");

  useEffect(() => {
    const updateSavedItems = () => setSavedItemIds(getSavedItemIds());
    window.addEventListener("darbak:saved-items-updated", updateSavedItems);
    return () =>
      window.removeEventListener("darbak:saved-items-updated", updateSavedItems);
  }, []);

  useEffect(() => {
    if (!selectedOpportunity && !selectedGuideOrganization) return undefined;

    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "contain";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
    };
  }, [selectedOpportunity, selectedGuideOrganization]);

  const selectedSpecialtyOption = useMemo(
    () =>
      specializationOptions.find(
        (option) => option.value === selectedSpecialty
      ),
    [selectedSpecialty]
  );
  const selectedSpecialtyLabel =
    selectedSpecialtyOption?.label || selectedSpecialty;
  const suggestionRegion = resolveSuggestionRegion(city);
  const selectedCityScope = useMemo(() => getSelectedCityScope(city), [city]);
  const visibleTargets = useMemo(() => {
    if (selectedCityScope.length === 0) return targets;

    const allowedCities = new Set(selectedCityScope.map(normalizeName));
    return targets.filter((target) =>
      (target.cities || []).some((targetCity) =>
        allowedCities.has(normalizeName(targetCity))
      )
    );
  }, [selectedCityScope, targets]);
  const visibleTargetNames = useMemo(
    () =>
      new Set(
        visibleTargets.map((target) => normalizeName(target.organizationName))
      ),
    [visibleTargets]
  );
  const getRelatedTargetForOpportunity = (opportunity = {}) => {
    const normalizedOpportunityName = normalizeName(opportunity.organizationName);

    return visibleTargets.find((target) => {
      const normalizedTargetName = normalizeName(target.organizationName);
      return (
        normalizedOpportunityName &&
        normalizedTargetName &&
        (normalizedOpportunityName === normalizedTargetName ||
          normalizedOpportunityName.includes(normalizedTargetName) ||
          normalizedTargetName.includes(normalizedOpportunityName))
      );
    });
  };
  const hasTrainingTargets = visibleTargets.length > 0;
  const totalVisibleExperienceCount = useMemo(
    () =>
      visibleTargets.reduce(
        (total, target) => total + (Number(target.count) || 0),
        0
      ),
    [visibleTargets]
  );
  const visibleMethodLabels = useMemo(() => {
    const methods = new Set();
    visibleTargets.forEach((target) => {
      (target.methods || []).forEach((method) => {
        if (method) methods.add(method);
      });
    });
    return Array.from(methods).slice(0, 3);
  }, [visibleTargets]);
  const visibleFaqItems = faqExpanded
    ? trainingFinderFaqItems
    : trainingFinderFaqItems.slice(0, 3);
  const suggestedOrganizations = useMemo(() => {
    const guideOrganizations = guideDirectoryOrganizations
      .filter((organization) =>
        guideOrganizationMatchesLocation(
          organization,
          selectedCityScope,
          suggestionRegion,
          city
        )
      )
      .map((organization) => ({
        ...organization,
        sourceLabel: organization.sourceLabel || darbakGuideMeta.sourceLabel,
      }));
    const manualRegionOrganizations = suggestionRegion
      ? (suggestedOrganizationsByRegion[suggestionRegion] || []).map(
          (organization) => ({
            ...organization,
            sourceLabel: "اقتراح حسب المدينة",
            regions: [suggestionRegion],
            cities: selectedCityScope,
            applicationWindow: "حسب إعلان الجهة",
            specialties: [],
          })
        )
      : [];

    return dedupeOrganizations([
      ...guideOrganizations,
      ...manualRegionOrganizations,
    ]).filter(
      (organization) =>
      !visibleTargetNames.has(normalizeName(organization.name))
    );
  }, [city, selectedCityScope, suggestionRegion, visibleTargetNames]);
  const visibleOpportunities = useMemo(() => {
    const allowedCities =
      selectedCityScope.length > 0
        ? new Set(selectedCityScope.map(normalizeName))
        : null;
    const filteredOpportunities = opportunities.filter((opportunity) => {
      if (allowedCities) {
        const opportunityCities = getOpportunityCities(opportunity);
        const matchesSelectedCity = opportunityCities.some((opportunityCity) =>
          allowedCities.has(normalizeName(opportunityCity))
        );
        if (!matchesSelectedCity) return false;
      }

      const applicationState = getOpportunityApplicationState(
        opportunity.deadline,
        opportunity.status
      );
      const matchesStatus =
        !opportunityFilters.status ||
        (opportunityFilters.status === "open"
          ? applicationState.tone === "open"
          : applicationState.tone === "closed");
      const matchesReward =
        !opportunityFilters.reward ||
        opportunity.hasReward === opportunityFilters.reward;
      const matchesMode =
        !opportunityFilters.mode ||
        opportunity.trainingMode === opportunityFilters.mode;
      const matchesFreshness =
        opportunityFilters.freshness !== "recent" ||
        isOpportunityRecentlyAdded(opportunity);

      return (
        matchesStatus &&
        matchesReward &&
        matchesMode &&
        matchesFreshness
      );
    });

    if (opportunityFilters.freshness === "recent") {
      return [...filteredOpportunities].sort(
        (first, second) =>
          getOpportunityCreatedAtTimestamp(second) -
          getOpportunityCreatedAtTimestamp(first)
      );
    }

    return filteredOpportunities;
  }, [opportunities, opportunityFilters, selectedCityScope]);
  const hasActiveOpportunityFilters = Object.values(opportunityFilters).some(
    Boolean
  );
  const updateOpportunityFilter = (key, value) => {
    setOpportunityFilters((currentFilters) => ({
      ...currentFilters,
      [key]: currentFilters[key] === value ? "" : value,
    }));
    setActiveResultsTab("opportunities");
  };
  const resetOpportunityFilters = () => {
    setOpportunityFilters({
      status: "",
      reward: "",
      mode: "",
      freshness: "",
    });
    setActiveResultsTab("opportunities");
  };
  const showResultsPanel = opportunitiesLoading || opportunities.length > 0 || searched;
  const showSuggestionsWithOpportunities =
    Boolean(selectedSpecialty) && suggestedOrganizations.length > 0;
  const resultTabs = [
    {
      key: "opportunities",
      label: "فرص",
      count:
        visibleOpportunities.length +
        (showSuggestionsWithOpportunities ? suggestedOrganizations.length : 0),
    },
    ...(searched
      ? [
          { key: "targets", label: "تجارب دربك", count: visibleTargets.length },
          ...(showSuggestionsWithOpportunities
            ? []
            : [
                {
                  key: "suggestions",
                  label: "اقتراحات",
                  count: suggestedOrganizations.length,
                },
              ]),
        ]
      : []),
  ];

  useEffect(() => {
    if (showSuggestionsWithOpportunities && activeResultsTab === "suggestions") {
      setActiveResultsTab("opportunities");
    }
  }, [activeResultsTab, showSuggestionsWithOpportunities]);

  const searchInsightOrganizations = useMemo(() => {
    const organizationsMap = new Map();
    const mergeOrganization = (entity = {}) => {
      const name = (entity.name || entity.organizationName || "").trim();
      const key = normalizeName(name);
      if (!key) return;

      const current = organizationsMap.get(key) || { name };
      organizationsMap.set(key, {
        ...current,
        ...entity,
        name: current.name || name,
        organizationName: current.organizationName || entity.organizationName || name,
        specialties: Array.from(
          new Set([
            ...(current.specialties || []),
            ...(entity.specialties || []),
          ].filter(Boolean))
        ),
        majorCategories: Array.from(
          new Set([
            ...(current.majorCategories || []),
            ...(entity.majorCategories || []),
          ].filter(Boolean))
        ),
        majors: Array.from(
          new Set([
            ...(current.majors || []),
            ...(entity.majors || []),
          ].filter(Boolean))
        ),
        methods: Array.from(
          new Set([
            ...(current.methods || []),
            ...(entity.methods || []),
          ].filter(Boolean))
        ),
      });
    };

    visibleOpportunities.forEach((opportunity) =>
      mergeOrganization({
        ...opportunity,
        name: opportunity.organizationName,
      })
    );
    visibleTargets.forEach((target) =>
      mergeOrganization({
        ...target,
        name: target.organizationName,
      })
    );
    suggestedOrganizations.forEach((organization) =>
      mergeOrganization(organization)
    );

    return Array.from(organizationsMap.values());
  }, [suggestedOrganizations, visibleOpportunities, visibleTargets]);
  const searchInsightItems = useMemo(
    () => [
      {
        key: "government",
        label: "جهة حكومية",
        count: searchInsightOrganizations.filter(isGovernmentEntity).length,
      },
      {
        key: "technology",
        label: "شركة تقنية",
        count: searchInsightOrganizations.filter(isTechEntity).length,
      },
      {
        key: "consulting",
        label: "شركة استشارية",
        count: searchInsightOrganizations.filter(isConsultingEntity).length,
      },
      {
        key: "direct",
        label: "جهة تقبل بدون إعلان",
        count: searchInsightOrganizations.filter(acceptsWithoutAnnouncement)
          .length,
      },
    ],
    [searchInsightOrganizations]
  );
  const searchInsightLocationLabel = city || "كل المدن والمناطق";
  const searchInsightTotalOrganizations = searchInsightOrganizations.length;
  const visibleSearchInsightItems = searchInsightItems.filter(
    (item) => item.count > 0
  );
  const openSearchInsightSubscription = () => {
    setShowSearchInsightModal(false);
    requestPremiumAccess({
      feature: "where_to_train_search_apply",
      title: "ابدأ التقديم الآن",
      source: "where_to_train_search_insight",
      itemKey: `where-to-train:${normalizeName(selectedSpecialty)}:${normalizeName(
        city
      )}`,
    });
  };

  const fetchOpportunities = async (params = {}) => {
    try {
      setOpportunitiesLoading(true);
      const { data } = await axios.get(`${API_BASE_URL}/api/opportunities`, {
        params,
      });
      setOpportunities(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      console.error(err);
      setOpportunities([]);
    } finally {
      setOpportunitiesLoading(false);
    }
  };

  const getSpecialtyCategories = (specialtyValue) =>
    specializationOptions.find((option) => option.value === specialtyValue)
      ?.categories || [];

  const runTrainingTargetSearch = async (specialtyValue, cityValue = "") => {
    if (!specialtyValue) {
      setError("اختَر تخصصك أولًا.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSearched(true);

      const majorCategories = getSpecialtyCategories(specialtyValue);
      const queryParams = {
        major: specialtyValue,
        majorCategory: majorCategories[0] || "",
        majorCategories: majorCategories.join(","),
        city: cityValue,
      };
      const [targetsResponse, opportunitiesResponse] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/training-targets`, {
          params: queryParams,
        }),
        axios.get(`${API_BASE_URL}/api/opportunities`, {
          params: queryParams,
        }),
      ]);

      const nextTargets = Array.isArray(targetsResponse.data.data)
        ? targetsResponse.data.data
        : [];
      const nextOpportunities = Array.isArray(opportunitiesResponse.data.data)
        ? opportunitiesResponse.data.data
        : [];

      setTargets(nextTargets);
      setOpportunities(nextOpportunities);
      trackEvent("where_to_train_search", {
        major: specialtyValue,
        majorCategory: majorCategories[0] || "",
        city: cityValue,
        resultsCount: nextTargets.length,
        metadata: {
          majorCategories,
          opportunitiesCount: nextOpportunities.length,
          totalResults: nextTargets.length + nextOpportunities.length,
        },
      });
      setActiveResultsTab(
        nextOpportunities.length > 0
          ? "opportunities"
          : nextTargets.length > 0
          ? "targets"
          : "opportunities"
      );
      setShowSearchInsightModal(true);
    } catch (err) {
      console.error(err);
      setError("تعذر عرض النتائج حاليًا.");
      setTargets([]);
      setOpportunities([]);
      setShowSearchInsightModal(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPageSeo(
      buildTrainingFinderSeoMeta({
        city: routeCity,
        specialty: routeSpecialty,
        path: seoPath,
      })
    );
  }, [routeCity, routeSpecialty, seoPath]);

  useEffect(() => {
    if (routeOpportunityId) return;

    const nextMajor = routeSpecialty || querySpecialty;
    const nextCity = routeCity || queryCity;
    const hasKnownMajor = specializationOptions.some(
      (option) => option.value === nextMajor
    );

    if (!hasKnownMajor) {
      setSelectedSpecialty("");
      setCity(nextCity);
      setSearched(false);
      setTargets([]);
      fetchOpportunities(nextCity ? { city: nextCity } : {});
      return;
    }

    setSelectedSpecialty(nextMajor);
    setCity(nextCity);
    runTrainingTargetSearch(nextMajor, nextCity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryCity, querySpecialty, routeCity, routeOpportunityId, routeSpecialty]);

  useEffect(() => {
    if (!routeOpportunityId) {
      handledRouteOpportunityIdRef.current = "";
      setSelectedOpportunity(null);
      return undefined;
    }

    if (handledRouteOpportunityIdRef.current === routeOpportunityId) {
      return undefined;
    }

    handledRouteOpportunityIdRef.current = routeOpportunityId;
    let isActive = true;

    const openRouteOpportunity = () => {
      setError("");
      requestPremiumAccess(
        {
          feature: "opportunity_details",
          source: "opportunity_direct_link",
          itemKey: `opportunity:${routeOpportunityId}`,
          deferGateOnLimited: true,
          onLimited: () => {
            if (!isActive) return;
            setSelectedOpportunity({
              _id: routeOpportunityId,
              organizationName: "فرصة تدريب",
              title: "تفاصيل فرصة تدريب",
              note: LOCKED_OPPORTUNITY_PREVIEW,
              isPremiumPreviewLocked: true,
              isPremiumUpsellHidden: false,
            });
          },
        },
        async () => {
          try {
            if (isActive) setOpportunitiesLoading(true);
            const { data } = await axios.get(
              `${API_BASE_URL}/api/opportunities/${routeOpportunityId}`,
              {
                headers: getAccessHeaders({
                  itemKey: `opportunity:${routeOpportunityId}`,
                }),
              }
            );
            const opportunity = data?.data || data;

            if (!isActive || !opportunity?._id) return;

            setOpportunities([opportunity]);
            setTargets([]);
            setSearched(true);
            setActiveResultsTab("opportunities");

            setPageSeo({
              title: `${opportunity.title || "فرصة تدريب"} - ${
                opportunity.organizationName || "دربك"
              }`,
              description: `فرصة تدريب في ${
                opportunity.organizationName || "جهة تدريب"
              }${getOpportunityCityText(opportunity) ? ` - ${getOpportunityCityText(opportunity)}` : ""} على منصة دربك.`,
              path: buildOpportunityDetailPath(opportunity),
              keywords: [
                "فرصة تدريب",
                "تدريب تعاوني",
                opportunity.organizationName,
                getOpportunityCityText(opportunity),
                opportunity.title,
              ]
                .filter(Boolean)
                .join(", "),
            });

            trackEvent("opportunity_detail_viewed", {
              major: selectedSpecialty,
              city: getOpportunityCityText(opportunity) || city,
              metadata: {
                opportunityId: opportunity._id,
                opportunityTitle: opportunity.title,
                organizationName: opportunity.organizationName,
              },
            });
            markSavedItemSeen(
              `opportunity:${opportunity._id}`,
              getOpportunityUpdateTimestamp(opportunity)
            );
            setSelectedOpportunity(opportunity);
          } catch (err) {
            console.error(err);
            if (isActive) {
              setError("تعذر فتح رابط الفرصة. قد تكون غير منشورة أو غير متاحة.");
              setOpportunities([]);
            }
          } finally {
            if (isActive) setOpportunitiesLoading(false);
          }
        }
      );
    };

    openRouteOpportunity();

    return () => {
      isActive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeOpportunityId]);

  const fetchTrainingTargets = async (event) => {
    event.preventDefault();
    runTrainingTargetSearch(selectedSpecialty, city);
  };

  const openOpportunityRequestModal = () => {
    setOpportunityRequest({
      ...emptyOpportunityRequest,
      city,
      specialty: selectedSpecialty,
    });
    setOpportunityRequestMessage("");
    setShowOpportunityRequestModal(true);
    trackEvent("opportunity_submission_started", {
      major: selectedSpecialtyLabel,
      city,
      metadata: { source: "where_to_train" },
    });
  };

  const updateOpportunityRequestField = (field, value) => {
    setOpportunityRequest((current) => ({
      ...current,
      [field]: value,
    }));
    setOpportunityRequestMessage("");
  };

  const submitOpportunityRequest = async (event) => {
    event.preventDefault();

    if (
      !opportunityRequest.organizationName.trim() ||
      !opportunityRequest.title.trim()
    ) {
      setOpportunityRequestMessage("اسم الجهة وعنوان الفرصة مطلوبة.");
      return;
    }

    const selectedRequestSpecialty = specializationOptions.find(
      (option) => option.value === opportunityRequest.specialty
    );

    try {
      setSavingOpportunityRequest(true);
      setOpportunityRequestMessage("");
      await axios.post(`${API_BASE_URL}/api/opportunities`, {
        organizationName: opportunityRequest.organizationName,
        title: opportunityRequest.title,
        city: opportunityRequest.city,
        cities: opportunityRequest.city ? [opportunityRequest.city] : [],
        specialties: opportunityRequest.specialty
          ? [opportunityRequest.specialty]
          : [],
        majorCategories: selectedRequestSpecialty?.categories || [],
        applicationUrl: opportunityRequest.applicationUrl,
        sourceUrl: opportunityRequest.sourceUrl,
        deadline: opportunityRequest.deadline,
        applicationMethod: opportunityRequest.applicationMethod,
        note: opportunityRequest.note,
        submitterContact: opportunityRequest.submitterContact,
      });

      trackEvent("opportunity_submitted", {
        major: opportunityRequest.specialty,
        city: opportunityRequest.city,
        metadata: {
          organizationName: opportunityRequest.organizationName,
          hasApplicationUrl: Boolean(opportunityRequest.applicationUrl),
          hasSourceUrl: Boolean(opportunityRequest.sourceUrl),
        },
      });

      setOpportunityRequest(emptyOpportunityRequest);
      setOpportunityRequestMessage(
        "تم إرسال الفرصة للمراجعة. شكرًا لأنك تساعد طلاب بعدك."
      );
    } catch (err) {
      console.error(err);
      setOpportunityRequestMessage(
        err.response?.data?.error || "تعذر إرسال الفرصة حاليًا."
      );
    } finally {
      setSavingOpportunityRequest(false);
    }
  };

  const updateSavedState = (id, isSaved) => {
    setSavedItemIds((current) => {
      const next = new Set(current);
      if (isSaved) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleSaveTrainingItem = (event, item) => {
    event.stopPropagation();
    const isSaved = toggleSavedItem(item);
    updateSavedState(item.id, isSaved);
    trackEvent(isSaved ? "saved_item_added" : "saved_item_removed", {
      major: selectedSpecialty,
      city,
      metadata: {
        type: item.type,
        title: item.title,
        subtitle: item.subtitle,
        ...(item.analyticsMetadata || {}),
      },
    });
  };

  const closeOpportunityDetails = () => {
    setSelectedOpportunity(null);

    if (!routeOpportunityId) return;

    const returnPath =
      typeof location.state?.from === "string" &&
      !location.state.from.includes(`/where-to-train/opportunity/`)
        ? location.state.from
        : "/where-to-train";

    navigate(returnPath, { replace: true });
  };

  const openOpportunityDetails = (opportunity) => {
    const opportunityId = opportunity._id || opportunity.id || "";
    const opportunityPath = buildOpportunityDetailPath(opportunity);
    setSelectedOpportunity({
      ...opportunity,
      note: "جاري تحميل تفاصيل الفرصة...",
      isLoadingDetails: true,
    });

    requestPremiumAccess(
      {
        feature: "opportunity_details",
        title: opportunity.title || opportunity.organizationName || "",
        source: "where_to_train",
        itemKey: opportunityId ? `opportunity:${opportunityId}` : "",
        deferGateOnLimited: true,
        onLimited: () => {
          setSelectedOpportunity({
            ...opportunity,
            note: LOCKED_OPPORTUNITY_PREVIEW,
            applicationUrl: "",
            sourceUrl: "",
            isPremiumPreviewLocked: true,
            isPremiumUpsellHidden: false,
            premiumRequestedAction: "details",
          });
        },
      },
      async () => {
        try {
          const { data } = opportunityId
            ? await axios.get(`${API_BASE_URL}/api/opportunities/${opportunityId}`, {
                headers: getAccessHeaders({
                  itemKey: `opportunity:${opportunityId}`,
                }),
              })
            : { data: { data: opportunity } };
          const fullOpportunity = data?.data || data || opportunity;

          trackEvent("opportunity_details_clicked", {
            major: selectedSpecialty,
            city,
            metadata: {
              opportunityId,
              opportunityTitle: fullOpportunity.title,
              organizationName: fullOpportunity.organizationName,
            },
          });
          markSavedItemSeen(
            `opportunity:${opportunityId}`,
            getOpportunityUpdateTimestamp(fullOpportunity)
          );
          setSelectedOpportunity({
            ...fullOpportunity,
            isLoadingDetails: false,
          });

          if (opportunityId && location.pathname !== opportunityPath) {
            handledRouteOpportunityIdRef.current = opportunityId;
            navigate(opportunityPath, {
              state: { from: `${location.pathname}${location.search}` },
            });
          }
        } catch (err) {
          console.error(err);
          setSelectedOpportunity(null);
          setError("تعذر فتح تفاصيل الفرصة حاليًا.");
        }
      }
    );
  };

  const closeGuideOrganizationDetails = () => {
    setSelectedGuideOrganization(null);
  };

  const setGuideOrganizationLockedPreview = (organization) => {
    setSelectedGuideOrganization({
      ...organization,
      isPremiumPreviewLocked: true,
    });
  };

  const unlockGuideOrganizationDetails = (
    organization,
    { showGateOnLimited = false } = {}
  ) => {
    if (!organization) return;

    requestPremiumAccess(
      {
        feature: "training_guide_contact_details",
        title: organization.name || "جهة من دليل دربك",
        source: "where_to_train_guide",
        itemKey: organization.id ? `guide-organization:${organization.id}` : "",
        deferGateOnLimited: !showGateOnLimited,
        onLimited: () => setGuideOrganizationLockedPreview(organization),
      },
      () => {
        trackEvent("training_guide_suggestion_unlocked", {
          major: selectedSpecialty,
          city,
          metadata: {
            organizationId: organization.id || "",
            organizationName: organization.name || "",
            sourceLabel: organization.sourceLabel || "",
          },
        });
        setSelectedGuideOrganization({
          ...organization,
          isPremiumPreviewLocked: false,
        });
      }
    );
  };

  const openGuideOrganizationDetails = (organization) => {
    setGuideOrganizationLockedPreview(organization);
    trackEvent("training_guide_suggestion_details_clicked", {
      major: selectedSpecialty,
      city,
      metadata: {
        organizationId: organization.id || "",
        organizationName: organization.name || "",
        sourceLabel: organization.sourceLabel || "",
      },
    });
    unlockGuideOrganizationDetails(organization);
  };

  const openOpportunityApplication = (opportunity) => {
    const opportunityId = opportunity._id || opportunity.id || "";
    if (!opportunity.applicationUrl && !opportunity.hasApplicationUrl) return;

    requestPremiumAccess(
      {
        feature: "opportunity_apply",
        title: opportunity.title || opportunity.organizationName || "",
        source: "where_to_train",
        itemKey: opportunityId ? `opportunity:${opportunityId}` : "",
        deferGateOnLimited: true,
        onLimited: () => {
          setSelectedOpportunity({
            ...opportunity,
            note: LOCKED_OPPORTUNITY_PREVIEW,
            applicationUrl: "",
            sourceUrl: "",
            isPremiumPreviewLocked: true,
            isPremiumUpsellHidden: false,
            premiumRequestedAction: "apply",
          });
        },
      },
      async () => {
        try {
          const { data } = opportunityId
            ? await axios.get(`${API_BASE_URL}/api/opportunities/${opportunityId}`, {
                headers: getAccessHeaders({
                  itemKey: `opportunity:${opportunityId}`,
                }),
              })
            : { data: { data: opportunity } };
          const fullOpportunity = data?.data || data || opportunity;

          if (!fullOpportunity.applicationUrl) {
            setError("لا يوجد رابط تقديم مباشر لهذه الفرصة حاليًا.");
            return;
          }

          trackEvent("opportunity_apply_clicked", {
            major: selectedSpecialty,
            city,
            metadata: {
              opportunityId,
              opportunityTitle: fullOpportunity.title,
              organizationName: fullOpportunity.organizationName,
              applicationMethod: fullOpportunity.applicationMethod,
            },
          });
          window.location.assign(fullOpportunity.applicationUrl);
        } catch (err) {
          console.error(err);
          setError("تعذر فتح رابط التقديم حاليًا.");
        }
      }
    );
  };

  const getOpportunityPremiumLockedItems = (opportunity = {}) => {
    const organization = opportunity.organizationName || "جهة تدريب";
    const cityText = getOpportunityCityText(opportunity) || city || "مدينتك";
    const title = opportunity.title || "فرصة تدريب";

    return [
      `${title} في ${organization}`,
      `تجارب طلاب في ${organization}`,
      `فرص مناسبة في ${cityText}`,
      "طريقة التقديم وأسئلة مقابلات محتملة",
    ];
  };

  const openPremiumFromLockedOpportunity = (opportunity = {}) => {
    const opportunityId = opportunity._id || opportunity.id || "";
    requestPremiumAccess(
      {
        feature:
          opportunity.premiumRequestedAction === "apply"
            ? "opportunity_apply"
            : "opportunity_details",
        title: opportunity.title || opportunity.organizationName || "",
        source: "opportunity_inline_notice",
        itemKey: opportunityId ? `opportunity:${opportunityId}` : "",
      },
      () => {
        if (opportunity.premiumRequestedAction === "apply") {
          openOpportunityApplication(opportunity);
          return;
        }

        openOpportunityDetails(opportunity);
      }
    );
  };

  const skipOpportunityPremiumNotice = () => {
    setSelectedOpportunity((current) =>
      current ? { ...current, isPremiumUpsellHidden: true } : current
    );
  };

  const selectedOpportunityRelatedTarget = selectedOpportunity
    ? getRelatedTargetForOpportunity(selectedOpportunity)
    : null;
  const selectedOpportunityStatus = selectedOpportunity
    ? getOpportunityApplicationState(
        selectedOpportunity.deadline,
        selectedOpportunity.status
      )
    : null;
  const selectedOpportunityLogoUrl = selectedOpportunity
    ? selectedOpportunity.applicationUrl ||
      selectedOpportunity.sourceUrl ||
      resolveOrganizationHomepageUrl(selectedOpportunity.organizationName)
    : "";
  const selectedOpportunityChips = selectedOpportunity
    ? [
        ["trainingEnvironment", "البيئة", "👥"],
        ["trainingMode", "النوع", "💻"],
        ["hasReward", "المكافأة", "💰"],
        ["applicationMethod", "التقديم", "🔗"],
      ]
        .map(([field, label, icon]) => ({
          field,
          label,
          icon,
          value: getOpportunityDisplayLabel(field, selectedOpportunity[field]),
        }))
        .filter((chip) => chip.value)
    : [];
  const selectedGuideOrganizationLogoUrl = selectedGuideOrganization
    ? selectedGuideOrganization.url ||
      selectedGuideOrganization.sourceUrl ||
      resolveOrganizationHomepageUrl(selectedGuideOrganization.name)
    : "";
  const isSelectedGuideLocked =
    Boolean(selectedGuideOrganization) &&
    selectedGuideOrganization.isPremiumPreviewLocked !== false;
  const selectedGuideSpecialties = selectedGuideOrganization?.specialties || [];
  const selectedGuideEmails = isSelectedGuideLocked
    ? []
    : selectedGuideOrganization?.emails || [];

  const buildTrainingFinderSharePath = () => {
    const params = new URLSearchParams();
    if (selectedSpecialty) params.set("major", selectedSpecialty);
    if (city) params.set("city", city);
    const query = params.toString();
    return `/where-to-train${query ? `?${query}` : ""}`;
  };

  const getTrainingTargetSharePath = (organizationName = "") =>
    organizationName
      ? `/experiences?company=${encodeURIComponent(organizationName)}`
      : buildTrainingFinderSharePath();

  const trackTrainingShareAction = (action, itemType, metadata = {}) => {
    trackEvent("share_item_clicked", {
      major: selectedSpecialty,
      city,
      metadata: {
        action,
        itemType,
        selectedSpecialtyLabel,
        ...metadata,
      },
    });
  };

  const renderSuggestedOrganizationCard = (organization) => {
    const savedOrganizationId = `suggested-organization:${normalizeName(
      organization.name
    )}`;
    const organizationUrl = organization.url || organization.sourceUrl || "";
    const organizationResolvedUrl =
      organizationUrl || resolveOrganizationHomepageUrl(organization.name);
    const organizationImageUrl =
      organization.logoUrl ||
      getOrganizationLogoUrl(organizationResolvedUrl) ||
      getOrganizationLogoUrlFromDomain(
        getFirstEmailDomain(organization.emails || [])
      );
    const specialtyPreview = getGuideSpecialtyPreview(
      organization,
      selectedSpecialtyLabel
    );
    const locationText = getGuideOrganizationLocationText(organization);

    return (
      <article
        className="finder-result-card suggested-target-card"
        key={`${organization.name}-${organization.url || organization.id || ""}`}
        style={{
          background: "var(--app-surface)",
          border: "1px solid var(--app-border)",
          borderRadius: "15px",
          padding: "14px",
          display: "grid",
          gap: "10px",
          position: "relative",
        }}
      >
        <div className="card-quick-actions">
          <button
            type="button"
            className={`save-item-button ${
              savedItemIds.has(savedOrganizationId) ? "is-saved" : ""
            }`}
            onClick={(event) =>
              handleSaveTrainingItem(event, {
                id: savedOrganizationId,
                type: "suggested-organization",
                title: organization.name,
                subtitle: organization.sourceLabel || "اقتراح جهة",
                organizationName: organization.name,
                meta: selectedSpecialtyLabel || city || "",
                url: organizationUrl || buildTrainingFinderSharePath(),
              })
            }
            aria-label={
              savedItemIds.has(savedOrganizationId)
                ? "إزالة الجهة من المحفوظات"
                : "حفظ الجهة"
            }
            title={savedItemIds.has(savedOrganizationId) ? "محفوظة" : "حفظ الجهة"}
          >
            {savedItemIds.has(savedOrganizationId) ? "♥ محفوظة" : "♡ حفظ"}
          </button>
          <ShareButton
            buttonLabel="مشاركة صديق"
            title={`جهة مقترحة في دربك: ${organization.name}`}
            text={`شوف هذه الجهة المقترحة في دربك: ${organization.name}.`}
            url={buildTrainingFinderSharePath()}
            onShareAction={(action) =>
              trackTrainingShareAction(action, "suggested-organization", {
                organizationName: organization.name,
                sourceLabel: organization.sourceLabel || "",
              })
            }
          />
        </div>
        <div
          className="suggested-card-head"
          style={{
            display: "grid",
            gridTemplateColumns: "42px minmax(0, 1fr)",
            gap: "10px",
            alignItems: "start",
          }}
        >
          <OrganizationLogo
            name={organization.name}
            url={organizationResolvedUrl}
            imageUrl={organizationImageUrl}
          />
          <div>
            <div
              className="suggested-card-title-row"
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "8px",
                alignItems: "start",
                marginBottom: "5px",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  color: "var(--app-brand)",
                  fontSize: "17px",
                  lineHeight: 1.4,
                }}
              >
                {organization.name}
              </h3>
              <span className="suggested-organization-source">
                {organization.sourceLabel || "اقتراح"}
              </span>
            </div>
            <p
              style={{
                margin: 0,
                color: "var(--app-text-soft)",
                fontSize: "12px",
                lineHeight: 1.7,
              }}
            >
              {organization.sector || organization.note}
            </p>
          </div>
        </div>

        <div className="finder-card-info">
          <p
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "10px",
              margin: 0,
              color: "var(--app-text-soft)",
              fontSize: "12px",
              lineHeight: 1.6,
            }}
          >
            <span style={{ color: "var(--app-muted)" }}>المدينة</span>
            <strong
              style={{
                color: "var(--app-brand)",
                fontWeight: "800",
                textAlign: "left",
              }}
            >
              {locationText}
            </strong>
          </p>
          <p
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "10px",
              margin: 0,
              color: "var(--app-text-soft)",
              fontSize: "12px",
              lineHeight: 1.6,
            }}
          >
            <span style={{ color: "var(--app-muted)" }}>التخصصات</span>
            <strong
              style={{
                color: "var(--app-text)",
                fontWeight: "800",
                textAlign: "left",
                overflowWrap: "anywhere",
              }}
            >
              {specialtyPreview}
            </strong>
          </p>
          <p
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "10px",
              margin: 0,
              color: "var(--app-text-soft)",
              fontSize: "12px",
              lineHeight: 1.6,
            }}
          >
            <span style={{ color: "var(--app-muted)" }}>التقديم</span>
            <strong
              style={{
                color: "var(--app-text-soft)",
                fontWeight: "800",
                textAlign: "left",
              }}
            >
              {organization.applicationWindow || "حسب إعلان الجهة"}
            </strong>
          </p>
          <p
            style={{
              margin: 0,
              color: "var(--app-text-soft)",
              fontSize: "12px",
              lineHeight: 1.75,
            }}
          >
            {organization.note ||
              "تفاصيل التواصل وطريقة الاستخدام متاحة داخل التفاصيل."}
          </p>
        </div>
        <div className="finder-card-actions">
          <button
            type="button"
            className="opportunity-secondary-button"
            onClick={() => openGuideOrganizationDetails(organization)}
          >
            تفاصيل الجهة
          </button>
        </div>
      </article>
    );
  };

  const opportunityGuideBannerIndex =
    visibleOpportunities.length >= 7
      ? 5
      : visibleOpportunities.length >= 4
        ? 2
        : -1;

  const trackOpportunityGuideBannerClick = () => {
    trackEvent("training_guide_opportunities_banner_click", {
      major: selectedSpecialtyLabel,
      city,
      resultsCount: visibleOpportunities.length,
      metadata: {
        selectedSpecialty,
        source: "where_to_train_opportunities_grid",
      },
    });
  };

  const openOpportunityPremiumBanner = () => {
    trackEvent("premium_where_to_train_opportunities_banner_clicked", {
      major: selectedSpecialtyLabel,
      city,
      resultsCount: visibleOpportunities.length,
      metadata: {
        selectedSpecialty,
        source: "where_to_train_opportunities_banner",
      },
    });

    requestPremiumAccess({
      feature: "where_to_train_opportunities",
      title: "كمل استكشاف الفرص",
      source: "where_to_train_opportunities_banner",
      itemKey: `where-to-train-opportunities:${normalizeName(
        selectedSpecialty
      )}:${normalizeName(city)}`,
    });
  };

  const renderOpportunityGuideBanner = () => (
    <aside
      className="opportunity-guide-inline-banner"
      aria-label="دليل رحلة المتدرب"
      style={{
        gridColumn: "1 / -1",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        alignItems: "center",
        gap: "14px",
        border: "1px solid var(--app-brand-border)",
        borderRadius: "16px",
        background:
          "linear-gradient(135deg, var(--app-brand-soft), var(--app-surface) 65%, rgba(245,158,11,0.10))",
        padding: "14px 16px",
        boxShadow: "0 12px 28px var(--app-shadow)",
      }}
    >
      <div style={{ display: "grid", gap: "5px", minWidth: 0 }}>
        <strong
          style={{
            color: "var(--app-brand)",
            fontSize: "16px",
            lineHeight: 1.5,
          }}
        >
          ما لقيت فرصة مناسبة؟
        </strong>
        <span
          style={{
            color: "var(--app-text-soft)",
            fontSize: "13px",
            lineHeight: 1.8,
            fontWeight: "700",
          }}
        >
          جرّب دليل رحلة المتدرب للوصول إلى مئات الجهات وروابط التقديم.
        </span>
      </div>
      <a
        href={guideUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={trackOpportunityGuideBannerClick}
        style={{ textDecoration: "none" }}
      >
        <button
          type="button"
          style={{
            border: "none",
            borderRadius: "13px",
            background: "var(--app-brand)",
            color: "#07100e",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: "13px",
            fontWeight: "900",
            padding: "10px 14px",
            whiteSpace: "nowrap",
          }}
        >
          افتح دليل رحلة المتدرب
        </button>
      </a>
    </aside>
  );

  const renderOpportunityPremiumBanner = () => (
    <aside
      className="opportunity-plus-inline-banner"
      aria-label="إعلان دربك بلس للفرص"
      style={{ gridColumn: "1 / -1" }}
    >
      <div className="opportunity-plus-inline-copy">
        <span>دربك+</span>
        <strong>افتح تفاصيل الفرص المناسبة لك</strong>
        <p>
          وصول كامل لروابط التقديم، تفاصيل الفرصة، وحالة الجهات حسب تخصصك
          ومدينتك بدون تضييع وقت بين الإعلانات.
        </p>
      </div>
      <div className="opportunity-plus-inline-points" aria-label="مزايا فرص دربك بلس">
        <span>روابط تقديم مباشرة</span>
        <span>تفاصيل أوضح للفرص</span>
        <span>فرص وجهات مناسبة</span>
      </div>
      <button type="button" onClick={openOpportunityPremiumBanner}>
        كمل استكشاف الفرص
      </button>
    </aside>
  );

  return (
    <main
      style={{
        width: "100%",
        minHeight: "70vh",
        direction: "rtl",
        fontFamily: pageFont,
        color: "var(--app-text)",
      }}
    >
      <section
        style={{
          width: "min(100%, 980px)",
          margin: "0 auto",
          display: "grid",
          gap: "18px",
        }}
      >
        {renderOpportunityPremiumBanner()}

        <header style={{ textAlign: "center" }}>
          <p
            style={{
              margin: "0 0 8px",
              color: "var(--app-brand)",
              fontSize: "14px",
              fontWeight: "800",
            }}
          >
            بناءً على تجارب الطلاب السابقة
          </p>
          <h1
            style={{
              margin: 0,
              color: "var(--app-text)",
              fontSize: "clamp(28px, 4vw, 44px)",
              lineHeight: 1.35,
            }}
          >
            {routeSpecialty || routeCity
              ? `جهات تدريب ${routeSpecialty || "مناسبة"}${
                  routeCity ? ` في ${routeCity}` : ""
                }`
              : "وين أتدرب؟"}
          </h1>
          <p
            style={{
              margin: "12px auto 0",
              maxWidth: "650px",
              color: "var(--app-text-soft)",
              lineHeight: 1.8,
              fontSize: "15px",
            }}
          >
            {routeSpecialty || routeCity
              ? "شاهد الجهات والفرص والتجارب المقترحة بناءً على اختياراتك، ثم وسّع البحث أو غيّر المدينة والتخصص من الفلاتر."
              : "اختَر تخصصك والمدينة، وشاهد الجهات والفرص بطريقة مرتبة."}
          </p>
        </header>

        <form
          onSubmit={fetchTrainingTargets}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr) auto",
            gap: "10px",
            alignItems: "end",
            background: "var(--app-surface)",
            border: "1px solid var(--app-border)",
            borderRadius: "16px",
            padding: "14px",
          }}
          className="training-finder-form"
        >
          <label style={{ display: "grid", gap: "7px", color: "var(--app-text-soft)", fontSize: "13px" }}>
            التخصص
            <select
              value={selectedSpecialty}
              onChange={(event) => {
                setSelectedSpecialty(event.target.value);
                setShowSearchInsightModal(false);
              }}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "12px",
                border: "1px solid var(--app-border)",
                background: "var(--app-input-bg)",
                color: "var(--app-text)",
                fontFamily: "inherit",
              }}
            >
              <option value="">اختر تخصصك</option>
              {specializationOptions.map((specialization) => (
                <option key={specialization.value} value={specialization.value}>
                  {specialization.label}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: "7px", color: "var(--app-text-soft)", fontSize: "13px" }}>
            المدينة أو المنطقة
            <select
              value={city}
              onChange={(event) => {
                setCity(event.target.value);
                setShowSearchInsightModal(false);
              }}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "12px",
                border: "1px solid var(--app-border)",
                background: "var(--app-input-bg)",
                color: "var(--app-text)",
                fontFamily: "inherit",
              }}
            >
              <option value="">كل المدن والمناطق</option>
              <optgroup label="المناطق الرئيسية">
                {regionOptions.map((region) => (
                  <option key={region.value} value={region.value}>
                    {region.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>

          <button
            type="submit"
            disabled={loading}
            style={{
              background: "var(--app-brand)",
              color: "#07100e",
              border: "none",
              borderRadius: "12px",
              padding: "13px 20px",
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              fontWeight: "900",
              whiteSpace: "nowrap",
              boxShadow: "0 0 14px var(--app-brand-border)",
            }}
          >
            {loading ? "جاري البحث..." : "اعرض الجهات"}
          </button>
        </form>

        <div className="opportunity-filter-bar" aria-label="فلاتر الفرص">
          <div className="opportunity-filter-groups">
            {opportunityQuickFilters.map((filter) => (
              <button
                key={`${filter.key}-${filter.value}`}
                type="button"
                className={`opportunity-filter-chip${
                  opportunityFilters[filter.key] === filter.value
                    ? " is-active"
                    : ""
                }`}
                onClick={() => updateOpportunityFilter(filter.key, filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {hasActiveOpportunityFilters && (
            <button
              type="button"
              className="opportunity-filter-reset"
              onClick={resetOpportunityFilters}
            >
              مسح
            </button>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
            background: "var(--app-card)",
            border: "1px solid var(--app-border)",
            borderRadius: "14px",
            padding: "12px 14px",
            textAlign: "right",
          }}
        >
          <div style={{ display: "grid", gap: "3px", minWidth: 0 }}>
            <strong
              style={{
                color: "var(--app-text)",
                fontSize: "15px",
                lineHeight: 1.5,
              }}
            >
              تعرف فرصة تدريب؟ أرسلها لدربك
            </strong>
            <span
              style={{
                color: "var(--app-text-soft)",
                fontSize: "12.5px",
                lineHeight: 1.7,
              }}
            >
              تظهر للطلاب بعد مراجعتها والتأكد من تفاصيلها.
            </span>
          </div>
          <button
            type="button"
            onClick={openOpportunityRequestModal}
            style={{
              background: "var(--app-brand)",
              color: "#07100e",
              border: "none",
              borderRadius: "12px",
              padding: "10px 14px",
              cursor: "pointer",
              fontFamily: "inherit",
              fontWeight: "900",
              whiteSpace: "nowrap",
            }}
          >
            + أضف فرصة
          </button>
        </div>

        {error && (
          <p
            style={{
              margin: 0,
              color: "#fecdd3",
              textAlign: "center",
              background: "rgba(244,63,94,0.08)",
              border: "1px solid rgba(244,63,94,0.18)",
              borderRadius: "12px",
              padding: "10px",
            }}
          >
            {error}
          </p>
        )}

        {showResultsPanel && (
          <nav
            className="training-results-tabs"
            aria-label="تصنيف نتائج وين أتدرب"
          >
            {resultTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveResultsTab(tab.key)}
                className={`training-results-tab${
                  activeResultsTab === tab.key ? " is-active" : ""
                }`}
              >
                <span>{tab.label}</span>
                <strong>
                  {opportunitiesLoading && tab.key === "opportunities" ? (
                    "..."
                  ) : (
                    <AnimatedCount value={tab.count} suffix="+" />
                  )}
                </strong>
              </button>
            ))}
          </nav>
        )}

        {showResultsPanel && activeResultsTab === "opportunities" && (
          <section
            style={{
              display: "grid",
              gap: "12px",
              textAlign: "right",
            }}
          >
            {visibleOpportunities.length === 0 &&
            !showSuggestionsWithOpportunities &&
            !opportunitiesLoading ? (
              <p
                style={{
                  margin: 0,
                  color: "var(--app-text-soft)",
                  fontSize: "13px",
                  lineHeight: 1.8,
                  background: "var(--app-card)",
                  border: "1px solid var(--app-border)",
                  borderRadius: "12px",
                  padding: "12px",
                }}
              >
                لا توجد فرص معلنة مطابقة حاليًا.
                {hasActiveOpportunityFilters
                  ? " جرّب تخفيف الفلاتر أو اختيار مدينة أوسع."
                  : ""}
              </p>
            ) : (
              <>
              {visibleOpportunities.length > 0 && (
              <div
                className="finder-card-grid opportunities-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: "10px",
                }}
              >
                {visibleOpportunities.map((opportunity, index) => {
                  const applicationState = getOpportunityApplicationState(
                    opportunity.deadline,
                    opportunity.status
                  );
                  const opportunityLogoUrl =
                    opportunity.applicationUrl ||
                    opportunity.sourceUrl ||
                    resolveOrganizationHomepageUrl(opportunity.organizationName);
                  const savedOpportunityId = `opportunity:${opportunity._id}`;
                  const savedOpportunityUpdate = getSavedItemUpdateState(
                    savedOpportunityId,
                    getOpportunityUpdateTimestamp(opportunity)
                  );
                  const opportunityFreshnessLabel =
                    getOpportunityFreshnessLabel(opportunity);

                  return (
                    <React.Fragment
                      key={
                        opportunity._id ||
                        opportunity.id ||
                        `${opportunity.organizationName}-${index}`
                      }
                    >
                    <article
                      className="finder-result-card suggested-target-card opportunity-card"
                      onClick={() => openOpportunityDetails(opportunity)}
                      style={{
                        background: "var(--app-surface)",
                        border: "1px solid var(--app-border)",
                        borderRadius: "15px",
                        padding: "14px",
                        display: "grid",
                        gap: "10px",
                        position: "relative",
                        cursor: "pointer",
                      }}
                    >
                      <div className="card-quick-actions">
                        <button
                          type="button"
                          className={`save-item-button ${
                            savedItemIds.has(savedOpportunityId) ? "is-saved" : ""
                          }`}
                          onClick={(event) =>
                            handleSaveTrainingItem(event, {
                              id: savedOpportunityId,
                              type: "opportunity",
                              title: opportunity.title || "فرصة تدريب",
                              subtitle: opportunity.organizationName,
                              organizationName: opportunity.organizationName,
                              meta: getOpportunityCityText(opportunity) || city || "",
                              updatedAt: getOpportunityUpdateTimestamp(opportunity),
                              url: buildOpportunityDetailPath(opportunity),
                              analyticsMetadata: {
                                opportunityId: opportunity._id,
                                opportunityTitle: opportunity.title || "",
                                organizationName: opportunity.organizationName || "",
                              },
                            })
                          }
                          aria-label={
                            savedItemIds.has(savedOpportunityId)
                              ? "إزالة الفرصة من المحفوظات"
                              : "حفظ الفرصة"
                          }
                          title={
                            savedItemIds.has(savedOpportunityId)
                              ? "محفوظة"
                              : "حفظ الفرصة"
                          }
                        >
                          {savedItemIds.has(savedOpportunityId)
                            ? "♥ محفوظة"
                            : "♡ حفظ"}
                        </button>
                        <ShareButton
                          compact
                          buttonLabel="مشاركة صديق"
                          title={opportunity.title || "فرصة تدريب من دربك"}
                          text={`شوف هذه الفرصة في دربك: ${
                            opportunity.organizationName || opportunity.title || "فرصة تدريب"
                          }`}
                          url={buildOpportunityDetailPath(opportunity)}
                          onShareAction={(action) =>
                            trackTrainingShareAction(action, "opportunity", {
                              opportunityId: opportunity._id || "",
                              opportunityTitle: opportunity.title || "",
                              organizationName: opportunity.organizationName || "",
                            })
                          }
                        />
                      </div>
                      {(opportunityFreshnessLabel ||
                        savedOpportunityUpdate.hasUpdate) && (
                        <div className="card-timestamp-row">
                          {opportunityFreshnessLabel && (
                            <span className="card-time-label">
                              {opportunityFreshnessLabel}
                            </span>
                          )}
                          {savedOpportunityUpdate.hasUpdate && (
                            <span className="saved-update-badge">
                              تحديث محفوظ
                            </span>
                          )}
                        </div>
                      )}
                      <div
                        className="suggested-card-head opportunity-card-head"
                        style={{
                          display: "grid",
                          gridTemplateColumns: "42px minmax(0, 1fr)",
                          gap: "10px",
                          alignItems: "start",
                          minWidth: 0,
                        }}
                      >
                        <OrganizationLogo
                          name={opportunity.organizationName}
                          url={opportunityLogoUrl}
                          imageUrl={opportunity.logoUrl}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div
                            className="suggested-card-title-row"
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: "8px",
                              alignItems: "start",
                              marginBottom: "5px",
                            }}
                          >
                            <h3
                              className="opportunity-organization-name"
                              style={{
                                margin: 0,
                                color: "var(--app-brand)",
                                fontSize: "17px",
                                lineHeight: 1.4,
                                overflowWrap: "anywhere",
                              }}
                            >
                              {opportunity.organizationName}
                            </h3>
                            <div className="opportunity-card-badges">
                              <span
                                className={`opportunity-status ${applicationState.tone}`}
                              >
                                {applicationState.label}
                              </span>
                              {opportunity.featured && (
                                <span className="opportunity-featured-badge">
                                  مميزة
                                </span>
                              )}
                            </div>
                          </div>
                          <p
                            className="opportunity-card-title"
                            style={{
                              margin: 0,
                              color: "var(--app-text-soft)",
                              fontSize: "12.5px",
                              lineHeight: 1.6,
                              overflowWrap: "anywhere",
                            }}
                          >
                            {opportunity.title}
                            {getOpportunityCityText(opportunity)
                              ? ` - ${getOpportunityCityText(opportunity)}`
                              : ""}
                          </p>
                          {getOpportunityCityText(opportunity) && (
                            <p className="opportunity-card-city">
                              {getOpportunityCityText(opportunity)}
                            </p>
                          )}
                          {getOpportunityCardStats(opportunity).length > 0 && (
                            <div className="card-interaction-stats opportunity-interaction-count">
                              {getOpportunityCardStats(opportunity).map((stat) => (
                                <span className="card-interaction-stat" key={stat.key}>
                                  <span aria-hidden="true">{stat.icon}</span>
                                  <strong>{formatInteractionCount(stat.value)}</strong>
                                  <span>{stat.label}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="finder-card-info">
                        <p
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "10px",
                            margin: 0,
                            color: "var(--app-text-soft)",
                            fontSize: "12px",
                            lineHeight: 1.6,
                          }}
                        >
                          <span style={{ color: "var(--app-muted)" }}>مناسب لـ</span>
                          <strong
                            style={{
                              color: "var(--app-brand)",
                              fontWeight: "800",
                              textAlign: "left",
                            }}
                          >
                            {(opportunity.specialties || []).slice(0, 2).join("، ") ||
                              (opportunity.majorCategories || []).slice(0, 2).join("، ") ||
                              "جميع التخصصات"}
                          </strong>
                        </p>
                        <p
                          style={{
                            margin: 0,
                            color: "var(--app-text-soft)",
                            fontSize: "12px",
                            lineHeight: 1.75,
                          }}
                        >
                          {opportunity.deadline
                            ? `ينتهي: ${formatOpportunityDate(opportunity.deadline)}`
                            : "تحقق من شروط الجهة قبل التقديم."}
                        </p>
                      </div>

                      <div
                        className="finder-card-actions opportunity-actions"
                        style={{
                          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        }}
                      >
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openOpportunityDetails(opportunity);
                          }}
                          className="opportunity-secondary-button"
                        >
                          التفاصيل
                        </button>

                        {(opportunity.applicationUrl || opportunity.hasApplicationUrl) &&
                        applicationState.tone !== "closed" ? (
                          <button
                            type="button"
                            className="opportunity-apply-button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openOpportunityApplication(opportunity);
                            }}
                          >
                            تقديم الآن
                          </button>
                        ) : applicationState.tone === "closed" ? (
                          <button
                            type="button"
                            className="opportunity-apply-button is-disabled"
                            disabled
                          >
                            مغلق
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="opportunity-apply-button is-disabled"
                            disabled
                          >
                            لا يوجد رابط
                          </button>
                        )}
                      </div>
                    </article>
                    {index === opportunityGuideBannerIndex && (
                      renderOpportunityGuideBanner()
                    )}
                    </React.Fragment>
                  );
                })}
              </div>
              )}

              {showSuggestionsWithOpportunities && !opportunitiesLoading && (
                <section
                  className="opportunity-inline-suggestions"
                  style={{
                    display: "grid",
                    gap: "12px",
                    marginTop: visibleOpportunities.length > 0 ? "8px" : 0,
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto minmax(0, 1fr)",
                      gap: "10px",
                      alignItems: "start",
                      background: "var(--app-card)",
                      border: "1px solid var(--app-brand-border)",
                      borderRadius: "14px",
                      padding: "12px",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-grid",
                        placeItems: "center",
                        width: "32px",
                        height: "32px",
                        borderRadius: "999px",
                        background: "var(--app-brand-soft)",
                        border: "1px solid var(--app-brand-border)",
                        color: "var(--app-brand)",
                        fontSize: "14px",
                        fontWeight: "900",
                      }}
                    >
                      {suggestedOrganizations.length}
                    </span>
                    <div>
                      <h2
                        style={{
                          margin: 0,
                          color: "var(--app-text)",
                          fontSize: "18px",
                          lineHeight: 1.5,
                        }}
                      >
                        اقتراحات مناسبة لتخصصك
                      </h2>
                      <p
                        style={{
                          margin: "3px 0 0",
                          color: "var(--app-muted)",
                          fontSize: "12.5px",
                          lineHeight: 1.75,
                        }}
                      >
                        جهات من دليل دربك الشامل وملفات التواصل، تظهر هنا مع
                        الفرص كبداية بحث أوسع حسب تخصصك والمدينة المختارة.
                      </p>
                    </div>
                  </div>

                  <div
                    className="finder-card-grid suggested-targets-grid opportunity-suggestions-grid"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                      gap: "10px",
                    }}
                  >
                    {suggestedOrganizations.map(renderSuggestedOrganizationCard)}
                  </div>
                </section>
              )}
              </>
            )}
          </section>
        )}

        {searched && !loading && !error && activeResultsTab !== "opportunities" && (
          <section style={{ display: "grid", gap: "14px" }}>
            <section
              style={{
                display: "none",
                background:
                  "linear-gradient(135deg, var(--app-brand-soft), var(--app-surface))",
                border: "1px solid var(--app-brand-border)",
                borderRadius: "16px",
                padding: "14px",
                gap: "8px",
                textAlign: "right",
              }}
            >
              <strong
                style={{
                  color: "var(--app-brand)",
                  fontSize: "15px",
                  lineHeight: 1.6,
                }}
              >
                {hasTrainingTargets
                  ? `ملخص بحثك: ${visibleTargets.length} جهة من تجارب دربك`
                  : "ملخص بحثك: جهات مقترحة كبداية مناسبة"}
              </strong>
              <p
                style={{
                  margin: 0,
                  color: "var(--app-text-soft)",
                  fontSize: "13px",
                  lineHeight: 1.8,
                }}
              >
                {hasTrainingTargets
                  ? `ظهرت نتائج لتخصص ${selectedSpecialtyLabel}${
                      city ? ` في ${city}` : ""
                    } مبنية على ${totalVisibleExperienceCount} تجربة مشاركة. ${
                      visibleMethodLabels.length
                        ? `طرق التقديم المذكورة تشمل: ${visibleMethodLabels.join(
                            "، "
                          )}.`
                        : "اقرأ التجارب لمعرفة تفاصيل التقديم."
                    }`
                  : `لسه ما ظهرت تجارب مطابقة لهذا الاختيار داخل دربك، وهذا لا يقلل من تخصصك أو فرصه. نعرض لك اقتراحات تساعدك تبدأ البحث، ومع مشاركات الطلاب القادمة بتصير النتائج أدق.`}
              </p>
            </section>

            <section
              style={{
                display: activeResultsTab === "targets" ? "grid" : "none",
                gap: "14px",
                order: 1,
                paddingTop: 0,
                borderTop: "none",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto minmax(0, 1fr)",
                  gap: "12px",
                  alignItems: "start",
                  paddingTop: "4px",
                }}
              >
                <span
                  style={{
                    display: "inline-grid",
                    placeItems: "center",
                    width: "34px",
                    height: "34px",
                    borderRadius: "999px",
                    background:
                      !hasTrainingTargets
                        ? "var(--app-input-bg)"
                        : "var(--app-brand)",
                    border:
                      !hasTrainingTargets
                        ? "1px solid var(--app-brand-border)"
                        : "none",
                    color: !hasTrainingTargets ? "var(--app-brand)" : "#07100e",
                    fontSize: "16px",
                    fontWeight: "900",
                    boxShadow:
                      !hasTrainingTargets
                        ? "none"
                        : "0 0 16px var(--app-brand-border)",
                  }}
                >
                  {visibleTargets.length}
                </span>
                <div>
                  <h2
                    style={{
                      margin: 0,
                      color: "var(--app-text)",
                      fontSize: "20px",
                      lineHeight: 1.5,
                    }}
                  >
                    جهات ظهرت في تجارب دربك
                  </h2>
                  <p
                    style={{
                      margin: "4px 0 0",
                      color: "var(--app-muted)",
                      fontSize: "13px",
                      lineHeight: 1.8,
                    }}
                  >
                    جهات لها تجارب طلابية داخل دربك.
                  </p>
                </div>
              </div>

              {!hasTrainingTargets ? (
                <div
                  style={{
                    background: "var(--app-surface)",
                    border: "1px solid var(--app-border)",
                    borderRadius: "16px",
                    padding: "18px",
                    textAlign: "center",
                    color: "var(--app-text-soft)",
                    lineHeight: 1.8,
                  }}
                >
                  لا توجد تجارب مطابقة لهذا الاختيار حتى الآن.
                </div>
              ) : (
                <div
                  className="finder-card-grid training-targets-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: "10px",
                  }}
                >
                  {visibleTargets.map((target) => {
                    const organizationHomepageUrl = resolveOrganizationHomepageUrl(
                      target.organizationName
                    );
                    const savedTargetId = `training-target:${normalizeName(
                      target.organizationName
                    )}`;

                    return (
                      <article
                        className="finder-result-card suggested-target-card training-target-card"
                        key={target.organizationName}
                        style={{
                          background: "var(--app-surface)",
                          border: "1px solid var(--app-border)",
                          borderRadius: "15px",
                          padding: "14px",
                          display: "grid",
                          gap: "10px",
                          position: "relative",
                        }}
                      >
                        <div className="card-quick-actions">
                          <button
                            type="button"
                            className={`save-item-button ${
                              savedItemIds.has(savedTargetId) ? "is-saved" : ""
                            }`}
                            onClick={(event) =>
                              handleSaveTrainingItem(event, {
                                id: savedTargetId,
                                type: "training-target",
                                title: target.organizationName,
                                subtitle: "جهة من تجارب دربك",
                                organizationName: target.organizationName,
                                meta: target.cities?.join("، ") || "",
                                url: `/experiences?company=${encodeURIComponent(
                                  target.organizationName
                                )}`,
                              })
                            }
                            aria-label={
                              savedItemIds.has(savedTargetId)
                                ? "إزالة الجهة من المحفوظات"
                                : "حفظ الجهة"
                            }
                            title={
                              savedItemIds.has(savedTargetId)
                                ? "محفوظة"
                                : "حفظ الجهة"
                            }
                          >
                            {savedItemIds.has(savedTargetId)
                              ? "♥ محفوظة"
                              : "♡ حفظ"}
                          </button>
                          <ShareButton
                            buttonLabel="مشاركة صديق"
                            title={`تجارب التدريب في ${target.organizationName}`}
                            text={`شوف تجارب الطلاب في ${target.organizationName} على دربك.`}
                            url={getTrainingTargetSharePath(target.organizationName)}
                            onShareAction={(action) =>
                              trackTrainingShareAction(action, "training-target", {
                                organizationName: target.organizationName,
                                experienceCount: target.count || 0,
                              })
                            }
                          />
                        </div>
                        <div
                          className="suggested-card-head"
                          style={{
                            display: "grid",
                            gridTemplateColumns: "42px minmax(0, 1fr)",
                            gap: "10px",
                            alignItems: "start",
                          }}
                        >
                          <OrganizationLogo
                            name={target.organizationName}
                            url={organizationHomepageUrl}
                          />
                          <div style={{ minWidth: 0 }}>
                          <div
                            className="suggested-card-title-row"
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: "8px",
                              alignItems: "start",
                              marginBottom: "5px",
                            }}
                          >
                            <h3
                              className="training-target-title"
                              style={{
                                margin: 0,
                                color: "var(--app-brand)",
                                fontSize: "17px",
                                lineHeight: 1.4,
                                overflowWrap: "anywhere",
                              }}
                            >
                              {target.organizationName}
                            </h3>
                            <span className="suggested-organization-source">
                              {target.count || 1} تجربة
                            </span>
                          </div>
                          <p
                            style={{
                              margin: 0,
                              color: "var(--app-text-soft)",
                              fontSize: "13px",
                            }}
                          >
                            {target.cities?.join("، ") || "مدينة غير محددة"}
                          </p>
                          </div>
                        </div>

                        <div
                          className="finder-card-info training-target-detail"
                          style={{
                            background: "var(--app-card)",
                            border: "1px solid var(--app-border)",
                            borderRadius: "12px",
                            padding: "11px",
                          }}
                        >
                          <p style={{ margin: "0 0 7px", color: "var(--app-brand)", fontWeight: "800", fontSize: "13px" }}>
                            سبق أن تدرب فيها طلاب من:
                          </p>
                          <p style={{ margin: 0, color: "var(--app-text-soft)", fontSize: "13px", lineHeight: 1.7 }}>
                            {target.majors?.length ? target.majors.join("، ") : "تخصصات غير محددة"}
                          </p>
                          <p style={{ margin: "0 0 8px", color: "var(--app-brand)", fontWeight: "800", fontSize: "13px" }}>
                            طرق الحصول على الفرصة المذكورة:
                          </p>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
                            {(target.methods?.length ? target.methods : ["غير محدد"]).map((method) => (
                              <span
                                key={method}
                                style={{
                                  background: "var(--app-brand-soft)",
                                  border: "1px solid var(--app-brand-border)",
                                  color: "var(--app-text-soft)",
                                  borderRadius: "999px",
                                  padding: "6px 9px",
                                  fontSize: "12px",
                                }}
                              >
                                {method}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div
                          className="finder-card-actions training-target-actions"
                          style={{
                            display: "grid",
                            gap: "7px",
                            gridTemplateColumns: organizationHomepageUrl
                              ? "repeat(2, minmax(0, 1fr))"
                              : "1fr",
                          }}
                        >
                          <Link
                            to={{
                              pathname: "/experiences",
                              search: `?company=${encodeURIComponent(
                                target.organizationName
                              )}`,
                            }}
                            style={{ textDecoration: "none" }}
                          >
                            <button
                              type="button"
                              className="opportunity-apply-button"
                              style={{
                                width: "100%",
                              }}
                            >
                              قراءة التجارب
                            </button>
                          </Link>
                          {organizationHomepageUrl && (
                            <a
                              href={organizationHomepageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ textDecoration: "none" }}
                            >
                              <button
                                type="button"
                                className="opportunity-secondary-button"
                                style={{
                                  width: "100%",
                                }}
                              >
                                زيارة صفحة الجهة
                              </button>
                            </a>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {hasTrainingTargets && (
                <p
                  style={{
                    margin: "6px 0 0",
                    color: "var(--app-muted)",
                    fontSize: "13px",
                    lineHeight: 1.8,
                    textAlign: "center",
                  }}
                >
                  الجهات المعروضة مبنية على تجارب طلاب سابقة، ولا يعني ظهور
                  الجهة توفر فرصة تدريب حاليًا.
                </p>
              )}

              {false && hasTrainingTargets && suggestedOrganizations.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                    flexWrap: "wrap",
                    background:
                      "linear-gradient(90deg, var(--app-brand-soft), transparent)",
                    border: "1px solid var(--app-brand-border)",
                    borderRadius: "14px",
                    padding: "11px 13px",
                    color: "var(--app-text-soft)",
                    fontSize: "13px",
                    lineHeight: 1.8,
                  }}
                >
                  <strong style={{ color: "var(--app-brand)", fontSize: "14px" }}>
                    اقتراحات إضافية تحت النتائج
                  </strong>
                  <span>
                    إذا كانت جهات دربك كثيرة، كمل للأسفل بتلقى جهات مقترحة حسب
                    تخصصك والمدينة المختارة.
                  </span>
                </div>
              )}
            </section>

            <section
              style={{
                display: activeResultsTab === "suggestions" ? "grid" : "none",
                gap: "14px",
                order: 1,
                marginTop: 0,
                paddingTop: 0,
                borderTop: "none",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto minmax(0, 1fr)",
                  gap: "12px",
                  alignItems: "start",
                }}
              >
                <span
                  style={{
                    display: "inline-grid",
                    placeItems: "center",
                    width: "34px",
                    height: "34px",
                    borderRadius: "999px",
                    background:
                      !hasTrainingTargets
                        ? "var(--app-brand)"
                        : "var(--app-input-bg)",
                    border:
                      !hasTrainingTargets
                        ? "none"
                        : "1px solid var(--app-brand-border)",
                    color: !hasTrainingTargets ? "#07100e" : "var(--app-brand)",
                    fontSize: "16px",
                    fontWeight: "900",
                    boxShadow:
                      !hasTrainingTargets
                        ? "0 0 16px var(--app-brand-border)"
                        : "none",
                  }}
                >
                  {suggestedOrganizations.length}
                </span>
                <div>
                  <h2
                    style={{
                      margin: "0 0 5px",
                      color: "var(--app-text)",
                      fontSize: "20px",
                      lineHeight: 1.5,
                    }}
                  >
                    جهات مقترحة للتقديم
                  </h2>
                  <p
                    style={{
                      margin: 0,
                      color: "var(--app-muted)",
                      fontSize: "13px",
                      lineHeight: 1.8,
                    }}
                  >
                    جهات من دليل دربك الشامل حسب المدينة أو المنطقة، مع{" "}
                    {guideDirectoryEmailCount} إيميل مستخرج
                    وقنوات تواصل تظهر تفاصيلها لمشتركي دربك+.
                  </p>
                </div>
              </div>

              {suggestedOrganizations.length === 0 ? (
                <div
                  style={{
                    background: "var(--app-surface)",
                    border: "1px solid var(--app-border)",
                    borderRadius: "16px",
                    padding: "16px",
                    color: "var(--app-text-soft)",
                    lineHeight: 1.8,
                  }}
                >
                  كل الجهات المقترحة حاليًا ظهرت ضمن نتائج تجارب دربك، جرّب
                  البحث بتخصص أو مدينة أخرى.
                </div>
              ) : (
                <div
                  className="finder-card-grid suggested-targets-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: "10px",
                  }}
                >
                  {suggestedOrganizations.map(renderSuggestedOrganizationCard)}
                </div>
              )}
            </section>
          </section>
        )}

        {SHOW_TRAINING_FINDER_FAQ && (
        <section
          aria-label="أسئلة شائعة عن وين أتدرب"
          style={{
            background: "var(--app-surface)",
            border: "1px solid var(--app-border)",
            borderRadius: "16px",
            padding: "16px",
            display: "grid",
            gap: "12px",
            textAlign: "right",
          }}
        >
          <div>
            <h2
              style={{
                margin: "0 0 6px",
                color: "var(--app-text)",
                fontSize: "20px",
                lineHeight: 1.5,
              }}
            >
              أسئلة شائعة
            </h2>
            <p
              style={{
                margin: 0,
                color: "var(--app-muted)",
                fontSize: "13px",
                lineHeight: 1.8,
              }}
            >
              إجابات مختصرة تساعدك تستخدم الصفحة بدون ما تربط ظهور الجهة بتوفر
              فرصة تدريب حاليًا.
            </p>
          </div>

          <div style={{ display: "grid", gap: "8px" }}>
            {visibleFaqItems.map((item) => (
              <details
                key={item.question}
                style={{
                  background: "var(--app-card)",
                  border: "1px solid var(--app-border)",
                  borderRadius: "12px",
                  padding: "10px 12px",
                  color: "var(--app-text-soft)",
                }}
              >
                <summary
                  style={{
                    cursor: "pointer",
                    color: "var(--app-brand)",
                    fontWeight: "900",
                    fontSize: "13px",
                    lineHeight: 1.7,
                  }}
                >
                  {item.question}
                </summary>
                <p
                  style={{
                    margin: "8px 0 0",
                    color: "var(--app-text-soft)",
                    fontSize: "13px",
                    lineHeight: 1.85,
                  }}
                >
                  {item.answer}
                </p>
              </details>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setFaqExpanded((expanded) => !expanded)}
            style={{
              justifySelf: "center",
              background: "var(--app-input-bg)",
              color: "var(--app-brand)",
              border: "1px solid var(--app-brand-border)",
              borderRadius: "999px",
              padding: "8px 14px",
              fontFamily: "inherit",
              fontWeight: "900",
              cursor: "pointer",
            }}
          >
            {faqExpanded ? "عرض أقل" : "اقرأ المزيد"}
          </button>
        </section>
        )}
      </section>

      {showSearchInsightModal && selectedSpecialty && searched && !loading && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="ملخص نتائج وين أتدرب"
          className="search-insight-overlay"
          onClick={() => setShowSearchInsightModal(false)}
        >
          <div
            className="search-insight-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="search-insight-close"
              aria-label="إغلاق ملخص النتائج"
              onClick={() => setShowSearchInsightModal(false)}
            >
              ×
            </button>
            <p className="search-insight-eyebrow">حسب نتائج بحثك</p>
            <h2>
              حصلنا لك{" "}
              <span>{searchInsightTotalOrganizations}</span>
              {" "}جهة في {searchInsightLocationLabel}
            </h2>
            <p className="search-insight-subtitle">
              اختصر عليك أسابيع بحث... وقدّم اليوم على الجهات الأقرب لاختيارك.
            </p>

            <div className="search-insight-list">
              {(visibleSearchInsightItems.length
                ? visibleSearchInsightItems
                : searchInsightItems
              ).map((item) => (
                <div className="search-insight-item" key={item.key}>
                  <span aria-hidden="true">✔</span>
                  <strong>{item.count}</strong>
                  <p>{item.label}</p>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="search-insight-action"
              onClick={openSearchInsightSubscription}
            >
              ابدأ التقديم الآن
            </button>
          </div>
        </div>
      )}

      {selectedGuideOrganization && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`تفاصيل ${selectedGuideOrganization.name || "جهة من دليل دربك"}`}
          onClick={closeGuideOrganizationDetails}
          className="opportunity-detail-overlay"
        >
          <div
            className="opportunity-detail-modal guide-organization-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="opportunity-detail-head">
              <OrganizationLogo
                name={selectedGuideOrganization.name}
                url={selectedGuideOrganizationLogoUrl}
                imageUrl={selectedGuideOrganization.logoUrl}
              />
              <div>
                <p className="opportunity-detail-eyebrow">
                  {selectedGuideOrganization.sourceLabel ||
                    darbakGuideMeta.sourceLabel}
                </p>
                <h2>{selectedGuideOrganization.name}</h2>
                <p>
                  {selectedGuideOrganization.sector || "جهة تدريبية"}
                  {" - "}
                  {getGuideOrganizationLocationText(selectedGuideOrganization)}
                </p>
              </div>
              <button
                type="button"
                onClick={closeGuideOrganizationDetails}
                aria-label="إغلاق تفاصيل الجهة"
                className="opportunity-detail-close"
              >
                ×
              </button>
            </div>

            <div className="opportunity-detail-meta">
              <span className="detail-time-chip">
                متى يفتح:{" "}
                {selectedGuideOrganization.applicationWindow || "حسب إعلان الجهة"}
              </span>
              {selectedGuideOrganization.confidence && (
                <span className="opportunity-status open">
                  الموثوقية: {selectedGuideOrganization.confidence}
                </span>
              )}
              {selectedGuideOrganization.lastVerified && (
                <span className="opportunity-deadline">
                  آخر تحقق: {selectedGuideOrganization.lastVerified}
                </span>
              )}
            </div>

            {selectedGuideSpecialties.length > 0 && (
              <div className="guide-specialties-block">
                <strong>التخصصات المناسبة</strong>
                <div className="guide-specialties-list">
                  {selectedGuideSpecialties.map((specialty) => (
                    <span key={`${selectedGuideOrganization.id}-${specialty}`}>
                      {specialty}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <p className="opportunity-detail-note guide-organization-note">
              {selectedGuideOrganization.note ||
                "هذه الجهة مضافة كاقتراح من دليل دربك الشامل، وتحتاج مراجعة المصدر الرسمي قبل التقديم."}
            </p>

            {isSelectedGuideLocked && (
              <PremiumInlineNotice
                lockedItems={[
                  "إيميلات وقنوات التواصل",
                  "طريقة الاستخدام المقترحة",
                  "رابط المصدر الرسمي",
                ]}
                onUnlock={() =>
                  unlockGuideOrganizationDetails(selectedGuideOrganization, {
                    showGateOnLimited: true,
                  })
                }
                onSkip={closeGuideOrganizationDetails}
              />
            )}

            <div className="premium-preview-blur-wrap">
              <div
                className={`guide-contact-grid${
                  isSelectedGuideLocked ? " is-premium-preview-blurred" : ""
                }`}
              >
                <div>
                  <span>قناة التواصل</span>
                  <strong>
                    {isSelectedGuideLocked
                      ? "متاحة لمشتركي دربك+"
                      : selectedGuideOrganization.contactType || "حسب المصدر"}
                  </strong>
                </div>
                <div>
                  <span>الإيميل</span>
                  <strong>
                    {selectedGuideEmails.length > 0
                      ? selectedGuideEmails.join("، ")
                      : isSelectedGuideLocked
                      ? "مقفلة"
                      : "غير منشور"}
                  </strong>
                </div>
                <div>
                  <span>طريقة الاستخدام</span>
                  <strong>
                    {isSelectedGuideLocked
                      ? "تظهر بعد تفعيل دربك+"
                      : selectedGuideOrganization.usage ||
                        "راجع صفحة الجهة الرسمية."}
                  </strong>
                </div>
                <div>
                  <span>المصدر</span>
                  <strong>
                    {isSelectedGuideLocked
                      ? "رابط المصدر مقفل"
                      : selectedGuideOrganization.sourceUrl ||
                        selectedGuideOrganization.url ||
                        "غير متاح"}
                  </strong>
                </div>
              </div>
              {isSelectedGuideLocked && (
                <span className="premium-preview-blur-label">
                  فعّل دربك+ لرؤية معلومات التواصل كاملة
                </span>
              )}
            </div>

            <p className="guide-source-line">ملخص من دليل دربك الشامل</p>

            <div className="opportunity-detail-actions">
              <button
                type="button"
                onClick={closeGuideOrganizationDetails}
                className="opportunity-secondary-button"
              >
                إغلاق
              </button>
              {isSelectedGuideLocked ? (
                <button
                  type="button"
                  className="opportunity-apply-button"
                  onClick={() =>
                    unlockGuideOrganizationDetails(selectedGuideOrganization, {
                      showGateOnLimited: true,
                    })
                  }
                >
                  فتح معلومات التواصل
                </button>
              ) : selectedGuideOrganization.url ||
                selectedGuideOrganization.sourceUrl ? (
                <a
                  href={
                    selectedGuideOrganization.url ||
                    selectedGuideOrganization.sourceUrl
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: "none" }}
                >
                  <button type="button" className="opportunity-apply-button">
                    زيارة صفحة الجهة
                  </button>
                </a>
              ) : (
                <button
                  type="button"
                  className="opportunity-apply-button is-disabled"
                  disabled
                >
                  لا يوجد رابط
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedOpportunity && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`تفاصيل ${selectedOpportunity.organizationName || "فرصة تدريب"}`}
          onClick={closeOpportunityDetails}
          className="opportunity-detail-overlay"
        >
          <div
            className="opportunity-detail-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="opportunity-detail-head">
              <OrganizationLogo
                name={selectedOpportunity.organizationName}
                url={selectedOpportunityLogoUrl}
                imageUrl={selectedOpportunity.logoUrl}
              />
              <div>
                <p className="opportunity-detail-eyebrow">تفاصيل الفرصة</p>
                <h2>{selectedOpportunity.organizationName}</h2>
                <p>
                  {selectedOpportunity.title}
                  {getOpportunityCityText(selectedOpportunity)
                    ? ` - ${getOpportunityCityText(selectedOpportunity)}`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={closeOpportunityDetails}
                aria-label="إغلاق تفاصيل الفرصة"
                className="opportunity-detail-close"
              >
                ×
              </button>
            </div>

            <div className="opportunity-detail-meta">
              {getOpportunityFreshnessLabel(selectedOpportunity) && (
                <span className="detail-time-chip">
                  {getOpportunityFreshnessLabel(selectedOpportunity)}
                </span>
              )}
              {selectedOpportunityStatus && (
                <span className={`opportunity-status ${selectedOpportunityStatus.tone}`}>
                  {selectedOpportunityStatus.label}
                </span>
              )}
              {selectedOpportunity.featured && (
                <span className="opportunity-featured-badge">مميزة</span>
              )}
              {selectedOpportunity.deadline && (
                <span className="opportunity-deadline">
                  ينتهي: {formatOpportunityDate(selectedOpportunity.deadline)}
                </span>
              )}
            </div>

            {selectedOpportunityChips.length > 0 && (
              <div className="opportunity-chip-grid opportunity-detail-chips">
                {selectedOpportunityChips.map((chip) => (
                  <span
                    className="opportunity-chip"
                    key={`selected-${selectedOpportunity._id}-${chip.field}`}
                    title={`${chip.label}: ${chip.value}`}
                  >
                    <span aria-hidden="true">{chip.icon}</span>
                    <span>
                      {chip.label}: {chip.value}
                    </span>
                  </span>
                ))}
              </div>
            )}

            {selectedOpportunity.isPremiumPreviewLocked &&
              !selectedOpportunity.isPremiumUpsellHidden && (
                <PremiumInlineNotice
                  lockedItems={getOpportunityPremiumLockedItems(selectedOpportunity)}
                  onUnlock={() =>
                    openPremiumFromLockedOpportunity(selectedOpportunity)
                  }
                  onSkip={skipOpportunityPremiumNotice}
                />
              )}

            <div className="premium-preview-blur-wrap">
              <p
                className={`opportunity-detail-note${
                  selectedOpportunity.isPremiumPreviewLocked
                    ? " is-premium-preview-blurred"
                    : ""
                }`}
              >
                {selectedOpportunity.note ||
                  "يتم عرض الفرص حسب المعلومات المتاحة وقت الإضافة، ويرجى التحقق من شروط الجهة قبل التقديم."}
              </p>
              {selectedOpportunity.isPremiumPreviewLocked && (
                <span className="premium-preview-blur-label">
                  التفاصيل الكاملة متاحة عبر دربك+
                </span>
              )}
            </div>

            <div className="opportunity-detail-links">
              {selectedOpportunity.sourceUrl && (
                <a
                  href={selectedOpportunity.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  عرض مصدر الفرصة
                </a>
              )}

              {selectedOpportunityRelatedTarget && (
                <Link
                  to={{
                    pathname: "/experiences",
                    search: `?company=${encodeURIComponent(
                      selectedOpportunityRelatedTarget.organizationName
                    )}`,
                  }}
                  onClick={() => setSelectedOpportunity(null)}
                >
                  عرض تجارب الجهة
                </Link>
              )}
            </div>

            <div className="opportunity-detail-actions">
              <button
                type="button"
                onClick={closeOpportunityDetails}
                className="opportunity-secondary-button"
              >
                إغلاق
              </button>
              {selectedOpportunity.applicationUrl &&
              selectedOpportunityStatus?.tone !== "closed" ? (
                <button
                  type="button"
                  className="opportunity-apply-button"
                  onClick={() => openOpportunityApplication(selectedOpportunity)}
                >
                  تقديم الآن
                </button>
              ) : selectedOpportunityStatus?.tone === "closed" ? (
                <button
                  type="button"
                  className="opportunity-apply-button is-disabled"
                  disabled
                >
                  مغلق
                </button>
              ) : (
                <button
                  type="button"
                  className="opportunity-apply-button is-disabled"
                  disabled
                >
                  لا يوجد رابط تقديم
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showOpportunityRequestModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="إضافة فرصة تدريب"
          onClick={() => setShowOpportunityRequestModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 3200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            background: "var(--app-overlay)",
            backdropFilter: "blur(8px)",
          }}
        >
          <form
            onSubmit={submitOpportunityRequest}
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(620px, 100%)",
              maxHeight: "88vh",
              overflowY: "auto",
              display: "grid",
              gap: "12px",
              background: "var(--app-surface)",
              border: "1px solid var(--app-border)",
              borderRadius: "20px",
              padding: "18px",
              boxShadow: "0 24px 70px var(--app-shadow)",
              textAlign: "right",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
                alignItems: "start",
              }}
            >
              <div>
                <p
                  style={{
                    margin: "0 0 6px",
                    color: "var(--app-brand)",
                    fontWeight: "900",
                    fontSize: "13px",
                  }}
                >
                  فرصة للمراجعة
                </p>
                <h2
                  style={{
                    margin: 0,
                    color: "var(--app-text)",
                    fontSize: "22px",
                    lineHeight: 1.4,
                  }}
                >
                  أرسل فرصة تدريب للطلاب
                </h2>
                <p
                  style={{
                    margin: "7px 0 0",
                    color: "var(--app-text-soft)",
                    fontSize: "13px",
                    lineHeight: 1.8,
                  }}
                >
                  نحفظها كطلب مراجعة، وبعد اعتمادها تظهر في صفحة وين أتدرب.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowOpportunityRequestModal(false)}
                aria-label="إغلاق"
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "50%",
                  border: "1px solid var(--app-border)",
                  background: "var(--app-card)",
                  color: "var(--app-text)",
                  cursor: "pointer",
                  fontSize: "20px",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            <div className="opportunity-request-grid">
              {[
                ["organizationName", "اسم الجهة", "مثال: STC"],
                ["title", "عنوان الفرصة", "مثال: برنامج التدريب التعاوني"],
                ["applicationUrl", "رابط التقديم", "https://..."],
                ["sourceUrl", "رابط الإعلان أو المصدر", "اختياري"],
              ].map(([field, label, placeholder]) => (
                <label
                  key={field}
                  style={{
                    display: "grid",
                    gap: "6px",
                    color: "var(--app-text-soft)",
                    fontSize: "13px",
                    fontWeight: "800",
                  }}
                >
                  {label}
                  <input
                    required={field === "organizationName" || field === "title"}
                    value={opportunityRequest[field] || ""}
                    onChange={(event) =>
                      updateOpportunityRequestField(field, event.target.value)
                    }
                    placeholder={placeholder}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "11px 12px",
                      borderRadius: "12px",
                      border: "1px solid var(--app-border)",
                      background: "var(--app-input-bg)",
                      color: "var(--app-text)",
                      fontFamily: "inherit",
                    }}
                  />
                </label>
              ))}

              <label
                style={{
                  display: "grid",
                  gap: "6px",
                  color: "var(--app-text-soft)",
                  fontSize: "13px",
                  fontWeight: "800",
                }}
              >
                المدينة أو المنطقة
                <select
                  value={opportunityRequest.city}
                  onChange={(event) =>
                    updateOpportunityRequestField("city", event.target.value)
                  }
                  style={{
                    width: "100%",
                    padding: "11px 12px",
                    borderRadius: "12px",
                    border: "1px solid var(--app-border)",
                    background: "var(--app-input-bg)",
                    color: "var(--app-text)",
                    fontFamily: "inherit",
                  }}
                >
                  <option value="">كل المدن أو غير محدد</option>
                  {[
                    ...regionOptions.map((region) => region.value),
                    ...cityOptions,
                  ].map((cityName) => (
                    <option key={cityName} value={cityName}>
                      {cityName}
                    </option>
                  ))}
                </select>
              </label>

              <label
                style={{
                  display: "grid",
                  gap: "6px",
                  color: "var(--app-text-soft)",
                  fontSize: "13px",
                  fontWeight: "800",
                }}
              >
                التخصص المناسب
                <select
                  value={opportunityRequest.specialty}
                  onChange={(event) =>
                    updateOpportunityRequestField("specialty", event.target.value)
                  }
                  style={{
                    width: "100%",
                    padding: "11px 12px",
                    borderRadius: "12px",
                    border: "1px solid var(--app-border)",
                    background: "var(--app-input-bg)",
                    color: "var(--app-text)",
                    fontFamily: "inherit",
                  }}
                >
                  <option value="">كل التخصصات أو غير محدد</option>
                  {specializationOptions.map((specialization) => (
                    <option key={specialization.value} value={specialization.value}>
                      {specialization.label}
                    </option>
                  ))}
                </select>
              </label>

              <label
                style={{
                  display: "grid",
                  gap: "6px",
                  color: "var(--app-text-soft)",
                  fontSize: "13px",
                  fontWeight: "800",
                }}
              >
                طريقة التقديم
                <select
                  value={opportunityRequest.applicationMethod}
                  onChange={(event) =>
                    updateOpportunityRequestField(
                      "applicationMethod",
                      event.target.value
                    )
                  }
                  style={{
                    width: "100%",
                    padding: "11px 12px",
                    borderRadius: "12px",
                    border: "1px solid var(--app-border)",
                    background: "var(--app-input-bg)",
                    color: "var(--app-text)",
                    fontFamily: "inherit",
                  }}
                >
                  <option value="">غير محدد</option>
                  <option value="website">موقع</option>
                  <option value="email">إيميل</option>
                  <option value="linkedin">لينكدإن</option>
                  <option value="manual">يدوي</option>
                  <option value="other">أخرى</option>
                </select>
              </label>

              <label
                style={{
                  display: "grid",
                  gap: "6px",
                  color: "var(--app-text-soft)",
                  fontSize: "13px",
                  fontWeight: "800",
                }}
              >
                تاريخ انتهاء التقديم
                <input
                  type="date"
                  value={opportunityRequest.deadline}
                  onChange={(event) =>
                    updateOpportunityRequestField("deadline", event.target.value)
                  }
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "11px 12px",
                    borderRadius: "12px",
                    border: "1px solid var(--app-border)",
                    background: "var(--app-input-bg)",
                    color: "var(--app-text)",
                    fontFamily: "inherit",
                  }}
                />
              </label>

              <label
                style={{
                  display: "grid",
                  gap: "6px",
                  color: "var(--app-text-soft)",
                  fontSize: "13px",
                  fontWeight: "800",
                }}
              >
                وسيلة تواصل اختيارية
                <input
                  value={opportunityRequest.submitterContact}
                  onChange={(event) =>
                    updateOpportunityRequestField(
                      "submitterContact",
                      event.target.value
                    )
                  }
                  placeholder="إيميل أو حساب للتواصل عند الحاجة"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "11px 12px",
                    borderRadius: "12px",
                    border: "1px solid var(--app-border)",
                    background: "var(--app-input-bg)",
                    color: "var(--app-text)",
                    fontFamily: "inherit",
                  }}
                />
              </label>
            </div>

            <label
              style={{
                display: "grid",
                gap: "6px",
                color: "var(--app-text-soft)",
                fontSize: "13px",
                fontWeight: "800",
              }}
            >
              ملاحظة قصيرة
              <textarea
                rows={3}
                value={opportunityRequest.note}
                onChange={(event) =>
                  updateOpportunityRequestField("note", event.target.value)
                }
                placeholder="مثال: الإعلان موجه لطلاب التدريب التعاوني، يرجى التأكد من الشروط قبل التقديم."
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "11px 12px",
                  borderRadius: "12px",
                  border: "1px solid var(--app-border)",
                  background: "var(--app-input-bg)",
                  color: "var(--app-text)",
                  fontFamily: "inherit",
                  lineHeight: 1.8,
                  resize: "vertical",
                }}
              />
            </label>

            {opportunityRequestMessage && (
              <p
                style={{
                  margin: 0,
                  color: opportunityRequestMessage.includes("تم إرسال")
                    ? "var(--app-brand)"
                    : "#fecaca",
                  background: opportunityRequestMessage.includes("تم إرسال")
                    ? "var(--app-brand-soft)"
                    : "rgba(248,113,113,0.1)",
                  border: opportunityRequestMessage.includes("تم إرسال")
                    ? "1px solid var(--app-brand-border)"
                    : "1px solid rgba(248,113,113,0.22)",
                  borderRadius: "12px",
                  padding: "10px 12px",
                  fontSize: "13px",
                  lineHeight: 1.7,
                }}
              >
                {opportunityRequestMessage}
              </p>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() => setShowOpportunityRequestModal(false)}
                style={{
                  background: "transparent",
                  color: "var(--app-text-soft)",
                  border: "1px solid var(--app-border)",
                  borderRadius: "12px",
                  padding: "10px 14px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: "800",
                }}
              >
                إغلاق
              </button>
              <button
                type="submit"
                disabled={savingOpportunityRequest}
                style={{
                  background: "var(--app-brand)",
                  color: "#07100e",
                  border: "none",
                  borderRadius: "12px",
                  padding: "10px 16px",
                  cursor: savingOpportunityRequest ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  fontWeight: "900",
                }}
              >
                {savingOpportunityRequest ? "جاري الإرسال..." : "إرسال للمراجعة"}
              </button>
            </div>
          </form>
        </div>
      )}

      <style>{`
        .opportunity-request-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .opportunity-filter-bar {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
          align-items: center;
          background: transparent;
          border: none;
          border-radius: 0;
          padding: 0 2px;
          text-align: right;
        }

        .opportunity-filter-groups {
          display: flex;
          align-items: center;
          gap: 7px;
          overflow-x: auto;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }

        .opportunity-filter-groups::-webkit-scrollbar {
          display: none;
        }

        .opportunity-filter-chip,
        .opportunity-filter-reset {
          border: 1px solid var(--app-border);
          background: var(--app-input-bg);
          color: var(--app-text-soft);
          border-radius: 999px;
          padding: 7px 10px;
          font-family: inherit;
          font-size: 11px;
          font-weight: 900;
          line-height: 1;
          white-space: nowrap;
          cursor: pointer;
          transition: 0.18s ease;
        }

        .opportunity-filter-chip {
          flex: 0 0 auto;
        }

        .opportunity-filter-chip::before {
          content: "";
          width: 5px;
          height: 5px;
          border-radius: 999px;
          display: inline-block;
          margin-inline-end: 5px;
          background: currentColor;
          opacity: 0.65;
          vertical-align: middle;
        }

        .opportunity-filter-chip:hover,
        .opportunity-filter-reset:hover {
          border-color: var(--app-brand-border);
          color: var(--app-brand);
        }

        .opportunity-filter-chip.is-active {
          background: var(--app-brand);
          border-color: var(--app-brand);
          color: #07100e;
          box-shadow: 0 0 14px var(--app-brand-border);
        }

        .opportunity-filter-reset {
          justify-self: end;
          background: transparent;
          color: var(--app-muted);
          padding-inline: 8px;
        }

        .training-results-tabs {
          display: flex;
          gap: 8px;
          align-items: center;
          overflow-x: auto;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
          padding: 2px;
        }

        .training-results-tabs::-webkit-scrollbar {
          display: none;
        }

        .training-results-tab {
          flex: 0 0 auto;
          min-width: 120px;
          display: inline-flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          background: var(--app-surface);
          color: var(--app-text-soft);
          border: 1px solid var(--app-border);
          border-radius: 999px;
          padding: 9px 12px;
          font-family: inherit;
          font-weight: 900;
          cursor: pointer;
          transition: 0.18s ease;
        }

        .training-results-tab strong {
          min-width: 26px;
          height: 26px;
          display: inline-grid;
          place-items: center;
          border-radius: 999px;
          background: var(--app-input-bg);
          color: var(--app-brand);
          font-size: 12px;
          line-height: 1;
        }

        .training-results-tab.is-active {
          background: var(--app-brand);
          border-color: var(--app-brand);
          color: #07100e;
          box-shadow: 0 0 16px var(--app-brand-border);
        }

        .training-results-tab.is-active strong {
          background: rgba(7, 16, 14, 0.14);
          color: #07100e;
        }

        .finder-card-grid {
          align-items: stretch;
        }

        .finder-result-card {
          display: flex !important;
          flex-direction: column;
          min-height: 250px;
          align-content: start;
          box-shadow: none;
        }

        .finder-card-info {
          display: grid;
          gap: 7px;
          background: var(--app-card);
          border: 1px solid var(--app-border);
          border-radius: 12px;
          padding: 10px;
        }

        .finder-card-actions {
          display: grid;
          gap: 7px;
          align-self: end;
          margin-top: auto;
        }

        .finder-card-actions a {
          display: block;
          min-width: 0;
        }

        .finder-card-actions button {
          width: 100%;
        }

        .suggested-organization-source {
          flex: 0 0 auto;
          background: var(--app-brand-soft);
          border: 1px solid var(--app-brand-border);
          color: var(--app-text-soft);
          border-radius: 999px;
          padding: 4px 7px;
          font-size: 11px;
          line-height: 1.3;
          white-space: nowrap;
        }

        .suggested-organization-logo {
          width: 42px;
          height: 42px;
          min-width: 42px;
          max-width: 42px;
          min-height: 42px;
          max-height: 42px;
          aspect-ratio: 1 / 1;
          display: inline-grid;
          place-items: center;
          flex: 0 0 auto;
          border-radius: 14px;
          background:
            linear-gradient(145deg, var(--app-card), var(--app-brand-soft));
          border: 1px solid var(--app-brand-border);
          color: var(--app-brand);
          line-height: 1;
          overflow: hidden;
          box-shadow:
            inset 0 0 0 1px rgba(255,255,255,0.04),
            0 10px 24px rgba(0, 0, 0, 0.08);
        }

        .organization-logo-image-frame {
          width: 32px;
          height: 32px;
          min-width: 32px;
          min-height: 32px;
          display: inline-grid;
          place-items: center;
          border-radius: 10px;
          background:
            linear-gradient(145deg, #ffffff 0%, #f7fffd 100%);
          border: 1px solid rgba(15, 23, 42, 0.08);
          box-shadow:
            0 1px 3px rgba(15, 23, 42, 0.12),
            inset 0 0 0 1px rgba(255,255,255,0.7);
        }

        .organization-logo-image-frame img {
          width: 25px;
          height: 25px;
          min-width: 25px;
          min-height: 25px;
          max-width: 25px;
          max-height: 25px;
          display: block;
          object-fit: contain;
          border-radius: 6px;
          filter: drop-shadow(0 0 1px rgba(15, 23, 42, 0.28));
        }

        .organization-logo-initial {
          width: 32px;
          height: 32px;
          display: inline-grid;
          place-items: center;
          border-radius: 10px;
          background: var(--app-input-bg);
          border: 1px solid var(--app-brand-border);
          color: var(--app-brand);
          font-size: 18px;
          font-weight: 900;
          line-height: 1;
        }

        .opportunity-card {
          min-height: 250px;
        }

        .opportunity-card-title {
          min-height: 40px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .opportunity-card-city {
          display: none;
          margin: 0;
          color: var(--app-muted);
          font-size: 11px;
          font-weight: 800;
          line-height: 1.4;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .opportunity-card-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          justify-content: flex-end;
          align-items: center;
        }

        .opportunity-status,
        .opportunity-featured-badge {
          border-radius: 999px;
          padding: 5px 8px;
          font-size: 11px;
          font-weight: 900;
          line-height: 1.2;
          white-space: nowrap;
        }

        .opportunity-status.open {
          background: rgba(34, 197, 94, 0.13);
          border: 1px solid rgba(34, 197, 94, 0.34);
          color: #86efac;
        }

        .opportunity-status.closed {
          background: rgba(248, 113, 113, 0.12);
          border: 1px solid rgba(248, 113, 113, 0.32);
          color: #fecaca;
        }

        .opportunity-featured-badge {
          background: rgba(250,204,21,0.12);
          border: 1px solid rgba(250,204,21,0.28);
          color: #fde68a;
        }

        .opportunity-chip-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 6px;
        }

        .opportunity-chip {
          min-height: 32px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          background: var(--app-brand-soft);
          border: 1px solid var(--app-brand-border);
          color: var(--app-text-soft);
          border-radius: 999px;
          padding: 5px 7px;
          font-size: 11px;
          line-height: 1.35;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .opportunity-chip span:last-child {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .opportunity-deadline {
          justify-self: start;
          background: rgba(250,204,21,0.1);
          border: 1px solid rgba(250,204,21,0.25);
          color: #fde68a;
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 11px;
          line-height: 1.4;
        }

        .opportunity-actions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 7px;
          align-items: stretch;
          align-self: end;
          margin-top: auto;
        }

        .opportunity-actions a,
        .opportunity-actions button {
          min-height: 40px;
        }

        .opportunity-secondary-button,
        .opportunity-apply-button {
          width: 100%;
          min-height: 40px;
          display: inline-grid;
          place-items: center;
          border-radius: 10px;
          padding: 9px 10px;
          font-family: inherit;
          font-weight: 900;
          cursor: pointer;
          font-size: 12px;
          line-height: 1.35;
          text-align: center;
        }

        .opportunity-secondary-button {
          background: var(--app-input-bg);
          color: var(--app-brand);
          border: 1px solid var(--app-brand-border);
        }

        .opportunity-apply-button {
          background: var(--app-brand);
          color: #07100e;
          border: none;
        }

        .opportunity-apply-button.is-disabled {
          cursor: not-allowed;
          opacity: 0.52;
          filter: grayscale(0.2);
        }

        .opportunity-inline-link {
          color: var(--app-brand);
          font-size: 12px;
          text-decoration: none;
          font-weight: 800;
        }

        .opportunity-detail-overlay {
          position: fixed;
          inset: 0;
          z-index: 3300;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          background: var(--app-overlay);
          overscroll-behavior: contain;
        }

        .opportunity-detail-modal {
          width: min(620px, 100%);
          max-height: 88vh;
          overflow-y: auto;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
          display: grid;
          gap: 13px;
          background: var(--app-surface);
          border: 1px solid var(--app-border);
          border-radius: 20px;
          padding: 18px;
          box-shadow: 0 24px 70px var(--app-shadow);
          text-align: right;
        }

        .opportunity-detail-head {
          display: grid;
          grid-template-columns: 50px minmax(0, 1fr) 34px;
          gap: 12px;
          align-items: start;
        }

        .opportunity-detail-eyebrow {
          margin: 0 0 4px;
          color: var(--app-brand);
          font-size: 12px;
          font-weight: 900;
        }

        .opportunity-detail-head h2 {
          margin: 0;
          color: var(--app-text);
          font-size: 23px;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }

        .opportunity-detail-head p:not(.opportunity-detail-eyebrow) {
          margin: 5px 0 0;
          color: var(--app-text-soft);
          font-size: 13px;
          line-height: 1.75;
          overflow-wrap: anywhere;
        }

        .opportunity-detail-close {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: 1px solid var(--app-border);
          background: var(--app-card);
          color: var(--app-text);
          cursor: pointer;
          font-size: 20px;
          line-height: 1;
        }

        .opportunity-detail-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          align-items: center;
        }

        .opportunity-detail-chips {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .opportunity-detail-note {
          margin: 0;
          color: var(--app-text-soft);
          background: var(--app-card);
          border: 1px solid var(--app-border);
          border-radius: 14px;
          padding: 12px;
          font-size: 13px;
          line-height: 1.9;
        }

        .premium-preview-blur-wrap {
          position: relative;
        }

        .is-premium-preview-blurred {
          filter: blur(5px);
          user-select: none;
          min-height: 96px;
        }

        .premium-preview-blur-label {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--app-brand);
          font-size: 13px;
          font-weight: 800;
          text-align: center;
          pointer-events: none;
          text-shadow: 0 1px 10px var(--app-bg);
        }

        .opportunity-detail-links {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .opportunity-detail-links a {
          color: var(--app-brand);
          background: var(--app-brand-soft);
          border: 1px solid var(--app-brand-border);
          border-radius: 999px;
          padding: 8px 11px;
          font-size: 12px;
          font-weight: 900;
          text-decoration: none;
        }

        .opportunity-detail-actions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .search-insight-overlay {
          position: fixed;
          inset: 0;
          z-index: 3290;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          background: var(--app-overlay);
          backdrop-filter: blur(8px);
        }

        .search-insight-modal {
          position: relative;
          width: min(480px, 100%);
          display: grid;
          gap: 12px;
          background:
            radial-gradient(circle at top right, var(--app-brand-soft), transparent 48%),
            var(--app-surface);
          border: 1px solid var(--app-brand-border);
          border-radius: 20px;
          padding: 20px;
          text-align: right;
          box-shadow: 0 24px 70px var(--app-shadow);
        }

        .search-insight-close {
          position: absolute;
          top: 12px;
          left: 12px;
          width: 32px;
          height: 32px;
          display: inline-grid;
          place-items: center;
          border-radius: 50%;
          border: 1px solid var(--app-border);
          background: var(--app-card);
          color: var(--app-text);
          font-size: 19px;
          cursor: pointer;
        }

        .search-insight-eyebrow {
          margin: 0;
          color: var(--app-brand);
          font-size: 12px;
          font-weight: 900;
          line-height: 1.5;
        }

        .search-insight-modal h2 {
          margin: 0;
          color: var(--app-text);
          font-size: 24px;
          line-height: 1.45;
          padding-left: 34px;
        }

        .search-insight-modal h2 span {
          color: var(--app-brand);
          font-size: 1.18em;
          font-weight: 900;
        }

        .search-insight-subtitle {
          margin: -4px 0 0;
          color: var(--app-text-soft);
          font-size: 13px;
          line-height: 1.8;
        }

        .search-insight-list {
          display: grid;
          gap: 9px;
          margin-top: 2px;
        }

        .search-insight-item {
          min-height: 42px;
          display: grid;
          grid-template-columns: 22px 44px minmax(0, 1fr);
          gap: 8px;
          align-items: center;
          background: var(--app-card);
          border: 1px solid var(--app-border);
          border-radius: 13px;
          padding: 9px 11px;
        }

        .search-insight-item span {
          color: var(--app-brand);
          font-size: 15px;
          line-height: 1;
        }

        .search-insight-item strong {
          color: var(--app-brand);
          font-size: 20px;
          line-height: 1;
          font-weight: 900;
        }

        .search-insight-item p {
          margin: 0;
          color: var(--app-text);
          font-size: 14px;
          font-weight: 800;
          line-height: 1.5;
        }

        .search-insight-action {
          min-height: 44px;
          border: none;
          border-radius: 12px;
          background: var(--app-brand);
          color: #07100e;
          font-family: inherit;
          font-weight: 900;
          cursor: pointer;
        }

        .guide-specialties-block {
          display: grid;
          gap: 9px;
          background: var(--app-card);
          border: 1px solid var(--app-border);
          border-radius: 14px;
          padding: 12px;
        }

        .guide-specialties-block > strong {
          color: var(--app-brand);
          font-size: 13px;
          line-height: 1.4;
        }

        .guide-specialties-list {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }

        .guide-specialties-list span {
          background: var(--app-brand-soft);
          border: 1px solid var(--app-brand-border);
          color: var(--app-text-soft);
          border-radius: 999px;
          padding: 6px 9px;
          font-size: 12px;
          font-weight: 800;
          line-height: 1.35;
        }

        .guide-contact-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .guide-contact-grid > div {
          min-width: 0;
          display: grid;
          gap: 4px;
          background: var(--app-card);
          border: 1px solid var(--app-border);
          border-radius: 13px;
          padding: 10px;
        }

        .guide-contact-grid span {
          color: var(--app-muted);
          font-size: 11px;
          font-weight: 800;
          line-height: 1.4;
        }

        .guide-contact-grid strong {
          color: var(--app-text);
          font-size: 12px;
          line-height: 1.7;
          overflow-wrap: anywhere;
        }

        .guide-source-line {
          margin: -2px 2px 0;
          color: var(--app-muted);
          font-size: 11px;
          line-height: 1.5;
        }

        .opportunity-plus-inline-banner {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          gap: 14px;
          padding: 15px 16px;
          border-radius: 18px;
          border: 1px solid var(--app-brand-border);
          background:
            radial-gradient(circle at 12% 10%, rgba(125, 219, 205, 0.2), transparent 36%),
            linear-gradient(135deg, color-mix(in srgb, var(--app-brand) 12%, var(--app-surface)), var(--app-surface));
          box-shadow: 0 16px 34px var(--app-shadow);
          overflow: hidden;
        }

        .opportunity-plus-inline-copy {
          min-width: 0;
          display: grid;
          gap: 5px;
        }

        .opportunity-plus-inline-copy span {
          width: fit-content;
          padding: 4px 10px;
          border-radius: 999px;
          background: var(--app-brand);
          color: #071315;
          font-size: 12px;
          font-weight: 900;
          line-height: 1.4;
        }

        .opportunity-plus-inline-copy strong {
          color: var(--app-text);
          font-size: clamp(16px, 2vw, 21px);
          line-height: 1.55;
          font-weight: 900;
        }

        .opportunity-plus-inline-copy p {
          margin: 0;
          max-width: 620px;
          color: var(--app-text-soft);
          font-size: 13px;
          font-weight: 800;
          line-height: 1.8;
        }

        .opportunity-plus-inline-points {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 7px;
          min-width: 0;
        }

        .opportunity-plus-inline-points span {
          border: 1px solid var(--app-brand-border);
          border-radius: 999px;
          background: rgba(125, 219, 205, 0.08);
          color: var(--app-text-soft);
          font-size: 11.5px;
          font-weight: 900;
          line-height: 1.4;
          padding: 6px 9px;
          white-space: nowrap;
        }

        .opportunity-plus-inline-banner button {
          grid-column: 2;
          grid-row: 1 / span 2;
          align-self: center;
          border: none;
          border-radius: 999px;
          background: var(--app-brand);
          color: #071315;
          cursor: pointer;
          font-family: inherit;
          font-size: 13px;
          font-weight: 900;
          padding: 11px 17px;
          white-space: nowrap;
          box-shadow: 0 10px 24px rgba(125, 219, 205, 0.22);
        }

        .opportunity-plus-inline-banner button:hover {
          transform: translateY(-1px);
        }

        @media (max-width: 760px) {
          .opportunity-guide-inline-banner {
            grid-template-columns: 1fr !important;
          }

          .opportunity-guide-inline-banner a,
          .opportunity-guide-inline-banner button {
            width: 100% !important;
            max-width: none !important;
          }

          .opportunity-plus-inline-banner {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
            padding: 13px !important;
          }

          .opportunity-plus-inline-points {
            justify-content: flex-start !important;
          }

          .opportunity-plus-inline-points span {
            font-size: 10.5px !important;
            padding: 5px 8px !important;
          }

          .opportunity-plus-inline-banner button {
            grid-column: auto !important;
            grid-row: auto !important;
            width: 100% !important;
          }

          .training-finder-form {
            grid-template-columns: 1fr !important;
          }

          .opportunity-filter-bar {
            grid-template-columns: minmax(0, 1fr) auto !important;
            gap: 6px !important;
            padding: 0 1px !important;
          }

          .opportunity-filter-groups {
            gap: 6px !important;
            padding-bottom: 1px !important;
          }

          .opportunity-filter-chip,
          .opportunity-filter-reset {
            padding: 7px 8px !important;
            font-size: 10.5px !important;
          }

          .opportunity-filter-reset {
            justify-self: end !important;
          }

          .opportunity-request-grid {
            grid-template-columns: 1fr !important;
          }

          .training-results-tabs {
            gap: 6px !important;
            padding-bottom: 2px !important;
          }

          .training-results-tab {
            min-width: 104px !important;
            padding: 8px 10px !important;
            font-size: 12px !important;
          }

          .training-results-tab strong {
            min-width: 23px !important;
            height: 23px !important;
            font-size: 11px !important;
          }

          .training-targets-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 8px !important;
          }

          .suggested-targets-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 8px !important;
          }

          .opportunities-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 7px !important;
          }

          .finder-result-card,
          .opportunity-card {
            padding: 8px !important;
            border-radius: 13px !important;
            gap: 6px !important;
            min-height: 150px !important;
          }

          .opportunity-card {
            justify-items: stretch !important;
          }

          .opportunity-card::after {
            content: "تفاصيل";
            display: inline-grid;
            place-items: center;
            min-height: 24px;
            margin-top: auto;
            border-radius: 999px;
            background: var(--app-brand-soft);
            border: 1px solid var(--app-brand-border);
            color: var(--app-brand);
            font-size: 10px;
            font-weight: 900;
            line-height: 1;
          }

          .opportunity-card .card-quick-actions {
            align-items: center !important;
            gap: 4px !important;
          }

          .opportunity-card .save-item-button {
            width: 25px !important;
            min-width: 25px !important;
            height: 25px !important;
            min-height: 25px !important;
            padding: 0 !important;
            font-size: 0 !important;
            border-radius: 999px !important;
          }

          .opportunity-card .save-item-button::before {
            content: "♡";
            font-size: 13px;
            line-height: 1;
          }

          .opportunity-card .save-item-button.is-saved::before {
            content: "♥";
          }

          .opportunity-card .share-card-control {
            flex: 0 0 auto !important;
            max-width: 25px !important;
          }

          .opportunity-card .share-card-button {
            width: 25px !important;
            min-width: 25px !important;
            height: 25px !important;
            min-height: 25px !important;
            gap: 0 !important;
            padding: 0 !important;
            border-radius: 999px !important;
            font-size: 0 !important;
          }

          .opportunity-card .share-card-button span {
            display: none !important;
          }

          .opportunity-card .share-card-button svg {
            width: 13px !important;
            height: 13px !important;
          }

          .opportunity-card .card-timestamp-row {
            display: none !important;
          }

          .opportunity-card-head {
            grid-template-columns: 1fr !important;
            justify-items: center !important;
            gap: 6px !important;
            text-align: center !important;
          }

          .opportunity-card-head .suggested-organization-logo {
            width: 36px !important;
            height: 36px !important;
            min-width: 36px !important;
            min-height: 36px !important;
            max-width: 36px !important;
            max-height: 36px !important;
            border-radius: 12px !important;
          }

          .opportunity-card-head .organization-logo-image-frame,
          .opportunity-card-head .organization-logo-initial {
            width: 28px !important;
            height: 28px !important;
            min-width: 28px !important;
            min-height: 28px !important;
            border-radius: 9px !important;
          }

          .opportunity-card-head .organization-logo-image-frame img {
            width: 22px !important;
            height: 22px !important;
            min-width: 22px !important;
            min-height: 22px !important;
            max-width: 22px !important;
            max-height: 22px !important;
          }

          .opportunity-card-badges {
            grid-column: 1 / -1 !important;
            display: flex !important;
            justify-content: center !important;
            gap: 4px !important;
          }

          .opportunity-status,
          .opportunity-featured-badge {
            padding: 4px 6px !important;
            font-size: 9px !important;
          }

          .opportunity-organization-name {
            min-height: 30px !important;
            margin-bottom: 3px !important;
            font-size: 11.5px !important;
            line-height: 1.3 !important;
            text-align: center !important;
            display: -webkit-box !important;
            -webkit-line-clamp: 2 !important;
            -webkit-box-orient: vertical !important;
            overflow: hidden !important;
          }

          .opportunity-card-city {
            display: block !important;
          }

          .opportunity-chip-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 3px !important;
          }

          .opportunity-actions {
            display: none !important;
          }

          .opportunity-card-title {
            display: none !important;
          }

          .opportunity-interaction-count,
          .opportunity-card .finder-card-info {
            display: none !important;
          }

          .opportunity-chip {
            min-height: 22px !important;
            padding: 2px 3px !important;
            gap: 0 !important;
            font-size: 12px !important;
          }

          .opportunity-chip span:last-child {
            display: none !important;
          }

          .opportunity-deadline {
            max-width: 100% !important;
            padding: 3px 5px !important;
            font-size: 9px !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }

          .opportunity-secondary-button,
          .opportunity-apply-button {
            min-height: 32px !important;
            padding: 6px 4px !important;
            border-radius: 8px !important;
            font-size: 10px !important;
            line-height: 1.25 !important;
          }

          .opportunity-actions a,
          .opportunity-actions button {
            min-height: 32px !important;
          }

          .opportunity-detail-overlay {
            align-items: end !important;
            padding: 10px !important;
          }

          .opportunity-detail-modal {
            max-height: 84vh !important;
            border-radius: 18px 18px 14px 14px !important;
            padding: 14px !important;
            gap: 11px !important;
          }

          .opportunity-detail-head {
            grid-template-columns: 42px minmax(0, 1fr) 32px !important;
            gap: 9px !important;
          }

          .opportunity-detail-head h2 {
            font-size: 19px !important;
          }

          .opportunity-detail-head p:not(.opportunity-detail-eyebrow),
          .opportunity-detail-note {
            font-size: 12px !important;
          }

          .opportunity-detail-actions {
            grid-template-columns: 1fr !important;
          }

          .search-insight-overlay {
            align-items: end !important;
            padding: 10px !important;
          }

          .search-insight-modal {
            border-radius: 18px 18px 14px 14px !important;
            padding: 17px !important;
            gap: 10px !important;
          }

          .search-insight-modal h2 {
            font-size: 19px !important;
            padding-left: 30px !important;
          }

          .search-insight-item {
            grid-template-columns: 19px 34px minmax(0, 1fr) !important;
            min-height: 38px !important;
            padding: 8px 9px !important;
          }

          .search-insight-item strong {
            font-size: 17px !important;
          }

          .search-insight-item p {
            font-size: 12.5px !important;
          }

          .guide-contact-grid {
            grid-template-columns: 1fr !important;
          }

          .guide-specialties-list span {
            font-size: 11px !important;
            padding: 5px 7px !important;
          }

          .training-target-card,
          .suggested-target-card {
            padding: 10px !important;
            border-radius: 13px !important;
            gap: 8px !important;
            min-height: 220px !important;
            box-shadow: none !important;
          }

          .training-target-title {
            font-size: 15px !important;
            line-height: 1.45 !important;
            margin-bottom: 4px !important;
          }

          .training-target-card p,
          .suggested-target-card p {
            font-size: 11.5px !important;
            line-height: 1.65 !important;
          }

          .training-target-detail {
            padding: 8px !important;
            border-radius: 10px !important;
          }

          .training-target-actions {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 6px !important;
          }

          .training-target-actions a,
          .training-target-actions button {
            width: 100% !important;
          }

          .suggested-organization-logo {
            width: 34px !important;
            height: 34px !important;
            min-width: 34px !important;
            max-width: 34px !important;
            min-height: 34px !important;
            max-height: 34px !important;
            border-radius: 11px !important;
          }

          .organization-logo-image-frame,
          .organization-logo-initial {
            width: 26px !important;
            height: 26px !important;
            min-width: 26px !important;
            min-height: 26px !important;
            border-radius: 7px !important;
          }

          .organization-logo-image-frame img {
            width: 21px !important;
            height: 21px !important;
            min-width: 21px !important;
            min-height: 21px !important;
            max-width: 21px !important;
            max-height: 21px !important;
            border-radius: 5px !important;
          }

          .organization-logo-initial {
            font-size: 15px !important;
          }

          .suggested-card-head {
            grid-template-columns: 34px minmax(0, 1fr) !important;
            gap: 8px !important;
            align-items: start !important;
          }

          .suggested-card-title-row {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) !important;
            gap: 5px !important;
            margin-bottom: 4px !important;
          }

          .suggested-organization-source {
            justify-self: start !important;
            max-width: 100% !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
          }

          .opportunity-card.suggested-target-card {
            padding: 8px !important;
            gap: 6px !important;
            min-height: 150px !important;
          }

          .opportunity-card .opportunity-card-head {
            grid-template-columns: 1fr !important;
            justify-items: center !important;
            text-align: center !important;
          }

          .opportunity-card .suggested-card-title-row {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) !important;
            justify-items: center !important;
            gap: 4px !important;
          }

          .opportunity-card .finder-card-info,
          .opportunity-card .opportunity-actions,
          .opportunity-card .opportunity-card-title,
          .opportunity-card .opportunity-interaction-count {
            display: none !important;
          }
        }

        @media (min-width: 520px) and (max-width: 760px) {
          .opportunities-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 340px) {
          .training-targets-grid,
          .suggested-targets-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}
