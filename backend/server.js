const express = require('express');
const mongoose = require('mongoose');
const cors = require("cors");
const crypto = require("crypto");
require('dotenv').config();

const Experience = require('./models/Experience');
const Suggestion = require('./models/Suggestion');
const ContactMessage = require('./models/ContactMessage');
const CompanyApplication = require('./models/CompanyApplication');
const CompanyApplicationCampaign = require('./models/CompanyApplicationCampaign');
const Opportunity = require('./models/Opportunity');
const InterviewQuestion = require('./models/InterviewQuestion');
const AnalyticsEvent = require('./models/AnalyticsEvent');
const Subscription = require('./models/Subscription');
const User = require('./models/User');
const Portfolio = require('./models/Portfolio');
const PortfolioAsset = require('./models/PortfolioAsset');
const ResumeProfile = require('./models/ResumeProfile');
const ResumeAgentSession = require('./models/ResumeAgentSession');
const ResumePendingDraft = require('./models/ResumePendingDraft');
const ResumeTailoredVersion = require('./models/ResumeTailoredVersion');
const TelegramPost = require('./models/TelegramPost');
const TelegramContentItem = require('./models/TelegramContentItem');
const TelegramSettings = require('./models/TelegramSettings');
const {
  PLUS_ENTITLEMENT,
  PLUS_PLAN_KEY,
  RESUME_ENTITLEMENT,
  RESUME_PLAN_KEY,
  buildSubscriptionPlans,
  calculateAccessWindow,
  getPlanAiResumeUsageLimit,
  getPlanEntitlements,
  getPublicSubscriptionPlans,
  getSubscriptionPlan: resolveSubscriptionPlan,
  isResumePlanLaunchEnabled,
  normalizePlanKey,
} = require("./subscriptionPlans");
const {
  generateResumeDraft,
  mapDraftToResumePayload,
  resumeDraftSchema,
  rewriteResumeSection,
  tailorResumeToOpportunity,
  translateResumeToEnglish,
  tailoredResumeDraftSchema,
} = require("./services/resumeAiService");
const {
  runDarbakResumeAgent,
} = require("./agents/darbakResumeAgent");

const app = express();
const PORT = process.env.PORT || 3001;
const DEFAULT_EXPERIENCES_LIMIT = 36;
const MAX_EXPERIENCES_LIMIT = 60;
const READ_CACHE_TTL_MS = Number(process.env.READ_CACHE_TTL_MS || 3 * 60 * 1000);
const READ_CACHE_MAX_ENTRIES = Number(process.env.READ_CACHE_MAX_ENTRIES || 600);
const INTERACTION_STATS_CACHE_TTL_MS = Number(
  process.env.INTERACTION_STATS_CACHE_TTL_MS || 30 * 60 * 1000
);
const EXPIRED_OPPORTUNITY_SWEEP_INTERVAL_MS = Number(
  process.env.EXPIRED_OPPORTUNITY_SWEEP_INTERVAL_MS || 15 * 60 * 1000
);
const HOME_STATS_CACHE_TTL_MS = Number(
  process.env.HOME_STATS_CACHE_TTL_MS || 48 * 60 * 60 * 1000
);
const ADMIN_ANALYTICS_CACHE_TTL_MS = Number(
  process.env.ADMIN_ANALYTICS_CACHE_TTL_MS || 10 * 60 * 1000
);
const RESUME_AI_RATE_LIMIT_WINDOW_MS = Number(
  process.env.RESUME_AI_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000
);
const RESUME_AI_RATE_LIMIT_MAX = Number(process.env.RESUME_AI_RATE_LIMIT_MAX || 8);
const readCache = new Map();
const resumeAiRateLimits = new Map();
const resumeAiIdempotencyCache = new Map();
let lastExpiredOpportunitySweepAt = 0;
const EXPERIENCE_PUBLIC_FIELDS =
  "organizationName city howApplied duration trainingYear wasHired hadReward rewardAmount trainingEnvironment benefitedFromTraining wouldRecommend trainingMode ambassadorConsent ambassadorLinkedInUrl ambassadorProfileImageUrl ambassadorDisplayName featuredAmbassadorLogoUrl featuredAmbassadorCardTitle featuredAmbassadorCardSummary featuredAmbassadorCardTags featuredAmbassador featuredAmbassadorAt featuredAmbassadorUntil starRating ratings title sourceType status reviewedAt majorCategory major createdAt updatedAt";
const OPPORTUNITY_PUBLIC_FIELDS =
  "organizationName title city cities majorCategories specialties trainingEnvironment targetAudience trainingMode hasReward applicationMethod logoUrl deadline status sourceType featured createdAt updatedAt";
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
const SUBSCRIPTION_PLANS = buildSubscriptionPlans(process.env);
const RESUME_PLAN_LAUNCH_ENABLED = isResumePlanLaunchEnabled(process.env);
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
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID || "";
const TELEGRAM_CRON_SECRET = process.env.TELEGRAM_CRON_SECRET || "";
const TELEGRAM_BOT_PUBLISHING_ENABLED =
  process.env.TELEGRAM_BOT_PUBLISHING_ENABLED === "true";
const CONTACT_REASONS = new Set([
  "استفسار عام",
  "مشكلة تقنية",
  "اقتراح تطوير",
  "بلاغ عن محتوى",
  "تعاون أو إعلان",
  "أخرى",
]);

const getReadCache = (key) => {
  const entry = readCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    readCache.delete(key);
    return null;
  }
  return entry.value;
};

const setReadCache = (key, value, ttlMs = READ_CACHE_TTL_MS) => {
  if (!key || ttlMs <= 0) return value;
  if (readCache.size >= READ_CACHE_MAX_ENTRIES && !readCache.has(key)) {
    const oldestKey = readCache.keys().next().value;
    if (oldestKey) readCache.delete(oldestKey);
  }
  readCache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
  return value;
};

const getRequestCacheKey = (scope, query = {}) => {
  const queryPart = Object.keys(query)
    .sort()
    .map((key) => {
      const value = query[key];
      return `${key}=${Array.isArray(value) ? value.join(",") : value ?? ""}`;
    })
    .join("&");

  return `${scope}:${queryPart}`;
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

const escapeRegex = (value = "") =>
  value.toString().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
  return normalizeSaudiMobile(value) || normalizeArabicDigits(value).trim().toLowerCase();
};

const isValidSubscriberContact = (value = "") =>
  isValidEmail(value) || Boolean(normalizeSaudiMobile(value));

const isLegacyMobileSubscriberContact = (value = "") =>
  !isValidEmail(value) && Boolean(normalizeSaudiMobile(value));

