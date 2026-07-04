import React, { useEffect, useState } from "react";
import axios from "axios";
import API_BASE_URL from "../config/api";
import majors from "../majors";

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
  "rewardAmount",
  "trainingEnvironment",
  "benefitedFromTraining",
  "wouldRecommend",
  "trainingMode",
  "starRating",
  "sourceType",
  "description",
  "rejectionReason",
];

const defaultOpportunityForm = {
  organizationName: "",
  title: "",
  city: "",
  majorCategories: "",
  specialties: "",
  trainingEnvironment: "",
  trainingMode: "",
  hasReward: "",
  applicationMethod: "",
  applicationUrl: "",
  deadline: "",
  sourceUrl: "",
  note: "",
  status: "active",
  featured: false,
};

const opportunityStatusOptions = [
  ["active", "نشطة"],
  ["draft", "مسودة"],
  ["expired", "منتهية"],
];

const opportunitySelectFields = [
  {
    field: "trainingEnvironment",
    label: "بيئة التدريب",
    options: [
      ["", "غير محدد"],
      ["mixed", "مختلطة"],
      ["women", "نساء"],
      ["men", "رجال"],
    ],
  },
  {
    field: "trainingMode",
    label: "نوع التدريب",
    options: [
      ["", "غير محدد"],
      ["onsite", "حضوري"],
      ["remote", "عن بعد"],
      ["hybrid", "مختلط"],
    ],
  },
  {
    field: "hasReward",
    label: "المكافأة",
    options: [
      ["", "غير محدد"],
      ["yes", "يوجد"],
      ["no", "لا يوجد"],
    ],
  },
  {
    field: "applicationMethod",
    label: "طريقة التقديم",
    options: [
      ["", "غير محدد"],
      ["website", "موقع"],
      ["email", "إيميل"],
      ["linkedin", "لينكدإن"],
      ["manual", "يدوي"],
      ["other", "أخرى"],
    ],
  },
  {
    field: "status",
    label: "حالة الفرصة",
    options: opportunityStatusOptions,
  },
];

const majorCategoryOptions = majors.map((majorGroup) => majorGroup.name);

const adminSelectStyle = {
  width: "100%",
  boxSizing: "border-box",
  marginTop: "5px",
  background: "#111318",
  color: "#fff",
  border: "1px solid rgba(125,219,205,0.25)",
  borderRadius: "9px",
  padding: "9px",
  fontFamily: "inherit",
};

const adminQuickSelectFields = [
  {
    field: "hadReward",
    label: "المكافأة",
    options: [
      ["", "غير مؤكد"],
      ["yes", "يوجد"],
      ["no", "لا يوجد"],
    ],
  },
  {
    field: "wasHired",
    label: "عرض التوظيف",
    options: [
      ["", "غير مؤكد"],
      ["yes", "يوجد"],
      ["no", "لا يوجد"],
    ],
  },
  {
    field: "trainingEnvironment",
    label: "بيئة التدريب",
    options: [
      ["", "غير محدد"],
      ["mixed", "مختلطة"],
      ["women", "نساء"],
      ["men", "رجال"],
    ],
  },
  {
    field: "trainingMode",
    label: "نوع التدريب",
    options: [
      ["", "غير محدد"],
      ["onsite", "حضوري"],
      ["remote", "عن بعد"],
    ],
  },
  {
    field: "benefitedFromTraining",
    label: "استفاد من التدريب؟",
    options: [
      ["", "غير محدد"],
      ["yes", "نعم"],
      ["no", "لا"],
    ],
  },
  {
    field: "wouldRecommend",
    label: "ينصح بالتدريب؟",
    options: [
      ["", "غير محدد"],
      ["yes", "نعم"],
      ["no", "لا"],
    ],
  },
  {
    field: "sourceType",
    label: "مصدر التجربة",
    options: [
      ["direct", "تجربة مباشرة من طالب"],
      ["public_summary", "ملخص من مصدر عام"],
    ],
  },
];

const getAdminOptionLabel = (fieldName, value) => {
  const field = adminQuickSelectFields.find((item) => item.field === fieldName);
  return field?.options.find(([optionValue]) => optionValue === (value || ""))?.[1] || "غير محدد";
};

const getOpportunityOptionLabel = (fieldName, value) => {
  const field = opportunitySelectFields.find((item) => item.field === fieldName);
  return (
    field?.options.find(([optionValue]) => optionValue === (value || ""))?.[1] ||
    "غير محدد"
  );
};

const formatDateForInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const formatRewardAmount = (value = "") =>
  value
    .toString()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\bSAR\b/gi, "ريال")
    .replace(/\bSR\b/gi, "ريال")
    .replace(/\bAED\b/gi, "درهم");

const getAdminRewardLabel = (exp = {}) => {
  const baseLabel = getAdminOptionLabel("hadReward", exp.hadReward);
  const amount = formatRewardAmount(exp.rewardAmount);

  return exp.hadReward === "yes" && amount ? `${baseLabel} - ${amount}` : baseLabel;
};

const formatAdminDateTime = (value) => {
  if (!value) return "غير محدد";

  return new Date(value).toLocaleString("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const isUnclearMajorText = (value = "") => {
  const text = value.toString().trim();
  if (!text) return true;

  const letters = text.match(/[A-Za-z\u0600-\u06FF]/g) || [];
  return letters.length < 2;
};

const getReadableMajor = (exp = {}) =>
  isUnclearMajorText(exp.major) ? exp.majorCategory || exp.major : exp.major;

export default function AdminReviewPage() {
  const [password, setPassword] = useState(
    () => sessionStorage.getItem("darbak_admin_password") || ""
  );
  const [adminView, setAdminView] = useState("experiences");
  const [status, setStatus] = useState("pending");
  const [opportunityStatus, setOpportunityStatus] = useState("active");
  const [experiences, setExperiences] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [opportunityForm, setOpportunityForm] = useState(defaultOpportunityForm);
  const [editingOpportunityId, setEditingOpportunityId] = useState(null);
  const [savingOpportunity, setSavingOpportunity] = useState(false);

  const authHeaders = password ? { "x-admin-password": password } : {};
  const currentItemsCount =
    adminView === "suggestions"
      ? suggestions.length
      : adminView === "opportunities"
      ? opportunities.length
      : experiences.length;
  const currentItemsLabel =
    adminView === "suggestions"
      ? "اقتراح"
      : adminView === "opportunities"
      ? "فرصة"
      : "تجربة";

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

  const fetchOpportunities = async () => {
    if (!password) {
      setMessage("اكتب كلمة المرور لعرض المحتوى.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");
      sessionStorage.setItem("darbak_admin_password", password);

      const { data } = await axios.get(`${API_BASE_URL}/api/admin/opportunities`, {
        params: { status: opportunityStatus },
        headers: authHeaders,
      });

      setOpportunities(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      console.error(err);
      setMessage(
        err.response?.status === 401
          ? "كلمة المرور غير صحيحة."
          : "تعذر تحميل الفرص."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!password) return;

    if (adminView === "suggestions") {
      fetchSuggestions();
    } else if (adminView === "opportunities") {
      fetchOpportunities();
    } else {
      fetchExperiences();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, opportunityStatus, adminView]);

  const refreshCurrentView = () => {
    if (adminView === "suggestions") {
      fetchSuggestions();
      return;
    }

    if (adminView === "opportunities") {
      fetchOpportunities();
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

  const updateOpportunityField = (field, value) => {
    setOpportunityForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetOpportunityForm = () => {
    setOpportunityForm(defaultOpportunityForm);
    setEditingOpportunityId(null);
  };

  const startOpportunityEdit = (opportunity) => {
    setEditingOpportunityId(opportunity._id);
    setOpportunityForm({
      organizationName: opportunity.organizationName || "",
      title: opportunity.title || "",
      city: opportunity.city || "",
      majorCategories: (opportunity.majorCategories || []).join("، "),
      specialties: (opportunity.specialties || []).join("، "),
      trainingEnvironment: opportunity.trainingEnvironment || "",
      trainingMode: opportunity.trainingMode || "",
      hasReward: opportunity.hasReward || "",
      applicationMethod: opportunity.applicationMethod || "",
      applicationUrl: opportunity.applicationUrl || "",
      deadline: formatDateForInput(opportunity.deadline),
      sourceUrl: opportunity.sourceUrl || "",
      note: opportunity.note || "",
      status: opportunity.status || "active",
      featured: Boolean(opportunity.featured),
    });
    setMessage("");
  };

  const saveOpportunity = async (event) => {
    event.preventDefault();

    if (!opportunityForm.organizationName.trim() || !opportunityForm.title.trim()) {
      setMessage("اسم الجهة وعنوان الفرصة مطلوبة.");
      return;
    }

    try {
      setSavingOpportunity(true);
      setMessage("");

      const request = editingOpportunityId
        ? axios.patch(
            `${API_BASE_URL}/api/admin/opportunities/${editingOpportunityId}`,
            opportunityForm,
            { headers: authHeaders }
          )
        : axios.post(`${API_BASE_URL}/api/admin/opportunities`, opportunityForm, {
            headers: authHeaders,
          });

      const { data } = await request;

      if (editingOpportunityId) {
        setOpportunities((prev) =>
          prev.map((opportunity) =>
            opportunity._id === editingOpportunityId ? data : opportunity
          )
        );
        setMessage("تم حفظ تعديل الفرصة.");
      } else {
        setOpportunities((prev) => [data, ...prev]);
        setMessage("تمت إضافة الفرصة.");
      }

      resetOpportunityForm();
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.error || "تعذر حفظ الفرصة.");
    } finally {
      setSavingOpportunity(false);
    }
  };

  const deleteOpportunity = async (id) => {
    const confirmed = window.confirm(
      "هل أنت متأكد من حذف هذه الفرصة؟ لا يمكن التراجع عن الحذف."
    );

    if (!confirmed) return;

    try {
      setMessage("");
      await axios.delete(`${API_BASE_URL}/api/admin/opportunities/${id}`, {
        headers: authHeaders,
      });
      setOpportunities((prev) =>
        prev.filter((opportunity) => opportunity._id !== id)
      );
    } catch (err) {
      console.error(err);
      setMessage("تعذر حذف الفرصة.");
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
        <h1 style={{ color: "#fff", margin: 0 }}>
          مراجعة التجارب والاقتراحات والفرص
        </h1>
        <p style={{ color: "#9ca3af", lineHeight: 1.8 }}>
          صفحة خاصة لاعتماد التجارب، متابعة الاقتراحات، وإدارة فرص التدريب.
        </p>
      </header>

      <section
        style={{
          ...cardStyle,
          display: "grid",
          gap: "8px",
          marginBottom: "16px",
        }}
      >
        <label
          htmlFor="admin-password"
          style={{
            color: "#cbd5e1",
            fontSize: "13px",
            fontWeight: "700",
          }}
        >
          كلمة مرور الإدارة
        </label>
        <input
          id="admin-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="اكتب كلمة المرور هنا"
          style={{
            width: "100%",
            boxSizing: "border-box",
            background: "#111318",
            border: "1px solid rgba(125,219,205,0.35)",
            borderRadius: "10px",
            color: "#fff",
            padding: "12px",
            fontFamily: "inherit",
          }}
        />
      </section>

      <section
        style={{
          ...cardStyle,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
          marginBottom: "16px",
        }}
      >
        <div>
          <p style={{ color: "#9ca3af", margin: "0 0 4px", fontSize: "13px" }}>
            العدد الحالي
          </p>
          <strong
            style={{
              color: "#7ddbcd",
              fontSize: "34px",
              lineHeight: 1,
              letterSpacing: 0,
            }}
          >
            {currentItemsCount}
          </strong>
        </div>
        <p
          style={{
            color: "#e5e7eb",
            margin: 0,
            fontSize: "14px",
            lineHeight: 1.7,
          }}
        >
          {currentItemsLabel} في العرض الحالي
        </p>
      </section>

      <section
        style={{
          ...cardStyle,
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, max-content))",
          gap: "10px",
          alignItems: "center",
          justifyContent: "start",
          marginBottom: "16px",
        }}
      >
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
          <option value="opportunities">الفرص</option>
        </select>

        <select
          value={adminView === "opportunities" ? opportunityStatus : status}
          onChange={(e) =>
            adminView === "opportunities"
              ? setOpportunityStatus(e.target.value)
              : setStatus(e.target.value)
          }
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
          {adminView === "opportunities" ? (
            opportunityStatusOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))
          ) : (
            <>
              <option value="pending">بانتظار المراجعة</option>
              <option value="approved">المقبولة</option>
              <option value="rejected">المرفوضة</option>
            </>
          )}
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
      ) : adminView === "opportunities" ? (
        <div style={{ display: "grid", gap: "12px" }}>
          <form
            onSubmit={saveOpportunity}
            style={{
              ...cardStyle,
              display: "grid",
              gap: "12px",
            }}
          >
            <div>
              <h2 style={{ color: "#7ddbcd", margin: "0 0 6px" }}>
                {editingOpportunityId ? "تعديل فرصة" : "إضافة فرصة تدريب"}
              </h2>
              <p style={{ color: "#9ca3af", margin: 0, lineHeight: 1.8 }}>
                الفرص هنا تظهر للطلاب في صفحة وين أتدرب بشكل مستقل عن التجارب.
              </p>
            </div>

            <div className="admin-edit-grid">
              {[
                ["organizationName", "اسم الجهة", "مثال: STC"],
                ["title", "عنوان الفرصة", "برنامج التدريب التعاوني"],
                ["city", "المدينة أو المنطقة", "الرياض أو منطقة الرياض"],
                [
                  "specialties",
                  "التخصصات المناسبة",
                  "اكتبيها مفصولة بفواصل: نظم معلومات، تسويق",
                ],
                ["applicationUrl", "رابط التقديم", "https://..."],
                ["sourceUrl", "رابط المصدر", "رابط إعلان رسمي إن وجد"],
              ].map(([field, label, placeholder]) => (
                <label key={field} style={{ color: "#cbd5e1", fontSize: "13px" }}>
                  {label}
                  <input
                    value={opportunityForm[field] || ""}
                    onChange={(e) =>
                      updateOpportunityField(field, e.target.value)
                    }
                    placeholder={placeholder}
                    style={{
                      ...adminSelectStyle,
                      marginTop: "5px",
                    }}
                  />
                </label>
              ))}

              <label style={{ color: "#cbd5e1", fontSize: "13px" }}>
                التخصصات الرئيسية
                <input
                  list="major-category-options"
                  value={opportunityForm.majorCategories || ""}
                  onChange={(e) =>
                    updateOpportunityField("majorCategories", e.target.value)
                  }
                  placeholder="مثال: الحاسب والتقنية، المالية والإدارية"
                  style={adminSelectStyle}
                />
                <datalist id="major-category-options">
                  {majorCategoryOptions.map((majorName) => (
                    <option key={majorName} value={majorName} />
                  ))}
                </datalist>
              </label>

              <label style={{ color: "#cbd5e1", fontSize: "13px" }}>
                تاريخ انتهاء التقديم
                <input
                  type="date"
                  value={opportunityForm.deadline || ""}
                  onChange={(e) =>
                    updateOpportunityField("deadline", e.target.value)
                  }
                  style={adminSelectStyle}
                />
              </label>

              {opportunitySelectFields.map((field) => (
                <label
                  key={field.field}
                  style={{ color: "#cbd5e1", fontSize: "13px" }}
                >
                  {field.label}
                  <select
                    value={opportunityForm[field.field] || ""}
                    onChange={(e) =>
                      updateOpportunityField(field.field, e.target.value)
                    }
                    style={adminSelectStyle}
                  >
                    {field.options.map(([value, label]) => (
                      <option key={`${field.field}-${value}`} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            <label style={{ color: "#cbd5e1", fontSize: "13px" }}>
              ملاحظة للطلاب
              <textarea
                value={opportunityForm.note || ""}
                onChange={(e) => updateOpportunityField("note", e.target.value)}
                rows={3}
                placeholder="مثال: تأكدي من شروط الجهة قبل التقديم."
                style={{
                  ...adminSelectStyle,
                  lineHeight: 1.8,
                }}
              />
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: "#cbd5e1",
                fontSize: "13px",
              }}
            >
              <input
                type="checkbox"
                checked={Boolean(opportunityForm.featured)}
                onChange={(e) =>
                  updateOpportunityField("featured", e.target.checked)
                }
              />
              فرصة مميزة وتظهر أولًا
            </label>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              {editingOpportunityId && (
                <button
                  type="button"
                  onClick={resetOpportunityForm}
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
              )}
              <button
                type="submit"
                disabled={savingOpportunity}
                style={{
                  background: "#7ddbcd",
                  color: "#000",
                  border: "none",
                  borderRadius: "10px",
                  padding: "9px 14px",
                  cursor: savingOpportunity ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  fontWeight: "bold",
                }}
              >
                {savingOpportunity
                  ? "حفظ..."
                  : editingOpportunityId
                  ? "حفظ التعديل"
                  : "إضافة الفرصة"}
              </button>
            </div>
          </form>

          {opportunities.length === 0 && !loading ? (
            <div style={{ ...cardStyle, color: "#9ca3af", textAlign: "center" }}>
              لا توجد فرص في هذا التصنيف.
            </div>
          ) : (
            opportunities.map((opportunity) => (
              <article key={opportunity._id} style={cardStyle}>
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
                      {opportunity.title}
                    </h3>
                    <p style={{ color: "#cbd5e1", margin: 0, lineHeight: 1.7 }}>
                      {opportunity.organizationName}
                      {opportunity.city ? ` - ${opportunity.city}` : ""}
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
                    <div>آخر تحديث:</div>
                    <strong style={{ color: "#cbd5e1", fontWeight: "600" }}>
                      {formatAdminDateTime(opportunity.updatedAt)}
                    </strong>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "7px",
                    flexWrap: "wrap",
                    margin: "0 0 12px",
                  }}
                >
                  {[
                    ["status", "الحالة"],
                    ["trainingEnvironment", "البيئة"],
                    ["trainingMode", "النوع"],
                    ["hasReward", "المكافأة"],
                    ["applicationMethod", "التقديم"],
                  ].map(([field, label]) => (
                    <span
                      key={field}
                      style={{
                        background: "rgba(125,219,205,0.08)",
                        border: "1px solid rgba(125,219,205,0.18)",
                        borderRadius: "999px",
                        color: "#d1fae5",
                        padding: "6px 9px",
                        fontSize: "12px",
                        lineHeight: 1.4,
                      }}
                    >
                      {label}: {getOpportunityOptionLabel(field, opportunity[field])}
                    </span>
                  ))}
                  {opportunity.deadline && (
                    <span
                      style={{
                        background: "rgba(250,204,21,0.08)",
                        border: "1px solid rgba(250,204,21,0.25)",
                        borderRadius: "999px",
                        color: "#fde68a",
                        padding: "6px 9px",
                        fontSize: "12px",
                      }}
                    >
                      ينتهي: {formatDateForInput(opportunity.deadline)}
                    </span>
                  )}
                </div>

                <p
                  style={{
                    color: "#e5e7eb",
                    lineHeight: 1.9,
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                    margin: "0 0 12px",
                  }}
                >
                  {opportunity.note || "لا توجد ملاحظة."}
                </p>

                <div
                  style={{
                    color: "#9ca3af",
                    fontSize: "13px",
                    lineHeight: 1.8,
                    marginBottom: "12px",
                  }}
                >
                  <div>
                    التخصصات الرئيسية:{" "}
                    {(opportunity.majorCategories || []).join("، ") || "عام"}
                  </div>
                  <div>
                    التخصصات: {(opportunity.specialties || []).join("، ") || "عام"}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    justifyContent: "flex-end",
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => startOpportunityEdit(opportunity)}
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
                  <button
                    type="button"
                    onClick={() => deleteOpportunity(opportunity._id)}
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
                    {exp.organizationName} - {exp.city} - {getReadableMajor(exp)}
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

              <div
                style={{
                  display: "flex",
                  gap: "7px",
                  flexWrap: "wrap",
                  margin: "0 0 12px",
                }}
              >
                {[
                  ["hadReward", "مكافأة"],
                  ["wasHired", "عرض"],
                  ["trainingEnvironment", "البيئة"],
                  ["trainingMode", "النوع"],
                  ["benefitedFromTraining", "استفاد؟"],
                  ["wouldRecommend", "ينصح؟"],
                  ["sourceType", "المصدر"],
                ].map(([field, label]) => (
                  <span
                    key={field}
                    style={{
                      background: "rgba(125,219,205,0.08)",
                      border: "1px solid rgba(125,219,205,0.18)",
                      borderRadius: "999px",
                      color: "#d1fae5",
                      padding: "6px 9px",
                      fontSize: "12px",
                      lineHeight: 1.4,
                    }}
                  >
                    {label}:{" "}
                    {field === "hadReward"
                      ? getAdminRewardLabel(exp)
                      : getAdminOptionLabel(field, exp[field])}
                  </span>
                ))}
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
                      ["howApplied", "طريقة التقديم"],
                      ["duration", "مدة التدريب"],
                      ["trainingYear", "سنة التدريب"],
                      ["rewardAmount", "قيمة المكافأة"],
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
                        style={adminSelectStyle}
                      >
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <option key={rating} value={rating}>
                            {rating}
                          </option>
                        ))}
                      </select>
                    </label>

                    {adminQuickSelectFields.map((field) => (
                      <label
                        key={field.field}
                        style={{ color: "#cbd5e1", fontSize: "13px" }}
                      >
                        {field.label}
                        <select
                          value={editForm[field.field] || ""}
                          onChange={(e) =>
                            updateEditField(field.field, e.target.value)
                          }
                          style={adminSelectStyle}
                        >
                          {field.options.map(([value, label]) => (
                            <option key={`${field.field}-${value}`} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
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
