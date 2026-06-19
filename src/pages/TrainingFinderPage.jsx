import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import majors from "../majors";
import API_BASE_URL from "../config/api";

const cityOptions = [
  "الرياض",
  "جدة",
  "الدمام",
  "مكة المكرمة",
  "المدينة المنورة",
  "الخبر",
  "الظهران",
  "الأحساء",
  "الجبيل",
  "الطائف",
  "تبوك",
  "أبها",
  "خميس مشيط",
  "نجران",
  "جازان",
  "الباحة",
  "حائل",
  "بريدة",
  "ينبع",
  "الخرج",
];

const pageFont = "'Aniq', 'Cairo', sans-serif";

export default function TrainingFinderPage() {
  const [majorCategory, setMajorCategory] = useState("");
  const [city, setCity] = useState("");
  const [targets, setTargets] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedMajorLabel = useMemo(
    () => majors.find((major) => major.name === majorCategory)?.name || "",
    [majorCategory]
  );

  const fetchTrainingTargets = async (event) => {
    event.preventDefault();

    if (!majorCategory) {
      setError("اختَر التخصص الرئيسي أولًا.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSearched(true);

      const { data } = await axios.get(`${API_BASE_URL}/api/training-targets`, {
        params: { majorCategory, city },
      });

      setTargets(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      console.error(err);
      setError("تعذر عرض النتائج حاليًا.");
      setTargets([]);
    } finally {
      setLoading(false);
    }
  };

  const buildCareerSearchUrl = (organizationName) =>
    `https://www.google.com/search?q=${encodeURIComponent(
      `${organizationName} تدريب تعاوني وظائف`
    )}`;

  return (
    <main
      style={{
        width: "100%",
        minHeight: "70vh",
        direction: "rtl",
        fontFamily: pageFont,
        color: "var(--app-text)",
      }}
    >
      <section
        style={{
          width: "min(100%, 980px)",
          margin: "0 auto",
          display: "grid",
          gap: "18px",
        }}
      >
        <header style={{ textAlign: "center" }}>
          <p
            style={{
              margin: "0 0 8px",
              color: "var(--app-brand)",
              fontSize: "14px",
              fontWeight: "800",
            }}
          >
            بناءً على تجارب الطلاب السابقة
          </p>
          <h1
            style={{
              margin: 0,
              color: "var(--app-text)",
              fontSize: "clamp(28px, 4vw, 44px)",
              lineHeight: 1.35,
            }}
          >
            وين أتدرب؟
          </h1>
          <p
            style={{
              margin: "12px auto 0",
              maxWidth: "650px",
              color: "var(--app-text-soft)",
              lineHeight: 1.8,
              fontSize: "15px",
            }}
          >
            اختَر تخصصك الرئيسي، وإذا ودك حدد المدينة، ونقترح لك جهات سبق أن
            شارك الطلاب تجارب تدريبهم فيها.
          </p>
        </header>

        <form
          onSubmit={fetchTrainingTargets}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr) auto",
            gap: "10px",
            alignItems: "end",
            background: "var(--app-surface)",
            border: "1px solid var(--app-border)",
            borderRadius: "16px",
            padding: "14px",
          }}
          className="training-finder-form"
        >
          <label style={{ display: "grid", gap: "7px", color: "var(--app-text-soft)", fontSize: "13px" }}>
            التخصص الرئيسي
            <select
              value={majorCategory}
              onChange={(event) => setMajorCategory(event.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "12px",
                border: "1px solid var(--app-border)",
                background: "var(--app-input-bg)",
                color: "var(--app-text)",
                fontFamily: "inherit",
              }}
            >
              <option value="">اختر التخصص</option>
              {majors.map((major) => (
                <option key={major.name} value={major.name}>
                  {major.name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: "7px", color: "var(--app-text-soft)", fontSize: "13px" }}>
            المدينة
            <select
              value={city}
              onChange={(event) => setCity(event.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "12px",
                border: "1px solid var(--app-border)",
                background: "var(--app-input-bg)",
                color: "var(--app-text)",
                fontFamily: "inherit",
              }}
            >
              <option value="">كل المدن</option>
              {cityOptions.map((cityName) => (
                <option key={cityName} value={cityName}>
                  {cityName}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            disabled={loading}
            style={{
              background: "var(--app-brand)",
              color: "#07100e",
              border: "none",
              borderRadius: "12px",
              padding: "13px 20px",
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              fontWeight: "900",
              whiteSpace: "nowrap",
              boxShadow: "0 0 14px var(--app-brand-border)",
            }}
          >
            {loading ? "جاري البحث..." : "اعرض الجهات"}
          </button>
        </form>

        {error && (
          <p
            style={{
              margin: 0,
              color: "#fecdd3",
              textAlign: "center",
              background: "rgba(244,63,94,0.08)",
              border: "1px solid rgba(244,63,94,0.18)",
              borderRadius: "12px",
              padding: "10px",
            }}
          >
            {error}
          </p>
        )}

        {searched && !loading && !error && (
          <section style={{ display: "grid", gap: "14px" }}>
            <h2
              style={{
                margin: 0,
                color: "var(--app-text)",
                fontSize: "20px",
                lineHeight: 1.5,
              }}
            >
              نتائج {selectedMajorLabel}
              {city ? ` في ${city}` : ""}
            </h2>

            {targets.length === 0 ? (
              <div
                style={{
                  background: "var(--app-surface)",
                  border: "1px solid var(--app-border)",
                  borderRadius: "16px",
                  padding: "18px",
                  textAlign: "center",
                  color: "var(--app-text-soft)",
                  lineHeight: 1.8,
                }}
              >
                ما لقينا جهات مطابقة في التجارب الحالية. جرّب مدينة أخرى أو
                ابحث بدون تحديد مدينة.
              </div>
            ) : (
              <div
                className="training-targets-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: "12px",
                }}
              >
                {targets.map((target) => (
                  <article
                    key={target.organizationName}
                    style={{
                      background: "var(--app-surface)",
                      border: "1px solid var(--app-border)",
                      borderRadius: "16px",
                      padding: "16px",
                      display: "grid",
                      gap: "12px",
                      boxShadow: "0 10px 24px var(--app-shadow)",
                    }}
                  >
                    <div>
                      <h3
                        style={{
                          margin: "0 0 6px",
                          color: "var(--app-brand)",
                          fontSize: "24px",
                          lineHeight: 1.3,
                        }}
                      >
                        {target.organizationName}
                      </h3>
                      <p
                        style={{
                          margin: 0,
                          color: "var(--app-text-soft)",
                          fontSize: "13px",
                        }}
                      >
                        {target.cities?.join("، ") || "مدينة غير محددة"}
                      </p>
                    </div>

                    <div
                      style={{
                        background: "var(--app-card)",
                        border: "1px solid var(--app-border)",
                        borderRadius: "12px",
                        padding: "11px",
                      }}
                    >
                      <p style={{ margin: "0 0 7px", color: "var(--app-brand)", fontWeight: "800", fontSize: "13px" }}>
                        سبق أن تدرب فيها طلاب من:
                      </p>
                      <p style={{ margin: 0, color: "var(--app-text-soft)", fontSize: "13px", lineHeight: 1.7 }}>
                        {target.majors?.length ? target.majors.join("، ") : "تخصصات غير محددة"}
                      </p>
                    </div>

                    <div>
                      <p style={{ margin: "0 0 8px", color: "var(--app-brand)", fontWeight: "800", fontSize: "13px" }}>
                        طرق الحصول على الفرصة المذكورة:
                      </p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
                        {(target.methods?.length ? target.methods : ["غير محدد"]).map((method) => (
                          <span
                            key={method}
                            style={{
                              background: "var(--app-brand-soft)",
                              border: "1px solid var(--app-brand-border)",
                              color: "var(--app-text-soft)",
                              borderRadius: "999px",
                              padding: "6px 9px",
                              fontSize: "12px",
                            }}
                          >
                            {method}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <Link to="/experiences" style={{ textDecoration: "none" }}>
                        <button
                          type="button"
                          style={{
                            background: "var(--app-brand)",
                            color: "#07100e",
                            border: "none",
                            borderRadius: "10px",
                            padding: "9px 12px",
                            fontFamily: "inherit",
                            fontWeight: "800",
                            cursor: "pointer",
                          }}
                        >
                          قراءة التجارب
                        </button>
                      </Link>
                      <a
                        href={buildCareerSearchUrl(target.organizationName)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ textDecoration: "none" }}
                      >
                        <button
                          type="button"
                          style={{
                            background: "var(--app-input-bg)",
                            color: "var(--app-brand)",
                            border: "1px solid var(--app-brand-border)",
                            borderRadius: "10px",
                            padding: "9px 12px",
                            fontFamily: "inherit",
                            fontWeight: "800",
                            cursor: "pointer",
                          }}
                        >
                          زيارة صفحة التوظيف
                        </button>
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <p
              style={{
                margin: "6px 0 0",
                color: "var(--app-muted)",
                fontSize: "13px",
                lineHeight: 1.8,
                textAlign: "center",
              }}
            >
              الجهات المعروضة مبنية على تجارب طلاب سابقة، ولا يعني ظهور الجهة
              توفر فرصة تدريب حاليًا.
            </p>
          </section>
        )}
      </section>

      <style>{`
        @media (max-width: 760px) {
          .training-finder-form {
            grid-template-columns: 1fr !important;
          }

          .training-targets-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}
