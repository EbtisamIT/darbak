import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import axios from "axios";
import API_BASE_URL from "../config/api";
import { trackEvent } from "../utils/analytics";
import {
  PREMIUM_ACCESS_EVENT,
  PREMIUM_STATUS_EVENT,
  getAccessHeaders,
  getStoredAccessIdentity,
} from "../utils/premiumAccess";

const pageFont = "'IBM Plex Sans Arabic', 'Aniq', 'Cairo', sans-serif";

const normalizeLabel = (value) =>
  String(value ?? "")
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");

const getQueryValue = (searchParams, keys = []) => {
  for (const key of keys) {
    const value = normalizeLabel(searchParams.get(key) || "");
    if (value) return value;
  }
  return "";
};

const buildCustomQuestions = (searchParams) => {
  const questions = [
    searchParams.get("question"),
    searchParams.get("question1"),
    searchParams.get("question2"),
    searchParams.get("question3"),
  ]
    .map(normalizeLabel)
    .filter(Boolean);

  if (questions.length) {
    return questions.map((question) => ({ question, answer: "" }));
  }

  return [
    {
      question: "ملاحظات إضافية ترغب أن تراها الجهة قبل مراجعة ملفك",
      answer: "",
    },
  ];
};

const statusColors = {
  submitted: ["#66d0c3", "rgba(102,208,195,0.12)"],
  under_review: ["#f2c94c", "rgba(242,201,76,0.12)"],
  shortlisted: ["#7ddbcd", "rgba(125,219,205,0.14)"],
  interview: ["#93c5fd", "rgba(147,197,253,0.12)"],
  accepted: ["#86efac", "rgba(134,239,172,0.12)"],
  rejected: ["#fca5a5", "rgba(252,165,165,0.12)"],
  withdrawn: ["#cbd5e1", "rgba(203,213,225,0.1)"],
};

const InfoBlock = ({ label, value, href }) => (
  <div className="company-apply-info-block">
    <span>{label}</span>
    {href && value ? (
      <a href={href} target="_blank" rel="noreferrer">
        {value}
      </a>
    ) : (
      <strong>{value || "غير مضاف"}</strong>
    )}
  </div>
);

const ListPreview = ({ title, items = [], emptyText = "غير مضاف" }) => (
  <section className="company-apply-review-section">
    <h3>{title}</h3>
    {items.length ? (
      <div className="company-apply-chip-list">
        {items.map((item, index) => {
          const label =
            typeof item === "string"
              ? item
              : item.title || item.provider || item.description || "عنصر";
          const description =
            typeof item === "string"
              ? ""
              : [item.provider, item.year, item.description, item.url]
                  .filter(Boolean)
                  .join(" · ");

          return (
            <div key={`${label}-${index}`} className="company-apply-chip-card">
              <strong>{label}</strong>
              {description && <span>{description}</span>}
            </div>
          );
        })}
      </div>
    ) : (
      <p className="company-apply-muted">{emptyText}</p>
    )}
  </section>
);

