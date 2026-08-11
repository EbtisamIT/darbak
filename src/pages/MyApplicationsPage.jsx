import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import API_BASE_URL from "../config/api";
import { trackEvent } from "../utils/analytics";
import {
  PREMIUM_ACCESS_EVENT,
  PREMIUM_STATUS_EVENT,
  getAccessHeaders,
  getStoredAccessIdentity,
} from "../utils/premiumAccess";

const pageFont = "'Aniq', 'Cairo', sans-serif";

const statusFlow = [
  ["submitted", "تم الإرسال"],
  ["under_review", "قيد المراجعة"],
  ["shortlisted", "ترشيح"],
  ["interview", "مقابلة"],
  ["accepted", "قبول"],
];

const terminalStatuses = {
  rejected: "مرفوض",
  withdrawn: "منسحب",
};

const statusTone = {
  submitted: ["#66d0c3", "rgba(102,208,195,0.13)"],
  under_review: ["#f2c94c", "rgba(242,201,76,0.13)"],
  shortlisted: ["#7ddbcd", "rgba(125,219,205,0.14)"],
  interview: ["#93c5fd", "rgba(147,197,253,0.13)"],
  accepted: ["#86efac", "rgba(134,239,172,0.13)"],
  rejected: ["#fca5a5", "rgba(252,165,165,0.13)"],
  withdrawn: ["#cbd5e1", "rgba(203,213,225,0.11)"],
};

const formatDateTime = (value) => {
  if (!value) return "غير محدد";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "غير محدد";

  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Riyadh",
  }).format(date);
};

const getActiveStepIndex = (status) =>
  Math.max(
    0,
    statusFlow.findIndex(([value]) => value === status)
  );

