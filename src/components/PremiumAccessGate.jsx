import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import API_BASE_URL from "../config/api";
import {
  PREMIUM_ACCESS_EVENT,
  savePremiumPass,
} from "../utils/premiumAccess";
import { trackEvent } from "../utils/analytics";

const initialForm = {
  contact: "",
  accessCode: "",
};

const PENDING_SUBSCRIPTION_KEY = "darbak_pending_subscription_v1";

const featureCopy = {
  experience_details: "تفاصيل التجربة الكاملة",
  opportunity_details: "تفاصيل فرصة التدريب",
  opportunity_apply: "رابط التقديم المباشر",
};

const premiumBenefits = [
  "افتح التفاصيل اللي تختصر عليك سؤال القروبات",
  "روابط تقديم وجهات مناسبة بدون تدوير طويل",
  "احفظ التجارب والجهات اللي تهمك وارجع لها لاحقًا",
  "وصول من أي جهاز بنفس بياناتك طوال مدة الباقة",
];

const subscriptionPlans = [
  {
    id: "monthly",
    title: "وصول شهر",
    price: "5 ريال",
    duration: "30 يوم",
    description: "مناسب إذا تبغى تجربة سريعة وبأخف تكلفة.",
    badge: "مرن",
  },
  {
    id: "one_time_90",
    title: "دفعة واحدة",
    price: "10 ريال",
    duration: "3 أشهر",
    description: "يغطي موسم البحث والتقديم بدون قلق تجديد.",
    badge: "الأفضل للطلاب",
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
  const [isVerifying, setIsVerifying] = useState(false);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("one_time_90");
  const pendingActionRef = useRef(null);
  const selectedPlan =
    subscriptionPlans.find((plan) => plan.id === selectedPlanId) ||
    subscriptionPlans[0];

  useEffect(() => {
    const handlePremiumRequest = (event) => {
      pendingActionRef.current = event.detail?.onGranted || null;
      setFeature(event.detail?.feature || "");
      setMessage("");
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
    trackEvent("premium_access_verified", {
      metadata: { feature },
    });

    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    if (typeof action === "function") action();
  }, [feature]);

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
      setMessage(options.auto ? "جاري تفعيل اشتراكك..." : "");
      const { data } = await axios.post(`${API_BASE_URL}/api/subscriptions/verify`, {
        email: contactValue,
        accessCode: normalizedCode,
      });
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

    setMessage("تم الرجوع من صفحة الدفع. اكتب بيانات الاشتراك لتفعيل الوصول.");
  }, [verifyAccess]);

  const startCheckout = async () => {
    if (!isValidContact(form.contact)) {
      setMessage("اكتب بريد إلكتروني صحيح أو رقم جوال سعودي عشان نحفظ اشتراكك.");
      return;
    }

    if (!isValidAccessCode(form.accessCode)) {
      setMessage("اختَر رمز دخول من 4 إلى 12 رقم أو حرف إنجليزي، بدون تكرار كامل.");
      return;
    }

    try {
      setIsStartingCheckout(true);
      setMessage("");
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

      setMessage("بنقلك الآن لصفحة الدفع الآمنة...");
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

  if (!isOpen) return null;

  return (
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
            <div className="premium-access-badge">اشتراك دربك</div>
            <h2 id="premium-access-title">باقي خطوة وتفتح الطريق</h2>
            <p className="premium-access-lead">
              افتح {featureCopy[feature] || "المميزات المتقدمة"} وروابط التقديم
              المباشرة بالمدة اللي تناسبك.
            </p>

            <div className="premium-plan-options" role="radiogroup" aria-label="اختيار الباقة">
              {subscriptionPlans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  role="radio"
                  aria-checked={selectedPlan.id === plan.id}
                  className={`premium-plan-option${
                    selectedPlan.id === plan.id ? " is-selected" : ""
                  }`}
                  onClick={() => setSelectedPlanId(plan.id)}
                >
                  <span className="premium-plan-badge">{plan.badge}</span>
                  <strong>{plan.price}</strong>
                  <em>{plan.title}</em>
                  <small>{plan.description}</small>
                </button>
              ))}
            </div>

            <div className="premium-access-price">
              <strong>{selectedPlan.price}</strong>
              <span>وصول كامل لمدة {selectedPlan.duration}</span>
            </div>

            <div className="premium-access-form">
              <p>
                استخدم بريد أو رقم جوال مع رمز دخول بسيط تحفظه. إذا كان لديك
                اشتراك سابق، اكتب نفس البيانات واضغط دخول مشترك سابق.
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
                ? "جاري فتح الدفع..."
                : `ادفع ${selectedPlan.price} وافتح الوصول`}
            </button>

            <form
              className="premium-access-verify-form"
              onSubmit={verifySubscription}
            >
              <p>مشترك سابق؟ ادخل بنفس البريد/الجوال والرمز.</p>
              <button type="submit" disabled={isVerifying}>
                {isVerifying ? "جاري الدخول..." : "دخول مشترك سابق"}
              </button>
            </form>

            <p className="premium-access-security">
              الدفع آمن عبر ميسر، وكل خيار يفتح المدة المحددة بدون تجديد تلقائي داخل دربك.
            </p>
          </section>

          <aside className="premium-access-benefits" aria-label="مزايا الاشتراك">
            <p className="premium-access-benefits-kicker">اشتراك صغير، فرق كبير</p>
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
          </aside>
        </div>

        {message && <p className="premium-access-message">{message}</p>}
      </div>
    </div>
  );
}
