import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  FiCheck,
  FiCreditCard,
  FiShield,
} from "react-icons/fi";
import { useLocation } from "react-router-dom";
import API_BASE_URL from "../config/api";
import {
  PREMIUM_ACCESS_EVENT,
  PREMIUM_STATUS_EVENT,
  getStoredAccessIdentity,
  getStoredPremiumPass,
  hasActivePremiumPass,
  hasResumeAccessPass,
  isPremiumGateEnabled,
  saveAccessIdentity,
  savePremiumPass,
} from "../utils/premiumAccess";
import {
  getVisitorId,
  trackEvent,
  trackEventOnceLocal,
  trackEventOncePerSession,
} from "../utils/analytics";

const initialForm = {
  contact: "",
  accessCode: "",
};

const PENDING_SUBSCRIPTION_KEY = "darbak_pending_subscription_v1";
const SUBSCRIPTION_REMINDER_SEEN_PREFIX =
  "darbak_subscription_reminder_seen_v1";
const SUBSCRIPTION_REMINDER_BAR_DISMISSED_PREFIX =
  "darbak_subscription_reminder_bar_dismissed_v1";
const SUBSCRIPTION_RETURN_REMINDER_SHOWN_PREFIX =
  "darbak_subscription_return_reminder_shown_v1";
const SUBSCRIPTION_LAST_VISIT_PREFIX =
  "darbak_subscription_last_visit_v1";
const SUBSCRIPTION_LIMIT_GATE_DISMISSED_SESSION_KEY =
  "darbak_subscription_limit_gate_dismissed_session_v1";
const SUBSCRIPTION_BAR_SHOWN_SESSION_KEY =
  "darbak_subscription_bar_shown_session_v1";
const SUBSCRIPTION_RETURN_REMINDER_SESSION_KEY =
  "darbak_subscription_return_reminder_session_v1";
const SUBSCRIPTION_REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const SUBSCRIPTION_RETURN_REMINDER_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;
const SUBSCRIPTION_BROWSE_BAR_DELAY_MS = 3 * 60 * 1000;
const SUBSCRIPTION_REMINDER_SUBSCRIBE_URL =
  "/subscribe?source=experience-reminder";

