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

const defaultRejectionReason =
  "لم يتم قبول التجربة بسبب وجود عبارات شخصية أو صياغة قد تُفهم كتجريح أو تشهير. يمكنك إعادة إرسالها بصياغة تركّز على الوقائع والتجربة بدون وصف أشخاص أو هويات.";

const editableFields = [
  "organizationName",
  "city",
  "majorCategory",
  "major",
  "howApplied",
  "duration",
  "trainingYear",
  "wasHired",
  "hadReward",
  "starRating",
  "description",
  "rejectionReason",
];

const formatAdminDateTime = (value) => {
  if (!value) return "غير محدد";

  return new Date(value).toLocaleString("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

export default function AdminReviewPage() {
  const [password, setPassword] = useState(
    () => sessionStorage.getItem("darbak_admin_password") || ""
  );
  const [adminView, setAdminView] = useState("experiences");
  const [status, setStatus] = useState("pending");
  const [experiences, setExperiences] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  const authHeaders = password ? { "x-admin-password": password } : {};

  const fetchExperiences = async () => {
    if (!password) {
      setMessage("اكتب كلمة المرور لعرض المحتوى.");
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

  const fetchSuggestions = async () => {
    if (!password) {
      setMessage("اكتب كلمة المرور لعرض المحتوى.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");
      sessionStorage.setItem("darbak_admin_password", password);

      const { data } = await axios.get(`${API_BASE_URL}/api/admin/suggestions`, {
        headers: authHeaders,
      });

      setSuggestions(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      console.error(err);
      setMessage(
        err.response?.status === 401
          ? "كلمة المرور غير صحيحة."
          : "تعذر تحميل الاقتراحات."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!password) return;

    if (adminView === "suggestions") {
      fetchSuggestions();
    } else {
      fetchExperiences();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, adminView]);

  const refreshCurrentView = () => {
    if (adminView === "suggestions") {
      fetchSuggestions();
      return;
    }

    fetchExperiences();
  };

  const updateStatus = async (id, nextStatus, rejectionReason = "") => {
    try {
      setMessage("");
      await axios.patch(
        `${API_BASE_URL}/api/admin/experiences/${id}/status`,
        { status: nextStatus, rejectionReason },
        { headers: authHeaders }
      );
      setExperiences((prev) => prev.filter((exp) => exp._id !== id));
    } catch (err) {
      console.error(err);
      setMessage("تعذر تحديث حالة التجربة.");
    }
  };

  const rejectExperience = (id) => {
    const reason = window.prompt("سبب الرفض", defaultRejectionReason);

    if (reason === null) return;

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setMessage("اكتب سبب الرفض أو ألغِ العملية.");
      return;
    }

    updateStatus(id, "rejected", trimmedReason);
  };

  const startEditing = (exp) => {
    const nextForm = {};

    editableFields.forEach((field) => {
      nextForm[field] = exp[field] ?? "";
    });

    nextForm.starRating = String(exp.starRating || "");
    setEditingId(exp._id);
    setEditForm(nextForm);
    setMessage("");
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({});
  };

  const updateEditField = (field, value) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveExperienceEdit = async (id) => {
    try {
      setSavingEdit(true);
      setMessage("");

      const payload = {
        ...editForm,
        starRating: Number(editForm.starRating) || 1,
      };

      const { data } = await axios.patch(
        `${API_BASE_URL}/api/admin/experiences/${id}`,
        payload,
        { headers: authHeaders }
      );

      setExperiences((prev) =>
        prev.map((exp) => (exp._id === id ? data : exp))
      );
      cancelEditing();
      setMessage("تم حفظ تعديل التجربة.");
    } catch (err) {
      console.error(err);
      setMessage("تعذر حفظ تعديل التجربة.");
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteExperience = async (id) => {
    const confirmed = window.confirm(
      "هل أنتِ متأكدة من حذف هذه التجربة نهائيًا؟ لا يمكن التراجع عن الحذف."
    );

    if (!confirmed) return;

    try {
      setMessage("");
      await axios.delete(`${API_BASE_URL}/api/admin/experiences/${id}`, {
        headers: authHeaders,
      });
      setExperiences((prev) => prev.filter((exp) => exp._id !== id));
    } catch (err) {
      console.error(err);
      setMessage("تعذر حذف التجربة.");
    }
  };

  const deleteSuggestion = async (id) => {
    const confirmed = window.confirm(
      "هل أنت متأكد من حذف هذا الاقتراح؟ لا يمكن التراجع عن الحذف."
    );

    if (!confirmed) return;

    try {
      setMessage("");
      await axios.delete(`${API_BASE_URL}/api/admin/suggestions/${id}`, {
        headers: authHeaders,
      });
      setSuggestions((prev) => prev.filter((suggestion) => suggestion._id !== id));
    } catch (err) {
      console.error(err);
      setMessage("تعذر حذف الاقتراح.");
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
        <h1 style={{ color: "#fff", margin: 0 }}>مراجعة التجارب والاقتراحات</h1>
        <p style={{ color: "#9ca3af", lineHeight: 1.8 }}>
          صفحة خاصة لاعتماد التجارب ومتابعة اقتراحات الزوار.
        </p>
      </header>

      <section
        style={{
          ...cardStyle,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto auto auto",
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
          value={adminView}
          onChange={(e) => setAdminView(e.target.value)}
          style={{
            background: "#111318",
            border: "1px solid rgba(125,219,205,0.25)",
            borderRadius: "10px",
            color: "#fff",
            padding: "11px 12px",
            fontFamily: "inherit",
          }}
        >
          <option value="experiences">التجارب</option>
          <option value="suggestions">الاقتراحات</option>
        </select>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          disabled={adminView === "suggestions"}
          style={{
            background: "#111318",
            border: "1px solid rgba(125,219,205,0.25)",
            borderRadius: "10px",
            color: "#fff",
            padding: "11px 12px",
            fontFamily: "inherit",
            opacity: adminView === "suggestions" ? 0.45 : 1,
          }}
        >
          <option value="pending">بانتظار المراجعة</option>
          <option value="approved">المقبولة</option>
          <option value="rejected">المرفوضة</option>
        </select>

        <button
          type="button"
          onClick={refreshCurrentView}
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

      {adminView === "suggestions" ? (
        <div style={{ display: "grid", gap: "12px" }}>
          {suggestions.length === 0 && !loading ? (
            <div style={{ ...cardStyle, color: "#9ca3af", textAlign: "center" }}>
              لا توجد اقتراحات حاليًا.
            </div>
          ) : (
            suggestions.map((suggestion) => (
              <article key={suggestion._id} style={cardStyle}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    flexWrap: "wrap",
                    marginBottom: "10px",
                  }}
                >
                  <h3 style={{ color: "#7ddbcd", margin: 0 }}>اقتراح من زائر</h3>
                  <div
                    style={{
                      color: "#9ca3af",
                      fontSize: "13px",
                      lineHeight: 1.8,
                      textAlign: "left",
                    }}
                  >
                    <div>أضيف:</div>
                    <strong style={{ color: "#cbd5e1", fontWeight: "600" }}>
                      {formatAdminDateTime(suggestion.createdAt)}
                    </strong>
                  </div>
                </div>

                <p
                  style={{
                    color: "#e5e7eb",
                    lineHeight: 1.9,
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                    margin: "0 0 14px",
                  }}
                >
                  {suggestion.text}
                </p>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => deleteSuggestion(suggestion._id)}
                    style={{
                      background: "rgba(127,29,29,0.2)",
                      color: "#fecaca",
                      border: "1px solid rgba(248,113,113,0.35)",
                      borderRadius: "10px",
                      padding: "9px 14px",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    حذف
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      ) : (
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
                <div
                  style={{
                    color: "#9ca3af",
                    fontSize: "13px",
                    lineHeight: 1.8,
                    textAlign: "left",
                  }}
                >
                  <div>أضيفت:</div>
                  <strong style={{ color: "#cbd5e1", fontWeight: "600" }}>
                    {formatAdminDateTime(exp.createdAt)}
                  </strong>
                </div>
              </div>

              {editingId === exp._id ? (
                <div
                  style={{
                    display: "grid",
                    gap: "10px",
                    marginTop: "12px",
                  }}
                >
                  <div className="admin-edit-grid">
                    {[
                      ["organizationName", "اسم الجهة"],
                      ["city", "المدينة"],
                      ["majorCategory", "التخصص الرئيسي"],
                      ["major", "التخصص"],
                      ["howApplied", "كيف حصلت على الفرصة"],
                      ["duration", "مدة التدريب"],
                      ["trainingYear", "سنة التدريب"],
                    ].map(([field, label]) => (
                      <label key={field} style={{ color: "#cbd5e1", fontSize: "13px" }}>
                        {label}
                        <input
                          value={editForm[field] || ""}
                          onChange={(e) => updateEditField(field, e.target.value)}
                          style={{
                            width: "100%",
                            boxSizing: "border-box",
                            marginTop: "5px",
                            background: "#111318",
                            color: "#fff",
                            border: "1px solid rgba(125,219,205,0.25)",
                            borderRadius: "9px",
                            padding: "9px",
                            fontFamily: "inherit",
                          }}
                        />
                      </label>
                    ))}
                  </div>

                  <div className="admin-edit-grid">
                    <label style={{ color: "#cbd5e1", fontSize: "13px" }}>
                      التقييم
                      <select
                        value={editForm.starRating || ""}
                        onChange={(e) => updateEditField("starRating", e.target.value)}
                        style={{
                          width: "100%",
                          boxSizing: "border-box",
                          marginTop: "5px",
                          background: "#111318",
                          color: "#fff",
                          border: "1px solid rgba(125,219,205,0.25)",
                          borderRadius: "9px",
                          padding: "9px",
                          fontFamily: "inherit",
                        }}
                      >
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <option key={rating} value={rating}>
                            {rating}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label style={{ color: "#cbd5e1", fontSize: "13px" }}>
                      المكافأة
                      <select
                        value={editForm.hadReward || ""}
                        onChange={(e) => updateEditField("hadReward", e.target.value)}
                        style={{
                          width: "100%",
                          boxSizing: "border-box",
                          marginTop: "5px",
                          background: "#111318",
                          color: "#fff",
                          border: "1px solid rgba(125,219,205,0.25)",
                          borderRadius: "9px",
                          padding: "9px",
                          fontFamily: "inherit",
                        }}
                      >
                        <option value="">غير مؤكد</option>
                        <option value="yes">يوجد</option>
                        <option value="no">لا يوجد</option>
                        <option value="not_sure">غير مؤكد</option>
                      </select>
                    </label>

                    <label style={{ color: "#cbd5e1", fontSize: "13px" }}>
                      عرض التوظيف
                      <select
                        value={editForm.wasHired || ""}
                        onChange={(e) => updateEditField("wasHired", e.target.value)}
                        style={{
                          width: "100%",
                          boxSizing: "border-box",
                          marginTop: "5px",
                          background: "#111318",
                          color: "#fff",
                          border: "1px solid rgba(125,219,205,0.25)",
                          borderRadius: "9px",
                          padding: "9px",
                          fontFamily: "inherit",
                        }}
                      >
                        <option value="">غير مؤكد</option>
                        <option value="yes">يوجد</option>
                        <option value="no">لا يوجد</option>
                        <option value="not_sure">غير مؤكد</option>
                      </select>
                    </label>
                  </div>

                  <label style={{ color: "#cbd5e1", fontSize: "13px" }}>
                    وصف التجربة
                    <textarea
                      value={editForm.description || ""}
                      onChange={(e) => updateEditField("description", e.target.value)}
                      rows={6}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        marginTop: "5px",
                        background: "#111318",
                        color: "#fff",
                        border: "1px solid rgba(125,219,205,0.25)",
                        borderRadius: "9px",
                        padding: "10px",
                        fontFamily: "inherit",
                        lineHeight: 1.8,
                      }}
                    />
                  </label>

                  <label style={{ color: "#cbd5e1", fontSize: "13px" }}>
                    سبب الرفض
                    <textarea
                      value={editForm.rejectionReason || ""}
                      onChange={(e) =>
                        updateEditField("rejectionReason", e.target.value)
                      }
                      rows={3}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        marginTop: "5px",
                        background: "#111318",
                        color: "#fff",
                        border: "1px solid rgba(125,219,205,0.25)",
                        borderRadius: "9px",
                        padding: "10px",
                        fontFamily: "inherit",
                        lineHeight: 1.8,
                      }}
                    />
                  </label>
                </div>
              ) : (
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
              )}

              {exp.rejectionReason && (
                <div
                  style={{
                    marginTop: "12px",
                    padding: "10px 12px",
                    borderRadius: "12px",
                    background: "rgba(244,63,94,0.08)",
                    border: "1px solid rgba(244,63,94,0.18)",
                    color: "#fecdd3",
                    lineHeight: 1.8,
                    fontSize: "13px",
                  }}
                >
                  <strong>سبب الرفض: </strong>
                  {exp.rejectionReason}
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  justifyContent: "flex-end",
                  flexWrap: "wrap",
                  marginTop: "12px",
                }}
              >
                {editingId === exp._id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => saveExperienceEdit(exp._id)}
                      disabled={savingEdit}
                      style={{
                        background: "#7ddbcd",
                        color: "#000",
                        border: "none",
                        borderRadius: "10px",
                        padding: "9px 14px",
                        cursor: savingEdit ? "not-allowed" : "pointer",
                        fontFamily: "inherit",
                        fontWeight: "bold",
                      }}
                    >
                      {savingEdit ? "حفظ..." : "حفظ التعديل"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditing}
                      style={{
                        background: "transparent",
                        color: "#cbd5e1",
                        border: "1px solid rgba(203,213,225,0.35)",
                        borderRadius: "10px",
                        padding: "9px 14px",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      إلغاء التعديل
                    </button>
                  </>
                ) : (
                  <>
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
                    <button
                      type="button"
                      onClick={() => startEditing(exp)}
                      style={{
                        background: "rgba(125,219,205,0.08)",
                        color: "#7ddbcd",
                        border: "1px solid rgba(125,219,205,0.35)",
                        borderRadius: "10px",
                        padding: "9px 14px",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        fontWeight: "bold",
                      }}
                    >
                      تعديل
                    </button>
                    {status !== "rejected" && (
                      <button
                        type="button"
                        onClick={() => rejectExperience(exp._id)}
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
                    <button
                      type="button"
                      onClick={() => deleteExperience(exp._id)}
                      style={{
                        background: "rgba(127,29,29,0.2)",
                        color: "#fecaca",
                        border: "1px solid rgba(248,113,113,0.35)",
                        borderRadius: "10px",
                        padding: "9px 14px",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      حذف نهائي
                    </button>
                  </>
                )}
              </div>
            </article>
            ))
          )}
        </div>
      )}

      <style>{`
        @media (max-width: 640px) {
          main section:first-of-type {
            grid-template-columns: 1fr !important;
          }

          .admin-edit-grid {
            grid-template-columns: 1fr !important;
          }
        }

        .admin-edit-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }
      `}</style>
    </main>
  );
}
