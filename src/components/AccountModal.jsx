import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { getVisitorId, trackEvent } from "../utils/analytics";

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

const isValidContact = (value = "") => isValidEmail(value) || isValidSaudiMobile(value);

const emptyPortfolioProject = { title: "", description: "", url: "" };

const emptyPortfolioForm = {
  slug: "",
  fullName: "",
  major: "",
  university: "",
  city: "",
  readinessStatus: "مستعد ومؤهل للمقابلات الشخصية",
  targetOrganizations: "",
  bio: "",
  skills: "",
  cvUrl: "",
  linkedinUrl: "",
  email: "",
  avatarUrl: "",
  isPublished: false,
  projects: [emptyPortfolioProject],
};

const getDeviceType = () => {
  if (typeof window === "undefined") return "unknown";
  if (window.innerWidth < 768) return "mobile";
  if (window.innerWidth < 1024) return "tablet";
  return "desktop";
};

const joinList = (items = []) => (Array.isArray(items) ? items.join("، ") : "");

const normalizePortfolioForm = (portfolio = {}) => {
  const projects = Array.isArray(portfolio.projects) && portfolio.projects.length
    ? portfolio.projects
    : [emptyPortfolioProject];

  return {
    slug: portfolio.slug || "",
    fullName: portfolio.fullName || "",
    major: portfolio.major || "",
    university: portfolio.university || "",
    city: portfolio.city || "",
    readinessStatus:
      portfolio.readinessStatus || "مستعد ومؤهل للمقابلات الشخصية",
    targetOrganizations: joinList(portfolio.targetOrganizations),
    bio: portfolio.bio || "",
    skills: joinList(portfolio.skills),
    cvUrl: portfolio.cvUrl || "",
    linkedinUrl: portfolio.linkedinUrl || "",
    email: portfolio.email || "",
    avatarUrl: portfolio.avatarUrl || "",
    isPublished: Boolean(portfolio.isPublished),
    projects: projects.map((project) => ({
      title: project.title || "",
      description: project.description || "",
      url: project.url || "",
    })),
  };
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
  const [portfolioForm, setPortfolioForm] = useState(emptyPortfolioForm);
  const [portfolioPublicUrl, setPortfolioPublicUrl] = useState("");
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [portfolioSaving, setPortfolioSaving] = useState(false);
  const [portfolioMessage, setPortfolioMessage] = useState("");

  const status = useMemo(() => {
    if (pass?.isAdmin) return "admin";
    if (pass?.expiresAt && new Date(pass.expiresAt) > new Date()) return "active";
    return "free";
  }, [pass]);

  const fetchPortfolio = useCallback(async (identityOverride = {}) => {
    const contact = (
      identityOverride.contact ||
      identityOverride.email ||
      ""
    ).trim();
    const accessCode = (identityOverride.accessCode || "").trim();

    if (!contact || !accessCode || !isValidContact(contact)) return;

    try {
      setPortfolioLoading(true);
      setPortfolioMessage("");
      const { data } = await axios.get(`${API_BASE_URL}/api/portfolio/me`, {
        headers: {
          "x-darbak-contact": contact,
          "x-darbak-access-code": accessCode,
        },
      });

      setPortfolioForm(normalizePortfolioForm(data.portfolio));
      setPortfolioPublicUrl(data.publicUrl || "");
    } catch (err) {
      setPortfolioMessage(
        err.response?.data?.error || "تعذر تحميل ملف الأعمال حاليًا."
      );
    } finally {
      setPortfolioLoading(false);
    }
  }, []);

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
    setPortfolioMessage("");
    setPortfolioForm(emptyPortfolioForm);
    setPortfolioPublicUrl("");
    setIsOpen(true);
    fetchPortfolio(storedIdentity);
    trackEvent("account_modal_opened");
  }, [fetchPortfolio]);

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
      setMessage("لا توجد بيانات دخول محفوظة. سجّل الدخول بنفس البريد الإلكتروني أو رقم الجوال القديم والرمز أولًا.");
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
      setMessage("تم تحديث حالة حسابك.");
      fetchPortfolio({ contact, accessCode });
    } catch (err) {
      setPass(null);
      setMessage(err.response?.data?.error || "لم يتم العثور على اشتراك فعال بهذه البيانات.");
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
      setMessage("تم تسجيل الدخول وتفعيل مزايا حسابك.");
      fetchPortfolio({ contact, accessCode });
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
    setPortfolioForm(emptyPortfolioForm);
    setPortfolioPublicUrl("");
    setPortfolioMessage("");
    setMessage("تم تسجيل الخروج من هذا الجهاز.");
    trackEvent("account_logout_clicked");
  };

  const updatePortfolioField = (field, value) => {
    setPortfolioForm((current) => ({ ...current, [field]: value }));
    setPortfolioMessage("");
  };

  const updatePortfolioProject = (index, field, value) => {
    setPortfolioForm((current) => ({
      ...current,
      projects: current.projects.map((project, projectIndex) =>
        projectIndex === index ? { ...project, [field]: value } : project
      ),
    }));
    setPortfolioMessage("");
  };

  const addPortfolioProject = () => {
    setPortfolioForm((current) => {
      if (current.projects.length >= 6) return current;
      return {
        ...current,
        projects: [...current.projects, { ...emptyPortfolioProject }],
      };
    });
  };

  const removePortfolioProject = (index) => {
    setPortfolioForm((current) => ({
      ...current,
      projects:
        current.projects.length <= 1
          ? [{ ...emptyPortfolioProject }]
          : current.projects.filter((_, projectIndex) => projectIndex !== index),
    }));
  };

  const savePortfolio = async (event) => {
    event.preventDefault();

    const contact =
      identity.contact ||
      identity.email ||
      pass?.contact ||
      loginForm.contact.trim();
    const accessCode = identity.accessCode || loginForm.accessCode.trim();

    if (!contact || !accessCode || !isValidContact(contact)) {
      setPortfolioMessage("سجّل دخولك أولًا حتى نربط ملف الأعمال بحسابك.");
      return;
    }

    if (!portfolioForm.fullName.trim() || !portfolioForm.major.trim()) {
      setPortfolioMessage("اكتب الاسم والتخصص حتى نجهز ملف الأعمال.");
      return;
    }

    try {
      setPortfolioSaving(true);
      setPortfolioMessage("");
      const { data } = await axios.post(
        `${API_BASE_URL}/api/portfolio/me`,
        {
          ...portfolioForm,
          visitorId: getVisitorId(),
          deviceType: getDeviceType(),
        },
        {
          headers: {
            "x-darbak-contact": contact,
            "x-darbak-access-code": accessCode,
          },
        }
      );

      setPortfolioForm(normalizePortfolioForm(data.portfolio));
      setPortfolioPublicUrl(data.publicUrl || "");
      setPortfolioMessage(data.message || "تم حفظ ملف الأعمال.");
      trackEvent("portfolio_form_saved", {
        metadata: {
          isPublished: Boolean(data.portfolio?.isPublished),
          publicActive: Boolean(data.portfolio?.publicActive),
        },
      });
    } catch (err) {
      setPortfolioMessage(
        err.response?.data?.error || "تعذر حفظ ملف الأعمال حاليًا."
      );
    } finally {
      setPortfolioSaving(false);
    }
  };

  const requestAccessHelp = async () => {
    const contact = loginForm.contact.trim();

    if (!contact) {
      setMessage("اكتب البريد الإلكتروني أو رقم الجوال القديم المستخدم في دربك+ أولًا.");
      return;
    }

    if (!isValidContact(contact)) {
      setMessage("اكتب بريدًا إلكترونيًا صحيحًا، أو رقم الجوال المستخدم لحساب سابق.");
      return;
    }

    try {
      setRequestingHelp(true);
      setMessage("");
      const { data } = await axios.post(
        `${API_BASE_URL}/api/subscriptions/request-access-help`,
        { contact }
      );
      setMessage(data.message || "وصل طلب المساعدة. بنساعدك على استعادة الوصول.");
      trackEvent("account_access_help_requested");
    } catch (err) {
      setMessage(
        err.response?.data?.error || "تعذر إرسال طلب المساعدة حاليًا."
      );
    } finally {
      setRequestingHelp(false);
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
            من هنا تقدر تدخل لحسابك، تشوف حالة دربك+، أو تسجل خروجك من هذا
            الجهاز.
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
                onChange={(event) => updateLoginField("accessCode", event.target.value)}
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
              {requestingHelp ? "جاري إرسال الطلب..." : "نسيت الرمز؟"}
            </button>
          </form>
        )}

        {message && <p className="account-modal-message">{message}</p>}

        {(isActive || identity.contact || identity.email) && (
          <form className="account-portfolio-panel" onSubmit={savePortfolio}>
            <div className="account-portfolio-head">
              <div>
                <span>ملف الأعمال الرقمي</span>
                <h3>رابط مهني جاهز للمشاركة مع جهات التدريب</h3>
              </div>
              {portfolioPublicUrl && (
                <a href={portfolioPublicUrl} target="_blank" rel="noreferrer">
                  معاينة الرابط
                </a>
              )}
            </div>

            <p className="account-portfolio-note">
              عبّئ بياناتك هنا. تقدر تحفظ الملف وتشوفه، والرابط العام يظهر
              للمسؤولين فقط إذا كان دربك+ فعالًا واخترت نشر الرابط.
            </p>

            {portfolioLoading ? (
              <div className="account-portfolio-loading">جاري تحميل الملف...</div>
            ) : (
              <>
                <div className="account-portfolio-grid">
                  <label className="account-portfolio-field">
                    <span>الرابط المختصر</span>
                    <input
                      value={portfolioForm.slug}
                      onChange={(event) =>
                        updatePortfolioField("slug", event.target.value)
                      }
                      placeholder="مثال: khaled-cs"
                      dir="ltr"
                    />
                  </label>
                  <label className="account-portfolio-field">
                    <span>الاسم</span>
                    <input
                      value={portfolioForm.fullName}
                      onChange={(event) =>
                        updatePortfolioField("fullName", event.target.value)
                      }
                      placeholder="اسمك كما تفضل ظهوره"
                    />
                  </label>
                  <label className="account-portfolio-field">
                    <span>التخصص</span>
                    <input
                      value={portfolioForm.major}
                      onChange={(event) =>
                        updatePortfolioField("major", event.target.value)
                      }
                      placeholder="نظم معلومات، محاسبة..."
                    />
                  </label>
                  <label className="account-portfolio-field">
                    <span>الجامعة</span>
                    <input
                      value={portfolioForm.university}
                      onChange={(event) =>
                        updatePortfolioField("university", event.target.value)
                      }
                      placeholder="اسم الجامعة"
                    />
                  </label>
                  <label className="account-portfolio-field">
                    <span>المدينة</span>
                    <input
                      value={portfolioForm.city}
                      onChange={(event) =>
                        updatePortfolioField("city", event.target.value)
                      }
                      placeholder="الرياض، جدة..."
                    />
                  </label>
                  <label className="account-portfolio-field">
                    <span>حالة الجاهزية</span>
                    <input
                      value={portfolioForm.readinessStatus}
                      onChange={(event) =>
                        updatePortfolioField(
                          "readinessStatus",
                          event.target.value
                        )
                      }
                      placeholder="مستعد للمقابلات الشخصية"
                    />
                  </label>
                  <label className="account-portfolio-field is-full">
                    <span>الوجهات أو القطاعات المستهدفة</span>
                    <input
                      value={portfolioForm.targetOrganizations}
                      onChange={(event) =>
                        updatePortfolioField(
                          "targetOrganizations",
                          event.target.value
                        )
                      }
                      placeholder="مثال: STC، علم، البنوك، الجهات الحكومية"
                    />
                  </label>
                  <label className="account-portfolio-field is-full">
                    <span>نبذة شخصية قصيرة</span>
                    <textarea
                      value={portfolioForm.bio}
                      onChange={(event) =>
                        updatePortfolioField("bio", event.target.value)
                      }
                      placeholder="اكتب سطرين عن اهتمامك المهني وما الذي تستطيع تقديمه."
                    />
                  </label>
                  <label className="account-portfolio-field is-full">
                    <span>المهارات</span>
                    <input
                      value={portfolioForm.skills}
                      onChange={(event) =>
                        updatePortfolioField("skills", event.target.value)
                      }
                      placeholder="Excel، React، تحليل بيانات، كتابة تقارير"
                    />
                  </label>
                  <label className="account-portfolio-field">
                    <span>رابط السيرة الذاتية PDF</span>
                    <input
                      value={portfolioForm.cvUrl}
                      onChange={(event) =>
                        updatePortfolioField("cvUrl", event.target.value)
                      }
                      placeholder="https://..."
                      dir="ltr"
                    />
                  </label>
                  <label className="account-portfolio-field">
                    <span>رابط LinkedIn</span>
                    <input
                      value={portfolioForm.linkedinUrl}
                      onChange={(event) =>
                        updatePortfolioField("linkedinUrl", event.target.value)
                      }
                      placeholder="https://linkedin.com/in/..."
                      dir="ltr"
                    />
                  </label>
                  <label className="account-portfolio-field">
                    <span>بريد التواصل</span>
                    <input
                      type="email"
                      value={portfolioForm.email}
                      onChange={(event) =>
                        updatePortfolioField("email", event.target.value)
                      }
                      placeholder="example@email.com"
                      dir="ltr"
                    />
                  </label>
                  <label className="account-portfolio-field">
                    <span>رابط الصورة الشخصية</span>
                    <input
                      value={portfolioForm.avatarUrl}
                      onChange={(event) =>
                        updatePortfolioField("avatarUrl", event.target.value)
                      }
                      placeholder="https://..."
                      dir="ltr"
                    />
                  </label>
                </div>

                <div className="account-portfolio-projects">
                  <div className="account-portfolio-subhead">
                    <strong>المشاريع والإنتاج العلمي</strong>
                    <button type="button" onClick={addPortfolioProject}>
                      إضافة مشروع
                    </button>
                  </div>
                  {portfolioForm.projects.map((project, index) => (
                    <div className="account-portfolio-project" key={index}>
                      <label>
                        <span>اسم المشروع</span>
                        <input
                          value={project.title}
                          onChange={(event) =>
                            updatePortfolioProject(
                              index,
                              "title",
                              event.target.value
                            )
                          }
                          placeholder="مشروع التخرج، لوحة بيانات..."
                        />
                      </label>
                      <label>
                        <span>وصف مختصر</span>
                        <textarea
                          value={project.description}
                          onChange={(event) =>
                            updatePortfolioProject(
                              index,
                              "description",
                              event.target.value
                            )
                          }
                          placeholder="وش المشكلة التي حلها المشروع؟ وما التقنيات المستخدمة؟"
                        />
                      </label>
                      <label>
                        <span>رابط المشروع</span>
                        <input
                          value={project.url}
                          onChange={(event) =>
                            updatePortfolioProject(
                              index,
                              "url",
                              event.target.value
                            )
                          }
                          placeholder="https://..."
                          dir="ltr"
                        />
                      </label>
                      <button
                        type="button"
                        className="account-portfolio-remove"
                        onClick={() => removePortfolioProject(index)}
                      >
                        حذف
                      </button>
                    </div>
                  ))}
                </div>

                <label className="account-portfolio-toggle">
                  <input
                    type="checkbox"
                    checked={portfolioForm.isPublished}
                    onChange={(event) =>
                      updatePortfolioField("isPublished", event.target.checked)
                    }
                  />
                  <span>أريد نشر رابط ملف الأعمال للعامة عند تفعيل دربك+</span>
                </label>

                {portfolioPublicUrl && (
                  <div className="account-portfolio-public">
                    <span>رابط ملفك</span>
                    <a href={portfolioPublicUrl} target="_blank" rel="noreferrer">
                      {portfolioPublicUrl}
                    </a>
                  </div>
                )}

                <div className="account-portfolio-preview">
                  <span>معاينة سريعة</span>
                  <div>
                    <div className="account-portfolio-preview-avatar">
                      {portfolioForm.avatarUrl ? (
                        <img src={portfolioForm.avatarUrl} alt="" />
                      ) : (
                        <strong>
                          {(portfolioForm.fullName.trim()[0] || "د").toUpperCase()}
                        </strong>
                      )}
                    </div>
                    <div>
                      <strong>{portfolioForm.fullName || "اسم الطالب"}</strong>
                      <p>{portfolioForm.major || "التخصص"}</p>
                      <small>
                        {[
                          portfolioForm.university || "الجامعة",
                          portfolioForm.city || "المدينة",
                        ].join(" - ")}
                      </small>
                    </div>
                  </div>
                  <p>{portfolioForm.readinessStatus}</p>
                </div>
              </>
            )}

            {portfolioMessage && (
              <p className="account-modal-message">{portfolioMessage}</p>
            )}

            <div className="account-portfolio-actions">
              <button type="submit" disabled={portfolioSaving || portfolioLoading}>
                {portfolioSaving ? "جاري الحفظ..." : "حفظ ملف الأعمال"}
              </button>
              {portfolioPublicUrl && (
                <a href={portfolioPublicUrl} target="_blank" rel="noreferrer">
                  فتح المعاينة
                </a>
              )}
            </div>
          </form>
        )}

        <div className="account-modal-actions">
          {premiumGateVisible && (
            <button type="button" onClick={openPremiumGate}>
              {isActive ? "تجديد أو تغيير الباقة" : "تفعيل دربك+"}
            </button>
          )}
          <button type="button" className="secondary" onClick={refreshSubscription} disabled={checking}>
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
