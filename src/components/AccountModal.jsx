import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import API_BASE_URL from "../config/api";
import {
  ACCOUNT_MODAL_EVENT,
  PREMIUM_ACCESS_EVENT,
  getStoredAccessIdentity,
  getStoredPremiumPass,
  isPremiumGateEnabled,
  savePremiumPass,
} from "../utils/premiumAccess";
import { trackEvent } from "../utils/analytics";

const formatDate = (value) => {
  if (!value) return "غير محدد";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "غير محدد";

  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

export default function AccountModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [identity, setIdentity] = useState({});
  const [pass, setPass] = useState(null);
  const [message, setMessage] = useState("");
  const [checking, setChecking] = useState(false);
  const [premiumGateVisible, setPremiumGateVisible] = useState(false);

  const status = useMemo(() => {
    if (pass?.isAdmin) return "admin";
    if (pass?.expiresAt && new Date(pass.expiresAt) > new Date()) return "active";
    return "free";
  }, [pass]);

  const openModal = () => {
    setIdentity(getStoredAccessIdentity());
    setPass(getStoredPremiumPass());
    setPremiumGateVisible(isPremiumGateEnabled());
    setMessage("");
    setIsOpen(true);
    trackEvent("account_modal_opened");
  };

  useEffect(() => {
    window.addEventListener(ACCOUNT_MODAL_EVENT, openModal);
    return () => window.removeEventListener(ACCOUNT_MODAL_EVENT, openModal);
  }, []);

  const closeModal = () => {
    setIsOpen(false);
    setMessage("");
  };

  const openPremiumGate = () => {
    setIsOpen(false);
    window.dispatchEvent(
      new CustomEvent(PREMIUM_ACCESS_EVENT, {
        detail: {
          feature: "account",
          title: "حسابي",
          source: "account_modal",
        },
      })
    );
  };

  const refreshSubscription = async () => {
    const contact = identity.contact || identity.email || "";
    const accessCode = identity.accessCode || "";

    if (!contact || !accessCode) {
      setMessage("لا توجد بيانات دخول محفوظة. فعّل دربك+ أو ادخل بنفس بياناتك أولًا.");
      return;
    }

    try {
      setChecking(true);
      setMessage("");
      const { data } = await axios.post(`${API_BASE_URL}/api/subscriptions/verify`, {
        email: contact,
        accessCode,
      });
      savePremiumPass(data);
      setPass(getStoredPremiumPass());
      setMessage("تم تحديث حالة حسابك.");
    } catch (err) {
      setPass(null);
      setMessage(err.response?.data?.error || "لم يتم العثور على اشتراك فعال بهذه البيانات.");
    } finally {
      setChecking(false);
    }
  };

  if (!isOpen) return null;

  const isActive = status === "active" || status === "admin";

  return (
    <div
      className="account-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-modal-title"
      dir="rtl"
      onClick={closeModal}
    >
      <section className="account-modal-card" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="account-modal-close"
          aria-label="إغلاق"
          onClick={closeModal}
        >
          ×
        </button>

        <div className="account-modal-header">
          <span className="account-modal-kicker">حسابي</span>
          <h2 id="account-modal-title">معلومات حساب دربك</h2>
          <p>
            من هنا تقدر تشوف حالة حسابك وتدخل بنفس البريد أو رقم الجوال
            والرمز إذا كان لديك دربك+.
          </p>
        </div>

        <div className={`account-status-card ${isActive ? "is-active" : ""}`}>
          <span>{status === "admin" ? "حساب إدارة" : isActive ? "دربك+ فعال" : "حساب مجاني"}</span>
          <strong>{isActive ? "وصول كامل للمزايا المتقدمة" : "يمكنك الترقية متى احتجت"}</strong>
        </div>

        <dl className="account-details">
          <div>
            <dt>بيانات الدخول</dt>
            <dd>{identity.contact || identity.email || pass?.contact || "غير محفوظة بعد"}</dd>
          </div>
          <div>
            <dt>انتهاء الوصول</dt>
            <dd>{status === "admin" ? "دائم" : formatDate(pass?.expiresAt)}</dd>
          </div>
          <div>
            <dt>نوع الوصول</dt>
            <dd>{pass?.accessType === "admin" || status === "admin" ? "إدارة" : isActive ? "دربك+" : "مجاني"}</dd>
          </div>
        </dl>

        {message && <p className="account-modal-message">{message}</p>}

        <div className="account-modal-actions">
          {premiumGateVisible && (
            <button type="button" onClick={openPremiumGate}>
              {isActive ? "تجديد أو تغيير الباقة" : "تفعيل دربك+"}
            </button>
          )}
          <button type="button" className="secondary" onClick={refreshSubscription} disabled={checking}>
            {checking ? "جاري التحديث..." : "تحديث حالة الحساب"}
          </button>
        </div>
      </section>
    </div>
  );
}