const PremiumPlanCard = ({
  plan,
  selected,
  isCurrentPlan,
  isUpgradePlan,
  onSelect,
  loading,
}) => {
  return (
    <article className={`premium-plan-card${selected ? " is-selected" : ""}${plan.id === RESUME_PLAN_ID ? " is-resume-plan" : ""}${isCurrentPlan ? " is-current-plan" : ""}`}>
      {isCurrentPlan ? (
        <span className="premium-plan-current-badge">باقتك الحالية ✓</span>
      ) : plan.recommended && (
        <span className="premium-plan-ribbon">
          {plan.badge || "الأكثر فائدة"}
        </span>
      )}
      <div className="premium-plan-card-head">
        <h3>{plan.title}</h3>
        <p>{plan.description}</p>
      </div>
      <div className="premium-plan-price">
        <strong>{formatPlanAmount(plan)}</strong>
        <span>ر.س</span>
        <small>/ {formatPlanPeriod(plan)}</small>
      </div>
      <ul>
        {plan.perks.map((perk) => (
          <li key={perk}>
            <FiCheck aria-hidden="true" />
            <span>{perk}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="premium-plan-cta"
        onClick={() => {
          if (!isCurrentPlan) onSelect(plan);
        }}
        disabled={loading || isCurrentPlan}
      >
        {isCurrentPlan
          ? "مشترك حاليًا"
          : loading
          ? "جاري التجهيز..."
          : isUpgradePlan
          ? "رقِّ إلى دربك + سيرتي"
          : plan.ctaLabel || "اشترك الآن"}
      </button>
    </article>
  );
};

const PaymentMethods = () => (
  <div className="premium-payment-block" aria-label="طرق الدفع الآمنة">
    <span>
      <FiCreditCard aria-hidden="true" />
      طرق الدفع
    </span>
    <div className="premium-access-payments">
      <span className="payment-logo payment-logo-mada">
        <strong>mada</strong>
      </span>
      <span className="payment-logo payment-logo-visa">
        <strong>VISA</strong>
      </span>
      <span className="payment-logo payment-logo-mastercard">
        <strong>Mastercard</strong>
      </span>
      <span className="payment-logo payment-logo-apple">
        <strong>Pay</strong>
      </span>
    </div>
  </div>
);

const PLUS_PLAN_ID = "darbak_plus";
const RESUME_PLAN_ID = "darbak_resume";

const fallbackSubscriptionPlans = [
  {
    id: PLUS_PLAN_ID,
    planKey: PLUS_PLAN_ID,
    title: "دربك+",
    label: "دربك+",
    priceSar: 5.99,
    durationDays: 30,
    description: "كل مزايا البحث والاستكشاف في دربك.",
    badge: "شهري",
    note: "ابدأ الآن واكتشف فرصك",
    ctaLabel: "اشترك الآن",
    perks: [
      "الوصول للتجارب",
      "الوصول للفرص",
      "الاستفادة من وين أتدرب",
    ],
  },
  {
    id: "one_time_90",
    planKey: PLUS_PLAN_ID,
    title: "دربك+ 3 أشهر",
    label: "دربك+ 3 أشهر",
    priceSar: 15,
    durationDays: 90,
    description: "مناسبة لموسم البحث والتقديم للتدريب.",
    badge: "90 يوم",
    note: "90 يومًا من البحث حتى التقديم",
    ctaLabel: "اختر 90 يوم",
    perks: [
      "كل مزايا البحث والاستكشاف في دربك",
      "فرص وتجارب ومقابلات طوال الموسم",
      "90 يومًا تغطي رحلة التدريب",
    ],
  },
  {
    id: RESUME_PLAN_ID,
    planKey: RESUME_PLAN_ID,
    title: "دربك+ سيرة",
    label: "دربك+ سيرة",
    priceSar: null,
    durationDays: 30,
    aiResumeUsageLimit: 10,
    description: "كل مزايا دربك + تجهيز سيرتك وتقديماتك.",
    badge: "الأكمل للتقديم",
    note: "سيرة مخصصة وخطاب تقديم ورسالة إيميل",
    recommended: true,
    ctaLabel: "اشترك وابدأ سيرتك",
    perks: [
      "جميع مزايا دربك+",
      "سيرة مخصصة للجهة",
      "خطاب تقديم ورسالة إيميل",
      "10 تخصيصات شهريًا",
    ],
  },
];

const formatPlanPrice = (plan = {}) =>
  typeof plan.priceSar === "number"
    ? `${plan.priceSar.toLocaleString("en-US", {
        minimumFractionDigits: plan.priceSar % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      })} ريال`
    : "جار التحميل";

const formatPlanAmount = (plan = {}) =>
  typeof plan.priceSar === "number"
    ? plan.priceSar.toLocaleString("en-US", {
        minimumFractionDigits: plan.priceSar % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      })
    : "…";

const formatPlanPeriod = (plan = {}) => {
  const days = Number(plan.durationDays || 0);
  return days ? `${days} يوم` : "30 يوم";
};

const formatPlanDuration = (plan = {}) => {
  const days = Number(plan.durationDays || 0);
  if (days === 30) return "شهريًا";
  if (days > 0) return `${days} يوم`;
  return "شهريًا";
};

const buildPlanPerks = (plan = {}) => {
  if (plan.planKey === RESUME_PLAN_ID || plan.id === RESUME_PLAN_ID) {
    const usageLimit = Number(plan.aiResumeUsageLimit || 0);
    return [
      "جميع مزايا دربك+",
      "إنشاء سيرة ذاتية مرتبة",
      "استيراد البيانات من الملف المهني",
      "تخصيص السيرة حسب فرصة التدريب",
      usageLimit > 0
        ? `${usageLimit} عمليات تخصيص ذكية شهريًا`
        : "عمليات تخصيص ذكية شهريًا",
      "تحميل السيرة PDF",
      "إنشاء رسالة تقديم",
    ];
  }

  if (plan.id === "one_time_90") {
    return [
      "كل مزايا البحث والاستكشاف في دربك",
      "فرص وتجارب ومقابلات طوال الموسم",
      "90 يومًا تغطي رحلة التدريب",
    ];
  }

  return [
    "الوصول للتجارب",
    "الوصول للفرص",
    "الاستفادة من وين أتدرب",
  ];
};

const normalizeServerPlan = (plan = {}) => {
  const planKey = plan.planKey || normalizePlanId(plan.id);
  const isResumePlan = planKey === RESUME_PLAN_ID || plan.id === RESUME_PLAN_ID;
  const isNinetyDayPlan = plan.id === "one_time_90";

  return {
    ...plan,
    id: plan.id || planKey,
    planKey,
    title: plan.label || (isResumePlan ? "دربك+ سيرة" : "دربك+"),
    description: isResumePlan
      ? "كل مزايا دربك + تجهيز سيرتك وتقديماتك."
      : isNinetyDayPlan
      ? "مناسبة لموسم البحث والتقديم للتدريب."
      : "كل مزايا البحث والاستكشاف في دربك.",
    badge: plan.badge || (isResumePlan ? "الأكمل للتقديم ✨" : ""),
    note: isResumePlan ? "الأكمل للتقديم" : isNinetyDayPlan ? "90 يومًا من البحث حتى التقديم" : "ابدأ الآن واكتشف فرصك",
    recommended: isResumePlan,
    ctaLabel: isResumePlan
      ? "ابدأ مع سيرتي ✨"
      : isNinetyDayPlan
      ? "اختر 90 يوم"
      : "اشترك الآن",
    perks: buildPlanPerks(plan),
  };
};

const mergeSubscriptionPlans = (serverPlans = []) => {
  const serverPlansById = new Map(
    serverPlans.map((plan) => [normalizePlanId(plan.id), plan])
  );
  const knownPlans = fallbackSubscriptionPlans.map((fallbackPlan) => {
    const serverPlan = serverPlansById.get(normalizePlanId(fallbackPlan.id));
    return serverPlan
      ? {
          ...fallbackPlan,
          ...serverPlan,
          perks:
            Array.isArray(serverPlan.perks) && serverPlan.perks.length
              ? serverPlan.perks
              : fallbackPlan.perks,
        }
      : fallbackPlan;
  });
  const knownPlanIds = new Set(knownPlans.map((plan) => normalizePlanId(plan.id)));

  return [
    ...knownPlans,
    ...serverPlans.filter((plan) => !knownPlanIds.has(normalizePlanId(plan.id))),
  ];
};

const normalizePlanId = (planId = "") => {
  const value = (planId ?? "").toString().trim();
  if (["monthly", "darbak_plus"].includes(value)) {
    return "darbak_plus";
  }
  if (["resume", "darbak_resume", "darbak_plus_resume"].includes(value)) {
    return "darbak_resume";
  }
  return value;
};

const findSubscriptionPlanById = (plans = [], planId = "") =>
  plans.find((plan) => plan.id === normalizePlanId(planId));

const normalizeArabicDigits = (value = "") =>
  value
    .toString()
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));

const normalizeAccessCode = (value = "") =>
  normalizeArabicDigits(value).trim().replace(/\s+/g, "");

const normalizeSaudiMobile = (value = "") => {
  const digits = normalizeArabicDigits(value).replace(/[^\d+]/g, "");
  const number = digits.startsWith("+") ? digits : digits.replace(/^\+?/, "");

  return (
    /^\+9665\d{8}$/.test(digits) ||
    /^9665\d{8}$/.test(number) ||
    /^05\d{8}$/.test(number) ||
    /^5\d{8}$/.test(number)
  );
};

const isValidEmailContact = (value = "") =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    normalizeArabicDigits(value).trim().toLowerCase()
  );

const isValidContact = (value = "") =>
  isValidEmailContact(value) || normalizeSaudiMobile(value);

const isValidAccessCode = (value = "") => {
  const accessCode = normalizeAccessCode(value);
  return /^[A-Za-z0-9]{4,12}$/.test(accessCode) && !/^(.)\1+$/.test(accessCode);
};

const getReminderAudienceKey = () => {
  const identity = getStoredAccessIdentity();
  const contact = (identity.contact || identity.email || "")
    .toString()
    .trim()
    .toLowerCase();

  return contact || getVisitorId() || "anonymous";
};

const getReminderStorageKey = (prefix) =>
  `${prefix}:${getReminderAudienceKey()}`;

const getStoredReminderTimestamp = (prefix) => {
  if (typeof window === "undefined") return 0;

  try {
    const value = Number(window.localStorage.getItem(getReminderStorageKey(prefix)));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
};

const setStoredReminderTimestamp = (prefix, timestamp = Date.now()) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      getReminderStorageKey(prefix),
      String(timestamp)
    );
  } catch {
    // Storage is only a fallback; the server still stores logged-in reminders.
  }
};

const getSessionFlag = (key) => {
  if (typeof window === "undefined") return false;

  try {
    return window.sessionStorage.getItem(key) === "true";
  } catch {
    return false;
  }
};

