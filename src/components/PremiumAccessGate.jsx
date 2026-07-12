import React, { useEffect, useRef, useState } from "react";
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
  "تجارب ونصائح المتدربين السابقين",
  "روابط تقديم مباشرة للجهات والفرص",
  "وصول 30 يوم من أي جهاز بنفس البيانات",
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
  const pendingActionRef = useRef(null);

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

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("subscription") !== "success") return;

    try {
      const pending = JSON.parse(
        window.localStorage.getItem(PENDING_SUBSCRIPTION_KEY) || "{}"
      );
      setForm({
        contact: pending.contact || pending.email || "",
        accessCode: pending.accessCode || "",
      });
    } catch {
      // Ignore malformed pending checkout data.
    }

    setFeature("experience_details");
    setMessage("تم الرجوع من صفحة الدفع. اضغط تفعيل اشتراكي لإكمال الوصول.");
    setIsOpen(true);

    params.delete("subscription");
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${
      nextSearch ? `?${nextSearch}` : ""
    }${window.location.hash || ""}`;
    window.history.replaceState({}, "", nextUrl);
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

  const grantAccess = (subscription) => {
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
  };

  const verifySubscription = async (event) => {
    event.preventDefault();

    if (!isValidContact(form.contact)) {
      setMessage("اكتب بريد إلكتروني صحيح أو رقم جوال سعودي قبل التحقق.");
      return;
    }

    if (!isValidAccessCode(form.accessCode)) {
      setMessage("اكتب رمز دخول بسيط من 4 إلى 12 رقم أو حرف إنجليزي.");
      return;
    }

    try {
      setIsVerifying(true);
      setMessage("");
      const { data } = await axios.post(`${API_BASE_URL}/api/subscriptions/verify`, {
        email: form.contact,
        accessCode: normalizeAccessCode(form.accessCode),
      });
      grantAccess(data);
    } catch (err) {
      setMessage(
        err.response?.data?.error || "تعذر التحقق من الاشتراك حاليًا."
      );
    } finally {
      setIsVerifying(false);
    }
  };

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
          returnUrl: window.location.href,
        }
      );

      if (data.active) {
        grantAccess(data);
        return;
      }

      trackEvent("premium_checkout_started", {
        metadata: { feature, hasContact: Boolean(form.contact.trim()) },
      });

      try {
        window.localStorage.setItem(
          PENDING_SUBSCRIPTION_KEY,
          JSON.stringify({
            contact: form.contact,
            accessCode: normalizeAccessCode(form.accessCode),
            startedAt: new Date().toISOString(),
          })
        );
      } catch {
        // The user can still enter the same contact and code manually.
      }

      window.open(data.checkoutUrl, "_blank", "noopener,noreferrer");
      setMessage("بعد الدفع ارجع هنا واضغط تفعيل اشتراكي بنفس البريد أو الجوال والرمز.");
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
              المباشرة لمدة شهر كامل.
            </p>

            <div className="premium-access-price">
              <strong>5 ريال</strong>
              <span>وصول كامل لمدة 30 يوم</span>
            </div>

            <div className="premium-access-form">
              <p>
                استخدم بريد أو رقم جوال مع رمز دخول بسيط تحفظه. الرمز ليس كلمة
                مرور، فقط طريقة لاسترجاع اشتراكك من أي جهاز.
              </p>
              <div className="premium-access-fields">
                <input
                  type="text"
                  inputMode="text"
                  value={form.contact}
                  onChange={(event) =>
                    updateField("contact", event.target.value)
                  }
                  placeholder="البريد أو رقم الجوال"
                  autoComplete="email"
                />
                <input
                  value={form.accessCode}
                  onChange={(event) =>
                    updateField("accessCode", event.target.value)
                  }
                  placeholder="رمز دخول"
                  autoComplete="one-time-code"
                  maxLength={12}
                />
              </div>
              <span className="premium-access-code-hint">
                مثال مناسب: Darb5 أو 2580، من 4 إلى 12 رقم/حرف.
              </span>
            </div>

            <button
              type="button"
              className="premium-access-pay-button"
              onClick={startCheckout}
              disabled={isStartingCheckout}
            >
              {isStartingCheckout ? "جاري فتح الدفع..." : "اشترك وافتح الوصول"}
            </button>

            <form
              className="premium-access-verify-form"
              onSubmit={verifySubscription}
            >
              <p>دفعت؟ فعّل الاشتراك بنفس البيانات.</p>
              <button type="submit" disabled={isVerifying}>
                {isVerifying ? "جاري التحقق..." : "تفعيل اشتراكي"}
              </button>
            </form>

            <p className="premium-access-security">
              الدفع آمن عبر ميسر، وبياناتك تستخدم فقط لحفظ الاشتراك.
            </p>
          </section>

          <aside className="premium-access-benefits" aria-label="مزايا الاشتراك">
            <p className="premium-access-benefits-kicker">وش يفتح لك؟</p>
            <ul>
              {premiumBenefits.map((benefit) => (
                <li key={benefit}>{benefit}</li>
              ))}
            </ul>
            <div className="premium-access-payments" aria-label="طرق الدفع">
              <span>Apple Pay</span>
              <span>مدى</span>
              <span>بطاقة بنكية</span>
            </div>
          </aside>
        </div>

        {message && <p className="premium-access-message">{message}</p>}
      </div>
    </div>
  );
}
