const express = require('express');
const mongoose = require('mongoose');
const cors = require("cors");
const crypto = require("crypto");
require('dotenv').config();

const Experience = require('./models/Experience');
const Suggestion = require('./models/Suggestion');
const ContactMessage = require('./models/ContactMessage');
const Opportunity = require('./models/Opportunity');
const InterviewQuestion = require('./models/InterviewQuestion');
const AnalyticsEvent = require('./models/AnalyticsEvent');
const Subscription = require('./models/Subscription');
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 3001;
const DEFAULT_EXPERIENCES_LIMIT = 36;
const MAX_EXPERIENCES_LIMIT = 60;
const EXPERIENCE_PUBLIC_FIELDS =
  "organizationName city howApplied duration trainingYear wasHired hadReward rewardAmount trainingEnvironment benefitedFromTraining wouldRecommend trainingMode starRating ratings title sourceType status reviewedAt majorCategory major createdAt updatedAt";
const OPPORTUNITY_PUBLIC_FIELDS =
  "organizationName title city cities majorCategories specialties trainingEnvironment trainingMode hasReward applicationMethod logoUrl deadline status sourceType featured createdAt updatedAt";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SUBSCRIPTION_PRICE_SAR = Number(process.env.SUBSCRIPTION_PRICE_SAR || 5.99);
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
const FREE_DAILY_DETAIL_LIMIT = Number(process.env.FREE_DAILY_DETAIL_LIMIT || 1);
const FREE_DAILY_EXPERIENCE_LIMIT = Number(
  process.env.FREE_DAILY_EXPERIENCE_LIMIT || FREE_DAILY_DETAIL_LIMIT
);
const FREE_DAILY_OPPORTUNITY_LIMIT = Number(
  process.env.FREE_DAILY_OPPORTUNITY_LIMIT || FREE_DAILY_DETAIL_LIMIT
);
const CONTENT_ACCESS_GATE_ENABLED =
  process.env.CONTENT_ACCESS_GATE_ENABLED === "true" ||
  process.env.PREMIUM_GATE_ENABLED === "true";
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
    label: "دربك+ المزايا المتقدمة شهر",
    priceSar: SUBSCRIPTION_PRICE_SAR,
    durationDays: SUBSCRIPTION_DURATION_DAYS,
  },
  one_time_90: {
    id: "one_time_90",
    label: "دربك+ المزايا المتقدمة 3 أشهر",
    priceSar: ONE_TIME_SUBSCRIPTION_PRICE_SAR,
    durationDays: ONE_TIME_SUBSCRIPTION_DURATION_DAYS,
  },
};
const ADMIN_CONTACTS = new Set(
  (process.env.ADMIN_CONTACTS || "")
    .split(",")
    .map((contact) => contact.trim())
    .filter(Boolean)
);
const ADMIN_ACCESS_CODE = (process.env.ADMIN_ACCESS_CODE || "")
  .toString()
  .trim()
  .replace(/\s+/g, "");
const CONTACT_EMAIL_TO = process.env.CONTACT_EMAIL_TO || "info@darbak.space";
const CONTACT_EMAIL_FROM =
  process.env.CONTACT_EMAIL_FROM || "Darbak <no-reply@darbak.space>";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const CONTACT_REASONS = new Set([
  "استفسار عام",
  "مشكلة تقنية",
  "اقتراح تطوير",
  "بلاغ عن محتوى",
  "تعاون أو إعلان",
  "أخرى",
]);
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

const escapeHtml = (value = "") =>
  value
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const sendContactEmail = async ({ reason = "", message = "", contact = "" } = {}) => {
  if (!RESEND_API_KEY || typeof fetch !== "function") {
    return { emailStatus: "not_configured", emailError: "" };
  }

  const text = [
    "وصلت رسالة تواصل جديدة من منصة دربك.",
    "",
    `سبب التواصل: ${reason}`,
    contact ? `وسيلة الرد: ${contact}` : "وسيلة الرد: غير مذكورة",
    "",
    "الرسالة:",
    message,
  ].join("\n");

  const payload = {
    from: CONTACT_EMAIL_FROM,
    to: [CONTACT_EMAIL_TO],
    subject: `رسالة تواصل من دربك - ${reason || "بدون سبب"}`,
    text,
    html: `
      <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;color:#111827">
        <h2 style="margin:0 0 12px">رسالة تواصل جديدة من دربك</h2>
        <p><strong>سبب التواصل:</strong> ${escapeHtml(reason)}</p>
        <p><strong>وسيلة الرد:</strong> ${escapeHtml(contact || "غير مذكورة")}</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0" />
        <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
      </div>
    `,
  };

  if (isValidEmail(contact)) {
    payload.reply_to = normalizeEmail(contact);
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    return {
      emailStatus: "failed",
      emailError: errorBody.slice(0, 600) || `Resend status ${response.status}`,
    };
  }

  return { emailStatus: "sent", emailError: "" };
};

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

const isAdminContact = (contact = "", accessCode = "") => {
  const normalizedContact = normalizeSubscriberContact(contact);
  if (!normalizedContact || !ADMIN_ACCESS_CODE) return false;

  return (
    normalizeAccessCode(accessCode) === normalizeAccessCode(ADMIN_ACCESS_CODE) &&
    Array.from(ADMIN_CONTACTS).some(
      (adminContact) => normalizeSubscriberContact(adminContact) === normalizedContact
    )
  );
};

const isAdminSubscriptionHash = (contact = "", accessCodeHash = "") =>
  Boolean(
    ADMIN_ACCESS_CODE &&
      accessCodeHash &&
      isAdminContact(contact, ADMIN_ACCESS_CODE) &&
      hashAccessCode(contact, ADMIN_ACCESS_CODE) === accessCodeHash
  );

