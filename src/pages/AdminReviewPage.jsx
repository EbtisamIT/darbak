import React, { useEffect, useState } from "react";
import axios from "axios";
import API_BASE_URL from "../config/api";
import majors from "../majors";

const adminColors = {
  brand: "#66d0c3",
  brandStrong: "#8ee7dc",
  text: "#d8e5e2",
  textSoft: "#bfccc9",
  muted: "#8e9f9b",
  card: "rgba(255,255,255,0.035)",
  cardBorder: "rgba(216,229,226,0.09)",
  inputBg: "#10151a",
  inputBorder: "rgba(102,208,195,0.22)",
};

const cardStyle = {
  background: adminColors.card,
  border: `1px solid ${adminColors.cardBorder}`,
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
  "ambassadorConsent",
  "ambassadorLinkedInUrl",
  "ambassadorProfileImageUrl",
  "starRating",
  "interviewQuestions",
  "sourceType",
  "description",
  "rejectionReason",
];

const defaultOpportunityForm = {
  organizationName: "",
  title: "",
  city: "",
  cities: [],
  majorCategories: [],
  specialties: ["__all_specialties__"],
  trainingEnvironment: "",
  trainingMode: "",
  hasReward: "",
  applicationMethod: "",
  applicationUrl: "",
  logoUrl: "",
  deadline: "",
  sourceUrl: "",
  note: "",
  status: "active",
  sourceType: "admin",
  submitterContact: "",
  featured: false,
};

const opportunityCityOptions = [
  "الرياض",
  "جدة",
  "مكة المكرمة",
  "المدينة المنورة",
  "الدمام",
  "الخبر",
  "الظهران",
  "الأحساء",
  "الجبيل",
  "الطائف",
  "أبها",
  "خميس مشيط",
  "جازان",
  "تبوك",
  "حائل",
  "بريدة",
  "نجران",
  "الباحة",
  "سكاكا",
  "عرعر",
  "ينبع",
  "الخرج",
  "العلا",
  "منطقة الرياض",
  "منطقة مكة المكرمة",
  "منطقة المدينة المنورة",
  "المنطقة الشرقية",
  "منطقة القصيم",
  "منطقة عسير",
  "منطقة تبوك",
  "منطقة حائل",
  "منطقة جازان",
  "منطقة نجران",
  "منطقة الباحة",
  "منطقة الجوف",
  "منطقة الحدود الشمالية",
];

const emptyAnalytics = {
  days: 30,
  totalEvents: 0,
  pageVisits: 0,
  allTimePageVisits: 0,
  uniqueVisitors: 0,
  allTimeVisitors: 0,
  activeVisitors: 0,
  activeWindowMinutes: 5,
  averageSessionSeconds: 0,
  totalSessionSeconds: 0,
  sessionDurationSamples: 0,
  topEvents: [],
  topMajors: [],
  topCities: [],
  topSearches: [],
  topPages: [],
  topDevices: [],
  topDiagnosis: [],
  topFears: [],
  topOrganizations: [],
  assistantQueries: 0,
  assistantContextUses: 0,
  assistantZeroResultQueries: 0,
  topAssistantIntents: [],
  topAssistantQuestions: [],
  interviewPageViews: 0,
  interviewVisitors: 0,
  interviewSearches: 0,
  interviewQuestionStarts: 0,
  interviewQuestionSubmissions: 0,
  topInterviewQuestionOrganizations: [],
  guideFileAdClicks: 0,
  cvProductAdClicks: 0,
  topAdClicks: [],
  shareMenuOpens: 0,
  shareActions: 0,
  experienceShareMenuOpens: 0,
  experienceShareActions: 0,
  opportunityShareMenuOpens: 0,
  opportunityShareActions: 0,
  trainingTargetShareMenuOpens: 0,
  trainingTargetShareActions: 0,
  topShareActions: [],
  topSharedExperiences: [],
  topSharedOpportunities: [],
  topSharedTrainingTargets: [],
  hourlyActivity: [],
  recentEvents: [],
  rawEvents: 0,
  rangeLabel: "آخر 30 يوم",
};

const analyticsEventLabels = {
  page_view: "زيارة صفحة",
  where_to_train_search: "بحث وين أتدرب",
  experience_search: "بحث التجارب",
  diagnosis_completed: "إكمال التشخيص",
  add_experience_started: "بدء إضافة تجربة",
  add_experience_submitted: "إرسال تجربة",
  session_ping: "زائر نشط",
  session_duration: "مدة الجلسة",
  opportunity_details_clicked: "فتح تفاصيل فرصة",
  opportunity_apply_clicked: "ضغط تقديم فرصة",
  opportunity_submission_started: "بدء إرسال فرصة",
  opportunity_submitted: "إرسال فرصة للمراجعة",
  experience_card_opened: "فتح تجربة",
  interviews_page_viewed: "زيارة صفحة المقابلات",
  interviews_search: "بحث المقابلات",
  interview_questions_started: "بدء إضافة أسئلة مقابلة",
  interview_questions_submitted: "إرسال أسئلة مقابلة",
  smart_assistant_query: "سؤال دليل دربك",
  diagnosis_store_click: "ضغط إعلان ملف المتدرب",
  training_guide_opportunities_banner_click: "ضغط إعلان ملف المتدرب",
  training_guide_banner_click: "ضغط إعلان ملف المتدرب",
  diagnosis_cv_product_click: "ضغط إعلان السيرة الذاتية",
  share_item_clicked: "مشاركة عنصر",
  premium_gate_opened: "ظهور نافذة الاشتراك",
  premium_checkout_started: "بدء الدفع",
  premium_access_verified: "تفعيل اشتراك",
};

const assistantIntentLabels = {
  apply: "طريقة التقديم",
  best: "أفضل الجهات",
  compare: "مقارنة جهات",
  exists: "وجود تجارب",
  interview: "المقابلة",
  problems: "المشاكل",
  recommend: "هل تنصح",
  reward: "المكافأة",
  summary: "ملخص جهة",
  tasks: "المهام",
};

const diagnosisFearLabels = {
  unknownTargets: "ما أعرف الجهات",
  noCv: "ما عندي CV",
  rejection: "أخاف ما أنقبل",
  email: "ما أعرف أرسل إيميل",
  late: "البداية متأخرة",
};

const shareActionLabels = {
  menu_open: "فتح قائمة المشاركة",
  native: "مشاركة الجهاز / AirDrop",
  copy: "نسخ الرابط",
  whatsapp: "واتساب",
  snapchat: "سناب",
  instagram: "انستقرام",
};

