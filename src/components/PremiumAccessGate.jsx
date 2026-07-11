import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import API_BASE_URL from "../config/api";
import {
  PREMIUM_ACCESS_EVENT,
  savePremiumPass,
} from "../utils/premiumAccess";
import { trackEvent } from "../utils/analytics";

const initialForm = {
  email: "",
  accessCode: "",
};

const featureCopy = {
  experience_details: "تفاصيل التجربة الكاملة",
  opportunity_details: "تفاصيل فرصة التدريب",
  opportunity_apply: "رابط التقديم المباشر",
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

    if (!form.email.trim() || !form.accessCode.trim()) {
      setMessage("اكتب البريد والرمز عشان نتحقق من اشتراكك.");
      return;
    }

    try {
      setIsVerifying(true);
      setMessage("");
      const { data } = await axios.post(`${API_BASE_URL}/api/subscriptions/verify`, {
        email: form.email,
        accessCode: form.accessCode,
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
    try {
      setIsStartingCheckout(true);
      setMessage("");
      const { data } = await axios.post(
        `${API_BASE_URL}/api/subscriptions/start-checkout`,
        { email: form.email }
      );

      trackEvent("premium_checkout_started", {
        metadata: { feature, hasEmail: Boolean(form.email.trim()) },
      });

      window.open(data.checkoutUrl, "_blank", "noopener,noreferrer");
      setMessage("بعد الدفع ارجع هنا واكتب البريد والرمز لتفعيل الوصول.");
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

        <div className="premium-access-badge">اشتراك دربك</div>
        <h2 id="premium-access-title">باقي تكّة على تدريبك</h2>
        <p className="premium-access-lead">
          افتح {featureCopy[feature] || "المميزات المتقدمة"} وروابط التقديم
          المباشرة وتجارب ونصائح المتدربين السابقين لمدة شهر كامل.
        </p>

        <div className="premium-access-price">
          <strong>5 ريال</strong>
          <span>لشهر كامل</span>
        </div>

        <div className="premium-access-payments" aria-label="طرق الدفع">
          <span>Apple Pay</span>
          <span>مدى</span>
          <span>دفع آمن</span>
        </div>

        <button
          type="button"
          className="premium-access-pay-button"
          onClick={startCheckout}
          disabled={isStartingCheckout}
        >
          {isStartingCheckout ? "جاري فتح الدفع..." : "اشترك وافتح الوصول"}
        </button>

        <p className="premium-access-security">
          الاشتراك آمن ويفتح لك مميزات المنصة والتحديثات لمدة 30 يوم.
        </p>

        <form className="premium-access-form" onSubmit={verifySubscription}>
          <p>
            لضمان اشتراكك 30 يوم والوصول له من أي جهاز، اكتب البريد والرمز
            بعد الدفع.
          </p>
          <div className="premium-access-fields">
            <input
              type="email"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
              placeholder="البريد الإلكتروني"
            />
            <input
              value={form.accessCode}
              onChange={(event) =>
                updateField("accessCode", event.target.value)
              }
              placeholder="الرمز"
            />
          </div>
          <button type="submit" disabled={isVerifying}>
            {isVerifying ? "جاري التحقق..." : "تفعيل اشتراكي"}
          </button>
        </form>

        {message && <p className="premium-access-message">{message}</p>}
      </div>
    </div>
  );
}