const getRiyadhDateKey = (value = new Date()) => {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const partMap = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${partMap.year}-${partMap.month}-${partMap.day}`;
};

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

const getActiveSubscriptionFilter = (contact, accessCodeHash) => ({
  email: normalizeSubscriberContact(contact),
  ...(accessCodeHash ? { accessCodeHash } : {}),
  status: "active",
  expiresAt: { $gt: new Date() },
});

const sanitizeVisitorId = (value = "") =>
  value.toString().trim().replace(/[^\w:-]/g, "").slice(0, 90);

const sanitizeAccessItemKey = (value = "") =>
  value.toString().trim().replace(/[^\w:.-]/g, "").slice(0, 140);

const getAccessItemType = (itemKey = "") =>
  sanitizeAccessItemKey(itemKey).split(":")[0] || "general";

const getFreeDailyLimitForItem = (itemKey = "") => {
  const itemType = getAccessItemType(itemKey);

  if (itemType === "experience") return Math.max(0, FREE_DAILY_EXPERIENCE_LIMIT);
  if (itemType === "opportunity") return Math.max(0, FREE_DAILY_OPPORTUNITY_LIMIT);

  return Math.max(0, FREE_DAILY_DETAIL_LIMIT);
};

const ensureAccessUser = async ({ contact = "", accessCode = "", visitorId = "" } = {}) => {
  const normalizedContact = normalizeSubscriberContact(contact);
  const normalizedCode = normalizeAccessCode(accessCode);
  const accessCodeHash =
    normalizedContact && normalizedCode
      ? hashAccessCode(normalizedContact, normalizedCode)
      : "";
  const cleanVisitorId = sanitizeVisitorId(visitorId);

  const isContactIdentity =
    isValidSubscriberContact(normalizedContact) && isValidAccessCode(normalizedCode);

  if (isContactIdentity) {
    return User.findOneAndUpdate(
      { contact: normalizedContact, accessCodeHash },
      {
        $set: {
          contact: normalizedContact,
          accessCodeHash,
          ...(isAdminContact(normalizedContact, normalizedCode)
            ? { isAdmin: true }
            : {}),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  }

  if (!cleanVisitorId) return null;

  return User.findOneAndUpdate(
    { visitorId: cleanVisitorId },
    {
      $setOnInsert: {
        visitorId: cleanVisitorId,
        contact: "",
        accessCodeHash: "",
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

const syncSubscriptionUser = async (subscription = {}) => {
  if (!subscription?.email || !subscription?.accessCodeHash) return null;

  const isActive =
    subscription.status === "active" &&
    subscription.expiresAt &&
    new Date(subscription.expiresAt) > new Date();

  return User.findOneAndUpdate(
    {
      contact: normalizeSubscriberContact(subscription.email),
      accessCodeHash: subscription.accessCodeHash,
    },
    {
      $set: {
        contact: normalizeSubscriberContact(subscription.email),
        accessCodeHash: subscription.accessCodeHash,
        isPremium: Boolean(isActive),
        isAdmin: isAdminSubscriptionHash(
          subscription.email,
          subscription.accessCodeHash
        ),
        premiumExpiresAt: subscription.expiresAt,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

const getAccessIdentityFromRequest = (req = {}) => ({
  contact:
    req.body?.email ||
    req.body?.contact ||
    req.query?.email ||
    req.query?.contact ||
    req.get?.("x-darbak-contact") ||
    "",
  accessCode:
    req.body?.accessCode ||
    req.query?.accessCode ||
    req.get?.("x-darbak-access-code") ||
    "",
  visitorId:
    req.body?.visitorId ||
    req.query?.visitorId ||
    req.get?.("x-darbak-visitor-id") ||
    "",
  itemKey:
    req.body?.itemKey ||
    req.query?.itemKey ||
    req.get?.("x-darbak-item-key") ||
    "",
});

const shouldEnforceContentAccess = (req = {}) =>
  CONTENT_ACCESS_GATE_ENABLED || req.get?.("x-darbak-access-gate") === "true";

const evaluateContentAccess = async ({
  contact: rawContact = "",
  accessCode: rawAccessCode = "",
  visitorId: rawVisitorId = "",
  itemKey: rawItemKey = "",
  consumeFreeView = false,
} = {}) => {
  const accessCode = normalizeAccessCode(rawAccessCode || "");
  const visitorId = sanitizeVisitorId(rawVisitorId || "");
  const itemKey = sanitizeAccessItemKey(rawItemKey || "");
  const hasContactIdentity = Boolean(rawContact || accessCode);

  if (
    hasContactIdentity &&
    (!isValidSubscriberContact(rawContact) || !isValidAccessCode(accessCode))
  ) {
    return {
      granted: false,
      statusCode: 400,
      reason: "invalid_identity",
      error: "اكتب بريد أو رقم جوال صحيح، ورمز دخول من 4 إلى 12 رقم أو حرف.",
    };
  }

  if (!hasContactIdentity && !visitorId) {
    return {
      granted: false,
      statusCode: 400,
      reason: "missing_identity",
      error: "تعذر تحديد حسابك أو جهازك للتحقق من الوصول.",
    };
  }

  const contact = normalizeSubscriberContact(rawContact);
  const accessCodeHash =
    hasContactIdentity ? hashAccessCode(contact, accessCode) : "";
  let user = await ensureAccessUser({
    contact,
    accessCode,
    visitorId,
  });

  if (!user) {
    return {
      granted: false,
      statusCode: 400,
      reason: "missing_user",
      error: "تعذر تجهيز حساب الوصول.",
    };
  }

  const activeSubscription =
    hasContactIdentity && contact && accessCodeHash
      ? await Subscription.findOne(
          getActiveSubscriptionFilter(contact, accessCodeHash)
        ).lean()
      : null;

  if (activeSubscription) {
    user = await syncSubscriptionUser(activeSubscription);
  }

  const now = new Date();
  const isAdmin = Boolean(user?.isAdmin) || isAdminContact(contact, accessCode);
  const hasManualPremium =
    user?.isPremium &&
    (!user.premiumExpiresAt || new Date(user.premiumExpiresAt) > now);
  const isPremium = Boolean(activeSubscription) || hasManualPremium;

  if (isAdmin) {
    return {
      granted: true,
      accessType: "admin",
      isAdmin: true,
      isPremium: true,
      dailyLimit: FREE_DAILY_DETAIL_LIMIT,
    };
  }

  if (isPremium) {
    return {
      granted: true,
      accessType: "premium",
      isAdmin: false,
      isPremium: true,
      expiresAt: activeSubscription?.expiresAt || user.premiumExpiresAt,
      dailyLimit: FREE_DAILY_DETAIL_LIMIT,
    };
  }

  const todayKey = getRiyadhDateKey(now);
  const itemType = getAccessItemType(itemKey);
  const dailyLimit = getFreeDailyLimitForItem(itemKey);
  const isSameDay = user.lastViewedDate === todayKey;
  const dailyItemKeys = isSameDay
    ? Array.isArray(user.dailyViewItemKeys)
      ? user.dailyViewItemKeys
      : []
    : [];
  const typeItemKeys = itemKey
    ? dailyItemKeys.filter((key) => getAccessItemType(key) === itemType)
    : [];
  const currentCount = itemKey
    ? new Set(typeItemKeys).size
    : isSameDay
      ? Number(user.dailyViewsCount || 0)
      : 0;
  const hasSameItemAccess = Boolean(
    itemKey &&
      isSameDay &&
      (dailyItemKeys.includes(itemKey) || user.lastViewedItemKey === itemKey)
  );

  if (hasSameItemAccess) {
    return {
      granted: true,
      accessType: "free_daily",
      isAdmin: false,
      isPremium: false,
      dailyLimit,
      viewsUsed: currentCount,
      remainingViews: Math.max(dailyLimit - currentCount, 0),
      itemKey,
    };
  }

  if (!consumeFreeView || currentCount >= dailyLimit) {
    return {
      granted: false,
      statusCode: 402,
      reason: "daily_limit",
      accessType: "limited",
      isAdmin: false,
      isPremium: false,
      dailyLimit,
      viewsUsed: currentCount,
      remainingViews: 0,
      message:
        "استخدمت المشاهدة المجانية لهذا القسم اليوم. فعّل دربك+ للوصول الكامل لبقية التفاصيل.",
    };
  }

  const nextItemKeys = itemKey
    ? Array.from(new Set([...dailyItemKeys, itemKey]))
    : dailyItemKeys;
  const nextTypeCount = itemKey
    ? nextItemKeys.filter((key) => getAccessItemType(key) === itemType).length
    : currentCount + 1;
  const updatedUser = await User.findByIdAndUpdate(
    user._id,
    {
      lastViewedDate: todayKey,
      dailyViewsCount: itemKey ? nextItemKeys.length : currentCount + 1,
      lastViewedItemKey: itemKey,
      dailyViewItemKeys: nextItemKeys,
    },
    { new: true }
  ).lean();

  return {
    granted: true,
    accessType: "free_daily",
    isAdmin: false,
    isPremium: false,
    dailyLimit,
    viewsUsed: nextTypeCount,
    remainingViews: Math.max(
      dailyLimit - nextTypeCount,
      0
    ),
    itemKey,
  };
};

const sendAccessDeniedResponse = (res, accessDecision = {}) =>
  res.status(accessDecision.statusCode || 402).json({
    granted: false,
    reason: accessDecision.reason || "daily_limit",
    accessType: accessDecision.accessType || "limited",
    isAdmin: Boolean(accessDecision.isAdmin),
    isPremium: Boolean(accessDecision.isPremium),
    dailyLimit: accessDecision.dailyLimit ?? FREE_DAILY_DETAIL_LIMIT,
    viewsUsed: accessDecision.viewsUsed || 0,
    remainingViews: accessDecision.remainingViews || 0,
    message:
      accessDecision.message ||
      accessDecision.error ||
      "فعّل دربك+ للوصول الكامل للتفاصيل.",
    error:
      accessDecision.error ||
      accessDecision.message ||
      "فعّل دربك+ للوصول الكامل للتفاصيل.",
  });

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
  successUrl,
  backUrl,
}) => {
  const body = {
    amount: amountHalalas,
    currency: "SAR",
    description,
    callback_url: callbackUrl,
    success_url: successUrl,
    back_url: backUrl || successUrl,
  };

  return callMoyasar("/invoices", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
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

const normalizeInterviewQuestions = (value) => {
  const rawItems = Array.isArray(value)
    ? value
    : typeof value === "string"
    ? value.split(/\n+|[؛;]+/)
    : [];

  const seen = new Set();

  return rawItems
    .map((item) =>
      item
        .toString()
        .replace(/^[\s\d٠-٩.)(-]+/g, "")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter((item) => item.length >= 3)
    .filter((item) => {
      const key = normalizeSearchText(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 20);
};

const sanitizeInterviewQuestionPayload = (body = {}) => ({
  organizationName: (body.organizationName || "").toString().trim(),
  city: (body.city || "").toString().trim(),
  majorCategory: (body.majorCategory || "").toString().trim(),
  major: (body.major || "").toString().trim(),
  questions: normalizeInterviewQuestions(body.questions || body.interviewQuestions),
  note: (body.note || "").toString().trim(),
});

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

const recordPremiumAccessVerifiedEvent = async ({
  subscription,
  visitorId = "",
  source = "",
} = {}) => {
  const providerPaymentId = subscription?.providerPaymentId || "";

  if (
    !subscription ||
    subscription.provider !== "moyasar" ||
    !providerPaymentId ||
    subscription.status !== "active"
  ) {
    return null;
  }

  const cleanVisitorId = sanitizeAnalyticsText(visitorId, 90);
  const existingEvent = await AnalyticsEvent.findOne({
    eventName: "premium_access_verified",
    "metadata.providerPaymentId": providerPaymentId,
  });

  if (existingEvent) {
    if (cleanVisitorId && !existingEvent.visitorId) {
      existingEvent.visitorId = cleanVisitorId;
      existingEvent.metadata = {
        ...(existingEvent.metadata || {}),
        source: source || existingEvent.metadata?.source || "",
      };
      await existingEvent.save();
    }

    return existingEvent;
  }

  return AnalyticsEvent.create({
    eventName: "premium_access_verified",
    visitorId: cleanVisitorId,
    page: "/subscriptions/moyasar",
    deviceType: "unknown",
    metadata: sanitizeAnalyticsMetadata({
      provider: "moyasar",
      providerPaymentId,
      planId: subscription.planId || "monthly",
      priceSar: getSubscriptionPriceSar(subscription),
      durationDays: getSubscriptionDurationDays(subscription),
      source,
    }),
  });
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
  engagement: 0,
  organizationEngagement: 0,
  views: 0,
  details: 0,
  applies: 0,
  saves: 0,
});

const getOrganizationNameVariants = (value = "") => {
  const rawText = value?.toString?.() || "";
  const normalizedFull = normalizeSearchText(
    rawText.replace(/[()]/g, " ")
  );
  const parts = rawText
    .split(/[|/،,()\-–—]+/)
    .map(normalizeSearchText)
    .filter((part) => part.length >= 2);

  return Array.from(
    new Set([normalizeSearchText(rawText), normalizedFull, ...parts])
  ).filter((name) => name.length >= 2);
};

const isSameOrganizationName = (firstName = "", secondName = "") => {
  if (!firstName || !secondName) return false;
  if (firstName === secondName) return true;

  return (
    firstName.length >= 3 &&
    secondName.length >= 3 &&
    (firstName.includes(secondName) || secondName.includes(firstName))
  );
};

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

const getOrganizationInteractionStats = async (items = []) => {
  const wantedNames = Array.from(
    new Set(
      items
        .flatMap((item) => [
          item?.organizationName,
          item?.companyName,
          item?.title,
        ])
        .flatMap(getOrganizationNameVariants)
        .filter((name) => name.length >= 2)
    )
  );

  if (wantedNames.length === 0) return new Map();

  const rows = await AnalyticsEvent.aggregate([
    {
      $match: {
        eventName: { $ne: "session_ping" },
        "metadata.organizationName": { $nin: [null, ""] },
      },
    },
    {
      $group: {
        _id: "$metadata.organizationName",
        count: { $sum: 1 },
      },
    },
  ]);

  const normalizedRows = rows
    .map((row) => ({
      key: normalizeSearchText(row._id),
      variants: getOrganizationNameVariants(row._id),
      count: Number(row.count) || 0,
    }))
    .filter((row) => row.key.length >= 2);

  return wantedNames.reduce((statsMap, wantedName) => {
    const total = normalizedRows.reduce((sum, row) => {
      const isSameOrganization = row.variants.some((variant) =>
        isSameOrganizationName(wantedName, variant)
      );

      return isSameOrganization ? sum + row.count : sum;
    }, 0);

    statsMap.set(wantedName, total);
    return statsMap;
  }, new Map());
};

const attachItemInteractionCounts = async (itemType, items = []) => {
  const safeItems = Array.isArray(items) ? items : [];
  const [stats, organizationStats] = await Promise.all([
    getItemInteractionStats(
      itemType,
      safeItems.map((item) => item?._id)
    ),
    getOrganizationInteractionStats(safeItems),
  ]);

  return safeItems.map((item) => {
    const itemStats =
      stats.get(item._id?.toString()) || getEmptyItemInteractionStats();
    const organizationNames = getOrganizationNameVariants(
      item.organizationName || item.companyName || item.title || ""
    );
    const organizationEngagement = Math.max(
      0,
      ...organizationNames.map((name) => organizationStats.get(name) || 0)
    );
    const engagement = Math.max(itemStats.total, organizationEngagement);

    return {
      ...item,
      interactionStats: {
        ...itemStats,
        organizationEngagement,
        engagement,
        total: engagement,
      },
      interactionCount: engagement,
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

const getPremiumEventAnalytics = (match, premiumEventNames = []) =>
  AnalyticsEvent.aggregate([
    {
      $match: {
        $and: [
          {
            ...match,
            eventName: { $in: premiumEventNames },
          },
          {
            $or: [
              {
                eventName: {
                  $nin: [
                    "premium_checkout_started",
                    "premium_payment_returned",
                    "premium_access_verified",
                  ],
                },
              },
              {
                $and: [
                  {
                    eventName: {
                      $in: [
                        "premium_checkout_started",
                        "premium_payment_returned",
                        "premium_access_verified",
                      ],
                    },
                  },
                  { "metadata.providerPaymentId": { $exists: true, $ne: "" } },
                ],
              },
            ],
          },
        ],
      },
    },
    {
      $addFields: {
        analyticsDedupeKey: {
          $cond: [
            {
              $and: [
                {
                  $in: [
                    "$eventName",
                    [
                      "premium_checkout_started",
                      "premium_payment_returned",
                      "premium_access_verified",
                    ],
                  ],
                },
                { $ne: ["$metadata.providerPaymentId", null] },
                { $ne: ["$metadata.providerPaymentId", ""] },
              ],
            },
            "$metadata.providerPaymentId",
            { $toString: "$_id" },
          ],
        },
      },
    },
    {
      $group: {
        _id: {
          eventName: "$eventName",
          dedupeKey: "$analyticsDedupeKey",
        },
        visitorId: { $first: "$visitorId" },
      },
    },
    {
      $group: {
        _id: "$_id.eventName",
        count: { $sum: 1 },
        uniqueVisitorIds: { $addToSet: "$visitorId" },
      },
    },
    {
      $project: {
        _id: 0,
        label: "$_id",
        count: 1,
        uniqueVisitors: {
          $size: {
            $filter: {
              input: "$uniqueVisitorIds",
              as: "visitorId",
              cond: {
                $and: [
                  { $ne: ["$$visitorId", null] },
                  { $ne: ["$$visitorId", ""] },
                ],
              },
            },
          },
        },
      },
    },
    { $sort: { count: -1, label: 1 } },
  ]);

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
  "أنا ضايع/ة وما أعرف من وين أبدأ، وش أسوي؟",
  "كيف أكتب إيميل تقديم للتدريب؟",
  "أفضل جهات التدريب لتخصص علوم الحاسب بالرياض؟",
  "كيف أستعد للمقابلة؟",
  "ماذا قال الطلاب عن تدريب STC؟",
  "وش أهم شيء أشيك عليه قبل أختار جهة؟",
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

const getSmartGuidanceRelatedUrl = (filters = {}) =>
  hasSmartFilters(filters) ? getPrimaryRelatedUrl(filters) : "/where-to-train";

const getSmartGuidanceRelatedLabel = (filters = {}) =>
  hasSmartFilters(filters)
    ? "عرض التجارب المرتبطة"
    : "افتح صفحة وين أتدرب";

const buildSmartEmailCoachAnswer = (experiences = [], filters = {}, usedContext = false) => {
  const subject = hasSmartFilters(filters)
    ? getSmartSubjectLabel(filters)
    : "التقديم على التدريب";
  const methods = getTopFrequencies(
    experiences.map((exp) => exp.howApplied).filter(isMeaningfulSmartValue),
    3
  );
  const bullets = [
    "العنوان: طلب تدريب تعاوني - اسمك - تخصصك.",
    "ابدأ بتعريف مختصر: اسمك، جامعتك، تخصصك، ومدة التدريب المطلوبة.",
    "اكتب سبب اختيار الجهة بجملة واحدة صادقة ومباشرة.",
    "ارفق CV وخطاب التدريب أو المتطلبات الرسمية من الجامعة.",
    "اختم بطلب واضح: أرجو إفادتي بإمكانية التدريب أو الجهة المناسبة للتواصل.",
  ];

  return {
    title: "خلّينا نرتب إيميل التقديم",
    hideCount: !hasSmartFilters(filters),
    intro: usedContext
      ? `فهمت أنك تقصد ${subject}. خلّيني أعطيك طريقة إرسال واضحة ومختصرة.`
      : "أفضل إيميل تدريب هو اللي يكون قصير، واضح، ومرفقاته جاهزة. لا يحتاج يكون طويل أو رسمي بزيادة.",
    paragraphs: [
      methods.length > 0
        ? `من تجارب دربك، أكثر طرق الوصول للفرصة التي تكررت هنا: ${methods
            .map((item) => item.label)
            .join("، ")}. إذا كان الإيميل ضمنها فابدأ به، وإذا لم يكن مذكورًا استخدمه كخطة ثانية بعد الموقع الرسمي.`
        : "إذا ما عندك قناة تقديم واضحة، ابدأ بالموقع الرسمي، ثم جرّب إيميل الموارد البشرية أو القسم، وبعدها لينكدإن برسالة مختصرة.",
      "لا ترسل رسالة عامة جدًا. الجهة تحتاج تفهم بسرعة: من أنت؟ ماذا تريد؟ ومتى يبدأ تدريبك؟",
    ],
    bullets,
    quotes: getSmartHumanQuotes(experiences, 1, ["نصيحة للمتدربين", "مدة إجراءات التقديم"]),
    closing:
      "إذا كتبت الإيميل بهذه الطريقة، تزيد فرصة أن الشخص يرد عليك أو يحولك للمسار الصحيح بدل ما تضيع رسالتك.",
    note: "هذا إرشاد عملي من دربك، ولا يعتمد على البحث في الإنترنت.",
    relatedUrl: getSmartGuidanceRelatedUrl(filters),
    relatedLabel: getSmartGuidanceRelatedLabel(filters),
  };
};

const buildSmartCvCoachAnswer = (experiences = [], filters = {}) => {
  const subject = hasSmartFilters(filters) ? getSmartSubjectLabel(filters) : "التدريب";

  return {
    title: "خلّينا نضبط الـ CV للتدريب",
    hideCount: !hasSmartFilters(filters),
    intro: `للـ ${subject}، أهم شيء أن السيرة تكون واضحة وسريعة القراءة. لا تحاول تثبت كل شيء؛ ركز على الشيء المرتبط بالفرصة.`,
    paragraphs: [
      "خلي أول نصف صفحة يجاوب على سؤال: من أنت، وش تخصصك، وش المهارات أو المشاريع التي تخليك مناسب للتدريب؟",
      "إذا ما عندك خبرة، عادي. عوّضها بمشاريع الجامعة، أدوات تعرف تستخدمها، مواد قوية درستها، وشهادات قصيرة إن وجدت.",
    ],
    bullets: [
      "اكتب الهدف: طالب/ـة يبحث عن تدريب تعاوني في مجال محدد.",
      "رتب المهارات حسب التخصص: تقنية، تحليل، تصميم، محاسبة، تواصل... إلخ.",
      "أضف مشروعين أو ثلاثة مع نتيجة واضحة لكل مشروع.",
      "لا تكثر ألوان وتنسيقات؛ خله نظيف ومقروء.",
      "احفظه PDF وسمّه باسمك وتخصصك.",
    ],
    closing:
      "السيرة الجيدة ما تعني أنك كامل؛ تعني أن الجهة فهمت بسرعة كيف ممكن تستفيد منك كمتدرب.",
    note: "النصيحة هنا عامة ومناسبة للتقديم، وليست حكمًا على قبول جهة محددة.",
    relatedUrl: getSmartGuidanceRelatedUrl(filters),
    relatedLabel: getSmartGuidanceRelatedLabel(filters),
  };
};

const buildSmartStartPlanAnswer = (experiences = [], filters = {}) => {
  const subject = hasSmartFilters(filters) ? getSmartSubjectLabel(filters) : "بداية البحث عن تدريب";
  const topMethods = getTopFrequencies(
    experiences.map((exp) => exp.howApplied).filter(isMeaningfulSmartValue),
    3
  );

  return {
    title: "نبدأها بهدوء، مو لازم تعرف كل شيء الآن",
    hideCount: !hasSmartFilters(filters),
    intro: `إذا أنت في مرحلة ${subject}، فالمطلوب الآن ليس أنك تلقى أفضل جهة فورًا؛ المطلوب أنك تبدأ بخطوة منظمة.`,
    paragraphs: [
      topMethods.length > 0
        ? `في تجارب دربك، طرق الوصول التي تكررت أكثر: ${topMethods
            .map((item) => item.label)
            .join("، ")}. خذها كبداية بحث بدل ما تبدأ من الصفر.`
        : "ابدأ بثلاث مسارات معًا: صفحة وين أتدرب، مواقع الجهات، ولينكدإن أو الإيميل المباشر.",
      "لا تنتظر إعلان واحد مثالي. جهّز قائمة جهات، أرسل على دفعات، وسجل وين قدمت ومتى.",
    ],
    bullets: [
      "حدد تخصصك والمدينة في صفحة وين أتدرب.",
      "افتح 10 جهات مناسبة واحفظها.",
      "جهز CV وخطاب التدريب.",
      "قدّم من الموقع إن وجد، ثم أرسل إيميل مختصر.",
      "بعد 5 إلى 7 أيام تابع بلطف إذا ما جاء رد.",
    ],
    closing:
      "الفرق غالبًا ليس أن شخص يعرف جهة سرية؛ الفرق أنه بدأ بدري، نظم طلباته، وتابع بدون عشوائية.",
    note: "دربك يساعدك تبدأ من تجارب الطلاب والجهات المقترحة، لكنه لا يضمن توفر تدريب حاليًا.",
    relatedUrl: getSmartGuidanceRelatedUrl(filters),
    relatedLabel: getSmartGuidanceRelatedLabel(filters),
  };
};

const buildSmartChooseAnswer = (experiences = [], filters = {}) => {
  const subject = hasSmartFilters(filters) ? getSmartSubjectLabel(filters) : "اختيار جهة التدريب";
  const paragraphs = [
    `عند ${subject}، لا تختار فقط حسب اسم الجهة. الاسم مهم، لكن تجربة التدريب نفسها تعتمد على الإدارة، المهام، والمشرف.`,
    "قيّم الجهة من ثلاث زوايا: هل المهام قريبة من تخصصك؟ هل البيئة واضحة؟ وهل الطلاب استفادوا أو نصحوا بها؟",
  ];

  if (experiences.length > 0) {
    paragraphs.unshift(
      `راجعت ${experiences.length} تجربة من دربك مرتبطة بسؤالك، والصورة العامة ${getSmartTone(experiences)}.`
    );
  }

  return {
    title: "كيف تختار جهة تدريب مناسبة؟",
    hideCount: !hasSmartFilters(filters),
    intro:
      "الاختيار الذكي مو دائمًا أشهر جهة؛ الاختيار الذكي هو الجهة التي تعطيك تعلّم فعلي وتناسب ظرفك.",
    paragraphs,
    bullets: [
      "قرب المهام من تخصصك أهم من الاسم وحده.",
      "المكافأة ميزة، لكنها لا تعوض تجربة بلا مهام واضحة.",
      "اقرأ التجارب السلبية بهدوء: هل المشكلة عامة أو تجربة فردية؟",
      "إذا عندك أكثر من خيار، قارن حسب المدينة، البيئة، طريقة التقديم، والاستفادة.",
    ],
    quotes: getSmartHumanQuotes(experiences, 1),
    closing:
      "إذا احتجت، اسألني: قارن بين جهة X وجهة Y، أو هل جهة X مناسبة لتخصصي؟",
    note: "الاختيار النهائي يعتمد على ظروفك والفرص المتاحة في وقتك.",
    relatedUrl: getSmartGuidanceRelatedUrl(filters),
    relatedLabel: getSmartGuidanceRelatedLabel(filters),
  };
};

const buildSmartInterviewCoachAnswer = (experiences = [], filters = {}) => {
  const subject = hasSmartFilters(filters) ? getSmartSubjectLabel(filters) : "مقابلة التدريب";
  const interviewExperiences = experiences.filter((exp) =>
    smartTextIncludesAny(exp.description, [
      "مقابلة",
      "اسئلة",
      "أسئلة",
      "تعريفية",
      "اختبار",
    ])
  );

  return {
    title: "كيف تستعد للمقابلة؟",
    hideCount: !hasSmartFilters(filters),
    intro: `لمقابلة ${subject}، لا تحتاج تحفظ كلام كثير؛ تحتاج تعرف تقدم نفسك وتربط تخصصك بالجهة.`,
    paragraphs: [
      interviewExperiences.length > 0
        ? `وجدت ${interviewExperiences.length} تجربة في دربك فيها ذكر للمقابلة أو الأسئلة، لكنها غالبًا كانت إشارات مختصرة وليست بنك أسئلة كامل.`
        : "حتى لو ما وجدت تجارب كثيرة تذكر المقابلة، تقدر تستعد للأسئلة الأساسية لأنها تتكرر في أغلب مقابلات التدريب.",
      "جهّز إجابة قصيرة عن نفسك، مشروع أو مادة قوية، سبب اختيار الجهة، وما الذي تتمنى تتعلمه خلال التدريب.",
    ],
    bullets: [
      "عرّف بنفسك في 30 ثانية.",
      "راجع مشروعين من دراستك واشرح دورك فيها.",
      "اقرأ عن مجال الجهة بشكل عام من موقعها الرسمي.",
      "جهز سؤالًا محترمًا عن طبيعة المهام أو الفريق.",
      "لا تبالغ في خبرتك؛ وضح أنك متعلم ومستعد.",
    ],
    quotes: getSmartHumanQuotes(interviewExperiences, 1),
    closing:
      "المقابلة غالبًا تقيس وضوحك وحماسك أكثر من كونك خبير. خلك مرتب وصادق.",
    note: "هذا إرشاد عام، ومعه ما توفر من إشارات داخل تجارب دربك.",
    relatedUrl: getSmartGuidanceRelatedUrl(filters),
    relatedLabel: getSmartGuidanceRelatedLabel(filters),
  };
};

const buildSmartEnvironmentAnswer = (experiences = [], filters = {}) => {
  const subject = hasSmartFilters(filters) ? getSmartSubjectLabel(filters) : "بيئة التدريب";
  const environments = getTopFrequencies(
    experiences.map((exp) => exp.trainingEnvironment).filter(Boolean),
    3
  );
  const modes = getTopFrequencies(
    experiences.map((exp) => exp.trainingMode).filter(Boolean),
    3
  );

  return {
    title: `بيئة التدريب في ${subject}`,
    hideCount: !hasSmartFilters(filters),
    intro:
      experiences.length > 0
        ? `راجعت ${experiences.length} تجربة مرتبطة بسؤالك وركزت على البيئة ونوع التدريب.`
        : "إذا كان سؤالك عن البيئة، أهم شيء تسأل عن طبيعة الحضور، الفريق، ومكان العمل قبل القبول.",
    paragraphs: [
      environments.length > 0
        ? `البيئات الأكثر ذكرًا: ${environments
            .map(
              (item) =>
                SMART_ASSISTANT_ENVIRONMENT_LABELS[item.label] || item.label
            )
            .join("، ")}.`
        : "ما وجدت بيانات كافية عن نوع البيئة في التجارب المطابقة.",
      modes.length > 0
        ? `أما نوع التدريب الأكثر ظهورًا: ${modes
            .map((item) => item.label)
            .join("، ")}.`
        : "اسأل الجهة قبل القبول: هل التدريب حضوري، عن بعد، أو مختلط؟",
    ],
    bullets: [
      "اسأل عن مكان العمل والدوام قبل بداية التدريب.",
      "اسأل هل يوجد مشرف واضح أو خطة مهام.",
      "إذا البيئة مهمة لك جدًا، اقرأ أكثر من تجربة لنفس الجهة أو المدينة.",
    ],
    quotes: getSmartHumanQuotes(experiences, 1, ["الإيجابيات", "التحديات"]),
    closing:
      "البيئة قد تختلف من فرع أو إدارة لأخرى، لذلك خذ التجارب كمؤشر وليس حكمًا مطلقًا.",
    note: "الجواب مبني على الحقول المكتوبة في تجارب دربك فقط.",
    relatedUrl: getSmartGuidanceRelatedUrl(filters),
    relatedLabel: getSmartGuidanceRelatedLabel(filters),
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
      "ضايع",
      "ضايعه",
      "ضياع",
      "ما اعرف من وين",
      "ما أعرف من وين",
      "من وين ابدا",
      "من وين أبدأ",
      "كيف ابدا",
      "كيف أبدأ",
      "وش اسوي",
      "وش أسوي",
      "متاخر",
      "متأخر",
      "آخر لحظة",
      "اخر لحظة",
      "خايف",
      "خايفه",
      "اخاف",
      "أخاف",
    ])
  ) {
    return "start";
  }

  if (
    smartTextIncludesAny(question, [
      "ايميل",
      "إيميل",
      "الايميل",
      "الإيميل",
      "بريد",
      "رسالة",
      "ارسل",
      "أرسل",
      "خطاب",
      "صيغة",
      "نص ارسله",
      "نص أرسله",
    ])
  ) {
    return "email";
  }

  if (
    smartTextIncludesAny(question, [
      "cv",
      "CV",
      "سيفي",
      "سي في",
      "السيرة",
      "سيرة",
      "resume",
      "ملفي",
      "ملف",
    ])
  ) {
    return "cv";
  }

  if (
    smartTextIncludesAny(question, [
      "اختار",
      "أختار",
      "ايهم",
      "أيهم",
      "اي جهة",
      "أي جهة",
      "وش الافضل لي",
      "وش الأفضل لي",
      "قرار",
      "محتار",
      "محتاره",
    ])
  ) {
    return "choose";
  }

  if (
    smartTextIncludesAny(question, [
      "بيئة",
      "البيئة",
      "نسائية",
      "نساء",
      "رجالية",
      "رجال",
      "مختلطة",
      "مختلط",
      "حضوري",
      "عن بعد",
      "اونلاين",
      "أونلاين",
    ])
  ) {
    return "environment";
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

  if (intent === "email") {
    return buildSmartEmailCoachAnswer(experiences, filters, usedContext);
  }

  if (intent === "cv") {
    return buildSmartCvCoachAnswer(experiences, filters);
  }

  if (intent === "start") {
    return buildSmartStartPlanAnswer(experiences, filters);
  }

  if (intent === "choose") {
    return buildSmartChooseAnswer(experiences, filters);
  }

  if (intent === "environment") {
    return buildSmartEnvironmentAnswer(experiences, filters);
  }

  if (intent === "interview" && !hasSmartFilters(filters)) {
    return buildSmartInterviewCoachAnswer(experiences, filters);
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
    const broadExperienceIntents = [
      "best",
      "problems",
      "apply",
      "interview",
      "tasks",
      "email",
      "cv",
      "start",
      "choose",
      "environment",
      "summary",
    ];
    const matchingExperiences =
      filters.organizations.length > 0 ||
      filters.cities.length > 0 ||
      filters.majors.length > 0
        ? experiences.filter((exp) => experienceMatchesSmartFilters(exp, filters))
        : intent === "reward"
        ? experiences.filter((exp) => exp.hadReward === "yes")
        : broadExperienceIntents.includes(intent)
        ? experiences
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
      relatedLabel: answer.relatedLabel || "عرض جميع التجارب المرتبطة",
      experiences: matchingExperiences.slice(0, 6).map(mapSmartExperiencePreview),
      suggestedQuestions: SMART_ASSISTANT_SUGGESTED_QUESTIONS,
      source: "darbak_mongodb_only",
    });
  } catch (err) {
    console.error("❌ Smart assistant error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/access/check', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const accessDecision = await evaluateContentAccess({
      ...getAccessIdentityFromRequest(req),
      consumeFreeView: true,
    });

    if (!accessDecision.granted) {
      return sendAccessDeniedResponse(res, accessDecision);
    }

    res.json(accessDecision);
  } catch (err) {
    console.error("❌ Access check error:", err);
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
    const visitorId = sanitizeAnalyticsText(req.body.visitorId, 90);

    if (
      !isValidSubscriberContact(rawContact) ||
      !isValidAccessCode(accessCode)
    ) {
      return res.status(400).json({
        error: "اكتب بريد أو رقم جوال صحيح، ورمز دخول من 4 إلى 12 رقم أو حرف.",
      });
    }

    const accessCodeHash = hashAccessCode(contact, accessCode);
    const accessUser = await ensureAccessUser({ contact, accessCode });

    if (accessUser?.isAdmin || isAdminContact(contact, accessCode)) {
      const adminExpiresAt = addSubscriptionDays(3650);
      await User.findByIdAndUpdate(accessUser._id, {
        isAdmin: true,
        isPremium: true,
        premiumExpiresAt: adminExpiresAt,
      });

      return res.json({
        active: true,
        contact,
        email: contact,
        expiresAt: adminExpiresAt,
        accessType: "admin",
        isAdmin: true,
        planId: "admin",
        priceSar: 0,
        durationDays: 3650,
      });
    }

    const subscription = await Subscription.findOne(
      getActiveSubscriptionFilter(contact, accessCodeHash)
    ).lean();

    if (!subscription) {
      const pendingSubscription = await Subscription.findOne({
        email: contact,
        accessCodeHash,
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

          await syncSubscriptionUser(activated);
          await recordPremiumAccessVerifiedEvent({
            subscription: activated,
            visitorId,
            source: "verify_pending_paid",
          });

          return res.json({
            active: true,
            contact: activated.email,
            email: activated.email,
            expiresAt: activated.expiresAt,
            accessType: "premium",
            planId: activated.planId || "monthly",
            priceSar: getSubscriptionPriceSar(activated),
            durationDays: getSubscriptionDurationDays(activated),
            provider: activated.provider || "",
            providerPaymentId: activated.providerPaymentId || "",
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

    await syncSubscriptionUser(subscription);
    await recordPremiumAccessVerifiedEvent({
      subscription,
      visitorId,
      source: "verify_active",
    });

    res.json({
      active: true,
      contact: subscription.email,
      email: subscription.email,
      expiresAt: subscription.expiresAt,
      accessType: "premium",
      planId: subscription.planId || "monthly",
      priceSar: getSubscriptionPriceSar(subscription),
      durationDays: getSubscriptionDurationDays(subscription),
      provider: subscription.provider || "",
      providerPaymentId: subscription.providerPaymentId || "",
    });
  } catch (err) {
    console.error("❌ Subscription verify error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/subscriptions/request-access-help', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const rawContact = (req.body.email || req.body.contact || "")
      .toString()
      .trim()
      .slice(0, 160);

    if (!isValidSubscriberContact(rawContact)) {
      return res.status(400).json({
        error: "اكتب البريد أو رقم الجوال المستخدم في دربك+ عشان نساعدك.",
      });
    }

    const contact = normalizeSubscriberContact(rawContact);
    const activeSubscription = await Subscription.findOne({
      email: contact,
      status: { $in: ["active", "pending"] },
      expiresAt: { $gt: new Date() },
    })
      .sort({ updatedAt: -1 })
      .lean();
    const message = [
      "طلب مساعدة في رمز دخول دربك+.",
      "",
      `وسيلة الدخول: ${contact}`,
      `حالة الاشتراك في النظام: ${activeSubscription ? activeSubscription.status : "غير موجود"}`,
      activeSubscription?.planId ? `الباقة: ${activeSubscription.planId}` : "",
      activeSubscription?.expiresAt
        ? `تاريخ الانتهاء: ${activeSubscription.expiresAt.toISOString()}`
        : "",
      "",
      "ملاحظة: لا يتم حفظ رموز الدخول كنص واضح، لذلك لا يمكن عرض الرمز القديم. الأفضل مساعدة المستخدم بإعادة تفعيل/تحديث بيانات الدخول يدويًا عند الحاجة.",
    ]
      .filter(Boolean)
      .join("\n");

    const contactMessage = await ContactMessage.create({
      reason: "مشكلة تقنية",
      message,
      contact,
      emailStatus: RESEND_API_KEY ? "failed" : "not_configured",
    });

    let emailResult;
    try {
      emailResult = await sendContactEmail({
        reason: "نسيان رمز دخول دربك+",
        message,
        contact,
      });
    } catch (emailErr) {
      emailResult = {
        emailStatus: "failed",
        emailError: emailErr.message || "Email delivery failed",
      };
    }

    if (
      emailResult.emailStatus !== contactMessage.emailStatus ||
      emailResult.emailError
    ) {
      contactMessage.emailStatus = emailResult.emailStatus;
      contactMessage.emailError = emailResult.emailError || "";
      await contactMessage.save();
    }

    res.json({
      success: true,
      message:
        "وصلنا طلب المساعدة. إذا كان الاشتراك موجودًا، بنساعدك على استعادة الوصول.",
    });
  } catch (err) {
    console.error("❌ Subscription access help error:", err);
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
    const visitorId = sanitizeAnalyticsText(req.body.visitorId, 90);

    if (
      !isValidSubscriberContact(rawContact) ||
      !isValidAccessCode(accessCode)
    ) {
      return res.status(400).json({
        error: "اكتب بريد أو رقم جوال صحيح، ورمز دخول من 4 إلى 12 رقم أو حرف قبل تفعيل دربك+.",
      });
    }

    const accessCodeHash = hashAccessCode(contact, accessCode);
    const accessUser = await ensureAccessUser({ contact, accessCode });

    if (accessUser?.isAdmin || isAdminContact(contact, accessCode)) {
      const adminExpiresAt = addSubscriptionDays(3650);
      await User.findByIdAndUpdate(accessUser._id, {
        isAdmin: true,
        isPremium: true,
        premiumExpiresAt: adminExpiresAt,
      });

      return res.json({
        active: true,
        contact,
        email: contact,
        expiresAt: adminExpiresAt,
        accessType: "admin",
        isAdmin: true,
        planId: "admin",
        priceSar: 0,
        durationDays: 3650,
      });
    }

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
        await syncSubscriptionUser(existingSubscription);
        await recordPremiumAccessVerifiedEvent({
          subscription: existingSubscription,
          visitorId,
          source: "start_checkout_active",
        });

        return res.json({
          active: true,
          contact: existingSubscription.email,
          email: existingSubscription.email,
          expiresAt: existingSubscription.expiresAt,
          accessType: "premium",
          planId: existingSubscription.planId || "monthly",
          priceSar: getSubscriptionPriceSar(existingSubscription),
          durationDays: getSubscriptionDurationDays(existingSubscription),
          provider: existingSubscription.provider || "",
          providerPaymentId: existingSubscription.providerPaymentId || "",
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

          await syncSubscriptionUser(activated);
          await recordPremiumAccessVerifiedEvent({
            subscription: activated,
            visitorId,
            source: "start_checkout_pending_paid",
          });

          return res.json({
            active: true,
            contact: activated.email,
            email: activated.email,
            expiresAt: activated.expiresAt,
            accessType: "premium",
            planId: activated.planId || "monthly",
            priceSar: getSubscriptionPriceSar(activated),
            durationDays: getSubscriptionDurationDays(activated),
            provider: activated.provider || "",
            providerPaymentId: activated.providerPaymentId || "",
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
    const moyasarCallbackUrl = `${getPublicApiUrl(req)}/api/subscriptions/moyasar/callback`;

    const amountHalalas = Math.round(selectedPlan.priceSar * 100);

    if (MOYASAR_SECRET_KEY) {
      const invoice = await createMoyasarInvoice({
        amountHalalas,
        description: `${selectedPlan.label} للوصول إلى المزايا الرقمية المتقدمة في منصة دربك`,
        callbackUrl: moyasarCallbackUrl,
        successUrl,
        backUrl: successUrl,
      });

      const pendingSubscription = await Subscription.findOneAndUpdate(
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
      await syncSubscriptionUser(pendingSubscription);

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

      const pendingSubscription = await Subscription.findOneAndUpdate(
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
      await syncSubscriptionUser(pendingSubscription);

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

    await syncSubscriptionUser(subscription);
    await recordPremiumAccessVerifiedEvent({
      subscription,
      source: "moyasar_callback",
    });

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
    const existingSubscription = await Subscription.findOne({
      email: contact,
      status: { $in: ["active", "pending"] },
      expiresAt: { $gt: new Date() },
    })
      .sort({ updatedAt: -1 })
      .lean();
    const subscriptionQuery = existingSubscription
      ? { _id: existingSubscription._id }
      : { email: contact, accessCodeHash };
    const subscription = await Subscription.findOneAndUpdate(
      subscriptionQuery,
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

    await syncSubscriptionUser(subscription);

    res.json({
      email: subscription.email,
      status: subscription.status,
      expiresAt: subscription.expiresAt,
      resetAccessCode: Boolean(existingSubscription),
    });
  } catch (err) {
    console.error("❌ Admin subscription create error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const now = new Date();
    const search = (req.query.search || "").toString().trim().slice(0, 120);
    const status = (req.query.status || "all").toString();
    const escapeRegex = (value = "") =>
      value.toString().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const userClauses = [];

    if (search) {
      const normalizedSearch = normalizeSubscriberContact(search) || search;
      const regex = new RegExp(escapeRegex(normalizedSearch), "i");
      userClauses.push({ $or: [{ contact: regex }, { visitorId: regex }] });
    }

    if (status === "premium") {
      userClauses.push({
        $or: [
          { isAdmin: true },
          {
            isPremium: true,
            $or: [
              { premiumExpiresAt: { $exists: false } },
              { premiumExpiresAt: null },
              { premiumExpiresAt: { $gt: now } },
            ],
          },
        ],
      });
    } else if (status === "admin") {
      userClauses.push({ isAdmin: true });
    } else if (status === "free") {
      userClauses.push({
        contact: { $ne: "" },
        isAdmin: { $ne: true },
        $or: [
          { isPremium: { $ne: true } },
          { premiumExpiresAt: { $lte: now } },
        ],
      });
    } else if (status === "visitor") {
      userClauses.push({ contact: "" });
    }

    const userFilter = userClauses.length > 0 ? { $and: userClauses } : {};

    const [
      totalUsers,
      contactUsers,
      visitorOnlyUsers,
      adminUsers,
      premiumUsers,
      totalSubscriptions,
      activeSubscriptions,
      pendingSubscriptions,
      expiredSubscriptions,
      cancelledSubscriptions,
      paidRevenueStats,
      activeRevenueStats,
      planBreakdown,
      users,
      subscriptions,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ contact: { $ne: "" } }),
      User.countDocuments({ contact: "" }),
      User.countDocuments({ isAdmin: true }),
      User.countDocuments({
        $or: [
          { isAdmin: true },
          {
            isPremium: true,
            $or: [
              { premiumExpiresAt: { $exists: false } },
              { premiumExpiresAt: null },
              { premiumExpiresAt: { $gt: now } },
            ],
          },
        ],
      }),
      Subscription.countDocuments({}),
      Subscription.countDocuments({ status: "active", expiresAt: { $gt: now } }),
      Subscription.countDocuments({ status: "pending" }),
      Subscription.countDocuments({
        $or: [
          { status: "expired" },
          { status: "active", expiresAt: { $lte: now } },
        ],
      }),
      Subscription.countDocuments({ status: "cancelled" }),
      Subscription.aggregate([
        { $match: { status: { $in: ["active", "expired"] } } },
        {
          $group: {
            _id: null,
            total: { $sum: "$priceSar" },
            count: { $sum: 1 },
          },
        },
      ]),
      Subscription.aggregate([
        { $match: { status: "active", expiresAt: { $gt: now } } },
        {
          $group: {
            _id: null,
            total: { $sum: "$priceSar" },
            count: { $sum: 1 },
          },
        },
      ]),
      Subscription.aggregate([
        { $match: { status: { $in: ["active", "expired", "pending"] } } },
        {
          $group: {
            _id: "$planId",
            count: { $sum: 1 },
            revenue: {
              $sum: {
                $cond: [
                  { $in: ["$status", ["active", "expired"]] },
                  "$priceSar",
                  0,
                ],
              },
            },
          },
        },
        { $sort: { count: -1, _id: 1 } },
        { $project: { _id: 0, planId: "$_id", count: 1, revenue: 1 } },
      ]),
      User.find(userFilter)
        .sort({ updatedAt: -1 })
        .limit(180)
        .select(
          "contact visitorId accessCodeHash isPremium isAdmin premiumExpiresAt lastViewedDate dailyViewsCount dailyViewItemKeys createdAt updatedAt"
        )
        .lean(),
      Subscription.find(search ? { email: new RegExp(escapeRegex(normalizeSubscriberContact(search) || search), "i") } : {})
        .sort({ updatedAt: -1 })
        .limit(120)
        .select(
          "email status planId priceSar durationDays expiresAt provider providerPaymentId createdAt updatedAt accessCodeHash"
        )
        .lean(),
    ]);

    const subscriptionKeyMap = new Map();
    subscriptions.forEach((subscription) => {
      subscriptionKeyMap.set(
        `${subscription.email}:${subscription.accessCodeHash}`,
        subscription
      );
    });

    const sanitizeSubscription = (subscription = {}) => {
      const isExpired =
        subscription.expiresAt && new Date(subscription.expiresAt) <= now;

      return {
        id: subscription._id,
        email: subscription.email || "",
        status:
          subscription.status === "active" && isExpired
            ? "expired"
            : subscription.status || "",
        planId: subscription.planId || "",
        priceSar: subscription.priceSar || 0,
        durationDays: subscription.durationDays || 0,
        expiresAt: subscription.expiresAt || null,
        provider: subscription.provider || "",
        providerPaymentId: subscription.providerPaymentId || "",
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt,
      };
    };

    const safeUsers = users.map((user) => {
      const linkedSubscription = subscriptionKeyMap.get(
        `${user.contact}:${user.accessCodeHash}`
      );
      const hasActivePremium =
        Boolean(user.isAdmin) ||
        (Boolean(user.isPremium) &&
          (!user.premiumExpiresAt || new Date(user.premiumExpiresAt) > now));

      return {
        id: user._id,
        contact: user.contact || "",
        visitorId: user.visitorId || "",
        accessType: user.isAdmin
          ? "admin"
          : hasActivePremium
          ? "premium"
          : user.contact
          ? "free"
          : "visitor",
        isPremium: hasActivePremium,
        isAdmin: Boolean(user.isAdmin),
        premiumExpiresAt: user.premiumExpiresAt || null,
        lastViewedDate: user.lastViewedDate || "",
        dailyViewsCount: user.dailyViewsCount || 0,
        dailyItemsCount: Array.isArray(user.dailyViewItemKeys)
          ? user.dailyViewItemKeys.length
          : 0,
        hasAccessCode: Boolean(user.accessCodeHash),
        subscription: linkedSubscription
          ? sanitizeSubscription(linkedSubscription)
          : null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    });

    res.json({
      summary: {
        totalUsers,
        contactUsers,
        visitorOnlyUsers,
        adminUsers,
        premiumUsers,
        freeUsers: Math.max(contactUsers - premiumUsers, 0),
        totalSubscriptions,
        activeSubscriptions,
        pendingSubscriptions,
        expiredSubscriptions,
        cancelledSubscriptions,
        paidSubscriptions: paidRevenueStats[0]?.count || 0,
        totalPaidRevenueSar: Number(paidRevenueStats[0]?.total || 0),
        activeRevenueSar: Number(activeRevenueStats[0]?.total || 0),
      },
      planBreakdown,
      users: safeUsers,
      subscriptions: subscriptions.map(sanitizeSubscription),
      returnedUsers: safeUsers.length,
      returnedSubscriptions: subscriptions.length,
    });
  } catch (err) {
    console.error("❌ Admin users error:", err);
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
    const guideAdEventNames = [
      "diagnosis_store_click",
      "training_guide_opportunities_banner_click",
      "training_guide_banner_click",
    ];
    const cvAdEventNames = ["diagnosis_cv_product_click"];
    const premiumEventNames = [
      "premium_gate_opened",
      "premium_gate_closed",
      "premium_nav_cta_clicked",
      "premium_plan_selected",
      "premium_checkout_started",
      "premium_checkout_failed",
      "premium_payment_returned",
      "premium_access_verified",
      "premium_access_help_requested",
      "account_modal_opened",
      "account_login_success",
      "account_login_failed",
      "account_logout_clicked",
      "account_access_help_requested",
    ];
    const interviewPageMatch = {
      ...cleanMatch,
      eventName: "interviews_page_viewed",
    };
    const shareMatch = {
      ...cleanMatch,
      eventName: "share_item_clicked",
    };
    const shareActionMatch = {
      ...shareMatch,
      "metadata.action": { $nin: [null, "", "menu_open"] },
    };
    const activeWindowMinutes = 5;
    const activeVisitorsMatch = {
      createdAt: {
        $gte: new Date(Date.now() - activeWindowMinutes * 60 * 1000),
      },
      visitorId: { $nin: [null, ""] },
    };
    const subscriptionDateMatch = match.createdAt
      ? { updatedAt: match.createdAt }
      : {};

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
      interviewPageViews,
      interviewVisitors,
      interviewSearches,
      interviewQuestionStarts,
      interviewQuestionSubmissions,
      topInterviewQuestionOrganizations,
      guideFileAdClicks,
      cvProductAdClicks,
      topAdClicks,
      premiumEventCounts,
      topPremiumPlans,
      paidMoyasarSubscriptions,
      manualActiveSubscriptions,
      adminAccessUsers,
      shareMenuOpens,
      shareActions,
      experienceShareMenuOpens,
      experienceShareActions,
      opportunityShareMenuOpens,
      opportunityShareActions,
      trainingTargetShareMenuOpens,
      trainingTargetShareActions,
      topShareActions,
      topSharedExperiences,
      topSharedOpportunities,
      topSharedTrainingTargets,
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
      AnalyticsEvent.countDocuments(interviewPageMatch),
      AnalyticsEvent.distinct("visitorId", interviewPageMatch),
      AnalyticsEvent.countDocuments({
        ...cleanMatch,
        eventName: "interviews_search",
      }),
      AnalyticsEvent.countDocuments({
        ...cleanMatch,
        eventName: "interview_questions_started",
      }),
      AnalyticsEvent.countDocuments({
        ...cleanMatch,
        eventName: "interview_questions_submitted",
      }),
      AnalyticsEvent.aggregate([
        {
          $match: {
            ...cleanMatch,
            eventName: "interview_questions_submitted",
            "metadata.organizationName": { $nin: [null, ""] },
          },
        },
        { $group: { _id: "$metadata.organizationName", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: 10 },
        { $project: { _id: 0, label: "$_id", count: 1 } },
      ]),
      AnalyticsEvent.countDocuments({
        ...cleanMatch,
        eventName: { $in: guideAdEventNames },
      }),
      AnalyticsEvent.countDocuments({
        ...cleanMatch,
        eventName: { $in: cvAdEventNames },
      }),
      AnalyticsEvent.aggregate([
        {
          $match: {
            ...cleanMatch,
            eventName: { $in: [...guideAdEventNames, ...cvAdEventNames] },
          },
        },
        {
          $project: {
            label: {
              $switch: {
                branches: [
                  {
                    case: { $in: ["$eventName", guideAdEventNames] },
                    then: "إعلان ملف رحلة المتدرب",
                  },
                  {
                    case: { $in: ["$eventName", cvAdEventNames] },
                    then: "إعلان السيرة الذاتية",
                  },
                ],
                default: "$eventName",
              },
            },
          },
        },
        { $group: { _id: "$label", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $project: { _id: 0, label: "$_id", count: 1 } },
      ]),
      getPremiumEventAnalytics(cleanMatch, premiumEventNames),
      AnalyticsEvent.aggregate([
        {
          $match: {
            ...cleanMatch,
            eventName: {
              $in: ["premium_plan_selected", "premium_checkout_started"],
            },
            "metadata.planId": { $nin: [null, ""] },
          },
        },
        { $group: { _id: "$metadata.planId", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: 6 },
        { $project: { _id: 0, label: "$_id", count: 1 } },
      ]),
      Subscription.countDocuments({
        ...subscriptionDateMatch,
        provider: "moyasar",
        status: "active",
        providerPaymentId: { $nin: [null, ""] },
      }),
      Subscription.countDocuments({
        ...subscriptionDateMatch,
        provider: "manual",
        status: "active",
      }),
      User.countDocuments({
        isAdmin: true,
      }),
      AnalyticsEvent.countDocuments({
        ...shareMatch,
        "metadata.action": "menu_open",
      }),
      AnalyticsEvent.countDocuments(shareActionMatch),
      AnalyticsEvent.countDocuments({
        ...shareMatch,
        "metadata.itemType": "experience",
        "metadata.action": "menu_open",
      }),
      AnalyticsEvent.countDocuments({
        ...shareActionMatch,
        "metadata.itemType": "experience",
      }),
      AnalyticsEvent.countDocuments({
        ...shareMatch,
        "metadata.itemType": "opportunity",
        "metadata.action": "menu_open",
      }),
      AnalyticsEvent.countDocuments({
        ...shareActionMatch,
        "metadata.itemType": "opportunity",
      }),
      AnalyticsEvent.countDocuments({
        ...shareMatch,
        "metadata.itemType": "training-target",
        "metadata.action": "menu_open",
      }),
      AnalyticsEvent.countDocuments({
        ...shareActionMatch,
        "metadata.itemType": "training-target",
      }),
      AnalyticsEvent.aggregate([
        {
          $match: {
            ...shareMatch,
            "metadata.action": { $nin: [null, ""] },
          },
        },
        { $group: { _id: "$metadata.action", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: 8 },
        { $project: { _id: 0, label: "$_id", count: 1 } },
      ]),
      AnalyticsEvent.aggregate([
        {
          $match: {
            ...shareActionMatch,
            "metadata.itemType": "experience",
            "metadata.organizationName": { $nin: [null, ""] },
          },
        },
        {
          $project: {
            label: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$metadata.title", null] },
                    { $ne: ["$metadata.title", ""] },
                  ],
                },
                "$metadata.title",
                "$metadata.organizationName",
              ],
            },
          },
        },
        { $group: { _id: "$label", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: 10 },
        { $project: { _id: 0, label: "$_id", count: 1 } },
      ]),
      AnalyticsEvent.aggregate([
        {
          $match: {
            ...shareActionMatch,
            "metadata.itemType": "opportunity",
            "metadata.organizationName": { $nin: [null, ""] },
          },
        },
        {
          $project: {
            label: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$metadata.opportunityTitle", null] },
                    { $ne: ["$metadata.opportunityTitle", ""] },
                  ],
                },
                "$metadata.opportunityTitle",
                "$metadata.organizationName",
              ],
            },
          },
        },
        { $group: { _id: "$label", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: 10 },
        { $project: { _id: 0, label: "$_id", count: 1 } },
      ]),
      AnalyticsEvent.aggregate([
        {
          $match: {
            ...shareActionMatch,
            "metadata.itemType": "training-target",
            "metadata.organizationName": { $nin: [null, ""] },
          },
        },
        { $group: { _id: "$metadata.organizationName", count: { $sum: 1 } } },
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

    const getPremiumEventSummary = (eventName) => {
      const item = (premiumEventCounts || []).find(
        (event) => event.label === eventName
      );

      return {
        events: item?.count || 0,
        uniqueVisitors: item?.uniqueVisitors || 0,
      };
    };

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
      interviewPageViews,
      interviewVisitors: interviewVisitors.filter(Boolean).length,
      interviewSearches,
      interviewQuestionStarts,
      interviewQuestionSubmissions,
      topInterviewQuestionOrganizations,
      guideFileAdClicks,
      cvProductAdClicks,
      topAdClicks,
      premiumEventCounts,
      premiumFunnelSummary: {
        gateOpened: getPremiumEventSummary("premium_gate_opened"),
        planSelected: getPremiumEventSummary("premium_plan_selected"),
        checkoutStarted: getPremiumEventSummary("premium_checkout_started"),
        paymentReturned: getPremiumEventSummary("premium_payment_returned"),
        paymentSuccessful: {
          events: paidMoyasarSubscriptions,
          uniqueVisitors:
            getPremiumEventSummary("premium_access_verified").uniqueVisitors,
        },
        manualActiveSubscriptions,
        adminAccessUsers,
      },
      topPremiumPlans,
      shareMenuOpens,
      shareActions,
      experienceShareMenuOpens,
      experienceShareActions,
      opportunityShareMenuOpens,
      opportunityShareActions,
      trainingTargetShareMenuOpens,
      trainingTargetShareActions,
      topShareActions,
      topSharedExperiences,
      topSharedOpportunities,
      topSharedTrainingTargets,
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

app.post('/api/contact', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const requestedReason = (req.body.reason || "").toString().trim();
    const reason = CONTACT_REASONS.has(requestedReason)
      ? requestedReason
      : "أخرى";
    const contact = (req.body.contact || "").toString().trim().slice(0, 160);
    const message = (req.body.message || "").toString().trim();

    if (message.length < 5) {
      return res.status(400).json({ error: "اكتب رسالتك بشكل أوضح قبل الإرسال." });
    }

    if (message.length > 1800) {
      return res.status(400).json({ error: "الرسالة طويلة جدًا، اختصرها قليلًا." });
    }

    if (containsBlockedTerms(message) || containsBlockedTerms(contact)) {
      return res.status(400).json({
        error: "النص يحتوي على عبارات غير مناسبة. الرجاء تعديل الصياغة ثم المحاولة مرة أخرى.",
      });
    }

    const contactMessage = await ContactMessage.create({
      reason,
      message,
      contact,
      emailStatus: RESEND_API_KEY ? "failed" : "not_configured",
    });

    let emailResult;
    try {
      emailResult = await sendContactEmail({ reason, message, contact });
    } catch (emailErr) {
      emailResult = {
        emailStatus: "failed",
        emailError: emailErr.message || "Email delivery failed",
      };
    }

    if (
      emailResult.emailStatus !== contactMessage.emailStatus ||
      emailResult.emailError
    ) {
      contactMessage.emailStatus = emailResult.emailStatus;
      contactMessage.emailError = emailResult.emailError || "";
      await contactMessage.save();
    }

    res.json({
      success: true,
      id: contactMessage._id,
      emailStatus: contactMessage.emailStatus,
    });
  } catch (err) {
    console.error("❌ Error saving contact message:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/interview-questions', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const payload = sanitizeInterviewQuestionPayload(req.body);

    if (!payload.organizationName || !payload.major) {
      return res.status(400).json({
        error: "اسم الجهة والتخصص مطلوبة حتى نستفيد من الأسئلة بشكل صحيح.",
      });
    }

    if (payload.questions.length === 0) {
      return res.status(400).json({
        error: "اكتب سؤال مقابلة واحدًا على الأقل.",
      });
    }

    const fieldsToCheck = [
      payload.organizationName,
      payload.city,
      payload.majorCategory,
      payload.major,
      payload.note,
      ...payload.questions,
    ];

    if (fieldsToCheck.some(containsBlockedTerms)) {
      return res.status(400).json({
        error: "النص يحتوي على عبارات غير مناسبة. الرجاء تعديل الصياغة ثم المحاولة مرة أخرى.",
      });
    }

    if (
      (payload.majorCategory && isUnclearMajorText(payload.majorCategory)) ||
      isUnclearMajorText(payload.major)
    ) {
      return res.status(400).json({
        error: "الرجاء اختيار تخصص واضح حتى تظهر الأسئلة للطلاب المناسبين.",
      });
    }

    const interviewQuestion = await InterviewQuestion.create({
      ...payload,
      status: "pending",
      sourceType: "direct",
    });

    res.json({
      message: "وصلتنا أسئلة المقابلة، وبتظهر بعد المراجعة.",
      data: interviewQuestion,
    });
  } catch (err) {
    console.error("❌ Error saving interview questions:", err);
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

app.post('/api/saved-items/experience-updates', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const items = Array.isArray(req.body.items) ? req.body.items.slice(0, 120) : [];
    const parseDate = (value) => {
      const time = new Date(value).getTime();
      return Number.isFinite(time) ? new Date(time) : null;
    };
    const getSavedOrganizationName = (item = {}) => {
      if (item.organizationName) return item.organizationName;
      if (item.type === "experience" || item.type === "opportunity") {
        return item.subtitle || item.title || "";
      }
      return item.title || item.subtitle || "";
    };

    const watchedItems = items
      .map((item) => {
        const id = (item.id || "").toString().trim();
        const organizationName = getSavedOrganizationName(item).toString().trim();
        const since =
          parseDate(item.lastOrganizationUpdateSeenAt) ||
          parseDate(item.savedAt) ||
          parseDate(item.lastSeenAt);

        return {
          id,
          organizationName,
          since,
          variants: getOrganizationNameVariants(organizationName),
        };
      })
      .filter(
        (item) =>
          item.id &&
          item.organizationName &&
          item.since &&
          item.variants.length > 0
      );

    if (watchedItems.length === 0) {
      return res.json({ updates: [] });
    }

    const oldestSince = new Date(
      Math.min(...watchedItems.map((item) => item.since.getTime()))
    );

    const experiences = await Experience.find({
      $and: [
        getApprovedExperiencesFilter(),
        {
          $or: [
            { reviewedAt: { $gt: oldestSince } },
            { createdAt: { $gt: oldestSince } },
          ],
        },
      ],
    })
      .select("organizationName title city major majorCategory reviewedAt createdAt")
      .sort({ reviewedAt: -1, createdAt: -1 })
      .limit(1000)
      .lean();

    const normalizedExperiences = experiences
      .map((exp) => ({
        ...exp,
        acceptedAt: parseDate(exp.reviewedAt) || parseDate(exp.createdAt),
        variants: getOrganizationNameVariants(exp.organizationName),
      }))
      .filter((exp) => exp.acceptedAt && exp.variants.length > 0);

    const opportunities = await Opportunity.find({
      status: { $in: ["active", "expired"] },
      $or: [
        { updatedAt: { $gt: oldestSince } },
        { createdAt: { $gt: oldestSince } },
      ],
    })
      .select("organizationName title status deadline updatedAt createdAt applicationUrl sourceUrl")
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(1000)
      .lean();

    const normalizedOpportunities = opportunities
      .map((opportunity) => ({
        ...opportunity,
        eventAt:
          parseDate(opportunity.updatedAt) || parseDate(opportunity.createdAt),
        createdAtDate: parseDate(opportunity.createdAt),
        variants: getOrganizationNameVariants(opportunity.organizationName),
      }))
      .filter((opportunity) => opportunity.eventAt && opportunity.variants.length > 0);

    const buildOpportunityEvent = (opportunity) => {
      const isClosed =
        opportunity.status === "expired" || isClosedByDeadline(opportunity.deadline);
      const isNew =
        opportunity.createdAtDate &&
        opportunity.eventAt.getTime() - opportunity.createdAtDate.getTime() <
          2 * 60 * 1000;

      if (isClosed) {
        return {
          type: "opportunity_closed",
          tone: "danger",
          icon: "🔴",
          label: "أغلق التقديم",
          message: "أغلق التقديم على فرصة محفوظة عندك.",
        };
      }

      if (isNew) {
        return {
          type: "opportunity_new",
          tone: "success",
          icon: "⭐",
          label: "فرصة جديدة",
          message: "أضيفت فرصة جديدة لجهة محفوظة عندك.",
        };
      }

      return {
        type: "opportunity_updated",
        tone: "success",
        icon: "🟢",
        label: "تحديث جديد",
        message: "تم تحديث بيانات فرصة محفوظة عندك.",
      };
    };

    const updates = watchedItems
      .map((item) => {
        const matches = normalizedExperiences
          .filter(
            (exp) =>
              exp.acceptedAt.getTime() > item.since.getTime() &&
              item.variants.some((savedName) =>
                exp.variants.some((experienceName) =>
                  isSameOrganizationName(savedName, experienceName)
                )
              )
          )
          .sort((a, b) => b.acceptedAt.getTime() - a.acceptedAt.getTime());

        const opportunityMatches = normalizedOpportunities
          .filter(
            (opportunity) =>
              opportunity.eventAt.getTime() > item.since.getTime() &&
              item.variants.some((savedName) =>
                opportunity.variants.some((opportunityName) =>
                  isSameOrganizationName(savedName, opportunityName)
                )
              )
          )
          .sort((a, b) => b.eventAt.getTime() - a.eventAt.getTime());

        const events = [];

        if (matches.length > 0) {
          const latest = matches[0];
          events.push({
            type: "new_experience",
            tone: "success",
            icon: "📝",
            label: "تجربة جديدة",
            message: "أضيفت تجربة جديدة لجهة محفوظة عندك.",
            date: latest.acceptedAt.toISOString(),
            count: matches.length,
            url: `/experiences?company=${encodeURIComponent(
              latest.organizationName || item.organizationName
            )}`,
            itemId: latest._id?.toString() || "",
            title: latest.title || `تجربة في ${latest.organizationName}`,
          });
        }

        if (opportunityMatches.length > 0) {
          const latestOpportunity = opportunityMatches[0];
          const opportunityEvent = buildOpportunityEvent(latestOpportunity);
          events.push({
            ...opportunityEvent,
            date: latestOpportunity.eventAt.toISOString(),
            count: opportunityMatches.length,
            url: `/where-to-train/opportunity/${latestOpportunity._id?.toString()}`,
            itemId: latestOpportunity._id?.toString() || "",
            title:
              latestOpportunity.title ||
              `فرصة في ${latestOpportunity.organizationName}`,
          });
        }

        events.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        if (events.length === 0) return null;

        const latestEvent = events[0];
        return {
          id: item.id,
          organizationName: item.organizationName,
          count: events.reduce((sum, event) => sum + (event.count || 1), 0),
          latestAcceptedAt: latestEvent.date,
          latestEventAt: latestEvent.date,
          events,
        };
      })
      .filter(Boolean);

    res.json({ updates });
  } catch (err) {
    console.error("❌ Saved item experience updates error:", err);
    res.status(500).json({ error: "Unable to fetch saved updates" });
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
      .select(`${OPPORTUNITY_PUBLIC_FIELDS} applicationUrl`)
      .sort({ featured: -1, createdAt: -1 })
      .lean();

    const sortedOpportunities = opportunities
      .sort((a, b) => {
        const closedDiff =
          Number(isClosedByDeadline(a.deadline)) -
          Number(isClosedByDeadline(b.deadline));
        if (closedDiff !== 0) return closedDiff;

        const featuredDiff = Number(b.featured) - Number(a.featured);
        if (featuredDiff !== 0) return featuredDiff;

        const createdDiff =
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (createdDiff !== 0) return createdDiff;

        const aDeadline = a.deadline ? new Date(a.deadline).getTime() : Infinity;
        const bDeadline = b.deadline ? new Date(b.deadline).getTime() : Infinity;
        return aDeadline - bDeadline;
      });

    const opportunitiesWithCounts = await attachItemInteractionCounts(
      "opportunity",
      sortedOpportunities
    );

    res.json({
      data: opportunitiesWithCounts.map((opportunity = {}) => {
        const { applicationUrl, sourceUrl, note, ...publicOpportunity } =
          opportunity;

        return {
          ...publicOpportunity,
          hasApplicationUrl: Boolean(applicationUrl),
        };
      }),
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

    if (shouldEnforceContentAccess(req)) {
      const itemKey = `opportunity:${req.params.id}`;
      const accessDecision = await evaluateContentAccess({
        ...getAccessIdentityFromRequest(req),
        itemKey,
        consumeFreeView: false,
      });

      if (!accessDecision.granted) {
        return sendAccessDeniedResponse(res, accessDecision);
      }
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
      ...(Array.isArray(req.body.interviewQuestions)
        ? req.body.interviewQuestions
        : [req.body.interviewQuestions]),
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
      interviewQuestions: normalizeInterviewQuestions(req.body.interviewQuestions),
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
      const candidates = await Experience.find(baseFilter)
        .select(EXPERIENCE_PUBLIC_FIELDS)
        .sort(sort)
        .lean();

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
        Experience.find(baseFilter)
          .select(EXPERIENCE_PUBLIC_FIELDS)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
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

app.get('/api/interviews', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const query = normalizeSearchText(req.query.q || "");
    const majorFilter = (req.query.major || "").toString().trim();
    const cityFilter = (req.query.city || "").toString().trim();

    const [experiences, interviewQuestionSubmissions] = await Promise.all([
      Experience.find({
        ...getApprovedExperiencesFilter(),
        interviewQuestions: { $exists: true, $ne: [] },
      })
        .select(
          "organizationName city major majorCategory interviewQuestions createdAt"
        )
        .sort({ createdAt: -1 })
        .limit(1200)
        .lean(),
      InterviewQuestion.find({ status: "approved" })
        .select("organizationName city major majorCategory questions createdAt")
        .sort({ createdAt: -1 })
        .limit(1200)
        .lean(),
    ]);

    const interviewRows = [
      ...experiences.map((exp) => ({
        organizationName: exp.organizationName,
        city: exp.city,
        major: exp.major,
        majorCategory: exp.majorCategory,
        questions: exp.interviewQuestions,
        createdAt: exp.createdAt,
        kind: "experience",
      })),
      ...interviewQuestionSubmissions.map((item) => ({
        organizationName: item.organizationName,
        city: item.city,
        major: item.major,
        majorCategory: item.majorCategory,
        questions: item.questions,
        createdAt: item.createdAt,
        kind: "interview_question",
      })),
    ];

    const matchesFilter = (item) => {
      if (
        majorFilter &&
        item.major !== majorFilter &&
        item.majorCategory !== majorFilter
      ) {
        return false;
      }

      if (cityFilter) {
        const cityValues = getCityFilterValues(cityFilter);
        if (!cityValues.includes(item.city)) return false;
      }

      if (!query) return true;

      const searchableValues = [
        item.organizationName,
        item.city,
        item.major,
        item.majorCategory,
        ...(Array.isArray(item.questions) ? item.questions : []),
      ]
        .filter(Boolean)
        .map(normalizeSearchText);

      return searchableValues.some((value) => value.includes(query));
    };

    const grouped = new Map();

    interviewRows.filter(matchesFilter).forEach((item) => {
      const organizationName = (item.organizationName || "").trim();
      const major = (item.major || "غير محدد").trim();
      const majorCategory = (item.majorCategory || "").trim();
      const key = `${normalizeSearchText(organizationName)}|${normalizeSearchText(
        major
      )}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          organizationName,
          major,
          majorCategory,
          cities: new Set(),
          questions: [],
          questionKeys: new Set(),
          experiencesCount: 0,
          interviewSubmissionsCount: 0,
          latestCreatedAt: item.createdAt,
        });
      }

      const group = grouped.get(key);
      if (item.kind === "experience") {
        group.experiencesCount += 1;
      } else {
        group.interviewSubmissionsCount += 1;
      }
      if (item.city) group.cities.add(item.city);
      if (
        item.createdAt &&
        (!group.latestCreatedAt ||
          new Date(item.createdAt) > new Date(group.latestCreatedAt))
      ) {
        group.latestCreatedAt = item.createdAt;
      }

      normalizeInterviewQuestions(item.questions).forEach((question) => {
        const questionKey = normalizeSearchText(question);
        if (!group.questionKeys.has(questionKey)) {
          group.questionKeys.add(questionKey);
          group.questions.push(question);
        }
      });
    });

    const data = Array.from(grouped.values())
      .map((group) => ({
        organizationName: group.organizationName,
        major: group.major,
        majorCategory: group.majorCategory,
        cities: Array.from(group.cities),
        questions: group.questions.slice(0, 12),
        questionsCount: group.questions.length,
        experiencesCount: group.experiencesCount,
        interviewSubmissionsCount: group.interviewSubmissionsCount,
        sourcesCount: group.experiencesCount + group.interviewSubmissionsCount,
        latestCreatedAt: group.latestCreatedAt,
      }))
      .sort((a, b) => {
        if (b.sourcesCount !== a.sourcesCount) {
          return b.sourcesCount - a.sourcesCount;
        }
        return (a.organizationName || "").localeCompare(
          b.organizationName || "",
          "ar"
        );
      });

    res.json({ data, total: data.length });
  } catch (err) {
    console.error("❌ Interviews fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/experiences/:id/related', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid experience id" });
    }

    const currentExperience = await Experience.findOne({
      _id: req.params.id,
      ...getApprovedExperiencesFilter(),
    }).lean();

    if (!currentExperience) {
      return res.status(404).json({ error: "Experience not found" });
    }

    const currentMajor = (currentExperience.major || "").trim();
    const currentMajorCategory = (currentExperience.majorCategory || "").trim();
    const currentCity = (currentExperience.city || "").trim();
    const currentOrganization = normalizeSearchText(
      currentExperience.organizationName || currentExperience.companyName || ""
    );
    const relatedConditions = [
      currentMajor ? { major: currentMajor } : null,
      currentMajorCategory ? { majorCategory: currentMajorCategory } : null,
      currentCity ? { city: currentCity } : null,
    ].filter(Boolean);

    const relatedFilter = {
      $and: [
        getApprovedExperiencesFilter(),
        { _id: { $ne: currentExperience._id } },
        ...(relatedConditions.length > 0 ? [{ $or: relatedConditions }] : []),
      ],
    };

    let candidates = await Experience.find(relatedFilter)
      .select(EXPERIENCE_PUBLIC_FIELDS)
      .sort({ starRating: -1, createdAt: -1 })
      .limit(120)
      .lean();

    if (candidates.length === 0) {
      candidates = await Experience.find({
        $and: [
          getApprovedExperiencesFilter(),
          { _id: { $ne: currentExperience._id } },
        ],
      })
        .select(EXPERIENCE_PUBLIC_FIELDS)
        .sort({ starRating: -1, createdAt: -1 })
        .limit(40)
        .lean();
    }

    const scored = candidates
      .map((exp) => {
        const expOrganization = normalizeSearchText(
          exp.organizationName || exp.companyName || ""
        );
        const sameOrganization =
          currentOrganization &&
          expOrganization &&
          isSameOrganizationName(currentOrganization, expOrganization);
        const score =
          (exp.major && exp.major === currentMajor ? 5 : 0) +
          (exp.majorCategory && exp.majorCategory === currentMajorCategory ? 4 : 0) +
          (exp.city && exp.city === currentCity ? 3 : 0) +
          (sameOrganization ? -2 : 1) +
          (Number(exp.starRating) || 0) / 10;

        return { exp, score, sameOrganization };
      })
      .sort((a, b) => {
        if (a.sameOrganization !== b.sameOrganization) {
          return Number(a.sameOrganization) - Number(b.sameOrganization);
        }
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.exp.createdAt || 0) - new Date(a.exp.createdAt || 0);
      });

    const seenOrganizations = new Set();
    const related = scored
      .filter(({ exp }) => {
        const organizationKey = normalizeSearchText(
          exp.organizationName || exp.companyName || exp.title || exp._id
        );
        if (!organizationKey || seenOrganizations.has(organizationKey)) {
          return false;
        }
        seenOrganizations.add(organizationKey);
        return true;
      })
      .slice(0, 4)
      .map(({ exp }) => exp);

    res.json({ data: related });
  } catch (err) {
    console.error("❌ Related experiences fetch error:", err);
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

    if (shouldEnforceContentAccess(req)) {
      const itemKey = `experience:${req.params.id}`;
      const accessDecision = await evaluateContentAccess({
        ...getAccessIdentityFromRequest(req),
        itemKey,
        consumeFreeView: false,
      });

      if (!accessDecision.granted) {
        return sendAccessDeniedResponse(res, accessDecision);
      }
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

app.get('/api/admin/contact-messages', requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const messages = await ContactMessage.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({ data: messages });
  } catch (err) {
    console.error("❌ Admin contact messages fetch error:", err);
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

app.get('/api/admin/interview-questions', requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const status = ["pending", "approved", "rejected"].includes(req.query.status)
      ? req.query.status
      : "pending";

    const interviewQuestions = await InterviewQuestion.find({ status })
      .sort({ createdAt: -1 })
      .limit(150)
      .lean();

    res.json({ data: interviewQuestions });
  } catch (err) {
    console.error("❌ Admin interview questions fetch error:", err);
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

app.patch('/api/admin/interview-questions/:id/status', requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const { status } = req.body;

    if (!["approved", "rejected", "pending"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const updated = await InterviewQuestion.findByIdAndUpdate(
      req.params.id,
      { status, reviewedAt: new Date() },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ error: "Interview questions not found" });
    }

    res.json(updated);
  } catch (err) {
    console.error("❌ Admin interview questions status error:", err);
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
      "interviewQuestions",
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

    if (Object.prototype.hasOwnProperty.call(updates, "interviewQuestions")) {
      updates.interviewQuestions = normalizeInterviewQuestions(
        updates.interviewQuestions
      );
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

app.delete('/api/admin/interview-questions/:id', requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const deleted = await InterviewQuestion.findByIdAndDelete(req.params.id).lean();

    if (!deleted) {
      return res.status(404).json({ error: "Interview questions not found" });
    }

    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error("❌ Admin interview questions delete error:", err);
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

app.delete('/api/admin/contact-messages/:id', requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const deleted = await ContactMessage.findByIdAndDelete(req.params.id).lean();

    if (!deleted) {
      return res.status(404).json({ error: "Contact message not found" });
    }

    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error("❌ Admin contact message delete error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