const CompanyApplyPage = () => {
  const { companySlug = "" } = useParams();
  const [searchParams] = useSearchParams();
  const organizationName = useMemo(() => {
    const company = getQueryValue(searchParams, ["company", "organizationName"]);
    return company || normalizeLabel(companySlug) || "جهة تدريبية";
  }, [companySlug, searchParams]);
  const opportunityTitle =
    getQueryValue(searchParams, ["role", "title", "opportunity", "opportunityTitle"]) ||
    "التدريب التعاوني";
  const opportunityId = searchParams.get("opportunityId") || "";
  const organizationLogoUrl =
    searchParams.get("organizationLogoUrl") || searchParams.get("logoUrl") || "";
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [customAnswers, setCustomAnswers] = useState(() =>
    buildCustomQuestions(searchParams)
  );

  const identity = getStoredAccessIdentity();
  const hasIdentity = Boolean(identity.contact && identity.accessCode);

  const fetchContext = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const { data } = await axios.get(
        `${API_BASE_URL}/api/company-apply/${companySlug}/context`,
        {
          params: {
            company: organizationName,
            opportunityTitle,
            opportunityId,
            organizationLogoUrl,
          },
          headers: getAccessHeaders(),
        }
      );
      setContext(data);
    } catch (err) {
      if (err.response?.status === 401) {
        setContext({ requiresLogin: true });
      } else {
        setErrorMessage(
          err.response?.data?.error ||
            "تعذر تجهيز صفحة التقديم حاليًا. حاول مرة أخرى بعد قليل."
        );
      }
    } finally {
      setLoading(false);
    }
  }, [companySlug, opportunityId, opportunityTitle, organizationLogoUrl, organizationName]);

  useEffect(() => {
    document.title = `التقديم على ${organizationName} | دربك`;
    trackEvent("company_apply_page_viewed", {
      organizationName,
      companySlug,
      opportunityTitle,
      opportunityId,
    });
  }, [companySlug, opportunityId, opportunityTitle, organizationName]);

  useEffect(() => {
    fetchContext();

    const refreshAfterLogin = () => fetchContext();
    window.addEventListener(PREMIUM_STATUS_EVENT, refreshAfterLogin);
    window.addEventListener("storage", refreshAfterLogin);
    window.addEventListener("focus", refreshAfterLogin);
    return () => {
      window.removeEventListener(PREMIUM_STATUS_EVENT, refreshAfterLogin);
      window.removeEventListener("storage", refreshAfterLogin);
      window.removeEventListener("focus", refreshAfterLogin);
    };
  }, [fetchContext]);

  const openLogin = () => {
    setErrorMessage("");
    window.dispatchEvent(
      new CustomEvent(PREMIUM_ACCESS_EVENT, {
        detail: {
          loginOnly: true,
          feature: "company_apply",
          title: "تسجيل الدخول للتقديم",
          source: "company_apply",
        },
      })
    );
  };

  const updateAnswer = (index, answer) => {
    setCustomAnswers((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, answer } : item
      )
    );
  };

  useEffect(() => {
    const campaignQuestions = context?.campaign?.customQuestions;
    if (!Array.isArray(campaignQuestions) || campaignQuestions.length === 0) {
      return;
    }

    setCustomAnswers((prev) => {
      const previousAnswers = new Map(
        prev.map((item) => [item.question, item.answer || ""])
      );

      return campaignQuestions.map((item) => ({
        question: item.question,
        required: Boolean(item.required),
        answer: previousAnswers.get(item.question) || "",
      }));
    });
  }, [context?.campaign?.id, context?.campaign?.customQuestions]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/api/company-applications`,
        {
          usePortfolio: true,
          companySlug: context?.campaign?.slug || companySlug,
          campaignSlug: context?.campaign?.slug || companySlug,
          organizationName: context?.campaign?.organizationName || organizationName,
          organizationLogoUrl:
            context?.campaign?.organizationLogoUrl || organizationLogoUrl,
          opportunityTitle: context?.campaign?.opportunityTitle || opportunityTitle,
          opportunityId,
          customAnswers,
          consent,
        },
        { headers: getAccessHeaders() }
      );

      trackEvent("company_application_submitted", {
        organizationName,
        companySlug,
        opportunityTitle,
        opportunityId,
        city: data.data?.city || context?.snapshot?.city || "",
        major: data.data?.major || context?.snapshot?.major || "",
      });
      setSuccessMessage("تم إرسال طلبك بنجاح. تقدر تتابع حالته من صفحة طلباتي.");
      fetchContext();
    } catch (err) {
      setErrorMessage(
        err.response?.data?.error ||
          "تعذر إرسال الطلب حاليًا. حاول مرة أخرى بعد قليل."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const snapshot = context?.snapshot || {};
  const missingFields = Array.isArray(context?.missingFields)
    ? context.missingFields
    : [];
  const existingApplication = context?.existingApplication;
  const statusTone =
    statusColors[existingApplication?.status] || statusColors.submitted;
  const displayOrganizationName =
    context?.campaign?.organizationName || organizationName;
  const displayOpportunityTitle =
    context?.campaign?.opportunityTitle || opportunityTitle;
  const displayOrganizationLogoUrl =
    context?.campaign?.organizationLogoUrl || organizationLogoUrl;
  const hasMissingRequiredAnswers = customAnswers.some(
    (item) => item.required && !item.answer?.trim()
  );

  return (
    <main dir="rtl" className="company-apply-page">
      <section className="company-apply-shell">
        <aside className="company-apply-hero">
          <span className="company-apply-badge">تقديم عبر ملفك المهني</span>
          <h1>قدّم على {displayOrganizationName}</h1>
          <p>
            دربك يجهز بياناتك من ملفك المهني مباشرة. راجع معلوماتك، جاوب
            أسئلة البرنامج إن وجدت، ثم أرسل طلبك بدون تعبئة مكررة.
          </p>

          <div className="company-apply-summary">
            <InfoBlock label="البرنامج" value={displayOpportunityTitle} />
            <InfoBlock label="طريقة التقديم" value="ملفك المهني في دربك" />
            <InfoBlock
              label="الموافقة"
              value="مطلوبة قبل مشاركة بياناتك مع الجهة"
            />
          </div>

          {context?.campaign?.description && (
            <p className="company-apply-campaign-description">
              {context.campaign.description}
            </p>
          )}
        </aside>

        <section className="company-apply-card">
          {loading ? (
            <div className="company-apply-state">جار تجهيز بياناتك...</div>
          ) : context?.requiresLogin || !hasIdentity ? (
            <div className="company-apply-state">
              <h2>سجّل الدخول عشان نربط الطلب بملفك المهني</h2>
              <p>
                نحتاج بريدك ورمز الدخول فقط، وبعدها نجيب بيانات ملف الأعمال
                تلقائيًا ونجهز صفحة المراجعة.
              </p>
              <button type="button" onClick={openLogin}>
                تسجيل الدخول أو إنشاء حساب
              </button>
            </div>
          ) : context?.campaign && !context.campaign.isOpen ? (
            <div className="company-apply-state">
              <h2>التقديم على هذا البرنامج مغلق حاليًا</h2>
              <p>
                البرنامج موجود في دربك، لكن حالته الآن لا تسمح باستقبال طلبات
                جديدة. تقدر تتابع فرص أخرى من صفحة وين أتدرب.
              </p>
              <Link to="/where-to-train" className="company-apply-primary-link">
                استكشف فرص أخرى
              </Link>
            </div>
          ) : missingFields.length ? (
            <div className="company-apply-state">
              <h2>أكمل ملفك المهني أولًا</h2>
              <p>
                قبل إرسال الطلب للجهة، أضف البيانات الأساسية التالية في ملف
                الأعمال:
              </p>
              <div className="company-apply-missing-list">
                {missingFields.map((item) => (
                  <span key={item.field}>{item.label}</span>
                ))}
              </div>
              <Link to="/portfolio" className="company-apply-primary-link">
                إكمال ملفي المهني
              </Link>
            </div>
          ) : existingApplication ? (
            <div className="company-apply-state">
              <h2>سبق وأرسلت طلبك لهذه الجهة</h2>
              <p>
                تقدر تتابع الحالة من صفحة طلباتي، وأي تحديث من الإدارة بيظهر لك
                هناك.
              </p>
              <div
                className="company-apply-status-pill"
                style={{ color: statusTone[0], background: statusTone[1] }}
              >
                {existingApplication.statusLabel || "تم الإرسال"}
              </div>
              <Link to="/applications" className="company-apply-primary-link">
                عرض طلباتي
              </Link>
            </div>
          ) : (
            <>
              <div className="company-apply-card-header">
                <div>
                  <span>مراجعة قبل الإرسال</span>
                  <h2>بيانات ملفك المهني</h2>
                </div>
                {displayOrganizationLogoUrl && (
                  <img src={displayOrganizationLogoUrl} alt={displayOrganizationName} />
                )}
              </div>

              {errorMessage && <p className="company-apply-error">{errorMessage}</p>}
              {successMessage && (
                <p className="company-apply-success">{successMessage}</p>
              )}

              <div className="company-apply-grid">
                <InfoBlock label="الاسم" value={snapshot.fullName} />
                <InfoBlock label="البريد" value={snapshot.email} />
                <InfoBlock label="رقم الجوال" value={snapshot.phone} />
                <InfoBlock label="التخصص" value={snapshot.major} />
                <InfoBlock label="الجامعة" value={snapshot.university} />
                <InfoBlock label="المدينة" value={snapshot.city} />
                <InfoBlock label="درجة الشهادة" value={snapshot.degreeLevel} />
                <InfoBlock label="حالة الجاهزية" value={snapshot.readinessStatus} />
                <InfoBlock
                  label="السيرة الذاتية"
                  value={snapshot.cvUrl ? "عرض السيرة" : ""}
                  href={snapshot.cvUrl}
                />
                <InfoBlock
                  label="LinkedIn"
                  value={snapshot.linkedinUrl ? "فتح LinkedIn" : ""}
                  href={snapshot.linkedinUrl}
                />
                <InfoBlock
                  label="رابط الملف المهني"
                  value={snapshot.portfolioUrl ? "عرض الملف" : ""}
                  href={snapshot.portfolioUrl}
                />
              </div>

              <section className="company-apply-review-section">
                <h3>نبذة شخصية</h3>
                <p className="company-apply-long-text">
                  {snapshot.bio || "غير مضافة"}
                </p>
              </section>

              <ListPreview title="المهارات" items={snapshot.skills || []} />
              <ListPreview title="المشاريع" items={snapshot.projects || []} />
              <ListPreview
                title="الشهادات والدورات"
                items={snapshot.certifications || []}
              />

              <section className="company-apply-review-section">
                <h3>أسئلة البرنامج الإضافية</h3>
                <div className="company-apply-questions">
                  {customAnswers.map((item, index) => (
                    <label key={`${item.question}-${index}`}>
                      <span>{item.question}</span>
                      <textarea
                        value={item.answer}
                        onChange={(event) => updateAnswer(index, event.target.value)}
                        placeholder={item.required ? "مطلوب" : "اختياري"}
                        rows={3}
                      />
                    </label>
                  ))}
                </div>
              </section>

              <label className="company-apply-consent">
                  <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                />
                <span>
                  أوافق على مشاركة بيانات ملفي المهني مع {displayOrganizationName} لغرض
                  مراجعة طلب التقديم.
                </span>
              </label>

              <div className="company-apply-actions">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!consent || submitting || hasMissingRequiredAnswers}
                >
                  {submitting ? "جار الإرسال..." : "إرسال الطلب"}
                </button>
                <Link to="/applications">طلباتي</Link>
              </div>
            </>
          )}
        </section>
      </section>

      <style>{`
        .company-apply-page {
          min-height: 100vh;
          padding: clamp(22px, 5vw, 58px) 14px;
          font-family: ${pageFont};
          color: var(--app-text);
          background:
            radial-gradient(circle at top right, color-mix(in srgb, var(--app-brand) 22%, transparent), transparent 34%),
            var(--app-bg);
        }

        .company-apply-shell {
          max-width: 1080px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(280px, 0.82fr) minmax(0, 1.18fr);
          gap: clamp(18px, 4vw, 30px);
          align-items: start;
        }

        .company-apply-hero,
        .company-apply-card {
          border: 1px solid var(--app-border);
          border-radius: 26px;
          box-shadow: 0 24px 70px var(--app-shadow);
        }

        .company-apply-hero {
          position: sticky;
          top: 92px;
          padding: 28px 24px;
          background: linear-gradient(160deg, #102523 0%, #123936 100%);
          color: #fff;
        }

        .company-apply-badge {
          display: inline-flex;
          padding: 7px 13px;
          border-radius: 999px;
          background: rgba(125, 219, 205, 0.14);
          color: #9ff2e8;
          font-weight: 900;
          font-size: 13px;
        }

        .company-apply-hero h1 {
          margin: 18px 0 10px;
          font-size: clamp(30px, 5vw, 48px);
          line-height: 1.15;
          letter-spacing: 0;
        }

        .company-apply-hero p {
          color: rgba(255, 255, 255, 0.76);
          line-height: 1.9;
          font-size: 16px;
          margin: 0 0 20px;
        }

        .company-apply-summary {
          display: grid;
          gap: 10px;
          margin-top: 24px;
        }

        .company-apply-campaign-description {
          margin: 18px 0 0 !important;
          padding-top: 16px;
          border-top: 1px solid rgba(255,255,255,0.12);
          white-space: pre-wrap;
          font-size: 14px !important;
        }

        .company-apply-card {
          padding: clamp(18px, 4vw, 26px);
          background: color-mix(in srgb, var(--app-surface) 94%, transparent);
        }

        .company-apply-card-header {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .company-apply-card-header span {
          color: var(--app-brand);
          font-size: 13px;
          font-weight: 900;
        }

        .company-apply-card-header h2,
        .company-apply-state h2 {
          margin: 5px 0 0;
          color: var(--app-text);
          font-size: clamp(24px, 4vw, 34px);
          letter-spacing: 0;
        }

        .company-apply-card-header img {
          width: 64px;
          height: 64px;
          border-radius: 18px;
          object-fit: contain;
          background: #fff;
          border: 1px solid var(--app-border);
          padding: 8px;
        }

        .company-apply-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
          gap: 10px;
        }

        .company-apply-info-block,
        .company-apply-chip-card {
          border: 1px solid var(--app-border);
          border-radius: 16px;
          padding: 12px 13px;
          background: var(--app-input-bg);
        }

        .company-apply-info-block span,
        .company-apply-chip-card span,
        .company-apply-muted {
          color: var(--app-text-soft);
          font-size: 12px;
          line-height: 1.7;
        }

        .company-apply-info-block strong,
        .company-apply-info-block a,
        .company-apply-chip-card strong {
          display: block;
          margin-top: 5px;
          color: var(--app-text);
          font-size: 14px;
          font-weight: 900;
          text-decoration: none;
          overflow-wrap: anywhere;
        }

        .company-apply-info-block a {
          color: var(--app-brand);
        }

        .company-apply-review-section {
          margin-top: 14px;
          border: 1px solid var(--app-border);
          border-radius: 18px;
          padding: 14px;
          background: color-mix(in srgb, var(--app-input-bg) 74%, transparent);
        }

        .company-apply-review-section h3 {
          margin: 0 0 10px;
          color: var(--app-brand);
          font-size: 17px;
        }

        .company-apply-long-text {
          margin: 0;
          color: var(--app-text);
          line-height: 1.9;
          white-space: pre-wrap;
        }

        .company-apply-chip-list {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 9px;
        }

        .company-apply-questions {
          display: grid;
          gap: 10px;
        }

        .company-apply-questions label {
          display: grid;
          gap: 8px;
          color: var(--app-text);
          font-weight: 900;
        }

        .company-apply-questions textarea {
          width: 100%;
          border: 1px solid var(--app-border);
          border-radius: 14px;
          padding: 12px;
          font-family: inherit;
          color: var(--app-text);
          background: var(--app-surface);
          resize: vertical;
          box-sizing: border-box;
          line-height: 1.8;
        }

        .company-apply-consent {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          margin: 16px 0;
          color: var(--app-text);
          line-height: 1.8;
          font-weight: 800;
        }

        .company-apply-consent input {
          margin-top: 8px;
          accent-color: var(--app-brand);
        }

        .company-apply-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
        }

        .company-apply-actions button,
        .company-apply-state button,
        .company-apply-primary-link {
          border: none;
          border-radius: 15px;
          background: var(--app-brand);
          color: #071814;
          padding: 13px 18px;
          font-family: inherit;
          font-weight: 900;
          text-decoration: none;
          cursor: pointer;
        }

        .company-apply-actions button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .company-apply-actions a {
          color: var(--app-brand);
          font-weight: 900;
          text-decoration: none;
          padding: 12px;
        }

        .company-apply-state {
          display: grid;
          gap: 14px;
          min-height: 280px;
          place-items: center;
          text-align: center;
          align-content: center;
        }

        .company-apply-state p {
          margin: 0;
          color: var(--app-text-soft);
          max-width: 520px;
          line-height: 1.9;
        }

        .company-apply-missing-list {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 8px;
        }

        .company-apply-missing-list span,
        .company-apply-status-pill {
          border: 1px solid var(--app-border);
          border-radius: 999px;
          padding: 8px 11px;
          color: var(--app-brand);
          background: var(--app-brand-soft);
          font-weight: 900;
          font-size: 13px;
        }

        .company-apply-error,
        .company-apply-success {
          border-radius: 14px;
          padding: 11px 13px;
          line-height: 1.8;
          font-weight: 800;
        }

        .company-apply-error {
          color: #fecaca;
          background: rgba(127, 29, 29, 0.18);
          border: 1px solid rgba(248, 113, 113, 0.32);
        }

        .company-apply-success {
          color: var(--app-brand);
          background: var(--app-brand-soft);
          border: 1px solid var(--app-brand-border);
        }

        @media (max-width: 820px) {
          .company-apply-shell {
            grid-template-columns: 1fr;
          }

          .company-apply-hero {
            position: static;
            border-radius: 22px;
          }
        }

        @media (max-width: 560px) {
          .company-apply-page {
            padding: 14px 10px 28px;
          }

          .company-apply-hero,
          .company-apply-card {
            border-radius: 20px;
          }

          .company-apply-grid,
          .company-apply-chip-list {
            grid-template-columns: 1fr;
          }

          .company-apply-actions button,
          .company-apply-primary-link {
            width: 100%;
            text-align: center;
          }
        }
      `}</style>
    </main>
  );
};

export default CompanyApplyPage;
