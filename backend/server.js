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

const normalizeEmail = (value = "") => value.toString().trim().toLowerCase();

const isValidEmail = (value = "") =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));

const normalizeAccessCode = (value = "") =>
  value.toString().trim().replace(/\s+/g, "");

const hashAccessCode = (email = "", accessCode = "") =>
  crypto
    .createHmac("sha256", SUBSCRIPTION_SECRET)
    .update(`${normalizeEmail(email)}:${normalizeAccessCode(accessCode)}`)
    .digest("hex");

const addSubscriptionDays = (days = SUBSCRIPTION_DURATION_DAYS) => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + Number(days || 30));
  return expiresAt;
};

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

const createMoyasarInvoice = async ({
  amountHalalas,
  description,
  callbackUrl,
  successUrl,
}) => {
  const body = new URLSearchParams();
  body.set("amount", String(amountHalalas));
  body.set("currency", "SAR");
  body.set("description", description);
  body.set("callback_url", callbackUrl);
  body.set("success_url", successUrl);

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
  return regionCities[city] ? [city, ...regionCities[city]] : [city];
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

const getAnalyticsGroup = async (match, field, limit = 10) =>
  AnalyticsEvent.aggregate([
    { $match: { ...match, [field]: { $nin: [null, ""] } } },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: limit },
    { $project: { _id: 0, label: "$_id", count: 1 } },
  ]);

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
  $or: [
    { eventName: { $ne: "experience_search" } },
    {
      eventName: "experience_search",
      "metadata.searchQuality": "settled",
    },
  ],
});

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

