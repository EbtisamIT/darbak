import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  FiBookmark,
  FiBarChart2,
  FiCheck,
  FiCreditCard,
  FiLock,
  FiMessageSquare,
  FiSearch,
  FiShield,
  FiUnlock,
  FiZap,
} from "react-icons/fi";
import API_BASE_URL from "../config/api";
import {
  PREMIUM_ACCESS_EVENT,
  isPremiumGateEnabled,
  saveAccessIdentity,
  savePremiumPass,
} from "../utils/premiumAccess";
import { trackEvent } from "../utils/analytics";

const initialForm = {
  contact: "",
  accessCode: "",
};

const PENDING_SUBSCRIPTION_KEY = "darbak_pending_subscription_v1";

const premiumBenefits = [
  {
    icon: FiLock,
    title: "جميع تفاصيل التجارب",
    description: "اقرأ التفاصيل الكاملة للتجارب بدون اختصار.",
  },
  {
    icon: FiMessageSquare,
    title: "أسئلة المقابلات الحقيقية",
    description: "اطلع على الأسئلة التي شاركها الطلاب حسب الجهة والتخصص.",
  },
  {
    icon: FiSearch,
    title: "بحث وفلاتر متقدمة",
    description: "ابحث بالتخصص، المدينة، الجهة، المكافأة، وبيئة التدريب.",
  },
  {
    icon: FiBarChart2,
    title: "مقارنة الجهات التدريبية",
    description: "وازن بين الجهات من واقع التجارب والملاحظات المنشورة.",
  },
  {
    icon: FiBookmark,
    title: "حفظ التجارب والجهات",
    description: "ارجع لما يهمك لاحقًا من صفحة المتابعات.",
  },
  {
    icon: FiZap,
    title: "المزايا الجديدة فور إطلاقها",
    description: "أي تحسينات رقمية جديدة تصل لك طوال مدة الباقة.",
  },
];

const lockedExperienceDetails = [
  "المكافأة",
  "أسئلة المقابلة",
  "طريقة التقديم",
  "مدة الرد",
];

const formatPlusStat = (value) =>
  typeof value === "number" ? `${value.toLocaleString("en-US")}+` : "جار التحميل";

const PremiumStat = ({ value, label }) => (
  <div className="premium-landing-stat">
    <strong>{value}</strong>
    <span>{label}</span>
  </div>
);

const LockedExperiencePreview = () => (
  <aside className="premium-example-card" aria-label="مثال تجربة مقفلة">
    <div className="premium-example-head">
      <span>مثال من التجارب</span>
      <strong>تجربة تدريب في شركة تقنية</strong>
      <small>التخصص: علوم الحاسب · المدينة: الرياض</small>
    </div>

    <div className="premium-locked-list">
      {lockedExperienceDetails.map((detail) => (
        <div className="premium-locked-row" key={detail}>
          <span className="premium-lock-icon" aria-hidden="true">
            <FiUnlock />
          </span>
          <div>
            <strong>{detail}</strong>
            <small>للمشتركين فقط</small>
          </div>
        </div>
      ))}
    </div>

    <div className="premium-example-lock-note">
      <FiUnlock aria-hidden="true" />
      <span>فعّل دربك+ لرؤية جميع التفاصيل.</span>
    </div>
  </aside>
);

const PremiumBenefitCard = ({ benefit }) => {
  const Icon = benefit.icon;

  return (
    <article className="premium-benefit-card">
      <span className="premium-benefit-icon" aria-hidden="true">
        <Icon />
      </span>
      <h3>{benefit.title}</h3>
      <p>{benefit.description}</p>
    </article>
  );
};

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