const analyticsRangeOptions = [
  ["7", "آخر أسبوع"],
  ["30", "آخر شهر"],
  ["90", "آخر 3 شهور"],
  ["180", "آخر 6 شهور"],
  ["365", "آخر سنة"],
  ["all", "كل الفترة"],
];

const opportunityStatusOptions = [
  ["active", "نشطة"],
  ["draft", "بانتظار المراجعة"],
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
const ALL_SPECIALTIES_VALUE = "__all_specialties__";
const specialtyOptions = Array.from(
  majors
    .reduce((optionsMap, majorGroup) => {
      (majorGroup.subMajors || []).forEach((specialty) => {
        if (!optionsMap.has(specialty)) {
          optionsMap.set(specialty, {
            name: specialty,
            category: majorGroup.name,
          });
        }
      });
      return optionsMap;
    }, new Map())
    .values()
).sort((a, b) => a.name.localeCompare(b.name, "ar"));

const normalizeFormArray = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/[,،]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const getCategoriesForSpecialties = (selectedSpecialties = []) =>
  Array.from(
    new Set(
      selectedSpecialties
        .map(
          (specialty) =>
            specialtyOptions.find((option) => option.name === specialty)?.category
        )
        .filter(Boolean)
    )
  );

const getSpecialtiesForCategories = (selectedCategories = []) => {
  const categories = normalizeFormArray(selectedCategories);
  if (categories.length === 0) return specialtyOptions;

  return specialtyOptions.filter((option) => categories.includes(option.category));
};

const toggleArrayValue = (values = [], value) => {
  const currentValues = normalizeFormArray(values);
  return currentValues.includes(value)
    ? currentValues.filter((item) => item !== value)
    : [...currentValues, value];
};

function MultiChipSelector({
  label,
  values,
  options,
  onChange,
  helpText,
  emptyLabel = "كل الخيارات",
  maxHeight = "190px",
  showEmptyButton = true,
}) {
  const selectedValues = normalizeFormArray(values);
  const selectedSet = new Set(selectedValues);

  return (
    <div
      style={{
        color: adminColors.textSoft,
        fontSize: "13px",
        gridColumn: "1 / -1",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          marginBottom: "8px",
          flexWrap: "wrap",
        }}
      >
        <span>{label}</span>
        <span
          style={{
            color: adminColors.brand,
            fontSize: "12px",
            fontWeight: "800",
          }}
        >
          {selectedValues.length > 0
            ? `${selectedValues.length} محدد`
            : emptyLabel}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "7px",
          maxHeight,
          overflowY: "auto",
          padding: "10px",
          background: adminColors.inputBg,
          border: `1px solid ${adminColors.inputBorder}`,
          borderRadius: "12px",
        }}
      >
        {showEmptyButton && (
          <button
            type="button"
            onClick={() => onChange([])}
            style={{
              background:
                selectedValues.length === 0 ? adminColors.brand : "transparent",
              color: selectedValues.length === 0 ? "#07100e" : adminColors.textSoft,
              border: `1px solid ${
                selectedValues.length === 0
                  ? adminColors.brand
                  : adminColors.inputBorder
              }`,
              borderRadius: "999px",
              padding: "7px 11px",
              cursor: "pointer",
              fontFamily: "inherit",
              fontWeight: "800",
              fontSize: "12px",
            }}
          >
            {emptyLabel}
          </button>
        )}

        {options.map((option) => {
          const optionValue =
            typeof option === "string" ? option : option.value || option.name;
          const optionLabel =
            typeof option === "string" ? option : option.label || option.name;
          const active = selectedSet.has(optionValue);

          return (
            <button
              key={optionValue}
              type="button"
              onClick={() => onChange(toggleArrayValue(selectedValues, optionValue))}
              style={{
                background: active ? adminColors.brand : "rgba(255,255,255,0.035)",
                color: active ? "#07100e" : adminColors.text,
                border: `1px solid ${
                  active ? adminColors.brand : adminColors.inputBorder
                }`,
                borderRadius: "999px",
                padding: "7px 11px",
                cursor: "pointer",
                fontFamily: "inherit",
                fontWeight: active ? "900" : "700",
                fontSize: "12px",
                lineHeight: 1.5,
              }}
            >
              {optionLabel}
            </button>
          );
        })}
      </div>

      {helpText && (
        <small
          style={{
            display: "block",
            marginTop: "6px",
            color: adminColors.muted,
            lineHeight: 1.7,
          }}
        >
          {helpText}
        </small>
      )}
    </div>
  );
}

const getOpportunityCitiesForForm = (opportunity = {}) => {
  const cities = normalizeFormArray(opportunity.cities);
  if (cities.length > 0) return cities;

  return opportunity.city ? [opportunity.city] : [];
};

const getOpportunityCitiesText = (opportunity = {}) => {
  const cities = getOpportunityCitiesForForm(opportunity);
  return cities.length > 0 ? cities.join("، ") : "";
};

const getOpportunitySpecialtiesForForm = (opportunity = {}) => {
  const specialties = normalizeFormArray(opportunity.specialties);
  return specialties.length > 0 ? specialties : [ALL_SPECIALTIES_VALUE];
};

const isGeneralOpportunity = (opportunity = {}) =>
  normalizeFormArray(opportunity.specialties).length === 0 &&
  normalizeFormArray(opportunity.majorCategories).length === 0;

const getOpportunityApplicationState = (deadline) => {
  if (!deadline) return { label: "مفتوح", tone: "open" };

  const deadlineDate = new Date(deadline);
  if (Number.isNaN(deadlineDate.getTime())) {
    return { label: "مفتوح", tone: "open" };
  }

  deadlineDate.setHours(23, 59, 59, 999);
  return deadlineDate < new Date()
    ? { label: "مغلق", tone: "closed" }
    : { label: "مفتوح", tone: "open" };
};