app.post('/api/subscriptions/verify', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const email = normalizeEmail(req.body.email);
    const accessCode = normalizeAccessCode(req.body.accessCode);

    if (!isValidEmail(email) || accessCode.length < 4) {
      return res.status(400).json({
        error: "اكتب البريد والرمز بشكل صحيح.",
      });
    }

    const subscription = await Subscription.findOne({
      email,
      accessCodeHash: hashAccessCode(email, accessCode),
      status: "active",
      expiresAt: { $gt: new Date() },
    }).lean();

    if (!subscription) {
      const pendingSubscription = await Subscription.findOne({
        email,
        accessCodeHash: hashAccessCode(email, accessCode),
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
              expiresAt: addSubscriptionDays(SUBSCRIPTION_DURATION_DAYS),
            },
            { new: true }
          ).lean();

          return res.json({
            active: true,
            email: activated.email,
            expiresAt: activated.expiresAt,
          });
        }

        return res.status(402).json({
          error: "الدفع ما تأكد حتى الآن. إذا دفعت، انتظر لحظات ثم جرّب التفعيل.",
        });
      }

      return res.status(404).json({
        error: "ما لقينا اشتراك نشط بهذا البريد والرمز.",
      });
    }

    res.json({
      active: true,
      email: subscription.email,
      expiresAt: subscription.expiresAt,
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

    const email = normalizeEmail(req.body.email);
    const accessCode = normalizeAccessCode(req.body.accessCode);

    if (!isValidEmail(email) || accessCode.length < 4) {
      return res.status(400).json({
        error: "اكتب بريد صحيح ورمز لا يقل عن 4 خانات قبل الدفع.",
      });
    }

    const accessCodeHash = hashAccessCode(email, accessCode);
    const activeSubscription = await Subscription.findOne({
      email,
      accessCodeHash,
      status: "active",
      expiresAt: { $gt: new Date() },
    }).lean();

    if (activeSubscription) {
      return res.json({
        active: true,
        email: activeSubscription.email,
        expiresAt: activeSubscription.expiresAt,
      });
    }

    const successUrl = getSafeSubscriptionReturnUrl(req.body.returnUrl);

    const amountHalalas = Math.round(SUBSCRIPTION_PRICE_SAR * 100);

    if (MOYASAR_SECRET_KEY) {
      const invoice = await createMoyasarInvoice({
        amountHalalas,
        description: `اشتراك دربك ${SUBSCRIPTION_DURATION_DAYS} يوم`,
        callbackUrl: `${getPublicApiUrl(
          req
        )}/api/subscriptions/moyasar/callback`,
        successUrl,
      });

      await Subscription.findOneAndUpdate(
        { email, accessCodeHash },
        {
          email,
          accessCodeHash,
          status: "pending",
          expiresAt: addSubscriptionDays(SUBSCRIPTION_DURATION_DAYS),
          provider: "moyasar",
          providerPaymentId: invoice.id || "",
        },
        { new: true, upsert: true, runValidators: true }
      );

      return res.json({
        checkoutUrl: invoice.url,
        provider: "moyasar",
        invoiceId: invoice.id,
        priceSar: SUBSCRIPTION_PRICE_SAR,
        durationDays: SUBSCRIPTION_DURATION_DAYS,
      });
    }

    if (SUBSCRIPTION_CHECKOUT_URL) {
      let checkoutUrl = SUBSCRIPTION_CHECKOUT_URL;

      try {
        const url = new URL(SUBSCRIPTION_CHECKOUT_URL);
        url.searchParams.set("email", email);
        url.searchParams.set("amount", String(SUBSCRIPTION_PRICE_SAR));
        url.searchParams.set("duration", String(SUBSCRIPTION_DURATION_DAYS));
        checkoutUrl = url.toString();
      } catch {
        // Keep custom provider links as-is if they are not parseable URLs.
      }

      await Subscription.findOneAndUpdate(
        { email, accessCodeHash },
        {
          email,
          accessCodeHash,
          status: "pending",
          expiresAt: addSubscriptionDays(SUBSCRIPTION_DURATION_DAYS),
          provider: "manual",
          providerPaymentId: "",
        },
        { new: true, upsert: true, runValidators: true }
      );

      return res.json({
        checkoutUrl,
        provider: "manual",
        priceSar: SUBSCRIPTION_PRICE_SAR,
        durationDays: SUBSCRIPTION_DURATION_DAYS,
      });
    }

    return res.status(501).json({
      error:
        "مفتاح ميسر التجريبي غير مفعّل بعد. أضيفي MOYASAR_SECRET_KEY في Render للباكند.",
    });
  } catch (err) {
    console.error("❌ Subscription checkout error:", err);
    res.status(err.statusCode || 500).json({
      error:
        err.statusCode === 501
          ? err.message
          : "تعذر إنشاء رابط الدفع التجريبي حاليًا.",
      details: err.details,
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

    const subscription = await Subscription.findOneAndUpdate(
      { provider: "moyasar", providerPaymentId: invoiceId },
      {
        status: "active",
        expiresAt: addSubscriptionDays(SUBSCRIPTION_DURATION_DAYS),
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

    const email = normalizeEmail(req.body.email);
    const accessCode = normalizeAccessCode(req.body.accessCode);
    const days = Number(req.body.days || SUBSCRIPTION_DURATION_DAYS);

    if (!isValidEmail(email) || accessCode.length < 4) {
      return res.status(400).json({
        error: "اكتب بريد ورمز واضح لا يقل عن 4 خانات.",
      });
    }

    const subscription = await Subscription.findOneAndUpdate(
      { email, accessCodeHash: hashAccessCode(email, accessCode) },
      {
        email,
        accessCodeHash: hashAccessCode(email, accessCode),
        status: "active",
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

    const [
      rawEvents,
      totalEvents,
      uniqueVisitors,
      topEvents,
      topMajors,
      topCities,
      topSearches,
      topPages,
      topDevices,
      topDiagnosis,
      topFears,
      topOrganizations,
      hourlyActivity,
      recentEvents,
    ] = await Promise.all([
      AnalyticsEvent.countDocuments(match),
      AnalyticsEvent.countDocuments(cleanMatch),
      AnalyticsEvent.distinct("visitorId", cleanMatch),
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
        .limit(25)
        .select(
          "eventName page deviceType major city searchQuery resultsCount metadata createdAt"
        )
        .lean(),
    ]);

    res.json({
      days,
      rangeLabel,
      rawEvents,
      totalEvents,
      uniqueVisitors: uniqueVisitors.filter(Boolean).length,
      topEvents,
      topMajors,
      topCities,
      topSearches,
      topPages,
      topDevices,
      topDiagnosis,
      topFears,
      topOrganizations,
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
      filter.city = regionCities[city] ? { $in: regionCities[city] } : city;
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

    res.json({ data: sortedOpportunities, total: sortedOpportunities.length });
  } catch (err) {
    console.error("❌ Opportunities fetch error:", err);
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

    const newExp = new Experience({
      ...req.body,
      rewardAmount: req.body.hadReward === "yes" ? rewardAmount : "",
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
      andFilters.push({ city: cityFilter });
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