const isValidContact = (value = "") => {
  const trimmed = normalizeArabicDigits(value).trim();
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed.toLowerCase());
  const digits = trimmed.replace(/[^\d+]/g, "");
  const number = digits.startsWith("+") ? digits : digits.replace(/^\+?/, "");
  const isSaudiMobile =
    /^\+9665\d{8}$/.test(digits) ||
    /^9665\d{8}$/.test(number) ||
    /^05\d{8}$/.test(number) ||
    /^5\d{8}$/.test(number);

  return isEmail || isSaudiMobile;
};

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
      const accessStatus = event.detail?.accessStatus || {};
      setMessage(
        accessStatus.reason === "daily_limit"
          ? accessStatus.message ||
              "استخدمت المشاهدة المجانية اليوم. فعّل دربك+ للوصول الكامل لبقية التفاصيل."
          : ""
      );
      setIsOpen(true);
      trackEvent("premium_gate_opened", {
        metadata: {
          feature: event.detail?.feature || "",
          title: event.detail?.title || "",
          source: event.detail?.source || "",
        },
      });
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
    trackEvent("premium_access_verified", {
      metadata: { feature },
    });

    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    if (typeof action === "function") action();
  }, [feature]);

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
      setMessage("اكتب بريد إلكتروني صحيح أو رقم جوال سعودي قبل التحقق.");
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
      setMessage("اكتب البريد أو رقم الجوال المستخدم في دربك+ أولًا.");
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

    trackEvent("premium_payment_returned", {
      metadata: { source: "moyasar_return" },
    });

    let pending = {};
    try {
      pending = JSON.parse(
        window.localStorage.getItem(PENDING_SUBSCRIPTION_KEY) || "{}"
      );
    } catch {
      // Ignore malformed pending checkout data.
    }

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
      "تم الرجوع من صفحة الدفع. اكتب نفس البريد أو رقم الجوال والرمز لتفعيل دربك+."
    );
  }, [verifyAccess]);

  const startCheckout = async (checkoutPlan = selectedPlan) => {
    if (!isValidContact(form.contact)) {
      setMessage("اكتب بريد إلكتروني صحيح أو رقم جوال سعودي عشان نحفظ وصولك لدربك+.");
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
        }
      );

      if (data.active) {
        grantAccess(data);
        return;
      }

      trackEvent("premium_checkout_started", {
        metadata: {
          feature,
          hasContact: Boolean(form.contact.trim()),
          planId: checkoutPlan.id,
        },
      });

      try {
        window.localStorage.setItem(
          PENDING_SUBSCRIPTION_KEY,
          JSON.stringify({
            contact: form.contact,
            accessCode: normalizeAccessCode(form.accessCode),
            planId: checkoutPlan.id,
            startedAt: new Date().toISOString(),
          })
        );
      } catch {
        // The user can still enter the same contact and code manually.
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
                ادخل بنفس البريد أو رقم الجوال والرمز الذي استخدمته وقت التفعيل.
              </p>

              <div className="premium-access-form">
                <div className="premium-access-fields">
                  <label className="premium-access-field">
                    <span>البريد أو رقم الجوال</span>
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
                    setMessage("");
                  }}
                >
                  عرض باقات دربك+
                </button>
              </div>
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
                    اعرف كل ما تحتاجه قبل التقديم على التدريب
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

                <LockedExperiencePreview />
              </section>

              <section className="premium-section">
                <div className="premium-section-heading">
                  <span>مزايا رقمية</span>
                  <h3>ماذا ستحصل مع دربك+؟</h3>
                </div>
                <div className="premium-benefits-grid">
                  {premiumBenefits.map((benefit) => (
                    <PremiumBenefitCard key={benefit.title} benefit={benefit} />
                  ))}
                </div>
              </section>

              <div className="premium-plans-divider" aria-hidden="true">
                <span>اكتشف الباقات</span>
              </div>

              <section className="premium-section premium-plans-section">
                <div className="premium-section-heading">
                  <span>دربك+</span>
                  <h3>اختر الباقة المناسبة لك</h3>
                  <p>
                    استخدم بريد أو رقم جوال مع رمز دخول بسيط تحفظه لضمان وصولك
                    من أي جهاز طوال مدة الباقة.
                  </p>
                </div>

                <div className="premium-access-form">
                  <div className="premium-access-fields">
                    <label className="premium-access-field">
                      <span>البريد أو رقم الجوال</span>
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
                        trackEvent("premium_plan_selected", {
                          metadata: { feature, planId: plan.id },
                        });
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
                  <p>لديك دربك+؟ ادخل بنفس البريد/الجوال والرمز.</p>
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
            </>
          )}
        </div>

            {message && <p className="premium-access-message">{message}</p>}
          </div>
        </div>
      )}
    </>
  );
}
