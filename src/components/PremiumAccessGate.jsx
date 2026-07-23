import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  FiCheck,
  FiCreditCard,
  FiShield,
  FiUnlock,
} from "react-icons/fi";
import API_BASE_URL from "../config/api";
import {
  PREMIUM_ACCESS_EVENT,
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

const premiumBenefitDetails = [
  {
    title: "جميع تفاصيل التجارب",
    description: "اقرأ التجارب كاملة بدون اختصار.",
  },
  {
    title: "أسئلة المقابلات الحقيقية",
    description: "اعرف الأسئلة التي واجهها الطلاب في الجهات التدريبية.",
  },
  {
    title: "ابحث بذكاء",
    description: "حسب المدينة، التخصص، الجهة، المكافأة وغيرها.",
  },
  {
    title: "قارن بين الجهات",
    description: "اعرف أي جهة تناسبك قبل التقديم.",
  },
  {
    title: "احفظ التجارب",
    description: "ارجع لها في أي وقت.",
  },
  {
    title: "كل المزايا الجديدة أولاً",
    description: "أي ميزة جديدة داخل دربك ستكون متوفرة لك مباشرة.",
  },
];

const formatPlusStat = (value) =>
  typeof value === "number" ? `${value.toLocaleString("en-US")}+` : "جار التحميل";

const PremiumStat = ({ value, label }) => (
  <div className="premium-landing-stat">
    <strong>{value}</strong>
    <span>{label}</span>
  </div>
);

const PremiumBenefitsPanel = () => (
  <aside className="premium-benefits-panel" aria-label="مزايا دربك بلس">
    <h3>✨ ماذا ستحصل؟</h3>
    <ul>
      {premiumBenefitDetails.map((benefit) => (
        <li key={benefit.title}>
          <span className="premium-benefit-check" aria-hidden="true">
            <FiUnlock />
          </span>
          <div>
            <strong>{benefit.title}</strong>
            <p>{benefit.description}</p>
          </div>
        </li>
      ))}
    </ul>
  </aside>
);

const PremiumPlanCard = ({
  plan,
  selected,
  onSelect,
  onCheckout,
  loading,
}) => (
  <article className={`premium-plan-card${selected ? " is-selected" : ""}`}>
    {plan.recommended && <span className="premium-plan-ribbon">أفضل قيمة</span>}
    <div className="premium-plan-card-head">
      <span>{plan.note}</span>
      <h3>{plan.title}</h3>
      <p>{plan.description}</p>
    </div>
    <div className="premium-plan-price">
      <strong>{plan.price.replace(" ريال", "")}</strong>
      <span>ريال</span>
      <small>{plan.duration}</small>
    </div>
    <ul>
      {plan.perks.map((perk) => (
        <li key={perk}>
          <FiCheck aria-hidden="true" />
          <span>{perk}</span>
        </li>
      ))}
      <li>
        <FiCheck aria-hidden="true" />
        <span>بدون تجديد تلقائي</span>
      </li>
    </ul>
    <button
      type="button"
      className="premium-plan-cta"
      onClick={() => {
        onSelect();
        onCheckout(plan);
      }}
      disabled={loading}
    >
      {loading ? "جاري تجهيز الدفع..." : plan.id === "monthly" ? "اشترك الآن" : "اشترك 3 أشهر"}
    </button>
  </article>
);

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

const subscriptionPlans = [
  {
    id: "monthly",
    title: "دربك+",
    price: "5.99 ريال",
    duration: "شهر",
    description: "وصول كامل للمزايا الرقمية المتقدمة لمدة شهر.",
    badge: "شهري",
    note: "مناسب للتجربة السريعة",
    perks: ["وصول كامل", "مساعد دربك", "بحث متقدم"],
  },
  {
    id: "one_time_90",
    title: "دربك+ 3 أشهر",
    price: "15 ريال",
    duration: "3 أشهر",
    description: "نفس المزايا لمدة أطول تناسب موسم البحث والتقديم.",
    badge: "الأفضل",
    note: "الأفضل لموسم التدريب",
    recommended: true,
    perks: ["كل مزايا دربك+", "مدة أطول", "أنسب لفترة البحث والتقديم"],
  },
];

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

export default function PremiumAccessGate() {
  const [isOpen, setIsOpen] = useState(false);
  const [feature, setFeature] = useState("");
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [successNotice, setSuccessNotice] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [isRequestingHelp, setIsRequestingHelp] = useState(false);
  const [isLoginOnly, setIsLoginOnly] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("one_time_90");
  const [platformStats, setPlatformStats] = useState({
    experiencesCount: null,
    organizationsCount: null,
  });
  const pendingActionRef = useRef(null);
  const selectedPlan =
    subscriptionPlans.find((plan) => plan.id === selectedPlanId) ||
    subscriptionPlans[0];

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
          organizationsCount: Array.isArray(data.organizationNames)
            ? data.organizationNames.filter(Boolean).length
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
    const handlePremiumRequest = (event) => {
      if (!isPremiumGateEnabled()) return;

      pendingActionRef.current = event.detail?.onGranted || null;
      setFeature(event.detail?.feature || "");
      setIsLoginOnly(Boolean(event.detail?.loginOnly));
      setShowPlans(false);
      const accessStatus = event.detail?.accessStatus || {};
      setMessage(
        accessStatus.reason === "daily_limit"
          ? accessStatus.message ||
              "استخدمت المشاهدة المجانية اليوم. فعّل دربك+ للوصول الكامل لبقية التفاصيل."
          : ""
      );
      setIsOpen(true);
      const gateType = event.detail?.loginOnly ? "login_only" : "premium_gate";
      if (gateType === "premium_gate") {
        trackEventOncePerSession(
          "premium_gate_opened",
          {
            metadata: {
              feature: event.detail?.feature || "",
              title: event.detail?.title || "",
              source: event.detail?.source || "",
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
  }, []);

  const closeGate = () => {
    if (isOpen) {
      trackEvent("premium_gate_closed", {
        metadata: {
          feature,
          source: isLoginOnly ? "login_only" : "premium_gate",
          planId: selectedPlan.id,
        },
      });
    }
    setIsOpen(false);
    setMessage("");
    setIsVerifying(false);
    setIsStartingCheckout(false);
    setIsRequestingHelp(false);
    setIsLoginOnly(false);
    setShowPlans(false);
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
    if (!isValidContact(form.contact)) {
      setMessage("اكتب البريد الإلكتروني أو رقم الجوال المستخدم سابقًا في دربك+ أولًا.");
      return;
    }

    try {
      setIsRequestingHelp(true);
      setMessage("");
      const { data } = await axios.post(
        `${API_BASE_URL}/api/subscriptions/request-access-help`,
        { contact: form.contact }
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

  const startCheckout = async (checkoutPlan = selectedPlan) => {
    if (!isValidContact(form.contact)) {
      setMessage("اكتب بريدًا إلكترونيًا صحيحًا، أو رقم الجوال إذا كان لديك حساب سابق في دربك+.");
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
      trackEventOnceLocal(
        "premium_checkout_started",
        {
          metadata: {
            feature,
            hasContact: Boolean(form.contact.trim()),
            planId: checkoutPlan.id,
            provider: data.provider || "",
            providerPaymentId: data.invoiceId || data.providerPaymentId || "",
          },
        },
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

  if (!isOpen && !successNotice) return null;

  return (
    <>
      {successNotice && (
        <div className="premium-success-toast" role="status" dir="rtl">
          <strong>دربك+ فعال الآن</strong>
          <span>{successNotice}</span>
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
              <h2 id="premium-access-title">تسجيل الدخول إلى دربك+</h2>
              <p className="premium-access-lead">
                ادخل بنفس البريد الإلكتروني أو رقم الجوال الذي استخدمته سابقًا، مع رمز الدخول.
              </p>

              <div className="premium-access-form">
                <div className="premium-access-fields">
                  <label className="premium-access-field">
                    <span>البريد الإلكتروني أو رقم جوال لحساب سابق</span>
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
              </div>

              <form
                className="premium-access-verify-form"
                onSubmit={verifySubscription}
              >
                <p>سيتم التحقق من حسابك وفتح المزايا مباشرة.</p>
                <button type="submit" disabled={isVerifying}>
                  {isVerifying ? "جاري الدخول..." : "تسجيل الدخول"}
                </button>
              </form>

              <div className="premium-login-actions">
                <button
                  type="button"
                  className="premium-login-help"
                  onClick={requestAccessHelp}
                  disabled={isRequestingHelp}
                >
                  {isRequestingHelp ? "جاري إرسال الطلب..." : "نسيت الرمز؟"}
                </button>
                <button
                  type="button"
                  className="premium-login-back"
                  onClick={() => {
                    setIsLoginOnly(false);
                    setShowPlans(true);
                    setMessage("");
                  }}
                >
                  عرض باقات دربك+
                </button>
              </div>
            </section>
          ) : (
            showPlans ? (
              <section className="premium-section premium-plans-section">
                <button
                  type="button"
                  className="premium-plans-back"
                  onClick={() => {
                    setShowPlans(false);
                    setMessage("");
                  }}
                >
                  رجوع للمزايا
                </button>
                <div className="premium-section-heading">
                  <span>دربك+</span>
                  <h3>اختر الباقة المناسبة لك</h3>
                  <p>
                    للاشتراك الجديد استخدم بريدًا إلكترونيًا مع رمز دخول بسيط.
                    رقم الجوال يعمل فقط للحسابات السابقة.
                  </p>
                </div>

                <div className="premium-access-form">
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
                </div>

                <div className="premium-plan-options" aria-label="اختيار الباقة">
                  {subscriptionPlans.map((plan) => (
                    <PremiumPlanCard
                      key={plan.id}
                      plan={plan}
                      selected={selectedPlan.id === plan.id}
                      loading={isStartingCheckout && selectedPlan.id === plan.id}
                      onSelect={() => {
                        setSelectedPlanId(plan.id);
                        trackEventOncePerSession(
                          "premium_plan_selected",
                          {
                            metadata: { feature, planId: plan.id },
                          },
                          plan.id
                        );
                      }}
                      onCheckout={startCheckout}
                    />
                  ))}
                </div>

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

                <form
                  className="premium-access-verify-form"
                  onSubmit={verifySubscription}
                >
                  <p>لديك دربك+؟ ادخل بنفس البريد الإلكتروني أو رقم الجوال القديم والرمز.</p>
                  <button type="submit" disabled={isVerifying}>
                    {isVerifying ? "جاري الدخول..." : "دخول مستخدم دربك+"}
                  </button>
                </form>

                <p className="premium-access-platform-note">
                  يدعم تفعيلك تطوير منصة دربك وإضافة مزايا جديدة وتحسين تجربة
                  المستخدم بشكل مستمر. منصة دربك تساعد طلاب التدريب التعاوني من
                  خلال تنظيم وتحليل تجارب المتدربين وتقديم أدوات رقمية تساعدهم
                  على اتخاذ قرارات أفضل.
                </p>
              </section>
            ) : (
              <>
              <section className="premium-landing-hero">
                <div className="premium-hero-copy">
                  <span className="premium-access-badge">
                    <span className="premium-student-mark" aria-hidden="true">
                      🎓
                    </span>
                    <span>دربك+</span>
                  </span>
                  <h2 id="premium-access-title">
                    اعرف كل ما تحتاجه قبل التقديم على التدريب{" "}
                    <span className="premium-title-price">بـ 5.99 ريال فقط</span>
                  </h2>
                  <p className="premium-access-lead">
                    وصول كامل إلى تجارب المتدربين الحقيقية وأدوات ذكية تساعدك
                    تتخذ قرارك بثقة.
                  </p>

                  <div className="premium-landing-stats" aria-label="أرقام دربك">
                    <PremiumStat
                      value={formatPlusStat(platformStats.experiencesCount)}
                      label="تجربة منشورة"
                    />
                    <PremiumStat
                      value={formatPlusStat(platformStats.organizationsCount)}
                      label="جهة تدريبية"
                    />
                  </div>

                  <p className="premium-free-note">
                    <FiShield aria-hidden="true" />
                    <span>
                      دربك سيبقى مجانيًا للجميع، ودربك+ للمزايا الإضافية فقط.
                    </span>
                  </p>

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
                </div>

                <PremiumBenefitsPanel />
              </section>

              <div className="premium-discover-block">
                <span>جاهز تعرف الباقة الأنسب لك؟</span>
                <button
                  type="button"
                  className="premium-discover-button"
                  onClick={() => {
                    setShowPlans(true);
                    setMessage("");
                    trackEvent("premium_discover_plans_clicked", {
                      metadata: { feature },
                    });
                  }}
                >
                  اكتشف الباقات
                </button>
              </div>
              </>
            )
          )}
        </div>

            {message && <p className="premium-access-message">{message}</p>}
          </div>
        </div>
      )}
    </>
  );
}
