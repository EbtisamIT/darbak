import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import API_BASE_URL from "../config/api";
import {
  ACCOUNT_MODAL_EVENT,
  PREMIUM_ACCESS_EVENT,
  clearAccessSession,
  getStoredAccessIdentity,
  getStoredPremiumPass,
  isPremiumGateEnabled,
  saveAccessIdentity,
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

const isValidEmail = (value = "") =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());

const normalizeArabicDigits = (value = "") =>
  value
    .toString()
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));

const isValidSaudiMobile = (value = "") => {
  const digits = normalizeArabicDigits(value).replace(/[^\d+]/g, "");
  const number = digits.startsWith("+") ? digits : digits.replace(/^\+?/, "");

  return (
    /^\+9665\d{8}$/.test(digits) ||
    /^9665\d{8}$/.test(number) ||
    /^05\d{8}$/.test(number) ||
    /^5\d{8}$/.test(number)
  );
};

const isValidContact = (value = "") =>
  isValidEmail(value) || isValidSaudiMobile(value);

const getAccessTypeLabel = (accessType = "", status = "free") => {
  if (status === "admin" || accessType === "admin") return "إدارة";
  if (accessType === "experience_reward") return "هدية مشاركة تجربة";
  if (accessType === "admin_grant") return "منحة إدارة";
  if (accessType === "paid_subscription" || accessType === "premium") return "دربك+";
  return status === "active" ? "دربك+" : "مجاني";
};

