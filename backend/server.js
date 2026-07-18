const express = require('express');
const mongoose = require('mongoose');
const cors = require("cors");
const crypto = require("crypto");
require('dotenv').config();

const Experience = require('./models/Experience');
const Suggestion = require('./models/Suggestion');
const Opportunity = require('./models/Opportunity');
const AnalyticsEvent = require('./models/AnalyticsEvent');
const Subscription = require('./models/Subscription');

const app = express();
const PORT = process.env.PORT || 3001;
const DEFAULT_EXPERIENCES_LIMIT = 36;
const MAX_EXPERIENCES_LIMIT = 60;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SUBSCRIPTION_PRICE_SAR = Number(process.env.SUBSCRIPTION_PRICE_SAR || 5);
const SUBSCRIPTION_DURATION_DAYS = Number(
  process.env.SUBSCRIPTION_DURATION_DAYS || 30
);
const ONE_TIME_SUBSCRIPTION_PRICE_SAR = Number(
  process.env.ONE_TIME_SUBSCRIPTION_PRICE_SAR ||
    process.env.ONE_TIME_PRICE_SAR ||
    15
);
const ONE_TIME_SUBSCRIPTION_DURATION_DAYS = Number(
  process.env.ONE_TIME_SUBSCRIPTION_DURATION_DAYS ||
    process.env.ONE_TIME_DURATION_DAYS ||
    90
);
const SUBSCRIPTION_CHECKOUT_URL = process.env.SUBSCRIPTION_CHECKOUT_URL || "";
const MOYASAR_SECRET_KEY = process.env.MOYASAR_SECRET_KEY || "";
const MOYASAR_API_BASE_URL =
  process.env.MOYASAR_API_BASE_URL || "https://api.moyasar.com/v1";
const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  process.env.PUBLIC_FRONTEND_URL ||
  "https://darbak.onrender.com";
const API_PUBLIC_URL = process.env.API_PUBLIC_URL || "";
const SUBSCRIPTION_SECRET =
  process.env.SUBSCRIPTION_SECRET ||
  ADMIN_PASSWORD ||
  process.env.MONGO_URI ||
  "darbak-subscription-local-secret";
const SUBSCRIPTION_PLANS = {
  monthly: {
    id: "monthly",
    label: "دربك+ - المزايا المتقدمة شهر",
    priceSar: SUBSCRIPTION_PRICE_SAR,
    durationDays: SUBSCRIPTION_DURATION_DAYS,
  },
  one_time_90: {
    id: "one_time_90",
    label: "دربك+ - المزايا المتقدمة 3 أشهر",
    priceSar: ONE_TIME_SUBSCRIPTION_PRICE_SAR,
    durationDays: ONE_TIME_SUBSCRIPTION_DURATION_DAYS,
  },
};
const GENERAL_SPECIALTY_MARKERS = [
  "__all_specialties__",
  "جميع التخصصات",
  "كل التخصصات",
  "عام",
  "all",
];
const BLOCKED_TERMS = [
  "غبي",
  "غباء",
  "حقير",
  "حقيره",
  "فاشل",
  "فاشله",
  "نصاب",
  "نصابه",
  "حرامي",
  "حراميه",
  "زباله",
  "كلب",
  "حيوان",
  "عنصري",
  "عنصريه",
  "لعنه",
  "قذر",
  "قذره",
  "stupid",
  "idiot",
  "trash",
  "scam",
  "scammer",
  "thief",
  "racist",
  "hate",
  "sucks",
  "damn",
];

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

const containsBlockedTerms = (value = "") => {
  const normalizedValue = normalizeSearchText(value);
  return BLOCKED_TERMS.some((term) =>
    normalizedValue.includes(normalizeSearchText(term))
  );
};

const normalizeLinkedInProfileUrl = (value = "") => {
  const text = value.toString().trim();
  if (!text) return "";

  const withProtocol = /^https?:\/\//i.test(text)
    ? text
    : `https://${text.replace(/^\/+/, "")}`;

  try {
    const url = new URL(withProtocol);
    const hostname = url.hostname.replace(/^www\./i, "").toLowerCase();

    if (hostname !== "linkedin.com") return "";
    if (!url.pathname.toLowerCase().startsWith("/in/")) return "";

    url.protocol = "https:";
    url.hostname = "www.linkedin.com";
    url.search = "";
    url.hash = "";

    return url.toString();
  } catch {
    return "";
  }
};

const normalizeArabicDigits = (value = "") =>
  value
    .toString()
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));

const normalizeEmail = (value = "") => value.toString().trim().toLowerCase();

const isValidEmail = (value = "") =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));

const normalizeSaudiMobile = (value = "") => {
  const digits = normalizeArabicDigits(value).replace(/[^\d+]/g, "");
  const number = digits.startsWith("+") ? digits : digits.replace(/^\+?/, "");

  if (/^\+9665\d{8}$/.test(digits)) return digits;
  if (/^9665\d{8}$/.test(number)) return `+${number}`;
  if (/^05\d{8}$/.test(number)) return `+966${number.slice(1)}`;
  if (/^5\d{8}$/.test(number)) return `+966${number}`;

  return "";
};

const normalizeSubscriberContact = (value = "") => {
  if (isValidEmail(value)) return normalizeEmail(value);
  return normalizeSaudiMobile(value) || normalizeArabicDigits(value).trim();
};

const isValidSubscriberContact = (value = "") =>
  isValidEmail(value) || Boolean(normalizeSaudiMobile(value));

const normalizeAccessCode = (value = "") =>
  normalizeArabicDigits(value).trim().replace(/\s+/g, "");

const isValidAccessCode = (value = "") => {
  const accessCode = normalizeAccessCode(value);
  return /^[A-Za-z0-9]{4,12}$/.test(accessCode) && !/^(.)\1+$/.test(accessCode);
};

const hashAccessCode = (contact = "", accessCode = "") =>
  crypto
    .createHmac("sha256", SUBSCRIPTION_SECRET)
    .update(
      `${normalizeSubscriberContact(contact)}:${normalizeAccessCode(accessCode)}`
    )
    .digest("hex");

const addSubscriptionDays = (days = SUBSCRIPTION_DURATION_DAYS) => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + Number(days || 30));
  return expiresAt;
};

const getSubscriptionPlan = (planId = "") =>
  SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.monthly;

const getSubscriptionDurationDays = (subscription = {}) =>
  Number(subscription.durationDays || SUBSCRIPTION_DURATION_DAYS);

const getSubscriptionPriceSar = (subscription = {}) =>
  Number(subscription.priceSar || SUBSCRIPTION_PRICE_SAR);

const getPublicApiUrl = (req) => {
  if (API_PUBLIC_URL) return API_PUBLIC_URL.replace(/\/$/, "");
  const protocol = req.get("x-forwarded-proto") || req.protocol || "https";
  return `${protocol}://${req.get("host")}`;
};

const getFrontendUrl = () => FRONTEND_URL.replace(/\/$/, "");

const getSafeSubscriptionReturnUrl = (returnUrl = "") => {
  const fallback = new URL(getFrontendUrl());
  fallback.searchParams.set("subscription", "success");

  try {
    const url = new URL(returnUrl);
    const allowedOrigin = new URL(getFrontendUrl()).origin;
    const isLocalOrigin =
      ["localhost", "127.0.0.1"].includes(url.hostname) &&
      process.env.NODE_ENV !== "production";

    if (url.origin !== allowedOrigin && !isLocalOrigin) {
      return fallback.toString();
    }

    url.searchParams.set("subscription", "success");
    return url.toString();
  } catch {
    return fallback.toString();
  }
};

const getMoyasarAuthHeader = () =>
  `Basic ${Buffer.from(`${MOYASAR_SECRET_KEY}:`).toString("base64")}`;