const MyApplicationsPage = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [requiresLogin, setRequiresLogin] = useState(false);

  const identity = getStoredAccessIdentity();
  const hasIdentity = Boolean(identity.contact && identity.accessCode);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    const identity = getStoredAccessIdentity();
    if (!identity.contact || !identity.accessCode) {
      setRequiresLogin(true);
      setLoading(false);
      return;
    }

    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/company-applications/me`, {
        headers: getAccessHeaders(),
      });
      setApplications(Array.isArray(data.data) ? data.data : []);
      setRequiresLogin(false);
    } catch (err) {
      if (err.response?.status === 401) {
        setRequiresLogin(true);
      } else {
        setErrorMessage(
          err.response?.data?.error ||
            "تعذر تحميل طلباتك حاليًا. حاول مرة أخرى بعد قليل."
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = "طلباتي | دربك";
    trackEvent("student_applications_page_viewed", {
      page: "/applications",
    });
    fetchApplications();

    const refreshAfterLogin = () => fetchApplications();
    window.addEventListener(PREMIUM_STATUS_EVENT, refreshAfterLogin);
    window.addEventListener("storage", refreshAfterLogin);
    window.addEventListener("focus", refreshAfterLogin);
    return () => {
      window.removeEventListener(PREMIUM_STATUS_EVENT, refreshAfterLogin);
      window.removeEventListener("storage", refreshAfterLogin);
      window.removeEventListener("focus", refreshAfterLogin);
    };
  }, [fetchApplications]);

  const openLogin = () => {
    window.dispatchEvent(
      new CustomEvent(PREMIUM_ACCESS_EVENT, {
        detail: {
          loginOnly: true,
          feature: "student_applications",
          title: "تسجيل الدخول لعرض طلباتي",
          source: "student_applications",
        },
      })
    );
  };

  return (
    <main dir="rtl" className="my-applications-page">
      <section className="my-applications-hero">
        <span>طلبات التدريب</span>
        <h1>طلباتي</h1>
        <p>
          هنا تتابع طلبات التقديم التي أرسلتها عبر ملفك المهني في دربك، مع آخر
          حالة ورسائل التحديث من الإدارة.
        </p>
      </section>

      {loading ? (
        <section className="my-applications-empty">جار تحميل الطلبات...</section>
      ) : requiresLogin || !hasIdentity ? (
        <section className="my-applications-empty">
          <h2>سجّل الدخول لعرض طلباتك</h2>
          <p>استخدم بريدك ورمز الدخول نفسه المستخدم في دربك.</p>
          <button type="button" onClick={openLogin}>
            تسجيل الدخول
          </button>
        </section>
      ) : errorMessage ? (
        <section className="my-applications-empty error">{errorMessage}</section>
      ) : applications.length === 0 ? (
        <section className="my-applications-empty">
          <h2>ما عندك طلبات حتى الآن</h2>
          <p>إذا وجدت برنامج مناسب، قدّم عليه بملفك المهني وراح يظهر هنا.</p>
          <Link to="/where-to-train">استكشف الجهات والفرص</Link>
        </section>
      ) : (
        <section className="my-applications-list">
          {applications.map((application) => {
            const status = application.status || "submitted";
            const [color, bg] = statusTone[status] || statusTone.submitted;
            const activeIndex = getActiveStepIndex(status);
            const latestHistory =
              application.statusHistory?.[application.statusHistory.length - 1];

            return (
              <article key={application.id || application._id} className="application-card">
                <div className="application-card-head">
                  <div className="application-company-mark">
                    {application.organizationLogoUrl ? (
                      <img
                        src={application.organizationLogoUrl}
                        alt={application.organizationName}
                      />
                    ) : (
                      <span>{(application.organizationName || "د").charAt(0)}</span>
                    )}
                  </div>
                  <div>
                    <h2>{application.organizationName || "جهة تدريبية"}</h2>
                    <p>{application.opportunityTitle || "التدريب التعاوني"}</p>
                  </div>
                  <span className="application-status" style={{ color, background: bg }}>
                    {application.statusLabel || terminalStatuses[status] || "تم الإرسال"}
                  </span>
                </div>

                <div className="application-meta-grid">
                  <div>
                    <span>تاريخ التقديم</span>
                    <strong>{formatDateTime(application.submittedAt)}</strong>
                  </div>
                  <div>
                    <span>آخر تحديث</span>
                    <strong>{formatDateTime(application.updatedAt)}</strong>
                  </div>
                  <div>
                    <span>التخصص</span>
                    <strong>{application.major || "غير مضاف"}</strong>
                  </div>
                  <div>
                    <span>المدينة</span>
                    <strong>{application.city || "غير مضافة"}</strong>
                  </div>
                </div>

                {application.studentVisibleMessage ||
                latestHistory?.studentVisibleMessage ? (
                  <p className="application-message">
                    {application.studentVisibleMessage ||
                      latestHistory?.studentVisibleMessage}
                  </p>
                ) : null}

                <div className="application-stepper">
                  {status in terminalStatuses ? (
                    <div className="application-terminal-step" style={{ color, background: bg }}>
                      {terminalStatuses[status]}
                    </div>
                  ) : (
                    statusFlow.map(([value, label], index) => (
                      <div
                        key={value}
                        className={
                          index <= activeIndex
                            ? "application-step is-active"
                            : "application-step"
                        }
                      >
                        <span>{index + 1}</span>
                        <strong>{label}</strong>
                      </div>
                    ))
                  )}
                </div>

                <div className="application-actions">
                  {application.portfolioUrl && (
                    <a href={application.portfolioUrl} target="_blank" rel="noreferrer">
                      ملفي المهني
                    </a>
                  )}
                  {application.linkedinUrl && (
                    <a href={application.linkedinUrl} target="_blank" rel="noreferrer">
                      LinkedIn
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      <style>{`
        .my-applications-page {
          min-height: 100vh;
          padding: clamp(22px, 5vw, 54px) 14px;
          font-family: ${pageFont};
          background: var(--app-bg);
          color: var(--app-text);
        }

        .my-applications-hero,
        .my-applications-list,
        .my-applications-empty {
          width: min(980px, 100%);
          margin: 0 auto;
        }

        .my-applications-hero {
          text-align: center;
          margin-bottom: 20px;
        }

        .my-applications-hero span {
          color: var(--app-brand);
          font-weight: 900;
        }

        .my-applications-hero h1 {
          margin: 8px 0;
          font-size: clamp(34px, 6vw, 54px);
          letter-spacing: 0;
        }

        .my-applications-hero p {
          margin: 0 auto;
          max-width: 620px;
          color: var(--app-text-soft);
          line-height: 1.9;
        }

        .my-applications-list {
          display: grid;
          gap: 14px;
        }

        .application-card,
        .my-applications-empty {
          border: 1px solid var(--app-border);
          border-radius: 24px;
          background: var(--app-surface);
          box-shadow: 0 18px 46px var(--app-shadow);
          padding: clamp(16px, 4vw, 22px);
        }

        .application-card-head {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 12px;
          align-items: center;
        }

        .application-company-mark {
          width: 58px;
          height: 58px;
          border-radius: 18px;
          border: 1px solid var(--app-border);
          background: #fff;
          display: grid;
          place-items: center;
          overflow: hidden;
        }

        .application-company-mark img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          padding: 8px;
          box-sizing: border-box;
        }

        .application-company-mark span {
          color: #102523;
          font-size: 24px;
          font-weight: 900;
        }

        .application-card h2 {
          margin: 0 0 4px;
          color: var(--app-text);
          font-size: 22px;
        }

        .application-card p {
          margin: 0;
          color: var(--app-text-soft);
          line-height: 1.8;
        }

        .application-status {
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
        }

        .application-meta-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 10px;
          margin: 16px 0;
        }

        .application-meta-grid div {
          border: 1px solid var(--app-border);
          border-radius: 15px;
          background: var(--app-input-bg);
          padding: 10px 12px;
        }

        .application-meta-grid span {
          display: block;
          color: var(--app-text-soft);
          font-size: 12px;
          margin-bottom: 5px;
        }

        .application-meta-grid strong {
          color: var(--app-text);
          font-size: 13.5px;
        }

        .application-message {
          border: 1px solid var(--app-brand-border);
          border-radius: 16px;
          background: var(--app-brand-soft);
          color: var(--app-text) !important;
          padding: 12px;
          margin: 0 0 14px !important;
        }

        .application-stepper {
          display: grid;
          grid-template-columns: repeat(5, minmax(90px, 1fr));
          gap: 8px;
          margin-top: 12px;
        }

        .application-step,
        .application-terminal-step {
          border: 1px solid var(--app-border);
          border-radius: 15px;
          padding: 9px 8px;
          text-align: center;
          color: var(--app-text-soft);
          background: var(--app-input-bg);
          font-size: 12px;
          font-weight: 900;
        }

        .application-step span {
          display: inline-grid;
          place-items: center;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          margin-bottom: 5px;
          background: var(--app-border-soft);
          color: var(--app-text-soft);
        }

        .application-step.is-active {
          border-color: var(--app-brand-border);
          color: var(--app-brand);
          background: var(--app-brand-soft);
        }

        .application-step.is-active span {
          background: var(--app-brand);
          color: #071814;
        }

        .application-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 14px;
        }

        .application-actions a,
        .my-applications-empty a,
        .my-applications-empty button {
          border: 1px solid var(--app-brand-border);
          border-radius: 999px;
          background: var(--app-brand-soft);
          color: var(--app-brand);
          padding: 9px 13px;
          font-family: inherit;
          font-weight: 900;
          text-decoration: none;
          cursor: pointer;
        }

        .my-applications-empty {
          min-height: 260px;
          display: grid;
          place-items: center;
          text-align: center;
          align-content: center;
          gap: 12px;
          color: var(--app-text-soft);
        }

        .my-applications-empty h2 {
          margin: 0;
          color: var(--app-text);
        }

        .my-applications-empty.error {
          color: #fecaca;
        }

        @media (max-width: 680px) {
          .application-card-head {
            grid-template-columns: auto 1fr;
          }

          .application-status {
            grid-column: 1 / -1;
            justify-self: start;
          }

          .application-stepper {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
    </main>
  );
};

export default MyApplicationsPage;
