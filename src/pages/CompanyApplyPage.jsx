import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import axios from "axios";
import API_BASE_URL from "../config/api";
import { trackEvent } from "../utils/analytics";
import {
  cityOptions as trainingCityOptions,
  specializationOptions,
} from "./TrainingFinderPage";

const pageFont = "'Aniq', 'Cairo', sans-serif";

const normalizeLabel = (value = "") =>
  value
    .toString()
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");

const initialForm = {
  fullName: "",
  email: "",
  major: "",
  city: "",
  portfolioUrl: "",
  linkedinUrl: "",
  note: "",
  consent: false,
};

const fieldStyle = {
  width: "100%",
  border: "1px solid rgba(102, 208, 195, 0.22)",
  borderRadius: 14,
  padding: "13px 14px",
  fontFamily: pageFont,
  fontSize: 15,
  color: "#163331",
  background: "rgba(255,255,255,0.92)",
  boxSizing: "border-box",
  outline: "none",
};

const labelStyle = {
  display: "grid",
  gap: 8,
  color: "#244845",
  fontSize: 13,
  fontWeight: 800,
};

const CompanyApplyPage = () => {
  const { companySlug = "" } = useParams();
  const [searchParams] = useSearchParams();
  const organizationName = useMemo(() => {
    const company = normalizeLabel(searchParams.get("company") || "");
    return company || normalizeLabel(companySlug) || "جهة تدريبية";
  }, [companySlug, searchParams]);
  const opportunityTitle =
    normalizeLabel(
      searchParams.get("role") ||
        searchParams.get("title") ||
        searchParams.get("opportunity") ||
        ""
    ) || "التدريب التعاوني";
  const opportunityId = searchParams.get("opportunityId") || "";
  const [form, setForm] = useState(() => ({
    ...initialForm,
    major: normalizeLabel(searchParams.get("major") || ""),
    city: normalizeLabel(searchParams.get("city") || ""),
  }));
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    document.title = `التقديم على ${organizationName} | دربك`;
    trackEvent("company_apply_page_viewed", {
      organizationName,
      companySlug,
      opportunityTitle,
      opportunityId,
    });
  }, [companySlug, opportunityId, opportunityTitle, organizationName]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      await axios.post(`${API_BASE_URL}/api/company-applications`, {
        ...form,
        companySlug,
        organizationName,
        opportunityTitle,
        opportunityId,
      });

      trackEvent("company_application_submitted", {
        organizationName,
        companySlug,
        opportunityTitle,
        opportunityId,
        city: form.city,
        major: form.major,
      });
      setSuccessMessage("تم إرسال طلبك، بنراجعه ونوصله للجهة حسب الاتفاق.");
      setForm(initialForm);
    } catch (err) {
      setErrorMessage(
        err.response?.data?.error ||
          "تعذر إرسال الطلب حاليًا. حاول مرة أخرى بعد قليل."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        padding: "clamp(22px, 5vw, 58px) 14px",
        fontFamily: pageFont,
        color: "#102523",
        background:
          "radial-gradient(circle at top right, rgba(125,219,205,0.28), transparent 34%), linear-gradient(180deg, #f8fffd 0%, #eef8f6 100%)",
      }}
    >
      <section
        style={{
          maxWidth: 980,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "minmax(0, 0.9fr) minmax(320px, 1.1fr)",
          gap: "clamp(18px, 4vw, 30px)",
          alignItems: "start",
        }}
        className="company-apply-shell"
      >
        <aside
          style={{
            border: "1px solid rgba(102,208,195,0.25)",
            borderRadius: 28,
            padding: "28px 24px",
            background: "linear-gradient(160deg, #102523 0%, #123936 100%)",
            color: "#fff",
            boxShadow: "0 24px 70px rgba(16,37,35,0.18)",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              padding: "7px 13px",
              borderRadius: 999,
              background: "rgba(125,219,205,0.14)",
              color: "#9ff2e8",
              fontWeight: 900,
              fontSize: 13,
            }}
          >
            صفحة تقديم خاصة
          </span>
          <h1
            style={{
              margin: "18px 0 10px",
              fontSize: "clamp(30px, 5vw, 48px)",
              lineHeight: 1.15,
              letterSpacing: 0,
            }}
          >
            قدّم على {organizationName}
          </h1>
          <p
            style={{
              color: "rgba(255,255,255,0.76)",
              lineHeight: 1.9,
              fontSize: 16,
              margin: "0 0 20px",
            }}
          >
            هذا النموذج مخصص لاستقبال طلبات الطلاب عبر دربك. اكتب بياناتك
            الأساسية، وراح نوصل الطلب بالطريقة المناسبة للجهة.
          </p>

          <div
            style={{
              display: "grid",
              gap: 10,
              marginTop: 24,
            }}
          >
            {[
              ["الفرصة", opportunityTitle],
              ["البيانات المطلوبة", "الاسم، الإيميل، التخصص، المدينة"],
              ["ملاحظة", "لا نطلب رقم الجوال في هذا النموذج"],
            ].map(([title, value]) => (
              <div
                key={title}
                style={{
                  padding: "13px 14px",
                  borderRadius: 18,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.055)",
                }}
              >
                <p
                  style={{
                    margin: "0 0 4px",
                    color: "#7ddbcd",
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  {title}
                </p>
                <strong style={{ fontSize: 15, fontWeight: 800 }}>{value}</strong>
              </div>
            ))}
          </div>

          <Link
            to="/where-to-train"
            style={{
              display: "inline-flex",
              marginTop: 24,
              color: "#9ff2e8",
              textDecoration: "none",
              fontWeight: 900,
            }}
          >
            العودة إلى وين أتدرب
          </Link>
        </aside>

        <form
          onSubmit={handleSubmit}
          style={{
            border: "1px solid rgba(102,208,195,0.22)",
            borderRadius: 28,
            padding: "clamp(18px, 4vw, 28px)",
            background: "rgba(255,255,255,0.82)",
            boxShadow: "0 20px 55px rgba(16,37,35,0.12)",
            backdropFilter: "blur(14px)",
          }}
        >
          <h2 style={{ margin: "0 0 8px", fontSize: 26, letterSpacing: 0 }}>
            بيانات التقديم
          </h2>
          <p style={{ margin: "0 0 20px", color: "#5c726f", lineHeight: 1.8 }}>
            خلك مختصر وواضح. نحتاج الإيميل فقط للتواصل الرسمي بخصوص الطلب.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 14,
            }}
            className="company-apply-form-grid"
          >
            <label style={labelStyle}>
              الاسم الكامل
              <input
                value={form.fullName}
                onChange={(e) => updateField("fullName", e.target.value)}
                placeholder="مثال: نورة محمد"
                required
                maxLength={120}
                style={fieldStyle}
              />
            </label>

            <label style={labelStyle}>
              البريد الإلكتروني
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="name@email.com"
                required
                maxLength={160}
                style={fieldStyle}
              />
            </label>

            <label style={labelStyle}>
              التخصص
              <input
                value={form.major}
                onChange={(e) => updateField("major", e.target.value)}
                placeholder="اكتب تخصصك"
                list="company-apply-majors"
                maxLength={140}
                style={fieldStyle}
              />
              <datalist id="company-apply-majors">
                {specializationOptions.map((option) => (
                  <option key={option.label} value={option.label} />
                ))}
              </datalist>
            </label>

            <label style={labelStyle}>
              المدينة
              <input
                value={form.city}
                onChange={(e) => updateField("city", e.target.value)}
                placeholder="اكتب المدينة"
                list="company-apply-cities"
                maxLength={120}
                style={fieldStyle}
              />
              <datalist id="company-apply-cities">
                {trainingCityOptions.map((city) => (
                  <option key={city} value={city} />
                ))}
              </datalist>
            </label>

            <label style={labelStyle}>
              رابط ملف الأعمال في دربك
              <input
                value={form.portfolioUrl}
                onChange={(e) => updateField("portfolioUrl", e.target.value)}
                placeholder="https://darbak.space/p/name"
                maxLength={300}
                style={fieldStyle}
              />
            </label>

            <label style={labelStyle}>
              رابط LinkedIn
              <input
                value={form.linkedinUrl}
                onChange={(e) => updateField("linkedinUrl", e.target.value)}
                placeholder="https://linkedin.com/in/name"
                maxLength={300}
                style={fieldStyle}
              />
            </label>
          </div>

          <label style={{ ...labelStyle, marginTop: 14 }}>
            ملاحظة مختصرة للجهة
            <textarea
              value={form.note}
              onChange={(e) => updateField("note", e.target.value)}
              placeholder="مثال: مهتم بالتدريب في مجال تحليل البيانات، ومتاح للتدريب خلال الفصل القادم."
              rows={5}
              maxLength={1200}
              style={{ ...fieldStyle, resize: "vertical", lineHeight: 1.8 }}
            />
          </label>

          <label
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              marginTop: 16,
              color: "#3c5e5a",
              lineHeight: 1.8,
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            <input
              type="checkbox"
              checked={form.consent}
              onChange={(e) => updateField("consent", e.target.checked)}
              required
              style={{ marginTop: 7, accentColor: "#45b9aa" }}
            />
            أوافق على مشاركة بيانات هذا الطلب مع الجهة لغرض التقديم والمتابعة فقط.
          </label>

          {successMessage && (
            <p
              style={{
                margin: "16px 0 0",
                padding: "12px 14px",
                borderRadius: 14,
                background: "rgba(69,185,170,0.12)",
                color: "#17655c",
                fontWeight: 900,
              }}
            >
              {successMessage}
            </p>
          )}

          {errorMessage && (
            <p
              style={{
                margin: "16px 0 0",
                padding: "12px 14px",
                borderRadius: 14,
                background: "rgba(220,38,38,0.08)",
                color: "#9f1239",
                fontWeight: 900,
              }}
            >
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%",
              marginTop: 18,
              border: "none",
              borderRadius: 16,
              padding: "15px 18px",
              background: submitting
                ? "linear-gradient(135deg, #9bd8cf, #7cc6bd)"
                : "linear-gradient(135deg, #7ddbcd, #45b9aa)",
              color: "#102523",
              fontFamily: pageFont,
              fontSize: 17,
              fontWeight: 950,
              cursor: submitting ? "wait" : "pointer",
              boxShadow: "0 14px 35px rgba(69,185,170,0.22)",
            }}
          >
            {submitting ? "جاري الإرسال..." : "إرسال الطلب"}
          </button>
        </form>
      </section>

      <style>
        {`
          @media (max-width: 820px) {
            .company-apply-shell {
              grid-template-columns: 1fr !important;
            }

            .company-apply-form-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}
      </style>
    </main>
  );
};

export default CompanyApplyPage;