const adminSelectStyle = {
  width: "100%",
  boxSizing: "border-box",
  marginTop: "5px",
  background: adminColors.inputBg,
  color: adminColors.text,
  border: `1px solid ${adminColors.inputBorder}`,
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
  {
    field: "ambassadorConsent",
    label: "سفير دربك",
    options: [
      ["no", "مجهول"],
      ["yes", "موافق"],
      ["", "غير محدد"],
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

const formatDuration = (seconds = 0) => {
  const totalSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  if (!totalSeconds) return "-";

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}س ${minutes}د`;
  }

  if (minutes > 0) {
    return `${minutes}د ${remainingSeconds}ث`;
  }

  return `${remainingSeconds}ث`;
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
  const [contactMessages, setContactMessages] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [interviewQuestions, setInterviewQuestions] = useState([]);
  const [analytics, setAnalytics] = useState(emptyAnalytics);
  const [analyticsDays, setAnalyticsDays] = useState("30");
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
      : adminView === "contactMessages"
      ? contactMessages.length
      : adminView === "interviewQuestions"
      ? interviewQuestions.length
      : adminView === "opportunities"
      ? opportunities.length
      : adminView === "analytics"
      ? analytics.totalEvents
      : experiences.length;
  const currentItemsLabel =
    adminView === "suggestions"
      ? "اقتراح"
      : adminView === "contactMessages"
      ? "رسالة تواصل"
      : adminView === "interviewQuestions"
      ? "أسئلة مقابلة"
      : adminView === "opportunities"
      ? "فرصة"
      : adminView === "analytics"
      ? "حدث"
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

  const fetchContactMessages = async () => {
    if (!password) {
      setMessage("اكتب كلمة المرور لعرض المحتوى.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");
      sessionStorage.setItem("darbak_admin_password", password);

      const { data } = await axios.get(`${API_BASE_URL}/api/admin/contact-messages`, {
        headers: authHeaders,
      });

      setContactMessages(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      console.error(err);
      setMessage(
        err.response?.status === 401
          ? "كلمة المرور غير صحيحة."
          : "تعذر تحميل رسائل التواصل."
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

  const fetchInterviewQuestions = async () => {
    if (!password) {
      setMessage("اكتب كلمة المرور لعرض المحتوى.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");
      sessionStorage.setItem("darbak_admin_password", password);

      const { data } = await axios.get(
        `${API_BASE_URL}/api/admin/interview-questions`,
        {
          params: { status },
          headers: authHeaders,
        }
      );

      setInterviewQuestions(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      console.error(err);
      setMessage(
        err.response?.status === 401
          ? "كلمة المرور غير صحيحة."
          : "تعذر تحميل أسئلة المقابلات."
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    if (!password) {
      setMessage("اكتب كلمة المرور لعرض المحتوى.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");
      sessionStorage.setItem("darbak_admin_password", password);

      const { data } = await axios.get(`${API_BASE_URL}/api/admin/analytics`, {
        params: { days: analyticsDays },
        headers: authHeaders,
      });

      setAnalytics({ ...emptyAnalytics, ...data });
    } catch (err) {
      console.error(err);
      setMessage(
        err.response?.status === 401
          ? "كلمة المرور غير صحيحة."
          : "تعذر تحميل التحليلات."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!password) return;

    if (adminView === "suggestions") {
      fetchSuggestions();
    } else if (adminView === "contactMessages") {
      fetchContactMessages();
    } else if (adminView === "interviewQuestions") {
      fetchInterviewQuestions();
    } else if (adminView === "opportunities") {
      fetchOpportunities();
    } else if (adminView === "analytics") {
      fetchAnalytics();
    } else {
      fetchExperiences();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, opportunityStatus, analyticsDays, adminView]);

  const refreshCurrentView = () => {
    if (adminView === "suggestions") {
      fetchSuggestions();
      return;
    }

    if (adminView === "contactMessages") {
      fetchContactMessages();
      return;
    }

    if (adminView === "opportunities") {
      fetchOpportunities();
      return;
    }

    if (adminView === "interviewQuestions") {
      fetchInterviewQuestions();
      return;
    }

    if (adminView === "analytics") {
      fetchAnalytics();
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

  const updateInterviewQuestionStatus = async (id, nextStatus) => {
    try {
      setMessage("");
      await axios.patch(
        `${API_BASE_URL}/api/admin/interview-questions/${id}/status`,
        { status: nextStatus },
        { headers: authHeaders }
      );
      setInterviewQuestions((prev) => prev.filter((item) => item._id !== id));
    } catch (err) {
      console.error(err);
      setMessage("تعذر تحديث حالة أسئلة المقابلة.");
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
      nextForm[field] =
        field === "interviewQuestions"
          ? Array.isArray(exp[field])
            ? exp[field].join("\n")
            : ""
          : exp[field] ?? "";
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
        interviewQuestions: (editForm.interviewQuestions || "")
          .split("\n")
          .map((question) => question.trim())
          .filter(Boolean),
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

  const deleteContactMessage = async (id) => {
    const confirmed = window.confirm(
      "هل أنت متأكد من حذف رسالة التواصل؟ لا يمكن التراجع عن الحذف."
    );

    if (!confirmed) return;

    try {
      setMessage("");
      await axios.delete(`${API_BASE_URL}/api/admin/contact-messages/${id}`, {
        headers: authHeaders,
      });
      setContactMessages((prev) => prev.filter((item) => item._id !== id));
    } catch (err) {
      console.error(err);
      setMessage("تعذر حذف رسالة التواصل.");
    }
  };

  const deleteInterviewQuestion = async (id) => {
    const confirmed = window.confirm(
      "هل أنت متأكد من حذف أسئلة المقابلة؟ لا يمكن التراجع عن الحذف."
    );

    if (!confirmed) return;

    try {
      setMessage("");
      await axios.delete(`${API_BASE_URL}/api/admin/interview-questions/${id}`, {
        headers: authHeaders,
      });
      setInterviewQuestions((prev) => prev.filter((item) => item._id !== id));
    } catch (err) {
      console.error(err);
      setMessage("تعذر حذف أسئلة المقابلة.");
    }
  };

  const renderAnalyticsList = (
    title,
    items = [],
    labelFormatter = (value) => value
  ) => (
    <section style={cardStyle}>
      <h3 style={{ color: adminColors.brand, margin: "0 0 12px" }}>{title}</h3>
      {items.length === 0 ? (
        <p style={{ color: adminColors.muted, margin: 0 }}>لا توجد بيانات كافية بعد.</p>
      ) : (
        <div style={{ display: "grid", gap: "9px" }}>
          {items.map((item) => (
            <div
              key={`${title}-${item.label}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
                alignItems: "center",
                color: adminColors.text,
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                paddingBottom: "8px",
              }}
            >
              <span style={{ overflowWrap: "anywhere", lineHeight: 1.7 }}>
                {labelFormatter(item.label)}
              </span>
              <strong style={{ color: adminColors.brand, whiteSpace: "nowrap" }}>
                {item.count}
              </strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );

  const updateOpportunityField = (field, value) => {
    if (field === "cities") {
      const selectedCities = normalizeFormArray(value);
      setOpportunityForm((prev) => ({
        ...prev,
        cities: selectedCities,
        city: selectedCities[0] || "",
      }));
      return;
    }

    if (field === "majorCategories") {
      const nextCategories = normalizeFormArray(value);
      const allowedSpecialties = getSpecialtiesForCategories(nextCategories).map(
        (option) => option.name
      );

      setOpportunityForm((prev) => {
        const currentSpecialties = normalizeFormArray(prev.specialties).filter(
          (specialty) =>
            specialty !== ALL_SPECIALTIES_VALUE &&
            allowedSpecialties.includes(specialty)
        );

        return {
          ...prev,
          majorCategories: nextCategories,
          specialties:
            nextCategories.length === 0 && currentSpecialties.length === 0
              ? [ALL_SPECIALTIES_VALUE]
              : currentSpecialties,
        };
      });
      return;
    }

    if (field === "specialties") {
      const selectedSpecialties = normalizeFormArray(value);

      setOpportunityForm((prev) => {
        const previousSpecialties = normalizeFormArray(prev.specialties);
        const hadAllSpecialties = previousSpecialties.includes(
          ALL_SPECIALTIES_VALUE
        );
        const pickedAllSpecialties = selectedSpecialties.includes(
          ALL_SPECIALTIES_VALUE
        );
        const nextSpecialties =
          pickedAllSpecialties && hadAllSpecialties && selectedSpecialties.length > 1
            ? selectedSpecialties.filter(
                (specialty) => specialty !== ALL_SPECIALTIES_VALUE
              )
            : pickedAllSpecialties
            ? [ALL_SPECIALTIES_VALUE]
            : selectedSpecialties;

        return {
          ...prev,
          specialties: nextSpecialties,
          majorCategories: nextSpecialties.includes(ALL_SPECIALTIES_VALUE)
            ? []
            : Array.from(
                new Set([
                  ...normalizeFormArray(prev.majorCategories),
                  ...getCategoriesForSpecialties(nextSpecialties),
                ])
              ),
        };
      });
      return;
    }

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
      cities: getOpportunityCitiesForForm(opportunity),
      majorCategories: normalizeFormArray(opportunity.majorCategories),
      specialties: getOpportunitySpecialtiesForForm(opportunity),
      trainingEnvironment: opportunity.trainingEnvironment || "",
      trainingMode: opportunity.trainingMode || "",
      hasReward: opportunity.hasReward || "",
      applicationMethod: opportunity.applicationMethod || "",
      applicationUrl: opportunity.applicationUrl || "",
      logoUrl: opportunity.logoUrl || "",
      deadline: formatDateForInput(opportunity.deadline),
      sourceUrl: opportunity.sourceUrl || "",
      note: opportunity.note || "",
      status: opportunity.status || "active",
      sourceType: opportunity.sourceType || "admin",
      submitterContact: opportunity.submitterContact || "",
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
      const selectedCities = normalizeFormArray(opportunityForm.cities);
      const selectedMajorCategories = normalizeFormArray(
        opportunityForm.majorCategories
      );
      const selectedSpecialties = normalizeFormArray(opportunityForm.specialties);
      const appliesToAllSpecialties =
        (selectedSpecialties.length === 0 && selectedMajorCategories.length === 0) ||
        selectedSpecialties.includes(ALL_SPECIALTIES_VALUE);
      const nextMajorCategories = Array.from(
        new Set([
          ...selectedMajorCategories,
          ...getCategoriesForSpecialties(selectedSpecialties),
        ])
      );
      const opportunityPayload = {
        ...opportunityForm,
        cities: selectedCities,
        city: selectedCities[0] || "",
        specialties: appliesToAllSpecialties ? [] : selectedSpecialties,
        majorCategories: appliesToAllSpecialties ? [] : nextMajorCategories,
      };

      const request = editingOpportunityId
        ? axios.patch(
            `${API_BASE_URL}/api/admin/opportunities/${editingOpportunityId}`,
            opportunityPayload,
            { headers: authHeaders }
          )
        : axios.post(`${API_BASE_URL}/api/admin/opportunities`, opportunityPayload, {
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
        <h1 style={{ color: adminColors.text, margin: 0 }}>
          مراجعة التجارب والاقتراحات والفرص
        </h1>
        <p style={{ color: adminColors.muted, lineHeight: 1.8 }}>
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
            color: adminColors.textSoft,
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
            background: adminColors.inputBg,
            border: `1px solid ${adminColors.inputBorder}`,
            borderRadius: "10px",
            color: adminColors.text,
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
          <p style={{ color: adminColors.muted, margin: "0 0 4px", fontSize: "13px" }}>
            العدد الحالي
          </p>
          <strong
            style={{
              color: adminColors.brand,
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
            color: adminColors.text,
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
            background: adminColors.inputBg,
            border: `1px solid ${adminColors.inputBorder}`,
            borderRadius: "10px",
            color: adminColors.text,
            padding: "11px 12px",
            fontFamily: "inherit",
          }}
        >
          <option value="experiences">التجارب</option>
          <option value="suggestions">الاقتراحات</option>
          <option value="contactMessages">رسائل التواصل</option>
          <option value="opportunities">الفرص</option>
          <option value="interviewQuestions">أسئلة المقابلات</option>
          <option value="analytics">التحليلات</option>
        </select>

        {adminView === "analytics" ? (
          <select
            value={analyticsDays}
            onChange={(e) => setAnalyticsDays(e.target.value)}
            style={{
              background: adminColors.inputBg,
              border: `1px solid ${adminColors.inputBorder}`,
              borderRadius: "10px",
              color: adminColors.text,
              padding: "11px 12px",
              fontFamily: "inherit",
            }}
          >
            {analyticsRangeOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        ) : (
          <select
            value={adminView === "opportunities" ? opportunityStatus : status}
            onChange={(e) =>
              adminView === "opportunities"
                ? setOpportunityStatus(e.target.value)
                : setStatus(e.target.value)
            }
            disabled={adminView === "suggestions" || adminView === "contactMessages"}
            style={{
              background: adminColors.inputBg,
              border: `1px solid ${adminColors.inputBorder}`,
              borderRadius: "10px",
              color: adminColors.text,
              padding: "11px 12px",
              fontFamily: "inherit",
              opacity:
                adminView === "suggestions" || adminView === "contactMessages"
                  ? 0.45
                  : 1,
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
        )}

        <button
          type="button"
          onClick={refreshCurrentView}
          disabled={loading}
          style={{
            background: adminColors.brand,
            color: "#061312",
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

      {adminView === "analytics" ? (
        <div style={{ display: "grid", gap: "12px" }}>
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "12px",
            }}
          >
            {[
              ["زوار مميزين من البداية", analytics.allTimeVisitors],
              ["جميع الزيارات من البداية", analytics.allTimePageVisits],
              [
                "النشطين الآن",
                `${analytics.activeVisitors} خلال آخر ${
                  analytics.activeWindowMinutes || 5
                } دقائق`,
              ],
              [
                "متوسط وقت الجلسة",
                formatDuration(analytics.averageSessionSeconds),
              ],
              ["جلسات مقاسة", analytics.sessionDurationSamples || 0],
              ["زوار مميزين في الفترة", analytics.uniqueVisitors],
              ["جميع الزيارات في الفترة", analytics.pageVisits],
              ["الأحداث", analytics.totalEvents],
              ["أسئلة دليل دربك", analytics.assistantQueries || 0],
              ["متابعات فهمها الدليل", analytics.assistantContextUses || 0],
              ["أسئلة بلا نتائج", analytics.assistantZeroResultQueries || 0],
              ["زيارات صفحة المقابلات", analytics.interviewPageViews || 0],
              ["زوار المقابلات", analytics.interviewVisitors || 0],
              ["بحث المقابلات", analytics.interviewSearches || 0],
              ["بدأوا إضافة أسئلة", analytics.interviewQuestionStarts || 0],
              ["أرسلوا أسئلة مقابلة", analytics.interviewQuestionSubmissions || 0],
              ["ضغطوا إعلان الملف", analytics.guideFileAdClicks || 0],
              ["ضغطوا إعلان السيرة", analytics.cvProductAdClicks || 0],
              ["فتحوا مشاركة تجربة", analytics.experienceShareMenuOpens || 0],
              ["شاركوا تجربة فعليًا", analytics.experienceShareActions || 0],
              ["فتحوا مشاركة فرصة", analytics.opportunityShareMenuOpens || 0],
              ["شاركوا فرصة فعليًا", analytics.opportunityShareActions || 0],
              ["فتحوا مشاركة جهة", analytics.trainingTargetShareMenuOpens || 0],
              ["شاركوا جهة فعليًا", analytics.trainingTargetShareActions || 0],
              ["إجمالي فتح المشاركة", analytics.shareMenuOpens || 0],
              ["إجمالي المشاركات", analytics.shareActions || 0],
              ...(analytics.rawEvents > analytics.totalEvents
                ? [["الأحداث الخام", analytics.rawEvents]]
                : []),
              ["الفترة", analytics.rangeLabel || `${analytics.days} يوم`],
              [
                "أقوى ساعة",
                analytics.hourlyActivity.length
                  ? `${analytics.hourlyActivity.reduce((max, item) =>
                      item.count > max.count ? item : max
                    ).hour}:00`
                  : "-",
              ],
            ].map(([label, value]) => (
              <div key={label} style={cardStyle}>
                <p style={{ color: adminColors.muted, margin: "0 0 8px", fontSize: 13 }}>
                  {label}
                </p>
                <strong style={{ color: adminColors.brand, fontSize: 28 }}>
                  {value}
                </strong>
              </div>
            ))}
          </section>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: "12px",
            }}
          >
            {renderAnalyticsList(
              "أكثر الأحداث",
              analytics.topEvents,
              (label) => analyticsEventLabels[label] || label
            )}
            {renderAnalyticsList("أكثر التخصصات بحثًا", analytics.topMajors)}
            {renderAnalyticsList("أكثر المدن", analytics.topCities)}
            {renderAnalyticsList("أكثر الجهات تفاعلًا", analytics.topOrganizations)}
            {renderAnalyticsList("أكثر كلمات البحث", analytics.topSearches)}
            {renderAnalyticsList(
              "نوايا دليل دربك",
              analytics.topAssistantIntents,
              (label) => assistantIntentLabels[label] || label
            )}
            {renderAnalyticsList(
              "أكثر أسئلة دليل دربك",
              analytics.topAssistantQuestions
            )}
            {renderAnalyticsList("نقرات الإعلانات", analytics.topAdClicks)}
            {renderAnalyticsList(
              "طرق المشاركة",
              analytics.topShareActions,
              (label) => shareActionLabels[label] || label
            )}
            {renderAnalyticsList("أكثر التجارب مشاركة", analytics.topSharedExperiences)}
            {renderAnalyticsList("أكثر الفرص مشاركة", analytics.topSharedOpportunities)}
            {renderAnalyticsList(
              "أكثر جهات وين أتدرب مشاركة",
              analytics.topSharedTrainingTargets
            )}
            {renderAnalyticsList(
              "جهات أسئلة المقابلات",
              analytics.topInterviewQuestionOrganizations
            )}
            {renderAnalyticsList("أكثر الصفحات", analytics.topPages)}
            {renderAnalyticsList(
              "الأجهزة",
              analytics.topDevices,
              (label) =>
                ({ mobile: "جوال", tablet: "تابلت", desktop: "لابتوب", unknown: "غير معروف" }[
                  label
                ] || label)
            )}
            {renderAnalyticsList("نتائج التشخيص", analytics.topDiagnosis)}
            {renderAnalyticsList(
              "أكثر مخاوف التشخيص",
              analytics.topFears,
              (label) => diagnosisFearLabels[label] || label
            )}
          </section>

          <section style={cardStyle}>
            <h3 style={{ color: adminColors.brand, margin: "0 0 12px" }}>
              آخر 5 أحداث
            </h3>
            <p
              style={{
                color: adminColors.muted,
                margin: "-4px 0 12px",
                fontSize: 13,
                lineHeight: 1.7,
              }}
            >
              عرض سريع للحركة الحالية فقط، بدون تفاصيل حساسة أو قائمة طويلة.
            </p>
            {analytics.recentEvents.length === 0 ? (
              <p style={{ color: adminColors.muted, margin: 0 }}>
                لا توجد أحداث مسجلة بعد.
              </p>
            ) : (
              <div style={{ display: "grid", gap: "10px" }}>
                {analytics.recentEvents.map((event) => (
                  <article
                    key={event._id}
                    style={{
                      border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: "12px",
                      padding: "10px",
                      color: adminColors.text,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "10px",
                        flexWrap: "wrap",
                        marginBottom: "6px",
                      }}
                    >
                      <strong style={{ color: adminColors.brand }}>
                        {analyticsEventLabels[event.eventName] || event.eventName}
                      </strong>
                      <span style={{ color: adminColors.muted, fontSize: 12 }}>
                        {formatAdminDateTime(event.createdAt)}
                      </span>
                    </div>
                    <p style={{ margin: 0, color: adminColors.textSoft, lineHeight: 1.7 }}>
                      {event.major ? `التخصص: ${event.major} · ` : ""}
                      {event.city ? `المدينة: ${event.city} · ` : ""}
                      {event.searchQuery ? `البحث: ${event.searchQuery} · ` : ""}
                      {event.resultsCount ? `النتائج: ${event.resultsCount} · ` : ""}
                      {event.page || ""}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : adminView === "suggestions" ? (
        <div style={{ display: "grid", gap: "12px" }}>
          {suggestions.length === 0 && !loading ? (
            <div style={{ ...cardStyle, color: adminColors.muted, textAlign: "center" }}>
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
                  <h3 style={{ color: adminColors.brand, margin: 0 }}>اقتراح من زائر</h3>
                  <div
                    style={{
                      color: adminColors.muted,
                      fontSize: "13px",
                      lineHeight: 1.8,
                      textAlign: "left",
                    }}
                  >
                    <div>أضيف:</div>
                    <strong style={{ color: adminColors.textSoft, fontWeight: "600" }}>
                      {formatAdminDateTime(suggestion.createdAt)}
                    </strong>
                  </div>
                </div>

                <p
                  style={{
                    color: adminColors.text,
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
      ) : adminView === "contactMessages" ? (
        <div style={{ display: "grid", gap: "12px" }}>
          {contactMessages.length === 0 && !loading ? (
            <div style={{ ...cardStyle, color: adminColors.muted, textAlign: "center" }}>
              لا توجد رسائل تواصل حاليًا.
            </div>
          ) : (
            contactMessages.map((item) => (
              <article key={item._id} style={cardStyle}>
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
                    <h3 style={{ color: adminColors.brand, margin: "0 0 6px" }}>
                      {item.reason || "رسالة تواصل"}
                    </h3>
                    <p style={{ margin: 0, color: adminColors.textSoft, fontSize: "13px" }}>
                      {item.contact ? `وسيلة الرد: ${item.contact}` : "بدون وسيلة رد"}
                    </p>
                  </div>
                  <div
                    style={{
                      color: adminColors.muted,
                      fontSize: "13px",
                      lineHeight: 1.8,
                      textAlign: "left",
                    }}
                  >
                    <div>أضيفت:</div>
                    <strong style={{ color: adminColors.textSoft, fontWeight: "600" }}>
                      {formatAdminDateTime(item.createdAt)}
                    </strong>
                  </div>
                </div>

                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    marginBottom: "12px",
                    padding: "5px 9px",
                    borderRadius: "999px",
                    border: `1px solid ${adminColors.inputBorder}`,
                    color:
                      item.emailStatus === "sent"
                        ? adminColors.brandStrong
                        : adminColors.muted,
                    fontSize: "12px",
                    fontWeight: "700",
                  }}
                >
                  حالة الإيميل:{" "}
                  {item.emailStatus === "sent"
                    ? "تم الإرسال"
                    : item.emailStatus === "failed"
                    ? "تعذر الإرسال"
                    : "غير مفعل"}
                </div>

                <p
                  style={{
                    color: adminColors.text,
                    lineHeight: 1.9,
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                    margin: "0 0 14px",
                  }}
                >
                  {item.message}
                </p>

                {item.emailError && (
                  <p
                    style={{
                      color: "#fca5a5",
                      fontSize: "12px",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {item.emailError}
                  </p>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => deleteContactMessage(item._id)}
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
      ) : adminView === "interviewQuestions" ? (
        <div style={{ display: "grid", gap: "12px" }}>
          {interviewQuestions.length === 0 && !loading ? (
            <div style={{ ...cardStyle, color: adminColors.muted, textAlign: "center" }}>
              لا توجد أسئلة مقابلات في هذه الحالة.
            </div>
          ) : (
            interviewQuestions.map((item) => (
              <article key={item._id} style={cardStyle}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    flexWrap: "wrap",
                    marginBottom: "12px",
                  }}
                >
                  <div>
                    <h3 style={{ color: adminColors.brand, margin: "0 0 6px" }}>
                      {item.organizationName}
                    </h3>
                    <p
                      style={{
                        color: adminColors.textSoft,
                        margin: 0,
                        lineHeight: 1.8,
                        fontSize: "13px",
                      }}
                    >
                      {item.majorCategory ? `${item.majorCategory} - ` : ""}
                      {item.major}
                      {item.city ? ` - ${item.city}` : ""}
                    </p>
                  </div>

                  <div
                    style={{
                      color: adminColors.muted,
                      fontSize: "13px",
                      lineHeight: 1.8,
                      textAlign: "left",
                    }}
                  >
                    <div>أضيف:</div>
                    <strong style={{ color: adminColors.textSoft, fontWeight: "600" }}>
                      {formatAdminDateTime(item.createdAt)}
                    </strong>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: "8px",
                    marginBottom: item.note ? "12px" : "14px",
                  }}
                >
                  {(item.questions || []).map((question, index) => (
                    <p
                      key={`${item._id}-${index}`}
                      style={{
                        margin: 0,
                        color: adminColors.text,
                        lineHeight: 1.8,
                        padding: "9px 10px",
                        borderRadius: "10px",
                        background: "rgba(125,219,205,0.06)",
                        border: "1px solid rgba(125,219,205,0.14)",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {question}
                    </p>
                  ))}
                </div>

                {item.note && (
                  <p
                    style={{
                      color: adminColors.textSoft,
                      margin: "0 0 14px",
                      lineHeight: 1.8,
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                    }}
                  >
                    ملاحظة: {item.note}
                  </p>
                )}

                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    justifyContent: "flex-end",
                    flexWrap: "wrap",
                  }}
                >
                  {item.status !== "approved" && (
                    <button
                      type="button"
                      onClick={() =>
                        updateInterviewQuestionStatus(item._id, "approved")
                      }
                      style={{
                        background: adminColors.brand,
                        color: "#061310",
                        border: "none",
                        borderRadius: "10px",
                        padding: "9px 14px",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        fontWeight: "700",
                      }}
                    >
                      قبول
                    </button>
                  )}
                  {item.status !== "rejected" && (
                    <button
                      type="button"
                      onClick={() =>
                        updateInterviewQuestionStatus(item._id, "rejected")
                      }
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
                      رفض
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteInterviewQuestion(item._id)}
                    style={{
                      background: "transparent",
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
              <h2 style={{ color: adminColors.brand, margin: "0 0 6px" }}>
                {editingOpportunityId ? "تعديل فرصة" : "إضافة فرصة تدريب"}
              </h2>
              <p style={{ color: adminColors.muted, margin: 0, lineHeight: 1.8 }}>
                الفرص هنا تظهر للطلاب في صفحة وين أتدرب بشكل مستقل عن التجارب.
              </p>
            </div>

            <div className="admin-edit-grid">
              {[
                ["organizationName", "اسم الجهة", "مثال: STC"],
                ["title", "عنوان الفرصة", "برنامج التدريب التعاوني"],
                ["applicationUrl", "رابط التقديم", "https://..."],
                ["logoUrl", "رابط الشعار", "https://.../logo.png"],
                ["sourceUrl", "رابط المصدر", "رابط إعلان رسمي إن وجد"],
                ["submitterContact", "تواصل المرسل", "اختياري"],
              ].map(([field, label, placeholder]) => (
                <label key={field} style={{ color: adminColors.textSoft, fontSize: "13px" }}>
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

              <MultiChipSelector
                label="المدن أو المناطق المناسبة"
                values={opportunityForm.cities}
                options={opportunityCityOptions}
                onChange={(nextCities) =>
                  updateOpportunityField("cities", nextCities)
                }
                emptyLabel="كل المدن"
                maxHeight="150px"
                helpText="اترك/يها على كل المدن إذا كانت الفرصة عامة، أو اضغطي أكثر من مدينة/منطقة لإضافتها."
              />

              <MultiChipSelector
                label="التخصصات الرئيسية المناسبة"
                values={opportunityForm.majorCategories}
                options={majorCategoryOptions}
                onChange={(nextCategories) =>
                  updateOpportunityField("majorCategories", nextCategories)
                }
                emptyLabel="كل التخصصات"
                maxHeight="165px"
                helpText="اختاري أكثر من تخصص رئيسي بالضغط على الشرائح. تركها فارغة يعني أن الفرصة عامة أو حسب التخصصات الفرعية المختارة."
              />

              <div
                style={{
                  color: adminColors.textSoft,
                  fontSize: "13px",
                  gridColumn: "1 / -1",
                }}
              >
                <MultiChipSelector
                  label="التخصصات الفرعية المناسبة"
                  values={opportunityForm.specialties}
                  options={[
                    {
                      value: ALL_SPECIALTIES_VALUE,
                      label: "جميع التخصصات",
                    },
                    ...getSpecialtiesForCategories(
                      normalizeFormArray(opportunityForm.majorCategories)
                    ).map((option) => ({
                      value: option.name,
                      label: option.name,
                    })),
                  ]}
                  onChange={(nextSpecialties) =>
                    updateOpportunityField("specialties", nextSpecialties)
                  }
                  emptyLabel="كل التخصصات الفرعية"
                  maxHeight="190px"
                  showEmptyButton={false}
                  helpText="إذا اخترت/ي تخصصات رئيسية، تظهر لك فروعها فقط هنا. اختيار جميع التخصصات يجعل الفرصة عامة."
                />
                {!normalizeFormArray(opportunityForm.specialties).includes(
                  ALL_SPECIALTIES_VALUE
                ) && (
                  <small
                    style={{
                      display: "block",
                      marginTop: "5px",
                      color: adminColors.brand,
                      lineHeight: 1.7,
                    }}
                  >
                    التصنيف الرئيسي:{" "}
                    {Array.from(
                      new Set([
                        ...normalizeFormArray(opportunityForm.majorCategories),
                        ...getCategoriesForSpecialties(
                          normalizeFormArray(opportunityForm.specialties)
                        ),
                      ])
                    ).join("، ") || "غير محدد"}
                  </small>
                )}
              </div>

              <label style={{ color: adminColors.textSoft, fontSize: "13px" }}>
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
                  style={{ color: adminColors.textSoft, fontSize: "13px" }}
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

            <label style={{ color: adminColors.textSoft, fontSize: "13px" }}>
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
                color: adminColors.textSoft,
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
                    color: adminColors.textSoft,
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
                  background: adminColors.brand,
                  color: "#061312",
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
            <div style={{ ...cardStyle, color: adminColors.muted, textAlign: "center" }}>
              لا توجد فرص في هذا التصنيف.
            </div>
          ) : (
            opportunities.map((opportunity) => {
              const applicationState = getOpportunityApplicationState(
                opportunity.deadline
              );
              const generalOpportunity = isGeneralOpportunity(opportunity);

              return (
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
                    <h3 style={{ color: adminColors.brand, margin: "0 0 6px" }}>
                      {opportunity.title}
                    </h3>
                    <p style={{ color: adminColors.textSoft, margin: 0, lineHeight: 1.7 }}>
                      {opportunity.organizationName}
                      {getOpportunityCitiesText(opportunity)
                        ? ` - ${getOpportunityCitiesText(opportunity)}`
                        : ""}
                    </p>
                  </div>
                  <span
                    style={{
                      alignSelf: "start",
                      background:
                        applicationState.tone === "open"
                          ? "rgba(34,197,94,0.12)"
                          : "rgba(248,113,113,0.12)",
                      border:
                        applicationState.tone === "open"
                          ? "1px solid rgba(34,197,94,0.34)"
                          : "1px solid rgba(248,113,113,0.34)",
                      color:
                        applicationState.tone === "open" ? "#86efac" : "#fecaca",
                      borderRadius: "999px",
                      padding: "6px 10px",
                      fontSize: "12px",
                      fontWeight: "bold",
                    }}
                  >
                    التقديم {applicationState.label}
                  </span>
                  <span
                    style={{
                      alignSelf: "start",
                      background:
                        opportunity.sourceType === "visitor"
                          ? "rgba(250,204,21,0.1)"
                          : "rgba(125,219,205,0.08)",
                      border:
                        opportunity.sourceType === "visitor"
                          ? "1px solid rgba(250,204,21,0.28)"
                          : "1px solid rgba(125,219,205,0.18)",
                      color:
                        opportunity.sourceType === "visitor"
                          ? "#fde68a"
                          : adminColors.brand,
                      borderRadius: "999px",
                      padding: "6px 10px",
                      fontSize: "12px",
                      fontWeight: "bold",
                    }}
                  >
                    {opportunity.sourceType === "visitor"
                      ? "من زائر"
                      : "إضافة إدارية"}
                  </span>
                  <div
                    style={{
                      color: adminColors.muted,
                      fontSize: "13px",
                      lineHeight: 1.8,
                      textAlign: "left",
                    }}
                  >
                    <div>آخر تحديث:</div>
                    <strong style={{ color: adminColors.textSoft, fontWeight: "600" }}>
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
                    color: adminColors.text,
                    lineHeight: 1.9,
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                    margin: "0 0 12px",
                  }}
                >
                  {opportunity.note || "لا توجد ملاحظة."}
                </p>

                {opportunity.submitterContact && (
                  <p
                    style={{
                      color: adminColors.textSoft,
                      background: "rgba(255,255,255,0.035)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: "10px",
                      padding: "8px 10px",
                      margin: "0 0 12px",
                      fontSize: "13px",
                      lineHeight: 1.7,
                    }}
                  >
                    تواصل المرسل: {opportunity.submitterContact}
                  </p>
                )}

                <div
                  style={{
                    color: adminColors.muted,
                    fontSize: "13px",
                    lineHeight: 1.8,
                    marginBottom: "12px",
                  }}
                >
                  <div>
                    المدن: {getOpportunityCitiesText(opportunity) || "كل المدن"}
                  </div>
                  <div>
                    التخصصات الرئيسية:{" "}
                    {generalOpportunity
                      ? "جميع التخصصات"
                      : (opportunity.majorCategories || []).join("، ") || "عام"}
                  </div>
                  <div>
                    التخصصات:{" "}
                    {generalOpportunity
                      ? "جميع التخصصات"
                      : (opportunity.specialties || []).join("، ") || "عام"}
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
                      color: adminColors.brand,
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
              );
            })
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {experiences.length === 0 && !loading ? (
            <div style={{ ...cardStyle, color: adminColors.muted, textAlign: "center" }}>
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
                  <h3 style={{ color: adminColors.brand, margin: "0 0 6px" }}>
                    {exp.title || `تجربة في ${exp.organizationName}`}
                  </h3>
                  <p style={{ color: adminColors.textSoft, margin: 0, lineHeight: 1.7 }}>
                    {exp.organizationName} - {exp.city} - {getReadableMajor(exp)}
                  </p>
                </div>
                <div
                  style={{
                    color: adminColors.muted,
                    fontSize: "13px",
                    lineHeight: 1.8,
                    textAlign: "left",
                  }}
                >
                  <div>أضيفت:</div>
                  <strong style={{ color: adminColors.textSoft, fontWeight: "600" }}>
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
                  ["ambassadorConsent", "سفير دربك"],
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

              {exp.ambassadorConsent === "yes" && exp.ambassadorLinkedInUrl && (
                <a
                  href={exp.ambassadorLinkedInUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    margin: "0 0 12px",
                    color: adminColors.brand,
                    background: "rgba(125,219,205,0.08)",
                    border: "1px solid rgba(125,219,205,0.22)",
                    borderRadius: "10px",
                    padding: "8px 10px",
                    fontSize: "13px",
                    textDecoration: "none",
                    overflowWrap: "anywhere",
                  }}
                >
                  رابط سفير دربك: {exp.ambassadorLinkedInUrl}
                </a>
              )}

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
                      ["ambassadorLinkedInUrl", "رابط LinkedIn للسفير"],
                      ["ambassadorProfileImageUrl", "رابط صورة السفير"],
                    ].map(([field, label]) => (
                      <label key={field} style={{ color: adminColors.textSoft, fontSize: "13px" }}>
                        {label}
                        <input
                          value={editForm[field] || ""}
                          onChange={(e) => updateEditField(field, e.target.value)}
                          style={{
                            width: "100%",
                            boxSizing: "border-box",
                            marginTop: "5px",
                            background: adminColors.inputBg,
                            color: adminColors.text,
                            border: `1px solid ${adminColors.inputBorder}`,
                            borderRadius: "9px",
                            padding: "9px",
                            fontFamily: "inherit",
                          }}
                        />
                      </label>
                    ))}
                  </div>

                  <div className="admin-edit-grid">
                    <label style={{ color: adminColors.textSoft, fontSize: "13px" }}>
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
                        style={{ color: adminColors.textSoft, fontSize: "13px" }}
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

                  <label style={{ color: adminColors.textSoft, fontSize: "13px" }}>
                    وصف التجربة
                    <textarea
                      value={editForm.description || ""}
                      onChange={(e) => updateEditField("description", e.target.value)}
                      rows={6}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        marginTop: "5px",
                        background: adminColors.inputBg,
                        color: adminColors.text,
                        border: `1px solid ${adminColors.inputBorder}`,
                        borderRadius: "9px",
                        padding: "10px",
                        fontFamily: "inherit",
                        lineHeight: 1.8,
                      }}
                    />
                  </label>

                  <label style={{ color: adminColors.textSoft, fontSize: "13px" }}>
                    أسئلة المقابلة
                    <textarea
                      value={editForm.interviewQuestions || ""}
                      onChange={(e) =>
                        updateEditField("interviewQuestions", e.target.value)
                      }
                      rows={4}
                      placeholder="اكتبي كل سؤال في سطر مستقل"
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        marginTop: "5px",
                        background: adminColors.inputBg,
                        color: adminColors.text,
                        border: `1px solid ${adminColors.inputBorder}`,
                        borderRadius: "9px",
                        padding: "10px",
                        fontFamily: "inherit",
                        lineHeight: 1.8,
                      }}
                    />
                  </label>

                  <label style={{ color: adminColors.textSoft, fontSize: "13px" }}>
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
                        background: adminColors.inputBg,
                        color: adminColors.text,
                        border: `1px solid ${adminColors.inputBorder}`,
                        borderRadius: "9px",
                        padding: "10px",
                        fontFamily: "inherit",
                        lineHeight: 1.8,
                      }}
                    />
                  </label>
                </div>
              ) : (
                <>
                  <p
                    style={{
                      color: adminColors.text,
                      lineHeight: 1.9,
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {exp.description}
                  </p>

                  {Array.isArray(exp.interviewQuestions) &&
                    exp.interviewQuestions.length > 0 && (
                      <div
                        style={{
                          marginTop: "12px",
                          padding: "12px",
                          borderRadius: "12px",
                          background: "rgba(125,219,205,0.06)",
                          border: "1px solid rgba(125,219,205,0.16)",
                        }}
                      >
                        <strong
                          style={{
                            display: "block",
                            color: adminColors.brandStrong,
                            marginBottom: "8px",
                          }}
                        >
                          أسئلة المقابلة
                        </strong>
                        <div style={{ display: "grid", gap: "7px" }}>
                          {exp.interviewQuestions.map((question, index) => (
                            <span
                              key={`${exp._id}-question-${index}`}
                              style={{
                                color: adminColors.text,
                                lineHeight: 1.7,
                                overflowWrap: "anywhere",
                              }}
                            >
                              {question}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                </>
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
                        background: adminColors.brand,
                        color: "#061312",
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
                        color: adminColors.textSoft,
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
                          background: adminColors.brand,
                          color: "#061312",
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
                        color: adminColors.brand,
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
