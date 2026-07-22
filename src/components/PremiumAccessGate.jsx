import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
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

const featureCopy = {
  experience_details: "المزايا الرقمية المتقدمة",
  opportunity_details: "أدوات الفرص التدريبية المتقدمة",
  opportunity_apply: "أدوات الوصول للفرص التدريبية",
};

const premiumBenefits = [
  "الوصول الكامل إلى جميع تجارب التدريب المنشورة.",
  "دليل دربك لتحليل التجارب والإجابة على أسئلتك.",
  "أدوات بحث متقدمة داخل التجارب والجهات والمدن.",
  "مقارنة الجهات التدريبية من واقع تجارب الطلاب.",
  "حفظ التجارب والجهات المفضلة والرجوع لها لاحقًا.",
  "المزايا الجديدة فور إطلاقها طوال مدة الباقة.",
];

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
    perks: ["كل مزايا دربك+", "مدة أطول", "بدون تجديد تلقائي"],
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
  const [selectedPlanId, setSelectedPlanId] = useState("one_time_90");
  const pendingActionRef = useRef(null);
  const selectedPlan =
    subscriptionPlans.find((plan) => plan.id === selectedPlanId) ||
    subscriptionPlans[0];

  useEffect(() => {
    const handlePremiumRequest = (event) => {
      if (!isPremiumGateEnabled()) return;

      pendingActionRef.current = event.detail?.onGranted || null;
      setFeature(event.detail?.feature || "");
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
    setIsOpen(false);
    setMessage("");
    setIsVerifying(false);
    setIsStartingCheckout(false);
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

    const pendingContact = pending.contact || pending.email || "";
    const pendingAccessCode = pending.accessCode || "";

    setForm({
      contact: pendingContact,
      accessCode: pendingAccessCode,
    });
    setFeature("experience_details");
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

  const startCheckout = async () => {
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
      saveAccessIdentity({
        contact: form.contact,
        accessCode: normalizeAccessCode(form.accessCode),
      });
      const { data } = await axios.post(
        `${API_BASE_URL}/api/subscriptions/start-checkout`,
        {
          email: form.contact,
          accessCode: normalizeAccessCode(form.accessCode),
          planId: selectedPlan.id,
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
          planId: selectedPlan.id,
        },
      });

      try {
        window.localStorage.setItem(
          PENDING_SUBSCRIPTION_KEY,
          JSON.stringify({
            contact: form.contact,
            accessCode: normalizeAccessCode(form.accessCode),
            planId: selectedPlan.id,
            startedAt: new Date().toISOString(),
          })
        );
      } catch {
        // The user can still enter the same contact and code manually.
      }

      if (!data.checkoutUrl) {
        setMessage("تعذر فتح رابط الدفع. جرّب مرة ثانية بعد لحظات.");
        return;
      }

      setMessage("بنقلك الآن لصفحة التفعيل الآمنة...");
      window.location.assign(data.checkoutUrl);
    } catch (err) {
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

        <div className="premium-access-layout">
          <section className="premium-access-main">
            <div className="premium-access-badge">دربك+</div>
            <h2 id="premium-access-title">فعّل المزايا المتقدمة في منصة دربك</h2>
            <p className="premium-access-lead">
              ساعدنا على تطوير المنصة واستمرارها، واحصل على وصول كامل إلى{" "}
              {featureCopy[feature] || "جميع المزايا الرقمية"} التي تساعدك
              تستفيد من تجارب التدريب بشكل أسرع وأدق.
            </p>

            <div className="premium-free-plan" aria-label="المزايا المجانية">
              <div>
                <span>مجاني</span>
                <strong>متاح دائمًا</strong>
              </div>
              <ul>
                <li>عدد محدود من التجارب يوميًا</li>
                <li>البحث الأساسي</li>
                <li>إضافة تجربة</li>
                <li>حفظ المفضلة</li>
              </ul>
            </div>

            <div className="premium-plan-options" role="radiogroup" aria-label="اختيار الباقة">
              {subscriptionPlans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  role="radio"
                  aria-checked={selectedPlan.id === plan.id}
                  className={`premium-plan-option${
                    selectedPlan.id === plan.id ? " is-selected" : ""
                  }${plan.recommended ? " is-recommended" : ""}`}
                  onClick={() => setSelectedPlanId(plan.id)}
                >
                  <span className="premium-plan-badge">{plan.badge}</span>
                  <span className="premium-plan-note">{plan.note}</span>
                  <strong>{plan.price}</strong>
                  <em>{plan.title}</em>
                  <small>{plan.description}</small>
                  <span className="premium-plan-duration">لمدة {plan.duration}</span>
                  <span className="premium-plan-perks">
                    {plan.perks.map((perk) => (
                      <span className="premium-plan-perk" key={perk}>
                        {perk}
                      </span>
                    ))}
                  </span>
                </button>
              ))}
            </div>

            <div className="premium-access-price">
              <strong>{selectedPlan.price}</strong>
              <span>دربك+ لمدة {selectedPlan.duration}</span>
            </div>

            <div className="premium-access-form">
              <p>
                استخدم بريد أو رقم جوال مع رمز دخول بسيط تحفظه. إذا كان لديك
                دربك+ سابق، اكتب نفس البيانات واضغط دخول مستخدم دربك+.
              </p>
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

            <button
              type="button"
              className="premium-access-pay-button"
              onClick={startCheckout}
              disabled={isStartingCheckout}
            >
              {isStartingCheckout
                ? "جاري تجهيز التفعيل..."
                : `فعّل دربك+ ${selectedPlan.price}`}
            </button>

            <form
              className="premium-access-verify-form"
              onSubmit={verifySubscription}
            >
              <p>لديك دربك+؟ ادخل بنفس البريد/الجوال والرمز.</p>
              <button type="submit" disabled={isVerifying}>
                {isVerifying ? "جاري الدخول..." : "دخول مستخدم دربك+"}
              </button>
            </form>

            <p className="premium-access-security">
              يدعم تفعيلك تطوير منصة دربك وإضافة مزايا جديدة وتحسين تجربة
              المستخدم بشكل مستمر. الدفع آمن عبر ميسر، وكل باقة تعمل لمدة
              محددة بدون تجديد تلقائي داخل دربك.
            </p>
          </section>

          <aside className="premium-access-benefits" aria-label="مزايا دربك بلس">
            <p className="premium-access-benefits-kicker">ماذا ستحصل عليه؟</p>
            <ul>
              {premiumBenefits.map((benefit) => (
                <li key={benefit}>{benefit}</li>
              ))}
            </ul>
            <div className="premium-access-payments" aria-label="طرق الدفع">
              <span className="payment-logo payment-logo-apple">
                <strong>Pay</strong>
              </span>
              <span className="payment-logo payment-logo-mada">
                <strong>mada</strong>
              </span>
              <span className="payment-logo payment-logo-card">
                <strong>VISA</strong>
                <em>MC</em>
              </span>
            </div>
            <p className="premium-access-platform-note">
              منصة دربك هي منصة إلكترونية مطورة لمساعدة طلاب التدريب التعاوني
              من خلال تنظيم وتحليل تجارب المتدربين وتقديم أدوات رقمية تساعدهم
              على اتخاذ قرارات أفضل.
            </p>
          </aside>
        </div>

            {message && <p className="premium-access-message">{message}</p>}
          </div>
        </div>
      )}
    </>
  );
}
