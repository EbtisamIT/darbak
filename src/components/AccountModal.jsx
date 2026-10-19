import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import API_BASE_URL from "../config/api";
import {
  ACCOUNT_MODAL_EVENT,
  clearAccessSession,
  fetchSubscriptionState,
  getStoredAccessIdentity,
  startSubscriptionFlow,
  getStoredPremiumPass,
  isPremiumGateEnabled,
  saveAccessIdentity,
  savePremiumPass,
} from "../utils/premiumAccess";
import { trackEvent } from "../utils/analytics";
import "./AccountRewardAnnouncement.css";

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
  if (status === "expired") return "دربك+ منتهي";
  if (status === "loading" || status === "unknown") return "جارِ التحقق";
  if (accessType === "experience_reward") return "هدية مشاركة تجربة";
  if (accessType === "admin_grant") return "منحة إدارة";
  if (accessType === "paid_subscription" || accessType === "premium") return "دربك+";
  return status === "active" ? "دربك+" : "مجاني";
};

export default function AccountModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [identity, setIdentity] = useState({});
  const [pass, setPass] = useState(null);
  const [subscriptionState, setSubscriptionState] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [checking, setChecking] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [requestingHelp, setRequestingHelp] = useState(false);
  const [loginForm, setLoginForm] = useState({ contact: "", accessCode: "" });
  const [premiumGateVisible, setPremiumGateVisible] = useState(false);
  const [journeyContext, setJourneyContext] = useState(null);
  const [journeyForm, setJourneyForm] = useState({ firstName: "", contact: "", accessCode: "" });
  const [savingJourney, setSavingJourney] = useState(false);
  const [journeyLoginMode, setJourneyLoginMode] = useState(false);
  const [resumeReward, setResumeReward] = useState(null);
  const [showLifecycleQuestion, setShowLifecycleQuestion] = useState(false);
  const [rewardAnnouncement, setRewardAnnouncement] = useState(null);
  const acknowledgedRewardIds = useRef(new Set());

  const loadResumeReward = useCallback(async () => {
    const stored = getStoredAccessIdentity();
    const contact = stored.contact || stored.email;
    if (!contact || !stored.accessCode) return;
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/rewards/resume/me`, { headers: {
        "x-darbak-contact": contact,
        "x-darbak-access-code": stored.accessCode,
      } });
      setResumeReward(data.reward);
      if (data.reward?.v11Enabled && data.reward?.status === "available" && !data.reward.announcementSeenAt &&
        !acknowledgedRewardIds.current.has(String(data.reward.id))) {
        setRewardAnnouncement(data.reward);
      } else setRewardAnnouncement(null);
    } catch {
      setResumeReward(null);
      setRewardAnnouncement(null);
    }
  }, []);

  const downloadRewardPdf = async () => {
    const stored = getStoredAccessIdentity();
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/rewards/resume/pdf`, {
        headers: {
          "x-darbak-contact": stored.contact || stored.email || "",
          "x-darbak-access-code": stored.accessCode || "",
        },
        responseType: "blob",
      });
      const url = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "darbak-ats-classic.pdf";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setMessage("تعذر تنزيل السيرة حاليًا."); }
  };

  useEffect(() => {
    loadResumeReward();
    window.addEventListener("darbak:free-account-saved", loadResumeReward);
    window.addEventListener("darbak:experience-reward-updated", loadResumeReward);
    window.addEventListener("focus", loadResumeReward);
    return () => {
      window.removeEventListener("darbak:free-account-saved", loadResumeReward);
      window.removeEventListener("darbak:experience-reward-updated", loadResumeReward);
      window.removeEventListener("focus", loadResumeReward);
    };
  }, [loadResumeReward]);

  const status = useMemo(() => {
    if (pass?.isAdmin) return "admin";
    if (subscriptionState?.state === "EXPIRED") return "expired";
    if (subscriptionState?.state === "ACTIVE") return "active";
    if (pass?.expiresAt && new Date(pass.expiresAt) > new Date()) return "active";
    if (statusLoading) return "loading";
    if (subscriptionState === null && (identity.contact || identity.email)) return "unknown";
    return "free";
  }, [identity.contact, identity.email, pass, statusLoading, subscriptionState]);

  const loadSubscriptionState = useCallback(async () => {
    setStatusLoading(true);
    setSubscriptionState(null);
    try {
      setSubscriptionState(await fetchSubscriptionState());
    } catch {
      setMessage("تعذر تحديد حالة الاشتراك الآن. حاول تحديث حالة الحساب.");
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const openModal = useCallback((event) => {
    const storedIdentity = getStoredAccessIdentity();
    const storedContact = storedIdentity.contact || storedIdentity.email || "";
    const context = ["save_journey", "contribution"].includes(event?.detail?.mode) ? event.detail : null;
    setIdentity(storedIdentity);
    loadResumeReward();
    setPass(getStoredPremiumPass());
    if ((storedIdentity.contact || storedIdentity.email) && storedIdentity.accessCode) {
      loadSubscriptionState();
    } else {
      setSubscriptionState({ state: "FREE", planId: "", expiresAt: null });
    }
    setLoginForm({
      contact: isValidContact(storedContact) ? storedContact : "",
      accessCode: storedIdentity.accessCode || "",
    });
    setPremiumGateVisible(isPremiumGateEnabled());
    setJourneyContext(context);
    setJourneyLoginMode(false);
    setJourneyForm({
      firstName: "",
      contact: isValidEmail(storedContact) ? storedContact : "",
      accessCode: storedIdentity.accessCode || "",
    });
    setMessage("");
    setShowLifecycleQuestion(false);
    setIsOpen(true);
    trackEvent("account_modal_opened");
  }, [loadResumeReward, loadSubscriptionState]);

  useEffect(() => {
    window.addEventListener(ACCOUNT_MODAL_EVENT, openModal);
    return () => window.removeEventListener(ACCOUNT_MODAL_EVENT, openModal);
  }, [openModal]);

  useEffect(() => {
    const contact = identity?.contact || identity?.email;
    if (!isOpen || !contact || !identity?.accessCode) return undefined;
    let active = true;
    axios.get(`${API_BASE_URL}/api/account/free-session`, { headers: {
      "x-darbak-contact": contact,
      "x-darbak-access-code": identity.accessCode,
    } }).then(({ data }) => {
      if (active) setShowLifecycleQuestion(
        (data.account?.lifecycleStage || "unknown") === "unknown" &&
        !data.account?.lifecyclePromptDismissedAt
      );
    }).catch(() => { if (active) setShowLifecycleQuestion(false); });
    return () => { active = false; };
  }, [isOpen, identity]);

  const saveLifecycleStage = async (lifecycleStage) => {
    setShowLifecycleQuestion(false);
    try {
      await axios.post(`${API_BASE_URL}/api/account/lifecycle-stage`, { lifecycleStage }, { headers: {
        "x-darbak-contact": identity.contact || identity.email || "",
        "x-darbak-access-code": identity.accessCode,
      } });
    } catch {
      setShowLifecycleQuestion(true);
      setMessage("تعذر حفظ اختيارك الآن. حاول مرة أخرى.");
    }
  };

  const closeModal = () => {
    setIsOpen(false);
    setMessage("");
    setJourneyContext(null);
  };

  const dismissRewardAnnouncement = () => {
    if (rewardAnnouncement?.id) acknowledgedRewardIds.current.add(String(rewardAnnouncement.id));
    setRewardAnnouncement(null);
    const stored = getStoredAccessIdentity();
    axios.post(`${API_BASE_URL}/api/rewards/resume/announcement-seen`, {}, { headers: {
      "x-darbak-contact": stored.contact || stored.email || "",
      "x-darbak-access-code": stored.accessCode || "",
    } }).catch(() => {});
  };

  const saveFreeJourneyAccount = async (event) => {
    event.preventDefault();
    const contact = journeyForm.contact.trim();
    const accessCode = journeyForm.accessCode.trim();
    const firstName = journeyForm.firstName.trim();

    if (!journeyLoginMode && !firstName) {
      setMessage("اكتب اسمك الأول فقط.");
      return;
    }
    if (!isValidEmail(contact) || !/^[A-Za-z0-9]{4,12}$/.test(accessCode)) {
      setMessage("اكتب بريدًا صحيحًا ورمز دخول من 4 إلى 12 حرفًا أو رقمًا.");
      return;
    }

    try {
      setSavingJourney(true);
      setMessage("");
      const { data } = await axios.post(`${API_BASE_URL}/api/account/free-session`, {
        email: contact,
        accessCode,
        firstName,
        preferredMajor: journeyContext?.preferredMajor || "",
        preferredCity: journeyContext?.preferredCity || "",
      });
      saveAccessIdentity({ contact, accessCode });
      setIdentity(getStoredAccessIdentity());
      loadResumeReward();
      window.dispatchEvent(new CustomEvent("darbak:free-account-saved", { detail: data.account || {} }));
      trackEvent("free_journey_saved");
      closeModal();
    } catch (err) {
      setMessage(err.response?.data?.error || "تعذر حفظ رحلتك حاليًا.");
    } finally {
      setSavingJourney(false);
    }
  };

  const openPremiumGate = () => {
    if (isActive) {
      setMessage("تغيير الباقة لا يزال غير متاح من الحساب النشط لأن احتساب الرصيد غير مفعّل. اشتراكك الحالي مستمر كما هو.");
      return;
    }
    setIsOpen(false);
    startSubscriptionFlow({
      ...(status === "expired" && subscriptionState?.planId
        ? { planId: subscriptionState.planId }
        : {}),
      source: "account_renewal",
    });
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
      loadSubscriptionState();
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
      await axios.post(`${API_BASE_URL}/api/account/free-session`, {
        email: contact,
        accessCode,
      });
      saveAccessIdentity({ contact, accessCode });
      setIdentity(getStoredAccessIdentity());
      loadResumeReward();
      try {
        const { data } = await axios.post(`${API_BASE_URL}/api/subscriptions/verify`, {
          email: contact,
          accessCode,
        });
        savePremiumPass(data);
        setPass(getStoredPremiumPass());
        setMessage(data.message || "تم تسجيل الدخول.");
      } catch {
        setPass(null);
        setMessage("تم تسجيل الدخول.");
      }
      loadSubscriptionState();
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
    setResumeReward(null);
    setRewardAnnouncement(null);
    setPass(null);
    setSubscriptionState({ state: "FREE", planId: "", expiresAt: null });
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

  if (!isOpen) return rewardAnnouncement ? <div className="account-modal-overlay" role="dialog"
    aria-modal="true" aria-labelledby="reward-announcement-title" dir="rtl">
    <section className="account-modal-card account-reward-congratulations">
      <button type="button" className="account-modal-close" aria-label="إغلاق" onClick={dismissRewardAnnouncement}>×</button>
      <h2 id="reward-announcement-title">🎉 مبروك! تم اعتماد تجربتك</h2>
      <p>شكرًا لأنك شاركت تجربتك مع طلاب دربك.</p>
      <strong>هديتك جاهزة: سيرة ذاتية احترافية مجانًا بقالب Darbak ATS.</strong>
      <p>بنرتب خبرتك ومهاراتك ومشاريعك ونجهزها لك بشكل مناسب للتقديم.</p>
      <div className="account-reward-congratulations-actions">
        <Link to="/rewards/resume" onClick={dismissRewardAnnouncement}>جهّز سيرتي مجانًا</Link>
        <button type="button" onClick={dismissRewardAnnouncement}>لاحقًا</button>
      </div>
    </section>
  </div> : null;

  if (journeyContext) {
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
          <button type="button" className="account-modal-close" aria-label="إغلاق" onClick={closeModal}>×</button>
          <form className="account-login-form" onSubmit={saveFreeJourneyAccount}>
            <div className="account-modal-header">
              <span className="account-modal-kicker">حساب مجاني</span>
              <h2 id="account-modal-title">{journeyContext?.mode === "contribution" ? "احفظ تجربتك ومكافأتك" : "احفظ رحلتك"}</h2>
              <p>{journeyContext?.mode === "contribution" ? "حساب مجاني لحفظ تجربتك ومتابعة اعتمادها. اسم حسابك لا يظهر في التجربة المنشورة." : "عشان نحفظ تخصصك ومدينتك ونطلع لك الجديد كل مرة."}</p>
            </div>
            {!journeyLoginMode && <label>
              <span>الاسم الأول</span>
              <input value={journeyForm.firstName} onChange={(event) => setJourneyForm((current) => ({ ...current, firstName: event.target.value }))} placeholder="سارة" autoComplete="given-name" />
            </label>}
            <label>
              <span>البريد الإلكتروني</span>
              <input type="email" value={journeyForm.contact} onChange={(event) => setJourneyForm((current) => ({ ...current, contact: event.target.value }))} placeholder="name@email.com" autoComplete="email" dir="ltr" />
            </label>
            <label>
              <span>رمز الدخول</span>
              <input value={journeyForm.accessCode} onChange={(event) => setJourneyForm((current) => ({ ...current, accessCode: event.target.value }))} placeholder="4 إلى 12 حرف أو رقم" autoComplete="new-password" maxLength={12} dir="ltr" />
            </label>
            <button type="submit" disabled={savingJourney}>
              {savingJourney ? "جاري الحفظ..." : journeyLoginMode ? "تسجيل الدخول" : "أنشئ حسابًا مجانيًا"}
            </button>
            <button type="button" className="account-login-help" onClick={() => { setJourneyLoginMode((value) => !value); setMessage(""); }}>
              {journeyLoginMode ? "إنشاء حساب جديد" : "عندي حساب، دخول"}
            </button>
            {message && <p className="account-modal-message">{message}</p>}
          </form>
        </section>
      </div>
    );
  }

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
              : status === "loading" || status === "unknown"
              ? "جارِ التحقق من الاشتراك"
              : status === "expired"
              ? "اشتراكك منتهي"
              : isActive
              ? "دربك+ فعال"
              : "حساب مجاني"}
          </span>
          <strong>
            {isExperienceReward
              ? "وصول كامل لمدة 30 يومًا بعد اعتماد تجربتك"
              : status === "loading" || status === "unknown"
              ? "سنُظهر حالة اشتراكك بعد التحقق."
              : status === "expired"
              ? "يمكنك تجديد الاشتراك لمتابعة استخدام المزايا."
              : isActive
              ? "وصول كامل للمزايا المتقدمة"
              : "يمكنك الترقية متى احتجت"}
          </strong>
        </div>

        {showLifecycleQuestion && !pass?.isAdmin && !rewardAnnouncement && (
          <div className="account-reward-note" aria-label="مرحلتك الحالية">
            <strong>أنت حاليًا؟</strong>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button type="button" onClick={() => saveLifecycleStage("student")}>طالب جامعي</button>
              <button type="button" onClick={() => saveLifecycleStage("graduate")}>خريج</button>
              <button type="button" onClick={() => saveLifecycleStage("unknown")}>لاحقًا</button>
            </div>
          </div>
        )}

        {isExperienceReward && (
          <div className="account-reward-note">
            <strong>تم اعتماد تجربتك 🎉</strong>
            <span>
              شكرًا لأنك شاركت تجربتك وساعدت الطلاب اللي بعدك. وصولك الكامل
              مفعّل الآن حتى تاريخ الانتهاء الموضح هنا.
            </span>
          </div>
        )}

        {resumeReward?.status === "available" && (
          <div className="account-reward-note">
            {resumeReward.v11Enabled ? <>
              <strong>🎁 هديتك جاهزة</strong>
              <span>تم اعتماد تجربتك، وتقدر الآن تجهز سيرتك الذاتية مجانًا.</span>
              <Link to="/rewards/resume" onClick={closeModal}>{resumeReward.hasDraft ? "أكمل سيرتي" : "ابدأ الآن"}</Link>
            </> : <>
              <strong>مكافأتك جاهزة</strong>
              <span>تم اعتماد تجربتك. حصلت على نسخة سيرة ذاتية واحدة مجانًا بقالب ATS.</span>
              <Link to="/rewards/resume" onClick={closeModal}>إنشاء سيرتي الذاتية</Link>
            </>}
          </div>
        )}
        {resumeReward?.status === "redeemed" && (
          <div className="account-reward-note">
            {resumeReward.v11Enabled ? <>
              <strong>سيرتي المجانية</strong>
              <span>Darbak ATS Classic · {resumeReward.language === "ar" ? "العربية" : "English"}</span>
              <span>تم إنشاؤها {formatDate(resumeReward.redeemedAt)}</span>
              <Link to="/rewards/resume" onClick={closeModal}>عرض السيرة</Link>
              <button type="button" onClick={downloadRewardPdf}>تنزيل PDF</button>
            </> : <>
              <strong>سيرتك النهائية جاهزة</strong>
              <Link to="/rewards/resume" onClick={closeModal}>تنزيل PDF</Link>
            </>}
          </div>
        )}

        <dl className="account-details">
          <div>
            <dt>بيانات الدخول</dt>
            <dd>{identity.contact || identity.email || pass?.contact || "غير محفوظة بعد"}</dd>
          </div>
          <div>
            <dt>انتهاء الوصول</dt>
            <dd>{status === "admin" ? "دائم" : formatDate(subscriptionState?.expiresAt || pass?.expiresAt)}</dd>
          </div>
          <div>
            <dt>نوع الوصول</dt>
            <dd>{accessTypeLabel}</dd>
          </div>
        </dl>

        {status === "free" && (
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
          {(premiumGateVisible || status === "expired") && (
            <button type="button" onClick={openPremiumGate} disabled={status === "loading" || status === "unknown"}>
              {isActive ? "تغيير الباقة" : status === "expired" ? "تجديد الاشتراك" : "تجديد أو تفعيل دربك+"}
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