export default function AccountModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [identity, setIdentity] = useState({});
  const [pass, setPass] = useState(null);
  const [message, setMessage] = useState("");
  const [checking, setChecking] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [requestingHelp, setRequestingHelp] = useState(false);
  const [loginForm, setLoginForm] = useState({ contact: "", accessCode: "" });
  const [premiumGateVisible, setPremiumGateVisible] = useState(false);

  const status = useMemo(() => {
    if (pass?.isAdmin) return "admin";
    if (pass?.expiresAt && new Date(pass.expiresAt) > new Date()) return "active";
    return "free";
  }, [pass]);

  const openModal = useCallback(() => {
    const storedIdentity = getStoredAccessIdentity();
    const storedContact = storedIdentity.contact || storedIdentity.email || "";
    setIdentity(storedIdentity);
    setPass(getStoredPremiumPass());
    setLoginForm({
      contact: isValidContact(storedContact) ? storedContact : "",
      accessCode: storedIdentity.accessCode || "",
    });
    setPremiumGateVisible(isPremiumGateEnabled());
    setMessage("");
    setIsOpen(true);
    trackEvent("account_modal_opened");
  }, []);

  useEffect(() => {
    window.addEventListener(ACCOUNT_MODAL_EVENT, openModal);
    return () => window.removeEventListener(ACCOUNT_MODAL_EVENT, openModal);
  }, [openModal]);

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
      setMessage(
        "لا توجد بيانات دخول محفوظة. سجّل الدخول بنفس البريد الإلكتروني أو رقم الجوال القديم والرمز أولًا."
      );
      return;
    }

    if (!isValidContact(contact)) {
      setMessage("سجّل الدخول ببريد إلكتروني صحيح، أو رقم الجوال المستخدم لحساب سابق.");
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
      setMessage(data.message || "تم تحديث حالة حسابك.");
    } catch (err) {
      setPass(null);
      setMessage(
        err.response?.data?.error || "لم يتم العثور على اشتراك فعال بهذه البيانات."
      );
    } finally {
      setChecking(false);
    }
  };

  const updateLoginField = (field, value) => {
    setLoginForm((current) => ({ ...current, [field]: value }));
    setMessage("");
  };

  const loginToAccount = async (event) => {
    event.preventDefault();

    const contact = loginForm.contact.trim();
    const accessCode = loginForm.accessCode.trim();

    if (!contact || !accessCode) {
      setMessage("اكتب البريد الإلكتروني أو رقم الجوال القديم مع رمز الدخول.");
      return;
    }

    if (!isValidContact(contact)) {
      setMessage("اكتب بريدًا إلكترونيًا صحيحًا، أو رقم الجوال المستخدم لحساب سابق.");
      return;
    }

    try {
      setLoggingIn(true);
      setMessage("");
      const { data } = await axios.post(`${API_BASE_URL}/api/subscriptions/verify`, {
        email: contact,
        accessCode,
      });
      saveAccessIdentity({ contact, accessCode });
      savePremiumPass(data);
      setIdentity(getStoredAccessIdentity());
      setPass(getStoredPremiumPass());
      setMessage(data.message || "تم تسجيل الدخول وتفعيل مزايا حسابك.");
      trackEvent("account_login_success");
    } catch (err) {
      setPass(null);
      setMessage(err.response?.data?.error || "تعذر تسجيل الدخول بهذه البيانات.");
      trackEvent("account_login_failed");
    } finally {
      setLoggingIn(false);
    }
  };

  const logout = () => {
    clearAccessSession();
    setIdentity({});
    setPass(null);
    setLoginForm({ contact: "", accessCode: "" });
    setMessage("تم تسجيل الخروج من هذا الجهاز.");
    trackEvent("account_logout_clicked");
  };

  const requestAccessHelp = async () => {
    const contact = loginForm.contact.trim();

    if (!contact) {
      setMessage(
        "اكتب البريد الإلكتروني المرتبط بدربك+، أو رقم الجوال للحسابات القديمة."
      );
      return;
    }

    if (!isValidContact(contact)) {
      setMessage("اكتب بريدًا إلكترونيًا صحيحًا، أو رقم الجوال المستخدم لحساب سابق.");
      return;
    }

    try {
      setRequestingHelp(true);
      setMessage("");
      if (isValidEmail(contact)) {
        const { data } = await axios.post(
          `${API_BASE_URL}/api/subscriptions/forgot-code`,
          { email: contact, source: "account_modal" }
        );
        setMessage(
          data.message ||
            "إذا كان هذا البريد مرتبطًا بحساب دربك+، ستصلك رسالة لإعادة تعيين الرمز."
        );
        trackEvent("account_access_reset_requested");
      } else {
        const { data } = await axios.post(
          `${API_BASE_URL}/api/subscriptions/request-access-help`,
          { contact }
        );
        setMessage(data.message || "وصل طلب المساعدة. بنساعدك على استعادة الوصول.");
        trackEvent("account_access_help_requested");
      }
    } catch (err) {
      setMessage(err.response?.data?.error || "تعذر إرسال طلب المساعدة حاليًا.");
    } finally {
      setRequestingHelp(false);
    }
  };

  if (!isOpen) return null;

  const isActive = status === "active" || status === "admin";
  const isExperienceReward = pass?.accessType === "experience_reward" && isActive;
  const accessTypeLabel = getAccessTypeLabel(pass?.accessType, status);

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
            من هنا تقدر تدخل لحسابك، تشوف حالة دربك+، أو تسجل خروجك من هذا
            الجهاز.
          </p>
        </div>

        <div className={`account-status-card ${isActive ? "is-active" : ""}`}>
          <span>
            {status === "admin"
              ? "حساب إدارة"
              : isExperienceReward
              ? "هدية مشاركة تجربة"
              : isActive
              ? "دربك+ فعال"
              : "حساب مجاني"}
          </span>
          <strong>
            {isExperienceReward
              ? "وصول كامل لمدة 30 يومًا بعد اعتماد تجربتك"
              : isActive
              ? "وصول كامل للمزايا المتقدمة"
              : "يمكنك الترقية متى احتجت"}
          </strong>
        </div>

        {isExperienceReward && (
          <div className="account-reward-note">
            <strong>تم اعتماد تجربتك 🎉</strong>
            <span>
              شكرًا لأنك شاركت تجربتك وساعدت الطلاب اللي بعدك. وصولك الكامل
              مفعّل الآن حتى تاريخ الانتهاء الموضح هنا.
            </span>
          </div>
        )}

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
            <dd>{accessTypeLabel}</dd>
          </div>
        </dl>

        {!isActive && (
          <form className="account-login-form" onSubmit={loginToAccount}>
            <div>
              <span>تسجيل الدخول</span>
              <p>اكتب نفس البريد الإلكتروني، أو رقم الجوال للحسابات السابقة، مع رمز الدخول.</p>
            </div>
            <label>
              <span>البريد الإلكتروني أو رقم جوال لحساب سابق</span>
              <input
                type="text"
                inputMode="text"
                value={loginForm.contact}
                onChange={(event) => updateLoginField("contact", event.target.value)}
                placeholder="example@email.com أو 05xxxxxxxx"
                autoComplete="email"
              />
            </label>
            <label>
              <span>رمز الدخول</span>
              <input
                value={loginForm.accessCode}
                onChange={(event) =>
                  updateLoginField("accessCode", event.target.value)
                }
                placeholder="رمز الدخول"
                autoComplete="one-time-code"
                maxLength={12}
              />
            </label>
            <button type="submit" disabled={loggingIn}>
              {loggingIn ? "جاري الدخول..." : "تسجيل الدخول"}
            </button>
            <button
              type="button"
              className="account-login-help"
              onClick={requestAccessHelp}
              disabled={requestingHelp}
            >
              {requestingHelp ? "جاري الإرسال..." : "نسيت الرمز؟"}
            </button>
          </form>
        )}

        {message && <p className="account-modal-message">{message}</p>}

        <div className="account-portfolio-link-card">
          <span>ملف الأعمال الرقمي</span>
          <strong>ابنِ بطاقة مهنية مستقلة، واحفظها أو عاينها قبل مشاركتها.</strong>
          <p>الصور والسيرة الذاتية تُرفع كملفات خفيفة داخل دربك بدل الروابط الخارجية.</p>
          <Link
            to="/portfolio"
            onClick={() => {
              trackEvent("portfolio_account_cta_clicked");
              closeModal();
            }}
          >
            فتح portfolio
          </Link>
        </div>

        <div className="account-modal-actions">
          {premiumGateVisible && (
            <button type="button" onClick={openPremiumGate}>
              {isActive ? "تجديد أو تغيير الباقة" : "تفعيل دربك+"}
            </button>
          )}
          <button
            type="button"
            className="secondary"
            onClick={refreshSubscription}
            disabled={checking}
          >
            {checking ? "جاري التحديث..." : "تحديث حالة الحساب"}
          </button>
          {(isActive || identity.contact || identity.email) && (
            <button type="button" className="danger" onClick={logout}>
              تسجيل خروج
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