const normalizeCompanyApplicationSlug = (value = "") => {
  const normalized = normalizeSearchText(value)
    .replace(/[^a-z0-9\u0600-\u06FF]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

  return normalized || "company";
};

const sanitizeExternalUrl = (value = "") => {
  const text = value.toString().trim().slice(0, 300);
  if (!text) return "";

  const withProtocol = /^https?:\/\//i.test(text)
    ? text
    : `https://${text.replace(/^\/+/, "")}`;

  try {
    const url = new URL(withProtocol);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.toString().slice(0, 300);
  } catch {
    return "";
  }
};

const sanitizeCompanyApplicationPayload = (body = {}) => {
  const organizationName = (body.organizationName || body.company || "")
    .toString()
    .trim()
    .slice(0, 180);
  const opportunityTitle = (body.opportunityTitle || body.role || body.title || "")
    .toString()
    .trim()
    .slice(0, 180);
  const fullName = (body.fullName || "")
    .toString()
    .trim()
    .slice(0, 120);
  const rawEmail = (body.email || "").toString().trim();
  const email = isValidEmail(rawEmail) ? normalizeEmail(rawEmail) : "";
  const major = (body.major || body.specialty || "")
    .toString()
    .trim()
    .slice(0, 140);
  const city = (body.city || "").toString().trim().slice(0, 120);
  const portfolioUrl = sanitizeExternalUrl(body.portfolioUrl || "");
  const linkedinUrl = body.linkedinUrl
    ? normalizeLinkedInProfileUrl(body.linkedinUrl)
    : "";
  const note = (body.note || "").toString().trim().slice(0, 1200);
  const companySlug = normalizeCompanyApplicationSlug(
    body.companySlug || organizationName
  );
  const opportunityId =
    body.opportunityId && mongoose.Types.ObjectId.isValid(body.opportunityId)
      ? body.opportunityId
      : null;

  return {
    companySlug,
    organizationName,
    opportunityTitle,
    opportunityId,
    fullName,
    email,
    major,
    city,
    portfolioUrl,
    linkedinUrl,
    note,
    consent: body.consent === true || body.consent === "true",
  };
};

const COMPANY_APPLICATION_STATUS_FLOW = [
  "submitted",
  "under_review",
  "shortlisted",
  "interview",
  "accepted",
  "rejected",
  "withdrawn",
];

const COMPANY_APPLICATION_STATUS_LABELS = {
  submitted: "تم الإرسال",
  under_review: "قيد المراجعة",
  shortlisted: "مرشح",
  interview: "مرحلة المقابلة",
  accepted: "مقبول",
  rejected: "مرفوض",
  withdrawn: "منسحب",
  new: "تم الإرسال",
  reviewed: "قيد المراجعة",
};

const normalizeCompanyApplicationStatusValue = (status = "") => {
  const value = status.toString().trim();
  if (value === "new") return "submitted";
  if (value === "reviewed") return "under_review";
  return COMPANY_APPLICATION_STATUS_FLOW.includes(value) ? value : "submitted";
};

const getCompanyApplicationStatusFilterValues = (status = "") => {
  const normalized = normalizeCompanyApplicationStatusValue(status);
  if (normalized === "submitted") return ["submitted", "new"];
  if (normalized === "under_review") return ["under_review", "reviewed"];
  return [normalized];
};

const sanitizeCompanyApplicationAnswerText = (value = "", maxLength = 1200) =>
  value.toString().trim().slice(0, maxLength);

const sanitizeCompanyApplicationCustomAnswers = (answers = []) => {
  if (!Array.isArray(answers)) return [];

  return answers
    .map((item) => ({
      question: sanitizeCompanyApplicationAnswerText(item?.question || "", 220),
      answer: sanitizeCompanyApplicationAnswerText(item?.answer || "", 1200),
    }))
    .filter((item) => item.question || item.answer)
    .slice(0, 8);
};

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

const sendAccessCodeResetEmail = async ({
  email = "",
  resetUrl = "",
  expiresAt = null,
} = {}) => {
  if (!RESEND_API_KEY || typeof fetch !== "function") {
    return { emailStatus: "not_configured", emailError: "" };
  }

  const expiresAtLabel = expiresAt
    ? formatRiyadhDateTime(expiresAt)
    : "بعد 30 دقيقة";
  const cleanEmail = normalizeEmail(email);

  const payload = {
    from: CONTACT_EMAIL_FROM,
    to: [cleanEmail],
    reply_to: CONTACT_EMAIL_TO,
    subject: "إعادة تعيين رمز دخول دربك+",
    text: [
      "وصلنا طلب إعادة تعيين رمز دخول دربك+.",
      "",
      "اضغط الرابط التالي واختر رمز دخول جديد:",
      resetUrl,
      "",
      `صلاحية الرابط: ${expiresAtLabel}`,
      "",
      "إذا لم تطلب إعادة تعيين الرمز، تجاهل هذه الرسالة وسيبقى حسابك كما هو.",
    ].join("\n"),
    html: `
      <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;color:#111827;background:#f8fafc;padding:24px">
        <div style="max-width:560px;margin:auto;background:#ffffff;border:1px solid #dbe7e3;border-radius:18px;padding:24px">
          <p style="margin:0 0 8px;color:#0f766e;font-weight:700">دربك+</p>
          <h2 style="margin:0 0 12px;color:#111827">إعادة تعيين رمز الدخول</h2>
          <p style="margin:0 0 16px;color:#334155">وصلنا طلب إعادة تعيين رمز دخولك في دربك+. اضغط الزر واختر رمزًا جديدًا.</p>
          <a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#7ddbcd;color:#07100e;text-decoration:none;font-weight:700;border-radius:12px;padding:12px 18px">تعيين رمز جديد</a>
          <p style="margin:16px 0 0;color:#64748b;font-size:13px">صلاحية الرابط: ${escapeHtml(expiresAtLabel)}</p>
          <p style="margin:10px 0 0;color:#64748b;font-size:12px">إذا لم تطلب إعادة التعيين، تجاهل هذه الرسالة وسيبقى حسابك كما هو.</p>
        </div>
      </div>
    `,
  };

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

const sendCompanyApplicationStatusEmail = async ({
  email = "",
  fullName = "",
  organizationName = "",
  opportunityTitle = "",
  status = "",
  studentVisibleMessage = "",
  applicationsUrl = "",
} = {}) => {
  const cleanEmail = normalizeEmail(email);

  if (!RESEND_API_KEY || typeof fetch !== "function" || !isValidEmail(cleanEmail)) {
    return { emailStatus: "not_configured", emailError: "" };
  }

  const statusLabel =
    COMPANY_APPLICATION_STATUS_LABELS[normalizeCompanyApplicationStatusValue(status)] ||
    "تحديث جديد";
  const message =
    studentVisibleMessage ||
    `تم تحديث حالة طلبك إلى: ${statusLabel}.`;
  const safeApplicationsUrl = sanitizeExternalUrl(applicationsUrl || getFrontendUrl());

  const payload = {
    from: CONTACT_EMAIL_FROM,
    to: [cleanEmail],
    reply_to: CONTACT_EMAIL_TO,
    subject: `تحديث طلبك في ${organizationName || "دربك"}`,
    text: [
      fullName ? `مرحبًا ${fullName}` : "مرحبًا",
      "",
      `تم تحديث حالة طلبك لدى ${organizationName || "جهة تدريبية"}.`,
      opportunityTitle ? `البرنامج: ${opportunityTitle}` : "",
      `الحالة: ${statusLabel}`,
      "",
      message,
      "",
      "يمكنك متابعة طلباتك من الرابط:",
      safeApplicationsUrl,
    ]
      .filter(Boolean)
      .join("\n"),
    html: `
      <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;color:#111827;background:#f8fafc;padding:24px">
        <div style="max-width:560px;margin:auto;background:#ffffff;border:1px solid #dbe7e3;border-radius:18px;padding:24px">
          <p style="margin:0 0 8px;color:#0f766e;font-weight:700">دربك</p>
          <h2 style="margin:0 0 12px;color:#111827">تحديث على طلبك</h2>
          <p style="margin:0 0 8px;color:#334155">تم تحديث حالة طلبك لدى <strong>${escapeHtml(
            organizationName || "جهة تدريبية"
          )}</strong>.</p>
          ${
            opportunityTitle
              ? `<p style="margin:0 0 8px;color:#334155">البرنامج: ${escapeHtml(
                  opportunityTitle
                )}</p>`
              : ""
          }
          <p style="margin:0 0 14px;color:#0f766e;font-weight:700">الحالة: ${escapeHtml(
            statusLabel
          )}</p>
          <p style="margin:0 0 16px;color:#334155">${escapeHtml(message)}</p>
          <a href="${escapeHtml(
            safeApplicationsUrl
          )}" style="display:inline-block;background:#7ddbcd;color:#07100e;text-decoration:none;font-weight:700;border-radius:12px;padding:12px 18px">عرض طلباتي</a>
        </div>
      </div>
    `,
  };

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

const sendAdminTestEmail = async () => {
  if (!RESEND_API_KEY || typeof fetch !== "function") {
    return { emailStatus: "not_configured", emailError: "" };
  }

  const sentAtLabel = formatRiyadhDateTime(new Date());
  const payload = {
    from: CONTACT_EMAIL_FROM,
    to: [CONTACT_EMAIL_TO],
    subject: "اختبار إشعارات دربك",
    text: [
      "هذا اختبار لإعدادات إرسال الإيميلات في دربك.",
      "",
      `وقت الاختبار: ${sentAtLabel}`,
      `From: ${CONTACT_EMAIL_FROM}`,
      `To: ${CONTACT_EMAIL_TO}`,
    ].join("\n"),
    html: `
      <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;color:#111827">
        <h2 style="margin:0 0 12px;color:#0f766e">اختبار إشعارات دربك</h2>
        <p>إذا وصلك هذا الإيميل، إعدادات Resend في Render تعمل بنجاح.</p>
        <table style="width:100%;border-collapse:collapse;margin-top:12px">
          <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>وقت الاختبار</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtml(sentAtLabel)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>From</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtml(CONTACT_EMAIL_FROM)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>To</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtml(CONTACT_EMAIL_TO)}</td></tr>
        </table>
      </div>
    `,
  };

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

const generateAccessResetToken = () => crypto.randomBytes(32).toString("hex");

const hashAccessResetToken = (token = "") =>
  crypto
    .createHmac("sha256", SUBSCRIPTION_SECRET)
    .update(token.toString().trim())
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

const addDaysFromDate = (date = new Date(), days = SUBSCRIPTION_DURATION_DAYS) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + Number(days || 30));
  return nextDate;
};

const getSubscriptionPlan = (planId = "") =>
  resolveSubscriptionPlan(planId, process.env);

const getSubscriptionPlanKey = (subscription = {}) =>
  normalizePlanKey(subscription.planKey || subscription.planId || PLUS_PLAN_KEY);

const getSubscriptionEntitlements = (subscription = {}) => {
  const planKey = getSubscriptionPlanKey(subscription);
  return Array.from(
    new Set([
      ...getPlanEntitlements(planKey, process.env),
      ...(Array.isArray(subscription.entitlements) ? subscription.entitlements : []),
    ])
  );
};

const subscriptionHasEntitlement = (subscription = {}, entitlement = "") =>
  getSubscriptionEntitlements(subscription).includes(entitlement);

const getSubscriptionAiResumeUsageLimit = (subscription = {}) => {
  const explicitLimit = Number(subscription.aiResumeUsageLimit);
  if (Number.isFinite(explicitLimit) && explicitLimit > 0) return explicitLimit;
  return getPlanAiResumeUsageLimit(getSubscriptionPlanKey(subscription), process.env);
};

const buildSubscriptionAccessPayload = (subscription = {}) => {
  const planKey = getSubscriptionPlanKey(subscription);
  const plan = getSubscriptionPlan(planKey);
  const entitlements = getSubscriptionEntitlements(subscription);
  const aiResumeUsageLimit = getSubscriptionAiResumeUsageLimit(subscription);

  return {
    planId: subscription.planId || plan.id,
    planKey,
    planLabel: plan.label,
    entitlements,
    hasResumeAccess: entitlements.includes(RESUME_ENTITLEMENT),
    aiResumeUsageCount: Number(subscription.aiResumeUsageCount || 0),
    aiResumeUsageLimit,
    aiResumeUsageResetAt: subscription.aiResumeUsageResetAt || subscription.expiresAt || null,
  };
};

const getSubscriptionDurationDays = (subscription = {}) =>
  Number(subscription.durationDays || SUBSCRIPTION_DURATION_DAYS);

const getSubscriptionPriceSar = (subscription = {}) =>
  Number(subscription.priceSar || SUBSCRIPTION_PRICE_SAR);

const formatRiyadhDateTime = (value = new Date()) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("ar-SA", {
    timeZone: "Asia/Riyadh",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

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

const getAccessItemType = (itemKey = "") => {
  const rawType = sanitizeAccessItemKey(itemKey).split(":")[0] || "general";

  if (
    [
      "opportunity",
      "opportunity_apply",
      "opportunity-apply",
      "where-to-train",
      "where-to-train-opportunities",
      "guide-organization",
    ].includes(rawType)
  ) {
    return "opportunity";
  }

  if (["experience", "experience_details", "experience-details"].includes(rawType)) {
    return "experience";
  }

  return rawType;
};

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

  const userPayload = {
    contact: normalizeSubscriberContact(subscription.email),
    accessCodeHash: subscription.accessCodeHash,
    isPremium: Boolean(isActive),
    isAdmin: isAdminSubscriptionHash(
      subscription.email,
      subscription.accessCodeHash
    ),
    premiumExpiresAt: subscription.expiresAt,
    accessSource: isActive ? "paid_subscription" : "",
    planKey: isActive ? getSubscriptionPlanKey(subscription) : "",
    entitlements: isActive ? getSubscriptionEntitlements(subscription) : [],
    aiResumeUsageCount: isActive ? Number(subscription.aiResumeUsageCount || 0) : 0,
    aiResumeUsageLimit: isActive
      ? getSubscriptionAiResumeUsageLimit(subscription)
      : 0,
    aiResumeUsageResetAt: isActive
      ? subscription.aiResumeUsageResetAt || subscription.expiresAt
      : null,
  };

  if (isActive) {
    userPayload.accessGrantedAt = new Date();
    userPayload.accessGrantedBy = subscription.provider || "subscription";
  }

  return User.findOneAndUpdate(
    {
      contact: normalizeSubscriberContact(subscription.email),
      accessCodeHash: subscription.accessCodeHash,
    },
    {
      $set: userPayload,
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

const getUserManualAccessType = (user = {}) => {
  if (user?.accessSource === "experience_reward") return "experience_reward";
  if (user?.accessSource === "admin_grant") return "admin_grant";
  return "premium";
};

const getActiveManualAccessWindow = (user = {}, now = new Date()) => {
  if (!user?.isPremium) return null;

  const expiresAt = user.premiumExpiresAt ? new Date(user.premiumExpiresAt) : null;

  if (expiresAt && expiresAt <= now) return null;

  return {
    accessType: getUserManualAccessType(user),
    expiresAt: expiresAt || null,
    planKey: user.planKey || PLUS_PLAN_KEY,
    entitlements:
      Array.isArray(user.entitlements) && user.entitlements.length > 0
        ? user.entitlements
        : [PLUS_ENTITLEMENT],
  };
};

const grantExperienceRewardAccess = async (
  experience = {},
  { grantedBy = "admin" } = {}
) => {
  if (!experience?._id || !experience.submittedByUserId) {
    return { granted: false, reason: "missing_user_link" };
  }

  if (experience.rewardStatus === "granted") {
    return { granted: false, reason: "already_granted" };
  }

  const user = await User.findById(experience.submittedByUserId).lean();
  if (!user) {
    const updatedExperience = await Experience.findByIdAndUpdate(
      experience._id,
      {
        $set: {
          rewardEligible: false,
          rewardStatus: "not_eligible",
        },
      },
      { new: true }
    ).lean();

    return {
      granted: false,
      reason: "user_not_found",
      experience: updatedExperience,
    };
  }

  const now = new Date();
  const currentExpiry = user.premiumExpiresAt
    ? new Date(user.premiumExpiresAt)
    : null;
  const startsAt = currentExpiry && currentExpiry > now ? currentExpiry : now;
  const expiresAt = addDaysFromDate(startsAt, 30);

  await User.findByIdAndUpdate(user._id, {
    $set: {
      isPremium: true,
      premiumExpiresAt: expiresAt,
      accessSource: "experience_reward",
      accessGrantedAt: now,
      accessGrantedBy: grantedBy,
      planKey: PLUS_PLAN_KEY,
      entitlements: [PLUS_ENTITLEMENT],
      aiResumeUsageCount: 0,
      aiResumeUsageLimit: 0,
      aiResumeUsageResetAt: null,
    },
  });

  const updatedExperience = await Experience.findByIdAndUpdate(
    experience._id,
    {
      $set: {
        rewardEligible: true,
        rewardStatus: "granted",
        rewardGrantedAt: now,
        rewardStartsAt: startsAt,
        rewardExpiresAt: expiresAt,
        rewardGrantedBy: grantedBy,
      },
    },
    { new: true }
  ).lean();

  await AnalyticsEvent.create({
    eventName: "experience_reward_granted",
    visitorId: "",
    page: "/admin/experiences",
    deviceType: "admin",
    metadata: sanitizeAnalyticsMetadata({
      experienceId: experience._id.toString(),
      userId: user._id.toString(),
      organizationName: experience.organizationName || "",
      startsAt: startsAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    }),
  }).catch((analyticsErr) =>
    console.error("❌ Experience reward analytics error:", analyticsErr)
  );

  return {
    granted: true,
    user,
    experience: updatedExperience,
    startsAt,
    expiresAt,
  };
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
      error:
        "اكتب بريدًا إلكترونيًا صحيحًا، أو رقم الجوال المستخدم في حساب سابق، مع رمز دخول من 4 إلى 12 رقم أو حرف.",
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
        )
          .sort({ updatedAt: -1 })
          .lean()
      : null;

  if (activeSubscription) {
    user = await syncSubscriptionUser(activeSubscription);
  }

  const now = new Date();
  const isAdmin = Boolean(user?.isAdmin) || isAdminContact(contact, accessCode);
  const manualAccess = getActiveManualAccessWindow(user, now);
  const isPremium = Boolean(activeSubscription) || Boolean(manualAccess);

  if (isAdmin) {
    return {
      granted: true,
      accessType: "admin",
      isAdmin: true,
      isPremium: true,
      dailyLimit: FREE_DAILY_DETAIL_LIMIT,
      planId: "admin",
      planKey: RESUME_PLAN_KEY,
      entitlements: [PLUS_ENTITLEMENT, RESUME_ENTITLEMENT],
      hasResumeAccess: true,
    };
  }

  if (isPremium) {
    const premiumPayload = activeSubscription
      ? buildSubscriptionAccessPayload(activeSubscription)
      : {
          planId: manualAccess.planKey || PLUS_PLAN_KEY,
          planKey: manualAccess.planKey || PLUS_PLAN_KEY,
          planLabel:
            manualAccess.accessType === "experience_reward"
              ? "هدية مشاركة تجربة"
              : "وصول كامل",
          entitlements: manualAccess.entitlements || [PLUS_ENTITLEMENT],
          hasResumeAccess: (manualAccess.entitlements || []).includes(
            RESUME_ENTITLEMENT
          ),
          aiResumeUsageCount: Number(user.aiResumeUsageCount || 0),
          aiResumeUsageLimit: Number(user.aiResumeUsageLimit || 0),
          aiResumeUsageResetAt: user.aiResumeUsageResetAt || null,
        };

    return {
      granted: true,
      accessType: activeSubscription ? "premium" : manualAccess.accessType,
      isAdmin: false,
      isPremium: true,
      expiresAt: activeSubscription?.expiresAt || manualAccess.expiresAt,
      dailyLimit: FREE_DAILY_DETAIL_LIMIT,
      ...premiumPayload,
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
      subscriptionReminderLastShownAt: user.subscriptionReminderLastShownAt || null,
      message:
        "وقفت هنا... وباقي تجارب وفرص مهمة. فعّل دربك+ وكمل استكشافك.",
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
    subscriptionReminderLastShownAt:
      accessDecision.subscriptionReminderLastShownAt || null,
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
  metadata,
}) => {
  const body = {
    amount: amountHalalas,
    currency: "SAR",
    description,
    callback_url: callbackUrl,
    success_url: successUrl,
    back_url: backUrl || successUrl,
    ...(metadata ? { metadata } : {}),
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

const getMoyasarPayment = async (paymentId) =>
  callMoyasar(`/payments/${encodeURIComponent(paymentId)}`);

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

const normalizeFeaturedAmbassadorTags = (value) => {
  const rawItems = Array.isArray(value)
    ? value
    : typeof value === "string"
    ? value.split(/\n+|[,،|]+/)
    : [];

  const seen = new Set();

  return rawItems
    .map((item) => item.toString().replace(/\s+/g, " ").trim())
    .filter((item) => item.length >= 2)
    .filter((item) => {
      const key = normalizeSearchText(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 4);
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

const getExpiredOpportunityCutoff = () => {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  return cutoff;
};

const markExpiredOpportunities = async () => {
  if (mongoose.connection.readyState !== 1) return;
  const now = Date.now();
  if (now - lastExpiredOpportunitySweepAt < EXPIRED_OPPORTUNITY_SWEEP_INTERVAL_MS) {
    return;
  }
  lastExpiredOpportunitySweepAt = now;

  await Opportunity.updateMany(
    {
      status: "active",
      deadline: {
        $exists: true,
        $ne: null,
        $lt: getExpiredOpportunityCutoff(),
      },
    },
    { $set: { status: "expired" } }
  );
};

const sanitizeOpportunityPayload = (body = {}) => {
  const deadlineValue = body.deadline ? new Date(body.deadline) : undefined;
  const hasValidDeadline =
    deadlineValue && !Number.isNaN(deadlineValue.getTime());
  const requestedStatus = ["active", "draft", "expired"].includes(body.status)
    ? body.status
    : "active";
  const status =
    requestedStatus === "active" && hasValidDeadline && isClosedByDeadline(deadlineValue)
      ? "expired"
      : requestedStatus;
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
    targetAudience: ["all", "women", "men", ""].includes(body.targetAudience)
      ? body.targetAudience
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
    status,
    sourceType: ["admin", "visitor"].includes(body.sourceType)
      ? body.sourceType
      : "admin",
    submitterContact: (body.submitterContact || "").trim(),
    featured: Boolean(body.featured),
    ...(hasValidDeadline
      ? { deadline: deadlineValue }
      : { deadline: undefined }),
  };
};

const sanitizePortfolioText = (value = "", maxLength = 120) =>
  value
    .toString()
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

const sanitizePortfolioLongText = (value = "", maxLength = 460) =>
  value
    .toString()
    .trim()
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .slice(0, maxLength);

const sanitizePortfolioUrl = (value = "", maxLength = 260) => {
  const raw = value.toString().trim().slice(0, maxLength);
  if (!raw) return "";

  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.toString();
  } catch {
    return "";
  }
};

const normalizePortfolioSlug = (value = "") =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

const buildDefaultPortfolioSlug = (contact = "") => {
  const emailName = normalizeSubscriberContact(contact).split("@")[0] || "student";
  return normalizePortfolioSlug(emailName) || `student-${Date.now().toString(36)}`;
};

const normalizePortfolioList = (value, maxItems = 8, maxLength = 48) =>
  normalizeArrayField(value)
    .map((item) => sanitizePortfolioText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);

const sanitizePortfolioProjects = (projects = []) => {
  const rawProjects = Array.isArray(projects) ? projects : [];

  return rawProjects
    .map((project = {}) => ({
      title: sanitizePortfolioText(project.title, 90),
      description: sanitizePortfolioLongText(project.description, 240),
      url: sanitizePortfolioUrl(project.url, 260),
    }))
    .filter((project) => project.title || project.description || project.url)
    .slice(0, 6);
};

const sanitizePortfolioCertifications = (certifications = []) => {
  const rawCertifications = Array.isArray(certifications) ? certifications : [];

  return rawCertifications
    .map((certification = {}) => ({
      title: sanitizePortfolioText(certification.title, 100),
      provider: sanitizePortfolioText(certification.provider, 90),
      year: sanitizePortfolioText(certification.year, 20),
    }))
    .filter(
      (certification) =>
        certification.title || certification.provider || certification.year
    )
    .slice(0, 8);
};

const sanitizePortfolioDate = (value = "") => {
  const raw = value.toString().trim();
  if (!raw) return "";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
};

const getPortfolioAssetUrl = (req, assetId = "") =>
  assetId ? `${getPublicApiUrl(req)}/api/portfolio-assets/${assetId}` : "";

const sanitizePortfolioPayload = (body = {}, contact = "") => {
  const slug = normalizePortfolioSlug(body.slug) || buildDefaultPortfolioSlug(contact);
  const normalizedContact = normalizeSubscriberContact(contact);
  const rawEmail = body.email || (isValidEmail(normalizedContact) ? normalizedContact : "");

  return {
    slug,
    fullName: sanitizePortfolioText(body.fullName, 90),
    major: sanitizePortfolioText(body.major, 90),
    university: sanitizePortfolioText(body.university, 110),
    city: sanitizePortfolioText(body.city, 60),
    dateOfBirth: sanitizePortfolioDate(body.dateOfBirth),
    degreeLevel: sanitizePortfolioText(body.degreeLevel, 70),
    readinessStatus:
      sanitizePortfolioText(body.readinessStatus, 110) ||
      "مستعد ومؤهل للمقابلات الشخصية",
    targetOrganizations: normalizePortfolioList(
      body.targetOrganizations,
      8,
      55
    ),
    bio: sanitizePortfolioLongText(body.bio, 500),
    skills: normalizePortfolioList(body.skills, 12, 36),
    projects: sanitizePortfolioProjects(body.projects),
    certifications: sanitizePortfolioCertifications(body.certifications),
    cvUrl: sanitizePortfolioUrl(body.cvUrl, 260),
    linkedinUrl: sanitizePortfolioUrl(body.linkedinUrl, 260),
    email: isValidEmail(rawEmail) ? normalizeEmail(rawEmail) : "",
    avatarUrl: sanitizePortfolioUrl(body.avatarUrl, 260),
    isPublished: Boolean(body.isPublished),
  };
};

const getPortfolioIdentity = (req = {}) => {
  const identity = getAccessIdentityFromRequest(req);
  const contact = normalizeSubscriberContact(identity.contact);
  const accessCode = normalizeAccessCode(identity.accessCode);

  return {
    contact,
    accessCode,
    accessCodeHash:
      contact && accessCode ? hashAccessCode(contact, accessCode) : "",
  };
};

const getPortfolioAccessStatus = async (portfolio = {}) => {
  if (!portfolio?.contact || !portfolio?.accessCodeHash) {
    return { isActive: false, isPremium: false, isAdmin: false };
  }

  const [user, activeSubscription] = await Promise.all([
    User.findOne({
      contact: portfolio.contact,
      accessCodeHash: portfolio.accessCodeHash,
    }).lean(),
    Subscription.findOne(
      getActiveSubscriptionFilter(portfolio.contact, portfolio.accessCodeHash)
    )
      .sort({ updatedAt: -1 })
      .lean(),
  ]);

  const now = new Date();
  const isAdmin =
    Boolean(user?.isAdmin) ||
    isAdminSubscriptionHash(portfolio.contact, portfolio.accessCodeHash);
  const manualAccess = getActiveManualAccessWindow(user, now);
  const isPremium = Boolean(activeSubscription) || Boolean(manualAccess);

  return {
    isActive: Boolean(portfolio.isPublished && (isAdmin || isPremium)),
    isPremium,
    isAdmin,
    expiresAt: activeSubscription?.expiresAt || user?.premiumExpiresAt || null,
  };
};

const serializePortfolio = (portfolio = {}, accessStatus = {}, req = null) => ({
  id: portfolio._id?.toString?.() || portfolio.id || "",
  slug: portfolio.slug || "",
  fullName: portfolio.fullName || "",
  major: portfolio.major || "",
  university: portfolio.university || "",
  city: portfolio.city || "",
  dateOfBirth: portfolio.dateOfBirth || "",
  degreeLevel: portfolio.degreeLevel || "",
  readinessStatus: portfolio.readinessStatus || "",
  targetOrganizations: Array.isArray(portfolio.targetOrganizations)
    ? portfolio.targetOrganizations
    : [],
  bio: portfolio.bio || "",
  skills: Array.isArray(portfolio.skills) ? portfolio.skills : [],
  projects: Array.isArray(portfolio.projects) ? portfolio.projects : [],
  certifications: Array.isArray(portfolio.certifications)
    ? portfolio.certifications
    : [],
  cvAssetId: portfolio.cvAssetId?.toString?.() || portfolio.cvAssetId || "",
  cvAssetUrl:
    req && portfolio.cvAssetId ? getPortfolioAssetUrl(req, portfolio.cvAssetId) : "",
  cvUrl: portfolio.cvUrl || "",
  linkedinUrl: portfolio.linkedinUrl || "",
  email: portfolio.email || "",
  avatarAssetId:
    portfolio.avatarAssetId?.toString?.() || portfolio.avatarAssetId || "",
  avatarAssetUrl:
    req && portfolio.avatarAssetId
      ? getPortfolioAssetUrl(req, portfolio.avatarAssetId)
      : "",
  avatarUrl: portfolio.avatarUrl || "",
  isPublished: Boolean(portfolio.isPublished),
  viewCount: Number(portfolio.viewCount || 0),
  publicActive: Boolean(accessStatus.isActive),
  isPremium: Boolean(accessStatus.isPremium),
  isAdmin: Boolean(accessStatus.isAdmin),
  expiresAt: accessStatus.expiresAt || null,
  createdAt: portfolio.createdAt,
  updatedAt: portfolio.updatedAt,
});

const getCompanyApplicationCampaignFromRequest = (req = {}) => {
  const source = {
    ...(req.query || {}),
    ...(req.body || {}),
    companySlug: req.params?.companySlug || req.body?.companySlug || req.query?.companySlug,
  };
  const organizationName = (source.organizationName || source.company || "")
    .toString()
    .trim()
    .slice(0, 180);
  const opportunityTitle = (
    source.opportunityTitle ||
    source.role ||
    source.title ||
    source.opportunity ||
    ""
  )
    .toString()
    .trim()
    .slice(0, 180);
  const companySlug = normalizeCompanyApplicationSlug(
    source.companySlug || organizationName || "company"
  );
  const opportunityId =
    source.opportunityId && mongoose.Types.ObjectId.isValid(source.opportunityId)
      ? source.opportunityId
      : null;
  const campaignId = (
    source.campaignId ||
    (opportunityId ? opportunityId.toString() : "") ||
    companySlug
  )
    .toString()
    .trim()
    .slice(0, 160);

  return {
    companySlug,
    campaignId,
    organizationName: organizationName || companySlug.replace(/-/g, " "),
    organizationLogoUrl: sanitizeExternalUrl(source.organizationLogoUrl || source.logoUrl || ""),
    opportunityTitle: opportunityTitle || "التدريب التعاوني",
    opportunityId,
  };
};

const sanitizeCompanyApplicationCampaignQuestions = (questions = []) => {
  const sourceQuestions = Array.isArray(questions)
    ? questions
    : questions
        .toString()
        .split("\n")
        .map((question) => ({ question }));

  return sourceQuestions
    .map((item) => ({
      question: (item.question || item.label || "")
        .toString()
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 220),
      required: item.required === true || item.required === "true",
    }))
    .filter((item) => item.question)
    .slice(0, 8);
};

const sanitizeCompanyApplicationCampaignPayload = (body = {}) => {
  const organizationName = (body.organizationName || body.company || "")
    .toString()
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 180);
  const opportunityTitle = (
    body.opportunityTitle ||
    body.title ||
    body.programTitle ||
    ""
  )
    .toString()
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 180);
  const companySlug = normalizeCompanyApplicationSlug(
    body.companySlug || organizationName
  );
  const slug = normalizeCompanyApplicationSlug(
    body.slug || `${companySlug}-${opportunityTitle || "training"}`
  );
  const requestedStatus = (body.status || "draft").toString().trim();
  const applicationDeadline = body.applicationDeadline
    ? new Date(body.applicationDeadline)
    : body.deadline
    ? new Date(body.deadline)
    : null;
  const hasValidDeadline =
    applicationDeadline && !Number.isNaN(applicationDeadline.getTime());
  const cities = normalizeArrayField(body.cities);
  const city = cities[0] || (body.city || "").toString().trim().slice(0, 120);
  const majorCategories = normalizeArrayField(body.majorCategories);
  const specialties = normalizeArrayField(body.specialties);
  const appliesToAllSpecialties =
    majorCategories.some(isGeneralSpecialtyValue) ||
    specialties.some(isGeneralSpecialtyValue);

  return {
    slug,
    companySlug,
    organizationName,
    organizationLogoUrl: sanitizeExternalUrl(
      body.organizationLogoUrl || body.logoUrl || ""
    ),
    opportunityTitle,
    city,
    cities: cities.length ? cities : city ? [city] : [],
    majorCategories: appliesToAllSpecialties ? [] : majorCategories,
    specialties: appliesToAllSpecialties ? [] : specialties,
    description: (body.description || "")
      .toString()
      .trim()
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .slice(0, 1600),
    customQuestions: sanitizeCompanyApplicationCampaignQuestions(
      body.customQuestions || body.questions || []
    ),
    status: ["draft", "open", "closed", "archived"].includes(requestedStatus)
      ? requestedStatus
      : "draft",
    allowDuplicateApplications: Boolean(body.allowDuplicateApplications),
    ...(hasValidDeadline
      ? { applicationDeadline }
      : { applicationDeadline: null }),
  };
};

const isCompanyApplicationCampaignOpen = (campaign = {}) => {
  if ((campaign.status || "draft") !== "open") return false;
  if (!campaign.applicationDeadline) return true;

  const deadlineDate = new Date(campaign.applicationDeadline);
  if (Number.isNaN(deadlineDate.getTime())) return true;

  return deadlineDate.getTime() >= Date.now();
};

const serializeCompanyApplicationCampaign = (campaign = {}, extra = {}) => {
  const id = campaign._id?.toString?.() || campaign.id || "";
  const isOpen = isCompanyApplicationCampaignOpen(campaign);

  return {
    id,
    _id: id,
    campaignId: id,
    slug: campaign.slug || "",
    companySlug: campaign.companySlug || campaign.slug || "",
    organizationName: campaign.organizationName || "",
    organizationLogoUrl: campaign.organizationLogoUrl || "",
    opportunityTitle: campaign.opportunityTitle || "",
    city: campaign.city || "",
    cities: Array.isArray(campaign.cities) ? campaign.cities : [],
    majorCategories: Array.isArray(campaign.majorCategories)
      ? campaign.majorCategories
      : [],
    specialties: Array.isArray(campaign.specialties) ? campaign.specialties : [],
    description: campaign.description || "",
    customQuestions: Array.isArray(campaign.customQuestions)
      ? campaign.customQuestions
      : [],
    applicationDeadline: campaign.applicationDeadline || null,
    status: isOpen ? campaign.status || "open" : campaign.status || "draft",
    isOpen,
    allowDuplicateApplications: Boolean(campaign.allowDuplicateApplications),
    applicationCount: Number(extra.applicationCount || 0),
    applyUrl: `${getFrontendUrl()}/apply/${campaign.slug || campaign.companySlug || id}`,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
  };
};

const getCompanyApplicationCampaignBySlug = async (slug = "") => {
  const normalizedSlug = normalizeCompanyApplicationSlug(slug);
  return CompanyApplicationCampaign.findOne({
    $or: [{ slug: normalizedSlug }, { companySlug: normalizedSlug }],
    status: { $ne: "archived" },
  }).lean();
};

const buildCompanyApplicationCampaignForApplication = (campaign = {}) => {
  const serialized = serializeCompanyApplicationCampaign(campaign);

  return {
    campaignId: serialized.id || serialized.slug,
    companySlug: serialized.companySlug || serialized.slug,
    organizationName: serialized.organizationName,
    organizationLogoUrl: serialized.organizationLogoUrl,
    opportunityTitle: serialized.opportunityTitle,
    opportunityId: null,
  };
};

const getPortfolioEmailForApplication = (portfolio = {}, contact = "") => {
  if (isValidEmail(portfolio.email || "")) return normalizeEmail(portfolio.email);
  if (isValidEmail(contact || "")) return normalizeEmail(contact);
  return "";
};

const getPortfolioPhoneForApplication = (portfolio = {}, contact = "") => {
  if (portfolio.phone) return portfolio.phone.toString().trim();
  if (isLegacyMobileSubscriberContact(contact)) return normalizeSaudiMobile(contact);
  return "";
};

const buildCompanyApplicationPortfolioUrl = (portfolio = {}) =>
  portfolio?.slug ? `${getFrontendUrl()}/p/${portfolio.slug}` : "";

const buildCompanyApplicationSnapshot = ({ portfolio = {}, contact = "", req = null } = {}) => {
  const cvAssetId = portfolio.cvAssetId || null;
  const cvAssetUrl = req && cvAssetId ? getPortfolioAssetUrl(req, cvAssetId) : "";

  return {
    fullName: portfolio.fullName || "",
    email: getPortfolioEmailForApplication(portfolio, contact),
    contact: contact || portfolio.contact || "",
    phone: getPortfolioPhoneForApplication(portfolio, contact),
    major: portfolio.major || "",
    university: portfolio.university || "",
    city: portfolio.city || "",
    degreeLevel: portfolio.degreeLevel || "",
    readinessStatus: portfolio.readinessStatus || "",
    bio: portfolio.bio || "",
    skills: Array.isArray(portfolio.skills) ? portfolio.skills.slice(0, 20) : [],
    projects: Array.isArray(portfolio.projects) ? portfolio.projects.slice(0, 12) : [],
    certifications: Array.isArray(portfolio.certifications)
      ? portfolio.certifications.slice(0, 12)
      : [],
    cvAssetId,
    cvUrl: cvAssetUrl || portfolio.cvUrl || "",
    linkedinUrl: portfolio.linkedinUrl || "",
    portfolioUrl: buildCompanyApplicationPortfolioUrl(portfolio),
    slug: portfolio.slug || "",
  };
};

const getCompanyApplicationMissingPortfolioFields = (portfolio = null, contact = "") => {
  const missing = [];

  if (!portfolio) {
    return [
      { field: "portfolio", label: "إنشاء ملف الأعمال" },
      { field: "fullName", label: "الاسم" },
      { field: "email", label: "البريد الإلكتروني" },
      { field: "major", label: "التخصص" },
      { field: "university", label: "الجامعة" },
      { field: "city", label: "المدينة" },
      { field: "cv", label: "السيرة الذاتية" },
    ];
  }

  if (!portfolio.fullName) missing.push({ field: "fullName", label: "الاسم" });
  if (!getPortfolioEmailForApplication(portfolio, contact)) {
    missing.push({ field: "email", label: "البريد الإلكتروني" });
  }
  if (!portfolio.major) missing.push({ field: "major", label: "التخصص" });
  if (!portfolio.university) missing.push({ field: "university", label: "الجامعة" });
  if (!portfolio.city) missing.push({ field: "city", label: "المدينة" });
  if (!portfolio.cvAssetId && !portfolio.cvUrl) {
    missing.push({ field: "cv", label: "السيرة الذاتية" });
  }

  return missing;
};

const serializeCompanyApplication = (application = {}) => {
  const status = normalizeCompanyApplicationStatusValue(application.status);
  const snapshot = application.portfolioSnapshot || {};
  const submittedAt = application.submittedAt || application.createdAt;
  const history = Array.isArray(application.statusHistory)
    ? application.statusHistory
    : [];
  const safeHistory = history.length
    ? history
    : [
        {
          status,
          changedAt: submittedAt,
          changedBy: "system",
          studentVisibleMessage:
            application.studentVisibleMessage || "تم إرسال الطلب عبر دربك.",
        },
      ];

  return {
    id: application._id?.toString?.() || application.id || "",
    _id: application._id?.toString?.() || application.id || "",
    studentId: application.studentId?.toString?.() || application.studentId || "",
    portfolioId: application.portfolioId?.toString?.() || application.portfolioId || "",
    campaignId: application.campaignId || application.companySlug || "",
    companySlug: application.companySlug || "",
    organizationName: application.organizationName || "",
    organizationLogoUrl: application.organizationLogoUrl || "",
    opportunityTitle: application.opportunityTitle || "",
    opportunityId:
      application.opportunityId?.toString?.() || application.opportunityId || "",
    fullName: application.fullName || snapshot.fullName || "",
    email: application.email || snapshot.email || "",
    phone: application.phone || snapshot.phone || "",
    major: application.major || snapshot.major || "",
    university: application.university || snapshot.university || "",
    city: application.city || snapshot.city || "",
    portfolioUrl: application.portfolioUrl || snapshot.portfolioUrl || "",
    linkedinUrl: application.linkedinUrl || snapshot.linkedinUrl || "",
    note: application.note || "",
    customAnswers: Array.isArray(application.customAnswers)
      ? application.customAnswers
      : [],
    consent: Boolean(application.consent),
    status,
    rawStatus: application.status || "",
    statusLabel: COMPANY_APPLICATION_STATUS_LABELS[status] || status,
    studentVisibleMessage: application.studentVisibleMessage || "",
    statusHistory: safeHistory.map((item) => ({
      status: normalizeCompanyApplicationStatusValue(item.status),
      statusLabel:
        COMPANY_APPLICATION_STATUS_LABELS[
          normalizeCompanyApplicationStatusValue(item.status)
        ] || item.status,
      changedAt: item.changedAt,
      changedBy: item.changedBy || "system",
      studentVisibleMessage: item.studentVisibleMessage || "",
    })),
    portfolioSnapshot: snapshot,
    submittedAt,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
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
  const metadata = sanitizeAnalyticsMetadata({
    provider: "moyasar",
    providerPaymentId,
    planId: subscription.planId || "monthly",
    planKey: getSubscriptionPlanKey(subscription),
    hasResumeAccess: subscriptionHasEntitlement(subscription, RESUME_ENTITLEMENT),
    priceSar: getSubscriptionPriceSar(subscription),
    durationDays: getSubscriptionDurationDays(subscription),
    source,
  });
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
  } else {
    await AnalyticsEvent.create({
      eventName: "premium_access_verified",
      visitorId: cleanVisitorId,
      page: "/subscriptions/moyasar",
      deviceType: "unknown",
      metadata,
    });
  }

  const existingCompletedEvent = await AnalyticsEvent.findOne({
    eventName: "subscription_completed",
    "metadata.providerPaymentId": providerPaymentId,
  });

  if (existingCompletedEvent) {
    if (cleanVisitorId && !existingCompletedEvent.visitorId) {
      existingCompletedEvent.visitorId = cleanVisitorId;
      existingCompletedEvent.metadata = {
        ...(existingCompletedEvent.metadata || {}),
        source: source || existingCompletedEvent.metadata?.source || "",
      };
      await existingCompletedEvent.save();
    }

    return existingCompletedEvent;
  }

  return AnalyticsEvent.create({
    eventName: "subscription_completed",
    visitorId: cleanVisitorId,
    page: "/subscriptions/moyasar",
    deviceType: "unknown",
    metadata,
  });
};

const recordPremiumPaymentEmailAttempt = async ({
  subscription,
  providerPaymentId = "",
  emailStatus = "",
  emailError = "",
  source = "",
  manualResend = false,
} = {}) => {
  if (!subscription) return null;

  return AnalyticsEvent.create({
    eventName: "premium_payment_email_attempt",
    page: "/subscriptions/moyasar",
    deviceType: "unknown",
    metadata: sanitizeAnalyticsMetadata({
      provider: subscription.provider || "moyasar",
      providerPaymentId,
      planId: subscription.planId || "monthly",
      priceSar: getSubscriptionPriceSar(subscription),
      durationDays: getSubscriptionDurationDays(subscription),
      emailTo: CONTACT_EMAIL_TO,
      emailFrom: CONTACT_EMAIL_FROM,
      emailStatus,
      emailError,
      source,
      manualResend: Boolean(manualResend),
    }),
  }).catch((err) => {
    console.error("❌ Premium email attempt analytics error:", err);
    return null;
  });
};

const getMoyasarPaymentMethodLabel = (invoice = {}) => {
  const payments = Array.isArray(invoice.payments) ? invoice.payments : [];
  const payment =
    payments.find((item) => item?.status === "paid") ||
    payments.find(Boolean) ||
    {};
  const source = payment.source || {};
  const directSource = invoice.source || {};
  const provider =
    source.company ||
    source.type ||
    source.name ||
    payment.source_type ||
    directSource.company ||
    directSource.type ||
    directSource.name ||
    "";
  const lastDigits =
    source.number ||
    source.last_digits ||
    source.last4 ||
    payment.last_digits ||
    directSource.number ||
    directSource.last_digits ||
    directSource.last4 ||
    "";

  return [provider, lastDigits ? `**** ${lastDigits.toString().slice(-4)}` : ""]
    .filter(Boolean)
    .join(" ");
};

const sendPremiumPaymentSuccessEmailOnce = async ({
  subscription,
  invoice = {},
  source = "",
  force = false,
} = {}) => {
  const providerPaymentId =
    subscription?.providerPaymentId || invoice?.id || invoice?.invoice_id || "";

  if (!subscription || !providerPaymentId) {
    await recordPremiumPaymentEmailAttempt({
      subscription,
      providerPaymentId,
      emailStatus: "skipped",
      emailError: "missing_subscription_or_provider_payment_id",
      source,
      manualResend: force,
    });
    return { emailStatus: "skipped", emailError: "missing_subscription" };
  }

  if (!RESEND_API_KEY || typeof fetch !== "function") {
    await recordPremiumPaymentEmailAttempt({
      subscription,
      providerPaymentId,
      emailStatus: "not_configured",
      source,
      manualResend: force,
    });
    return { emailStatus: "not_configured", emailError: "" };
  }

  if (!force) {
    const alreadySent = await AnalyticsEvent.findOne({
      eventName: "premium_payment_email_sent",
      "metadata.providerPaymentId": providerPaymentId,
    }).lean();

    if (alreadySent) {
      await recordPremiumPaymentEmailAttempt({
        subscription,
        providerPaymentId,
        emailStatus: "already_sent",
        source,
        manualResend: force,
      });
      return { emailStatus: "already_sent", emailError: "" };
    }
  }

  const plan = getSubscriptionPlan(subscription.planKey || subscription.planId);
  const priceSar = getSubscriptionPriceSar(subscription);
  const durationDays = getSubscriptionDurationDays(subscription);
  const paymentMethod = getMoyasarPaymentMethodLabel(invoice);
  const expiresAtLabel = formatRiyadhDateTime(subscription.expiresAt);
  const paidAtLabel = formatRiyadhDateTime(new Date());

  const text = [
    "تمت عملية دفع ناجحة في دربك+.",
    "",
    `وسيلة الدخول: ${subscription.email}`,
    `الباقة: ${plan.label}`,
    `المبلغ: ${priceSar} ريال`,
    `المدة: ${durationDays} يوم`,
    expiresAtLabel ? `ينتهي الاشتراك: ${expiresAtLabel}` : "",
    paymentMethod ? `طريقة الدفع: ${paymentMethod}` : "",
    `رقم فاتورة ميسر: ${providerPaymentId}`,
    source ? `مصدر التفعيل: ${source}` : "",
    `وقت الإشعار: ${paidAtLabel}`,
  ]
    .filter(Boolean)
    .join("\n");

  const payload = {
    from: CONTACT_EMAIL_FROM,
    to: [CONTACT_EMAIL_TO],
    subject: `دفع ناجح في دربك+ - ${priceSar} ريال`,
    text,
    html: `
      <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;color:#111827">
        <h2 style="margin:0 0 12px;color:#0f766e">دفع ناجح في دربك+</h2>
        <p>تم تفعيل اشتراك جديد بنجاح عبر ميسر.</p>
        <table style="width:100%;border-collapse:collapse;margin-top:12px">
          <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>وسيلة الدخول</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtml(subscription.email)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>الباقة</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtml(plan.label)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>المبلغ</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtml(priceSar)} ريال</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>المدة</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtml(durationDays)} يوم</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>انتهاء الاشتراك</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtml(expiresAtLabel || "غير محدد")}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>طريقة الدفع</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtml(paymentMethod || "غير موضحة")}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>فاتورة ميسر</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtml(providerPaymentId)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>مصدر التفعيل</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtml(source || "غير محدد")}</td></tr>
        </table>
      </div>
    `,
  };

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
    const emailError =
      errorBody.slice(0, 600) || `Resend status ${response.status}`;
    await recordPremiumPaymentEmailAttempt({
      subscription,
      providerPaymentId,
      emailStatus: "failed",
      emailError,
      source,
      manualResend: force,
    });
    return {
      emailStatus: "failed",
      emailError,
    };
  }

  await recordPremiumPaymentEmailAttempt({
    subscription,
    providerPaymentId,
    emailStatus: "sent",
    source,
    manualResend: force,
  });

  await AnalyticsEvent.create({
    eventName: "premium_payment_email_sent",
    page: "/subscriptions/moyasar",
    deviceType: "unknown",
    metadata: sanitizeAnalyticsMetadata({
      provider: "moyasar",
      providerPaymentId,
      planId: subscription.planId || "monthly",
      planKey: getSubscriptionPlanKey(subscription),
      priceSar,
      durationDays,
      emailTo: CONTACT_EMAIL_TO,
      source,
      manualResend: Boolean(force),
    }),
  });

  return { emailStatus: "sent", emailError: "" };
};

const getMoyasarPaymentSourceForSubscription = async (subscription = {}) => {
  const providerPaymentId = (subscription.providerPaymentId || "").toString().trim();

  if (!providerPaymentId) {
    return {};
  }

  if (subscription.provider !== "moyasar") {
    return {
      id: providerPaymentId,
      status: subscription.status || "",
    };
  }

  try {
    return await getMoyasarInvoice(providerPaymentId);
  } catch (invoiceErr) {
    try {
      return await getMoyasarPayment(providerPaymentId);
    } catch (paymentErr) {
      console.warn("⚠️ Could not load Moyasar payment source for email resend:", {
        providerPaymentId,
        invoiceError: invoiceErr.message,
        paymentError: paymentErr.message,
      });
      return {
        id: providerPaymentId,
        status: subscription.status || "",
      };
    }
  }
};

const extractMoyasarInvoiceId = (payload = {}, { allowRootId = true } = {}) => {
  const data = payload.data || payload.payment || payload.invoice || {};
  const object = data.object || payload.object || {};
  const candidates = [
    payload.invoice_id,
    payload.invoiceId,
    data.invoice_id,
    data.invoiceId,
    object.invoice_id,
    object.invoiceId,
    payload.invoice?.id,
    data.invoice?.id,
    object.invoice?.id,
    payload.metadata?.invoice_id,
    data.metadata?.invoice_id,
    object.metadata?.invoice_id,
    allowRootId ? payload.id : "",
    allowRootId ? data.id : "",
    allowRootId ? object.id : "",
  ];

  return (
    candidates
      .map((value) => (value || "").toString().trim())
      .find(Boolean) || ""
  );
};

const extractMoyasarPaymentId = (payload = {}, { allowRootId = true } = {}) => {
  const data = payload.data || payload.payment || {};
  const object = data.object || payload.object || {};
  const candidates = [
    payload.payment_id,
    payload.paymentId,
    data.payment_id,
    data.paymentId,
    object.payment_id,
    object.paymentId,
    payload.payment?.id,
    data.payment?.id,
    object.payment?.id,
    allowRootId ? payload.id : "",
    allowRootId ? data.id : "",
    allowRootId ? object.id : "",
  ];

  return (
    candidates
      .map((value) => (value || "").toString().trim())
      .find(Boolean) || ""
  );
};

const getMoyasarPayloadStatus = (payload = {}) =>
  (
    payload.status ||
    payload.data?.status ||
    payload.data?.object?.status ||
    payload.object?.status ||
    payload.payment?.status ||
    payload.invoice?.status ||
    ""
  )
    .toString()
    .toLowerCase();

const getMoyasarEventType = (payload = {}) =>
  (
    payload.type ||
    payload.event ||
    payload.name ||
    payload.event_type ||
    payload.eventType ||
    payload.data?.event_type ||
    payload.data?.eventType ||
    ""
  )
    .toString()
    .toLowerCase();

const moyasarPayloadLooksLikeInvoice = (payload = {}) =>
  Boolean(
    Array.isArray(payload.payments) ||
      payload.url ||
      payload.success_url ||
      payload.callback_url ||
      payload.invoice ||
      payload.data?.invoice ||
      payload.data?.object?.payments
  );

const findSubscriptionFromMoyasarPayment = async (payment = {}) => {
  const metadata = payment.metadata || {};
  const contact = normalizeSubscriberContact(
    metadata.darbak_contact ||
      metadata.contact ||
      metadata.email ||
      metadata.customer_email ||
      ""
  );
  const planId = (metadata.plan_id || metadata.planId || "").toString().trim();
  const planKey = normalizePlanKey(
    metadata.plan_key || metadata.planKey || planId || PLUS_PLAN_KEY
  );

  if (!contact) return null;

  return Subscription.findOne({
    email: contact,
    provider: "moyasar",
    status: { $in: ["pending", "active"] },
    ...(planId ? { $or: [{ planId }, { planKey }] } : { planKey }),
  })
    .sort({ updatedAt: -1 })
    .lean();
};

const activateMoyasarSubscriptionRecord = async ({
  existingSubscription,
  paymentSource = {},
  source = "",
  visitorId = "",
} = {}) => {
  if (!existingSubscription) {
    const error = new Error("Subscription not found");
    error.statusCode = 404;
    throw error;
  }

  const alreadyActive =
    existingSubscription.status === "active" &&
    existingSubscription.expiresAt &&
    new Date(existingSubscription.expiresAt) > new Date();

  const planKey = getSubscriptionPlanKey(existingSubscription);
  const plan = getSubscriptionPlan(planKey);
  const now = new Date();
  const computedWindow = calculateAccessWindow({
    currentExpiresAt: existingSubscription.expiresAt,
    durationDays: getSubscriptionDurationDays(existingSubscription),
    now,
    extendFromCurrent: false,
  });
  const storedExpiry = existingSubscription.expiresAt
    ? new Date(existingSubscription.expiresAt)
    : null;
  const activationExpiresAt =
    storedExpiry && !Number.isNaN(storedExpiry.getTime()) && storedExpiry > now
      ? storedExpiry
      : computedWindow.expiresAt;

  const subscription = alreadyActive
    ? existingSubscription
    : await Subscription.findByIdAndUpdate(
        existingSubscription._id,
        {
          status: "active",
          planId: plan.id,
          planKey,
          entitlements: getPlanEntitlements(planKey, process.env),
          priceSar: getSubscriptionPriceSar(existingSubscription) || plan.priceSar,
          durationDays:
            getSubscriptionDurationDays(existingSubscription) || plan.durationDays,
          startsAt: existingSubscription.startsAt || now,
          expiresAt: activationExpiresAt,
          aiResumeUsageCount: Number(existingSubscription.aiResumeUsageCount || 0),
          aiResumeUsageLimit: getSubscriptionAiResumeUsageLimit({
            ...existingSubscription,
            planKey,
          }),
          aiResumeUsageResetAt:
            existingSubscription.aiResumeUsageResetAt || activationExpiresAt,
        },
        { new: true }
      ).lean();

  if (!subscription) {
    const error = new Error("Subscription not found");
    error.statusCode = 404;
    throw error;
  }

  await syncSubscriptionUser(subscription);
  await recordPremiumAccessVerifiedEvent({
    subscription,
    visitorId,
    source,
  });

  const emailResult = await sendPremiumPaymentSuccessEmailOnce({
    subscription,
    invoice: paymentSource,
    source,
  });

  if (emailResult.emailStatus === "failed") {
    console.error("❌ Premium payment email failed:", emailResult.emailError);
  }

  return {
    ok: true,
    active: true,
    status: paymentSource.status || "paid",
    alreadyActive,
    emailStatus: emailResult.emailStatus,
  };
};

const activateMoyasarSubscriptionFromInvoiceId = async ({
  invoiceId = "",
  source = "",
  visitorId = "",
} = {}) => {
  if (!invoiceId) {
    return { ok: true, ignored: true, status: "missing_invoice_id" };
  }

  const invoice = await getMoyasarInvoice(invoiceId);
  const status = invoice.status || "";

  if (status !== "paid") {
    if (["expired", "failed", "canceled", "cancelled"].includes(status)) {
      await Subscription.findOneAndUpdate(
        { provider: "moyasar", providerPaymentId: invoiceId },
        { status: "cancelled" }
      );
    }

    return { ok: true, ignored: true, status };
  }

  const existingSubscription = await Subscription.findOne({
    provider: "moyasar",
    providerPaymentId: invoiceId,
  }).lean();

  return activateMoyasarSubscriptionRecord({
    existingSubscription,
    paymentSource: invoice,
    source,
    visitorId,
  });
};

const activateMoyasarSubscriptionFromPayment = async ({
  payment = {},
  source = "",
  visitorId = "",
} = {}) => {
  const paymentData = payment.data?.object || payment.data || payment;
  const status = (paymentData.status || "").toString().toLowerCase();
  const invoiceId =
    paymentData.invoice_id ||
    paymentData.invoiceId ||
    paymentData.invoice?.id ||
    paymentData.metadata?.invoice_id ||
    "";

  if (invoiceId) {
    return activateMoyasarSubscriptionFromInvoiceId({
      invoiceId,
      source,
      visitorId,
    });
  }

  if (status !== "paid") {
    return { ok: true, ignored: true, status };
  }

  const existingSubscription = await findSubscriptionFromMoyasarPayment(paymentData);
  return activateMoyasarSubscriptionRecord({
    existingSubscription,
    paymentSource: paymentData,
    source,
    visitorId,
  });
};

const activateMoyasarSubscriptionFromPaymentId = async ({
  paymentId = "",
  source = "",
  visitorId = "",
} = {}) => {
  if (!paymentId) {
    return { ok: true, ignored: true, status: "missing_payment_id" };
  }

  const payment = await getMoyasarPayment(paymentId);
  return activateMoyasarSubscriptionFromPayment({
    payment,
    source,
    visitorId,
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
  const cacheKey = `item-stats:${itemType}:${cleanIds.sort().join(",")}`;
  const cachedStats = getReadCache(cacheKey);
  if (cachedStats) return cachedStats;

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

  const stats = rows.reduce((statsMap, row) => {
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

  return setReadCache(cacheKey, stats, INTERACTION_STATS_CACHE_TTL_MS);
};

const getOrganizationInteractionStats = async (items = [], itemType = "") => {
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
  const eventNames = itemInteractionConfig[itemType]?.eventBuckets
    ? Object.keys(itemInteractionConfig[itemType].eventBuckets)
    : [];
  const cacheKey = `organization-stats:${itemType}:${wantedNames
    .sort()
    .join("|")}`;
  const cachedStats = getReadCache(cacheKey);
  if (cachedStats) return cachedStats;

  const rows = await AnalyticsEvent.aggregate([
    {
      $match: {
        eventName:
          eventNames.length > 0 ? { $in: eventNames } : { $ne: "session_ping" },
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

  const stats = wantedNames.reduce((statsMap, wantedName) => {
    const total = normalizedRows.reduce((sum, row) => {
      const isSameOrganization = row.variants.some((variant) =>
        isSameOrganizationName(wantedName, variant)
      );

      return isSameOrganization ? sum + row.count : sum;
    }, 0);

    statsMap.set(wantedName, total);
    return statsMap;
  }, new Map());

  return setReadCache(cacheKey, stats, INTERACTION_STATS_CACHE_TTL_MS);
};

const attachItemInteractionCounts = async (itemType, items = []) => {
  const safeItems = Array.isArray(items) ? items : [];
  const [stats, organizationStats] = await Promise.all([
    getItemInteractionStats(
      itemType,
      safeItems.map((item) => item?._id)
    ),
    getOrganizationInteractionStats(safeItems, itemType),
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

const providerPaymentTrackedPremiumEvents = [
  "premium_checkout_started",
  "checkout_started",
  "premium_payment_returned",
  "premium_access_verified",
  "subscription_completed",
];

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
                  $nin: providerPaymentTrackedPremiumEvents,
                },
              },
              {
                $and: [
                  {
                    eventName: {
                      $in: providerPaymentTrackedPremiumEvents,
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
                    providerPaymentTrackedPremiumEvents,
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

const getSimpleEventAnalytics = (match, eventNames = []) =>
  AnalyticsEvent.aggregate([
    {
      $match: {
        ...match,
        eventName: { $in: eventNames },
      },
    },
    {
      $group: {
        _id: "$eventName",
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

const ANALYTICS_DAY_TIMEZONE = "Asia/Riyadh";
const buildAnalyticsDayProjection = (dateField = "$createdAt") => ({
  $dateToString: {
    format: "%Y-%m-%d",
    date: dateField,
    timezone: ANALYTICS_DAY_TIMEZONE,
  },
});

const buildDailyPremiumFunnel = async (match = {}) => {
  const dailyBaseEvents = await AnalyticsEvent.aggregate([
    {
      $match: {
        ...match,
        eventName: {
          $in: ["page_view", "premium_gate_opened", "premium_plan_selected"],
        },
      },
    },
    {
      $project: {
        eventName: 1,
        visitorId: 1,
        day: buildAnalyticsDayProjection(),
      },
    },
    {
      $group: {
        _id: { day: "$day", eventName: "$eventName" },
        count: { $sum: 1 },
        uniqueVisitorIds: { $addToSet: "$visitorId" },
      },
    },
    {
      $project: {
        _id: 0,
        day: "$_id.day",
        eventName: "$_id.eventName",
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
  ]);

  const dailyCheckoutStarted = await AnalyticsEvent.aggregate([
    {
      $match: {
        ...match,
        eventName: { $in: ["checkout_started", "premium_checkout_started"] },
        "metadata.providerPaymentId": { $exists: true, $ne: "" },
      },
    },
    {
      $project: {
        visitorId: 1,
        providerPaymentId: "$metadata.providerPaymentId",
        day: buildAnalyticsDayProjection(),
      },
    },
    {
      $group: {
        _id: { day: "$day", providerPaymentId: "$providerPaymentId" },
        visitorId: { $first: "$visitorId" },
      },
    },
    {
      $group: {
        _id: "$_id.day",
        count: { $sum: 1 },
        uniqueVisitorIds: { $addToSet: "$visitorId" },
      },
    },
    {
      $project: {
        _id: 0,
        day: "$_id",
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
  ]);

  const dailySubscriptionCompleted = await AnalyticsEvent.aggregate([
    {
      $match: {
        ...match,
        eventName: "subscription_completed",
        "metadata.providerPaymentId": { $exists: true, $ne: "" },
      },
    },
    {
      $project: {
        visitorId: 1,
        providerPaymentId: "$metadata.providerPaymentId",
        day: buildAnalyticsDayProjection(),
      },
    },
    {
      $group: {
        _id: { day: "$day", providerPaymentId: "$providerPaymentId" },
        visitorId: { $first: "$visitorId" },
      },
    },
    {
      $group: {
        _id: "$_id.day",
        count: { $sum: 1 },
        uniqueVisitorIds: { $addToSet: "$visitorId" },
      },
    },
    {
      $project: {
        _id: 0,
        day: "$_id",
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
  ]);

  const subscriptionDateMatch = match.createdAt
    ? { updatedAt: match.createdAt }
    : {};
  const dailyPaidSubscriptions = await Subscription.aggregate([
    {
      $match: {
        ...subscriptionDateMatch,
        provider: "moyasar",
        status: "active",
        providerPaymentId: { $nin: [null, ""] },
      },
    },
    {
      $project: {
        day: buildAnalyticsDayProjection("$updatedAt"),
      },
    },
    {
      $group: {
        _id: "$day",
        count: { $sum: 1 },
      },
    },
    { $project: { _id: 0, day: "$_id", count: 1 } },
  ]);

  const rowMap = new Map();
  const ensureRow = (day) => {
    if (!rowMap.has(day)) {
      rowMap.set(day, {
        date: day,
        visits: 0,
        visitsVisitors: 0,
        subscriptionWindowShown: 0,
        subscriptionWindowVisitors: 0,
        paymentPageClicks: 0,
        paymentPageClickVisitors: 0,
        checkoutStarted: 0,
        checkoutStartedVisitors: 0,
        paymentSuccessful: 0,
        paymentSuccessfulVisitors: 0,
      });
    }

    return rowMap.get(day);
  };

  dailyBaseEvents.forEach((item) => {
    const row = ensureRow(item.day);
    if (item.eventName === "page_view") {
      row.visits = item.count;
      row.visitsVisitors = item.uniqueVisitors;
    } else if (item.eventName === "premium_gate_opened") {
      row.subscriptionWindowShown = item.count;
      row.subscriptionWindowVisitors = item.uniqueVisitors;
    } else if (item.eventName === "premium_plan_selected") {
      row.paymentPageClicks = item.count;
      row.paymentPageClickVisitors = item.uniqueVisitors;
    }
  });

  dailyCheckoutStarted.forEach((item) => {
    const row = ensureRow(item.day);
    row.checkoutStarted = item.count;
    row.checkoutStartedVisitors = item.uniqueVisitors;
  });

  dailySubscriptionCompleted.forEach((item) => {
    const row = ensureRow(item.day);
    row.paymentSuccessful = item.count;
    row.paymentSuccessfulVisitors = item.uniqueVisitors;
  });

  dailyPaidSubscriptions.forEach((item) => {
    const row = ensureRow(item.day);
    row.paymentSuccessful = Math.max(row.paymentSuccessful, item.count);
  });

  return Array.from(rowMap.values())
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 120);
};

const getPortfolioFieldGroup = (field, limit = 10) =>
  Portfolio.aggregate([
    { $match: { [field]: { $nin: [null, ""] } } },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: limit },
    { $project: { _id: 0, label: "$_id", count: 1 } },
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

const getOrganizationSearchTerms = (value = "") => {
  const rawValue = value.toString().trim();
  const normalizedValue = normalizeSearchText(rawValue);
  if (!normalizedValue) return [];

  const matchedGroup = SMART_ASSISTANT_ORG_ALIASES.find((group) =>
    [group.label, ...group.aliases].some((term) => {
      const normalizedTerm = normalizeSearchText(term);
      return (
        normalizedTerm === normalizedValue ||
        normalizedTerm.includes(normalizedValue) ||
        normalizedValue.includes(normalizedTerm)
      );
    })
  );

  return Array.from(
    new Set([rawValue, matchedGroup?.label, ...(matchedGroup?.aliases || [])].filter(Boolean))
  );
};

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

const getActiveFeaturedAmbassadorFilter = () => ({
  $and: [
    getApprovedExperiencesFilter(),
    {
      featuredAmbassador: true,
      ambassadorConsent: "yes",
      featuredAmbassadorUntil: { $gt: new Date() },
      $or: [
        { ambassadorLinkedInUrl: { $exists: true, $ne: "" } },
        { ambassadorDisplayName: { $exists: true, $ne: "" } },
      ],
    },
  ],
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
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ===== MongoDB Connection =====
mongoose.connect(process.env.MONGO_URI, {
  maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE || 20),
  minPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE || 2),
  serverSelectionTimeoutMS: Number(
    process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 10000
  ),
  socketTimeoutMS: Number(process.env.MONGO_SOCKET_TIMEOUT_MS || 45000),
})
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

    const cachedStats = getReadCache("home-stats:v2");
    if (cachedStats) {
      return res.json(cachedStats);
    }

    const approvedFilter = {
      $or: [{ status: "approved" }, { status: { $exists: false } }],
    };
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const currentOpportunitiesFilter = {
      status: "active",
      $or: [
        { deadline: { $exists: false } },
        { deadline: null },
        { deadline: { $gte: startOfToday } },
      ],
    };
    const activeSubscriptionFilter = {
      status: "active",
      expiresAt: { $gt: new Date() },
    };

    const [
      experiencesCount,
      experienceOrganizationNames,
      opportunityOrganizationNames,
      currentProgramsCount,
      opportunityApplyClicksCount,
      opportunityApplyVisitorIds,
      activeSubscriberEmails,
    ] =
      await Promise.all([
        Experience.countDocuments(approvedFilter),
        Experience.distinct("organizationName", approvedFilter),
        Opportunity.distinct("organizationName", {
          status: { $in: ["active", "expired"] },
        }),
        Opportunity.countDocuments(currentOpportunitiesFilter),
        AnalyticsEvent.countDocuments({
          eventName: "opportunity_apply_clicked",
        }),
        AnalyticsEvent.distinct("visitorId", {
          eventName: "opportunity_apply_clicked",
          visitorId: { $type: "string", $nin: [""] },
        }),
        Subscription.distinct("email", activeSubscriptionFilter),
      ]);
    const organizationNames = uniqueTruthy([
      ...experienceOrganizationNames,
      ...opportunityOrganizationNames,
    ]);
    const opportunityApplyUniqueVisitorsCount =
      opportunityApplyVisitorIds.filter(Boolean).length;

    const payload = {
      experiencesCount,
      organizationNames,
      organizationsCount: organizationNames.length,
      currentProgramsCount,
      studentsAppliedCount: opportunityApplyClicksCount,
      opportunityApplyClicksCount,
      opportunityApplyUniqueVisitorsCount,
      activeSubscribersCount: activeSubscriberEmails.filter(Boolean).length,
    };

    res.json(setReadCache("home-stats:v2", payload, HOME_STATS_CACHE_TTL_MS));
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

    const rawEvents = Array.isArray(req.body?.events)
      ? req.body.events.slice(0, 30)
      : [req.body];
    const events = rawEvents
      .map((rawEvent = {}) => {
        const eventName = sanitizeAnalyticsText(rawEvent.eventName, 80);
        if (!eventName) return null;

        return {
          eventName,
          visitorId: sanitizeAnalyticsText(rawEvent.visitorId, 90),
          page: sanitizeAnalyticsText(rawEvent.page, 160),
          deviceType: ["mobile", "tablet", "desktop", "unknown"].includes(
            rawEvent.deviceType
          )
            ? rawEvent.deviceType
            : "unknown",
          major: sanitizeAnalyticsText(rawEvent.major, 120),
          majorCategory: sanitizeAnalyticsText(rawEvent.majorCategory, 120),
          city: sanitizeAnalyticsText(rawEvent.city, 80),
          searchQuery: sanitizeAnalyticsText(rawEvent.searchQuery, 180),
          resultsCount: Number.isFinite(Number(rawEvent.resultsCount))
            ? Number(rawEvent.resultsCount)
            : 0,
          metadata: sanitizeAnalyticsMetadata(rawEvent.metadata),
        };
      })
      .filter(Boolean);

    if (events.length === 0) {
      return res.status(400).json({ error: "eventName is required" });
    }

    const insertedEvents =
      events.length === 1
        ? [await AnalyticsEvent.create(events[0])]
        : await AnalyticsEvent.insertMany(events, { ordered: false });

    res.json({
      ok: true,
      count: insertedEvents.length,
      id: insertedEvents[0]?._id,
    });
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

app.post('/api/access/reminder-shown', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const user = await ensureAccessUser(getAccessIdentityFromRequest(req));
    if (!user) {
      return res.status(400).json({ error: "تعذر تحديد المستخدم." });
    }

    const now = new Date();
    await User.findByIdAndUpdate(user._id, {
      $set: { subscriptionReminderLastShownAt: now },
    });

    res.json({ ok: true, subscriptionReminderLastShownAt: now });
  } catch (err) {
    console.error("❌ Access reminder update error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/account/reward-identity', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const rawEmail = req.body.email || req.body.contact;
    const contact = normalizeSubscriberContact(rawEmail);
    const accessCode = normalizeAccessCode(req.body.accessCode);
    const visitorId = sanitizeAnalyticsText(req.body.visitorId, 90);

    if (!isValidEmail(rawEmail)) {
      return res.status(400).json({
        error: "اكتب بريدًا إلكترونيًا صحيحًا لحساب مكافأة التجربة.",
      });
    }

    if (!isValidAccessCode(accessCode)) {
      return res.status(400).json({
        error: "اختَر رمز دخول من 4 إلى 12 رقم أو حرف إنجليزي.",
      });
    }

    const user = await ensureAccessUser({ contact, accessCode, visitorId });

    res.json({
      ok: true,
      contact,
      userId: user?._id,
      message: "تم حفظ حساب مكافأة التجربة.",
    });
  } catch (err) {
    console.error("❌ Reward identity create error:", err);
    res.status(500).json({ error: err.message });
  }
});

const getAuthenticatedAccessContext = async (req = {}) => {
  const { contact: rawContact, accessCode: rawAccessCode, visitorId } =
    getAccessIdentityFromRequest(req);
  const contact = normalizeSubscriberContact(rawContact);
  const accessCode = normalizeAccessCode(rawAccessCode);

  if (!isValidSubscriberContact(rawContact) || !isValidAccessCode(accessCode)) {
    return {
      ok: false,
      statusCode: 401,
      reason: "login_required",
      error: "سجّل الدخول بالبريد الإلكتروني ورمز الدخول للمتابعة.",
    };
  }

  const accessCodeHash = hashAccessCode(contact, accessCode);
  let user = await ensureAccessUser({ contact, accessCode, visitorId });
  const activeSubscription = await Subscription.findOne(
    getActiveSubscriptionFilter(contact, accessCodeHash)
  )
    .sort({ updatedAt: -1 })
    .lean();

  if (activeSubscription) {
    user = await syncSubscriptionUser(activeSubscription);
  }

  const isAdmin = Boolean(user?.isAdmin) || isAdminContact(contact, accessCode);
  const manualAccess = getActiveManualAccessWindow(user, new Date());
  const isPremium = isAdmin || Boolean(activeSubscription) || Boolean(manualAccess);
  const subscriptionAccess = activeSubscription
    ? buildSubscriptionAccessPayload(activeSubscription)
    : null;
  const entitlements = isAdmin
    ? [PLUS_ENTITLEMENT, RESUME_ENTITLEMENT]
    : subscriptionAccess?.entitlements || manualAccess?.entitlements || [];

  return {
    ok: true,
    contact,
    accessCode,
    accessCodeHash,
    user,
    subscription: activeSubscription,
    isAdmin,
    isPremium,
    manualAccess,
    entitlements,
    planKey: isAdmin
      ? RESUME_PLAN_KEY
      : subscriptionAccess?.planKey || manualAccess?.planKey || "",
    hasResumeAccess: isAdmin || entitlements.includes(RESUME_ENTITLEMENT),
  };
};

const requireResumeAccess = async (req, res, next) => {
  try {
    const context = await getAuthenticatedAccessContext(req);
    if (!context.ok) {
      return res.status(context.statusCode || 401).json({
        error: context.error,
        reason: context.reason,
      });
    }

    if (!RESUME_PLAN_LAUNCH_ENABLED && !context.isAdmin) {
      return res.status(403).json({
        error: "خدمة سيرتي بدربك قيد التجهيز حاليًا.",
        reason: "resume_plan_not_launched",
        planKey: RESUME_PLAN_KEY,
      });
    }

    if (!context.isPremium) {
      return res.status(402).json({
        error: "خدمة سيرتي بدربك ضمن مزايا دربك+ سيرة.",
        reason: "subscription_required",
        planKey: PLUS_PLAN_KEY,
      });
    }

    if (!context.hasResumeAccess) {
      return res.status(403).json({
        error: "هذه الخدمة تحتاج ترقية إلى دربك+ سيرة.",
        reason: "resume_plan_required",
        currentPlanKey: context.planKey || PLUS_PLAN_KEY,
      });
    }

    req.darbakAccess = context;
    return next();
  } catch (err) {
    console.error("❌ Resume access middleware error:", err);
    return res.status(500).json({ error: "تعذر التحقق من صلاحية خدمة السيرة." });
  }
};

const sanitizeResumeText = (value = "", maxLength = 800) =>
  sanitizePortfolioLongText(value, maxLength);

const RESUME_SECTION_KEYS = [
  "summary",
  "education",
  "experience",
  "projects",
  "skills",
  "certifications",
  "volunteering",
  "languages",
  "links",
];

const sanitizeResumeId = (value = "") =>
  value
    .toString()
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 80);

const stripResumeHtml = (value = "") =>
  value
    .toString()
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li)>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s{2,}/g, " ")
    .trim();

const escapeResumeHtml = (value = "") =>
  value
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const sanitizeResumeRichHtml = (value = "", maxLength = 1800) => {
  let html = sanitizeResumeText(value, maxLength);
  if (!html) return "";

  html = html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/\s(href|src)="javascript:[^"]*"/gi, "")
    .replace(/\s(href|src)='javascript:[^']*'/gi, "");

  html = html.replace(/<\/?([a-z0-9]+)(\s[^>]*)?>/gi, (match, tagName) => {
    const tag = tagName.toLowerCase();
    const allowed = ["p", "br", "strong", "b", "em", "i", "ul", "ol", "li"];
    if (!allowed.includes(tag)) return "";
    return match.startsWith("</") ? `</${tag}>` : `<${tag}>`;
  });

  return html.slice(0, maxLength);
};

const sanitizeResumeAchievement = (achievement = {}) => {
  const html = sanitizeResumeRichHtml(achievement.html || achievement.text || "", 1600);
  const text = sanitizeResumeText(achievement.text || stripResumeHtml(html), 700);

  return {
    id: sanitizeResumeId(achievement.id) || `ach-${Date.now().toString(36)}`,
    text,
    html,
  };
};

const sanitizeResumeAchievements = (achievements = [], fallback = "") => {
  const rawItems = Array.isArray(achievements) ? achievements : [];
  const cleanItems = rawItems
    .slice(0, 8)
    .map(sanitizeResumeAchievement)
    .filter((achievement) => achievement.text || achievement.html);

  if (!cleanItems.length && fallback) {
    const text = sanitizeResumeText(fallback, 700);
    if (text) {
      cleanItems.push({
        id: `ach-${Date.now().toString(36)}`,
        text,
        html: `<p>${escapeResumeHtml(text)}</p>`,
      });
    }
  }

  return cleanItems;
};

const sanitizeResumeEntry = (entry = {}) => {
  const details = sanitizeResumeText(entry.details || entry.description, 900);
  return {
    id: sanitizeResumeId(entry.id) || `entry-${Date.now().toString(36)}`,
    title: sanitizePortfolioText(entry.title, 140),
    subtitle: sanitizePortfolioText(entry.subtitle, 180),
    organization: sanitizePortfolioText(entry.organization || entry.subtitle, 160),
    period: sanitizePortfolioText(entry.period, 90),
    startDate: sanitizePortfolioText(entry.startDate, 40),
    endDate: sanitizePortfolioText(entry.endDate, 40),
    isCurrent: Boolean(entry.isCurrent),
    location: sanitizePortfolioText(entry.location, 90),
    url: sanitizePortfolioUrl(entry.url, 260),
    description: details,
    details,
    achievements: sanitizeResumeAchievements(entry.achievements, details),
  };
};

const sanitizeResumeEntries = (entries = [], maxItems = 8) =>
  (Array.isArray(entries) ? entries : [])
    .slice(0, maxItems)
    .map(sanitizeResumeEntry)
    .filter(
      (entry) =>
        entry.title ||
        entry.subtitle ||
        entry.organization ||
        entry.period ||
        entry.description ||
        entry.achievements.length
    );

const sanitizeResumeLanguages = (languages = []) =>
  (Array.isArray(languages) ? languages : [])
    .slice(0, 8)
    .map((language) => ({
      id: sanitizeResumeId(language.id) || `language-${Date.now().toString(36)}`,
      name: sanitizePortfolioText(language.name, 70),
      level: sanitizePortfolioText(language.level, 70),
    }))
    .filter((language) => language.name || language.level);

const sanitizeResumeLinks = (links = []) =>
  (Array.isArray(links) ? links : [])
    .slice(0, 8)
    .map((link) => ({
      id: sanitizeResumeId(link.id) || `link-${Date.now().toString(36)}`,
      label: sanitizePortfolioText(link.label, 70),
      url: sanitizePortfolioUrl(link.url, 260),
    }))
    .filter((link) => link.label || link.url);

const sanitizeResumeSectionOrder = (sectionOrder = []) => {
  const requested = Array.isArray(sectionOrder) ? sectionOrder : [];
  const clean = requested.filter((section) => RESUME_SECTION_KEYS.includes(section));
  return [...clean, ...RESUME_SECTION_KEYS.filter((section) => !clean.includes(section))];
};

const sanitizeResumeSettings = (settings = {}) => {
  const language = settings.language === "en" ? "en" : "ar";
  const direction = settings.direction === "ltr" || language === "en" ? "ltr" : "rtl";
  const density = settings.density === "compact" ? "compact" : "comfortable";
  const fontSize = ["small", "medium", "large"].includes(settings.fontSize)
    ? settings.fontSize
    : "medium";

  return { language, direction, density, fontSize };
};

const sanitizeResumePayload = (body = {}) => {
  const personalInfo = body.personalInfo || {};
  const experienceEntries = body.experience || body.experiences || [];

  return {
    personalInfo: {
      fullName: sanitizePortfolioText(personalInfo.fullName, 120),
      email: sanitizePortfolioText(personalInfo.email, 160).toLowerCase(),
      phone: sanitizePortfolioText(personalInfo.phone, 40),
      city: sanitizePortfolioText(personalInfo.city, 80),
      major: sanitizePortfolioText(personalInfo.major, 120),
      university: sanitizePortfolioText(personalInfo.university, 160),
      linkedinUrl: sanitizePortfolioUrl(personalInfo.linkedinUrl, 260),
      headline: sanitizePortfolioText(personalInfo.headline, 140),
      portfolioUrl: sanitizePortfolioUrl(personalInfo.portfolioUrl, 260),
      githubUrl: sanitizePortfolioUrl(personalInfo.githubUrl, 260),
      personalUrl: sanitizePortfolioUrl(personalInfo.personalUrl, 260),
    },
    summary: sanitizeResumeText(body.summary, 900),
    education: sanitizeResumeEntries(body.education, 6),
    experiences: sanitizeResumeEntries(experienceEntries, 8),
    experience: sanitizeResumeEntries(experienceEntries, 8),
    projects: sanitizeResumeEntries(body.projects, 8),
    certifications: sanitizeResumeEntries(body.certifications, 10),
    volunteering: sanitizeResumeEntries(body.volunteering, 8),
    languages: sanitizeResumeLanguages(body.languages),
    links: sanitizeResumeLinks(body.links),
    skills: (Array.isArray(body.skills) ? body.skills : [])
      .map((skill) => sanitizePortfolioText(skill, 60))
      .filter(Boolean)
      .slice(0, 30),
    sectionOrder: sanitizeResumeSectionOrder(body.sectionOrder),
    hiddenSections: (Array.isArray(body.hiddenSections) ? body.hiddenSections : [])
      .filter((section) => RESUME_SECTION_KEYS.includes(section))
      .slice(0, RESUME_SECTION_KEYS.length),
    settings: sanitizeResumeSettings(body.settings),
  };
};

const mapPortfolioToResumePayload = (portfolio = {}, contact = "") => ({
  personalInfo: {
    fullName: portfolio.fullName || "",
    email: portfolio.email || (isValidEmail(contact) ? contact : ""),
    phone: "",
    city: portfolio.city || "",
    major: portfolio.major || "",
    university: portfolio.university || "",
    linkedinUrl: portfolio.linkedinUrl || "",
    headline: portfolio.degreeLevel || portfolio.major || "",
    portfolioUrl: portfolio.slug ? `${getFrontendUrl()}/p/${portfolio.slug}` : "",
    githubUrl: "",
    personalUrl: "",
  },
  summary: portfolio.bio || "",
  education: portfolio.university
    ? [
        {
          id: "portfolio-education",
          title: portfolio.degreeLevel || "طالب تدريب تعاوني",
          subtitle: portfolio.university,
          organization: portfolio.university,
          period: "",
          startDate: "",
          endDate: "",
          isCurrent: true,
          location: portfolio.city || "",
          url: "",
          description: portfolio.major || "",
          details: portfolio.major || "",
          achievements: [],
        },
      ]
    : [],
  experiences: [],
  experience: [],
  projects: (portfolio.projects || []).map((project) => ({
    id: project._id?.toString?.() || project.title || `project-${Date.now().toString(36)}`,
    title: project.title || "",
    subtitle: project.link || "",
    organization: "",
    period: "",
    startDate: "",
    endDate: "",
    isCurrent: false,
    location: "",
    url: project.url || project.link || "",
    description: project.description || "",
    details: project.description || "",
    achievements: project.description
      ? [
          {
            id: "portfolio-project-detail",
            text: sanitizeResumeText(project.description, 700),
            html: `<p>${escapeResumeHtml(sanitizeResumeText(project.description, 700))}</p>`,
          },
        ]
      : [],
  })),
  certifications: (portfolio.certifications || []).map((certification) => ({
    id:
      certification._id?.toString?.() ||
      certification.title ||
      `cert-${Date.now().toString(36)}`,
    title: certification.title || "",
    subtitle: certification.issuer || certification.provider || "",
    organization: certification.issuer || certification.provider || "",
    period: certification.year || "",
    startDate: "",
    endDate: certification.year || "",
    isCurrent: false,
    location: "",
    url: "",
    description: "",
    details: "",
    achievements: [],
  })),
  volunteering: [],
  languages: [],
  links: [
    portfolio.linkedinUrl ? { id: "linkedin", label: "LinkedIn", url: portfolio.linkedinUrl } : null,
    portfolio.slug ? { id: "portfolio", label: "ملفي المهني", url: `${getFrontendUrl()}/p/${portfolio.slug}` } : null,
  ].filter(Boolean),
  skills: portfolio.skills || [],
  sectionOrder: RESUME_SECTION_KEYS,
  hiddenSections: [],
  settings: {
    language: "ar",
    direction: "rtl",
    density: "comfortable",
    fontSize: "medium",
  },
});

const serializeResume = (resume = {}, access = {}) => {
  const usageLimit =
    access.isAdmin
      ? getPlanAiResumeUsageLimit(RESUME_PLAN_KEY, process.env)
      : getSubscriptionAiResumeUsageLimit(access.subscription || access.user || {});
  const usageCount = access.isAdmin
    ? 0
    : Number(
        access.subscription?.aiResumeUsageCount ??
          access.user?.aiResumeUsageCount ??
          0
      );
  const usageResetAt =
    access.subscription?.aiResumeUsageResetAt ||
    access.user?.aiResumeUsageResetAt ||
    access.subscription?.expiresAt ||
    access.user?.premiumExpiresAt ||
    null;

  return {
    _id: resume._id?.toString?.() || "",
    personalInfo: resume.personalInfo || {},
    summary: resume.summary || "",
    education: resume.education || [],
    experiences: resume.experiences || resume.experience || [],
    experience: resume.experience || resume.experiences || [],
    projects: resume.projects || [],
    certifications: resume.certifications || [],
    volunteering: resume.volunteering || [],
    languages: resume.languages || [],
    links: resume.links || [],
    skills: resume.skills || [],
    sectionOrder: sanitizeResumeSectionOrder(resume.sectionOrder),
    hiddenSections: Array.isArray(resume.hiddenSections) ? resume.hiddenSections : [],
    settings: sanitizeResumeSettings(resume.settings),
    updatedAt: resume.updatedAt || null,
    access: {
      planKey: access.planKey || RESUME_PLAN_KEY,
      entitlements: access.entitlements || [PLUS_ENTITLEMENT, RESUME_ENTITLEMENT],
      aiResumeUsageCount: usageCount,
      aiResumeUsageLimit: usageLimit,
      aiResumeUsageResetAt: usageResetAt,
    },
  };
};

const sanitizeResumeLooseTree = (value, depth = 0) => {
  if (depth > 5) return "";
  if (typeof value === "string") return sanitizeResumeText(value, 1200);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeResumeLooseTree(item, depth + 1));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 80)
        .map(([key, item]) => [
          sanitizePortfolioText(key, 80),
          sanitizeResumeLooseTree(item, depth + 1),
        ])
        .filter(([key]) => Boolean(key))
    );
  }
  return "";
};

const sanitizeResumeAiRequest = (body = {}) => {
  const rawInput = body.rawInput || body.wizardData || body.wizard || {};
  const basic = rawInput.basic || rawInput.personalInfo || {};
  const language =
    body.language === "en" || basic.language === "en" || rawInput.language === "en"
      ? "en"
      : "ar";
  const targetTitle = sanitizePortfolioText(
    body.targetTitle || basic.targetTitle || rawInput.targetTitle,
    160
  );

  return {
    sourceMode: sanitizePortfolioText(body.sourceMode || rawInput.sourceMode, 60),
    language,
    targetTitle,
    rawInput: sanitizeResumeLooseTree(rawInput),
    idempotencyKey: sanitizeAccessItemKey(
      body.idempotencyKey || body.requestId || body.clientRequestId || ""
    ),
  };
};

const getResumeAiRateLimitKey = (req = {}, action = "resume_ai") => {
  const contact = req.darbakAccess?.contact || "";
  const visitorId = sanitizeVisitorId(req.body?.visitorId || req.headers["x-visitor-id"] || "");
  return `${action}:${contact || visitorId || req.ip || "anonymous"}`;
};

const checkResumeAiRateLimit = (req, res, action = "resume_ai") => {
  if (req.darbakAccess?.isAdmin) return true;

  const now = Date.now();
  const key = getResumeAiRateLimitKey(req, action);
  const current = resumeAiRateLimits.get(key) || {
    count: 0,
    resetsAt: now + RESUME_AI_RATE_LIMIT_WINDOW_MS,
  };

  if (current.resetsAt <= now) {
    current.count = 0;
    current.resetsAt = now + RESUME_AI_RATE_LIMIT_WINDOW_MS;
  }

  current.count += 1;
  resumeAiRateLimits.set(key, current);

  if (current.count > RESUME_AI_RATE_LIMIT_MAX) {
    res.status(429).json({
      error: "وصلت للحد المؤقت من طلبات السيرة. انتظر قليلًا ثم حاول مرة أخرى.",
    });
    return false;
  }

  return true;
};

const getResumeAiIdempotencyKey = (req = {}, action = "resume_ai") => {
  const rawKey =
    req.headers["idempotency-key"] ||
    req.headers["x-idempotency-key"] ||
    req.body?.idempotencyKey ||
    req.body?.requestId ||
    "";
  const key = sanitizeAccessItemKey(rawKey);
  if (!key) return "";
  return `${action}:${req.darbakAccess?.contact || "unknown"}:${key}`;
};

const getResumeAiCachedResponse = (key = "") => {
  if (!key) return null;
  const cached = resumeAiIdempotencyCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    resumeAiIdempotencyCache.delete(key);
    return null;
  }
  return cached.value;
};

const setResumeAiCachedResponse = (key = "", value = {}) => {
  if (!key) return;
  resumeAiIdempotencyCache.set(key, {
    value,
    expiresAt: Date.now() + 15 * 60 * 1000,
  });
};

const getResumeForAccess = async ({ contact, accessCodeHash }) =>
  ResumeProfile.findOne({ contact, accessCodeHash }).lean();

const getPortfolioForAccess = async ({ contact, accessCodeHash }) =>
  Portfolio.findOne({ contact, accessCodeHash }).lean();

const getResumeUsageSnapshot = (access = {}) => {
  const limit = access.isAdmin
    ? getPlanAiResumeUsageLimit(RESUME_PLAN_KEY, process.env)
    : getSubscriptionAiResumeUsageLimit(access.subscription || access.user || {});
  const count = access.isAdmin
    ? 0
    : Number(access.subscription?.aiResumeUsageCount ?? access.user?.aiResumeUsageCount ?? 0);

  return {
    aiResumeUsageCount: count,
    aiResumeUsageLimit: Number(limit || 0),
    aiResumeUsageResetAt:
      access.subscription?.aiResumeUsageResetAt ||
      access.user?.aiResumeUsageResetAt ||
      access.subscription?.expiresAt ||
      access.user?.premiumExpiresAt ||
      null,
  };
};

const incrementResumeTailorUsage = async (access = {}) => {
  if (access.isAdmin) return getResumeUsageSnapshot(access);

  const usage = getResumeUsageSnapshot(access);
  if (usage.aiResumeUsageLimit > 0 && usage.aiResumeUsageCount >= usage.aiResumeUsageLimit) {
    const error = new Error("استخدمت كل عمليات تخصيص السيرة لهذا الشهر.");
    error.code = "RESUME_USAGE_LIMIT";
    error.usage = usage;
    throw error;
  }

  if (access.subscription?._id) {
    const updated = await Subscription.findOneAndUpdate(
      {
        _id: access.subscription._id,
        aiResumeUsageCount: { $lt: usage.aiResumeUsageLimit || Number.MAX_SAFE_INTEGER },
      },
      {
        $inc: { aiResumeUsageCount: 1 },
        $set: {
          aiResumeUsageLimit: usage.aiResumeUsageLimit,
          aiResumeUsageResetAt: usage.aiResumeUsageResetAt,
        },
      },
      { new: true }
    ).lean();

    if (!updated) {
      const error = new Error("استخدمت كل عمليات تخصيص السيرة لهذا الشهر.");
      error.code = "RESUME_USAGE_LIMIT";
      error.usage = usage;
      throw error;
    }

    await syncSubscriptionUser(updated);
    return {
      aiResumeUsageCount: Number(updated.aiResumeUsageCount || 0),
      aiResumeUsageLimit: getSubscriptionAiResumeUsageLimit(updated),
      aiResumeUsageResetAt: updated.aiResumeUsageResetAt || updated.expiresAt || null,
    };
  }

  if (access.user?._id) {
    const updatedUser = await User.findOneAndUpdate(
      {
        _id: access.user._id,
        aiResumeUsageCount: { $lt: usage.aiResumeUsageLimit || Number.MAX_SAFE_INTEGER },
      },
      {
        $inc: { aiResumeUsageCount: 1 },
        $set: {
          aiResumeUsageLimit: usage.aiResumeUsageLimit,
          aiResumeUsageResetAt: usage.aiResumeUsageResetAt,
        },
      },
      { new: true }
    ).lean();

    if (!updatedUser) {
      const error = new Error("استخدمت كل عمليات تخصيص السيرة لهذا الشهر.");
      error.code = "RESUME_USAGE_LIMIT";
      error.usage = usage;
      throw error;
    }

    return {
      aiResumeUsageCount: Number(updatedUser.aiResumeUsageCount || 0),
      aiResumeUsageLimit: Number(updatedUser.aiResumeUsageLimit || 0),
      aiResumeUsageResetAt: updatedUser.aiResumeUsageResetAt || null,
    };
  }

  return usage;
};

const getResumeAiErrorResponse = (err = {}) => {
  if (err.code === "OPENAI_KEY_MISSING") {
    return {
      status: 503,
      body: {
        error: "لم يتم تفعيل مفتاح OpenAI في الخادم بعد.",
        reason: "openai_key_missing",
      },
    };
  }

  if (err.code === "RESUME_USAGE_LIMIT") {
    return {
      status: 429,
      body: {
        error: err.message,
        ...(err.usage || {}),
      },
    };
  }

  if (err.name === "ZodError" || err.code === "OPENAI_PARSE_EMPTY") {
    return {
      status: 502,
      body: {
        error: "رجعت الاستجابة ناقصة. حاول مرة أخرى.",
        reason: "invalid_ai_response",
      },
    };
  }

  if (err.status === 429) {
    const openAiCode = (err.code || err.type || "").toString();
    const openAiMessage = (err.message || "").toString().toLowerCase();
    const isQuotaOrBillingError =
      openAiCode.includes("insufficient_quota") ||
      openAiCode.includes("billing") ||
      openAiMessage.includes("insufficient_quota") ||
      openAiMessage.includes("quota") ||
      openAiMessage.includes("billing");

    return {
      status: 429,
      body: {
        error: isQuotaOrBillingError
          ? "حساب OpenAI يحتاج تفعيل الفوترة أو إضافة رصيد قبل تشغيل وكيل السيرة."
          : "الطلب على خدمة السيرة مرتفع حاليًا. حاول بعد قليل.",
        reason: isQuotaOrBillingError
          ? "openai_quota_or_billing"
          : "openai_rate_limited",
        openAiCode,
      },
    };
  }

  const openAiCode = (err.code || err.type || "").toString().toLowerCase();
  const openAiMessage = (err.message || "").toString().toLowerCase();
  const configuredModel = (process.env.OPENAI_RESUME_AGENT_MODEL || "").trim();

  if (err.status === 401 || openAiCode.includes("invalid_api_key")) {
    return {
      status: 503,
      body: {
        error: "مفتاح OpenAI غير صالح أو لم يعد نشطًا. راجع OPENAI_API_KEY في Render ثم أعد تشغيل الباكند.",
        reason: "openai_auth_failed",
      },
    };
  }

  if (err.status === 403 || openAiCode.includes("permission") || openAiMessage.includes("not authorized")) {
    return {
      status: 503,
      body: {
        error: "مشروع OpenAI الحالي لا يملك صلاحية تشغيل نموذج وكيل السيرة. راجع صلاحيات المشروع والفوترة.",
        reason: "openai_access_denied",
      },
    };
  }

  if (
    err.status === 404 ||
    openAiCode.includes("model_not_found") ||
    openAiMessage.includes("model") && openAiMessage.includes("not found")
  ) {
    return {
      status: 503,
      body: {
        error: `نموذج وكيل السيرة غير متاح لهذا المفتاح${configuredModel ? `: ${configuredModel}` : ""}. اختَر نموذجًا متاحًا في مشروع OpenAI ثم حدّث OPENAI_RESUME_AGENT_MODEL.`,
        reason: "openai_model_unavailable",
      },
    };
  }

  if (err.status === 400 || openAiCode.includes("invalid_request")) {
    return {
      status: 502,
      body: {
        error: "تعذر تجهيز ترجمة السيرة الآن. أعد المحاولة بعد قليل.",
        reason: "openai_invalid_request",
      },
    };
  }

  if (err.name === "APIConnectionError" || openAiCode.includes("timeout")) {
    return {
      status: 503,
      body: {
        error: "تعذر الاتصال بخدمة وكيل السيرة مؤقتًا. حاول بعد دقيقة.",
        reason: "openai_connection_failed",
      },
    };
  }

  return {
    status: 500,
    body: { error: "تعذر تشغيل كاتب السيرة الآن. حاول مرة أخرى." },
  };
};

const RESUME_AGENT_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RESUME_AGENT_MAX_TAILORED_VERSIONS = Number(
  process.env.RESUME_AGENT_MAX_TAILORED_VERSIONS || 10
);

const getResumeAgentExpiry = () =>
  new Date(Date.now() + RESUME_AGENT_SESSION_TTL_MS);

const sanitizeResumeAgentPurpose = (value = "") =>
  value === "tailor_resume" ? "tailor_resume" : "create_resume";

const sanitizeResumeAgentSource = (value = "") =>
  ["professional_profile", "existing_resume", "new_information"].includes(value)
    ? value
    : "professional_profile";

const sanitizeResumeAgentLanguage = (value = "") => (value === "en" ? "en" : "ar");

const sanitizeResumeAgentAnswers = (answers = [], pendingQuestions = []) => {
  const questionMap = new Map(
    (Array.isArray(pendingQuestions) ? pendingQuestions : []).map((question) => [
      sanitizeAccessItemKey(question.id || question.question || ""),
      question,
    ])
  );

  return (Array.isArray(answers) ? answers : [])
    .slice(0, 3)
    .map((answer, index) => {
      const questionId =
        sanitizeAccessItemKey(answer.questionId || answer.id || `answer-${index + 1}`) ||
        `answer-${index + 1}`;
      const question = questionMap.get(questionId) || {};
      return {
        questionId,
        section: sanitizePortfolioText(answer.section || question.section || "", 90),
        question: sanitizePortfolioText(answer.question || question.question || "", 320),
        answer: sanitizeResumeText(answer.answer || answer.value || "", 1600),
      };
    })
    .filter((answer) => answer.answer);
};

const mergeResumeAgentUsage = (current = {}, next = {}) => ({
  model: next.model || current.model || "",
  turns: Number(current.turns || 0) + Number(next.turns || 0),
  toolCalls: Number(current.toolCalls || 0) + Number(next.toolCalls || 0),
  inputTokens: Number(current.inputTokens || 0) + Number(next.inputTokens || 0),
  outputTokens: Number(current.outputTokens || 0) + Number(next.outputTokens || 0),
  totalTokens: Number(current.totalTokens || 0) + Number(next.totalTokens || 0),
  durationMs: Number(current.durationMs || 0) + Number(next.durationMs || 0),
  toolsUsed: Array.from(
    new Set([...(current.toolsUsed || []), ...(next.toolsUsed || [])].filter(Boolean))
  ),
  failureReason: next.failureReason || current.failureReason || "",
});

const serializeResumeAgentSession = (session = {}, pendingDraft = null) => ({
  sessionId: session.sessionId,
  purpose: session.purpose,
  source: session.source,
  language: session.language,
  status: session.status,
  pendingQuestions: session.pendingQuestions || [],
  answeredQuestionIds: session.answeredQuestionIds || [],
  pendingDraftId: session.pendingDraftId?.toString?.() || session.pendingDraftId || "",
  baseResumeId: session.baseResumeId?.toString?.() || session.baseResumeId || "",
  opportunityId: session.opportunityId?.toString?.() || session.opportunityId || "",
  usage: session.usage || {},
  updatedAt: session.updatedAt || null,
  expiresAt: session.expiresAt || null,
  pendingDraft: pendingDraft
    ? {
        _id: pendingDraft._id?.toString?.() || "",
        draftType: pendingDraft.draftType,
        status: pendingDraft.status,
        draft: pendingDraft.draft,
        validationResult: pendingDraft.validationResult || {},
        changesSummary: pendingDraft.changesSummary || [],
        companyName: pendingDraft.companyName || "",
        roleTitle: pendingDraft.roleTitle || "",
      }
    : null,
});

const getResumeAgentSessionForAccess = async (sessionId = "", access = {}) =>
  ResumeAgentSession.findOne({
    sessionId: sanitizeAccessItemKey(sessionId),
    contact: access.contact,
    accessCodeHash: access.accessCodeHash,
  });

const getPendingResumeDraftForAccess = async (pendingDraftId = "", access = {}) => {
  if (!mongoose.Types.ObjectId.isValid(pendingDraftId)) return null;
  return ResumePendingDraft.findOne({
    _id: pendingDraftId,
    contact: access.contact,
    accessCodeHash: access.accessCodeHash,
  });
};

const applyResumeAgentOutputToSession = async (session, agentResult) => {
  const output = agentResult.output || {};
  const nextStatus =
    output.status === "needs_information"
      ? "collecting_information"
      : output.status === "draft_ready" || output.status === "tailored_draft_ready"
        ? "awaiting_review"
        : "failed";

  session.status = nextStatus;
  session.pendingQuestions = output.status === "needs_information" ? output.questions || [] : [];
  session.pendingDraftId =
    output.pendingDraftId && mongoose.Types.ObjectId.isValid(output.pendingDraftId)
      ? output.pendingDraftId
      : session.pendingDraftId || null;
  session.lastResponseId = agentResult.lastResponseId || session.lastResponseId || "";
  session.usage = mergeResumeAgentUsage(session.usage || {}, agentResult.usage || {});
  session.expiresAt = getResumeAgentExpiry();
  await session.save();

  return session;
};

const mapPendingDraftToResumePayload = async (pendingDraft, access, language = "ar") => {
  const currentResume = await getResumeForAccess({
    contact: access.contact,
    accessCodeHash: access.accessCodeHash,
  });
  const portfolio = await getPortfolioForAccess({
    contact: access.contact,
    accessCodeHash: access.accessCodeHash,
  });
  const fallbackResume = mapPortfolioToResumePayload(portfolio || {}, access.contact);
  const baseResume = currentResume || fallbackResume || {};
  const parsedDraft = tailoredResumeDraftSchema.safeParse(pendingDraft.draft).success
    ? tailoredResumeDraftSchema.parse(pendingDraft.draft)
    : resumeDraftSchema.parse(pendingDraft.draft);
  const mappedPayload = mapDraftToResumePayload(
    parsedDraft,
    baseResume,
    { basic: baseResume.personalInfo || {} },
    sanitizeResumeAgentLanguage(language || baseResume.settings?.language)
  );

  return sanitizeResumePayload({
    ...mappedPayload,
    sectionOrder: baseResume.sectionOrder || RESUME_SECTION_KEYS,
    hiddenSections: baseResume.hiddenSections || [],
  });
};

const estimateJsonBytes = (value = {}) => {
  try {
    return Buffer.byteLength(JSON.stringify(value || {}), "utf8");
  } catch {
    return 0;
  }
};

app.get('/api/resume/me', requireResumeAccess, async (req, res) => {
  try {
    const { contact, accessCodeHash } = req.darbakAccess;
    const resume = await ResumeProfile.findOne({ contact, accessCodeHash }).lean();
    const portfolio = await Portfolio.findOne({ contact, accessCodeHash }).lean();
    const fallback = mapPortfolioToResumePayload(portfolio || {}, contact);

    res.json({
      exists: Boolean(resume),
      resume: serializeResume(resume || fallback, req.darbakAccess),
      portfolioImported: Boolean(!resume && portfolio),
    });
  } catch (err) {
    console.error("❌ Resume fetch error:", err);
    res.status(500).json({ error: "تعذر تحميل السيرة." });
  }
});

app.put('/api/resume/me', requireResumeAccess, async (req, res) => {
  try {
    const { contact, accessCodeHash, user } = req.darbakAccess;
    const payload = sanitizeResumePayload(req.body);

    const resume = await ResumeProfile.findOneAndUpdate(
      { contact, accessCodeHash },
      {
        $set: {
          contact,
          accessCodeHash,
          userId: user?._id,
          ...payload,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    ).lean();

    await AnalyticsEvent.create({
      eventName: "resume_saved",
      visitorId: sanitizeAnalyticsText(req.body.visitorId, 90),
      page: "/my-resume",
      deviceType: sanitizeAnalyticsText(req.body.deviceType, 24),
      metadata: sanitizeAnalyticsMetadata({
        hasSummary: Boolean(resume.summary),
        projectsCount: resume.projects?.length || 0,
      }),
    }).catch(() => null);

    res.json({
      resume: serializeResume(resume, req.darbakAccess),
      message: "تم حفظ سيرتك بنجاح.",
    });
  } catch (err) {
    console.error("❌ Resume save error:", err);
    res.status(500).json({ error: "تعذر حفظ السيرة." });
  }
});

app.post('/api/resume-agent/start', requireResumeAccess, async (req, res) => {
  let session = null;
  try {
    if (!checkResumeAiRateLimit(req, res, "resume_agent_start")) return;

    const purpose = sanitizeResumeAgentPurpose(req.body?.purpose);
    const source = sanitizeResumeAgentSource(req.body?.source);
    const language = sanitizeResumeAgentLanguage(req.body?.language);
    const opportunityId = sanitizeAccessItemKey(req.body?.opportunityId || "");
    const { contact, accessCodeHash, user } = req.darbakAccess;

    const currentResume = await getResumeForAccess({ contact, accessCodeHash });
    if (purpose === "tailor_resume") {
      if (!currentResume?._id) {
        return res.status(400).json({
          error: "أنشئ سيرتك الأساسية أولًا، ثم خصصها لفرصة.",
          reason: "base_resume_required",
        });
      }
      if (!opportunityId || !mongoose.Types.ObjectId.isValid(opportunityId)) {
        return res.status(400).json({
          error: "اختاري فرصة من دربك حتى نخصص السيرة عليها.",
          reason: "opportunity_required",
        });
      }

      const usage = getResumeUsageSnapshot(req.darbakAccess);
      if (
        !req.darbakAccess.isAdmin &&
        usage.aiResumeUsageLimit > 0 &&
        usage.aiResumeUsageCount >= usage.aiResumeUsageLimit
      ) {
        return res.status(429).json({
          error: "استخدمت كل عمليات تخصيص السيرة لهذا الشهر.",
          ...usage,
        });
      }
    }

    session = await ResumeAgentSession.create({
      userId: user?._id,
      contact,
      accessCodeHash,
      sessionId: crypto.randomUUID(),
      purpose,
      source,
      language,
      status: "generating",
      collectedFacts: { answers: [] },
      answeredQuestionIds: [],
      baseResumeId: currentResume?._id || null,
      opportunityId:
        purpose === "tailor_resume" && mongoose.Types.ObjectId.isValid(opportunityId)
          ? opportunityId
          : null,
      expiresAt: getResumeAgentExpiry(),
    });

    const agentResult = await runDarbakResumeAgent({
      access: req.darbakAccess,
      session,
      answers: [],
    });
    session = await applyResumeAgentOutputToSession(session, agentResult);

    await AnalyticsEvent.create({
      eventName: "resume_agent_started",
      visitorId: sanitizeAnalyticsText(req.body.visitorId, 90),
      page: "/my-resume",
      metadata: sanitizeAnalyticsMetadata({
        purpose,
        source,
        status: agentResult.output.status,
        turns: agentResult.usage?.turns || 0,
        toolCalls: agentResult.usage?.toolCalls || 0,
      }),
    }).catch(() => null);

    return res.json({
      session: serializeResumeAgentSession(session),
      output: agentResult.output,
      usage: agentResult.usage,
    });
  } catch (err) {
    if (session) {
      session.status = "failed";
      session.usage = mergeResumeAgentUsage(session.usage || {}, {
        failureReason: err.code || err.name || "resume_agent_start_failed",
      });
      await session.save().catch(() => null);
    }
    console.error("❌ Resume agent start error:", {
      code: err.code,
      status: err.status,
      name: err.name,
    });
    const response = getResumeAiErrorResponse(err);
    return res.status(response.status).json(response.body);
  }
});

app.post('/api/resume-agent/respond', requireResumeAccess, async (req, res) => {
  let session = null;
  try {
    if (!checkResumeAiRateLimit(req, res, "resume_agent_respond")) return;

    session = await getResumeAgentSessionForAccess(req.body?.sessionId, req.darbakAccess);
    if (!session) {
      return res.status(404).json({ error: "جلسة وكيل السيرة غير موجودة." });
    }
    if (["completed", "failed"].includes(session.status)) {
      return res.status(409).json({ error: "هذه الجلسة انتهت. ابدأ جلسة جديدة." });
    }

    const answers = sanitizeResumeAgentAnswers(req.body?.answers, session.pendingQuestions);
    if (!answers.length) {
      return res.status(400).json({ error: "أجب عن سؤال واحد على الأقل للمتابعة." });
    }

    const existingAnswers = Array.isArray(session.collectedFacts?.answers)
      ? session.collectedFacts.answers
      : [];
    const nextAnsweredIds = Array.from(
      new Set([
        ...(session.answeredQuestionIds || []),
        ...answers.map((answer) => answer.questionId),
      ])
    );

    session.collectedFacts = {
      ...(session.collectedFacts || {}),
      answers: [...existingAnswers, ...answers].slice(-40),
    };
    session.answeredQuestionIds = nextAnsweredIds;
    session.status = "generating";
    session.expiresAt = getResumeAgentExpiry();
    await session.save();

    const agentResult = await runDarbakResumeAgent({
      access: req.darbakAccess,
      session,
      answers,
    });
    session = await applyResumeAgentOutputToSession(session, agentResult);

    await AnalyticsEvent.create({
      eventName: "resume_agent_responded",
      visitorId: sanitizeAnalyticsText(req.body.visitorId, 90),
      page: "/my-resume",
      metadata: sanitizeAnalyticsMetadata({
        purpose: session.purpose,
        status: agentResult.output.status,
        answerCount: answers.length,
        turns: agentResult.usage?.turns || 0,
        toolCalls: agentResult.usage?.toolCalls || 0,
      }),
    }).catch(() => null);

    return res.json({
      session: serializeResumeAgentSession(session),
      output: agentResult.output,
      usage: agentResult.usage,
    });
  } catch (err) {
    if (session) {
      session.status = "failed";
      session.usage = mergeResumeAgentUsage(session.usage || {}, {
        failureReason: err.code || err.name || "resume_agent_respond_failed",
      });
      await session.save().catch(() => null);
    }
    console.error("❌ Resume agent respond error:", {
      code: err.code,
      status: err.status,
      name: err.name,
    });
    const response = getResumeAiErrorResponse(err);
    return res.status(response.status).json(response.body);
  }
});

app.get('/api/resume-agent/session/:sessionId', requireResumeAccess, async (req, res) => {
  try {
    const session = await getResumeAgentSessionForAccess(req.params.sessionId, req.darbakAccess);
    if (!session) {
      return res.status(404).json({ error: "جلسة وكيل السيرة غير موجودة." });
    }

    const pendingDraft = session.pendingDraftId
      ? await getPendingResumeDraftForAccess(session.pendingDraftId.toString(), req.darbakAccess)
      : null;

    return res.json({
      session: serializeResumeAgentSession(session, pendingDraft),
    });
  } catch (err) {
    console.error("❌ Resume agent session fetch error:", err);
    return res.status(500).json({ error: "تعذر تحميل جلسة وكيل السيرة." });
  }
});

app.post('/api/resume-agent/approve/:pendingDraftId', requireResumeAccess, async (req, res) => {
  try {
    const pendingDraft = await getPendingResumeDraftForAccess(
      req.params.pendingDraftId,
      req.darbakAccess
    );
    if (!pendingDraft) {
      return res.status(404).json({ error: "المسودة غير موجودة." });
    }
    if (pendingDraft.status !== "pending_review") {
      return res.status(409).json({ error: "تم التعامل مع هذه المسودة مسبقًا." });
    }
    if (pendingDraft.expiresAt && pendingDraft.expiresAt <= new Date()) {
      pendingDraft.status = "expired";
      await pendingDraft.save();
      return res.status(410).json({ error: "انتهت صلاحية هذه المسودة. ابدأ جلسة جديدة." });
    }
    if (pendingDraft.validationResult?.valid === false) {
      return res.status(422).json({
        error: "لا يمكن اعتماد مسودة فيها ادعاءات غير مثبتة.",
        validationResult: pendingDraft.validationResult,
      });
    }

    const payload = await mapPendingDraftToResumePayload(
      pendingDraft,
      req.darbakAccess,
      req.body?.language || pendingDraft.draft?.settings?.language || "ar"
    );

    if (pendingDraft.draftType === "tailored_resume") {
      const usageBefore = getResumeUsageSnapshot(req.darbakAccess);
      if (
        !req.darbakAccess.isAdmin &&
        usageBefore.aiResumeUsageLimit > 0 &&
        usageBefore.aiResumeUsageCount >= usageBefore.aiResumeUsageLimit
      ) {
        return res.status(429).json({
          error: "استخدمت كل عمليات تخصيص السيرة لهذا الشهر.",
          ...usageBefore,
        });
      }

      const existingCount = await ResumeTailoredVersion.countDocuments({
        contact: req.darbakAccess.contact,
        accessCodeHash: req.darbakAccess.accessCodeHash,
        status: "approved",
      });
      if (existingCount >= RESUME_AGENT_MAX_TAILORED_VERSIONS) {
        const oldest = await ResumeTailoredVersion.findOne({
          contact: req.darbakAccess.contact,
          accessCodeHash: req.darbakAccess.accessCodeHash,
          status: "approved",
        }).sort({ approvedAt: 1 });
        if (oldest) {
          oldest.status = "deleted";
          await oldest.save();
        }
      }

      let tailoredVersion = null;
      try {
        tailoredVersion = await ResumeTailoredVersion.create({
          userId: req.darbakAccess.user?._id,
          contact: req.darbakAccess.contact,
          accessCodeHash: req.darbakAccess.accessCodeHash,
          baseResumeId: pendingDraft.baseResumeId || null,
          opportunityId: pendingDraft.opportunityId || null,
          companyName: pendingDraft.companyName || "",
          roleTitle: pendingDraft.roleTitle || "",
          resumePayload: payload,
          sourceMap: pendingDraft.sourceMap || {},
          validationResult: pendingDraft.validationResult || {},
          changesSummary: pendingDraft.changesSummary || [],
          status: "approved",
          approvedAt: new Date(),
        });
        const usage = await incrementResumeTailorUsage(req.darbakAccess);

        pendingDraft.status = "approved";
        pendingDraft.approvedAt = new Date();
        await pendingDraft.save();

        await ResumeAgentSession.findOneAndUpdate(
          { sessionId: pendingDraft.agentSessionId },
          { $set: { status: "completed", expiresAt: getResumeAgentExpiry() } }
        );

        await AnalyticsEvent.create({
          eventName: "resume_agent_tailored_approved",
          visitorId: sanitizeAnalyticsText(req.body.visitorId, 90),
          page: "/my-resume",
          metadata: sanitizeAnalyticsMetadata({
            opportunityId: pendingDraft.opportunityId?.toString?.() || "",
            companyName: pendingDraft.companyName || "",
            usageCount: usage.aiResumeUsageCount,
            usageLimit: usage.aiResumeUsageLimit,
          }),
        }).catch(() => null);

        return res.json({
          tailoredVersion,
          usage,
          message: "اعتمدنا النسخة المخصصة وحفظناها دون تغيير سيرتك الأساسية.",
        });
      } catch (err) {
        if (tailoredVersion?._id) {
          await ResumeTailoredVersion.findByIdAndUpdate(tailoredVersion._id, {
            $set: { status: "deleted" },
          }).catch(() => null);
        }
        throw err;
      }
    }

    const resume = await ResumeProfile.findOneAndUpdate(
      {
        contact: req.darbakAccess.contact,
        accessCodeHash: req.darbakAccess.accessCodeHash,
      },
      {
        $set: {
          contact: req.darbakAccess.contact,
          accessCodeHash: req.darbakAccess.accessCodeHash,
          userId: req.darbakAccess.user?._id,
          ...payload,
          aiDraft: pendingDraft.draft,
          rawDraftInput: pendingDraft.sourceMap || {},
          aiDraftStatus: "approved",
          aiDraftApprovedAt: new Date(),
          aiDraftUsage: {
            ...(pendingDraft.validationResult || {}),
          },
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    ).lean();

    pendingDraft.status = "approved";
    pendingDraft.approvedAt = new Date();
    await pendingDraft.save();

    await ResumeAgentSession.findOneAndUpdate(
      { sessionId: pendingDraft.agentSessionId },
      { $set: { status: "completed", expiresAt: getResumeAgentExpiry() } }
    );

    await AnalyticsEvent.create({
      eventName: "resume_agent_draft_approved",
      visitorId: sanitizeAnalyticsText(req.body.visitorId, 90),
      page: "/my-resume",
      metadata: sanitizeAnalyticsMetadata({
        experiencesCount: payload.experiences?.length || 0,
        projectsCount: payload.projects?.length || 0,
      }),
    }).catch(() => null);

    return res.json({
      resume: serializeResume(resume, req.darbakAccess),
      message: "اعتمدنا المسودة وفتحناها في المحرر.",
    });
  } catch (err) {
    console.error("❌ Resume agent approve error:", {
      code: err.code,
      status: err.status,
      name: err.name,
    });
    const response = getResumeAiErrorResponse(err);
    return res.status(response.status).json(response.body);
  }
});

app.post('/api/resume-agent/reject/:pendingDraftId', requireResumeAccess, async (req, res) => {
  try {
    const pendingDraft = await getPendingResumeDraftForAccess(
      req.params.pendingDraftId,
      req.darbakAccess
    );
    if (!pendingDraft) {
      return res.status(404).json({ error: "المسودة غير موجودة." });
    }
    if (pendingDraft.status !== "pending_review") {
      return res.status(409).json({ error: "تم التعامل مع هذه المسودة مسبقًا." });
    }

    pendingDraft.status = "rejected";
    pendingDraft.rejectedAt = new Date();
    await pendingDraft.save();

    await ResumeAgentSession.findOneAndUpdate(
      { sessionId: pendingDraft.agentSessionId },
      { $set: { status: "completed", expiresAt: getResumeAgentExpiry() } }
    );

    await AnalyticsEvent.create({
      eventName: "resume_agent_draft_rejected",
      visitorId: sanitizeAnalyticsText(req.body.visitorId, 90),
      page: "/my-resume",
      metadata: sanitizeAnalyticsMetadata({
        draftType: pendingDraft.draftType,
      }),
    }).catch(() => null);

    return res.json({ message: "تم رفض المسودة بدون تعديل سيرتك." });
  } catch (err) {
    console.error("❌ Resume agent reject error:", err);
    return res.status(500).json({ error: "تعذر رفض المسودة." });
  }
});

app.get('/api/resume-agent/tailored-versions', requireResumeAccess, async (req, res) => {
  try {
    const versions = await ResumeTailoredVersion.find({
      contact: req.darbakAccess.contact,
      accessCodeHash: req.darbakAccess.accessCodeHash,
      status: "approved",
    })
      .sort({ updatedAt: -1 })
      .limit(RESUME_AGENT_MAX_TAILORED_VERSIONS)
      .lean();

    return res.json({
      versions: versions.map((version) => ({
        _id: version._id?.toString?.() || "",
        companyName: version.companyName || "",
        roleTitle: version.roleTitle || "",
        opportunityId: version.opportunityId?.toString?.() || "",
        changesSummary: version.changesSummary || [],
        updatedAt: version.updatedAt || version.approvedAt || null,
      })),
    });
  } catch (err) {
    console.error("❌ Tailored versions fetch error:", err);
    return res.status(500).json({ error: "تعذر تحميل النسخ المخصصة." });
  }
});

app.delete('/api/resume-agent/tailored-versions/:id', requireResumeAccess, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "معرف النسخة غير صحيح." });
    }

    const updated = await ResumeTailoredVersion.findOneAndUpdate(
      {
        _id: req.params.id,
        contact: req.darbakAccess.contact,
        accessCodeHash: req.darbakAccess.accessCodeHash,
      },
      { $set: { status: "deleted" } },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ error: "النسخة غير موجودة." });
    }

    return res.json({ message: "تم حذف النسخة المخصصة." });
  } catch (err) {
    console.error("❌ Tailored version delete error:", err);
    return res.status(500).json({ error: "تعذر حذف النسخة." });
  }
});

app.post('/api/resume/ai/generate-draft', requireResumeAccess, async (req, res) => {
  try {
    if (!checkResumeAiRateLimit(req, res, "generate_draft")) return;

    const idempotencyKey = getResumeAiIdempotencyKey(req, "generate_draft");
    const cached = getResumeAiCachedResponse(idempotencyKey);
    if (cached) return res.json({ ...cached, idempotentReplay: true });

    const aiRequest = sanitizeResumeAiRequest(req.body);
    const { contact, accessCodeHash, user } = req.darbakAccess;
    const currentResume = await getResumeForAccess({ contact, accessCodeHash });
    const portfolio =
      aiRequest.sourceMode === "portfolio"
        ? await getPortfolioForAccess({ contact, accessCodeHash })
        : null;

    const result = await generateResumeDraft({
      rawInput: aiRequest.rawInput,
      portfolio,
      language: aiRequest.language,
      targetTitle: aiRequest.targetTitle,
      userKey: user?._id?.toString?.() || contact,
    });

    const resume = await ResumeProfile.findOneAndUpdate(
      { contact, accessCodeHash },
      {
        $set: {
          contact,
          accessCodeHash,
          userId: user?._id,
          rawDraftInput: aiRequest.rawInput,
          aiDraft: result.data,
          aiDraftStatus: "draft_ready",
          aiDraftGeneratedAt: new Date(),
          aiDraftUsage: {
            model: result.model,
            responseId: result.responseId,
            ...result.usage,
          },
          ...(currentResume ? {} : sanitizeResumePayload({ settings: { language: aiRequest.language } })),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    ).lean();

    await AnalyticsEvent.create({
      eventName: "resume_ai_draft_generated",
      visitorId: sanitizeAnalyticsText(req.body.visitorId, 90),
      page: "/my-resume",
      metadata: sanitizeAnalyticsMetadata({
        language: aiRequest.language,
        sourceMode: aiRequest.sourceMode,
        hasPortfolio: Boolean(portfolio),
      }),
    }).catch(() => null);

    const responsePayload = {
      draft: result.data,
      usage: result.usage,
      resume: serializeResume(resume, req.darbakAccess),
      message: "مسودتك جاهزة للمراجعة.",
    };
    setResumeAiCachedResponse(idempotencyKey, responsePayload);

    return res.json(responsePayload);
  } catch (err) {
    console.error("❌ Resume AI draft error:", {
      code: err.code,
      status: err.status,
      name: err.name,
    });
    const response = getResumeAiErrorResponse(err);
    return res.status(response.status).json(response.body);
  }
});

app.post('/api/resume/ai/approve-draft', requireResumeAccess, async (req, res) => {
  try {
    const { contact, accessCodeHash, user } = req.darbakAccess;
    const currentResume = await getResumeForAccess({ contact, accessCodeHash });
    const incomingDraft = req.body?.draft || currentResume?.aiDraft;
    const parsedDraft = resumeDraftSchema.parse(incomingDraft);
    const rawInput = sanitizeResumeLooseTree(req.body?.rawInput || currentResume?.rawDraftInput || {});
    const language = req.body?.language === "en" ? "en" : parsedDraft?.settings?.language || "ar";
    const mappedPayload = mapDraftToResumePayload(
      parsedDraft,
      currentResume || {},
      rawInput,
      language
    );
    const payload = sanitizeResumePayload({
      ...mappedPayload,
      sectionOrder: currentResume?.sectionOrder || RESUME_SECTION_KEYS,
      hiddenSections: currentResume?.hiddenSections || [],
    });

    const resume = await ResumeProfile.findOneAndUpdate(
      { contact, accessCodeHash },
      {
        $set: {
          contact,
          accessCodeHash,
          userId: user?._id,
          ...payload,
          aiDraft: parsedDraft,
          rawDraftInput: rawInput,
          aiDraftStatus: "approved",
          aiDraftApprovedAt: new Date(),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    ).lean();

    await AnalyticsEvent.create({
      eventName: "resume_ai_draft_approved",
      visitorId: sanitizeAnalyticsText(req.body.visitorId, 90),
      page: "/my-resume",
      metadata: sanitizeAnalyticsMetadata({
        language: payload.settings?.language || "ar",
        experiencesCount: payload.experiences?.length || 0,
        projectsCount: payload.projects?.length || 0,
      }),
    }).catch(() => null);

    return res.json({
      resume: serializeResume(resume, req.darbakAccess),
      message: "اعتمدنا المسودة وفتحناها في المحرر.",
    });
  } catch (err) {
    console.error("❌ Resume AI approve error:", {
      code: err.code,
      status: err.status,
      name: err.name,
    });
    const response = getResumeAiErrorResponse(err);
    return res.status(response.status).json(response.body);
  }
});

app.post('/api/resume/ai/rewrite-section', requireResumeAccess, async (req, res) => {
  try {
    if (!checkResumeAiRateLimit(req, res, "rewrite_section")) return;

    const idempotencyKey = getResumeAiIdempotencyKey(req, "rewrite_section");
    const cached = getResumeAiCachedResponse(idempotencyKey);
    if (cached) return res.json({ ...cached, idempotentReplay: true });

    const sectionKey = sanitizePortfolioText(req.body.sectionKey, 80);
    const language = req.body.language === "en" ? "en" : "ar";
    const result = await rewriteResumeSection({
      sectionKey,
      currentSection: sanitizeResumeLooseTree(req.body.currentSection || {}),
      rawFacts: sanitizeResumeLooseTree(req.body.rawFacts || req.body.rawInput || {}),
      language,
      userKey: req.darbakAccess.user?._id?.toString?.() || req.darbakAccess.contact,
    });

    await AnalyticsEvent.create({
      eventName: "resume_ai_section_rewritten",
      visitorId: sanitizeAnalyticsText(req.body.visitorId, 90),
      page: "/my-resume",
      metadata: sanitizeAnalyticsMetadata({ sectionKey, language }),
    }).catch(() => null);

    const responsePayload = {
      section: result.data,
      usage: result.usage,
      message: "تمت إعادة صياغة القسم.",
    };
    setResumeAiCachedResponse(idempotencyKey, responsePayload);

    return res.json(responsePayload);
  } catch (err) {
    console.error("❌ Resume AI rewrite error:", {
      code: err.code,
      status: err.status,
      name: err.name,
    });
    const response = getResumeAiErrorResponse(err);
    return res.status(response.status).json(response.body);
  }
});

app.post('/api/resume/ai/tailor', requireResumeAccess, async (req, res) => {
  try {
    if (!checkResumeAiRateLimit(req, res, "tailor_resume")) return;

    const idempotencyKey = getResumeAiIdempotencyKey(req, "tailor_resume");
    const cached = getResumeAiCachedResponse(idempotencyKey);
    if (cached) return res.json({ ...cached, idempotentReplay: true });

    const usageBefore = getResumeUsageSnapshot(req.darbakAccess);
    if (
      !req.darbakAccess.isAdmin &&
      usageBefore.aiResumeUsageLimit > 0 &&
      usageBefore.aiResumeUsageCount >= usageBefore.aiResumeUsageLimit
    ) {
      return res.status(429).json({
        error: "استخدمت كل عمليات تخصيص السيرة لهذا الشهر.",
        ...usageBefore,
      });
    }

    const language = req.body.language === "en" ? "en" : "ar";
    const baseResume =
      req.body.resume ||
      (await getResumeForAccess({
        contact: req.darbakAccess.contact,
        accessCodeHash: req.darbakAccess.accessCodeHash,
      }));

    const result = await tailorResumeToOpportunity({
      resume: sanitizeResumeLooseTree(baseResume || {}),
      opportunity: sanitizeResumeLooseTree(req.body.opportunity || req.body.job || {}),
      language,
      userKey: req.darbakAccess.user?._id?.toString?.() || req.darbakAccess.contact,
    });

    const usage = await incrementResumeTailorUsage(req.darbakAccess);

    const resume = await ResumeProfile.findOneAndUpdate(
      {
        contact: req.darbakAccess.contact,
        accessCodeHash: req.darbakAccess.accessCodeHash,
      },
      {
        $set: {
          aiTailoredDraft: {
            draft: result.data,
            generatedAt: new Date(),
            usage: {
              model: result.model,
              responseId: result.responseId,
              ...result.usage,
            },
          },
        },
      },
      { new: true }
    ).lean();

    await AnalyticsEvent.create({
      eventName: "resume_ai_tailored",
      visitorId: sanitizeAnalyticsText(req.body.visitorId, 90),
      page: "/my-resume",
      metadata: sanitizeAnalyticsMetadata({
        language,
        usageCount: usage.aiResumeUsageCount,
        usageLimit: usage.aiResumeUsageLimit,
      }),
    }).catch(() => null);

    const responsePayload = {
      draft: result.data,
      usage,
      modelUsage: result.usage,
      resume: resume ? serializeResume(resume, req.darbakAccess) : null,
      message: "جهزنا نسخة مخصصة لهذه الفرصة.",
    };
    setResumeAiCachedResponse(idempotencyKey, responsePayload);

    return res.json(responsePayload);
  } catch (err) {
    console.error("❌ Resume AI tailor error:", {
      code: err.code,
      status: err.status,
      name: err.name,
    });
    const response = getResumeAiErrorResponse(err);
    return res.status(response.status).json(response.body);
  }
});

app.post('/api/resume/ai/translate-en', requireResumeAccess, async (req, res) => {
  try {
    if (!checkResumeAiRateLimit(req, res, "translate_resume")) return;

    const idempotencyKey = getResumeAiIdempotencyKey(req, "translate_resume");
    const cached = getResumeAiCachedResponse(idempotencyKey);
    if (cached) return res.json({ ...cached, idempotentReplay: true });

    const usageBefore = getResumeUsageSnapshot(req.darbakAccess);
    if (
      !req.darbakAccess.isAdmin &&
      usageBefore.aiResumeUsageLimit > 0 &&
      usageBefore.aiResumeUsageCount >= usageBefore.aiResumeUsageLimit
    ) {
      return res.status(429).json({
        error: "استخدمت كل عمليات تخصيص السيرة لهذا الشهر.",
        ...usageBefore,
      });
    }

    const baseResume =
      req.body.resume ||
      (await getResumeForAccess({
        contact: req.darbakAccess.contact,
        accessCodeHash: req.darbakAccess.accessCodeHash,
      }));

    const result = await translateResumeToEnglish({
      resume: sanitizeResumeLooseTree(baseResume || {}),
      userKey: req.darbakAccess.user?._id?.toString?.() || req.darbakAccess.contact,
    });

    const usage = await incrementResumeTailorUsage(req.darbakAccess);

    await AnalyticsEvent.create({
      eventName: "resume_translated_to_english",
      visitorId: sanitizeAnalyticsText(req.body.visitorId, 90),
      page: "/my-resume",
      metadata: sanitizeAnalyticsMetadata({
        usageCount: usage.aiResumeUsageCount,
        usageLimit: usage.aiResumeUsageLimit,
      }),
    }).catch(() => null);

    const responsePayload = {
      resume: {
        ...result.data,
        links: [],
        settings: {
          ...(result.data.settings || {}),
          language: "en",
          direction: "ltr",
        },
      },
      usage,
      aiUsage: result.usage,
      message: "تمت ترجمة السيرة إلى الإنجليزية.",
    };
    setResumeAiCachedResponse(idempotencyKey, responsePayload);

    return res.json(responsePayload);
  } catch (err) {
    console.error("❌ Resume translate error:", {
      code: err.code,
      status: err.status,
      name: err.name,
      model: err.resumeAiModel || "",
      message: err.message || "",
      param: err.param || "",
      responseStatus: err.responseStatus || "",
      incompleteReason: err.incompleteReason || "",
    });
    const response = getResumeAiErrorResponse(err);
    return res.status(response.status).json(response.body);
  }
});

app.post('/api/resume/customize', requireResumeAccess, async (req, res) => {
  try {
    const { subscription, isAdmin } = req.darbakAccess;
    const usageLimit = isAdmin
      ? getPlanAiResumeUsageLimit(RESUME_PLAN_KEY, process.env)
      : getSubscriptionAiResumeUsageLimit(subscription || {});
    const usageCount = Number(subscription?.aiResumeUsageCount || 0);

    if (!isAdmin && usageLimit > 0 && usageCount >= usageLimit) {
      return res.status(429).json({
        error: "استخدمت كل عمليات تخصيص السيرة لهذا الشهر.",
        aiResumeUsageCount: usageCount,
        aiResumeUsageLimit: usageLimit,
      });
    }

    res.status(501).json({
      error: "تخصيص السيرة بالذكاء الاصطناعي قيد التجهيز.",
      aiResumeUsageCount: usageCount,
      aiResumeUsageLimit: usageLimit,
    });
  } catch (err) {
    console.error("❌ Resume customize error:", err);
    res.status(500).json({ error: "تعذر تجهيز تخصيص السيرة." });
  }
});

app.get('/api/portfolio/me', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const { contact, accessCode, accessCodeHash } = getPortfolioIdentity(req);

    if (!isValidSubscriberContact(contact) || !isValidAccessCode(accessCode)) {
      return res.status(400).json({
        error: "اكتب بريدًا إلكترونيًا صحيحًا أو حساب سابق مع رمز دخول صحيح.",
      });
    }

    await ensureAccessUser({ contact, accessCode });

    const portfolio = await Portfolio.findOne({ contact, accessCodeHash }).lean();
    const fallbackPortfolio = {
      contact,
      accessCodeHash,
      slug: buildDefaultPortfolioSlug(contact),
      readinessStatus: "مستعد ومؤهل للمقابلات الشخصية",
      email: isValidEmail(contact) ? contact : "",
      targetOrganizations: [],
      skills: [],
      projects: [],
      certifications: [],
      isPublished: false,
      viewCount: 0,
    };
    const accessStatus = await getPortfolioAccessStatus(
      portfolio || fallbackPortfolio
    );
    const cleanPortfolio = serializePortfolio(
      portfolio || fallbackPortfolio,
      accessStatus,
      req
    );

    res.json({
      exists: Boolean(portfolio),
      portfolio: cleanPortfolio,
      publicUrl: `${getFrontendUrl()}/p/${cleanPortfolio.slug}`,
    });
  } catch (err) {
    console.error("❌ Portfolio fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/portfolio/me', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const { contact, accessCode, accessCodeHash } = getPortfolioIdentity(req);

    if (!isValidSubscriberContact(contact) || !isValidAccessCode(accessCode)) {
      return res.status(400).json({
        error: "اكتب بريدًا إلكترونيًا صحيحًا أو حساب سابق مع رمز دخول صحيح.",
      });
    }

    const payload = sanitizePortfolioPayload(req.body, contact);

    if (!payload.fullName || !payload.major) {
      return res.status(400).json({
        error: "اسم الطالب والتخصص مطلوبة لملف الأعمال.",
      });
    }

    if (payload.slug.length < 3) {
      return res.status(400).json({
        error: "الرابط المختصر لازم يكون 3 أحرف على الأقل.",
      });
    }

    const duplicateSlug = await Portfolio.findOne({ slug: payload.slug }).lean();
    if (
      duplicateSlug &&
      (duplicateSlug.contact !== contact ||
        duplicateSlug.accessCodeHash !== accessCodeHash)
    ) {
      return res.status(409).json({
        error: "هذا الرابط مستخدم مسبقًا. جرّب اسمًا مختلفًا.",
      });
    }

    await ensureAccessUser({ contact, accessCode });

    const portfolio = await Portfolio.findOneAndUpdate(
      { contact, accessCodeHash },
      {
        $set: {
          contact,
          accessCodeHash,
          ...payload,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    const accessStatus = await getPortfolioAccessStatus(portfolio);
    const cleanPortfolio = serializePortfolio(portfolio, accessStatus, req);

    await AnalyticsEvent.create({
      eventName: "portfolio_saved",
      visitorId: sanitizeAnalyticsText(req.body.visitorId, 90),
      page: "/account",
      deviceType: sanitizeAnalyticsText(req.body.deviceType, 24),
      metadata: {
        isPublished: cleanPortfolio.isPublished,
        publicActive: cleanPortfolio.publicActive,
      },
    }).catch(() => null);

    res.json({
      portfolio: cleanPortfolio,
      publicUrl: `${getFrontendUrl()}/p/${cleanPortfolio.slug}`,
      message: cleanPortfolio.publicActive
        ? "تم حفظ ملف الأعمال والرابط العام أصبح جاهزًا للمشاركة."
        : "تم حفظ ملف الأعمال. الرابط العام يحتاج دربك+ فعال حتى يظهر للآخرين.",
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({
        error: "هذا الرابط مستخدم مسبقًا. جرّب اسمًا مختلفًا.",
      });
    }

    console.error("❌ Portfolio save error:", err);
    res.status(500).json({ error: err.message });
  }
});

const portfolioAssetParser = express.raw({
  type: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  limit: "4mb",
});

app.put('/api/portfolio/me/assets/:type', portfolioAssetParser, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const type = (req.params.type || "").toString().trim();
    if (!["avatar", "cv"].includes(type)) {
      return res.status(400).json({ error: "نوع الملف غير مدعوم." });
    }

    const { contact, accessCode, accessCodeHash } = getPortfolioIdentity(req);

    if (!isValidSubscriberContact(contact) || !isValidAccessCode(accessCode)) {
      return res.status(400).json({
        error: "سجّل الدخول بالبريد أو حسابك السابق مع رمز دخول صحيح.",
      });
    }

    const fileBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
    const contentType = (req.headers["content-type"] || "").split(";")[0].trim();
    const filename = sanitizePortfolioText(
      decodeURIComponent(req.headers["x-file-name"] || ""),
      120
    );

    if (!fileBuffer.length) {
      return res.status(400).json({ error: "لم يصل ملف صالح." });
    }

    if (type === "avatar") {
      const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
      if (!allowedImageTypes.has(contentType)) {
        return res.status(400).json({ error: "الصورة يجب أن تكون JPG أو PNG أو WEBP." });
      }

      if (fileBuffer.length > 800 * 1024) {
        return res.status(413).json({
          error: "حجم الصورة كبير. جرّب صورة أصغر أو مضغوطة.",
        });
      }
    }

    if (type === "cv") {
      if (contentType !== "application/pdf") {
        return res.status(400).json({ error: "ملف السيرة الذاتية يجب أن يكون PDF." });
      }

      if (fileBuffer.length > 3 * 1024 * 1024) {
        return res.status(413).json({
          error: "حجم ملف السيرة كبير. الحد الأقصى 3MB.",
        });
      }
    }

    await ensureAccessUser({ contact, accessCode });

    const portfolio = await Portfolio.findOneAndUpdate(
      { contact, accessCodeHash },
      {
        $setOnInsert: {
          contact,
          accessCodeHash,
          slug: `${buildDefaultPortfolioSlug(contact)}-${Date.now().toString(36)}`,
          email: isValidEmail(contact) ? contact : "",
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const asset = await PortfolioAsset.create({
      contact,
      accessCodeHash,
      portfolioId: portfolio._id,
      type,
      filename,
      contentType,
      size: fileBuffer.length,
      data: fileBuffer,
    });

    await PortfolioAsset.deleteMany({
      _id: { $ne: asset._id },
      portfolioId: portfolio._id,
      type,
    });

    const assetField =
      type === "avatar"
        ? { avatarAssetId: asset._id, avatarUrl: "" }
        : { cvAssetId: asset._id, cvUrl: "" };

    const updatedPortfolio = await Portfolio.findByIdAndUpdate(
      portfolio._id,
      { $set: assetField },
      { new: true }
    ).lean();

    const accessStatus = await getPortfolioAccessStatus(updatedPortfolio);

    await AnalyticsEvent.create({
      eventName: "portfolio_file_uploaded",
      visitorId: sanitizeAnalyticsText(req.headers["x-darbak-visitor-id"], 90),
      page: "/portofoili",
      deviceType: sanitizeAnalyticsText(req.headers["x-darbak-device-type"], 24),
      metadata: { type, size: fileBuffer.length },
    }).catch(() => null);

    res.json({
      assetId: asset._id.toString(),
      assetUrl: getPortfolioAssetUrl(req, asset._id),
      portfolio: serializePortfolio(updatedPortfolio, accessStatus, req),
    });
  } catch (err) {
    console.error("❌ Portfolio asset upload error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/portfolio-assets/:assetId', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const assetId = req.params.assetId || "";
    if (!mongoose.Types.ObjectId.isValid(assetId)) {
      return res.status(404).send("Not found");
    }

    const asset = await PortfolioAsset.findById(assetId);
    if (!asset) {
      return res.status(404).send("Not found");
    }

    const portfolio = await Portfolio.findById(asset.portfolioId).lean();
    if (!portfolio) {
      return res.status(404).send("Not found");
    }

    const accessStatus = await getPortfolioAccessStatus(portfolio);
    if (!accessStatus.isActive) {
      return res.status(403).send("Portfolio is not active");
    }

    res.setHeader("Content-Type", asset.contentType);
    res.setHeader("Content-Length", asset.size);
    res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    res.setHeader(
      "Content-Disposition",
      asset.type === "cv"
        ? `inline; filename="${encodeURIComponent(asset.filename || "cv.pdf")}"`
        : "inline"
    );
    res.end(asset.data);
  } catch (err) {
    console.error("❌ Portfolio asset fetch error:", err);
    res.status(500).send("Server error");
  }
});

app.get('/api/portfolios/:slug', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const slug = normalizePortfolioSlug(req.params.slug || "");
    if (!slug) {
      return res.status(404).json({ error: "Portfolio not found" });
    }

    const portfolio = await Portfolio.findOne({ slug }).lean();
    if (!portfolio) {
      return res.status(404).json({ error: "Portfolio not found" });
    }

    const accessStatus = await getPortfolioAccessStatus(portfolio);

    if (!accessStatus.isActive) {
      await AnalyticsEvent.create({
        eventName: "portfolio_inactive_opened",
        visitorId: sanitizeAnalyticsText(req.query.visitorId, 90),
        page: `/p/${slug}`,
        deviceType: sanitizeAnalyticsText(req.query.deviceType, 24),
        metadata: { slug },
      }).catch(() => null);

      return res.status(402).json({
        requiresActivation: true,
        error: "ملف الأعمال محفوظ، لكنه يحتاج تفعيل دربك+ حتى يكون ظاهرًا للعامة.",
        portfolio: {
          slug: portfolio.slug,
          fullName: portfolio.fullName || "",
        },
      });
    }

    const updatedPortfolio = await Portfolio.findByIdAndUpdate(
      portfolio._id,
      { $inc: { viewCount: 1 } },
      { new: true }
    ).lean();

    await AnalyticsEvent.create({
      eventName: "portfolio_public_viewed",
      visitorId: sanitizeAnalyticsText(req.query.visitorId, 90),
      page: `/p/${slug}`,
      deviceType: sanitizeAnalyticsText(req.query.deviceType, 24),
      metadata: { slug },
    }).catch(() => null);

    res.json({
      portfolio: serializePortfolio(updatedPortfolio, accessStatus, req),
    });
  } catch (err) {
    console.error("❌ Public portfolio error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/subscriptions/plans', (req, res) => {
  const plans = getPublicSubscriptionPlans(process.env);

  res.json({
    resumePlanLaunchEnabled: RESUME_PLAN_LAUNCH_ENABLED,
    plans,
  });
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
        error:
          "اكتب بريدًا إلكترونيًا صحيحًا، أو رقم الجوال المستخدم في حساب سابق، مع رمز دخول من 4 إلى 12 رقم أو حرف.",
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
        accessSource: "admin_grant",
        accessGrantedAt: new Date(),
        accessGrantedBy: "admin_login",
        planKey: RESUME_PLAN_KEY,
        entitlements: [PLUS_ENTITLEMENT, RESUME_ENTITLEMENT],
        aiResumeUsageCount: 0,
        aiResumeUsageLimit: getPlanAiResumeUsageLimit(RESUME_PLAN_KEY, process.env),
        aiResumeUsageResetAt: adminExpiresAt,
      });

      return res.json({
        active: true,
        contact,
        email: contact,
        expiresAt: adminExpiresAt,
        accessType: "admin",
        isAdmin: true,
        planId: "admin",
        planKey: RESUME_PLAN_KEY,
        planLabel: "أدمن دربك",
        entitlements: [PLUS_ENTITLEMENT, RESUME_ENTITLEMENT],
        hasResumeAccess: true,
        aiResumeUsageCount: 0,
        aiResumeUsageLimit: getPlanAiResumeUsageLimit(RESUME_PLAN_KEY, process.env),
        aiResumeUsageResetAt: adminExpiresAt,
        priceSar: 0,
        durationDays: 3650,
      });
    }

    const subscription = await Subscription.findOne(
      getActiveSubscriptionFilter(contact, accessCodeHash)
    )
      .sort({ updatedAt: -1 })
      .lean();

    if (!subscription) {
      const manualAccess = getActiveManualAccessWindow(accessUser, new Date());

      if (manualAccess) {
        const expiresAt = manualAccess.expiresAt || addSubscriptionDays(3650);
        const durationDays = Math.max(
          1,
          Math.ceil((new Date(expiresAt) - new Date()) / (24 * 60 * 60 * 1000))
        );

        return res.json({
          active: true,
          contact,
          email: contact,
          expiresAt,
          accessType: manualAccess.accessType,
          isAdmin: false,
          planId: manualAccess.accessType,
          planKey: manualAccess.planKey || PLUS_PLAN_KEY,
          planLabel:
            manualAccess.accessType === "experience_reward"
              ? "هدية مشاركة تجربة"
              : "وصول كامل",
          entitlements: manualAccess.entitlements || [PLUS_ENTITLEMENT],
          hasResumeAccess: (manualAccess.entitlements || []).includes(
            RESUME_ENTITLEMENT
          ),
          aiResumeUsageCount: Number(accessUser.aiResumeUsageCount || 0),
          aiResumeUsageLimit: Number(accessUser.aiResumeUsageLimit || 0),
          aiResumeUsageResetAt: accessUser.aiResumeUsageResetAt || null,
          priceSar: 0,
          durationDays,
          provider: manualAccess.accessType,
          providerPaymentId: "",
          message:
            manualAccess.accessType === "experience_reward"
              ? "تم اعتماد تجربتك وتفعيل شهر الوصول الكامل لك 🤍"
              : "تم تفعيل الوصول الكامل لحسابك.",
        });
      }

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
          await activateMoyasarSubscriptionFromInvoiceId({
            invoiceId: pendingSubscription.providerPaymentId,
            visitorId,
            source: "verify_pending_paid",
          });

          const activated = await Subscription.findById(
            pendingSubscription._id
          ).lean();

          return res.json({
            active: true,
            contact: activated.email,
            email: activated.email,
            expiresAt: activated.expiresAt,
            accessType: "premium",
            planId: activated.planId || "monthly",
            ...buildSubscriptionAccessPayload(activated),
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
            "هذه البيانات مسجلة مسبقًا. استخدم رمز الدخول الصحيح بدل إنشاء اشتراك جديد.",
        });
      }

      return res.status(404).json({
        error: isLegacyMobileSubscriberContact(rawContact)
          ? "ما لقينا اشتراك سابق نشط بهذا الرقم والرمز. الاشتراكات الجديدة الآن بالبريد الإلكتروني."
          : "ما لقينا اشتراك نشط بهذا البريد والرمز.",
      });
    }

    await syncSubscriptionUser(subscription);
    await recordPremiumAccessVerifiedEvent({
      subscription,
      visitorId,
      source: "verify_active",
    });

    if (subscription.provider === "moyasar" && subscription.providerPaymentId) {
      getMoyasarInvoice(subscription.providerPaymentId)
        .then((invoice) =>
          sendPremiumPaymentSuccessEmailOnce({
            subscription,
            invoice,
            source: "verify_active_recovery",
          })
        )
        .then((emailResult) => {
          if (emailResult.emailStatus === "failed") {
            console.error(
              "❌ Premium payment email recovery failed:",
              emailResult.emailError
            );
          }
        })
        .catch((emailErr) =>
          console.error("❌ Premium payment email recovery error:", emailErr)
        );
    }

    res.json({
      active: true,
      contact: subscription.email,
      email: subscription.email,
      expiresAt: subscription.expiresAt,
      accessType: "premium",
      planId: subscription.planId || "monthly",
      ...buildSubscriptionAccessPayload(subscription),
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
        error:
          "اكتب البريد الإلكتروني، أو رقم الجوال إذا كان حسابك قديمًا، عشان نساعدك.",
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

app.post('/api/subscriptions/forgot-code', async (req, res) => {
  const genericMessage =
    "إذا كان هذا البريد مرتبطًا بحساب دربك+، ستصلك رسالة لإعادة تعيين رمز الدخول خلال دقائق.";

  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const rawEmail = (req.body.email || req.body.contact || "")
      .toString()
      .trim()
      .slice(0, 160);

    if (!isValidEmail(rawEmail)) {
      return res.status(400).json({
        error: "اكتب البريد الإلكتروني المرتبط بحساب دربك+.",
      });
    }

    const email = normalizeEmail(rawEmail);
    const subscription = await Subscription.findOne({
      email,
      status: "active",
      expiresAt: { $gt: new Date() },
    })
      .sort({ updatedAt: -1 })
      .lean();

    await AnalyticsEvent.create({
      eventName: "premium_access_reset_requested",
      visitorId: sanitizeAnalyticsText(req.body.visitorId, 90),
      page: "/subscriptions/reset-code",
      deviceType: "unknown",
      metadata: sanitizeAnalyticsMetadata({
        hasSubscription: Boolean(subscription),
        source: sanitizeAnalyticsText(req.body.source || "", 80),
      }),
    }).catch((analyticsErr) =>
      console.error("❌ Reset request analytics error:", analyticsErr)
    );

    if (!subscription) {
      return res.json({ success: true, message: genericMessage });
    }

    const resetToken = generateAccessResetToken();
    const resetTokenHash = hashAccessResetToken(resetToken);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const resetUrl = new URL(getFrontendUrl());
    resetUrl.searchParams.set("reset_code_token", resetToken);
    resetUrl.searchParams.set("reset_contact", email);

    await Subscription.findByIdAndUpdate(subscription._id, {
      $set: {
        accessResetTokenHash: resetTokenHash,
        accessResetExpiresAt: expiresAt,
        accessResetRequestedAt: new Date(),
      },
      $unset: {
        accessResetUsedAt: "",
      },
    });

    const emailResult = await sendAccessCodeResetEmail({
      email,
      resetUrl: resetUrl.toString(),
      expiresAt,
    });

    await AnalyticsEvent.create({
      eventName:
        emailResult.emailStatus === "sent"
          ? "premium_access_reset_email_sent"
          : "premium_access_reset_email_failed",
      visitorId: sanitizeAnalyticsText(req.body.visitorId, 90),
      page: "/subscriptions/reset-code",
      deviceType: "unknown",
      metadata: sanitizeAnalyticsMetadata({
        emailStatus: emailResult.emailStatus,
        emailError: emailResult.emailError || "",
      }),
    }).catch((analyticsErr) =>
      console.error("❌ Reset email analytics error:", analyticsErr)
    );

    if (emailResult.emailStatus === "not_configured") {
      return res.status(503).json({
        error:
          "إرسال الإيميل غير مفعّل حاليًا. تواصلي معنا وسنساعدك يدويًا.",
      });
    }

    if (emailResult.emailStatus === "failed") {
      return res.status(502).json({
        error:
          "تعذر إرسال إيميل إعادة التعيين حاليًا. جرّب مرة أخرى بعد قليل.",
      });
    }

    res.json({ success: true, message: genericMessage });
  } catch (err) {
    console.error("❌ Subscription forgot code error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/subscriptions/reset-code', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const rawEmail = (req.body.email || req.body.contact || "")
      .toString()
      .trim()
      .slice(0, 160);
    const token = (req.body.token || "").toString().trim();
    const newAccessCode = normalizeAccessCode(req.body.accessCode || "");
    const visitorId = sanitizeAnalyticsText(req.body.visitorId, 90);

    if (!isValidEmail(rawEmail)) {
      return res.status(400).json({
        error: "اكتب البريد الإلكتروني المرتبط بحساب دربك+.",
      });
    }

    if (!token || token.length < 32) {
      return res.status(400).json({
        error: "رابط إعادة التعيين غير صالح أو ناقص.",
      });
    }

    if (!isValidAccessCode(newAccessCode)) {
      return res.status(400).json({
        error: "اختَر رمز دخول جديد من 4 إلى 12 رقم أو حرف إنجليزي.",
      });
    }

    const email = normalizeEmail(rawEmail);
    const tokenHash = hashAccessResetToken(token);
    const subscription = await Subscription.findOne({
      email,
      accessResetTokenHash: tokenHash,
      accessResetExpiresAt: { $gt: new Date() },
      status: "active",
      expiresAt: { $gt: new Date() },
    }).sort({ updatedAt: -1 });

    if (!subscription) {
      return res.status(400).json({
        error:
          "رابط إعادة التعيين غير صالح أو انتهت صلاحيته. اطلب رابطًا جديدًا.",
      });
    }

    const previousAccessCodeHash = subscription.accessCodeHash;
    const nextAccessCodeHash = hashAccessCode(email, newAccessCode);
    const now = new Date();

    await Subscription.updateMany(
      {
        email,
        accessCodeHash: previousAccessCodeHash,
        status: "active",
        expiresAt: { $gt: now },
      },
      {
        $set: {
          accessCodeHash: nextAccessCodeHash,
          accessResetUsedAt: now,
        },
        $unset: {
          accessResetTokenHash: "",
          accessResetExpiresAt: "",
          accessResetRequestedAt: "",
        },
      }
    );

    const userPayload = {
      contact: email,
      accessCodeHash: nextAccessCodeHash,
      isPremium:
        subscription.status === "active" &&
        subscription.expiresAt &&
        new Date(subscription.expiresAt) > now,
      premiumExpiresAt: subscription.expiresAt,
    };
    const existingNextUser = await User.findOne({
      contact: email,
      accessCodeHash: nextAccessCodeHash,
    });
    if (existingNextUser) {
      await User.findByIdAndUpdate(existingNextUser._id, { $set: userPayload });
    } else {
      await User.findOneAndUpdate(
        { contact: email, accessCodeHash: previousAccessCodeHash },
        { $set: userPayload },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    }

    await Portfolio.updateMany(
      { contact: email, accessCodeHash: previousAccessCodeHash },
      { $set: { accessCodeHash: nextAccessCodeHash } }
    );
    await PortfolioAsset.updateMany(
      { contact: email, accessCodeHash: previousAccessCodeHash },
      { $set: { accessCodeHash: nextAccessCodeHash } }
    );

    const updatedSubscription = await Subscription.findOne(
      getActiveSubscriptionFilter(email, nextAccessCodeHash)
    ).lean();

    if (updatedSubscription) {
      await syncSubscriptionUser(updatedSubscription);
    }

    await AnalyticsEvent.create({
      eventName: "premium_access_code_reset",
      visitorId,
      page: "/subscriptions/reset-code",
      deviceType: "unknown",
      metadata: sanitizeAnalyticsMetadata({
        planId: subscription.planId || "monthly",
        status: subscription.status,
      }),
    }).catch((analyticsErr) =>
      console.error("❌ Reset success analytics error:", analyticsErr)
    );

    res.json({
      success: true,
      message: "تم تحديث رمز الدخول. تم تسجيل دخولك إلى دربك+.",
      active: Boolean(updatedSubscription),
      contact: email,
      email,
      expiresAt: updatedSubscription?.expiresAt || subscription.expiresAt,
      accessType: updatedSubscription ? "premium" : "pending",
      ...(updatedSubscription
        ? buildSubscriptionAccessPayload(updatedSubscription)
        : buildSubscriptionAccessPayload(subscription)),
      priceSar: getSubscriptionPriceSar(subscription),
      durationDays: getSubscriptionDurationDays(subscription),
      provider: subscription.provider || "",
      providerPaymentId: subscription.providerPaymentId || "",
    });
  } catch (err) {
    console.error("❌ Subscription reset code error:", err);
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
    const selectedPlanKey = selectedPlan.planKey || normalizePlanKey(selectedPlan.id);
    const visitorId = sanitizeAnalyticsText(req.body.visitorId, 90);

    if (
      !isValidSubscriberContact(rawContact) ||
      !isValidAccessCode(accessCode)
    ) {
      return res.status(400).json({
        error:
          "اكتب بريدًا إلكترونيًا صحيحًا، أو رقم الجوال المستخدم في حساب سابق، مع رمز دخول من 4 إلى 12 رقم أو حرف قبل تفعيل دربك+.",
      });
    }

    const accessCodeHash = hashAccessCode(contact, accessCode);

    if (isLegacyMobileSubscriberContact(rawContact)) {
      const existingLegacySubscription = await Subscription.findOne({
        email: contact,
      })
        .sort({ updatedAt: -1 })
        .lean();

      if (!existingLegacySubscription) {
        return res.status(400).json({
          error:
            "الاشتراكات الجديدة أصبحت بالبريد الإلكتروني فقط. استخدم إيميلك، أو ادخل برقمك إذا كان لديك اشتراك سابق.",
        });
      }
    }

    const accessUser = await ensureAccessUser({ contact, accessCode });

    if (accessUser?.isAdmin || isAdminContact(contact, accessCode)) {
      const adminExpiresAt = addSubscriptionDays(3650);
      await User.findByIdAndUpdate(accessUser._id, {
        isAdmin: true,
        isPremium: true,
        premiumExpiresAt: adminExpiresAt,
        planKey: RESUME_PLAN_KEY,
        entitlements: [PLUS_ENTITLEMENT, RESUME_ENTITLEMENT],
        aiResumeUsageLimit: getPlanAiResumeUsageLimit(RESUME_PLAN_KEY, process.env),
        aiResumeUsageResetAt: adminExpiresAt,
      });

      return res.json({
        active: true,
        contact,
        email: contact,
        expiresAt: adminExpiresAt,
        accessType: "admin",
        isAdmin: true,
        planId: "admin",
        planKey: RESUME_PLAN_KEY,
        entitlements: [PLUS_ENTITLEMENT, RESUME_ENTITLEMENT],
        hasResumeAccess: true,
        aiResumeUsageCount: 0,
        aiResumeUsageLimit: getPlanAiResumeUsageLimit(RESUME_PLAN_KEY, process.env),
        aiResumeUsageResetAt: adminExpiresAt,
        priceSar: 0,
        durationDays: 3650,
      });
    }

    if (selectedPlanKey === RESUME_PLAN_KEY && !RESUME_PLAN_LAUNCH_ENABLED) {
      return res.status(403).json({
        error: "باقة دربك+ سيرة قيد التجهيز، ولا يمكن شراؤها حاليًا.",
        reason: "resume_plan_not_launched",
        planKey: RESUME_PLAN_KEY,
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
            "هذه البيانات مسجلة مسبقًا. إذا أنت مشترك سابق، استخدم رمز الدخول الصحيح واضغط دخول مشترك سابق.",
        });
      }

      if (existingSubscription.status === "active") {
        const existingEntitlements = getSubscriptionEntitlements(existingSubscription);
        const alreadyHasSelectedPlan = (selectedPlan.entitlements || []).every(
          (entitlement) => existingEntitlements.includes(entitlement)
        );

        if (alreadyHasSelectedPlan) {
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
            ...buildSubscriptionAccessPayload(existingSubscription),
            priceSar: getSubscriptionPriceSar(existingSubscription),
            durationDays: getSubscriptionDurationDays(existingSubscription),
            provider: existingSubscription.provider || "",
            providerPaymentId: existingSubscription.providerPaymentId || "",
          });
        }
      }

      if (
        existingSubscription.status === "pending" &&
        existingSubscription.provider === "moyasar" &&
        existingSubscription.providerPaymentId
      ) {
        const isSamePendingPlan =
          getSubscriptionPlanKey(existingSubscription) === selectedPlanKey;
        const invoice = await getMoyasarInvoice(
          existingSubscription.providerPaymentId
        );

        if (invoice.status === "paid") {
          await activateMoyasarSubscriptionFromInvoiceId({
            invoiceId: existingSubscription.providerPaymentId,
            visitorId,
            source: "start_checkout_pending_paid",
          });

          const activated = await Subscription.findById(
            existingSubscription._id
          ).lean();

          return res.json({
            active: true,
            contact: activated.email,
            email: activated.email,
            expiresAt: activated.expiresAt,
            accessType: "premium",
            ...buildSubscriptionAccessPayload(activated),
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
            ...buildSubscriptionAccessPayload(existingSubscription),
            priceSar: getSubscriptionPriceSar(existingSubscription),
            durationDays: getSubscriptionDurationDays(existingSubscription),
          });
        }
      }
    }

    const successUrl = getSafeSubscriptionReturnUrl(req.body.returnUrl);
    const moyasarCallbackUrl = `${getPublicApiUrl(req)}/api/subscriptions/moyasar/callback`;

    const amountHalalas = Math.round(selectedPlan.priceSar * 100);
    const currentActiveSubscription =
      existingSubscription?.status === "active" &&
      existingSubscription.expiresAt &&
      new Date(existingSubscription.expiresAt) > new Date()
        ? existingSubscription
        : null;
    const accessWindow = calculateAccessWindow({
      currentExpiresAt: currentActiveSubscription?.expiresAt,
      durationDays: selectedPlan.durationDays,
      now: new Date(),
      extendFromCurrent: Boolean(currentActiveSubscription),
    });
    const subscriptionEntitlements = getPlanEntitlements(selectedPlanKey, process.env);
    const usageLimit = selectedPlan.aiResumeUsageLimit || 0;

    if (MOYASAR_SECRET_KEY) {
      const invoice = await createMoyasarInvoice({
        amountHalalas,
        description: `${selectedPlan.label} للوصول إلى المزايا الرقمية المتقدمة في منصة دربك`,
        callbackUrl: moyasarCallbackUrl,
        successUrl,
        backUrl: successUrl,
        metadata: {
          darbak_contact: contact,
          plan_id: selectedPlan.id,
          plan_key: selectedPlanKey,
          source: "darbak_plus",
        },
      });

      const pendingSubscription = await Subscription.findOneAndUpdate(
        {
          email: contact,
          accessCodeHash,
          status: "pending",
          provider: "moyasar",
          planKey: selectedPlanKey,
        },
        {
          email: contact,
          accessCodeHash,
          status: "pending",
          planId: selectedPlan.id,
          planKey: selectedPlanKey,
          entitlements: subscriptionEntitlements,
          priceSar: selectedPlan.priceSar,
          durationDays: selectedPlan.durationDays,
          startsAt: accessWindow.startsAt,
          expiresAt: accessWindow.expiresAt,
          provider: "moyasar",
          providerPaymentId: invoice.id || "",
          isUpgrade: Boolean(currentActiveSubscription),
          upgradedFromPlanKey: currentActiveSubscription
            ? getSubscriptionPlanKey(currentActiveSubscription)
            : "",
          aiResumeUsageCount: 0,
          aiResumeUsageLimit: usageLimit,
          aiResumeUsageResetAt: accessWindow.expiresAt,
        },
        { new: true, upsert: true, runValidators: true }
      );

      return res.json({
        checkoutUrl: invoice.url,
        provider: "moyasar",
        invoiceId: invoice.id,
        planId: selectedPlan.id,
        planKey: selectedPlanKey,
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
        url.searchParams.set("planKey", selectedPlanKey);
        checkoutUrl = url.toString();
      } catch {
        // Keep custom provider links as-is if they are not parseable URLs.
      }

      const pendingSubscription = await Subscription.findOneAndUpdate(
        {
          email: contact,
          accessCodeHash,
          status: "pending",
          provider: "manual",
          planKey: selectedPlanKey,
        },
        {
          email: contact,
          accessCodeHash,
          status: "pending",
          planId: selectedPlan.id,
          planKey: selectedPlanKey,
          entitlements: subscriptionEntitlements,
          priceSar: selectedPlan.priceSar,
          durationDays: selectedPlan.durationDays,
          startsAt: accessWindow.startsAt,
          expiresAt: accessWindow.expiresAt,
          provider: "manual",
          providerPaymentId: "",
          isUpgrade: Boolean(currentActiveSubscription),
          upgradedFromPlanKey: currentActiveSubscription
            ? getSubscriptionPlanKey(currentActiveSubscription)
            : "",
          aiResumeUsageCount: 0,
          aiResumeUsageLimit: usageLimit,
          aiResumeUsageResetAt: accessWindow.expiresAt,
        },
        { new: true, upsert: true, runValidators: true }
      );

      return res.json({
        checkoutUrl,
        provider: "manual",
        planId: selectedPlan.id,
        planKey: selectedPlanKey,
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

    const eventType = getMoyasarEventType(req.body);
    const invoiceId =
      extractMoyasarInvoiceId(req.body, {
        allowRootId:
          moyasarPayloadLooksLikeInvoice(req.body) ||
          eventType.includes("invoice"),
      }) ||
      req.query.invoice_id;
    const paymentId =
      extractMoyasarPaymentId(req.body, {
        allowRootId: !invoiceId,
      }) || req.query.payment_id || req.query.id;

    if (!invoiceId && !paymentId) {
      return res
        .status(400)
        .json({ error: "Missing Moyasar invoice or payment id" });
    }

    const result = invoiceId
      ? await activateMoyasarSubscriptionFromInvoiceId({
          invoiceId,
          source: "moyasar_callback",
        })
      : await activateMoyasarSubscriptionFromPaymentId({
          paymentId,
          source: "moyasar_callback_payment",
        });

    res.json(result);
  } catch (err) {
    console.error("❌ Moyasar callback error:", err);
    res.status(err.statusCode || 500).json({
      error: "تعذر تأكيد الدفع من ميسر.",
      details: err.details,
    });
  }
});

app.post('/api/webhooks/moyasar', (req, res) => {
  try {
    const webhookSecret =
      process.env.MOYASAR_WEBHOOK_SECRET ||
      process.env.MOYASAR_WEBHOOK_TOKEN ||
      "";

    if (webhookSecret) {
      const authHeader = (req.get("authorization") || "").replace(
        /^Bearer\s+/i,
        ""
      );
      const receivedSecret =
        req.body?.secret_token ||
        req.body?.secretToken ||
        req.get("x-moyasar-secret") ||
        req.get("x-webhook-secret") ||
        authHeader ||
        "";

      if (receivedSecret !== webhookSecret) {
        return res.status(401).json({ ok: false, error: "Invalid webhook secret" });
      }
    }

    const eventType = getMoyasarEventType(req.body);
    const status = getMoyasarPayloadStatus(req.body);

    if (
      (eventType && !eventType.includes("paid") && !eventType.includes("payment")) ||
      (status && status !== "paid")
    ) {
      return res.json({ ok: true, ignored: true, eventType, status });
    }

    const invoiceId = extractMoyasarInvoiceId(req.body, {
      allowRootId:
        moyasarPayloadLooksLikeInvoice(req.body) ||
        eventType.includes("invoice"),
    });
    const paymentId = extractMoyasarPaymentId(req.body, {
      allowRootId: !invoiceId,
    });

    if (!invoiceId && !paymentId) {
      console.warn("⚠️ Moyasar webhook ignored: missing invoice or payment id", {
        eventType,
        status,
      });
      return res.json({
        ok: true,
        ignored: true,
        reason: "missing_moyasar_id",
      });
    }

    res.json({ ok: true, received: true, invoiceId: Boolean(invoiceId), paymentId: Boolean(paymentId) });

    setImmediate(async () => {
      try {
        if (mongoose.connection.readyState !== 1) return;
        if (invoiceId) {
          await activateMoyasarSubscriptionFromInvoiceId({
            invoiceId,
            source: "moyasar_webhook",
          });
          return;
        }

        await activateMoyasarSubscriptionFromPaymentId({
          paymentId,
          source: "moyasar_webhook_payment",
        });
      } catch (err) {
        console.error("❌ Moyasar webhook processing error:", err);
      }
    });
  } catch (err) {
    console.error("❌ Moyasar webhook error:", err);
    res.status(500).json({ ok: false, error: "Webhook processing failed" });
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
    const selectedPlanKey = selectedPlan.planKey || normalizePlanKey(selectedPlan.id);
    const days = Number(req.body.days || selectedPlan.durationDays);
    const priceSar = Number(req.body.priceSar || selectedPlan.priceSar);
    const now = new Date();
    const expiresAt = addDaysFromDate(now, days);

    if (
      !isValidSubscriberContact(req.body.email || req.body.contact) ||
      !isValidAccessCode(accessCode)
    ) {
      return res.status(400).json({
        error:
          "اكتب بريدًا إلكترونيًا صحيحًا، أو رقم الجوال المستخدم في حساب سابق، مع رمز دخول من 4 إلى 12 رقم أو حرف.",
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

    const existingAnySubscription =
      existingSubscription ||
      (isLegacyMobileSubscriberContact(req.body.email || req.body.contact)
        ? await Subscription.findOne({ email: contact })
            .sort({ updatedAt: -1 })
            .lean()
        : null);

    if (
      isLegacyMobileSubscriberContact(req.body.email || req.body.contact) &&
      !existingAnySubscription
    ) {
      return res.status(400).json({
        error:
          "لا يمكن إنشاء اشتراك جديد برقم الجوال. استخدم البريد الإلكتروني، أو حدّث حسابًا قديمًا موجودًا.",
      });
    }

    const subscriptionQuery = existingAnySubscription
      ? { _id: existingAnySubscription._id }
      : { email: contact, accessCodeHash };
    const subscription = await Subscription.findOneAndUpdate(
      subscriptionQuery,
      {
        email: contact,
        accessCodeHash,
        status: "active",
        planId: selectedPlan.id,
        planKey: selectedPlanKey,
        entitlements: getPlanEntitlements(selectedPlanKey, process.env),
        priceSar,
        durationDays: days,
        startsAt: now,
        expiresAt,
        provider: req.body.provider || "manual",
        providerPaymentId: req.body.providerPaymentId || "",
        aiResumeUsageCount: 0,
        aiResumeUsageLimit: selectedPlan.aiResumeUsageLimit || 0,
        aiResumeUsageResetAt: expiresAt,
      },
      { new: true, upsert: true, runValidators: true }
    ).lean();

    await syncSubscriptionUser(subscription);

    res.json({
      email: subscription.email,
      status: subscription.status,
      expiresAt: subscription.expiresAt,
      resetAccessCode: Boolean(existingAnySubscription),
    });
  } catch (err) {
    console.error("❌ Admin subscription create error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/email/test', requireAdmin, async (req, res) => {
  try {
    const emailResult = await sendAdminTestEmail();

    await AnalyticsEvent.create({
      eventName: "admin_email_test",
      page: "/admin/users",
      deviceType: "unknown",
      metadata: sanitizeAnalyticsMetadata({
        emailStatus: emailResult.emailStatus,
        emailError: emailResult.emailError || "",
        emailTo: CONTACT_EMAIL_TO,
        emailFrom: CONTACT_EMAIL_FROM,
      }),
    }).catch(() => null);

    if (emailResult.emailStatus === "not_configured") {
      return res.status(503).json({
        error:
          "إرسال الإيميل غير مفعّل. أضيفي RESEND_API_KEY في Render وتأكدي من CONTACT_EMAIL_FROM.",
        emailStatus: emailResult.emailStatus,
        emailTo: CONTACT_EMAIL_TO,
        emailFrom: CONTACT_EMAIL_FROM,
      });
    }

    if (emailResult.emailStatus === "failed") {
      return res.status(502).json({
        error: "Resend رفض إرسال الإيميل.",
        emailStatus: emailResult.emailStatus,
        emailError: emailResult.emailError,
        emailTo: CONTACT_EMAIL_TO,
        emailFrom: CONTACT_EMAIL_FROM,
      });
    }

    res.json({
      ok: true,
      emailStatus: emailResult.emailStatus,
      emailTo: CONTACT_EMAIL_TO,
      emailFrom: CONTACT_EMAIL_FROM,
    });
  } catch (err) {
    console.error("❌ Admin email test error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/subscriptions/:id/resend-payment-email', requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const subscription = await Subscription.findById(req.params.id).lean();
    if (!subscription) {
      return res.status(404).json({ error: "الاشتراك غير موجود." });
    }

    if (!subscription.providerPaymentId) {
      return res.status(400).json({
        error: "لا يوجد رقم عملية دفع مرتبط بهذا الاشتراك لإعادة إرسال الإيميل.",
      });
    }

    const isPaidLikeStatus =
      subscription.status === "active" || subscription.status === "expired";
    if (!isPaidLikeStatus) {
      return res.status(400).json({
        error: "لا يمكن إرسال إيميل دفع ناجح لاشتراك لم يتم تفعيله بعد.",
      });
    }

    const paymentSource = await getMoyasarPaymentSourceForSubscription(subscription);
    const emailResult = await sendPremiumPaymentSuccessEmailOnce({
      subscription,
      invoice: paymentSource,
      source: "admin_manual_resend",
      force: true,
    });

    if (emailResult.emailStatus === "not_configured") {
      return res.status(503).json({
        error:
          "إرسال الإيميل غير مفعّل. أضيفي RESEND_API_KEY و CONTACT_EMAIL_FROM في Render.",
        emailStatus: emailResult.emailStatus,
      });
    }

    if (emailResult.emailStatus === "failed") {
      return res.status(502).json({
        error: "تعذر إرسال الإيميل من Resend.",
        emailStatus: emailResult.emailStatus,
        emailError: emailResult.emailError,
      });
    }

    res.json({
      ok: true,
      emailStatus: emailResult.emailStatus,
      emailTo: CONTACT_EMAIL_TO,
      sentAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("❌ Admin payment email resend error:", err);
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
    const subscriptionClauses = [];

    if (search) {
      const normalizedSearch = normalizeSubscriberContact(search) || search;
      const regex = new RegExp(escapeRegex(normalizedSearch), "i");
      userClauses.push({ $or: [{ contact: regex }, { visitorId: regex }] });
      subscriptionClauses.push({
        $or: [{ email: regex }, { providerPaymentId: regex }],
      });
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
    const subscriptionFilter =
      subscriptionClauses.length > 0 ? { $and: subscriptionClauses } : {};
    const activeWindowMinutes = 5;
    const visitorMatch = { visitorId: { $type: "string", $ne: "" } };
    const activeVisitorMatch = {
      ...visitorMatch,
      createdAt: {
        $gte: new Date(Date.now() - activeWindowMinutes * 60 * 1000),
      },
    };

    const [
      totalUsers,
      contactUsers,
      visitorOnlyUsers,
      adminUsers,
      premiumUsers,
      freeUsers,
      filteredUsers,
      totalSubscriptions,
      activeSubscriptions,
      pendingSubscriptions,
      expiredSubscriptions,
      cancelledSubscriptions,
      filteredSubscriptions,
      allTimePageVisits,
      allTimeVisitors,
      activeVisitors,
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
      User.countDocuments({
        contact: { $ne: "" },
        isAdmin: { $ne: true },
        $or: [
          { isPremium: { $ne: true } },
          { premiumExpiresAt: { $lte: now } },
        ],
      }),
      User.countDocuments(userFilter),
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
      Subscription.countDocuments(subscriptionFilter),
      AnalyticsEvent.countDocuments({ eventName: "page_view" }),
      AnalyticsEvent.distinct("visitorId", visitorMatch),
      AnalyticsEvent.distinct("visitorId", activeVisitorMatch),
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
          "contact visitorId accessCodeHash isPremium isAdmin premiumExpiresAt accessSource accessGrantedAt accessGrantedBy lastViewedDate dailyViewsCount dailyViewItemKeys subscriptionReminderLastShownAt createdAt updatedAt"
        )
        .lean(),
      Subscription.find(subscriptionFilter)
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
          ? user.accessSource || "premium"
          : user.contact
          ? "free"
          : "visitor",
        isPremium: hasActivePremium,
        isAdmin: Boolean(user.isAdmin),
        premiumExpiresAt: user.premiumExpiresAt || null,
        accessSource: user.accessSource || "",
        accessGrantedAt: user.accessGrantedAt || null,
        accessGrantedBy: user.accessGrantedBy || "",
        lastViewedDate: user.lastViewedDate || "",
        subscriptionReminderLastShownAt:
          user.subscriptionReminderLastShownAt || null,
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
        freeUsers,
        filteredUsers,
        totalSubscriptions,
        activeSubscriptions,
        pendingSubscriptions,
        expiredSubscriptions,
        cancelledSubscriptions,
        filteredSubscriptions,
        allTimePageVisits,
        allTimeVisitors: allTimeVisitors.filter(Boolean).length,
        activeVisitors: activeVisitors.filter(Boolean).length,
        activeWindowMinutes,
        paidSubscriptions: paidRevenueStats[0]?.count || 0,
        totalPaidRevenueSar: Number(paidRevenueStats[0]?.total || 0),
        activeRevenueSar: Number(activeRevenueStats[0]?.total || 0),
      },
      emailSettings: {
        resendConfigured: Boolean(RESEND_API_KEY),
        emailTo: CONTACT_EMAIL_TO,
        emailFrom: CONTACT_EMAIL_FROM,
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

app.get('/api/admin/resume-agent/storage-stats', requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const [sessions, pendingDrafts, tailoredVersions] = await Promise.all([
      ResumeAgentSession.find({})
        .sort({ updatedAt: -1 })
        .limit(250)
        .select("sessionId purpose status collectedFacts pendingQuestions usage expiresAt updatedAt")
        .lean(),
      ResumePendingDraft.find({})
        .sort({ updatedAt: -1 })
        .limit(250)
        .select("draftType status draft sourceMap validationResult expiresAt updatedAt")
        .lean(),
      ResumeTailoredVersion.find({})
        .sort({ updatedAt: -1 })
        .limit(250)
        .select("status resumePayload sourceMap validationResult updatedAt")
        .lean(),
    ]);

    const sumBytes = (items = []) =>
      items.reduce((total, item) => total + estimateJsonBytes(item), 0);

    res.json({
      summary: {
        sessionsCount: await ResumeAgentSession.countDocuments({}),
        pendingDraftsCount: await ResumePendingDraft.countDocuments({}),
        tailoredVersionsCount: await ResumeTailoredVersion.countDocuments({
          status: "approved",
        }),
        sampledSessionsBytes: sumBytes(sessions),
        sampledPendingDraftsBytes: sumBytes(pendingDrafts),
        sampledTailoredVersionsBytes: sumBytes(tailoredVersions),
        sampleLimit: 250,
      },
      recentSessions: sessions.map((session) => ({
        sessionId: session.sessionId,
        purpose: session.purpose,
        status: session.status,
        answersCount: Array.isArray(session.collectedFacts?.answers)
          ? session.collectedFacts.answers.length
          : 0,
        questionsCount: Array.isArray(session.pendingQuestions)
          ? session.pendingQuestions.length
          : 0,
        usage: session.usage || {},
        bytes: estimateJsonBytes(session),
        updatedAt: session.updatedAt,
        expiresAt: session.expiresAt,
      })),
    });
  } catch (err) {
    console.error("❌ Admin resume agent storage stats error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/resume-agent/env-check', requireAdmin, (req, res) => {
  const openAiKey = (process.env.OPENAI_API_KEY || "").trim();
  const model = (process.env.OPENAI_RESUME_AGENT_MODEL || "").trim();
  const maxTurns = (process.env.RESUME_AGENT_MAX_TURNS || "").trim();

  res.json({
    openAiKeyConfigured: Boolean(openAiKey),
    openAiKeyLooksValid: /^sk-/.test(openAiKey),
    openAiKeyPrefix: openAiKey ? openAiKey.slice(0, 7) : "",
    modelConfigured: Boolean(model),
    model: model || "gpt-5.6-terra",
    maxTurnsConfigured: Boolean(maxTurns),
    maxTurns: maxTurns || "6",
    nodeVersion: process.version,
  });
});

app.get('/api/admin/analytics', requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const { days, rangeLabel, match } = getAnalyticsDateScope(req.query.days);
    const cleanMatch = getCleanAnalyticsMatch(match);
    const analyticsCacheKey = getRequestCacheKey(
      "admin-analytics-light:v4",
      req.query
    );
    const cachedAnalytics = getReadCache(analyticsCacheKey);
    if (cachedAnalytics) {
      return res.json(cachedAnalytics);
    }

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
      "subscription_reminder_shown",
      "subscription_reminder_clicked",
      "premium_gate_opened",
      "premium_gate_closed",
      "premium_nav_cta_clicked",
      "premium_experiences_banner_clicked",
      "premium_where_to_train_opportunities_banner_clicked",
      "premium_plan_selected",
      "checkout_started",
      "premium_checkout_started",
      "premium_checkout_failed",
      "premium_payment_returned",
      "subscription_completed",
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
    const subscriptionDateMatch = match.createdAt
      ? { updatedAt: match.createdAt }
      : {};
    const visitorIdFilter = { visitorId: { $type: "string", $nin: [""] } };

    const [
      totalEvents,
      pageVisits,
      allTimePageVisits,
      uniqueVisitors,
      allTimeVisitors,
      topMajors,
      topCities,
      topSearches,
      topPages,
      topDevices,
      topOrganizations,
      assistantQueries,
      interviewPageViews,
      interviewSearches,
      guideFileAdClicks,
      cvProductAdClicks,
      topAdClicks,
      premiumEventCounts,
      topPremiumPlans,
      paidMoyasarSubscriptions,
      dailyPremiumFunnel,
      topSharedExperiences,
      topSharedOpportunities,
    ] = await Promise.all([
      AnalyticsEvent.countDocuments(cleanMatch),
      AnalyticsEvent.countDocuments({ ...match, eventName: "page_view" }),
      AnalyticsEvent.countDocuments({ eventName: "page_view" }),
      AnalyticsEvent.distinct("visitorId", {
        ...match,
        eventName: "page_view",
        ...visitorIdFilter,
      }).then((visitors) => visitors.length),
      AnalyticsEvent.distinct("visitorId", {
        eventName: "page_view",
        ...visitorIdFilter,
      }).then((visitors) => visitors.length),
      getAnalyticsGroup(cleanMatch, "major", 12),
      getAnalyticsGroup(cleanMatch, "city", 12),
      getAnalyticsSearches(match, 12),
      getAnalyticsGroup(cleanMatch, "page", 12),
      getAnalyticsGroup(cleanMatch, "deviceType", 4),
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
      AnalyticsEvent.countDocuments(interviewPageMatch),
      AnalyticsEvent.countDocuments({
        ...cleanMatch,
        eventName: "interviews_search",
      }),
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
              $in: [
                "premium_plan_selected",
                "premium_checkout_started",
                "checkout_started",
              ],
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
      buildDailyPremiumFunnel(match),
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

    const checkoutStartedSummary = {
      events:
        getPremiumEventSummary("checkout_started").events +
        getPremiumEventSummary("premium_checkout_started").events,
      uniqueVisitors: Math.max(
        getPremiumEventSummary("checkout_started").uniqueVisitors,
        getPremiumEventSummary("premium_checkout_started").uniqueVisitors
      ),
    };
    const subscriptionCompletedSummary =
      getPremiumEventSummary("subscription_completed");
    const premiumAnalyticsPayload = {
      days,
      rangeLabel,
      rawEvents: 0,
      totalEvents,
      pageVisits,
      allTimePageVisits,
      uniqueVisitors,
      allTimeVisitors,
      activeVisitors: 0,
      activeWindowMinutes: 0,
      averageSessionSeconds: 0,
      totalSessionSeconds: 0,
      sessionDurationSamples: 0,
      topEvents: [],
      topMajors,
      topCities,
      topSearches,
      topPages,
      topDevices,
      topDiagnosis: [],
      topFears: [],
      topOrganizations,
      assistantQueries,
      assistantContextUses: 0,
      assistantZeroResultQueries: 0,
      topAssistantIntents: [],
      topAssistantQuestions: [],
      interviewPageViews,
      interviewVisitors: 0,
      interviewSearches,
      interviewQuestionStarts: 0,
      interviewQuestionSubmissions: 0,
      topInterviewQuestionOrganizations: [],
      guideFileAdClicks,
      cvProductAdClicks,
      topAdClicks,
      premiumEventCounts,
      premiumFunnelSummary: {
        reminderShown: getPremiumEventSummary("subscription_reminder_shown"),
        reminderClicked: getPremiumEventSummary("subscription_reminder_clicked"),
        gateOpened: getPremiumEventSummary("premium_gate_opened"),
        planSelected: getPremiumEventSummary("premium_plan_selected"),
        checkoutStarted: checkoutStartedSummary,
        paymentReturned: getPremiumEventSummary("premium_payment_returned"),
        subscriptionCompleted: subscriptionCompletedSummary,
        paymentSuccessful: {
          events: Math.max(
            paidMoyasarSubscriptions,
            subscriptionCompletedSummary.events
          ),
          uniqueVisitors:
            subscriptionCompletedSummary.uniqueVisitors ||
            getPremiumEventSummary("premium_access_verified").uniqueVisitors,
        },
        manualActiveSubscriptions: 0,
        adminAccessUsers: 0,
      },
      topPremiumPlans,
      dailyPremiumFunnel,
      shareMenuOpens: 0,
      shareActions: 0,
      experienceShareMenuOpens: 0,
      experienceShareActions: 0,
      opportunityShareMenuOpens: 0,
      opportunityShareActions: 0,
      trainingTargetShareMenuOpens: 0,
      trainingTargetShareActions: 0,
      topShareActions: [],
      topSharedExperiences,
      topSharedOpportunities,
      topSharedTrainingTargets: [],
      portfolioEventCounts: [],
      portfolioSummary: {
        totalPortfolios: 0,
        publishedPortfolios: 0,
        recentPortfoliosCreated: 0,
        portfoliosWithCv: 0,
        portfoliosWithAvatar: 0,
        portfoliosWithProjects: 0,
        portfoliosWithCertifications: 0,
        totalPublicViews: 0,
        averagePublicViews: 0,
        builderOpened: { events: 0, uniqueVisitors: 0 },
        saved: { events: 0, uniqueVisitors: 0 },
        savedFromPage: { events: 0, uniqueVisitors: 0 },
        fileUploaded: { events: 0, uniqueVisitors: 0 },
        publicViewed: { events: 0, uniqueVisitors: 0 },
        linkedInShared: { events: 0, uniqueVisitors: 0 },
        referralCopied: { events: 0, uniqueVisitors: 0 },
        badgeDownloaded: { events: 0, uniqueVisitors: 0 },
        nativeShared: { events: 0, uniqueVisitors: 0 },
        linkCopied: { events: 0, uniqueVisitors: 0 },
      },
      topPortfolioMajors: [],
      topPortfolioCities: [],
      topPortfolioUniversities: [],
      topPortfolioReadiness: [],
      recentPortfolios: [],
      topViewedPortfolios: [],
      hourlyActivity: [],
      recentEvents: [],
    };

    res.json(
      setReadCache(
        analyticsCacheKey,
        premiumAnalyticsPayload,
        ADMIN_ANALYTICS_CACHE_TTL_MS
      )
    );
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

app.get('/api/company-apply/:companySlug/context', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const campaignDocument = await getCompanyApplicationCampaignBySlug(
      req.params.companySlug
    );

    if (!campaignDocument) {
      return res.status(404).json({
        error: "برنامج التقديم غير موجود أو لم يعد متاحًا.",
      });
    }

    const { contact, accessCode, accessCodeHash } = getPortfolioIdentity(req);
    const campaign = serializeCompanyApplicationCampaign(campaignDocument);

    if (!isValidSubscriberContact(contact) || !isValidAccessCode(accessCode)) {
      return res.json({
        status: "ok",
        requiresLogin: true,
        canSubmit: false,
        campaign,
        missingFields: [],
        portfolio: null,
        snapshot: {},
        publicUrl: "",
        existingApplication: null,
      });
    }

    const accessUser = await ensureAccessUser({ contact, accessCode });
    const portfolio = await Portfolio.findOne({ contact, accessCodeHash }).lean();
    const missingFields = getCompanyApplicationMissingPortfolioFields(
      portfolio,
      contact
    );
    const snapshot = portfolio
      ? buildCompanyApplicationSnapshot({ portfolio, contact, req })
      : {
          email: isValidEmail(contact) ? contact : "",
          contact,
          phone: getPortfolioPhoneForApplication({}, contact),
        };
    const existingApplication = accessUser
      ? await CompanyApplication.findOne({
          studentId: accessUser._id,
          campaignId: campaign.campaignId,
          status: { $nin: ["withdrawn"] },
        })
          .sort({ submittedAt: -1, createdAt: -1 })
          .lean()
      : null;

    res.json({
      status: "ok",
      requiresLogin: false,
      canSubmit: Boolean(portfolio && missingFields.length === 0),
      missingFields,
      campaign,
      portfolio: portfolio
        ? serializePortfolio(
            portfolio,
            await getPortfolioAccessStatus(portfolio),
            req
          )
        : null,
      snapshot,
      publicUrl: portfolio ? buildCompanyApplicationPortfolioUrl(portfolio) : "",
      existingApplication: existingApplication
        ? serializeCompanyApplication(existingApplication)
        : null,
    });
  } catch (err) {
    console.error("❌ Company apply context error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/company-applications/me', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const { contact, accessCode, accessCodeHash } = getPortfolioIdentity(req);

    if (!isValidSubscriberContact(contact) || !isValidAccessCode(accessCode)) {
      return res.status(401).json({
        requiresLogin: true,
        error: "سجّل الدخول لعرض طلباتك.",
      });
    }

    const accessUser = await ensureAccessUser({ contact, accessCode });
    const email = isValidEmail(contact) ? normalizeEmail(contact) : "";
    const filter = {
      $or: [
        { studentId: accessUser?._id },
        { email },
        { "portfolioSnapshot.contact": contact },
        { contact },
      ].filter((item) => Object.values(item).some(Boolean)),
    };

    const applications = await CompanyApplication.find(filter)
      .sort({ submittedAt: -1, createdAt: -1 })
      .limit(100)
      .lean();

    res.json({
      status: "ok",
      data: applications.map(serializeCompanyApplication),
    });
  } catch (err) {
    console.error("❌ Student company applications fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/company-applications', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const usePortfolio = Boolean(req.body?.usePortfolio);
    let payload = sanitizeCompanyApplicationPayload(req.body || {});

    if (usePortfolio) {
      const { contact, accessCode, accessCodeHash } = getPortfolioIdentity(req);

      if (!isValidSubscriberContact(contact) || !isValidAccessCode(accessCode)) {
        return res.status(401).json({
          requiresLogin: true,
          error: "سجّل الدخول أولًا عشان نربط الطلب بحسابك وملفك المهني.",
        });
      }

      const accessUser = await ensureAccessUser({ contact, accessCode });
      const portfolio = await Portfolio.findOne({ contact, accessCodeHash }).lean();
      const missingFields = getCompanyApplicationMissingPortfolioFields(
        portfolio,
        contact
      );

      if (!portfolio || missingFields.length > 0) {
        return res.status(400).json({
          error: "أكمل ملفك المهني أولًا قبل إرسال الطلب.",
          missingFields,
        });
      }

      const campaignDocument = await getCompanyApplicationCampaignBySlug(
        req.body?.campaignSlug || req.body?.companySlug || req.params?.companySlug
      );

      if (!campaignDocument) {
        return res.status(404).json({
          error: "برنامج التقديم غير موجود أو لم يعد متاحًا.",
        });
      }

      if (!isCompanyApplicationCampaignOpen(campaignDocument)) {
        return res.status(400).json({
          error: "هذا البرنامج مغلق حاليًا ولا يستقبل طلبات جديدة.",
        });
      }

      const campaign = buildCompanyApplicationCampaignForApplication(
        campaignDocument
      );

      if (!campaignDocument.allowDuplicateApplications) {
        const existingApplication = await CompanyApplication.findOne({
          studentId: accessUser?._id,
          campaignId: campaign.campaignId,
          status: { $nin: ["withdrawn"] },
        }).lean();

        if (existingApplication) {
          return res.status(409).json({
            error: "سبق وأرسلت طلبك لهذا البرنامج. تقدر تتابع حالته من صفحة طلباتي.",
            existingApplication: serializeCompanyApplication(existingApplication),
          });
        }
      }

      const snapshot = buildCompanyApplicationSnapshot({ portfolio, contact, req });
      const customAnswers = sanitizeCompanyApplicationCustomAnswers(
        req.body?.customAnswers || []
      );

      payload = {
        ...payload,
        ...campaign,
        studentId: accessUser?._id || null,
        portfolioId: portfolio._id,
        fullName: snapshot.fullName,
        email: snapshot.email,
        phone: snapshot.phone,
        major: snapshot.major,
        university: snapshot.university,
        city: snapshot.city,
        portfolioUrl: snapshot.portfolioUrl,
        linkedinUrl: snapshot.linkedinUrl,
        customAnswers,
        portfolioSnapshot: snapshot,
        status: "submitted",
        submittedAt: new Date(),
        source: "darbak_portfolio_apply",
        statusHistory: [
          {
            status: "submitted",
            changedAt: new Date(),
            changedBy: "student",
            studentVisibleMessage: "تم إرسال طلبك عبر ملفك المهني في دربك.",
          },
        ],
      };
    }

    if (!payload.organizationName || payload.organizationName.length < 2) {
      return res.status(400).json({ error: "اسم الجهة غير واضح." });
    }

    if (!payload.fullName || payload.fullName.length < 3) {
      return res.status(400).json({ error: "اكتب اسمك بشكل واضح." });
    }

    if (!payload.email) {
      return res.status(400).json({ error: "اكتب بريدًا إلكترونيًا صحيحًا." });
    }

    if (!payload.consent) {
      return res.status(400).json({
        error: "يجب الموافقة على مشاركة بيانات الطلب مع الجهة لغرض التقديم.",
      });
    }

    const fieldsToCheck = [
      payload.organizationName,
      payload.opportunityTitle,
      payload.fullName,
      payload.major,
      payload.city,
      payload.note,
      payload.email,
      ...(payload.customAnswers || []).flatMap((item) => [
        item.question,
        item.answer,
      ]),
    ];

    if (fieldsToCheck.some(containsBlockedTerms)) {
      return res.status(400).json({
        error: "النص يحتوي على عبارات غير مناسبة. الرجاء تعديل الصياغة ثم المحاولة مرة أخرى.",
      });
    }

    const application = await CompanyApplication.create(payload);

    res.json({
      status: "ok",
      data: serializeCompanyApplication(application.toObject()),
    });
  } catch (err) {
    console.error("❌ Error saving company application:", err);
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
    const rawContact = (req.body.contact || "").toString().trim().slice(0, 160);
    const contact = normalizeEmail(rawContact);
    const message = (req.body.message || "").toString().trim();

    if (message.length < 5) {
      return res.status(400).json({ error: "اكتب رسالتك بشكل أوضح قبل الإرسال." });
    }

    if (!isValidEmail(rawContact)) {
      return res.status(400).json({
        error: "اكتب بريدًا إلكترونيًا صحيحًا للرد. رقم الجوال غير مسموح.",
      });
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
    const organization = (
      req.query.organization ||
      req.query.company ||
      ""
    ).trim();

    if (!major && majorCategories.length === 0 && !organization) {
      return res.status(400).json({
        error: "major, majorCategory, or organization is required",
      });
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

    if (organization) {
      const organizationRegexes = getOrganizationSearchTerms(organization).map(
        (term) => new RegExp(escapeRegex(term), "i")
      );
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: organizationRegexes.flatMap((organizationRegex) => [
            { organizationName: organizationRegex },
            { companyName: organizationRegex },
            { title: organizationRegex },
          ]),
        },
      ];
    }

    const cacheKey = getRequestCacheKey("training-targets", req.query);
    const cachedResponse = getReadCache(cacheKey);
    if (cachedResponse) {
      return res.json(cachedResponse);
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

    res.json(setReadCache(cacheKey, { data, total: data.length }));
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

    await markExpiredOpportunities();

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
    const organization = (
      req.query.organization ||
      req.query.company ||
      ""
    ).trim();

    const andFilters = [{ status: { $in: ["active", "expired"] } }];

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
        ],
      });
    }

    if (organization) {
      const organizationRegexes = getOrganizationSearchTerms(organization).map(
        (term) => new RegExp(escapeRegex(term), "i")
      );
      andFilters.push({
        $or: organizationRegexes.flatMap((organizationRegex) => [
          { organizationName: organizationRegex },
          { title: organizationRegex },
        ]),
      });
    }

    const cacheKey = getRequestCacheKey("opportunities", req.query);
    const cachedResponse = getReadCache(cacheKey);
    if (cachedResponse) {
      return res.json(cachedResponse);
    }

    const opportunities = await Opportunity.find({ $and: andFilters })
      .select(`${OPPORTUNITY_PUBLIC_FIELDS} applicationUrl`)
      .sort({ featured: -1, createdAt: -1 })
      .lean();

    const sortedOpportunities = opportunities
      .sort((a, b) => {
        const aClosed = a.status === "expired" || isClosedByDeadline(a.deadline);
        const bClosed = b.status === "expired" || isClosedByDeadline(b.deadline);
        const closedDiff =
          Number(aClosed) - Number(bClosed);
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

    const payload = {
      data: opportunitiesWithCounts.map((opportunity = {}) => {
        const { applicationUrl, sourceUrl, note, ...publicOpportunity } =
          opportunity;

        return {
          ...publicOpportunity,
          hasApplicationUrl: Boolean(applicationUrl),
        };
      }),
      total: opportunitiesWithCounts.length,
    };

    res.json(setReadCache(cacheKey, payload));
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

    await markExpiredOpportunities();

    const opportunity = await Opportunity.findOne({
      _id: req.params.id,
      status: { $in: ["active", "expired"] },
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
    const accessIdentity = getAccessIdentityFromRequest(req);
    let submittedByUser = null;

    if (
      isValidSubscriberContact(accessIdentity.contact) &&
      isValidAccessCode(accessIdentity.accessCode)
    ) {
      submittedByUser = await ensureAccessUser(accessIdentity);
    }

    const rewardEligible = Boolean(submittedByUser?._id);

    const newExp = new Experience({
      ...req.body,
      interviewQuestions: normalizeInterviewQuestions(req.body.interviewQuestions),
      rewardAmount: req.body.hadReward === "yes" ? rewardAmount : "",
      ambassadorConsent: "no",
      ambassadorLinkedInUrl: "",
      ambassadorProfileImageUrl: "",
      submittedByUserId: submittedByUser?._id,
      submissionStatus: "pending",
      rewardEligible,
      rewardStatus: rewardEligible ? "pending" : "not_eligible",
      publicationConsent: req.body.publicationConsent === true,
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
app.get('/api/experiences/featured-ambassadors', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const requestedLimit = parseInt(req.query.limit, 10) || 3;
    const limit = Math.min(Math.max(requestedLimit, 1), 12);
    const cacheKey = getRequestCacheKey("featured-ambassadors", req.query);
    const cachedResponse = getReadCache(cacheKey);
    if (cachedResponse) {
      return res.json(cachedResponse);
    }

    const experiences = await Experience.find(getActiveFeaturedAmbassadorFilter())
      .select(EXPERIENCE_PUBLIC_FIELDS)
      .sort({ featuredAmbassadorAt: -1, reviewedAt: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    const experiencesWithCounts = await attachItemInteractionCounts(
      "experience",
      experiences
    );

    res.json(setReadCache(cacheKey, { data: experiencesWithCounts }));
  } catch (err) {
    console.error("❌ Featured ambassadors fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});

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
    const ambassadorsOnly =
      req.query.ambassadors === "1" || req.query.ambassadors === "true";

    const cacheKey = getRequestCacheKey("experiences", req.query);
    const cachedResponse = getReadCache(cacheKey);
    if (cachedResponse) {
      return res.json(cachedResponse);
    }

    const baseFilter = ambassadorsOnly
      ? getActiveFeaturedAmbassadorFilter()
      : getApprovedExperiencesFilter();
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

    if (process.env.DEBUG_API === "true") {
      console.log("✅ Experiences fetched:", experiences.length);
    }

    const payload = {
      data: experiences,
      page,
      limit,
      total,
      hasMore: skip + experiences.length < total,
    };

    res.json(setReadCache(cacheKey, payload));
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
    const cacheKey = getRequestCacheKey("interviews", req.query);
    const cachedResponse = getReadCache(cacheKey);
    if (cachedResponse) {
      return res.json(cachedResponse);
    }

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

    res.json(setReadCache(cacheKey, { data, total: data.length }));
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

    const experiencesQuery = Experience.find({ status }).sort({ createdAt: -1 });
    if (status !== "approved") {
      experiencesQuery.limit(100);
    }

    const experiences = await experiencesQuery.lean();

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

app.get('/api/admin/company-applications', requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const status =
      typeof req.query.status === "string" ? req.query.status : "submitted";
    const search = normalizeSearchText(req.query.search || "");
    const filter = {};

    if (status && status !== "all") {
      filter.status = { $in: getCompanyApplicationStatusFilterValues(status) };
    }

    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      filter.$or = [
        { organizationName: regex },
        { opportunityTitle: regex },
        { fullName: regex },
        { email: regex },
        { major: regex },
        { university: regex },
        { city: regex },
        { "portfolioSnapshot.university": regex },
        { "portfolioSnapshot.major": regex },
      ];
    }

    const applications = await CompanyApplication.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    res.json({ data: applications.map(serializeCompanyApplication) });
  } catch (err) {
    console.error("❌ Admin company applications fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/company-application-campaigns', requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const status = ["draft", "open", "closed", "archived"].includes(
      req.query.status
    )
      ? req.query.status
      : "";
    const search = (req.query.search || "").toString().trim();
    const andFilters = [];

    if (status) {
      andFilters.push({ status });
    } else {
      andFilters.push({ status: { $ne: "archived" } });
    }

    if (search) {
      const searchRegex = new RegExp(escapeRegex(search), "i");
      andFilters.push({
        $or: [
          { organizationName: searchRegex },
          { opportunityTitle: searchRegex },
          { slug: searchRegex },
          { city: searchRegex },
          { cities: searchRegex },
          { majorCategories: searchRegex },
          { specialties: searchRegex },
        ],
      });
    }

    const filter = andFilters.length ? { $and: andFilters } : {};
    const campaigns = await CompanyApplicationCampaign.find(filter)
      .sort({ status: 1, applicationDeadline: 1, updatedAt: -1 })
      .limit(120)
      .lean();
    const campaignIds = campaigns
      .map((campaign) => campaign._id?.toString?.())
      .filter(Boolean);
    const applicationCounts = campaignIds.length
      ? await CompanyApplication.aggregate([
          { $match: { campaignId: { $in: campaignIds } } },
          { $group: { _id: "$campaignId", count: { $sum: 1 } } },
        ])
      : [];
    const countsByCampaignId = new Map(
      applicationCounts.map((item) => [item._id, item.count])
    );

    res.json({
      data: campaigns.map((campaign) =>
        serializeCompanyApplicationCampaign(campaign, {
          applicationCount: countsByCampaignId.get(campaign._id.toString()) || 0,
        })
      ),
    });
  } catch (err) {
    console.error("❌ Admin company application campaigns fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/company-application-campaigns', requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const payload = sanitizeCompanyApplicationCampaignPayload(req.body || {});

    if (!payload.organizationName || !payload.opportunityTitle) {
      return res.status(400).json({
        error: "اسم الجهة واسم البرنامج مطلوبة.",
      });
    }

    const fieldsToCheck = [
      payload.organizationName,
      payload.opportunityTitle,
      payload.city,
      payload.description,
      ...payload.cities,
      ...payload.majorCategories,
      ...payload.specialties,
      ...payload.customQuestions.map((question) => question.question),
    ];

    if (fieldsToCheck.some(containsBlockedTerms)) {
      return res.status(400).json({
        error: "النص يحتوي على عبارات غير مناسبة. الرجاء تعديل الصياغة.",
      });
    }

    const existingSlug = await CompanyApplicationCampaign.exists({
      slug: payload.slug,
    });

    if (existingSlug) {
      return res.status(409).json({
        error: "رابط البرنامج مستخدم مسبقًا. عدّلي الرابط المختصر للبرنامج.",
      });
    }

    const campaign = await CompanyApplicationCampaign.create({
      ...payload,
      createdBy: "admin",
      updatedBy: "admin",
    });

    res.json(serializeCompanyApplicationCampaign(campaign.toObject()));
  } catch (err) {
    console.error("❌ Admin company application campaign create error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/admin/company-application-campaigns/:id', requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid campaign id" });
    }

    const payload = sanitizeCompanyApplicationCampaignPayload(req.body || {});

    if (!payload.organizationName || !payload.opportunityTitle) {
      return res.status(400).json({
        error: "اسم الجهة واسم البرنامج مطلوبة.",
      });
    }

    const fieldsToCheck = [
      payload.organizationName,
      payload.opportunityTitle,
      payload.city,
      payload.description,
      ...payload.cities,
      ...payload.majorCategories,
      ...payload.specialties,
      ...payload.customQuestions.map((question) => question.question),
    ];

    if (fieldsToCheck.some(containsBlockedTerms)) {
      return res.status(400).json({
        error: "النص يحتوي على عبارات غير مناسبة. الرجاء تعديل الصياغة.",
      });
    }

    const existingSlug = await CompanyApplicationCampaign.findOne({
      slug: payload.slug,
      _id: { $ne: req.params.id },
    }).lean();

    if (existingSlug) {
      return res.status(409).json({
        error: "رابط البرنامج مستخدم مسبقًا. عدّلي الرابط المختصر للبرنامج.",
      });
    }

    const updated = await CompanyApplicationCampaign.findByIdAndUpdate(
      req.params.id,
      { $set: { ...payload, updatedBy: "admin" } },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const applicationCount = await CompanyApplication.countDocuments({
      campaignId: updated._id.toString(),
    });

    res.json(
      serializeCompanyApplicationCampaign(updated, {
        applicationCount,
      })
    );
  } catch (err) {
    console.error("❌ Admin company application campaign edit error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/company-application-campaigns/:id', requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid campaign id" });
    }

    const updated = await CompanyApplicationCampaign.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "archived", updatedBy: "admin" } },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error("❌ Admin company application campaign archive error:", err);
    res.status(500).json({ error: err.message });
  }
});

const TELEGRAM_POST_TYPES = [
  "opportunity",
  "experience",
  "reassurance",
  "tip",
  "portfolio",
  "product",
];
const TELEGRAM_TEMPLATE_TYPES = ["reassurance", "tip", "portfolio", "product"];
const TELEGRAM_CONTENT_ROTATION = [
  "experience",
  "reassurance",
  "tip",
  "portfolio",
  "product",
];
const TELEGRAM_PRODUCT_URLS = {
  guide:
    "https://darbakk.com/%D8%AD%D8%B2%D9%85%D8%A9-%D8%AF%D8%B1%D8%A8%D9%83-%D9%84%D9%84%D8%AA%D9%82%D8%AF%D9%8A%D9%85-%D8%B9%D9%84%D9%89-%D8%A7%D9%84%D8%AA%D8%AF%D8%B1%D9%8A%D8%A8-%D8%A7%D9%84%D8%AA%D8%B9%D8%A7%D9%88%D9%86%D9%8A-%D8%AC%D9%87%D8%A7%D8%AA-%D8%A5%D9%8A%D9%85%D9%8A%D9%84%D8%A7%D8%AA-%D8%B1%D9%88%D8%A7%D8%A8%D8%B7-%D9%85%D8%AA%D8%A7%D8%A8%D8%B9%D8%A9/p2135973764",
  cv:
    "https://darbakk.com/%D8%B3%D9%8A%D8%B1%D8%A9-%D8%A7%D9%84%D8%AA%D8%AF%D8%B1%D9%8A%D8%A8-%D8%A7%D9%84%D8%AA%D8%B9%D8%A7%D9%88%D9%86%D9%8A/p1027158085",
};
const TELEGRAM_DEFAULT_CONTENT_ITEMS = [
  {
    type: "reassurance",
    title: "تطمين عن تأخر الرد",
    body:
      "تأخر رد الجهات لا يعني أن فرصك انتهت، بعض الجهات تتواصل قبل بداية التدريب بفترة قصيرة. استمر بالتقديم ولا توقف على جهة واحدة 🤍",
  },
  {
    type: "reassurance",
    title: "لا توقف على جهة واحدة",
    body:
      "لا تنتظر رد جهة واحدة. قدم على عدة جهات وسجل كل جهة قدمت عليها وتاريخ التقديم عشان تكون خطواتك أوضح.",
  },
  {
    type: "tip",
    title: "سيرة بدون خبرات كثيرة",
    body:
      "إذا ما عندك خبرات كثيرة، ركز في سيرتك على مشاريع الجامعة والمهارات والأدوات التي استخدمتها. الجهة تحتاج تشوف طريقة تفكيرك، مو عدد الخبرات فقط.",
  },
  {
    type: "tip",
    title: "إيميل التقديم",
    body:
      "لا تكتفِ بالتقديم من الموقع فقط. إذا كان عندك إيميل الجهة، أرسل خطاب التدريب وسيرتك الذاتية بصياغة مختصرة وواضحة.",
  },
  {
    type: "portfolio",
    title: "الملف المهني",
    body:
      "عندك مشاريع وشهادات لكنها متفرقة؟ 👀\n\nفي دربك تقدر تنشئ ملفك المهني وتجمع فيه مشاريعك، شهاداتك، مهاراتك، سيرتك الذاتية وحساب لينكدإن، وترسل للجهة رابطًا واحدًا مرتبًا بدل عدة ملفات.",
    ctaLabel: "أنشئ ملفك المهني",
    ctaUrl: "/portfolio",
  },
  {
    type: "product",
    title: "ملف رحلة التدريب",
    body:
      "أكثر شيء يضيّع وقت الطلاب هو البحث عن الجهات وروابطها وإيميلاتها ومواعيد التقديم.\n\nلذلك جمعنا في ملف رحلة التدريب جهات من مختلف مناطق المملكة، مع روابط ومعلومات تساعدك ترتب تقديمك.",
    ctaLabel: "اطلع على ملف رحلة التدريب",
    ctaUrl: TELEGRAM_PRODUCT_URLS.guide,
  },
  {
    type: "product",
    title: "خدمة السيرة الذاتية",
    body:
      "ترسل سيرتك لجهات كثيرة وما يجيك رد؟\n\nقبل ما تفترض أن المشكلة بخبرتك، تأكد أن سيرتك واضحة، مختصرة ومتوافقة مع أنظمة ATS. تتوفر في دربك خدمة مراجعة وتجهيز السيرة الذاتية.",
    ctaLabel: "اطلب خدمة السيرة الذاتية",
    ctaUrl: TELEGRAM_PRODUCT_URLS.cv,
  },
];

const normalizeTelegramPostText = (value = "") =>
  value
    .toString()
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const limitTelegramText = (value = "", maxLength = 260) => {
  const text = normalizeTelegramPostText(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
};

const escapeTelegramHtml = (value = "") =>
  value
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const getTelegramTrackedUrl = (path = "/", type = "telegram") => {
  const isAbsolute = /^https?:\/\//i.test(path);
  const baseUrl = isAbsolute ? path : `${getFrontendUrl()}${path}`;

  try {
    const url = new URL(baseUrl);
    url.searchParams.set("source", "telegram");
    url.searchParams.set("type", type);
    return url.toString();
  } catch {
    return baseUrl;
  }
};

const joinPostValues = (values = [], fallback = "غير محدد") => {
  const sourceValues = Array.isArray(values) ? values : [values];
  const cleaned = sourceValues
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .map((value) => (value || "").toString().trim())
    .filter(Boolean);

  return cleaned.length > 0 ? [...new Set(cleaned)].slice(0, 4).join("، ") : fallback;
};

const getOpportunityTelegramCities = (opportunity = {}) =>
  joinPostValues([opportunity.cities, opportunity.city], "كل المدن");

const getOpportunityTelegramSpecialties = (opportunity = {}) => {
  const specialties = joinPostValues(opportunity.specialties, "");
  if (specialties) return specialties;

  return joinPostValues(opportunity.majorCategories, "تخصصات متعددة");
};

const getTelegramDayKey = (date = new Date()) => {
  const localDate = new Date(date);
  localDate.setHours(localDate.getHours() + 3);
  return localDate.toISOString().slice(0, 10);
};

const getTelegramStartOfDay = (date = new Date()) => {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
};

const getTelegramPostTitle = (type, source = {}) => {
  if (type === "opportunity") return "فرصة تدريب جديدة";
  if (type === "experience") return "من تجربة متدرب";
  if (type === "portfolio") return source.title || "الملف المهني في دربك";
  if (type === "product") return source.title || "من منتجات دربك";
  if (type === "tip") return source.title || "نصيحة تدريب";
  return source.title || "رسالة للطلاب";
};

const mapTelegramPost = (post = {}) => ({
  _id: post._id?.toString?.() || "",
  type: post.type || "",
  sourceType: post.sourceType || "",
  sourceId: post.sourceId || "",
  title: post.title || "",
  body: post.body || "",
  ctaLabel: post.ctaLabel || "",
  ctaUrl: post.ctaUrl || "",
  status: post.status || "draft",
  scheduledAt: post.scheduledAt || null,
  publishedAt: post.publishedAt || null,
  telegramMessageId: post.telegramMessageId || "",
  createdAutomatically: Boolean(post.createdAutomatically),
  errorMessage: post.errorMessage || "",
  metadata: post.metadata || {},
  createdAt: post.createdAt,
  updatedAt: post.updatedAt,
});

const mapTelegramContentItem = (item = {}) => ({
  _id: item._id?.toString?.() || "",
  type: item.type || "",
  title: item.title || "",
  body: item.body || "",
  ctaLabel: item.ctaLabel || "",
  ctaUrl: item.ctaUrl || "",
  isActive: Boolean(item.isActive),
  lastUsedAt: item.lastUsedAt || null,
  usageCount: Number(item.usageCount || 0),
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

const mapTelegramOpportunityCandidate = (opportunity = {}) => ({
  _id: opportunity._id?.toString?.() || "",
  label: `${opportunity.organizationName || "جهة"} - ${
    opportunity.title || "فرصة تدريب"
  }`,
  organizationName: opportunity.organizationName || "",
  title: opportunity.title || "",
  city: getOpportunityTelegramCities(opportunity),
  specialties: getOpportunityTelegramSpecialties(opportunity),
  deadline: opportunity.deadline || null,
});

const mapTelegramExperienceCandidate = (experience = {}) => ({
  _id: experience._id?.toString?.() || "",
  label: `${experience.organizationName || "جهة"} - ${
    experience.major || experience.majorCategory || "تخصص"
  }`,
  organizationName: experience.organizationName || "",
  title: experience.title || "",
  city: experience.city || "",
  major: experience.major || experience.majorCategory || "",
});

const ensureTelegramDefaults = async () => {
  let settings = await TelegramSettings.findOne({ key: "default" });
  if (!settings) {
    settings = await TelegramSettings.create({ key: "default" });
  }

  const existingTemplates = await TelegramContentItem.countDocuments();
  if (existingTemplates === 0) {
    await TelegramContentItem.insertMany(TELEGRAM_DEFAULT_CONTENT_ITEMS);
  }

  return settings;
};

const getTelegramOpportunityCandidates = async (limit = 20) => {
  await markExpiredOpportunities();

  const recentOrgCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const usedSourceIds = await TelegramPost.distinct("sourceId", {
    type: "opportunity",
    sourceType: "opportunity",
    sourceId: { $ne: "" },
    status: { $in: ["draft", "scheduled", "published"] },
  });
  const recentOrganizationNames = await TelegramPost.distinct(
    "metadata.organizationName",
    {
      type: "opportunity",
      sourceType: "opportunity",
      publishedAt: { $gte: recentOrgCutoff },
      status: "published",
    }
  );
  const recentOrganizationKeys = new Set(
    recentOrganizationNames.map(normalizeSearchText).filter(Boolean)
  );
  const usedSourceIdSet = new Set(usedSourceIds.map((id) => id.toString()));
  const opportunities = await Opportunity.find({ status: "active" })
    .sort({ createdAt: -1, deadline: 1 })
    .limit(150)
    .lean();
  const now = Date.now();

  return opportunities
    .filter((opportunity) => {
      const sourceId = opportunity._id?.toString?.() || "";
      if (!sourceId || usedSourceIdSet.has(sourceId)) return false;
      if (opportunity.deadline && isClosedByDeadline(opportunity.deadline)) return false;

      const orgKey = normalizeSearchText(opportunity.organizationName);
      if (recentOrganizationKeys.has(orgKey)) return false;

      return true;
    })
    .sort((a, b) => {
      const aCreated = new Date(a.createdAt || 0).getTime();
      const bCreated = new Date(b.createdAt || 0).getTime();
      if (bCreated !== aCreated) return bCreated - aCreated;

      const aDeadline = a.deadline ? new Date(a.deadline).getTime() : now + 9999999999;
      const bDeadline = b.deadline ? new Date(b.deadline).getTime() : now + 9999999999;
      return aDeadline - bDeadline;
    })
    .slice(0, limit);
};

const getTelegramExperienceSnippet = (description = "") => {
  const cleanDescription = normalizeTelegramPostText(description)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 40 && !containsBlockedTerms(line))
    .join(" ");

  return limitTelegramText(cleanDescription || description, 230);
};

const getTelegramExperienceCandidates = async (limit = 20) => {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentlyUsedSourceIds = await TelegramPost.distinct("sourceId", {
    type: "experience",
    sourceType: "experience",
    sourceId: { $ne: "" },
    status: { $in: ["draft", "scheduled", "published"] },
    createdAt: { $gte: cutoff },
  });
  const usedSourceIdSet = new Set(recentlyUsedSourceIds.map((id) => id.toString()));

  const experiences = await Experience.find(getApprovedExperiencesFilter())
    .sort({ reviewedAt: -1, createdAt: -1 })
    .limit(160)
    .lean();

  return experiences
    .filter((experience) => {
      const sourceId = experience._id?.toString?.() || "";
      if (!sourceId || usedSourceIdSet.has(sourceId)) return false;
      if (containsBlockedTerms(experience.description || "")) return false;
      return getTelegramExperienceSnippet(experience.description).length >= 50;
    })
    .slice(0, limit);
};

const getNextTelegramContentType = async () => {
  const latest = await TelegramPost.findOne({
    type: { $in: TELEGRAM_CONTENT_ROTATION },
    status: { $in: ["scheduled", "published"] },
  })
    .sort({ publishedAt: -1, scheduledAt: -1, createdAt: -1 })
    .lean();

  if (!latest?.type) return "experience";
  const currentIndex = TELEGRAM_CONTENT_ROTATION.indexOf(latest.type);
  return TELEGRAM_CONTENT_ROTATION[
    (Math.max(currentIndex, 0) + 1) % TELEGRAM_CONTENT_ROTATION.length
  ];
};

const canGenerateTelegramType = async (type) => {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  if (type === "portfolio") {
    const portfolioCount = await TelegramPost.countDocuments({
      type: "portfolio",
      status: { $in: ["scheduled", "published"] },
      createdAt: { $gte: oneWeekAgo },
    });
    return portfolioCount === 0;
  }

  if (type === "product") {
    const [weeklyCount, yesterdayCount] = await Promise.all([
      TelegramPost.countDocuments({
        type: "product",
        status: { $in: ["scheduled", "published"] },
        createdAt: { $gte: oneWeekAgo },
      }),
      TelegramPost.countDocuments({
        type: "product",
        status: { $in: ["scheduled", "published"] },
        createdAt: { $gte: yesterday },
      }),
    ]);
    return weeklyCount < 2 && yesterdayCount === 0;
  }

  return true;
};

const getTelegramTemplateCandidate = async (type) => {
  if (!(await canGenerateTelegramType(type))) return null;

  return TelegramContentItem.findOne({
    type,
    isActive: true,
  })
    .sort({ lastUsedAt: 1, usageCount: 1, createdAt: 1 })
    .lean();
};

const buildTelegramOpportunityDraft = (opportunity) => {
  const cities = getOpportunityTelegramCities(opportunity);
  const specialties = getOpportunityTelegramSpecialties(opportunity);
  const deadline = opportunity.deadline
    ? `\nآخر موعد: ${new Date(opportunity.deadline).toLocaleDateString("ar-SA")}`
    : "";
  const ctaUrl = getTelegramTrackedUrl(
    `/where-to-train/opportunity/${opportunity._id}`,
    "opportunity"
  );

  return {
    type: "opportunity",
    sourceType: "opportunity",
    sourceId: opportunity._id.toString(),
    title: "فرصة تدريب جديدة",
    body: `🎓 فرصة تدريب جديدة\n\nالجهة: ${opportunity.organizationName}\nالفرصة: ${opportunity.title}\nالمدينة: ${cities}\nالتخصصات: ${specialties}${deadline}\n\nالتفاصيل وطريقة التقديم عبر دربك 👇`,
    ctaLabel: "عرض الفرصة في دربك",
    ctaUrl,
    metadata: {
      organizationName: opportunity.organizationName,
      title: opportunity.title,
      city: cities,
      deadline: opportunity.deadline || null,
    },
  };
};

const buildTelegramExperienceDraft = (experience) => {
  const ctaUrl = getTelegramTrackedUrl(`/experiences/${experience._id}`, "experience");
  const snippet = getTelegramExperienceSnippet(experience.description);

  return {
    type: "experience",
    sourceType: "experience",
    sourceId: experience._id.toString(),
    title: "من تجربة متدرب",
    body: `💬 من تجربة متدرب\n\n"${snippet}"\n\nمن تجربة تدريب في ${experience.organizationName} لتخصص ${
      experience.major || experience.majorCategory || "غير محدد"
    }.\n\nلقراءة التجربة كاملة 👇`,
    ctaLabel: "عرض التجربة",
    ctaUrl,
    metadata: {
      organizationName: experience.organizationName,
      major: experience.major || experience.majorCategory || "",
      city: experience.city || "",
    },
  };
};

const buildTelegramTemplateDraft = (template) => {
  const trackedUrl = template.ctaUrl
    ? getTelegramTrackedUrl(template.ctaUrl, template.type)
    : "";

  return {
    type: template.type,
    sourceType: "template",
    sourceId: template._id.toString(),
    title: getTelegramPostTitle(template.type, template),
    body: template.body,
    ctaLabel: template.ctaLabel,
    ctaUrl: trackedUrl,
    metadata: {
      templateTitle: template.title || "",
    },
  };
};

const buildTelegramDraftPayload = async (requestedType = "", sourceId = "") => {
  const type = TELEGRAM_POST_TYPES.includes(requestedType)
    ? requestedType
    : await getNextTelegramContentType();

  if (type === "opportunity") {
    const opportunities = sourceId
      ? [await Opportunity.findById(sourceId).lean()].filter(Boolean)
      : await getTelegramOpportunityCandidates(1);
    const opportunity = opportunities[0];
    if (!opportunity || opportunity.status !== "active" || isClosedByDeadline(opportunity.deadline)) {
      throw new Error("لا توجد فرصة جديدة مناسبة للنشر الآن.");
    }
    return buildTelegramOpportunityDraft(opportunity);
  }

  if (type === "experience") {
    const experiences = sourceId
      ? [await Experience.findOne({ _id: sourceId, ...getApprovedExperiencesFilter() }).lean()].filter(Boolean)
      : await getTelegramExperienceCandidates(1);
    const experience = experiences[0];
    if (!experience) {
      throw new Error("لا توجد تجربة مناسبة للنشر الآن.");
    }
    return buildTelegramExperienceDraft(experience);
  }

  if (!TELEGRAM_TEMPLATE_TYPES.includes(type)) {
    throw new Error("نوع المنشور غير مدعوم.");
  }

  const template = sourceId
    ? await TelegramContentItem.findOne({ _id: sourceId, type, isActive: true }).lean()
    : await getTelegramTemplateCandidate(type);

  if (!template) {
    throw new Error("لا يوجد قالب مناسب لهذا النوع الآن.");
  }

  return buildTelegramTemplateDraft(template);
};

const validateTelegramPostPayload = (body = {}) => {
  const type = TELEGRAM_POST_TYPES.includes(body.type) ? body.type : "tip";
  const postBody = normalizeTelegramPostText(body.body);
  const title = (body.title || getTelegramPostTitle(type)).toString().trim();
  const ctaLabel = (body.ctaLabel || "").toString().trim();
  const ctaUrl = (body.ctaUrl || "").toString().trim();

  if (postBody.length < 8) {
    throw new Error("اكتبي نص المنشور بشكل أوضح.");
  }

  if ([postBody, title, ctaLabel].some(containsBlockedTerms)) {
    throw new Error("النص يحتوي على عبارات غير مناسبة.");
  }

  return {
    type,
    sourceType: ["opportunity", "experience", "template", "manual", ""].includes(
      body.sourceType
    )
      ? body.sourceType
      : "manual",
    sourceId: (body.sourceId || "").toString().trim(),
    title,
    body: postBody,
    ctaLabel,
    ctaUrl,
    status: ["draft", "scheduled", "published", "failed"].includes(body.status)
      ? body.status
      : "draft",
    scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
    createdAutomatically: Boolean(body.createdAutomatically),
    metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
  };
};

const assertTelegramSourceNotDuplicated = async (payload, existingId = "") => {
  if (!payload.sourceId || !payload.sourceType) return;

  const duplicate = await TelegramPost.findOne({
    _id: existingId ? { $ne: existingId } : { $exists: true },
    sourceType: payload.sourceType,
    sourceId: payload.sourceId,
    type: payload.type,
    status: { $in: ["draft", "scheduled", "published"] },
  }).lean();

  if (duplicate) {
    throw new Error("هذا المصدر موجود مسبقًا في منشور تيليجرام.");
  }
};

const getTelegramPostHtml = (post = {}) => escapeTelegramHtml(post.body || "");

const sendTelegramPostToChannel = async (post = {}, settings = {}) => {
  if (!settings.botPublishingEnabled || !TELEGRAM_BOT_PUBLISHING_ENABLED) {
    throw new Error(
      "Telegram Bot API جاهز لكنه غير مفعل الآن. فعّلي botPublishingEnabled و TELEGRAM_BOT_PUBLISHING_ENABLED لاحقًا."
    );
  }

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHANNEL_ID) {
    throw new Error("TELEGRAM_BOT_TOKEN أو TELEGRAM_CHANNEL_ID غير مضبوط.");
  }

  const payload = {
    chat_id: TELEGRAM_CHANNEL_ID,
    text: getTelegramPostHtml(post),
    parse_mode: "HTML",
    disable_web_page_preview: false,
  };

  if (post.ctaLabel && post.ctaUrl) {
    payload.reply_markup = {
      inline_keyboard: [
        [
          {
            text: post.ctaLabel,
            url: post.ctaUrl,
          },
        ],
      ],
    };
  }

  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.ok) {
    throw new Error(data.description || "فشل إرسال المنشور إلى تيليجرام.");
  }

  return data.result;
};

const publishTelegramPost = async (postId) => {
  const settings = await ensureTelegramDefaults();
  const post = await TelegramPost.findById(postId);
  if (!post) {
    const notFoundError = new Error("المنشور غير موجود.");
    notFoundError.statusCode = 404;
    throw notFoundError;
  }

  if (post.status === "published") return post;

  try {
    const result = await sendTelegramPostToChannel(post.toObject(), settings.toObject());
    post.status = "published";
    post.publishedAt = new Date();
    post.telegramMessageId = result.message_id?.toString?.() || "";
    post.errorMessage = "";
    await post.save();

    if (post.sourceType === "template" && post.sourceId) {
      await TelegramContentItem.findByIdAndUpdate(post.sourceId, {
        $set: { lastUsedAt: new Date() },
        $inc: { usageCount: 1 },
      });
    }

    return post;
  } catch (err) {
    post.status = "failed";
    post.errorMessage = err.message;
    await post.save();
    throw err;
  }
};

const requireTelegramCronSecret = (req, res, next) => {
  if (!TELEGRAM_CRON_SECRET) {
    return res.status(500).json({ error: "Telegram cron secret is not configured" });
  }

  const providedSecret =
    req.headers["x-telegram-cron-secret"] || req.body?.secret || req.query?.secret;

  if (providedSecret !== TELEGRAM_CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
};

app.get('/api/admin/telegram-content', requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const settings = await ensureTelegramDefaults();
    const [posts, contentItems, opportunityCandidates, experienceCandidates, summary] =
      await Promise.all([
        TelegramPost.find({})
          .sort({ scheduledAt: -1, createdAt: -1 })
          .limit(80)
          .lean(),
        TelegramContentItem.find({})
          .sort({ type: 1, isActive: -1, updatedAt: -1 })
          .limit(120)
          .lean(),
        getTelegramOpportunityCandidates(20),
        getTelegramExperienceCandidates(20),
        Promise.all([
          Experience.countDocuments(getApprovedExperiencesFilter()),
          Opportunity.countDocuments({ status: "active" }),
          TelegramPost.countDocuments({ status: "draft" }),
          TelegramPost.countDocuments({ status: "scheduled" }),
          TelegramPost.countDocuments({ status: "published" }),
          TelegramPost.countDocuments({ status: "failed" }),
        ]),
      ]);

    const [
      totalExperiences,
      totalOpportunities,
      draftPosts,
      scheduledPosts,
      publishedPosts,
      failedPosts,
    ] = summary;

    res.json({
      date: new Date().toISOString(),
      settings: settings.toObject(),
      summary: {
        totalExperiences,
        totalOpportunities,
        draftPosts,
        scheduledPosts,
        publishedPosts,
        failedPosts,
        botConfigured: Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_CHANNEL_ID),
        botPublishingEnabled:
          Boolean(settings.botPublishingEnabled) && TELEGRAM_BOT_PUBLISHING_ENABLED,
      },
      posts: posts.map(mapTelegramPost),
      contentItems: contentItems.map(mapTelegramContentItem),
      candidates: {
        opportunities: opportunityCandidates.map(mapTelegramOpportunityCandidate),
        experiences: experienceCandidates.map(mapTelegramExperienceCandidate),
      },
    });
  } catch (err) {
    console.error("❌ Admin Telegram content error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/admin/telegram/settings', requireAdmin, async (req, res) => {
  try {
    const settings = await ensureTelegramDefaults();
    const updates = {};

    [
      "autoPublishingEnabled",
      "draftApprovalRequired",
      "botPublishingEnabled",
    ].forEach((field) => {
      if (typeof req.body[field] === "boolean") {
        updates[field] = req.body[field];
      }
    });

    if (/^\d{2}:\d{2}$/.test((req.body.opportunityTime || "").toString())) {
      updates.opportunityTime = req.body.opportunityTime;
    }
    if (/^\d{2}:\d{2}$/.test((req.body.contentTime || "").toString())) {
      updates.contentTime = req.body.contentTime;
    }
    if (Array.isArray(req.body.contentDays)) {
      updates.contentDays = req.body.contentDays
        .map((day) => Number(day))
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
    }
    if (req.body.maxPostsPerDay) {
      const maxPostsPerDay = Number(req.body.maxPostsPerDay);
      if (maxPostsPerDay >= 1 && maxPostsPerDay <= 4) {
        updates.maxPostsPerDay = maxPostsPerDay;
      }
    }

    const updated = await TelegramSettings.findByIdAndUpdate(
      settings._id,
      { $set: updates },
      { new: true }
    ).lean();

    res.json(updated);
  } catch (err) {
    console.error("❌ Telegram settings update error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/telegram/content-items', requireAdmin, async (req, res) => {
  try {
    const type = TELEGRAM_TEMPLATE_TYPES.includes(req.body.type)
      ? req.body.type
      : "tip";
    const title = (req.body.title || "").toString().trim();
    const body = normalizeTelegramPostText(req.body.body || "");
    const ctaLabel = (req.body.ctaLabel || "").toString().trim();
    const ctaUrl = (req.body.ctaUrl || "").toString().trim();

    if (body.length < 8) {
      return res.status(400).json({ error: "اكتبي نص القالب بشكل أوضح." });
    }
    if ([title, body, ctaLabel].some(containsBlockedTerms)) {
      return res.status(400).json({ error: "النص يحتوي على عبارات غير مناسبة." });
    }

    const item = await TelegramContentItem.create({
      type,
      title,
      body,
      ctaLabel,
      ctaUrl,
      isActive: req.body.isActive !== false,
    });

    res.json(mapTelegramContentItem(item));
  } catch (err) {
    console.error("❌ Telegram content item create error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/admin/telegram/content-items/:id', requireAdmin, async (req, res) => {
  try {
    const updates = {};
    if (TELEGRAM_TEMPLATE_TYPES.includes(req.body.type)) updates.type = req.body.type;
    if (typeof req.body.title === "string") updates.title = req.body.title.trim();
    if (typeof req.body.body === "string") {
      updates.body = normalizeTelegramPostText(req.body.body);
      if (updates.body.length < 8) {
        return res.status(400).json({ error: "اكتبي نص القالب بشكل أوضح." });
      }
    }
    if (typeof req.body.ctaLabel === "string") updates.ctaLabel = req.body.ctaLabel.trim();
    if (typeof req.body.ctaUrl === "string") updates.ctaUrl = req.body.ctaUrl.trim();
    if (typeof req.body.isActive === "boolean") updates.isActive = req.body.isActive;

    if (
      [updates.title, updates.body, updates.ctaLabel]
        .filter(Boolean)
        .some(containsBlockedTerms)
    ) {
      return res.status(400).json({ error: "النص يحتوي على عبارات غير مناسبة." });
    }

    const item = await TelegramContentItem.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    ).lean();

    if (!item) return res.status(404).json({ error: "القالب غير موجود." });
    res.json(mapTelegramContentItem(item));
  } catch (err) {
    console.error("❌ Telegram content item update error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/telegram/content-items/:id', requireAdmin, async (req, res) => {
  try {
    const item = await TelegramContentItem.findByIdAndDelete(req.params.id).lean();
    if (!item) return res.status(404).json({ error: "القالب غير موجود." });
    res.json({ ok: true });
  } catch (err) {
    console.error("❌ Telegram content item delete error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/telegram/posts/draft', requireAdmin, async (req, res) => {
  try {
    const settings = await ensureTelegramDefaults();
    const payload = await buildTelegramDraftPayload(req.body.type, req.body.sourceId);
    await assertTelegramSourceNotDuplicated(payload);

    const post = await TelegramPost.create({
      ...payload,
      status:
        req.body.status === "scheduled" && !settings.draftApprovalRequired
          ? "scheduled"
          : "draft",
      scheduledAt: req.body.scheduledAt ? new Date(req.body.scheduledAt) : undefined,
      createdAutomatically: true,
    });

    if (post.sourceType === "template" && post.sourceId) {
      await TelegramContentItem.findByIdAndUpdate(post.sourceId, {
        $set: { lastUsedAt: new Date() },
        $inc: { usageCount: 1 },
      });
    }

    res.json(mapTelegramPost(post));
  } catch (err) {
    console.error("❌ Telegram draft create error:", err);
    res.status(err.statusCode || 400).json({ error: err.message });
  }
});

app.post('/api/admin/telegram/posts', requireAdmin, async (req, res) => {
  try {
    const payload = validateTelegramPostPayload(req.body);
    await assertTelegramSourceNotDuplicated(payload);
    const post = await TelegramPost.create(payload);
    res.json(mapTelegramPost(post));
  } catch (err) {
    console.error("❌ Telegram post create error:", err);
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/admin/telegram/posts/:id', requireAdmin, async (req, res) => {
  try {
    const payload = validateTelegramPostPayload(req.body);
    await assertTelegramSourceNotDuplicated(payload, req.params.id);
    const post = await TelegramPost.findByIdAndUpdate(
      req.params.id,
      { $set: payload },
      { new: true }
    ).lean();

    if (!post) return res.status(404).json({ error: "المنشور غير موجود." });
    res.json(mapTelegramPost(post));
  } catch (err) {
    console.error("❌ Telegram post update error:", err);
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/telegram/posts/:id/schedule', requireAdmin, async (req, res) => {
  try {
    const scheduledAt = req.body.scheduledAt ? new Date(req.body.scheduledAt) : null;
    if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
      return res.status(400).json({ error: "اختاري وقت جدولة صحيح." });
    }

    const post = await TelegramPost.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status: "scheduled",
          scheduledAt,
          errorMessage: "",
        },
      },
      { new: true }
    ).lean();

    if (!post) return res.status(404).json({ error: "المنشور غير موجود." });
    res.json(mapTelegramPost(post));
  } catch (err) {
    console.error("❌ Telegram post schedule error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/telegram/posts/:id/publish', requireAdmin, async (req, res) => {
  try {
    const post = await publishTelegramPost(req.params.id);
    res.json(mapTelegramPost(post));
  } catch (err) {
    console.error("❌ Telegram post publish error:", err);
    res.status(err.statusCode || 400).json({ error: err.message });
  }
});

app.post('/api/admin/telegram/posts/:id/retry', requireAdmin, async (req, res) => {
  try {
    const post = await TelegramPost.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "draft", errorMessage: "" } },
      { new: true }
    ).lean();

    if (!post) return res.status(404).json({ error: "المنشور غير موجود." });
    res.json(mapTelegramPost(post));
  } catch (err) {
    console.error("❌ Telegram post retry error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/telegram/posts/:id', requireAdmin, async (req, res) => {
  try {
    const post = await TelegramPost.findByIdAndDelete(req.params.id).lean();
    if (!post) return res.status(404).json({ error: "المنشور غير موجود." });
    res.json({ ok: true });
  } catch (err) {
    console.error("❌ Telegram post delete error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post(
  '/api/admin/telegram/run-scheduled-posts',
  requireTelegramCronSecret,
  async (req, res) => {
    try {
      const settings = await ensureTelegramDefaults();
      if (!settings.autoPublishingEnabled) {
        return res.json({ ok: true, published: 0, skipped: "auto_disabled" });
      }
      if (!settings.botPublishingEnabled || !TELEGRAM_BOT_PUBLISHING_ENABLED) {
        return res.json({ ok: true, published: 0, skipped: "bot_disabled" });
      }

      const todayStart = getTelegramStartOfDay();
      const publishedToday = await TelegramPost.countDocuments({
        status: "published",
        publishedAt: { $gte: todayStart },
      });
      const remaining = Math.max((settings.maxPostsPerDay || 2) - publishedToday, 0);
      if (remaining <= 0) {
        return res.json({ ok: true, published: 0, skipped: "daily_limit" });
      }

      const scheduledPosts = await TelegramPost.find({
        status: "scheduled",
        scheduledAt: { $lte: new Date() },
      })
        .sort({ scheduledAt: 1 })
        .limit(remaining);

      const results = [];
      for (const post of scheduledPosts) {
        try {
          const publishedPost = await publishTelegramPost(post._id);
          results.push({ id: post._id.toString(), status: "published", telegramMessageId: publishedPost.telegramMessageId });
        } catch (err) {
          results.push({ id: post._id.toString(), status: "failed", error: err.message });
        }
      }

      res.json({ ok: true, published: results.filter((item) => item.status === "published").length, results });
    } catch (err) {
      console.error("❌ Telegram scheduled run error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

app.get('/api/admin/opportunities', requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    await markExpiredOpportunities();

    const status = ["active", "draft", "expired"].includes(req.query.status)
      ? req.query.status
      : "";
    const search = (req.query.search || "").toString().trim();
    const city = (req.query.city || "").toString().trim();
    const sourceType = ["admin", "visitor"].includes(req.query.sourceType)
      ? req.query.sourceType
      : "";
    const hasReward = ["yes", "no", ""].includes(req.query.hasReward)
      ? req.query.hasReward
      : "";
    const featured =
      req.query.featured === "true"
        ? true
        : req.query.featured === "false"
        ? false
        : "";
    const andFilters = [];

    if (status) andFilters.push({ status });
    if (sourceType) andFilters.push({ sourceType });
    if (hasReward) andFilters.push({ hasReward });
    if (featured !== "") andFilters.push({ featured });

    if (city) {
      const cityValues = getCityFilterValues(city);
      andFilters.push({
        $or: [{ city: { $in: cityValues } }, { cities: { $in: cityValues } }],
      });
    }

    if (search) {
      const searchRegex = new RegExp(escapeRegex(search), "i");
      andFilters.push({
        $or: [
          { organizationName: searchRegex },
          { title: searchRegex },
          { city: searchRegex },
          { cities: searchRegex },
          { majorCategories: searchRegex },
          { specialties: searchRegex },
          { note: searchRegex },
        ],
      });
    }

    const filter = andFilters.length > 0 ? { $and: andFilters } : {};

    const opportunities = await Opportunity.find(filter)
      .sort({ status: 1, featured: -1, updatedAt: -1, createdAt: -1 })
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

    const experience = await Experience.findById(req.params.id).lean();

    if (!experience) {
      return res.status(404).json({ error: "Experience not found" });
    }

    const reviewDate = new Date();
    let updated = await Experience.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status,
          submissionStatus: status,
          reviewedAt: reviewDate,
          rejectionReason: status === "rejected" ? rejectionReason.trim() : "",
          ...(status === "rejected" && experience.rewardStatus !== "granted"
            ? { rewardStatus: "not_eligible" }
            : {}),
          ...(status === "pending" && experience.rewardStatus !== "granted"
            ? { rewardStatus: experience.rewardEligible ? "pending" : "not_eligible" }
            : {}),
        },
      },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ error: "Experience not found" });
    }

    let rewardGrant = null;
    if (
      status === "approved" &&
      updated.rewardEligible &&
      updated.submittedByUserId &&
      updated.rewardStatus !== "granted"
    ) {
      rewardGrant = await grantExperienceRewardAccess(updated, {
        grantedBy: "admin_experience_approval",
      });

      if (rewardGrant?.experience) {
        updated = rewardGrant.experience;
      }
    }

    res.json({ ...updated, rewardGrant });
  } catch (err) {
    console.error("❌ Admin update error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/admin/experiences/:id/featured-ambassador', requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const active = Boolean(req.body.active);
    const days = Math.min(Math.max(Number(req.body.days) || 7, 1), 30);
    const ambassadorDisplayName =
      typeof req.body.ambassadorDisplayName === "string"
        ? req.body.ambassadorDisplayName.trim().replace(/\s+/g, " ")
        : "";
    const experience = await Experience.findById(req.params.id).lean();

    if (!experience) {
      return res.status(404).json({ error: "Experience not found" });
    }

    if (active && (experience.status || "approved") !== "approved") {
      return res.status(400).json({
        error: "اختاري تجربة مقبولة أولًا قبل تمييزها ضمن سفراء دربك.",
      });
    }

    const existingLinkedInUrl = normalizeLinkedInProfileUrl(
      experience.ambassadorLinkedInUrl
    );
    const nextDisplayName =
      ambassadorDisplayName || experience.ambassadorDisplayName || "";

    if (active && !existingLinkedInUrl && !nextDisplayName) {
      return res.status(400).json({
        error: "أضيفي اسم سفير دربك أو رابط LinkedIn صحيح قبل تمييز التجربة.",
      });
    }

    if (active && ambassadorDisplayName.length > 80) {
      return res.status(400).json({
        error: "اسم سفير دربك يجب أن يكون أقصر من 80 حرف.",
      });
    }

    const now = new Date();
    const update = active
      ? {
          ambassadorConsent: "yes",
          featuredAmbassador: true,
          featuredAmbassadorAt: now,
          featuredAmbassadorUntil: new Date(
            now.getTime() + days * 24 * 60 * 60 * 1000
          ),
          ambassadorDisplayName: nextDisplayName,
        }
      : {
          featuredAmbassador: false,
          featuredAmbassadorAt: null,
          featuredAmbassadorUntil: null,
        };

    const updated = await Experience.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    }).lean();

    res.json(updated);
  } catch (err) {
    console.error("❌ Admin featured ambassador update error:", err);
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
      "ambassadorDisplayName",
      "featuredAmbassadorLogoUrl",
      "featuredAmbassadorCardTitle",
      "featuredAmbassadorCardSummary",
      "featuredAmbassadorCardTags",
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
      updates.ambassadorDisplayName = "";
    }

    if (typeof updates.ambassadorLinkedInUrl === "string") {
      updates.ambassadorLinkedInUrl = updates.ambassadorLinkedInUrl.trim();
    }

    if (typeof updates.ambassadorDisplayName === "string") {
      updates.ambassadorDisplayName = updates.ambassadorDisplayName
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 80);
    }

    if (typeof updates.featuredAmbassadorLogoUrl === "string") {
      updates.featuredAmbassadorLogoUrl = updates.featuredAmbassadorLogoUrl
        .trim()
        .slice(0, 180000);
    }

    if (typeof updates.featuredAmbassadorCardTitle === "string") {
      updates.featuredAmbassadorCardTitle = updates.featuredAmbassadorCardTitle
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 90);
    }

    if (typeof updates.featuredAmbassadorCardSummary === "string") {
      updates.featuredAmbassadorCardSummary =
        updates.featuredAmbassadorCardSummary
          .trim()
          .replace(/\s+/g, " ")
          .slice(0, 150);
    }

    if (
      Object.prototype.hasOwnProperty.call(
        updates,
        "featuredAmbassadorCardTags"
      )
    ) {
      updates.featuredAmbassadorCardTags = normalizeFeaturedAmbassadorTags(
        updates.featuredAmbassadorCardTags
      );
    }

    if (updates.ambassadorConsent === "yes") {
      const normalizedLinkedInUrl = normalizeLinkedInProfileUrl(
        updates.ambassadorLinkedInUrl
      );

      if (updates.ambassadorLinkedInUrl && !normalizedLinkedInUrl) {
        return res.status(400).json({
          error: "رابط LinkedIn غير صحيح. استخدم رابط ملف شخصي يبدأ بـ linkedin.com/in/ أو اترك الرابط فارغًا واكتفِ باسم السفير.",
        });
      }

      updates.ambassadorLinkedInUrl = normalizedLinkedInUrl || "";

      if (!updates.ambassadorLinkedInUrl && !updates.ambassadorDisplayName) {
        return res.status(400).json({
          error: "أضيفي اسم سفير دربك أو رابط LinkedIn، أو اجعلي السفير مجهول.",
        });
      }
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

app.patch('/api/admin/company-applications/:id/status', requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid application id" });
    }

    const status = normalizeCompanyApplicationStatusValue(req.body.status || "");
    const allowedStatuses = COMPANY_APPLICATION_STATUS_FLOW;
    const studentVisibleMessage = (req.body.studentVisibleMessage || "")
      .toString()
      .trim()
      .slice(0, 500);

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid application status" });
    }

    const existing = await CompanyApplication.findById(req.params.id).lean();

    if (!existing) {
      return res.status(404).json({ error: "Company application not found" });
    }

    const updated = await CompanyApplication.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status,
          studentVisibleMessage,
        },
        $push: {
          statusHistory: {
            status,
            changedAt: new Date(),
            changedBy: "admin",
            studentVisibleMessage,
          },
        },
      },
      { new: true }
    ).lean();

    const statusChanged =
      normalizeCompanyApplicationStatusValue(existing.status) !== status;

    if (statusChanged && isValidEmail(updated.email || "")) {
      sendCompanyApplicationStatusEmail({
        email: updated.email,
        fullName: updated.fullName,
        organizationName: updated.organizationName,
        opportunityTitle: updated.opportunityTitle,
        status,
        studentVisibleMessage,
        applicationsUrl: `${getFrontendUrl()}/applications`,
      }).catch((emailErr) =>
        console.error("❌ Company application status email error:", emailErr)
      );
    }

    res.json({ success: true, data: serializeCompanyApplication(updated) });
  } catch (err) {
    console.error("❌ Admin company application status update error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/company-applications/:id', requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid application id" });
    }

    const deleted = await CompanyApplication.findByIdAndDelete(req.params.id).lean();

    if (!deleted) {
      return res.status(404).json({ error: "Company application not found" });
    }

    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error("❌ Admin company application delete error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