const callMoyasar = async (path, options = {}) => {
  if (!MOYASAR_SECRET_KEY) {
    const error = new Error("MOYASAR_SECRET_KEY is not configured");
    error.statusCode = 501;
    throw error;
  }

  const response = await fetch(`${MOYASAR_API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: getMoyasarAuthHeader(),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const error = new Error(
      data.message || data.error || "Moyasar request failed"
    );
    error.statusCode = response.status;
    error.details = data;
    throw error;
  }

  return data;
};

const flattenProviderError = (details = {}) => {
  const messages = [];

  const pushMessage = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(pushMessage);
      return;
    }
    if (typeof value === "object") {
      Object.values(value).forEach(pushMessage);
      return;
    }
    messages.push(String(value));
  };

  pushMessage(details.message);
  pushMessage(details.error);
  pushMessage(details.errors);
  pushMessage(details.raw);

  return Array.from(new Set(messages)).join(" - ").slice(0, 240);
};

const getCheckoutErrorMessage = (err) => {
  const providerReason = flattenProviderError(err.details);

  if (err.statusCode === 401 || err.statusCode === 403) {
    return "مفتاح ميسر غير صحيح أو غير مفعّل. تأكدي أن MOYASAR_SECRET_KEY هو Secret Key التجريبي كامل.";
  }

  if (err.statusCode === 400 || err.statusCode === 422) {
    return providerReason
      ? `ميسر رفض بيانات رابط الدفع: ${providerReason}`
      : "ميسر رفض بيانات رابط الدفع. تأكدي من روابط FRONTEND_URL و API_PUBLIC_URL.";
  }

  if (err.statusCode >= 500) {
    return "خدمة ميسر لم تستجب حاليًا. جرّبي بعد قليل أو راجعي لوحة ميسر.";
  }

  return providerReason || "تعذر إنشاء رابط الدفع التجريبي حاليًا.";
};

const createMoyasarInvoice = async ({
  amountHalalas,
  description,
  callbackUrl,
}) => {
  const body = new URLSearchParams();
  body.set("amount", String(amountHalalas));
  body.set("currency", "SAR");
  body.set("description", description);
  body.set("callback_url", callbackUrl);

  return callMoyasar("/invoices", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
};

const getMoyasarInvoice = async (invoiceId) =>
  callMoyasar(`/invoices/${encodeURIComponent(invoiceId)}`);

const isUnclearMajorText = (value = "") => {
  const text = value.toString().trim();
  if (!text) return true;

  const letters = text.match(/[A-Za-z\u0600-\u06FF]/g) || [];
  return letters.length < 2;
};

const getReadableMajor = (major, majorCategory) =>
  isUnclearMajorText(major) ? majorCategory || major : major;

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

const regionAliases = {
  الشرقية: "المنطقة الشرقية",
  شرقية: "المنطقة الشرقية",
  "الشرقيه": "المنطقة الشرقية",
  "المنطقة الشرقيه": "المنطقة الشرقية",
  القصيم: "منطقة القصيم",
  قصيم: "منطقة القصيم",
  "منطقه القصيم": "منطقة القصيم",
  عسير: "منطقة عسير",
  تبوك: "منطقة تبوك",
  حائل: "منطقة حائل",
  جازان: "منطقة جازان",
  نجران: "منطقة نجران",
  الباحة: "منطقة الباحة",
  الباحه: "منطقة الباحة",
  الجوف: "منطقة الجوف",
  "منطقة مكة": "منطقة مكة المكرمة",
  "منطقه مكه": "منطقة مكة المكرمة",
  "منطقة المدينة": "منطقة المدينة المنورة",
  "منطقه المدينه": "منطقة المدينة المنورة",
};

const getCanonicalRegionName = (city = "") => {
  if (!city) return "";
  if (regionCities[city]) return city;

  const normalizedCity = normalizeSearchText(city);
  const matchedAlias = Object.entries(regionAliases).find(
    ([alias]) => normalizeSearchText(alias) === normalizedCity
  );

  return matchedAlias?.[1] || "";
};

const requireAdmin = (req, res, next) => {
  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ error: "Admin password is not configured" });
  }

  if (req.headers["x-admin-password"] !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
};

const normalizeArrayField = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => item.toString().trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[,،]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const isGeneralSpecialtyValue = (value = "") =>
  GENERAL_SPECIALTY_MARKERS.some(
    (marker) => normalizeSearchText(marker) === normalizeSearchText(value)
  );

const isClosedByDeadline = (deadline) => {
  if (!deadline) return false;
  const deadlineDate = new Date(deadline);
  if (Number.isNaN(deadlineDate.getTime())) return false;
  deadlineDate.setHours(23, 59, 59, 999);
  return deadlineDate < new Date();
};

const sanitizeOpportunityPayload = (body = {}) => {
  const deadlineValue = body.deadline ? new Date(body.deadline) : undefined;
  const normalizedCities = normalizeArrayField(body.cities);
  const fallbackCity = (body.city || "").trim();
  const cities =
    normalizedCities.length > 0
      ? normalizedCities
      : fallbackCity
      ? [fallbackCity]
      : [];
  const normalizedMajorCategories = normalizeArrayField(body.majorCategories);
  const normalizedSpecialties = normalizeArrayField(body.specialties);
  const appliesToAllSpecialties =
    normalizedSpecialties.some(isGeneralSpecialtyValue) ||
    normalizedMajorCategories.some(isGeneralSpecialtyValue);

  return {
    organizationName: (body.organizationName || "").trim(),
    title: (body.title || "").trim(),
    city: cities[0] || "",
    cities,
    majorCategories: appliesToAllSpecialties ? [] : normalizedMajorCategories,
    specialties: appliesToAllSpecialties ? [] : normalizedSpecialties,
    trainingEnvironment: ["mixed", "women", "men", ""].includes(
      body.trainingEnvironment
    )
      ? body.trainingEnvironment
      : "",
    trainingMode: ["onsite", "remote", "hybrid", ""].includes(body.trainingMode)
      ? body.trainingMode
      : "",
    hasReward: ["yes", "no", ""].includes(body.hasReward) ? body.hasReward : "",
    applicationMethod: [
      "website",
      "email",
      "linkedin",
      "manual",
      "other",
      "",
    ].includes(body.applicationMethod)
      ? body.applicationMethod
      : "",
    applicationUrl: (body.applicationUrl || "").trim(),
    logoUrl: (body.logoUrl || "").trim(),
    sourceUrl: (body.sourceUrl || "").trim(),
    note: (body.note || "").trim(),
    status: ["active", "draft", "expired"].includes(body.status)
      ? body.status
      : "active",
    sourceType: ["admin", "visitor"].includes(body.sourceType)
      ? body.sourceType
      : "admin",
    submitterContact: (body.submitterContact || "").trim(),
    featured: Boolean(body.featured),
    ...(deadlineValue && !Number.isNaN(deadlineValue.getTime())
      ? { deadline: deadlineValue }
      : { deadline: undefined }),
  };
};

const getCityFilterValues = (city = "") => {
  if (!city) return [];
  const regionName = getCanonicalRegionName(city);
  if (!regionName) return [city];

  return Array.from(
    new Set([
      city,
      regionName,
      ...Object.entries(regionAliases)
        .filter(([, value]) => value === regionName)
        .map(([alias]) => alias),
      ...regionCities[regionName],
    ])
  );
};

const sanitizeAnalyticsText = (value = "", maxLength = 160) => {
  if (value === null || value === undefined) return "";

  return value
    .toString()
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
};

const sanitizeAnalyticsMetadata = (metadata = {}) => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  return Object.entries(metadata).reduce((cleaned, [key, value]) => {
    const safeKey = sanitizeAnalyticsText(key, 50);
    if (!safeKey) return cleaned;

    if (["string", "number", "boolean"].includes(typeof value)) {
      cleaned[safeKey] =
        typeof value === "string" ? sanitizeAnalyticsText(value, 180) : value;
      return cleaned;
    }

    if (Array.isArray(value)) {
      cleaned[safeKey] = value
        .slice(0, 12)
        .map((item) =>
          ["string", "number", "boolean"].includes(typeof item)
            ? typeof item === "string"
              ? sanitizeAnalyticsText(item, 120)
              : item
            : ""
        )
        .filter((item) => item !== "");
    }

    return cleaned;
  }, {});
};

const getAnalyticsGroup = async (match, field, limit = 10) => {
  const fieldFilter =
    field === "eventName"
      ? { $nin: [null, "", "session_ping"] }
      : { $nin: [null, ""] };

  return AnalyticsEvent.aggregate([
    { $match: { ...match, [field]: fieldFilter } },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: limit },
    { $project: { _id: 0, label: "$_id", count: 1 } },
  ]);
};

const itemInteractionConfig = {
  experience: {
    metadataField: "metadata.experienceId",
    eventBuckets: {
      experience_card_opened: "views",
      experience_detail_viewed: "views",
      saved_item_added: "saves",
    },
  },
  opportunity: {
    metadataField: "metadata.opportunityId",
    eventBuckets: {
      opportunity_details_clicked: "details",
      opportunity_detail_viewed: "details",
      opportunity_apply_clicked: "applies",
      saved_item_added: "saves",
    },
  },
};

const getEmptyItemInteractionStats = () => ({
  total: 0,
  views: 0,
  details: 0,
  applies: 0,
  saves: 0,
});

const getItemInteractionStats = async (itemType, ids = []) => {
  const cleanIds = Array.from(
    new Set(
      ids
        .map((id) => (id ? id.toString() : ""))
        .filter(Boolean)
    )
  );

  if (cleanIds.length === 0) return new Map();

  const config = itemInteractionConfig[itemType];
  if (!config) return new Map();

  const { metadataField, eventBuckets } = config;
  const eventNames = Object.keys(eventBuckets);

  const rows = await AnalyticsEvent.aggregate([
    {
      $match: {
        eventName: { $in: eventNames },
        [metadataField]: { $in: cleanIds },
      },
    },
    {
      $group: {
        _id: {
          itemId: `$${metadataField}`,
          eventName: "$eventName",
        },
        count: { $sum: 1 },
      },
    },
  ]);

  return rows.reduce((statsMap, row) => {
    const itemId = row?._id?.itemId;
    const eventName = row?._id?.eventName;
    const bucket = eventBuckets[eventName];
    const count = Number(row.count) || 0;

    if (!itemId || !bucket) return statsMap;

    const current = statsMap.get(itemId) || getEmptyItemInteractionStats();
    current[bucket] += count;
    current.total += count;
    statsMap.set(itemId, current);
    return statsMap;
  }, new Map());
};

const attachItemInteractionCounts = async (itemType, items = []) => {
  const safeItems = Array.isArray(items) ? items : [];
  const stats = await getItemInteractionStats(
    itemType,
    safeItems.map((item) => item?._id)
  );

  return safeItems.map((item) => {
    const itemStats =
      stats.get(item._id?.toString()) || getEmptyItemInteractionStats();

    return {
      ...item,
      interactionStats: itemStats,
      interactionCount: itemStats.total,
    };
  });
};

const getAnalyticsSearches = async (match, limit = 12) =>
  AnalyticsEvent.aggregate([
    {
      $match: {
        ...match,
        eventName: "experience_search",
        "metadata.searchQuality": "settled",
        searchQuery: { $nin: [null, ""] },
      },
    },
    {
      $addFields: {
        cleanSearchQuery: {
          $trim: {
            input: "$searchQuery",
          },
        },
      },
    },
    {
      $addFields: {
        searchLength: { $strLenCP: "$cleanSearchQuery" },
      },
    },
    { $match: { searchLength: { $gte: 3 } } },
    { $group: { _id: "$cleanSearchQuery", count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: limit },
    { $project: { _id: 0, label: "$_id", count: 1 } },
  ]);

const getAnalyticsDateScope = (daysParam) => {
  if (daysParam === "all") {
    return {
      days: null,
      rangeLabel: "كل الفترة",
      match: {},
    };
  }

  const requestedDays = parseInt(daysParam, 10) || 30;
  const days = Math.min(Math.max(requestedDays, 1), 1095);

  return {
    days,
    rangeLabel: `آخر ${days} يوم`,
    match: {
      createdAt: {
        $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
      },
    },
  };
};

const getCleanAnalyticsMatch = (match) => ({
  ...match,
  eventName: { $nin: ["session_ping", "session_duration"] },
  $or: [
    { eventName: { $ne: "experience_search" } },
    {
      eventName: "experience_search",
      "metadata.searchQuality": "settled",
    },
  ],
});

const SMART_ASSISTANT_MAX_CANDIDATES = 1200;

const SMART_ASSISTANT_ORG_ALIASES = [
  {
    label: "STC",
    aliases: ["stc", "اس تي سي", "الاتصالات السعودية", "شركة الاتصالات السعودية"],
  },
  {
    label: "أرامكو",
    aliases: ["أرامكو", "ارامكو", "aramco", "saudi aramco"],
  },
  {
    label: "سابك",
    aliases: ["سابك", "sabic"],
  },
  {
    label: "علم",
    aliases: ["علم", "elm", "شركة علم"],
  },
  {
    label: "هيئة السوق المالية",
    aliases: ["هيئة السوق المالية", "cma", "capital market authority"],
  },
  {
    label: "التأمينات الاجتماعية",
    aliases: ["التأمينات", "التامينات", "gosi"],
  },
  {
    label: "البنك الأهلي",
    aliases: ["البنك الأهلي", "الاهلي", "alahli", "snb"],
  },
];

const SMART_ASSISTANT_MAJOR_ALIASES = [
  {
    label: "الحاسب والتقنية",
    aliases: ["حاسب", "تقنية", "تقنيه", "برمجة", "برمجه", "نظم", "it", "cs"],
  },
  {
    label: "علوم الحاسب",
    aliases: ["علوم حاسب", "computer science", "cs"],
  },
  {
    label: "نظم المعلومات",
    aliases: ["نظم معلومات", "information systems", "is"],
  },
  {
    label: "تقنية المعلومات",
    aliases: ["تقنية معلومات", "تقنيه معلومات", "it"],
  },
  {
    label: "الأمن السيبراني",
    aliases: ["امن سيبراني", "أمن سيبراني", "cyber", "cybersecurity"],
  },
  {
    label: "المحاسبة",
    aliases: ["محاسبة", "محاسب", "accounting"],
  },
  {
    label: "المالية",
    aliases: ["مالية", "finance"],
  },
  {
    label: "إدارة الأعمال",
    aliases: ["ادارة اعمال", "إدارة أعمال", "business administration"],
  },
  {
    label: "الموارد البشرية",
    aliases: ["موارد بشرية", "hr", "human resources"],
  },
  {
    label: "التسويق",
    aliases: ["تسويق", "marketing"],
  },
  {
    label: "القانون والسياسة",
    aliases: ["قانون", "محاماة", "حقوق", "law"],
  },
  {
    label: "الهندسة والطاقة",
    aliases: ["هندسة", "مهندس", "engineering"],
  },
  {
    label: "الطب والعلوم الصحية",
    aliases: ["طب", "صحة", "تمريض", "صيدلة", "health"],
  },
];

const SMART_ASSISTANT_PROBLEM_THEMES = [
  {
    label: "قلة وضوح المهام أو التنظيم",
    terms: ["غير واضح", "مو واضح", "تنظيم", "مهام غير واضحة", "مافي مهام"],
  },
  {
    label: "ضغط أو كثرة مهام",
    terms: ["ضغط", "كرف", "مهام كثيرة", "شغل كثير", "ضغط عمل"],
  },
  {
    label: "ضعف التواصل أو المتابعة",
    terms: ["تواصل", "متابعة", "مشرف", "توجيه", "رد"],
  },
  {
    label: "بيئة غير مريحة",
    terms: ["بيئة غير مريحة", "غير مريحة", "توتر", "صراخ", "مشاكل"],
  },
  {
    label: "قلة التعلم أو محدودية الفائدة",
    terms: ["ما استفدت", "لم استفد", "قليل", "محدودة", "روتيني"],
  },
  {
    label: "طول الدوام أو صعوبة الالتزام",
    terms: ["دوام", "حضور", "وقت", "اوقات", "ساعات"],
  },
];

const SMART_ASSISTANT_POSITIVE_THEMES = [
  {
    label: "بيئة تدريب جيدة",
    terms: ["بيئة ممتازة", "بيئة جيدة", "بيئة مريحة", "متعاونين", "لطيف"],
  },
  {
    label: "تعلم ومهام مفيدة",
    terms: ["استفدت", "تعلمت", "مفيدة", "مثرية", "تطوير"],
  },
  {
    label: "تعاون المشرفين أو الفريق",
    terms: ["مشرف", "متعاون", "الفريق", "توجيه", "دعم"],
  },
  {
    label: "تنظيم واضح",
    terms: ["منظم", "تنظيم", "واضح", "خطة"],
  },
];

const SMART_ASSISTANT_SUGGESTED_QUESTIONS = [
  "أفضل جهات التدريب لتخصص علوم الحاسب بالرياض؟",
  "ماذا قال الطلاب عن تدريب STC؟",
  "هل يوجد تجارب لتخصص المحاسبة في جدة؟",
  "ما الجهات التي حصل فيها الطلاب على مكافأة؟",
];

const getApprovedExperiencesFilter = () => ({
  $or: [{ status: "approved" }, { status: { $exists: false } }],
});

const uniqueTruthy = (values = []) =>
  Array.from(
    new Set(
      values
        .map((value) => (value || "").toString().trim())
        .filter(Boolean)
    )
  );

const smartIncludes = (value = "", term = "") => {
  const normalizedValue = normalizeSearchText(value);
  const normalizedTerm = normalizeSearchText(term);

  if (!normalizedValue || !normalizedTerm || normalizedTerm.length < 2) {
    return false;
  }

  return (
    normalizedValue.includes(normalizedTerm) ||
    normalizedTerm.includes(normalizedValue)
  );
};

const smartTextIncludesAny = (value = "", terms = []) =>
  terms.some((term) => smartIncludes(value, term));

const getSmartWords = (value = "") =>
  normalizeSearchText(value)
    .replace(/[؟?.,،:;!()[\]{}"']/g, " ")
    .split(/[^a-z0-9\u0600-\u06ff]+/i)
    .map((word) => word.trim())
    .filter(Boolean);

const stripSmartWordPrefix = (word = "") => {
  let cleanWord = word;

  ["و", "ف", "ب", "ل"].forEach((prefix) => {
    if (cleanWord.startsWith(prefix) && cleanWord.length > 3) {
      cleanWord = cleanWord.slice(prefix.length);
    }
  });

  return cleanWord;
};

const smartQuestionIncludesTerm = (question = "", term = "") => {
  const normalizedQuestion = normalizeSearchText(question);
  const normalizedTerm = normalizeSearchText(term);

  if (!normalizedQuestion || !normalizedTerm || normalizedTerm.length < 2) {
    return false;
  }

  if (normalizedTerm.includes(" ")) {
    return normalizedQuestion.includes(normalizedTerm);
  }

  const words = getSmartWords(question);

  if (normalizedTerm.length <= 4) {
    return words.some((word) => {
      const cleanWord = stripSmartWordPrefix(word);
      return word === normalizedTerm || cleanWord === normalizedTerm;
    });
  }

  return words.some((word) => {
    const cleanWord = stripSmartWordPrefix(word);
    return (
      word === normalizedTerm ||
      cleanWord === normalizedTerm ||
      word.includes(normalizedTerm) ||
      cleanWord.includes(normalizedTerm)
    );
  });
};

const getExperienceMajorValues = (exp = {}) =>
  uniqueTruthy([exp.major, exp.majorCategory]);

const getExperienceSearchText = (exp = {}) =>
  [
    exp.organizationName,
    exp.city,
    exp.major,
    exp.majorCategory,
    exp.howApplied,
    exp.description,
    exp.title,
  ]
    .filter(Boolean)
    .join(" ");

const detectSmartOrganizations = (question = "", organizationNames = []) => {
  const matches = new Map();

  organizationNames.forEach((organizationName) => {
    if (smartQuestionIncludesTerm(question, organizationName)) {
      matches.set(normalizeSearchText(organizationName), {
        label: organizationName,
        values: [organizationName],
        terms: [organizationName],
        groupKey: normalizeSearchText(organizationName),
      });
    }
  });

  SMART_ASSISTANT_ORG_ALIASES.forEach((group) => {
    const aliasMatched = group.aliases.some((alias) =>
      smartQuestionIncludesTerm(question, alias)
    );
    if (!aliasMatched) return;

    const relatedNames = organizationNames.filter((organizationName) =>
      smartTextIncludesAny(organizationName, [group.label, ...group.aliases])
    );

    if (relatedNames.length === 0) {
      matches.set(normalizeSearchText(group.label), {
        label: group.label,
        values: [group.label],
        terms: [group.label, ...group.aliases],
        groupKey: normalizeSearchText(group.label),
      });
      return;
    }

    relatedNames.forEach((organizationName) => {
      matches.set(normalizeSearchText(organizationName), {
        label: organizationName,
        values: [organizationName],
        terms: [organizationName, group.label, ...group.aliases],
        groupKey: normalizeSearchText(group.label),
      });
    });
  });

  return Array.from(matches.values()).slice(0, 4);
};

const detectSmartCities = (question = "", experienceCities = []) => {
  const allCities = uniqueTruthy([
    ...Object.keys(regionCities),
    ...Object.keys(regionAliases),
    ...Object.values(regionCities).flat(),
    ...experienceCities,
  ]);

  return allCities
    .filter((city) => smartQuestionIncludesTerm(question, city))
    .map((city) => ({
      label: city,
      values: getCityFilterValues(city).length ? getCityFilterValues(city) : [city],
      terms: [city, ...getCityFilterValues(city)],
    }))
    .slice(0, 3);
};

const detectSmartMajors = (question = "", majorValues = []) => {
  const matches = new Map();

  majorValues.forEach((major) => {
    if (smartQuestionIncludesTerm(question, major)) {
      matches.set(normalizeSearchText(major), {
        label: major,
        values: [major],
        terms: [major],
      });
    }
  });

  SMART_ASSISTANT_MAJOR_ALIASES.forEach((group) => {
    const aliasMatched = [group.label, ...group.aliases].some((alias) =>
      smartQuestionIncludesTerm(question, alias)
    );
    if (!aliasMatched) return;

    const relatedMajors = majorValues.filter((major) =>
      smartTextIncludesAny(major, [group.label, ...group.aliases])
    );

    if (relatedMajors.length === 0) {
      matches.set(normalizeSearchText(group.label), {
        label: group.label,
        values: [group.label],
        terms: [group.label, ...group.aliases],
      });
      return;
    }

    relatedMajors.forEach((major) => {
      matches.set(normalizeSearchText(major), {
        label: major,
        values: [major],
        terms: [major, group.label, ...group.aliases],
      });
    });
  });

  return Array.from(matches.values()).slice(0, 5);
};

const experienceMatchesSmartFilters = (exp, filters = {}) => {
  const { organizations = [], cities = [], majors = [] } = filters;
  const organizationName = exp.organizationName || "";
  const majorValues = getExperienceMajorValues(exp).join(" ");

  if (
    organizations.length > 0 &&
    !organizations.some((item) =>
      smartTextIncludesAny(organizationName, item.terms || item.values)
    )
  ) {
    return false;
  }

  if (
    cities.length > 0 &&
    !cities.some((item) =>
      (item.values || []).some(
        (city) => normalizeSearchText(city) === normalizeSearchText(exp.city)
      )
    )
  ) {
    return false;
  }

  if (
    majors.length > 0 &&
    !majors.some((item) => smartTextIncludesAny(majorValues, item.terms || item.values))
  ) {
    return false;
  }

  return true;
};

const getAverageRating = (experiences = []) => {
  const ratings = experiences
    .map((exp) => Number(exp.starRating))
    .filter((rating) => Number.isFinite(rating) && rating > 0);

  if (ratings.length === 0) return null;

  const average = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
  return Math.round(average * 10) / 10;
};

const getFieldRatio = (experiences = [], field) => {
  const known = experiences.filter((exp) => ["yes", "no"].includes(exp[field]));
  if (known.length === 0) return null;

  const yesCount = known.filter((exp) => exp[field] === "yes").length;
  return {
    yesCount,
    noCount: known.length - yesCount,
    total: known.length,
    percent: Math.round((yesCount / known.length) * 100),
  };
};

const getTopFrequencies = (values = [], limit = 3) => {
  const counts = new Map();

  values.filter(Boolean).forEach((value) => {
    const label = value.toString().trim();
    if (!label) return;
    counts.set(label, (counts.get(label) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ar"))
    .slice(0, limit);
};

const getThemeMatches = (experiences = [], themes = []) => {
  const text = normalizeSearchText(
    experiences.map((exp) => exp.description || "").join(" ")
  );

  return themes
    .map((theme) => ({
      label: theme.label,
      count: theme.terms.filter((term) => text.includes(normalizeSearchText(term))).length,
    }))
    .filter((theme) => theme.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
};

const getPrimaryRelatedUrl = (filters = {}) => {
  const organization = filters.organizations?.[0]?.label;
  const major = filters.majors?.[0]?.label;
  const query = organization || major || "";

  return query
    ? `/experiences?company=${encodeURIComponent(query)}`
    : "/experiences";
};

const mapSmartExperiencePreview = (exp = {}) => ({
  id: exp._id,
  title: exp.title || `تجربة في ${exp.organizationName || "جهة"}`,
  organizationName: exp.organizationName,
  city: exp.city,
  major: getReadableMajor(exp.major, exp.majorCategory),
  rating: exp.starRating,
});

const buildSmartSummaryBullets = (experiences = []) => {
  const bullets = [];
  const averageRating = getAverageRating(experiences);
  const benefited = getFieldRatio(experiences, "benefitedFromTraining");
  const recommended = getFieldRatio(experiences, "wouldRecommend");
  const reward = getFieldRatio(experiences, "hadReward");
  const hired = getFieldRatio(experiences, "wasHired");
  const topEnvironments = getTopFrequencies(
    experiences.map((exp) => exp.trainingEnvironment).filter(Boolean)
  );
  const topMethods = getTopFrequencies(
    experiences.map((exp) => exp.howApplied).filter(Boolean)
  );
  const positiveThemes = getThemeMatches(experiences, SMART_ASSISTANT_POSITIVE_THEMES);
  const problemThemes = getThemeMatches(experiences, SMART_ASSISTANT_PROBLEM_THEMES);
  const hasInterviewMentions = experiences.some((exp) =>
    smartTextIncludesAny(exp.description, ["مقابلة", "اسئلة", "أسئلة", "تعريفية"])
  );

  if (averageRating !== null) {
    bullets.push(`متوسط التقييم في التجارب المطابقة هو ${averageRating}/5.`);
  }

  if (benefited) {
    bullets.push(
      `${benefited.percent}% من التجارب التي ذكرت الاستفادة قالت إن التدريب كان مفيدًا.`
    );
  }

  if (recommended) {
    bullets.push(
      `${recommended.percent}% من التجارب التي ذكرت الترشيح قالت إنها تنصح بالتجربة.`
    );
  }

  if (reward) {
    bullets.push(
      `${reward.percent}% من التجارب التي وضحت المكافأة ذكرت وجود مكافأة.`
    );
  }

  if (hired && hired.yesCount > 0) {
    bullets.push(
      `ظهر عرض وظيفي في ${hired.yesCount} من التجارب التي وضحت هذا الحقل.`
    );
  }

  if (topEnvironments.length > 0) {
    const environmentLabels = {
      mixed: "مختلطة",
      women: "نسائية",
      men: "رجالية",
    };
    bullets.push(
      `أكثر بيئة مذكورة: ${environmentLabels[topEnvironments[0].label] || topEnvironments[0].label}.`
    );
  }

  if (topMethods.length > 0) {
    bullets.push(
      `طرق التقديم الأكثر ذكرًا: ${topMethods.map((item) => item.label).join("، ")}.`
    );
  }

  if (positiveThemes.length > 0) {
    bullets.push(
      `أبرز الانطباعات الإيجابية المتكررة: ${positiveThemes
        .map((item) => item.label)
        .join("، ")}.`
    );
  }

  if (problemThemes.length > 0) {
    bullets.push(
      `أكثر الملاحظات أو التحديات تكرارًا: ${problemThemes
        .map((item) => item.label)
        .join("، ")}.`
    );
  }

  if (hasInterviewMentions) {
    bullets.push("بعض التجارب ذكرت وجود مقابلة أو أسئلة تعريفية قبل القبول.");
  }

  if (bullets.length === 0) {
    bullets.push("التجارب الموجودة مطابقة، لكن تفاصيلها لا تكفي لاستخراج نمط واضح.");
  }

  return bullets;
};

const SMART_ASSISTANT_ENVIRONMENT_LABELS = {
  mixed: "مختلطة",
  women: "نسائية",
  men: "رجالية",
};

const SMART_ASSISTANT_SECTION_LABELS = [
  "الإيجابيات",
  "التحديات",
  "سلبيات التدريب",
  "الخلاصة بعد التدريب",
  "نصيحة للمتدربين",
  "المسمى أثناء التدريب",
  "لغة العمل",
  "مدة إجراءات التقديم",
];

const formatSmartPercent = (
  ratio,
  yesLabel,
  noLabel = "",
  groupLabel = "التجارب التي وضحت هذا الجانب"
) => {
  if (!ratio || ratio.total === 0) return "";

  if (ratio.percent >= 70) {
    return `أغلب ${groupLabel} ذكرت ${yesLabel}`;
  }

  if (ratio.percent >= 45) {
    return `حوالي نصف ${groupLabel} ذكرت ${yesLabel}`;
  }

  if (ratio.yesCount > 0) {
    return `بعض التجارب ذكرت ${yesLabel}`;
  }

  return noLabel || "";
};

const getSmartOrganizationDisplayName = (label = "") => {
  const normalizedLabel = normalizeSearchText(label);
  if (normalizedLabel === "stc") return "STC";
  if (normalizedLabel.includes("channels by stc")) return "Channels by STC";
  if (normalizedLabel === "pwc") return "PwC";
  return label;
};

const isMeaningfulSmartValue = (value = "") => {
  const normalizedValue = normalizeSearchText(value);
  return Boolean(
    normalizedValue &&
      !["غير مذكور", "غير محدد", "غير واضح", "not sure"].includes(normalizedValue)
  );
};

const getSmartSubjectLabel = (filters = {}) => {
  const organization = filters.organizations?.[0]?.label
    ? getSmartOrganizationDisplayName(filters.organizations[0].label)
    : "";
  const major = filters.majors?.[0]?.label;
  const city = filters.cities?.[0]?.label;

  if (organization && major && city) return `${organization} لتخصص ${major} في ${city}`;
  if (organization && major) return `${organization} لتخصص ${major}`;
  if (organization && city) return `${organization} في ${city}`;
  if (major && city) return `تخصص ${major} في ${city}`;
  if (organization) return organization;
  if (major) return `تخصص ${major}`;
  if (city) return `تجارب ${city}`;
  return "التجارب المطابقة";
};

const getSmartTone = (experiences = []) => {
  const averageRating = getAverageRating(experiences);
  const recommended = getFieldRatio(experiences, "wouldRecommend");
  const benefited = getFieldRatio(experiences, "benefitedFromTraining");
  const problemThemes = getThemeMatches(experiences, SMART_ASSISTANT_PROBLEM_THEMES);

  if (
    averageRating >= 4.2 ||
    recommended?.percent >= 70 ||
    benefited?.percent >= 70
  ) {
    return "إيجابية بشكل عام";
  }

  if (
    averageRating !== null &&
    averageRating < 3.2 &&
    problemThemes.length > 0
  ) {
    return "تحتاج انتباه قبل القرار";
  }

  return "متفاوتة وتعتمد على القسم أو الفريق";
};

const getSmartSectionValue = (description = "", label = "") => {
  if (!description || !label) return "";

  const labelsPattern = SMART_ASSISTANT_SECTION_LABELS.map((item) =>
    item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  ).join("|");
  const regex = new RegExp(`${label}\\s*:\\s*([\\s\\S]*?)(?=\\s*(?:${labelsPattern})\\s*:|$)`);
  const match = description.match(regex);

  return (match?.[1] || "")
    .replace(/\s+/g, " ")
    .replace(/[.،؛:]+$/g, "")
    .trim();
};

const getSmartRoleInsights = (experiences = []) => {
  const roles = getTopFrequencies(
    experiences
      .map((exp) => getSmartSectionValue(exp.description, "المسمى أثناء التدريب"))
      .filter(Boolean),
    4
  );

  return roles.map((item) => item.label);
};

const SMART_ASSISTANT_TASK_THEMES = [
  {
    label: "تحليل البيانات والتقارير",
    terms: ["تحليل البيانات", "بيانات", "تقارير", "اكسل", "إكسل", "dashboard"],
  },
  {
    label: "مهام تقنية أو برمجية",
    terms: ["برمجة", "تطوير", "نظام", "تطبيق", "اختبار", "بايثون", "python"],
  },
  {
    label: "مهام مالية أو مخاطر",
    terms: ["مالية", "مخاطر", "استثمار", "محاسبة", "تدقيق", "إكتواري", "اكتواري"],
  },
  {
    label: "تواصل وخدمة عملاء",
    terms: ["تواصل", "عملاء", "خدمة", "مقابلات", "تنسيق"],
  },
  {
    label: "تسويق ومحتوى",
    terms: ["تسويق", "محتوى", "حملات", "تصميم", "إعلام"],
  },
];

const getSmartTaskInsights = (experiences = []) =>
  getThemeMatches(experiences, SMART_ASSISTANT_TASK_THEMES).map((item) => item.label);

const hasSmartFilters = (filters = {}) =>
  Boolean(
    filters.organizations?.length ||
      filters.cities?.length ||
      filters.majors?.length
  );

const rebuildSmartContextFilters = (
  context = {},
  organizationNames = [],
  experienceCities = [],
  majorValues = []
) => {
  const contextFilters = context.filters || {};
  const contextQuestion = sanitizeAnalyticsText(context.question || "", 300);
  const contextText = [
    contextQuestion,
    ...(Array.isArray(contextFilters.organizations)
      ? contextFilters.organizations
      : []),
    ...(Array.isArray(contextFilters.cities) ? contextFilters.cities : []),
    ...(Array.isArray(contextFilters.majors) ? contextFilters.majors : []),
  ]
    .filter(Boolean)
    .join(" ");

  if (!contextText.trim()) {
    return { organizations: [], cities: [], majors: [] };
  }

  return {
    organizations: detectSmartOrganizations(contextText, organizationNames),
    cities: detectSmartCities(contextText, experienceCities),
    majors: detectSmartMajors(contextText, majorValues),
  };
};

const isSmartFollowUpQuestion = (question = "") =>
  smartTextIncludesAny(question, [
    "كيف اقدم",
    "كيف أقدم",
    "طريقة التقديم",
    "التقديم",
    "اقدم",
    "أقدم",
    "قدموا",
    "قدمو",
    "الموقع",
    "الايميل",
    "الإيميل",
    "لينكد",
    "مكافأة",
    "مكافاه",
    "مكافآت",
    "فلوس",
    "راتب",
    "عرض",
    "توظيف",
    "وظيفة",
    "المقابلة",
    "مقابلة",
    "اسئلة",
    "أسئلة",
    "وش السلبيات",
    "السلبيات",
    "المشاكل",
    "التحديات",
    "تنصح",
    "ينصحون",
    "هل تنصح",
    "المهام",
    "المسمى",
    "المسميات",
    "وش اسوي",
    "طبيعة التدريب",
    "البيئة",
    "عن بعد",
    "حضوري",
  ]);

const DEFAULT_SMART_QUOTE_LABELS = [
  "الإيجابيات",
  "التحديات",
  "الخلاصة بعد التدريب",
  "نصيحة للمتدربين",
];

const getSmartQuoteCandidates = (
  experiences = [],
  preferredLabels = DEFAULT_SMART_QUOTE_LABELS
) => {
  return experiences.flatMap((exp) =>
    preferredLabels
      .map((label) => ({
        label,
        organizationName: exp.organizationName,
        text: getSmartSectionValue(exp.description, label),
      }))
      .filter((item) => item.text)
  );
};

const trimSmartQuote = (text = "") => {
  const cleanText = text
    .replace(/\s+/g, " ")
    .replace(/[\u064B-\u065F]+/g, "")
    .replace(/[“”"]/g, "")
    .replace(/([ء-ي])\1{2,}/g, "$1$1")
    .trim();

  if (!cleanText || containsBlockedTerms(cleanText)) return "";

  const words = cleanText.split(/\s+/).filter(Boolean);
  const trimmed = words.slice(0, 22).join(" ");

  return `${trimmed}${words.length > 22 ? "..." : ""}`;
};

const getSmartHumanQuotes = (
  experiences = [],
  limit = 2,
  preferredLabels = DEFAULT_SMART_QUOTE_LABELS
) => {
  const seen = new Set();
  const candidates = getSmartQuoteCandidates(experiences, preferredLabels);
  const priority = preferredLabels.reduce((acc, label, index) => {
    acc[label] = index + 1;
    return acc;
  }, {});

  return candidates
    .map((item) => ({
      ...item,
      text: trimSmartQuote(item.text),
      weight: priority[item.label] || 9,
    }))
    .filter((item) => item.text && item.text.length >= 18)
    .sort((a, b) => a.weight - b.weight || b.text.length - a.text.length)
    .filter((item) => {
      const key = normalizeSearchText(item.text.slice(0, 50));
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit)
    .map((item) => ({
      label:
        item.label === "التحديات"
          ? "ملاحظة من تجربة"
          : item.label === "نصيحة للمتدربين"
          ? "نصيحة من تجربة"
          : "من تجربة منشورة",
      text: item.text,
    }));
};

const buildSmartHumanParagraphs = (experiences = [], filters = {}, intent = "summary") => {
  const averageRating = getAverageRating(experiences);
  const benefited = getFieldRatio(experiences, "benefitedFromTraining");
  const recommended = getFieldRatio(experiences, "wouldRecommend");
  const reward = getFieldRatio(experiences, "hadReward");
  const hired = getFieldRatio(experiences, "wasHired");
  const topMethods = getTopFrequencies(
    experiences.map((exp) => exp.howApplied).filter(isMeaningfulSmartValue),
    3
  );
  const topEnvironments = getTopFrequencies(
    experiences.map((exp) => exp.trainingEnvironment).filter(Boolean),
    2
  );
  const roles = getSmartRoleInsights(experiences);
  const tasks = getSmartTaskInsights(experiences);
  const positiveThemes = getThemeMatches(experiences, SMART_ASSISTANT_POSITIVE_THEMES);
  const problemThemes = getThemeMatches(experiences, SMART_ASSISTANT_PROBLEM_THEMES);
  const subject = getSmartSubjectLabel(filters);
  const tone = getSmartTone(experiences);
  const paragraphs = [];

  const introPieces = [`الصورة العامة عن ${subject} ${tone}`];
  if (averageRating !== null) {
    introPieces.push(`ومتوسط التقييم ${averageRating}/5`);
  }
  paragraphs.push(`${introPieces.join("، ")}.`);

  const benefitText = formatSmartPercent(
    benefited,
    "أن التدريب كان مفيدًا",
    "",
    "التجارب التي وضحت الاستفادة"
  );
  const recommendText = formatSmartPercent(
    recommended,
    "أنها تنصح بالتجربة",
    "",
    "التجارب التي وضحت الترشيح"
  );
  if (benefitText || recommendText) {
    paragraphs.push([benefitText, recommendText].filter(Boolean).join("، ") + ".");
  }

  if (positiveThemes.length > 0) {
    paragraphs.push(
      `أكثر الأشياء الإيجابية التي ظهرت في التجارب: ${positiveThemes
        .map((item) => item.label)
        .join("، ")}.`
    );
  }

  if (problemThemes.length > 0) {
    paragraphs.push(
      `أما الملاحظات المتكررة فكانت حول ${problemThemes
        .map((item) => item.label)
        .join("، ")}. أتعامل معها كمؤشرات عامة لأن التجربة قد تختلف من إدارة لأخرى.`
    );
  }

  if (roles.length > 0 || tasks.length > 0) {
    const roleText = roles.length > 0 ? `أبرز المسميات المذكورة: ${roles.join("، ")}` : "";
    const taskText = tasks.length > 0 ? `ومن المهام أو المجالات المتكررة: ${tasks.join("، ")}` : "";
    paragraphs.push([roleText, taskText].filter(Boolean).join(". ") + ".");
  }

  const practicalSignals = [];
  const rewardText = formatSmartPercent(
    reward,
    "وجود مكافأة",
    "التجارب التي وضحت المكافأة لم تذكر وجود مكافأة",
    "التجارب التي وضحت المكافأة"
  );
  const hiredText = formatSmartPercent(
    hired,
    "وجود عرض وظيفي بعد التدريب",
    "",
    "التجارب التي وضحت العرض الوظيفي"
  );
  if (rewardText) practicalSignals.push(rewardText);
  if (hiredText) practicalSignals.push(hiredText);
  if (topMethods.length > 0) {
    practicalSignals.push(
      `طرق الوصول للفرصة التي تكررت: ${topMethods.map((item) => item.label).join("، ")}`
    );
  }
  if (topEnvironments.length > 0) {
    practicalSignals.push(
      `والبيئة الأكثر ذكرًا: ${
        SMART_ASSISTANT_ENVIRONMENT_LABELS[topEnvironments[0].label] ||
        topEnvironments[0].label
      }`
    );
  }
  if (practicalSignals.length > 0) {
    paragraphs.push(`${practicalSignals.join("، ")}.`);
  }

  if (intent === "exists") {
    paragraphs.push(
      "نعم، توجد تجارب مطابقة لهذا السؤال داخل دربك. الأفضل بعدها تضييق القراءة حسب الجهة أو المدينة إذا كنت تقارن بين أكثر من خيار."
    );
  }

  return paragraphs;
};

const getSmartApplicationDurations = (experiences = []) =>
  getTopFrequencies(
    experiences
      .map((exp) => getSmartSectionValue(exp.description, "مدة إجراءات التقديم"))
      .filter(isMeaningfulSmartValue),
    3
  );

const buildSmartApplicationAnswer = (experiences = [], filters = {}, usedContext = false) => {
  const subject = getSmartSubjectLabel(filters);
  const methods = getTopFrequencies(
    experiences.map((exp) => exp.howApplied).filter(isMeaningfulSmartValue),
    4
  );
  const durations = getSmartApplicationDurations(experiences);
  const paragraphs = [];

  if (methods.length > 0) {
    paragraphs.push(
      `طرق الحصول على الفرصة التي تكررت في تجارب ${subject}: ${methods
        .map((item) => item.label)
        .join("، ")}.`
    );
  } else {
    paragraphs.push(
      `ما لقيت في تجارب ${subject} طريقة تقديم مذكورة بوضوح، لذلك ما أقدر أحدد قناة تقديم مؤكدة من بيانات دربك.`
    );
  }

  if (durations.length > 0) {
    paragraphs.push(
      `مدة إجراءات التقديم التي ظهرت في بعض التجارب: ${durations
        .map((item) => item.label)
        .join("، ")}.`
    );
  }

  paragraphs.push(
    "عمليًا: ابدأ بالقناة الأكثر تكرارًا في التجارب، ثم جرّب الموقع الرسمي أو لينكدإن إذا كانت مذكورة، وجهّز CV وخطاب تدريب مختصر قبل الإرسال."
  );

  return {
    title: `طريقة التقديم على ${subject}`,
    intro: usedContext
      ? `فهمت أنك تقصد نفس الموضوع السابق: ${subject}. راجعت التجارب المرتبطة وركزت على طريقة الوصول للفرصة.`
      : `راجعت ${experiences.length} تجربة مرتبطة بسؤالك وركزت على طريقة الحصول على الفرصة.`,
    paragraphs,
    quotes: getSmartHumanQuotes(experiences, 1, [
      "نصيحة للمتدربين",
      "مدة إجراءات التقديم",
      "الإيجابيات",
    ]),
    closing:
      "لو تبغى قرار أسرع، افتح التجارب المرتبطة وشوف التجارب القريبة من تخصصك لأنها تعطيك قناة التقديم الأنسب.",
    note: "المساعد لا يضيف رابط تقديم من خارج دربك إذا لم يكن موجودًا في التجارب.",
    relatedUrl: getPrimaryRelatedUrl(filters),
  };
};

const buildSmartInterviewAnswer = (experiences = [], filters = {}, usedContext = false) => {
  const subject = getSmartSubjectLabel(filters);
  const interviewExperiences = experiences.filter((exp) =>
    smartTextIncludesAny(exp.description, [
      "مقابلة",
      "اسئلة",
      "أسئلة",
      "تعريفية",
      "هاتفية",
      "اختبار",
    ])
  );

  return {
    title: `المقابلة في ${subject}`,
    intro: usedContext
      ? `أكمل على نفس الموضوع السابق: ${subject}.`
      : `راجعت ${experiences.length} تجربة مرتبطة بسؤالك.`,
    paragraphs:
      interviewExperiences.length > 0
        ? [
            `وجدت ${interviewExperiences.length} تجربة فيها ذكر للمقابلة أو الأسئلة.`,
            "الوصف غالبًا كان مختصرًا، لذلك أتعامل معه كمؤشر وليس كقائمة أسئلة ثابتة.",
          ]
        : [
            `ما لقيت ذكر واضح للمقابلات أو الأسئلة في تجارب ${subject}. هذا لا يعني أنه ما فيه مقابلة؛ فقط يعني أن الطلاب ما كتبوها بوضوح في التجارب الموجودة.`,
          ],
    quotes: getSmartHumanQuotes(interviewExperiences, 2),
    closing:
      "الأفضل تجهز تعريفًا سريعًا بنفسك، سبب اختيارك للجهة، وأمثلة بسيطة من مشاريعك أو مهاراتك.",
    note: "الجواب مبني فقط على التجارب التي ذكرت المقابلة داخل دربك.",
    relatedUrl: getPrimaryRelatedUrl(filters),
  };
};

const buildSmartRecommendationAnswer = (
  experiences = [],
  filters = {},
  usedContext = false
) => {
  const subject = getSmartSubjectLabel(filters);
  const recommended = getFieldRatio(experiences, "wouldRecommend");
  const benefited = getFieldRatio(experiences, "benefitedFromTraining");
  const problemThemes = getThemeMatches(experiences, SMART_ASSISTANT_PROBLEM_THEMES);
  const positiveThemes = getThemeMatches(experiences, SMART_ASSISTANT_POSITIVE_THEMES);
  const paragraphs = [
    `الصورة العامة عن ${subject} ${getSmartTone(experiences)}.`,
  ];

  const recommendText = formatSmartPercent(
    recommended,
    "أنها تنصح بالتجربة",
    "",
    "التجارب التي وضحت الترشيح"
  );
  const benefitText = formatSmartPercent(
    benefited,
    "أن التدريب كان مفيدًا",
    "",
    "التجارب التي وضحت الاستفادة"
  );

  if (recommendText || benefitText) {
    paragraphs.push([recommendText, benefitText].filter(Boolean).join("، ") + ".");
  }

  if (positiveThemes.length > 0) {
    paragraphs.push(
      `النقاط المشجعة التي تكررت: ${positiveThemes
        .map((item) => item.label)
        .join("، ")}.`
    );
  }

  if (problemThemes.length > 0) {
    paragraphs.push(
      `لكن انتبه إلى: ${problemThemes.map((item) => item.label).join("، ")}.`
    );
  }

  return {
    title: `هل أنصحك بـ ${subject}؟`,
    intro: usedContext
      ? `أجاوبك بناءً على نفس الموضوع السابق، وعدد التجارب المطابقة ${experiences.length}.`
      : `بناءً على ${experiences.length} تجربة مطابقة داخل دربك.`,
    paragraphs,
    quotes: getSmartHumanQuotes(experiences, 2),
    closing:
      "إذا تخصصك قريب من التجارب الموجودة فالخيار يبدو أوضح، أما إذا تخصصك مختلف فاقرأ التجارب المرتبطة قبل القرار.",
    note: "هذه ليست توصية نهائية، لكنها قراءة من واقع تجارب الطلاب.",
    relatedUrl: getPrimaryRelatedUrl(filters),
  };
};

const buildSmartTasksAnswer = (experiences = [], filters = {}, usedContext = false) => {
  const subject = getSmartSubjectLabel(filters);
  const roles = getSmartRoleInsights(experiences);
  const tasks = getSmartTaskInsights(experiences);
  const paragraphs = [];

  if (roles.length > 0) {
    paragraphs.push(`أبرز المسميات التي ظهرت في التجارب: ${roles.join("، ")}.`);
  }

  if (tasks.length > 0) {
    paragraphs.push(`طبيعة المهام أو المجالات المتكررة: ${tasks.join("، ")}.`);
  }

  if (paragraphs.length === 0) {
    paragraphs.push(
      `التجارب المرتبطة بـ ${subject} لا تحتوي وصفًا كافيًا للمهام، لكنها قد تفيدك في الانطباع العام وطريقة التقديم.`
    );
  }

  return {
    title: `طبيعة التدريب في ${subject}`,
    intro: usedContext
      ? `فهمت أنك تسأل عن تفاصيل نفس الموضوع السابق.`
      : `راجعت ${experiences.length} تجربة مرتبطة بسؤالك.`,
    paragraphs,
    quotes: getSmartHumanQuotes(experiences, 2),
    closing:
      "إذا تبغى صورة أدق، اقرأ التجارب الأقرب لتخصصك لأن المهام تختلف كثيرًا حسب الإدارة.",
    note: "المهام هنا مستخرجة من أوصاف الطلاب وليست وصفًا رسميًا للجهة.",
    relatedUrl: getPrimaryRelatedUrl(filters),
  };
};

const groupSmartExperiencesByOrganization = (experiences = []) => {
  const groups = new Map();

  experiences.forEach((exp) => {
    const organizationName = (exp.organizationName || "").trim();
    if (!organizationName) return;
    const key = normalizeSearchText(organizationName);

    if (!groups.has(key)) {
      groups.set(key, {
        organizationName,
        experiences: [],
      });
    }

    groups.get(key).experiences.push(exp);
  });

  return Array.from(groups.values());
};

const buildBestOrganizationsAnswer = (experiences = [], filters = {}) => {
  const groups = groupSmartExperiencesByOrganization(experiences)
    .map((group) => {
      const averageRating = getAverageRating(group.experiences) || 0;
      const benefited = getFieldRatio(group.experiences, "benefitedFromTraining");
      const recommended = getFieldRatio(group.experiences, "wouldRecommend");
      const score =
        averageRating * 2 +
        Math.min(group.experiences.length, 10) * 0.25 +
        (benefited?.percent || 0) / 100 +
        (recommended?.percent || 0) / 100;

      return {
        ...group,
        averageRating,
        benefited,
        recommended,
        score,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.experiences.length - a.experiences.length ||
        a.organizationName.localeCompare(b.organizationName, "ar")
    )
    .slice(0, 6);

  return {
    title: "ترشيحات من واقع تجارب دربك",
    intro: `قرأت ${experiences.length} تجربة مطابقة، وطلعت لك الجهات الأقرب لسؤالك بدون الاعتماد على أي مصدر خارجي.`,
    paragraphs: [
      groups.length > 0
        ? "الترشيح هنا ليس إعلانًا عن توفر تدريب حاليًا، لكنه يساعدك تعرف الجهات التي ظهرت بشكل أفضل في تجارب الطلاب."
        : "ما لقيت جهات كافية أرتبها بثقة داخل تجارب دربك.",
    ],
    bullets: groups.map((group) => {
      const benefitText = group.benefited
        ? `، الاستفادة ${group.benefited.percent}%`
        : "";
      const recommendText = group.recommended
        ? `، الترشيح ${group.recommended.percent}%`
        : "";
      return `${group.organizationName}: ${group.experiences.length} تجربة، متوسط التقييم ${group.averageRating || "غير كاف"}/5${benefitText}${recommendText}.`;
    }),
    closing:
      groups.length > 0
        ? "ابدأ بقراءة تجارب أول جهتين أو ثلاث، ثم قارنها بتخصصك ومدينتك قبل التقديم."
        : "",
    note:
      groups.length === 0
        ? "لا توجد جهات كافية للمقارنة ضمن السؤال."
        : "الترتيب مبني على التقييم وعدد التجارب وحقول الاستفادة والترشيح إن وجدت.",
    relatedUrl: getPrimaryRelatedUrl(filters),
  };
};

const buildRewardOrganizationsAnswer = (experiences = [], filters = {}) => {
  const groups = groupSmartExperiencesByOrganization(experiences)
    .map((group) => {
      const reward = getFieldRatio(group.experiences, "hadReward");
      return {
        ...group,
        reward,
      };
    })
    .filter((group) => group.reward && group.reward.yesCount > 0)
    .sort(
      (a, b) =>
        b.reward.percent - a.reward.percent ||
        b.reward.yesCount - a.reward.yesCount ||
        b.experiences.length - a.experiences.length
    )
    .slice(0, 7);

  return {
    title: "المكافآت حسب تجارب دربك",
    intro: `راجعت ${experiences.length} تجربة مطابقة، وركزت فقط على التجارب التي وضحت المكافأة أو ذكرتها بوضوح.`,
    paragraphs: [
      groups.length > 0
        ? "هذه الجهات ظهر فيها ذكر للمكافأة أكثر من غيرها داخل البيانات الموجودة، لكن الأفضل دائمًا التأكد من الجهة قبل التقديم لأن السياسات قد تتغير."
        : "ما لقيت تجارب كافية تقول بوضوح إن فيه مكافأة ضمن نطاق سؤالك.",
    ],
    bullets:
      groups.length > 0
        ? groups.map(
            (group) =>
              `${group.organizationName}: ${group.reward.yesCount} تجربة ذكرت وجود مكافأة من أصل ${group.reward.total} تجربة وضحت المكافأة.`
          )
        : ["لم أجد تجارب كافية تذكر وجود مكافأة ضمن السؤال."],
    quotes: getSmartHumanQuotes(
      experiences.filter((exp) => exp.hadReward === "yes"),
      1
    ),
    closing:
      "اعتبر المكافأة عامل مساعد، لكن لا تخليها العامل الوحيد؛ جودة المهام ووضوح التدريب أهم على المدى الطويل.",
    note: "النتيجة مبنية فقط على التجارب التي عبأت حقل المكافأة أو ذكرتها بوضوح.",
    relatedUrl: getPrimaryRelatedUrl(filters),
  };
};

const buildComparisonAnswer = (allExperiences = [], organizations = []) => {
  const selectedOrganizations = organizations.slice(0, 2);
  const comparisonLines = selectedOrganizations.map((organization) => {
    const experiences = allExperiences.filter((exp) =>
      smartTextIncludesAny(exp.organizationName, organization.terms || organization.values)
    );
    const averageRating = getAverageRating(experiences);
    const benefited = getFieldRatio(experiences, "benefitedFromTraining");
    const reward = getFieldRatio(experiences, "hadReward");
    const problemThemes = getThemeMatches(experiences, SMART_ASSISTANT_PROBLEM_THEMES);

    if (experiences.length === 0) {
      return `${organization.label}: لا توجد تجارب معتمدة كافية في دربك.`;
    }

    return `${organization.label}: ${experiences.length} تجربة، متوسط التقييم ${
      averageRating || "غير كاف"
    }/5${
      benefited ? `، الاستفادة ${benefited.percent}%` : ""
    }${
      reward ? `، وجود مكافأة ${reward.percent}% من التجارب الموضحة` : ""
    }${
      problemThemes.length > 0
        ? `، أبرز الملاحظات: ${problemThemes.map((item) => item.label).join("، ")}`
        : ""
    }.`;
  });

  const relatedExperiences = selectedOrganizations.flatMap((organization) =>
    allExperiences.filter((exp) =>
      smartTextIncludesAny(exp.organizationName, organization.terms || organization.values)
    )
  );

  return {
    title: "مقارنة من واقع تجارب دربك",
    intro: "أقارن لك بناءً على التجارب المعتمدة فقط، لذلك إذا كان عدد التجارب قليلًا فاعتبرها قراءة أولية وليست حكمًا نهائيًا.",
    paragraphs: comparisonLines,
    quotes: getSmartHumanQuotes(relatedExperiences, 2),
    closing:
      "اختيار الجهة الأفضل يعتمد على تخصصك والمدينة ونوع المهام التي تبحث عنها، لذلك اقرأ التجارب المرتبطة قبل القرار.",
    note: "إذا كان عدد التجارب قليلًا، اعتبر المقارنة مؤشرًا أوليًا وليس حكمًا نهائيًا.",
    relatedUrl: selectedOrganizations[0]
      ? `/experiences?company=${encodeURIComponent(selectedOrganizations[0].label)}`
      : "/experiences",
  };
};

const detectSmartIntent = (question = "", organizations = []) => {
  const distinctOrganizationGroups = new Set(
    organizations.map((organization) => organization.groupKey || normalizeSearchText(organization.label))
  );

  if (
    distinctOrganizationGroups.size >= 2 ||
    smartTextIncludesAny(question, ["قارن", "مقارنة", "الفرق"])
  ) {
    return "compare";
  }

  if (
    smartTextIncludesAny(question, [
      "كيف اقدم",
      "كيف أقدم",
      "طريقة التقديم",
      "التقديم",
      "اقدم",
      "أقدم",
      "قدموا",
      "قدمو",
      "كيف حصل",
      "كيف حصلوا",
      "الايميل",
      "الإيميل",
      "لينكد",
    ])
  ) {
    return "apply";
  }

  if (smartTextIncludesAny(question, ["مكافأة", "مكافاه", "مكافآت", "فلوس", "راتب"])) {
    return "reward";
  }

  if (smartTextIncludesAny(question, ["مقابلة", "المقابلة", "اسئلة", "أسئلة", "اختبار"])) {
    return "interview";
  }

  if (smartTextIncludesAny(question, ["مشاكل", "سلبيات", "عيوب", "تحديات", "صعوبات"])) {
    return "problems";
  }

  if (
    smartTextIncludesAny(question, [
      "تنصح",
      "ينصحون",
      "هل تنصح",
      "ترشح",
      "يرشحون",
      "مناسب",
      "كويس",
    ])
  ) {
    return "recommend";
  }

  if (
    smartTextIncludesAny(question, [
      "المهام",
      "وش اسوي",
      "وش يسوون",
      "طبيعة التدريب",
      "المسمى",
      "المسميات",
      "الدور",
    ])
  ) {
    return "tasks";
  }

  if (smartTextIncludesAny(question, ["أفضل", "افضل", "أنسب", "انسب", "رشح", "ترشح"])) {
    return "best";
  }

  if (smartTextIncludesAny(question, ["هل يوجد", "فيه تجارب", "يوجد تجارب", "عندكم"])) {
    return "exists";
  }

  return "summary";
};

const buildSmartAssistantAnswer = ({
  question,
  experiences,
  filters,
  intent,
  usedContext = false,
}) => {
  if (intent === "compare" && filters.organizations.length >= 2) {
    return buildComparisonAnswer(experiences, filters.organizations);
  }

  if (experiences.length === 0) {
    return {
      title: "لا توجد بيانات كافية",
      intro: "حاولت أبحث داخل تجارب دربك المعتمدة، لكن ما لقيت نتيجة تطابق سؤالك بشكل واضح.",
      paragraphs: [
        "ما راح أعطيك جواب من التخمين أو من الإنترنت؛ لأن هدف المساعد يكون صادق مع بيانات المنصة نفسها.",
      ],
      bullets: [
        "جرّب كتابة اسم الجهة بصيغة مختلفة أو اختر تخصصًا/مدينة أوسع.",
        "لن أضيف معلومات من خارج دربك حتى لا أعطيك جوابًا غير موثوق.",
      ],
      note: "النتيجة مبنية فقط على تجارب دربك المعتمدة.",
      relatedUrl: "/experiences",
    };
  }

  if (intent === "best") return buildBestOrganizationsAnswer(experiences, filters);
  if (intent === "reward") return buildRewardOrganizationsAnswer(experiences, filters);
  if (intent === "apply") {
    return buildSmartApplicationAnswer(experiences, filters, usedContext);
  }
  if (intent === "interview") {
    return buildSmartInterviewAnswer(experiences, filters, usedContext);
  }
  if (intent === "recommend") {
    return buildSmartRecommendationAnswer(experiences, filters, usedContext);
  }
  if (intent === "tasks") {
    return buildSmartTasksAnswer(experiences, filters, usedContext);
  }

  if (intent === "problems") {
    const problemThemes = getThemeMatches(experiences, SMART_ASSISTANT_PROBLEM_THEMES);
    return {
      title: "قراءة للتحديات بدون تهويل",
      intro: `وجدت ${experiences.length} تجربة مطابقة، وركزت على الملاحظات المتكررة بدون ذكر أشخاص أو صياغات جارحة.`,
      paragraphs:
        problemThemes.length > 0
          ? [
              `أكثر ما تكرر في التجارب كان حول ${problemThemes
                .map((theme) => theme.label)
                .join("، ")}.`,
              "وجود ملاحظة في تجربة أو تجربتين لا يعني أن كل التدريب سيئ؛ غالبًا التجربة تختلف حسب الإدارة والمشرف والفترة.",
            ]
          : ["ما ظهر نمط واضح للمشاكل في الأوصاف المطابقة، وهذا قد يعني أن التفاصيل المكتوبة قليلة أو عامة."],
      bullets:
        problemThemes.length > 0
          ? problemThemes.map((theme) => `تكرر في الوصف: ${theme.label}.`)
          : ["لم أجد نمطًا واضحًا للمشاكل في أوصاف التجارب المطابقة."],
      quotes: getSmartHumanQuotes(experiences, 2),
      closing:
        "إذا كانت الجهة مهمة لك، اقرأ التجارب حسب التخصص أو القسم قبل ما تبني حكمك النهائي.",
      note: "لا يتم عرض أو استنتاج معلومات عن أشخاص، فقط تلخيص للأنماط المكتوبة في التجارب.",
      relatedUrl: getPrimaryRelatedUrl(filters),
    };
  }

  const subject = getSmartSubjectLabel(filters);
  const paragraphs = buildSmartHumanParagraphs(experiences, filters, intent);
  const quotes = getSmartHumanQuotes(experiences, 2);

  return {
    title:
      intent === "exists"
        ? "نعم، فيه تجارب مرتبطة بسؤالك"
        : `قراءة سريعة عن ${subject}`,
    intro: `بناءً على ${experiences.length} تجربة منشورة في دربك، هذه قراءة مختصرة بلغة بسيطة.`,
    paragraphs,
    quotes,
    bullets: [],
    closing:
      experiences.length >= 6
        ? `إذا كنت تفكر في ${subject}، فالقرار الأفضل يكون بقراءة التجارب القريبة من تخصصك لأن التفاصيل تختلف من قسم لآخر.`
        : `البيانات هنا مفيدة كبداية، لكن عدد التجارب قليل؛ اقرأ التجارب المرتبطة ولا تعتمد على هذه الخلاصة وحدها.`,
    note: "هذا الملخص لا يستخدم الإنترنت ولا أي مصدر خارج قاعدة بيانات دربك.",
    relatedUrl: getPrimaryRelatedUrl(filters),
  };
};

// ===== Middlewares =====
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== MongoDB Connection =====
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
  })
  .catch(err => {
    console.log("❌ MongoDB connection failed:", err);
  });

// Debug مهم جدًا
mongoose.connection.on("connected", () => {
  console.log("🟢 Mongoose connected");
});

mongoose.connection.on("error", (err) => {
  console.log("🔴 Mongoose error:", err);
});

// ===== Routes =====

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'darbak-api' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: mongoose.connection.readyState === 1 });
});

app.get('/api/home-stats', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const approvedFilter = {
      $or: [{ status: "approved" }, { status: { $exists: false } }],
    };

    const [experiencesCount, organizationNames] = await Promise.all([
      Experience.countDocuments(approvedFilter),
      Experience.distinct("organizationName", approvedFilter),
    ]);

    res.json({
      experiencesCount,
      organizationNames: organizationNames.filter(Boolean),
    });
  } catch (err) {
    console.error("❌ Home stats error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/analytics-events', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const eventName = sanitizeAnalyticsText(req.body.eventName, 80);
    if (!eventName) {
      return res.status(400).json({ error: "eventName is required" });
    }

    const event = await AnalyticsEvent.create({
      eventName,
      visitorId: sanitizeAnalyticsText(req.body.visitorId, 90),
      page: sanitizeAnalyticsText(req.body.page, 160),
      deviceType: ["mobile", "tablet", "desktop", "unknown"].includes(
        req.body.deviceType
      )
        ? req.body.deviceType
        : "unknown",
      major: sanitizeAnalyticsText(req.body.major, 120),
      majorCategory: sanitizeAnalyticsText(req.body.majorCategory, 120),
      city: sanitizeAnalyticsText(req.body.city, 80),
      searchQuery: sanitizeAnalyticsText(req.body.searchQuery, 180),
      resultsCount: Number.isFinite(Number(req.body.resultsCount))
        ? Number(req.body.resultsCount)
        : 0,
      metadata: sanitizeAnalyticsMetadata(req.body.metadata),
    });

    res.json({ ok: true, id: event._id });
  } catch (err) {
    console.error("❌ Analytics event error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/smart-assistant/query', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const question = sanitizeAnalyticsText(req.body.question, 500);

    if (!question || normalizeSearchText(question).length < 3) {
      return res.status(400).json({
        error: "اكتب سؤالًا واضحًا عن جهة أو تخصص أو مدينة.",
      });
    }

    if (containsBlockedTerms(question)) {
      return res.status(400).json({
        error: "الرجاء تعديل صياغة السؤال بدون عبارات جارحة.",
      });
    }

    const approvedFilter = getApprovedExperiencesFilter();
    const experiences = await Experience.find(approvedFilter)
      .select(
        [
          "organizationName",
          "city",
          "major",
          "majorCategory",
          "howApplied",
          "duration",
          "trainingYear",
          "wasHired",
          "hadReward",
          "rewardAmount",
          "trainingEnvironment",
          "benefitedFromTraining",
          "wouldRecommend",
          "trainingMode",
          "starRating",
          "ratings",
          "description",
          "title",
          "sourceType",
          "createdAt",
        ].join(" ")
      )
      .sort({ createdAt: -1 })
      .limit(SMART_ASSISTANT_MAX_CANDIDATES)
      .lean();

    const organizationNames = uniqueTruthy(
      experiences.map((exp) => exp.organizationName)
    );
    const experienceCities = uniqueTruthy(experiences.map((exp) => exp.city));
    const majorValues = uniqueTruthy(
      experiences.flatMap((exp) => [exp.major, exp.majorCategory])
    );

    let filters = {
      organizations: detectSmartOrganizations(question, organizationNames),
      cities: detectSmartCities(question, experienceCities),
      majors: detectSmartMajors(question, majorValues),
    };

    const contextFilters = rebuildSmartContextFilters(
      req.body.context || {},
      organizationNames,
      experienceCities,
      majorValues
    );
    const usedContext =
      !hasSmartFilters(filters) &&
      hasSmartFilters(contextFilters) &&
      isSmartFollowUpQuestion(question);

    if (usedContext) {
      filters = contextFilters;
    }

    filters.organizations = filters.organizations.filter(
      (organization) =>
        !filters.majors.some(
          (major) =>
            smartIncludes(organization.label, major.label) ||
            smartIncludes(major.label, organization.label)
        )
    );

    const intent = detectSmartIntent(question, filters.organizations);
    const matchingExperiences =
      filters.organizations.length > 0 ||
      filters.cities.length > 0 ||
      filters.majors.length > 0
        ? experiences.filter((exp) => experienceMatchesSmartFilters(exp, filters))
        : ["best", "problems"].includes(intent)
        ? experiences
        : intent === "reward"
        ? experiences.filter((exp) => exp.hadReward === "yes")
        : [];

    const answer = buildSmartAssistantAnswer({
      question,
      experiences: matchingExperiences,
      filters,
      intent,
      usedContext,
    });

    res.json({
      question,
      intent,
      usedContext,
      count: matchingExperiences.length,
      answer,
      filters: {
        organizations: filters.organizations.map((item) => item.label),
        cities: filters.cities.map((item) => item.label),
        majors: filters.majors.map((item) => item.label),
      },
      relatedUrl: answer.relatedUrl || getPrimaryRelatedUrl(filters),
      relatedLabel: "عرض جميع التجارب المرتبطة",
      experiences: matchingExperiences.slice(0, 6).map(mapSmartExperiencePreview),
      suggestedQuestions: SMART_ASSISTANT_SUGGESTED_QUESTIONS,
      source: "darbak_mongodb_only",
    });
  } catch (err) {
    console.error("❌ Smart assistant error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/subscriptions/verify', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const rawContact = req.body.email || req.body.contact;
    const contact = normalizeSubscriberContact(rawContact);
    const accessCode = normalizeAccessCode(req.body.accessCode);

    if (
      !isValidSubscriberContact(rawContact) ||
      !isValidAccessCode(accessCode)
    ) {
      return res.status(400).json({
        error: "اكتب بريد أو رقم جوال صحيح، ورمز دخول من 4 إلى 12 رقم أو حرف.",
      });
    }

    const subscription = await Subscription.findOne({
      email: contact,
      accessCodeHash: hashAccessCode(contact, accessCode),
      status: "active",
      expiresAt: { $gt: new Date() },
    }).lean();

    if (!subscription) {
      const pendingSubscription = await Subscription.findOne({
        email: contact,
        accessCodeHash: hashAccessCode(contact, accessCode),
        status: "pending",
        provider: "moyasar",
        providerPaymentId: { $ne: "" },
      }).lean();

      if (pendingSubscription) {
        const invoice = await getMoyasarInvoice(pendingSubscription.providerPaymentId);

        if (invoice.status === "paid") {
          const activated = await Subscription.findByIdAndUpdate(
            pendingSubscription._id,
            {
              status: "active",
              expiresAt: addSubscriptionDays(
                getSubscriptionDurationDays(pendingSubscription)
              ),
            },
            { new: true }
          ).lean();

          return res.json({
            active: true,
            contact: activated.email,
            email: activated.email,
            expiresAt: activated.expiresAt,
            planId: activated.planId || "monthly",
            priceSar: getSubscriptionPriceSar(activated),
            durationDays: getSubscriptionDurationDays(activated),
          });
        }

        return res.status(402).json({
          error: "الدفع ما تأكد حتى الآن. إذا دفعت، انتظر لحظات ثم جرّب التفعيل.",
        });
      }

      const existingContact = await Subscription.findOne({
        email: contact,
        status: { $in: ["active", "pending"] },
        expiresAt: { $gt: new Date() },
      })
        .sort({ updatedAt: -1 })
        .lean();

      if (existingContact) {
        return res.status(401).json({
          error:
            "هذا البريد أو الجوال مسجل مسبقًا. استخدم رمز الدخول الصحيح بدل إنشاء اشتراك جديد.",
        });
      }

      return res.status(404).json({
        error: "ما لقينا اشتراك نشط بهذا البريد والرمز.",
      });
    }

    res.json({
      active: true,
      contact: subscription.email,
      email: subscription.email,
      expiresAt: subscription.expiresAt,
      planId: subscription.planId || "monthly",
      priceSar: getSubscriptionPriceSar(subscription),
      durationDays: getSubscriptionDurationDays(subscription),
    });
  } catch (err) {
    console.error("❌ Subscription verify error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/subscriptions/start-checkout', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const rawContact = req.body.email || req.body.contact;
    const contact = normalizeSubscriberContact(rawContact);
    const accessCode = normalizeAccessCode(req.body.accessCode);
    const selectedPlan = getSubscriptionPlan(req.body.planId);

    if (
      !isValidSubscriberContact(rawContact) ||
      !isValidAccessCode(accessCode)
    ) {
      return res.status(400).json({
        error: "اكتب بريد أو رقم جوال صحيح، ورمز دخول من 4 إلى 12 رقم أو حرف قبل تفعيل دربك+.",
      });
    }

    const accessCodeHash = hashAccessCode(contact, accessCode);
    const existingSubscription = await Subscription.findOne({
      email: contact,
      status: { $in: ["active", "pending"] },
      expiresAt: { $gt: new Date() },
    })
      .sort({ updatedAt: -1 })
      .lean();

    if (existingSubscription) {
      if (existingSubscription.accessCodeHash !== accessCodeHash) {
        return res.status(409).json({
          error:
            "هذا البريد أو الجوال مسجل مسبقًا. إذا أنت مشترك سابق، استخدم رمز الدخول الصحيح واضغط دخول مشترك سابق.",
        });
      }

      if (existingSubscription.status === "active") {
        return res.json({
          active: true,
          contact: existingSubscription.email,
          email: existingSubscription.email,
          expiresAt: existingSubscription.expiresAt,
          planId: existingSubscription.planId || "monthly",
          priceSar: getSubscriptionPriceSar(existingSubscription),
          durationDays: getSubscriptionDurationDays(existingSubscription),
        });
      }

      if (
        existingSubscription.provider === "moyasar" &&
        existingSubscription.providerPaymentId
      ) {
        const isSamePendingPlan =
          (existingSubscription.planId || "monthly") === selectedPlan.id;
        const invoice = await getMoyasarInvoice(
          existingSubscription.providerPaymentId
        );

        if (invoice.status === "paid") {
          const activated = await Subscription.findByIdAndUpdate(
            existingSubscription._id,
            {
              status: "active",
              expiresAt: addSubscriptionDays(
                getSubscriptionDurationDays(existingSubscription)
              ),
            },
            { new: true }
          ).lean();

          return res.json({
            active: true,
            contact: activated.email,
            email: activated.email,
            expiresAt: activated.expiresAt,
            planId: activated.planId || "monthly",
            priceSar: getSubscriptionPriceSar(activated),
            durationDays: getSubscriptionDurationDays(activated),
          });
        }

        if (["expired", "failed", "canceled", "cancelled"].includes(invoice.status)) {
          await Subscription.findByIdAndUpdate(existingSubscription._id, {
            status: "cancelled",
          });
        } else if (isSamePendingPlan && invoice.url) {
          return res.json({
            checkoutUrl: invoice.url,
            provider: "moyasar",
            invoiceId: invoice.id || existingSubscription.providerPaymentId,
            planId: existingSubscription.planId || "monthly",
            priceSar: getSubscriptionPriceSar(existingSubscription),
            durationDays: getSubscriptionDurationDays(existingSubscription),
          });
        }
      }
    }

    const successUrl = getSafeSubscriptionReturnUrl(req.body.returnUrl);

    const amountHalalas = Math.round(selectedPlan.priceSar * 100);

    if (MOYASAR_SECRET_KEY) {
      const invoice = await createMoyasarInvoice({
        amountHalalas,
        description: `${selectedPlan.label} للوصول إلى المزايا الرقمية المتقدمة في منصة دربك`,
        callbackUrl: successUrl,
      });

      await Subscription.findOneAndUpdate(
        { email: contact, accessCodeHash },
        {
          email: contact,
          accessCodeHash,
          status: "pending",
          planId: selectedPlan.id,
          priceSar: selectedPlan.priceSar,
          durationDays: selectedPlan.durationDays,
          expiresAt: addSubscriptionDays(selectedPlan.durationDays),
          provider: "moyasar",
          providerPaymentId: invoice.id || "",
        },
        { new: true, upsert: true, runValidators: true }
      );

      return res.json({
        checkoutUrl: invoice.url,
        provider: "moyasar",
        invoiceId: invoice.id,
        planId: selectedPlan.id,
        priceSar: selectedPlan.priceSar,
        durationDays: selectedPlan.durationDays,
      });
    }

    if (SUBSCRIPTION_CHECKOUT_URL) {
      let checkoutUrl = SUBSCRIPTION_CHECKOUT_URL;

      try {
        const url = new URL(SUBSCRIPTION_CHECKOUT_URL);
        url.searchParams.set("email", contact);
        url.searchParams.set("amount", String(selectedPlan.priceSar));
        url.searchParams.set("duration", String(selectedPlan.durationDays));
        url.searchParams.set("plan", selectedPlan.id);
        checkoutUrl = url.toString();
      } catch {
        // Keep custom provider links as-is if they are not parseable URLs.
      }

      await Subscription.findOneAndUpdate(
        { email: contact, accessCodeHash },
        {
          email: contact,
          accessCodeHash,
          status: "pending",
          planId: selectedPlan.id,
          priceSar: selectedPlan.priceSar,
          durationDays: selectedPlan.durationDays,
          expiresAt: addSubscriptionDays(selectedPlan.durationDays),
          provider: "manual",
          providerPaymentId: "",
        },
        { new: true, upsert: true, runValidators: true }
      );

      return res.json({
        checkoutUrl,
        provider: "manual",
        planId: selectedPlan.id,
        priceSar: selectedPlan.priceSar,
        durationDays: selectedPlan.durationDays,
      });
    }

    return res.status(501).json({
      error:
        "مفتاح ميسر التجريبي غير مفعّل بعد. أضيفي MOYASAR_SECRET_KEY في Render للباكند.",
    });
  } catch (err) {
    console.error("❌ Subscription checkout error:", {
      message: err.message,
      statusCode: err.statusCode,
      details: err.details,
    });
    res.status(err.statusCode || 500).json({
      error:
        err.statusCode === 501
          ? err.message
          : getCheckoutErrorMessage(err),
      providerStatus: err.statusCode || null,
      providerMessage: flattenProviderError(err.details),
    });
  }
});

app.post('/api/subscriptions/moyasar/callback', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const invoiceId = req.body.id || req.body.invoice_id || req.query.id;

    if (!invoiceId) {
      return res.status(400).json({ error: "Missing invoice id" });
    }

    const invoice = await getMoyasarInvoice(invoiceId);
    const status = invoice.status || req.body.status;

    if (status !== "paid") {
      if (["expired", "failed", "canceled", "cancelled"].includes(status)) {
        await Subscription.findOneAndUpdate(
          { provider: "moyasar", providerPaymentId: invoiceId },
          { status: "cancelled" }
        );
      }

      return res.json({ ok: true, ignored: true, status });
    }

    const existingSubscription = await Subscription.findOne({
      provider: "moyasar",
      providerPaymentId: invoiceId,
    }).lean();

    if (!existingSubscription) {
      return res.status(404).json({ error: "Subscription not found" });
    }

    const subscription = await Subscription.findByIdAndUpdate(
      existingSubscription._id,
      {
        status: "active",
        expiresAt: addSubscriptionDays(
          getSubscriptionDurationDays(existingSubscription)
        ),
      },
      { new: true }
    ).lean();

    if (!subscription) {
      return res.status(404).json({ error: "Subscription not found" });
    }

    res.json({ ok: true, active: true });
  } catch (err) {
    console.error("❌ Moyasar callback error:", err);
    res.status(err.statusCode || 500).json({
      error: "تعذر تأكيد الدفع من ميسر.",
      details: err.details,
    });
  }
});

app.post('/api/admin/subscriptions', requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const contact = normalizeSubscriberContact(req.body.email || req.body.contact);
    const accessCode = normalizeAccessCode(req.body.accessCode);
    const selectedPlan = getSubscriptionPlan(req.body.planId);
    const days = Number(req.body.days || selectedPlan.durationDays);
    const priceSar = Number(req.body.priceSar || selectedPlan.priceSar);

    if (
      !isValidSubscriberContact(req.body.email || req.body.contact) ||
      !isValidAccessCode(accessCode)
    ) {
      return res.status(400).json({
        error: "اكتب بريد أو رقم جوال صحيح، ورمز دخول من 4 إلى 12 رقم أو حرف.",
      });
    }

    const accessCodeHash = hashAccessCode(contact, accessCode);
    const subscription = await Subscription.findOneAndUpdate(
      { email: contact, accessCodeHash },
      {
        email: contact,
        accessCodeHash,
        status: "active",
        planId: selectedPlan.id,
        priceSar,
        durationDays: days,
        expiresAt: addSubscriptionDays(days),
        provider: req.body.provider || "manual",
        providerPaymentId: req.body.providerPaymentId || "",
      },
      { new: true, upsert: true, runValidators: true }
    ).lean();

    res.json({
      email: subscription.email,
      status: subscription.status,
      expiresAt: subscription.expiresAt,
    });
  } catch (err) {
    console.error("❌ Admin subscription create error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/analytics', requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const { days, rangeLabel, match } = getAnalyticsDateScope(req.query.days);
    const cleanMatch = getCleanAnalyticsMatch(match);
    const allTimeCleanMatch = getCleanAnalyticsMatch({});
    const assistantMatch = {
      ...cleanMatch,
      eventName: "smart_assistant_query",
    };
    const activeWindowMinutes = 5;
    const activeVisitorsMatch = {
      createdAt: {
        $gte: new Date(Date.now() - activeWindowMinutes * 60 * 1000),
      },
      visitorId: { $nin: [null, ""] },
    };

    const [
      rawEvents,
      totalEvents,
      pageVisits,
      allTimePageVisits,
      uniqueVisitors,
      allTimeVisitors,
      activeVisitors,
      sessionDurationStats,
      topEvents,
      topMajors,
      topCities,
      topSearches,
      topPages,
      topDevices,
      topDiagnosis,
      topFears,
      topOrganizations,
      assistantQueries,
      assistantContextUses,
      assistantZeroResultQueries,
      topAssistantIntents,
      topAssistantQuestions,
      hourlyActivity,
      recentEvents,
    ] = await Promise.all([
      AnalyticsEvent.countDocuments(match),
      AnalyticsEvent.countDocuments(cleanMatch),
      AnalyticsEvent.countDocuments({ ...match, eventName: "page_view" }),
      AnalyticsEvent.countDocuments({ eventName: "page_view" }),
      AnalyticsEvent.distinct("visitorId", cleanMatch),
      AnalyticsEvent.distinct("visitorId", allTimeCleanMatch),
      AnalyticsEvent.distinct("visitorId", activeVisitorsMatch),
      AnalyticsEvent.aggregate([
        {
          $match: {
            ...match,
            eventName: "session_duration",
            resultsCount: { $gte: 5, $lte: 3 * 60 * 60 },
            "metadata.sessionId": { $nin: [null, ""] },
          },
        },
        {
          $group: {
            _id: "$metadata.sessionId",
            durationSeconds: { $max: "$resultsCount" },
          },
        },
        {
          $group: {
            _id: null,
            averageSeconds: { $avg: "$durationSeconds" },
            totalSeconds: { $sum: "$durationSeconds" },
            sessions: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            averageSeconds: { $round: ["$averageSeconds", 0] },
            totalSeconds: { $round: ["$totalSeconds", 0] },
            sessions: 1,
          },
        },
      ]),
      getAnalyticsGroup(cleanMatch, "eventName", 12),
      getAnalyticsGroup(cleanMatch, "major", 12),
      getAnalyticsGroup(cleanMatch, "city", 12),
      getAnalyticsSearches(match, 12),
      getAnalyticsGroup(cleanMatch, "page", 12),
      getAnalyticsGroup(cleanMatch, "deviceType", 4),
      AnalyticsEvent.aggregate([
        {
          $match: {
            ...cleanMatch,
            eventName: "diagnosis_completed",
            "metadata.diagnosisName": { $nin: [null, ""] },
          },
        },
        { $group: { _id: "$metadata.diagnosisName", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: 10 },
        { $project: { _id: 0, label: "$_id", count: 1 } },
      ]),
      AnalyticsEvent.aggregate([
        {
          $match: {
            ...cleanMatch,
            eventName: "diagnosis_completed",
            "metadata.fear": { $nin: [null, ""] },
          },
        },
        { $group: { _id: "$metadata.fear", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: 10 },
        { $project: { _id: 0, label: "$_id", count: 1 } },
      ]),
      AnalyticsEvent.aggregate([
        {
          $match: {
            ...cleanMatch,
            "metadata.organizationName": { $nin: [null, ""] },
          },
        },
        { $group: { _id: "$metadata.organizationName", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: 12 },
        { $project: { _id: 0, label: "$_id", count: 1 } },
      ]),
      AnalyticsEvent.countDocuments(assistantMatch),
      AnalyticsEvent.countDocuments({
        ...assistantMatch,
        "metadata.usedContext": true,
      }),
      AnalyticsEvent.countDocuments({
        ...assistantMatch,
        resultsCount: { $lte: 0 },
      }),
      AnalyticsEvent.aggregate([
        {
          $match: {
            ...assistantMatch,
            "metadata.intent": { $nin: [null, ""] },
          },
        },
        { $group: { _id: "$metadata.intent", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: 10 },
        { $project: { _id: 0, label: "$_id", count: 1 } },
      ]),
      AnalyticsEvent.aggregate([
        {
          $match: {
            ...assistantMatch,
            searchQuery: { $nin: [null, ""] },
          },
        },
        {
          $addFields: {
            cleanSearchQuery: {
              $trim: {
                input: "$searchQuery",
              },
            },
          },
        },
        {
          $addFields: {
            searchLength: { $strLenCP: "$cleanSearchQuery" },
          },
        },
        { $match: { searchLength: { $gte: 4 } } },
        { $group: { _id: "$cleanSearchQuery", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: 10 },
        { $project: { _id: 0, label: "$_id", count: 1 } },
      ]),
      AnalyticsEvent.aggregate([
        { $match: cleanMatch },
        {
          $group: {
            _id: { $hour: { date: "$createdAt", timezone: "Asia/Riyadh" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, hour: "$_id", count: 1 } },
      ]),
      AnalyticsEvent.find(cleanMatch)
        .sort({ createdAt: -1 })
        .limit(5)
        .select(
          "eventName page deviceType major city searchQuery resultsCount createdAt"
        )
        .lean(),
    ]);

    res.json({
      days,
      rangeLabel,
      rawEvents,
      totalEvents,
      pageVisits,
      allTimePageVisits,
      uniqueVisitors: uniqueVisitors.filter(Boolean).length,
      allTimeVisitors: allTimeVisitors.filter(Boolean).length,
      activeVisitors: activeVisitors.filter(Boolean).length,
      activeWindowMinutes,
      averageSessionSeconds: sessionDurationStats[0]?.averageSeconds || 0,
      totalSessionSeconds: sessionDurationStats[0]?.totalSeconds || 0,
      sessionDurationSamples: sessionDurationStats[0]?.sessions || 0,
      topEvents,
      topMajors,
      topCities,
      topSearches,
      topPages,
      topDevices,
      topDiagnosis,
      topFears,
      topOrganizations,
      assistantQueries,
      assistantContextUses,
      assistantZeroResultQueries,
      topAssistantIntents,
      topAssistantQuestions,
      hourlyActivity,
      recentEvents,
    });
  } catch (err) {
    console.error("❌ Admin analytics error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/suggestions', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const text = (req.body.text || "").trim();

    if (text.length < 3) {
      return res.status(400).json({ error: "اكتب اقتراحًا واضحًا قبل الإرسال." });
    }

    if (containsBlockedTerms(text)) {
      return res.status(400).json({
        error: "النص يحتوي على عبارات غير مناسبة. الرجاء تعديل الصياغة ثم المحاولة مرة أخرى.",
      });
    }

    const suggestion = await Suggestion.create({ text });
    res.json(suggestion);
  } catch (err) {
    console.error("❌ Error saving suggestion:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/training-targets', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const major = (req.query.major || "").trim();
    const majorCategory = (req.query.majorCategory || "").trim();
    const majorCategories = Array.from(
      new Set(
        [
          majorCategory,
          ...(req.query.majorCategories || "")
            .split(",")
            .map((item) => item.trim()),
        ].filter(Boolean)
      )
    );
    const city = (req.query.city || "").trim();

    if (!major && majorCategories.length === 0) {
      return res.status(400).json({ error: "major or majorCategory is required" });
    }

    const filter = {
      $or: [{ status: "approved" }, { status: { $exists: false } }],
    };

    const majorFilters = [];
    if (major) majorFilters.push({ major });
    if (majorCategories.length > 0) {
      majorFilters.push({ majorCategory: { $in: majorCategories } });
    }

    if (majorFilters.length > 0) {
      filter.$and = [{ $or: majorFilters }];
    }

    if (city) {
      const cityValues = getCityFilterValues(city);
      filter.city =
        cityValues.length > 1 ? { $in: cityValues } : cityValues[0] || city;
    }

    const experiences = await Experience.find(filter)
      .select("organizationName city major majorCategory howApplied")
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    const groupedTargets = new Map();
    const normalizedMajor = normalizeSearchText(major);

    experiences.forEach((exp) => {
      const organizationName = (exp.organizationName || "").trim();
      if (!organizationName) return;

      const key = normalizeSearchText(organizationName);

      if (!groupedTargets.has(key)) {
        groupedTargets.set(key, {
          organizationName,
          cities: new Set(),
          majors: new Set(),
          methods: new Set(),
          count: 0,
          exactMajorCount: 0,
        });
      }

      const target = groupedTargets.get(key);
      target.count += 1;
      if (normalizedMajor && normalizeSearchText(exp.major) === normalizedMajor) {
        target.exactMajorCount += 1;
      }

      if (exp.city) target.cities.add(exp.city);
      const readableMajor = getReadableMajor(exp.major, exp.majorCategory);
      if (readableMajor) target.majors.add(readableMajor);
      if (exp.howApplied) target.methods.add(exp.howApplied);
    });

    const data = Array.from(groupedTargets.values())
      .map((target) => ({
        organizationName: target.organizationName,
        cities: Array.from(target.cities),
        majors: Array.from(target.majors),
        methods: Array.from(target.methods),
        count: target.count,
        exactMajorCount: target.exactMajorCount,
      }))
      .sort(
        (a, b) =>
          b.exactMajorCount - a.exactMajorCount ||
          b.count - a.count ||
          a.organizationName.localeCompare(b.organizationName, "ar")
      )
      .slice(0, 30);

    res.json({ data, total: data.length });
  } catch (err) {
    console.error("❌ Training targets error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/opportunities', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const major = (req.query.major || "").trim();
    const majorCategory = (req.query.majorCategory || "").trim();
    const majorCategories = Array.from(
      new Set(
        [
          majorCategory,
          ...(req.query.majorCategories || "")
            .split(",")
            .map((item) => item.trim()),
        ].filter(Boolean)
      )
    );
    const city = (req.query.city || "").trim();

    const andFilters = [{ status: "active" }];

    if (major || majorCategories.length > 0) {
      andFilters.push({
        $or: [
          ...(major ? [{ specialties: major }] : []),
          ...(majorCategories.length > 0
            ? [{ majorCategories: { $in: majorCategories } }]
            : []),
          { specialties: { $in: GENERAL_SPECIALTY_MARKERS } },
          { majorCategories: { $in: GENERAL_SPECIALTY_MARKERS } },
          { specialties: { $size: 0 }, majorCategories: { $size: 0 } },
        ],
      });
    }

    if (city) {
      const cityValues = getCityFilterValues(city);
      andFilters.push({
        $or: [
          { city: { $in: cityValues } },
          { cities: { $in: cityValues } },
          { city: "" },
          { cities: { $size: 0 } },
          { cities: { $exists: false } },
          { trainingMode: "remote" },
        ],
      });
    }

    const opportunities = await Opportunity.find({ $and: andFilters })
      .sort({ featured: -1, createdAt: -1 })
      .limit(100)
      .lean();

    const sortedOpportunities = opportunities
      .sort((a, b) => {
        const closedDiff =
          Number(isClosedByDeadline(a.deadline)) -
          Number(isClosedByDeadline(b.deadline));
        if (closedDiff !== 0) return closedDiff;

        const featuredDiff = Number(b.featured) - Number(a.featured);
        if (featuredDiff !== 0) return featuredDiff;

        const aDeadline = a.deadline ? new Date(a.deadline).getTime() : Infinity;
        const bDeadline = b.deadline ? new Date(b.deadline).getTime() : Infinity;
        if (aDeadline !== bDeadline) return aDeadline - bDeadline;

        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .slice(0, 60);

    const opportunitiesWithCounts = await attachItemInteractionCounts(
      "opportunity",
      sortedOpportunities
    );

    res.json({
      data: opportunitiesWithCounts,
      total: opportunitiesWithCounts.length,
    });
  } catch (err) {
    console.error("❌ Opportunities fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/opportunities/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid opportunity id" });
    }

    const opportunity = await Opportunity.findOne({
      _id: req.params.id,
      status: "active",
    }).lean();

    if (!opportunity) {
      return res.status(404).json({ error: "Opportunity not found" });
    }

    const [opportunityWithCounts] = await attachItemInteractionCounts(
      "opportunity",
      [opportunity]
    );

    res.json({ data: opportunityWithCounts });
  } catch (err) {
    console.error("❌ Opportunity fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/opportunities', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const payload = sanitizeOpportunityPayload({
      ...req.body,
      status: "draft",
      sourceType: "visitor",
      featured: false,
    });

    if (!payload.organizationName || !payload.title) {
      return res.status(400).json({ error: "اسم الجهة وعنوان الفرصة مطلوبة." });
    }

    const fieldsToCheck = [
      payload.organizationName,
      payload.title,
      payload.city,
      payload.note,
      payload.applicationUrl,
      payload.sourceUrl,
      payload.submitterContact,
      ...payload.cities,
      ...payload.majorCategories,
      ...payload.specialties,
    ];

    if (fieldsToCheck.some(containsBlockedTerms)) {
      return res.status(400).json({
        error: "النص يحتوي على عبارات غير مناسبة. الرجاء تعديل الصياغة.",
      });
    }

    if (!payload.deadline) delete payload.deadline;

    const opportunity = await Opportunity.create({
      ...payload,
      status: "draft",
      sourceType: "visitor",
      featured: false,
    });

    res.json({ message: "تم إرسال الفرصة للمراجعة.", data: opportunity });
  } catch (err) {
    console.error("❌ Public opportunity create error:", err);
    res.status(500).json({ error: err.message });
  }
});

// إنشاء تجربة
app.post('/api/experiences', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const fieldsToCheck = [
      req.body.organizationName,
      req.body.city,
      req.body.majorCategory,
      req.body.major,
      req.body.howApplied,
      req.body.duration,
      req.body.trainingYear,
      req.body.wasHired,
      req.body.hadReward,
      req.body.rewardAmount,
      req.body.trainingEnvironment,
      req.body.benefitedFromTraining,
      req.body.wouldRecommend,
      req.body.trainingMode,
      req.body.description,
    ];

    if (fieldsToCheck.some(containsBlockedTerms)) {
      return res.status(400).json({
        error: "النص يحتوي على عبارات غير مناسبة. الرجاء تعديل الصياغة ثم المحاولة مرة أخرى.",
      });
    }

    if (
      isUnclearMajorText(req.body.majorCategory) ||
      isUnclearMajorText(req.body.major)
    ) {
      return res.status(400).json({
        error: "الرجاء اختيار أو كتابة تخصص واضح بدون رموز أو أرقام فقط.",
      });
    }

    const rewardAmount =
      typeof req.body.rewardAmount === "string" ? req.body.rewardAmount.trim() : "";
    const ambassadorConsent = req.body.ambassadorConsent === "yes" ? "yes" : "no";
    const ambassadorLinkedInUrl =
      ambassadorConsent === "yes"
        ? normalizeLinkedInProfileUrl(req.body.ambassadorLinkedInUrl)
        : "";

    if (ambassadorConsent === "yes" && !ambassadorLinkedInUrl) {
      return res.status(400).json({
        error: "رابط LinkedIn غير صحيح. استخدم رابط ملف شخصي يبدأ بـ linkedin.com/in/ أو اختر البقاء مجهول.",
      });
    }

    const newExp = new Experience({
      ...req.body,
      rewardAmount: req.body.hadReward === "yes" ? rewardAmount : "",
      ambassadorConsent,
      ambassadorLinkedInUrl,
      ambassadorProfileImageUrl: "",
      sourceType: "direct",
      status: "pending",
    });
    await newExp.save();
    res.json(newExp);
  } catch (err) {
    console.error("❌ Error saving experience:", err);
    res.status(500).json({ error: err.message });
  }
});

// جلب التجارب
app.get('/api/experiences', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const requestedLimit = parseInt(req.query.limit, 10) || DEFAULT_EXPERIENCES_LIMIT;
    const limit = Math.min(Math.max(requestedLimit, 1), MAX_EXPERIENCES_LIMIT);
    const skip = (page - 1) * limit;
    const sortOption = req.query.sort || "latest";
    const majors = req.query.majors
      ? req.query.majors.split(",").map((major) => major.trim()).filter(Boolean)
      : [];
    const cityFilter =
      typeof req.query.city === "string" ? req.query.city.trim() : "";
    const searchTerms = req.query.terms
      ? req.query.terms.split("|").map(normalizeSearchText).filter(Boolean)
      : [];
    const rewardFilter = ["yes", "no"].includes(req.query.hadReward)
      ? req.query.hadReward
      : "";
    const environmentFilter = ["mixed", "women", "men"].includes(
      req.query.trainingEnvironment
    )
      ? req.query.trainingEnvironment
      : "";

    const baseFilter = {
      $or: [{ status: "approved" }, { status: { $exists: false } }],
    };
    const andFilters = [];

    if (majors.length > 0) {
      andFilters.push({
        $or: [
          { major: { $in: majors } },
          { majorCategory: { $in: majors } },
        ],
      });
    }

    if (cityFilter) {
      const cityValues = getCityFilterValues(cityFilter);
      andFilters.push({
        city: cityValues.length > 1 ? { $in: cityValues } : cityFilter,
      });
    }

    if (rewardFilter) {
      andFilters.push({ hadReward: rewardFilter });
    }

    if (environmentFilter) {
      andFilters.push({ trainingEnvironment: environmentFilter });
    }

    if (andFilters.length > 0) {
      baseFilter.$and = andFilters;
    }

    const sort =
      sortOption === "rating"
        ? { starRating: -1, createdAt: -1 }
        : { createdAt: -1 };

    let experiences;
    let total;

    if (searchTerms.length > 0) {
      const candidates = await Experience.find(baseFilter).sort(sort).lean();

      const matchesSearch = (exp) => {
        const searchableValues = [
          exp.organizationName,
          exp.companyName,
          exp.majorCategory,
          exp.major,
        ]
          .filter(Boolean)
          .map(normalizeSearchText);

        return searchableValues.some((value) =>
          searchTerms.some((term) => value.includes(term))
        );
      };

      const filtered = candidates.filter(matchesSearch);
      total = filtered.length;
      experiences = filtered.slice(skip, skip + limit);
    } else {
      const [items, count] = await Promise.all([
        Experience.find(baseFilter).sort(sort).skip(skip).limit(limit).lean(),
        Experience.countDocuments(baseFilter),
      ]);

      experiences = items;
      total = count;
    }

    experiences = await attachItemInteractionCounts("experience", experiences);

    console.log("✅ Data fetched:", experiences.length);

    res.json({
      data: experiences,
      page,
      limit,
      total,
      hasMore: skip + experiences.length < total,
    });
  } catch (err) {
    console.error("❌ FULL ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/experiences/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid experience id" });
    }

    const experience = await Experience.findOne({
      _id: req.params.id,
      ...getApprovedExperiencesFilter(),
    }).lean();

    if (!experience) {
      return res.status(404).json({ error: "Experience not found" });
    }

    const [experienceWithCounts] = await attachItemInteractionCounts(
      "experience",
      [experience]
    );

    res.json({ data: experienceWithCounts });
  } catch (err) {
    console.error("❌ Experience fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/experiences', requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const status = ["pending", "approved", "rejected"].includes(req.query.status)
      ? req.query.status
      : "pending";

    const experiences = await Experience.find({ status })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({ data: experiences });
  } catch (err) {
    console.error("❌ Admin fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/suggestions', requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const suggestions = await Suggestion.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({ data: suggestions });
  } catch (err) {
    console.error("❌ Admin suggestions fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/opportunities', requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const status = ["active", "draft", "expired"].includes(req.query.status)
      ? req.query.status
      : "";
    const filter = status ? { status } : {};

    const opportunities = await Opportunity.find(filter)
      .sort({ featured: -1, createdAt: -1 })
      .limit(150)
      .lean();

    res.json({ data: opportunities });
  } catch (err) {
    console.error("❌ Admin opportunities fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/opportunities', requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const payload = sanitizeOpportunityPayload(req.body);

    if (!payload.organizationName || !payload.title) {
      return res.status(400).json({ error: "اسم الجهة وعنوان الفرصة مطلوبة." });
    }

    const fieldsToCheck = [
      payload.organizationName,
      payload.title,
      payload.city,
      payload.note,
      payload.submitterContact,
      ...payload.cities,
      ...payload.majorCategories,
      ...payload.specialties,
    ];

    if (fieldsToCheck.some(containsBlockedTerms)) {
      return res.status(400).json({
        error: "النص يحتوي على عبارات غير مناسبة. الرجاء تعديل الصياغة.",
      });
    }

    if (!payload.deadline) delete payload.deadline;

    const opportunity = await Opportunity.create(payload);
    res.json(opportunity);
  } catch (err) {
    console.error("❌ Admin opportunity create error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/admin/opportunities/:id', requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const payload = sanitizeOpportunityPayload(req.body);

    if (!payload.organizationName || !payload.title) {
      return res.status(400).json({ error: "اسم الجهة وعنوان الفرصة مطلوبة." });
    }

    const fieldsToCheck = [
      payload.organizationName,
      payload.title,
      payload.city,
      payload.note,
      payload.submitterContact,
      ...payload.cities,
      ...payload.majorCategories,
      ...payload.specialties,
    ];

    if (fieldsToCheck.some(containsBlockedTerms)) {
      return res.status(400).json({
        error: "النص يحتوي على عبارات غير مناسبة. الرجاء تعديل الصياغة.",
      });
    }

    const hasDeadline = Boolean(payload.deadline);
    const updatePayload = { ...payload };
    if (!hasDeadline) delete updatePayload.deadline;

    const update = hasDeadline
      ? { $set: updatePayload }
      : { $set: updatePayload, $unset: { deadline: "" } };

    const updated = await Opportunity.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    }).lean();

    if (!updated) {
      return res.status(404).json({ error: "Opportunity not found" });
    }

    res.json(updated);
  } catch (err) {
    console.error("❌ Admin opportunity edit error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/admin/experiences/:id/status', requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const { status, rejectionReason = "" } = req.body;

    if (!["approved", "rejected", "pending"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const updated = await Experience.findByIdAndUpdate(
      req.params.id,
      {
        status,
        reviewedAt: new Date(),
        rejectionReason: status === "rejected" ? rejectionReason.trim() : "",
      },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ error: "Experience not found" });
    }

    res.json(updated);
  } catch (err) {
    console.error("❌ Admin update error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/admin/experiences/:id', requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const allowedFields = [
      "organizationName",
      "city",
      "majorCategory",
      "major",
      "howApplied",
      "duration",
      "trainingYear",
      "wasHired",
      "hadReward",
      "rewardAmount",
      "trainingEnvironment",
      "benefitedFromTraining",
      "wouldRecommend",
      "trainingMode",
      "ambassadorConsent",
      "ambassadorLinkedInUrl",
      "ambassadorProfileImageUrl",
      "starRating",
      "ratings",
      "sourceType",
      "description",
      "rejectionReason",
    ];

    const updates = {};

    allowedFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
    });

    if (typeof updates.rewardAmount === "string") {
      updates.rewardAmount = updates.rewardAmount.trim();
    }

    if (
      Object.prototype.hasOwnProperty.call(updates, "ambassadorConsent") &&
      updates.ambassadorConsent !== "yes"
    ) {
      updates.ambassadorConsent = "no";
      updates.ambassadorLinkedInUrl = "";
      updates.ambassadorProfileImageUrl = "";
    }

    if (typeof updates.ambassadorLinkedInUrl === "string") {
      updates.ambassadorLinkedInUrl = updates.ambassadorLinkedInUrl.trim();
    }

    if (updates.ambassadorConsent === "yes") {
      const normalizedLinkedInUrl = normalizeLinkedInProfileUrl(
        updates.ambassadorLinkedInUrl
      );

      if (!normalizedLinkedInUrl) {
        return res.status(400).json({
          error: "رابط LinkedIn غير صحيح. استخدم رابط ملف شخصي يبدأ بـ linkedin.com/in/ أو اجعل السفير مجهول.",
        });
      }

      updates.ambassadorLinkedInUrl = normalizedLinkedInUrl;
    }

    if (
      Object.prototype.hasOwnProperty.call(updates, "hadReward") &&
      updates.hadReward !== "yes"
    ) {
      updates.rewardAmount = "";
    }

    if (
      Object.prototype.hasOwnProperty.call(updates, "majorCategory") &&
      isUnclearMajorText(updates.majorCategory)
    ) {
      return res.status(400).json({
        error: "الرجاء كتابة تخصص رئيسي واضح بدون رموز أو أرقام فقط.",
      });
    }

    if (
      Object.prototype.hasOwnProperty.call(updates, "major") &&
      isUnclearMajorText(updates.major)
    ) {
      return res.status(400).json({
        error: "الرجاء كتابة تخصص واضح بدون رموز أو أرقام فقط.",
      });
    }

    if (updates.organizationName || updates.city) {
      const current = await Experience.findById(req.params.id).lean();

      if (!current) {
        return res.status(404).json({ error: "Experience not found" });
      }

      const organizationName = updates.organizationName || current.organizationName;
      const city = updates.city || current.city;

      updates.title = city
        ? `تجربتي في ${organizationName} بـ${city}`
        : `تجربتي في ${organizationName}`;
    }

    const updated = await Experience.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).lean();

    if (!updated) {
      return res.status(404).json({ error: "Experience not found" });
    }

    res.json(updated);
  } catch (err) {
    console.error("❌ Admin edit error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/experiences/:id', requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const deleted = await Experience.findByIdAndDelete(req.params.id).lean();

    if (!deleted) {
      return res.status(404).json({ error: "Experience not found" });
    }

    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error("❌ Admin delete error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/opportunities/:id', requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const deleted = await Opportunity.findByIdAndDelete(req.params.id).lean();

    if (!deleted) {
      return res.status(404).json({ error: "Opportunity not found" });
    }

    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error("❌ Admin opportunity delete error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/suggestions/:id', requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const deleted = await Suggestion.findByIdAndDelete(req.params.id).lean();

    if (!deleted) {
      return res.status(404).json({ error: "Suggestion not found" });
    }

    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error("❌ Admin suggestion delete error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
