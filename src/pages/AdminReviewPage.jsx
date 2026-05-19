import React, { useEffect, useState } from "react";
import axios from "axios";
import API_BASE_URL from "../config/api";

const cardStyle = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "14px",
  padding: "16px",
  textAlign: "right",
};

export default function AdminReviewPage() {
  const [password, setPassword] = useState(
    () => sessionStorage.getItem("darbak_admin_password") || ""
  );
  const [status, setStatus] = useState("pending");
  const [experiences, setExperiences] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const authHeaders = password ? { "x-admin-password": password } : {};

  const fetchExperiences = async () => {
    if (!password) {
      setMessage("اكتبي كلمة المرور لعرض التجارب.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");
      sessionStorage.setItem("darbak_admin_password", password);

      const { data } = await axios.get(`${API_BASE_URL}/api/admin/experiences`, {
        params: { status },
        headers: authHeaders,
      });

      setExperiences(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      console.error(err);
      setMessage(
        err.response?.status === 401
          ? "كلمة المرور غير صحيحة."
          : "تعذر تحميل التجارب."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (password) fetchExperiences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const updateStatus = async (id, nextStatus) => {
    try {
      setMessage("");
      await axios.patch(
        `${API_BASE_URL}/api/admin/experiences/${id}/status`,
        { status: nextStatus },
        { headers: authHeaders }
      );
      setExperiences((prev) => prev.filter((exp) => exp._id !== id));
    } catch (err) {
      console.error(err);
      setMessage("تعذر تحديث حالة التجربة.");
    }
  };

  return (
    <main
      style={{
        direction: "rtl",
        width: "100%",
        maxWidth: "1000px",
        margin: "0 auto",
        fontFamily: "'Cairo', sans-serif",
      }}
    >
      <header style={{ marginBottom: "20px", textAlign: "right" }}>
        <h1 style={{ color: "#fff", margin: 0 }}>مراجعة التجارب</h1>
        <p style={{ color: "#9ca3af", lineHeight: 1.8 }}>
          صفحة خاصة لاعتماد أو رفض التجارب قبل ظهورها للزوار.
        </p>
      </header>

      <section
        style={{
          ...cardStyle,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto auto",
          gap: "10px",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="كلمة مرور الإدارة"
          style={{
            width: "100%",
            boxSizing: "border-box",
            background: "#111318",
            border: "1px solid rgba(125,219,205,0.25)",
            borderRadius: "10px",
            color: "#fff",
            padding: "11px 12px",
            fontFamily: "inherit",
          }}
        />

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          style={{
            background: "#111318",
            border: "1px solid rgba(125,219,205,0.25)",
            borderRadius: "10px",
            color: "#fff",
            padding: "11px 12px",
            fontFamily: "inherit",
          }}
        >
          <option value="pending">بانتظار المراجعة</option>
          <option value="approved">المقبولة</option>
          <option value="rejected">المرفوضة</option>
        </select>

        <button
          type="button"
          onClick={fetchExperiences}
          disabled={loading}
          style={{
            background: "#7ddbcd",
            color: "#000",
            border: "none",
            borderRadius: "10px",
            padding: "11px 16px",
            cursor: loading ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            fontWeight: "bold",
          }}
        >
          {loading ? "تحميل..." : "عرض"}
        </button>
      </section>

      {message && (
        <p
          style={{
            color: "#fecdd3",
            background: "rgba(244,63,94,0.08)",
            border: "1px solid rgba(244,63,94,0.18)",
            borderRadius: "10px",
            padding: "10px",
            textAlign: "center",
          }}
        >
          {message}
        </p>
      )}

      <div style={{ display: "grid", gap: "12px" }}>
        {experiences.length === 0 && !loading ? (
          <div style={{ ...cardStyle, color: "#9ca3af", textAlign: "center" }}>
            لا توجد تجارب في هذا التصنيف.
          </div>
        ) : (
          experiences.map((exp) => (
            <article key={exp._id} style={cardStyle}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "12px",
                  flexWrap: "wrap",
                  marginBottom: "10px",
                }}
              >
                <div>
                  <h3 style={{ color: "#7ddbcd", margin: "0 0 6px" }}>
                    {exp.title || `تجربة في ${exp.organizationName}`}
                  </h3>
                  <p style={{ color: "#cbd5e1", margin: 0, lineHeight: 1.7 }}>
                    {exp.organizationName} - {exp.city} - {exp.major}
                  </p>
                </div>
                <span style={{ color: "#9ca3af", fontSize: "13px" }}>
                  {new Date(exp.createdAt).toLocaleDateString("ar-SA")}
                </span>
              </div>

              <p
                style={{
                  color: "#e5e7eb",
                  lineHeight: 1.9,
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                }}
              >
                {exp.description}
              </p>

              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  justifyContent: "flex-end",
                  flexWrap: "wrap",
                  marginTop: "12px",
                }}
              >
                {status !== "approved" && (
                  <button
                    type="button"
                    onClick={() => updateStatus(exp._id, "approved")}
                    style={{
                      background: "#7ddbcd",
                      color: "#000",
                      border: "none",
                      borderRadius: "10px",
                      padding: "9px 14px",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontWeight: "bold",
                    }}
                  >
                    قبول
                  </button>
                )}
                {status !== "rejected" && (
                  <button
                    type="button"
                    onClick={() => updateStatus(exp._id, "rejected")}
                    style={{
                      background: "transparent",
                      color: "#fecdd3",
                      border: "1px solid rgba(244,63,94,0.35)",
                      borderRadius: "10px",
                      padding: "9px 14px",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    رفض
                  </button>
                )}
              </div>
            </article>
          ))
        )}
      </div>

      <style>{`
        @media (max-width: 640px) {
          main section:first-of-type {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}