const setSessionFlag = (key) => {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(key, "true");
  } catch {
    // Session storage only prevents repeated prompts in the current tab.
  }
};

const isSubscriptionReminderCandidate = (detail = {}, accessStatus = {}) => {
  if (accessStatus.reason !== "daily_limit" || detail.loginOnly) return false;

  const feature = detail.feature || "";
  const itemKey = detail.itemKey || "";
  return (
    feature.includes("experience") ||
    feature.includes("opportunity") ||
    feature.includes("where_to_train") ||
    feature.includes("training_guide") ||
    itemKey.startsWith("experience:") ||
    itemKey.startsWith("opportunity:") ||
    itemKey.startsWith("where-to-train:") ||
    itemKey.startsWith("where-to-train-opportunities:") ||
    itemKey.startsWith("guide-organization:")
  );
};

const shouldShowReminderBar = () => {
  const lastDismissedAt = getStoredReminderTimestamp(
    SUBSCRIPTION_REMINDER_BAR_DISMISSED_PREFIX
  );

  return (
    !hasActivePremiumPass() &&
    (!lastDismissedAt ||
      Date.now() - lastDismissedAt >= SUBSCRIPTION_REMINDER_COOLDOWN_MS)
  );
};

export default function PremiumAccessGate() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [feature, setFeature] = useState("");
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [successNotice, setSuccessNotice] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [isRequestingHelp, setIsRequestingHelp] = useState(false);
  const [isResettingCode, setIsResettingCode] = useState(false);
  const [isLoginOnly, setIsLoginOnly] = useState(false);
  const [showCheckoutForm, setShowCheckoutForm] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("darbak_plus");
  const [subscriptionPlans, setSubscriptionPlans] = useState(
    fallbackSubscriptionPlans
  );
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [isResetMode, setIsResetMode] = useState(false);
  const [subscriptionReminder, setSubscriptionReminder] = useState(null);
  const [isReminderBarVisible, setIsReminderBarVisible] = useState(false);
  const [isLimitGateOpen, setIsLimitGateOpen] = useState(false);
  const [isPremiumActive, setIsPremiumActive] = useState(
    () => typeof window !== "undefined" && hasActivePremiumPass()
  );
  const [platformStats, setPlatformStats] = useState({
    experiencesCount: null,
    organizationsCount: null,
    activeSubscribersCount: null,
  });
  const pendingActionRef = useRef(null);
  const reminderDetailRef = useRef(null);
  const reminderBarTimerRef = useRef(null);
  const returnReminderEligibleRef = useRef(false);
  const sessionPageViewsRef = useRef(0);
  const lastTrackedPathRef = useRef("");
  const selectedPlan =
    findSubscriptionPlanById(subscriptionPlans, selectedPlanId) ||
    subscriptionPlans[0] ||
    fallbackSubscriptionPlans[0];
  const currentPlanId = getStoredPremiumPass()?.planId || "";

  useEffect(() => {
    let isMounted = true;

    const fetchSubscriptionPlans = async () => {
      try {
        setPlansLoading(true);
        const { data } = await axios.get(`${API_BASE_URL}/api/subscriptions/plans`);
        if (!isMounted) return;

        const publicPlans = Array.isArray(data.plans)
          ? data.plans.map(normalizeServerPlan)
          : [];
        const nextPlans = publicPlans.length
          ? mergeSubscriptionPlans(publicPlans)
          : fallbackSubscriptionPlans;

        setSubscriptionPlans(nextPlans);
        setPlansError("");
        setSelectedPlanId((currentPlanId) =>
          findSubscriptionPlanById(nextPlans, currentPlanId)
            ? currentPlanId
            : nextPlans[0]?.id || PLUS_PLAN_ID
        );
      } catch {
        if (!isMounted) return;
        setSubscriptionPlans(fallbackSubscriptionPlans);
        setPlansError("تعذر تحميل الباقات من السيرفر حاليًا.");
      } finally {
        if (isMounted) setPlansLoading(false);
      }
    };

    fetchSubscriptionPlans();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedPlan = findSubscriptionPlanById(
      subscriptionPlans,
      params.get("plan")
    );
    if (requestedPlan) {
      setSelectedPlanId(requestedPlan.id);
    }
  }, [location.search, subscriptionPlans]);

  useEffect(() => {
    const refreshPremiumState = () => setIsPremiumActive(hasActivePremiumPass());

    refreshPremiumState();
    window.addEventListener(PREMIUM_STATUS_EVENT, refreshPremiumState);
    return () =>
      window.removeEventListener(PREMIUM_STATUS_EVENT, refreshPremiumState);
  }, []);

  useEffect(() => {
    if (!isPremiumActive) return;

    if (reminderBarTimerRef.current) {
      window.clearTimeout(reminderBarTimerRef.current);
      reminderBarTimerRef.current = null;
    }

    pendingActionRef.current = null;
    reminderDetailRef.current = null;
    setSubscriptionReminder(null);
    setIsReminderBarVisible(false);
    setIsOpen(false);
    setIsLimitGateOpen(false);
  }, [isPremiumActive]);

  const markSubscriptionReminderShown = useCallback((detail = {}, accessStatus = {}) => {
    const shownAt = Date.now();
    const identity = getStoredAccessIdentity();

    setStoredReminderTimestamp(SUBSCRIPTION_REMINDER_SEEN_PREFIX, shownAt);
    trackEvent("subscription_reminder_shown", {
      metadata: {
        feature: detail.feature || "",
        title: detail.title || "",
        source: detail.source || "",
        itemKey: detail.itemKey || "",
        dailyLimit: accessStatus.dailyLimit || 0,
        viewsUsed: accessStatus.viewsUsed || 0,
      },
    });

    axios
      .post(`${API_BASE_URL}/api/access/reminder-shown`, {
        contact: identity.contact || identity.email || "",
        accessCode: identity.accessCode || "",
        visitorId: getVisitorId(),
      })
      .catch(() => {
        // The local cooldown still prevents repeated reminders if this fails.
      });
  }, []);

  const queueReminderBar = useCallback(
    (delayMs = SUBSCRIPTION_BROWSE_BAR_DELAY_MS) => {
      if (typeof window === "undefined") return;
      if (!isPremiumGateEnabled() || isPremiumActive) return;
      if (
        !shouldShowReminderBar() ||
        getSessionFlag(SUBSCRIPTION_BAR_SHOWN_SESSION_KEY)
      ) {
        return;
      }

      if (reminderBarTimerRef.current) {
        window.clearTimeout(reminderBarTimerRef.current);
      }

      reminderBarTimerRef.current = window.setTimeout(() => {
        reminderBarTimerRef.current = null;

        if (!isPremiumActive && shouldShowReminderBar()) {
          setSessionFlag(SUBSCRIPTION_BAR_SHOWN_SESSION_KEY);
          setIsReminderBarVisible(true);
        }
      }, delayMs);
    },
    [isPremiumActive]
  );

  const closeSubscriptionReminder = useCallback(() => {
    if (subscriptionReminder?.mode === "daily_limit") {
      setSessionFlag(SUBSCRIPTION_LIMIT_GATE_DISMISSED_SESSION_KEY);
      queueReminderBar();
    }

    setSubscriptionReminder(null);
  }, [queueReminderBar, subscriptionReminder]);

  const closeReminderBar = () => {
    setStoredReminderTimestamp(SUBSCRIPTION_REMINDER_BAR_DISMISSED_PREFIX);
    setIsReminderBarVisible(false);
  };

  const openSubscriptionFromReminder = (placement = "modal") => {
    const detail =
      subscriptionReminder?.detail || reminderDetailRef.current?.detail || {};
    trackEvent("subscription_reminder_clicked", {
      metadata: {
        feature: detail.feature || "",
        title: detail.title || "",
        source: detail.source || "",
        itemKey: detail.itemKey || "",
        placement,
      },
    });
    setSubscriptionReminder(null);
    setIsReminderBarVisible(false);
    window.location.assign(SUBSCRIPTION_REMINDER_SUBSCRIBE_URL);
  };

  useEffect(() => {
    let isMounted = true;

    const fetchPlatformStats = async () => {
      try {
        const { data } = await axios.get(`${API_BASE_URL}/api/home-stats`);
        if (!isMounted) return;

        setPlatformStats({
          experiencesCount:
            typeof data.experiencesCount === "number"
              ? data.experiencesCount
              : null,
          organizationsCount:
            typeof data.organizationsCount === "number"
              ? data.organizationsCount
              : Array.isArray(data.organizationNames)
              ? data.organizationNames.filter(Boolean).length
              : null,
          activeSubscribersCount:
            typeof data.activeSubscribersCount === "number"
              ? data.activeSubscribersCount
              : null,
        });
      } catch {
        // Stats are decorative here and should not block payment.
      }
    };

    fetchPlatformStats();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isPremiumGateEnabled() || isPremiumActive) return;

    const lastVisitAt = getStoredReminderTimestamp(SUBSCRIPTION_LAST_VISIT_PREFIX);
    const lastReturnReminderAt = getStoredReminderTimestamp(
      SUBSCRIPTION_RETURN_REMINDER_SHOWN_PREFIX
    );
    const now = Date.now();

    returnReminderEligibleRef.current = Boolean(
      lastVisitAt &&
        now - lastVisitAt >= SUBSCRIPTION_REMINDER_COOLDOWN_MS &&
        (!lastReturnReminderAt ||
          now - lastReturnReminderAt >= SUBSCRIPTION_RETURN_REMINDER_COOLDOWN_MS)
    );

    setStoredReminderTimestamp(SUBSCRIPTION_LAST_VISIT_PREFIX, now);
  }, [isPremiumActive]);

  useEffect(() => {
    queueReminderBar();

    return () => {
      if (reminderBarTimerRef.current) {
        window.clearTimeout(reminderBarTimerRef.current);
        reminderBarTimerRef.current = null;
      }
    };
  }, [queueReminderBar]);

  useEffect(() => {
    if (!isPremiumGateEnabled() || isPremiumActive) return;

    const pathKey = `${location.pathname}${location.search}`;
    if (lastTrackedPathRef.current !== pathKey) {
      lastTrackedPathRef.current = pathKey;
      sessionPageViewsRef.current += 1;
    }

    if (
      !returnReminderEligibleRef.current ||
      sessionPageViewsRef.current < 2 ||
      getSessionFlag(SUBSCRIPTION_RETURN_REMINDER_SESSION_KEY) ||
      isOpen ||
      subscriptionReminder
    ) {
      return;
    }

    const detail = {
      feature: "return_subscription_reminder",
      title: "رجعت تكمل بحثك؟",
      source: "return_visit",
    };

    setSessionFlag(SUBSCRIPTION_RETURN_REMINDER_SESSION_KEY);
    setStoredReminderTimestamp(SUBSCRIPTION_RETURN_REMINDER_SHOWN_PREFIX);
    reminderDetailRef.current = { detail, accessStatus: {} };
    queueReminderBar();
    trackEvent("subscription_reminder_shown", {
      metadata: {
        feature: detail.feature,
        title: detail.title,
        source: detail.source,
        mode: "return_visit_bar",
        pageViews: sessionPageViewsRef.current,
      },
    });
  }, [
    isOpen,
    isPremiumActive,
    location.pathname,
    location.search,
    queueReminderBar,
    subscriptionReminder,
  ]);

  useEffect(() => {
    const handlePremiumRequest = (event) => {
      const detail = event.detail || {};
      // The subscription page must always be able to show the existing plan
      // picker. The environment flag only controls feature-gating elsewhere.
      const isSubscriptionBrowseRequest = detail.feature === "subscribe_page";
      if (
        !isPremiumGateEnabled() &&
        !detail.loginOnly &&
        !isSubscriptionBrowseRequest
      ) {
        return;
      }

      const accessStatus = detail.accessStatus || {};
      const requestedPlan = findSubscriptionPlanById(
        subscriptionPlans,
        detail.defaultPlanId
      );
      const requiresResumePlan = requestedPlan?.id === "darbak_resume";
      const hasRequestedPlanAccess = requiresResumePlan
        ? hasResumeAccessPass()
        : !requestedPlan ||
          getStoredPremiumPass()?.planId === requestedPlan.id;

      if (
        isPremiumActive &&
        !detail.loginOnly &&
        hasRequestedPlanAccess
      ) {
        if (typeof detail.onGranted === "function") {
          detail.onGranted();
        }
        return;
      }

      if (isSubscriptionReminderCandidate(detail, accessStatus)) {
        pendingActionRef.current = null;
        setMessage("");
        setIsLoginOnly(false);
        setShowCheckoutForm(false);
        setIsResetMode(false);
        setResetToken("");
        reminderDetailRef.current = { detail, accessStatus };

        if (!getSessionFlag(SUBSCRIPTION_LIMIT_GATE_DISMISSED_SESSION_KEY)) {
          setIsLimitGateOpen(false);
          setIsOpen(false);
          setSubscriptionReminder({
            detail,
            accessStatus,
            mode: "daily_limit",
          });
          markSubscriptionReminderShown(detail, accessStatus);
        } else {
          queueReminderBar(0);
        }

        return;
      }

      if (detail.reminderOnly) return;

      pendingActionRef.current = detail.onGranted || null;
      if (requestedPlan) {
        setSelectedPlanId(requestedPlan.id);
      }
      setFeature(detail.feature || "");
      setIsLimitGateOpen(false);
      setIsLoginOnly(Boolean(detail.loginOnly));
      setShowCheckoutForm(Boolean(detail.openCheckout) && !detail.loginOnly);
      setIsResetMode(false);
      setResetToken("");
      const gateMessage = detail.gateMessage || "";
      setMessage(
        accessStatus.reason === "daily_limit"
          ? gateMessage ||
              accessStatus.message ||
              "وقفت هنا... وباقي أهم التجارب. فعّل دربك+ وكمل استكشافك."
          : ""
      );
      setIsOpen(true);
      const gateType = detail.loginOnly ? "login_only" : "premium_gate";
      if (gateType === "premium_gate") {
        trackEventOncePerSession(
          "premium_gate_opened",
          {
            metadata: {
              feature: detail.feature || "",
              title: detail.title || "",
              source: detail.source || "",
              gateType,
            },
          },
          gateType
        );
      }
    };

    window.addEventListener(PREMIUM_ACCESS_EVENT, handlePremiumRequest);
    return () =>
      window.removeEventListener(PREMIUM_ACCESS_EVENT, handlePremiumRequest);
  }, [
    isPremiumActive,
    markSubscriptionReminderShown,
    queueReminderBar,
    subscriptionPlans,
  ]);

  const closeGate = () => {
    if (isOpen) {
      trackEvent("premium_gate_closed", {
        metadata: {
          feature,
          source: isLoginOnly ? "login_only" : "premium_gate",
          planId: selectedPlan.id,
          isLimitGate: isLimitGateOpen,
        },
      });
    }
    if (isLimitGateOpen) {
      setSessionFlag(SUBSCRIPTION_LIMIT_GATE_DISMISSED_SESSION_KEY);
    }
    setIsOpen(false);
    setMessage("");
    setIsVerifying(false);
    setIsStartingCheckout(false);
    setIsRequestingHelp(false);
    setIsResettingCode(false);
    setIsLoginOnly(false);
    setShowCheckoutForm(false);
    setIsResetMode(false);
    setResetToken("");
    setIsLimitGateOpen(false);
  };

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage("");
  };

  const grantAccess = useCallback((subscription) => {
    savePremiumPass(subscription);
    try {
      window.localStorage.removeItem(PENDING_SUBSCRIPTION_KEY);
    } catch {
      // Ignore storage cleanup errors.
    }
    setIsOpen(false);
    setMessage("");
    setIsLoginOnly(false);
    setIsLimitGateOpen(false);
    setSubscriptionReminder(null);
    setIsReminderBarVisible(false);
    reminderDetailRef.current = null;
    setSuccessNotice("تم تفعيل دربك+ بنجاح. المزايا المتقدمة صارت مفتوحة لك الآن.");

    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    if (typeof action === "function") action();
  }, []);

  useEffect(() => {
    if (!successNotice) return undefined;

    const noticeTimer = window.setTimeout(() => {
      setSuccessNotice("");
    }, 5200);

    return () => window.clearTimeout(noticeTimer);
  }, [successNotice]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const token = params.get("reset_code_token") || "";
    const contact = params.get("reset_contact") || "";
    if (!token) return;

    setForm({
      contact,
      accessCode: "",
    });
    setFeature("reset_access_code");
    setIsLoginOnly(true);
    setShowCheckoutForm(false);
    setIsResetMode(true);
    setResetToken(token);
    setMessage("اكتب رمز دخول جديد لحسابك في دربك+.");
    setIsOpen(true);

    params.delete("reset_code_token");
    params.delete("reset_contact");
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${
      nextSearch ? `?${nextSearch}` : ""
    }${window.location.hash || ""}`;
    window.history.replaceState({}, "", nextUrl);
  }, []);

  const verifyAccess = useCallback(async (
    contactValue = form.contact,
    accessCodeValue = form.accessCode,
    options = {}
  ) => {
    const normalizedCode = normalizeAccessCode(accessCodeValue);

    if (!isValidContact(contactValue)) {
      setMessage("اكتب بريدًا إلكترونيًا صحيحًا، أو رقم الجوال المستخدم لحساب سابق، قبل التحقق.");
      return false;
    }

    if (!isValidAccessCode(normalizedCode)) {
      setMessage("اكتب رمز دخول بسيط من 4 إلى 12 رقم أو حرف إنجليزي.");
      return false;
    }

    try {
      setIsVerifying(true);
      setMessage(
        options.auto
          ? "تم الدفع بنجاح. نؤكد اشتراكك الآن ونفتح لك المزايا..."
          : ""
      );
      const { data } = await axios.post(`${API_BASE_URL}/api/subscriptions/verify`, {
        email: contactValue,
        accessCode: normalizedCode,
        visitorId: getVisitorId(),
      });
      saveAccessIdentity({ contact: contactValue, accessCode: normalizedCode });
      grantAccess(data);
      return true;
    } catch (err) {
      setMessage(
        err.response?.data?.error || "تعذر التحقق من الاشتراك حاليًا."
      );
      return false;
    } finally {
      setIsVerifying(false);
    }
  }, [form.accessCode, form.contact, grantAccess]);

  const verifySubscription = (event) => {
    event.preventDefault();
    verifyAccess();
  };

  const requestAccessHelp = async () => {
    const contact = form.contact.trim();

    if (!contact) {
      setMessage("اكتب البريد الإلكتروني المرتبط بحساب دربك+ أولًا.");
      return;
    }

    if (isValidEmailContact(contact)) {
      try {
        setIsRequestingHelp(true);
        setMessage("");
        const { data } = await axios.post(
          `${API_BASE_URL}/api/subscriptions/forgot-code`,
          {
            email: contact,
            visitorId: getVisitorId(),
            source: isLoginOnly ? "login_only" : "premium_gate",
          }
        );
        setMessage(
          data.message ||
            "إذا كان هذا البريد مرتبطًا بحساب دربك+، ستصلك رسالة لإعادة تعيين الرمز."
        );
        trackEvent("premium_access_reset_clicked", {
          metadata: { source: isLoginOnly ? "login_only" : "premium_gate" },
        });
      } catch (err) {
        setMessage(
          err.response?.data?.error ||
            "تعذر إرسال رابط إعادة التعيين حاليًا."
        );
      } finally {
        setIsRequestingHelp(false);
      }
      return;
    }

    try {
      setIsRequestingHelp(true);
      setMessage("");
      const { data } = await axios.post(
        `${API_BASE_URL}/api/subscriptions/request-access-help`,
        { contact }
      );
      setMessage(data.message || "وصل طلب المساعدة. بنساعدك على استعادة الوصول.");
      trackEvent("premium_access_help_requested", {
        metadata: { source: isLoginOnly ? "login_only" : "premium_gate" },
      });
    } catch (err) {
      setMessage(
        err.response?.data?.error || "تعذر إرسال طلب المساعدة حاليًا."
      );
    } finally {
      setIsRequestingHelp(false);
    }
  };

  const resetAccessCode = async (event) => {
    event.preventDefault();

    const contact = form.contact.trim();
    const normalizedCode = normalizeAccessCode(form.accessCode);

    if (!isValidEmailContact(contact)) {
      setMessage("اكتب البريد الإلكتروني المرتبط بحساب دربك+.");
      return;
    }

    if (!resetToken) {
      setMessage("رابط إعادة التعيين غير صالح. اطلب رابطًا جديدًا.");
      return;
    }

    if (!isValidAccessCode(normalizedCode)) {
      setMessage("اختَر رمز دخول جديد من 4 إلى 12 رقم أو حرف إنجليزي.");
      return;
    }

    try {
      setIsResettingCode(true);
      setMessage("");
      const { data } = await axios.post(`${API_BASE_URL}/api/subscriptions/reset-code`, {
        email: contact,
        token: resetToken,
        accessCode: normalizedCode,
        visitorId: getVisitorId(),
      });
      saveAccessIdentity({ contact, accessCode: normalizedCode });
      if (data.active) {
        grantAccess(data);
      } else {
        setMessage(data.message || "تم تحديث رمز الدخول. سجّل الدخول بالرمز الجديد.");
        setIsResetMode(false);
        setResetToken("");
      }
      trackEvent("premium_access_code_reset", {
        metadata: { source: "reset_email_link" },
      });
    } catch (err) {
      setMessage(
        err.response?.data?.error ||
          "تعذر تحديث رمز الدخول. اطلب رابطًا جديدًا وحاول مرة أخرى."
      );
    } finally {
      setIsResettingCode(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("subscription") !== "success") return;

    let pending = {};
    try {
      pending = JSON.parse(
        window.localStorage.getItem(PENDING_SUBSCRIPTION_KEY) || "{}"
      );
    } catch {
      // Ignore malformed pending checkout data.
    }

    trackEventOnceLocal(
      "premium_payment_returned",
      {
        metadata: {
          source: "moyasar_return",
          planId: pending.planId || "",
          providerPaymentId: pending.invoiceId || pending.providerPaymentId || "",
        },
      },
      pending.invoiceId || pending.providerPaymentId || "moyasar_return"
    );

    const pendingContact = pending.contact || pending.email || "";
    const pendingAccessCode = pending.accessCode || "";

    setForm({
      contact: pendingContact,
      accessCode: pendingAccessCode,
    });
    setFeature("experience_details");
    setIsLoginOnly(true);
    setShowCheckoutForm(false);
    setIsOpen(true);

    params.delete("subscription");
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${
      nextSearch ? `?${nextSearch}` : ""
    }${window.location.hash || ""}`;
    window.history.replaceState({}, "", nextUrl);

    if (pendingContact && pendingAccessCode) {
      verifyAccess(pendingContact, pendingAccessCode, { auto: true });
      return;
    }

    setMessage(
      "تم الرجوع من صفحة الدفع. اكتب نفس البريد الإلكتروني أو رقم الجوال القديم والرمز لتفعيل دربك+."
    );
  }, [verifyAccess]);

  const selectPlanAndCreateAccount = (plan) => {
    setSelectedPlanId(plan.id);
    setShowCheckoutForm(true);
    setMessage("اكتب البريد الإلكتروني والرمز، وبعد الضغط نوديك مباشرة لصفحة الدفع الآمنة.");
    trackEventOncePerSession(
      "premium_plan_selected",
      {
        metadata: { feature, planId: plan.id },
      },
      plan.id
    );
  };

  const startCheckout = async (checkoutPlan = selectedPlan) => {
    if (!isValidEmailContact(form.contact)) {
      setMessage("اكتب بريدًا إلكترونيًا صحيحًا حتى نربط الاشتراك بحسابك.");
      return;
    }

    if (!isValidAccessCode(form.accessCode)) {
      setMessage("اختَر رمز دخول من 4 إلى 12 رقم أو حرف إنجليزي، بدون تكرار كامل.");
      return;
    }

    try {
      setIsStartingCheckout(true);
      setMessage("");
      setSelectedPlanId(checkoutPlan.id);
      saveAccessIdentity({
        contact: form.contact,
        accessCode: normalizeAccessCode(form.accessCode),
      });
      const { data } = await axios.post(
        `${API_BASE_URL}/api/subscriptions/start-checkout`,
        {
          email: form.contact,
          accessCode: normalizeAccessCode(form.accessCode),
          planId: checkoutPlan.id,
          returnUrl: window.location.href,
          visitorId: getVisitorId(),
        }
      );

      if (data.active) {
        grantAccess(data);
        return;
      }

      if (!data.checkoutUrl) {
        trackEvent("premium_checkout_failed", {
          metadata: {
            feature,
            planId: checkoutPlan.id,
            reason: "missing_checkout_url",
          },
        });
        setMessage("تعذر فتح رابط الدفع. جرّب مرة ثانية بعد لحظات.");
        return;
      }

      const checkoutDedupeKey =
        data.invoiceId || data.providerPaymentId || `${checkoutPlan.id}:${Date.now()}`;
      const checkoutMetadata = {
        feature,
        hasContact: Boolean(form.contact.trim()),
        planId: checkoutPlan.id,
        provider: data.provider || "",
        providerPaymentId: data.invoiceId || data.providerPaymentId || "",
      };

      trackEventOnceLocal(
        "premium_checkout_started",
        { metadata: checkoutMetadata },
        checkoutDedupeKey
      );
      trackEventOnceLocal(
        "checkout_started",
        { metadata: { ...checkoutMetadata, source: "darbak_plus" } },
        checkoutDedupeKey
      );

      try {
        window.localStorage.setItem(
          PENDING_SUBSCRIPTION_KEY,
          JSON.stringify({
            contact: form.contact,
            accessCode: normalizeAccessCode(form.accessCode),
            planId: checkoutPlan.id,
            invoiceId: data.invoiceId || data.providerPaymentId || "",
            provider: data.provider || "",
            startedAt: new Date().toISOString(),
          })
        );
      } catch {
        // The user can still enter the same contact and code manually.
      }

      setMessage("بنقلك الآن لصفحة التفعيل الآمنة...");
      window.location.assign(data.checkoutUrl);
    } catch (err) {
      trackEvent("premium_checkout_failed", {
        metadata: {
          feature,
          planId: checkoutPlan.id,
          reason: err.response?.data?.error || err.message || "unknown",
        },
      });
      setMessage(
        err.response?.data?.error ||
          "الدفع غير مفعّل حاليًا. جهّزي رابط الدفع من ميسر أو تاب ثم نفعّله."
      );
    } finally {
      setIsStartingCheckout(false);
    }
  };

  const shouldRenderSubscriptionReminder =
    !isPremiumActive && Boolean(subscriptionReminder);
  const shouldRenderReminderBar =
    !isPremiumActive && isReminderBarVisible && !subscriptionReminder && !isOpen;

  if (!isOpen && !successNotice && !shouldRenderSubscriptionReminder && !shouldRenderReminderBar) {
    return null;
  }

  return (
    <>
      {successNotice && (
        <div className="premium-success-toast" role="status" dir="rtl">
          <strong>دربك+ فعال الآن</strong>
          <span>{successNotice}</span>
        </div>
      )}

      {shouldRenderSubscriptionReminder && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="subscription-reminder-title"
          onClick={closeSubscriptionReminder}
          className="subscription-reminder-overlay"
          dir="rtl"
        >
          <section
            className="subscription-reminder-card"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="subscription-reminder-close"
              onClick={closeSubscriptionReminder}
              aria-label="إغلاق"
            >
              ×
            </button>
            <div className="subscription-reminder-badge">دربك+</div>
            <h2 id="subscription-reminder-title">
              {subscriptionReminder.mode === "return_visit"
                ? "رجعت تكمل بحثك؟ 👀"
                : "كل يوم تجربة وفرصة؟ افتحها كلها اليوم 👀"}
            </h2>
            <p>
              {subscriptionReminder.mode === "return_visit"
                ? "افتح جميع التجارب والفرص المناسبة لتخصصك بدل الانتظار يوميًا."
                : "وصلت لحدك المجاني اليوم. اشترك وافتح جميع تجارب التدريب والفرص والمقابلات ومعلومات الجهات بـ5.99 ر.س شهريًا."}
            </p>
            <div className="subscription-reminder-actions">
              <button
                type="button"
                className="subscription-reminder-primary"
                onClick={() => openSubscriptionFromReminder("modal")}
              >
                افتح جميع التجارب والفرص
              </button>
              <button
                type="button"
                className="subscription-reminder-secondary"
                onClick={closeSubscriptionReminder}
              >
                أكمل مجانًا
              </button>
            </div>
          </section>
        </div>
      )}

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="premium-access-title"
          onClick={closeGate}
          className="premium-access-overlay"
          dir="rtl"
        >
          <div
            className="premium-access-card"
            onClick={(event) => event.stopPropagation()}
          >
        <button
          type="button"
          className="premium-access-close"
          onClick={closeGate}
          aria-label="إغلاق"
        >
          ×
        </button>

        <div className={`premium-access-layout${isLoginOnly ? " is-login-only" : ""}`}>
          {isLoginOnly ? (
            <section className="premium-login-panel">
              <div className="premium-access-badge">دربك+</div>
              <h2 id="premium-access-title">
                {isResetMode ? "تعيين رمز دخول جديد" : "تسجيل الدخول إلى دربك+"}
              </h2>
              <p className="premium-access-lead">
                {isResetMode
                  ? "اكتب بريدك المرتبط بدربك+ واختر رمزًا جديدًا تحفظه للدخول لاحقًا."
                  : "ادخل بنفس البريد الإلكتروني أو رقم الجوال الذي استخدمته سابقًا، مع رمز الدخول."}
              </p>

              <div className="premium-access-form">
                <div className="premium-access-fields">
                  <label className="premium-access-field">
                    <span>
                      {isResetMode
                        ? "البريد الإلكتروني"
                        : "البريد الإلكتروني أو رقم جوال لحساب سابق"}
                    </span>
                    <input
                      type="text"
                      inputMode="text"
                      value={form.contact}
                      onChange={(event) =>
                        updateField("contact", event.target.value)
                      }
                      placeholder="example@email.com أو 05xxxxxxxx"
                      autoComplete="email"
                    />
                  </label>
                  <label className="premium-access-field">
                    <span>{isResetMode ? "رمز الدخول الجديد" : "رمز الدخول"}</span>
                    <input
                      value={form.accessCode}
                      onChange={(event) =>
                        updateField("accessCode", event.target.value)
                      }
                      placeholder="رمز تحفظه"
                      autoComplete="one-time-code"
                      maxLength={12}
                    />
                  </label>
                </div>
              </div>

              <form
                className="premium-access-verify-form"
                onSubmit={isResetMode ? resetAccessCode : verifySubscription}
              >
                <p>
                  {isResetMode
                    ? "بعد حفظ الرمز الجديد، بنفتح لك دربك+ مباشرة إذا كان اشتراكك نشطًا."
                    : "سيتم التحقق من حسابك وفتح المزايا مباشرة."}
                </p>
                <button type="submit" disabled={isVerifying || isResettingCode}>
                  {isResetMode
                    ? isResettingCode
                      ? "جاري حفظ الرمز..."
                      : "حفظ الرمز الجديد"
                    : isVerifying
                    ? "جاري الدخول..."
                    : "تسجيل الدخول"}
                </button>
              </form>

              <div className="premium-login-actions">
                {isResetMode ? (
                  <button
                    type="button"
                    className="premium-login-help"
                    onClick={() => {
                      setIsResetMode(false);
                      setResetToken("");
                      setForm((current) => ({ ...current, accessCode: "" }));
                      setMessage("");
                    }}
                  >
                    رجوع لتسجيل الدخول
                  </button>
                ) : (
                  <button
                    type="button"
                    className="premium-login-help"
                    onClick={requestAccessHelp}
                    disabled={isRequestingHelp}
                  >
                    {isRequestingHelp ? "جاري إرسال الرابط..." : "نسيت الرمز؟"}
                  </button>
                )}
                <button
                  type="button"
                  className="premium-login-back"
                  onClick={() => {
                    setIsLoginOnly(false);
                    setShowCheckoutForm(false);
                    setIsResetMode(false);
                    setResetToken("");
                    setMessage("");
                  }}
                >
                  عرض باقات دربك+
                </button>
              </div>
            </section>
          ) : (
            showCheckoutForm ? (
              <section className="premium-section premium-plans-section premium-account-step">
                <button
                  type="button"
                  className="premium-plans-back"
                  onClick={() => {
                    setShowCheckoutForm(false);
                    setMessage("");
                  }}
                >
                  تغيير الباقة
                </button>
                <div className="premium-section-heading">
                  <span>دربك+</span>
                  <h2 id="premium-access-title">باقي خطوة وحدة وتبدأ رحلتك 🚀</h2>
                  <p>
                    مانحتاج منك إلا إيميل ورمز دخول بسيط، بعدها تنتقل مباشرة
                    للدفع الآمن.
                  </p>
                  <ul className="premium-checkout-gains">
                    <li>وصول كامل لكل التجارب</li>
                    <li>جهات مناسبة لتخصصك</li>
                    <li>فرص تدريب محدثة باستمرار</li>
                  </ul>
                </div>

                <form
                  className="premium-access-form premium-checkout-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    startCheckout(selectedPlan);
                  }}
                >
                  <div className="premium-selected-plan-summary">
                    <span>{selectedPlan.note}</span>
                    <strong>{formatPlanPrice(selectedPlan)}</strong>
                    <small>{formatPlanDuration(selectedPlan)} · بدون تجديد تلقائي</small>
                  </div>
                  <div className="premium-access-fields">
                    <label className="premium-access-field">
                      <span>البريد الإلكتروني</span>
                      <input
                        type="text"
                        inputMode="text"
                        value={form.contact}
                        onChange={(event) =>
                          updateField("contact", event.target.value)
                        }
                        placeholder="example@email.com"
                        autoComplete="email"
                      />
                    </label>
                    <label className="premium-access-field">
                      <span>رمز الدخول</span>
                      <input
                        value={form.accessCode}
                        onChange={(event) =>
                          updateField("accessCode", event.target.value)
                        }
                        placeholder="رمز تحفظه"
                        autoComplete="one-time-code"
                        maxLength={12}
                      />
                    </label>
                  </div>
                  <span className="premium-access-code-hint">
                    مثال مناسب: Darb5 أو 2580. لا تستخدم رمزًا عامًا مثل 1111.
                  </span>
                  <button
                    type="submit"
                    className="premium-checkout-submit"
                    disabled={isStartingCheckout}
                  >
                    {isStartingCheckout
                      ? "جاري تحويلك للدفع..."
                      : "انتقل للدفع الآمن الآن"}
                  </button>
                </form>

                <PaymentMethods />

                <div className="premium-trust-card">
                  <FiShield aria-hidden="true" />
                  <div>
                    <strong>الدفع آمن عبر ميسر</strong>
                    <p>
                      تُفعّل المزايا مباشرة بعد نجاح العملية، وكل الباقات بدون
                      تجديد تلقائي داخل دربك.
                    </p>
                  </div>
                </div>

                <p className="premium-access-platform-note">
                  يدعم تفعيلك تطوير منصة دربك وإضافة مزايا جديدة وتحسين تجربة
                  المستخدم بشكل مستمر. منصة دربك تساعد طلاب التدريب التعاوني من
                  خلال تنظيم وتحليل تجارب المتدربين وتقديم أدوات رقمية تساعدهم
                  على اتخاذ قرارات أفضل.
                </p>
              </section>
            ) : (
              <section className="premium-section premium-plans-section premium-plan-picker">
                <div className="premium-section-heading">
                  <span>الاشتراك بسيط</span>
                  <h2 id="premium-access-title">
                    اختر المدة والخدمة اللي تناسب رحلتك
                  </h2>
                  <p>
                    كل الباقات بدون تجديد تلقائي.
                  </p>
                </div>

                {typeof platformStats.activeSubscribersCount === "number" &&
                  platformStats.activeSubscribersCount > 0 && (
                    <p className="premium-subscriber-badge">
                      +{platformStats.activeSubscribersCount.toLocaleString("en-US")} طالب مشترك
                    </p>
                  )}

                {plansError && (
                  <p className="premium-access-message">{plansError}</p>
                )}

                <div className="premium-plan-options" aria-label="اختيار الباقة">
                  {plansLoading ? (
                    <p className="premium-access-message">جارِ تحميل الباقات...</p>
                  ) : (
                    subscriptionPlans.map((plan) => (
                    <PremiumPlanCard
                      key={plan.id}
                      plan={plan}
                      selected={selectedPlan.id === plan.id}
                      isCurrentPlan={plan.id === currentPlanId}
                      isUpgradePlan={
                        plan.id === RESUME_PLAN_ID &&
                        Boolean(currentPlanId) &&
                        currentPlanId !== RESUME_PLAN_ID
                      }
                      loading={plansLoading || isStartingCheckout}
                      onSelect={selectPlanAndCreateAccount}
                    />
                    ))
                  )}
                </div>

                <button
                  type="button"
                  className="premium-login-switch"
                  onClick={() => {
                    setIsLoginOnly(true);
                    setMessage("");
                  }}
                >
                  لديك دربك+؟ تسجيل دخول فقط
                </button>

                <p className="premium-free-note">
                  <FiShield aria-hidden="true" />
                  <span>
                    دربك سيبقى مجانيًا، ودربك+ للمزايا الإضافية فقط. الدفع آمن
                    وبدون تجديد تلقائي.
                  </span>
                </p>
              </section>
            )
          )}
        </div>

            {message && <p className="premium-access-message">{message}</p>}
          </div>
        </div>
      )}

      {shouldRenderReminderBar && (
        <div className="subscription-reminder-bar" dir="rtl" role="status">
          <button
            type="button"
            className="subscription-reminder-bar-close"
            onClick={closeReminderBar}
            aria-label="إغلاق تذكير الاشتراك"
          >
            ×
          </button>
          <button
            type="button"
            className="subscription-reminder-bar-content"
            onClick={() => openSubscriptionFromReminder("bottom_bar")}
          >
            <span className="subscription-reminder-bar-copy">
              <strong>لا تنتظر تجربة جديدة كل يوم</strong>
              <span>افتح جميع التجارب والفرص بـ5.99 ر.س</span>
            </span>
            <em>اشترك الآن</em>
          </button>
        </div>
      )}
    </>
  );
}
