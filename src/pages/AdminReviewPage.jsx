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

const normalizeArabicDigits = (value = "") =>
  value
    .toString()
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));

const isValidEmailContact = (value = "") =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());

const isValidSaudiMobileContact = (value = "") => {
  const digits = normalizeArabicDigits(value).replace(/[^\d+]/g, "");
  const number = digits.startsWith("+") ? digits : digits.replace(/^\+?/, "");

  return (
    /^\+9665\d{8}$/.test(digits) ||
    /^9665\d{8}$/.test(number) ||
    /^05\d{8}$/.test(number) ||
    /^5\d{8}$/.test(number)
  );
};

const isValidSubscriptionContact = (value = "") =>
  isValidEmailContact(value) || isValidSaudiMobileContact(value);

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
  "ambassadorDisplayName",
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
  "الشرقية",
  "القصيم",
  "منطقة الرياض",
  "منطقة مكة",
  "منطقة المدينة",
  "منطقة عسير",
  "منطقة تبوك",
  "منطقة حائل",
  "منطقة الحدود الشمالية",
  "منطقة جازان",
  "منطقة نجران",
  "منطقة الباحة",
  "منطقة الجوف",
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
  premiumEventCounts: [],
  premiumFunnelSummary: {
    gateOpened: { events: 0, uniqueVisitors: 0 },
    planSelected: { events: 0, uniqueVisitors: 0 },
    checkoutStarted: { events: 0, uniqueVisitors: 0 },
    paymentReturned: { events: 0, uniqueVisitors: 0 },
    paymentSuccessful: { events: 0, uniqueVisitors: 0 },
    manualActiveSubscriptions: 0,
    adminAccessUsers: 0,
  },
  topPremiumPlans: [],
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
  portfolioEventCounts: [],
  portfolioSummary: {
    totalPortfolios: 0,
    publishedPortfolios: 0,
    recentPortfoliosCreated: 0,
    portfoliosWithCv: 0,
    portfoliosWithAvatar: 0,
    portfoliosWithProjects: 0,
    portfoliosWithCertifications: 0,
    totalPublicViews: 0,
    averagePublicViews: 0,
    builderOpened: { events: 0, uniqueVisitors: 0 },
    saved: { events: 0, uniqueVisitors: 0 },
    savedFromPage: { events: 0, uniqueVisitors: 0 },
    fileUploaded: { events: 0, uniqueVisitors: 0 },
    publicViewed: { events: 0, uniqueVisitors: 0 },
    linkedInShared: { events: 0, uniqueVisitors: 0 },
    referralCopied: { events: 0, uniqueVisitors: 0 },
    badgeDownloaded: { events: 0, uniqueVisitors: 0 },
    nativeShared: { events: 0, uniqueVisitors: 0 },
    linkCopied: { events: 0, uniqueVisitors: 0 },
  },
  topPortfolioMajors: [],
  topPortfolioCities: [],
  topPortfolioUniversities: [],
  topPortfolioReadiness: [],
  recentPortfolios: [],
  topViewedPortfolios: [],
  hourlyActivity: [],
  recentEvents: [],
  rawEvents: 0,
  rangeLabel: "آخر 30 يوم",
};

const emptyUserManagement = {
  summary: {
    totalUsers: 0,
    contactUsers: 0,
    visitorOnlyUsers: 0,
    adminUsers: 0,
    premiumUsers: 0,
    freeUsers: 0,
    filteredUsers: 0,
    totalSubscriptions: 0,
    activeSubscriptions: 0,
    pendingSubscriptions: 0,
    expiredSubscriptions: 0,
    cancelledSubscriptions: 0,
    filteredSubscriptions: 0,
    allTimeVisitors: 0,
    allTimePageVisits: 0,
    activeVisitors: 0,
    activeWindowMinutes: 5,
    paidSubscriptions: 0,
    totalPaidRevenueSar: 0,
    activeRevenueSar: 0,
  },
  emailSettings: {
    resendConfigured: false,
    emailTo: "",
    emailFrom: "",
  },
  planBreakdown: [],
  users: [],
  subscriptions: [],
  returnedUsers: 0,
  returnedSubscriptions: 0,
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
  premium_gate_closed: "إغلاق نافذة الاشتراك",
  premium_nav_cta_clicked: "ضغط زر دربك+",
  premium_experiences_banner_clicked: "ضغط بنر دربك+ في التجارب",
  premium_where_to_train_opportunities_banner_clicked:
    "ضغط بنر دربك+ في الفرص",
  premium_plan_selected: "اختيار باقة دربك+",
  premium_checkout_started: "بدء الدفع",
  premium_checkout_failed: "تعذر بدء الدفع",
  premium_payment_returned: "رجوع من ميسر",
  premium_access_verified: "تفعيل اشتراك",
  premium_payment_email_attempt: "محاولة إرسال إيميل الدفع",
  premium_payment_email_sent: "إيميل دفع مرسل",
  premium_access_help_requested: "نسيان رمز دربك+",
  premium_access_reset_clicked: "ضغط نسيت الرمز",
  premium_access_reset_requested: "طلب إعادة تعيين الرمز",
  premium_access_reset_email_sent: "إيميل إعادة تعيين مرسل",
  premium_access_reset_email_failed: "فشل إيميل إعادة التعيين",
  premium_access_code_reset: "تم تغيير رمز الدخول",
  account_access_reset_requested: "طلب استعادة من حسابي",
  admin_email_test: "اختبار بريد الإدارة",
  account_modal_opened: "فتح حسابي",
  account_login_success: "دخول حساب ناجح",
  account_login_failed: "دخول حساب فاشل",
  account_logout_clicked: "تسجيل خروج",
  account_access_help_requested: "نسيان الرمز من حسابي",
  portfolio_announcement_viewed: "ظهور إعلان ملف الأعمال",
  portfolio_announcement_cta_clicked: "ضغط إعلان ملف الأعمال",
  portfolio_builder_opened: "فتح بناء ملف الأعمال",
  portfolio_saved_from_page: "حفظ ملف الأعمال من الصفحة",
  portfolio_saved: "حفظ ملف الأعمال",
  portfolio_file_uploaded: "رفع ملف أعمال",
  portfolio_public_viewed: "مشاهدة ملف أعمال عام",
  portfolio_inactive_opened: "فتح ملف غير مفعل",
  portfolio_native_share_clicked: "مشاركة ملف الأعمال",
  portfolio_link_copied: "نسخ رابط ملف الأعمال",
  portfolio_linkedin_share_clicked: "مشاركة LinkedIn للملف",
  portfolio_referral_link_copied: "نسخ رابط إحالة الملف",
  portfolio_badge_downloaded: "تحميل بطاقة ملف الأعمال",
};

const premiumFunnelSteps = [
  ["premium_gate_opened", "ظهرت نافذة دربك+"],
  ["premium_nav_cta_clicked", "ضغطوا زر دربك+"],
  ["premium_where_to_train_opportunities_banner_clicked", "ضغطوا بنر الفرص"],
  ["premium_plan_selected", "اختاروا باقة"],
  ["premium_checkout_started", "بدأوا الدفع"],
  ["premium_payment_returned", "رجعوا من ميسر"],
  ["premium_access_verified", "مدفوعات ميسر ناجحة"],
  ["premium_payment_email_attempt", "محاولات إيميل الدفع"],
];

const premiumSupportSteps = [
  ["premium_gate_closed", "أغلقوا النافذة"],
  ["premium_checkout_failed", "تعذر بدء الدفع"],
  ["premium_payment_email_sent", "إيميل دفع مرسل"],
  ["admin_email_test", "اختبار بريد الإدارة"],
  ["account_login_success", "دخول مشترك ناجح"],
  ["account_login_failed", "محاولة دخول فاشلة"],
  ["premium_access_help_requested", "طلب نسيت الرمز"],
  ["account_access_help_requested", "نسيت الرمز من حسابي"],
];

const portfolioFunnelSteps = [
  ["portfolio_announcement_viewed", "شاهدوا إعلان الميزة"],
  ["portfolio_announcement_cta_clicked", "ضغطوا إعلان الميزة"],
  ["portfolio_builder_opened", "فتحوا صفحة البناء"],
  ["portfolio_saved", "حفظوا ملف أعمال"],
  ["portfolio_file_uploaded", "رفعوا ملف أو صورة"],
  ["portfolio_public_viewed", "مشاهدات الرابط العام"],
  ["portfolio_linkedin_share_clicked", "شاركوا في LinkedIn"],
  ["portfolio_badge_downloaded", "حمّلوا البطاقة"],
  ["portfolio_referral_link_copied", "نسخوا رابط الإحالة"],
];

const premiumPlanLabels = {
  monthly: "دربك+ شهري",
  one_time_90: "دربك+ 3 أشهر",
  admin: "حساب إدارة",
};

const manualSubscriptionPlanOptions = [
  {
    id: "monthly",
    label: "دربك+ شهري",
    days: "30",
    priceSar: "5.99",
  },
  {
    id: "one_time_90",
    label: "دربك+ 3 أشهر",
    days: "90",
    priceSar: "15",
  },
];

const defaultManualSubscriptionForm = {
  contact: "",
  accessCode: "",
  planId: "one_time_90",
  days: "90",
  priceSar: "15",
  providerPaymentId: "",
};

const userStatusOptions = [
  ["all", "كل المستخدمين"],
  ["premium", "المشتركين"],
  ["free", "حسابات مجانية"],
  ["visitor", "زوار بدون حساب"],
  ["admin", "الإدارة"],
];

const accessTypeLabels = {
  admin: "إدارة",
  premium: "مشترك",
  free: "مجاني",
  visitor: "زائر",
};

const subscriptionStatusLabels = {
  active: "نشط",
  pending: "بانتظار الدفع",
  expired: "منتهي",
  cancelled: "ملغي",
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

const opportunityFilterStatusOptions = [
  ["all", "كل الفرص"],
  ...opportunityStatusOptions,
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

const getOpportunityApplicationState = (deadline, status = "") => {
  if (status === "expired") return { label: "مغلق", tone: "closed" };
  if (status === "draft") return { label: "بانتظار المراجعة", tone: "draft" };
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

const getOpportunityBadgeStyle = (tone = "open") => {
  const styles = {
    open: {
      background: "rgba(34,197,94,0.12)",
      border: "1px solid rgba(34,197,94,0.34)",
      color: "#86efac",
    },
    closed: {
      background: "rgba(248,113,113,0.12)",
      border: "1px solid rgba(248,113,113,0.34)",
      color: "#fecaca",
    },
    draft: {
      background: "rgba(250,204,21,0.12)",
      border: "1px solid rgba(250,204,21,0.3)",
      color: "#fde68a",
    },
  };

  return {
    ...(styles[tone] || styles.open),
    borderRadius: "999px",
    padding: "6px 10px",
    fontSize: "12px",
    fontWeight: "bold",
    whiteSpace: "nowrap",
  };
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

const formatAdminCurrency = (value = 0) =>
  `${Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })} ريال`;

const getSubscriptionStatusLabel = (subscription = {}) =>
  subscriptionStatusLabels[subscription.status] ||
  subscription.status ||
  "غير محدد";

const getAccessTypeLabel = (accessType = "") =>
  accessTypeLabels[accessType] || accessType || "غير محدد";

const getSubscriptionPlanLabel = (planId = "") =>
  premiumPlanLabels[planId] || planId || "غير محدد";

const isUnclearMajorText = (value = "") => {
  const text = value.toString().trim();
  if (!text) return true;

  const letters = text.match(/[A-Za-z\u0600-\u06FF]/g) || [];
  return letters.length < 2;
};

const getReadableMajor = (exp = {}) =>
  isUnclearMajorText(exp.major) ? exp.majorCategory || exp.major : exp.major;

const normalizeAdminSearchText = (value = "") =>
  value
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[أإآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ـ/g, "")
    .replace(/[\u064B-\u065F]/g, "")
    .replace(/\s+/g, " ");

const isActiveFeaturedAmbassador = (exp = {}) =>
  Boolean(exp.featuredAmbassador) &&
  exp.ambassadorConsent === "yes" &&
  (Boolean(exp.ambassadorLinkedInUrl) || Boolean(exp.ambassadorDisplayName)) &&
  (!exp.featuredAmbassadorUntil ||
    new Date(exp.featuredAmbassadorUntil).getTime() > Date.now());

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
  const [userManagement, setUserManagement] = useState(emptyUserManagement);
  const [userStatus, setUserStatus] = useState("all");
  const [userSearch, setUserSearch] = useState("");
  const [experienceSearch, setExperienceSearch] = useState("");
  const [opportunitySearch, setOpportunitySearch] = useState("");
  const [opportunityCityFilter, setOpportunityCityFilter] = useState("");
  const [opportunitySourceFilter, setOpportunitySourceFilter] = useState("");
  const [opportunityRewardFilter, setOpportunityRewardFilter] = useState("");
  const [opportunityFeaturedFilter, setOpportunityFeaturedFilter] = useState("");
  const [opportunityFilterVersion, setOpportunityFilterVersion] = useState(0);
  const [manualSubscriptionForm, setManualSubscriptionForm] = useState(
    defaultManualSubscriptionForm
  );
  const [savingManualSubscription, setSavingManualSubscription] = useState(false);
  const [resendingPaymentEmailId, setResendingPaymentEmailId] = useState("");
  const [testingAdminEmail, setTestingAdminEmail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [updatingFeaturedExperienceId, setUpdatingFeaturedExperienceId] =
    useState("");
  const [opportunityForm, setOpportunityForm] = useState(defaultOpportunityForm);
  const [editingOpportunityId, setEditingOpportunityId] = useState(null);
  const [savingOpportunity, setSavingOpportunity] = useState(false);

  const authHeaders = password ? { "x-admin-password": password } : {};
  const normalizedExperienceSearch = normalizeAdminSearchText(experienceSearch);
  const visibleExperiences = normalizedExperienceSearch
    ? experiences.filter((exp) =>
        [
          exp.title,
          exp.organizationName,
          exp.city,
          exp.majorCategory,
          exp.major,
          exp.ambassadorDisplayName,
          exp.ambassadorLinkedInUrl,
        ]
          .map(normalizeAdminSearchText)
          .some((value) => value.includes(normalizedExperienceSearch))
      )
    : experiences;
  const userManagementSummary = {
    ...emptyUserManagement.summary,
    ...(userManagement.summary || {}),
  };
  const isUserManagementFiltered =
    adminView === "users" && (userStatus !== "all" || Boolean(userSearch.trim()));
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
      : adminView === "users"
      ? isUserManagementFiltered
        ? userManagementSummary.filteredUsers ||
          userManagement.returnedUsers ||
          userManagement.users.length
        : userManagementSummary.allTimeVisitors ||
          userManagementSummary.totalUsers ||
          userManagement.users.length
      : visibleExperiences.length;
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
      : adminView === "users"
      ? "زائر/مستخدم"
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
        params: {
          status: opportunityStatus === "all" ? "" : opportunityStatus,
          search: opportunitySearch.trim(),
          city: opportunityCityFilter,
          sourceType: opportunitySourceFilter,
          hasReward: opportunityRewardFilter,
          featured: opportunityFeaturedFilter,
        },
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

      setAnalytics({
        ...emptyAnalytics,
        ...data,
        premiumFunnelSummary: {
          ...emptyAnalytics.premiumFunnelSummary,
          ...(data.premiumFunnelSummary || {}),
        },
        portfolioSummary: {
          ...emptyAnalytics.portfolioSummary,
          ...(data.portfolioSummary || {}),
        },
      });
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

  const fetchUserManagement = async () => {
    if (!password) {
      setMessage("اكتب كلمة المرور لعرض المحتوى.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");
      sessionStorage.setItem("darbak_admin_password", password);

      const { data } = await axios.get(`${API_BASE_URL}/api/admin/users`, {
        params: {
          status: userStatus,
          search: userSearch.trim(),
        },
        headers: authHeaders,
      });

      setUserManagement({
        ...emptyUserManagement,
        ...data,
        summary: { ...emptyUserManagement.summary, ...(data.summary || {}) },
        emailSettings: {
          ...emptyUserManagement.emailSettings,
          ...(data.emailSettings || {}),
        },
        planBreakdown: Array.isArray(data.planBreakdown) ? data.planBreakdown : [],
        users: Array.isArray(data.users) ? data.users : [],
        subscriptions: Array.isArray(data.subscriptions)
          ? data.subscriptions
          : [],
      });
    } catch (err) {
      console.error(err);
      setMessage(
        err.response?.status === 401
          ? "كلمة المرور غير صحيحة."
          : "تعذر تحميل المستخدمين والاشتراكات."
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
    } else if (adminView === "users") {
      fetchUserManagement();
    } else {
      fetchExperiences();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    status,
    opportunityStatus,
    opportunityCityFilter,
    opportunitySourceFilter,
    opportunityRewardFilter,
    opportunityFeaturedFilter,
    opportunityFilterVersion,
    analyticsDays,
    userStatus,
    adminView,
  ]);

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

    if (adminView === "users") {
      fetchUserManagement();
      return;
    }

    fetchExperiences();
  };

  const updateManualSubscriptionField = (field, value) => {
    setManualSubscriptionForm((prev) => {
      if (field === "planId") {
        const selectedPlan = manualSubscriptionPlanOptions.find(
          (plan) => plan.id === value
        );

        return {
          ...prev,
          planId: value,
          days: selectedPlan?.days || prev.days,
          priceSar: selectedPlan?.priceSar || prev.priceSar,
        };
      }

      return { ...prev, [field]: value };
    });
    setMessage("");
  };

  const prefillManualSubscriptionContact = (contact = "") => {
    if (!contact) return;

    setManualSubscriptionForm((prev) => ({
      ...prev,
      contact,
      accessCode: "",
    }));
    setMessage(
      "تم تعبئة وسيلة الدخول. اكتب رمز دخول جديد ثم فعّل الاشتراك بعد التحقق من الدفع."
    );
  };

  const saveManualSubscription = async (event) => {
    event.preventDefault();

    const contact = manualSubscriptionForm.contact.trim();
    const accessCode = manualSubscriptionForm.accessCode.trim();

    if (!contact) {
      setMessage("اكتب البريد الإلكتروني، أو رقم الجوال لحساب قديم، لتفعيل الاشتراك.");
      return;
    }

    if (!isValidSubscriptionContact(contact)) {
      setMessage("اكتب بريدًا إلكترونيًا صحيحًا، أو رقم جوال سعودي لحساب قديم.");
      return;
    }

    if (accessCode.length < 4) {
      setMessage("اكتب رمز دخول جديد من 4 خانات أو أكثر.");
      return;
    }

    try {
      setSavingManualSubscription(true);
      setMessage("");

      const { data } = await axios.post(
        `${API_BASE_URL}/api/admin/subscriptions`,
        {
          contact,
          accessCode,
          planId: manualSubscriptionForm.planId,
          days: Number(manualSubscriptionForm.days) || undefined,
          priceSar: Number(manualSubscriptionForm.priceSar) || undefined,
          provider: "manual",
          providerPaymentId: manualSubscriptionForm.providerPaymentId.trim(),
        },
        { headers: authHeaders }
      );

      setMessage(
        `تم تفعيل دربك+ لـ ${data.email || contact}. أرسل للمستخدم نفس الرمز الجديد الذي كتبته الآن، لأنه لا يمكن عرضه لاحقًا.`
      );
      setManualSubscriptionForm((prev) => ({
        ...defaultManualSubscriptionForm,
        contact: data.email || contact,
      }));
      fetchUserManagement();
    } catch (err) {
      console.error(err);
      setMessage(
        err.response?.data?.error ||
          "تعذر تفعيل الاشتراك يدويًا. تأكدي من كلمة مرور الإدارة والبيانات."
      );
    } finally {
      setSavingManualSubscription(false);
    }
  };

  const resendPaymentEmail = async (subscription = {}) => {
    if (!subscription.id) return;

    if (!subscription.providerPaymentId) {
      setMessage("هذا الاشتراك ما فيه رقم عملية دفع مرتبط، لذلك ما نقدر نعيد إيميل الدفع.");
      return;
    }

    try {
      setResendingPaymentEmailId(subscription.id);
      setMessage("");

      const { data } = await axios.post(
        `${API_BASE_URL}/api/admin/subscriptions/${subscription.id}/resend-payment-email`,
        {},
        { headers: authHeaders }
      );

      setMessage(
        `تم إرسال إيميل الدفع إلى ${data.emailTo || "إيميل الإدارة"} بنجاح.`
      );
    } catch (err) {
      console.error(err);
      setMessage(
        err.response?.data?.error ||
          "تعذر إعادة إرسال إيميل الدفع. تأكدي من إعدادات Resend في Render."
      );
    } finally {
      setResendingPaymentEmailId("");
    }
  };

  const sendAdminEmailTest = async () => {
    try {
      setTestingAdminEmail(true);
      setMessage("");

      const { data } = await axios.post(
        `${API_BASE_URL}/api/admin/email/test`,
        {},
        { headers: authHeaders }
      );

      setMessage(
        `تم إرسال اختبار البريد إلى ${data.emailTo || "إيميل الإدارة"}. شيكي الوارد والسبام.`
      );
      fetchUserManagement();
    } catch (err) {
      console.error(err);
      const details = err.response?.data?.emailError
        ? ` التفاصيل: ${err.response.data.emailError}`
        : "";
      setMessage(
        `${err.response?.data?.error || "تعذر إرسال اختبار البريد."}${details}`
      );
    } finally {
      setTestingAdminEmail(false);
    }
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

  const toggleFeaturedAmbassador = async (exp) => {
    const currentlyActive = isActiveFeaturedAmbassador(exp);
    let ambassadorDisplayName = exp.ambassadorDisplayName || "";

    if (!currentlyActive) {
      const suggestedName = ambassadorDisplayName || "";
      const enteredName = window.prompt(
        "اكتبي اسم سفير دربك الذي يظهر على الكرت. تقدرين تتركينه فارغ ويظهر حساب LinkedIn بدل الاسم.",
        suggestedName
      );

      if (enteredName === null) return;
      ambassadorDisplayName = enteredName.trim();
    }

    try {
      setMessage("");
      setUpdatingFeaturedExperienceId(exp._id);

      const { data } = await axios.patch(
        `${API_BASE_URL}/api/admin/experiences/${exp._id}/featured-ambassador`,
        {
          active: !currentlyActive,
          days: 7,
          ambassadorDisplayName,
        },
        { headers: authHeaders }
      );

      setExperiences((prev) =>
        prev.map((item) => (item._id === exp._id ? data : item))
      );
      setMessage(
        currentlyActive
          ? "تم إلغاء تمييز التجربة من سفراء دربك."
          : "تم تمييز التجربة ضمن سفراء دربك لمدة أسبوع."
      );
    } catch (err) {
      console.error(err);
      setMessage(
        err.response?.data?.error ||
          "تعذر تحديث تمييز سفير دربك لهذه التجربة."
      );
    } finally {
      setUpdatingFeaturedExperienceId("");
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

  const getPremiumEventStats = (eventName) => {
    const item = (analytics.premiumEventCounts || []).find(
      (event) => event.label === eventName
    );

    return {
      count: item?.count || 0,
      uniqueVisitors: item?.uniqueVisitors || 0,
    };
  };

  const getPortfolioEventStats = (eventName) => {
    const item = (analytics.portfolioEventCounts || []).find(
      (event) => event.label === eventName
    );

    return {
      count: item?.count || 0,
      uniqueVisitors: item?.uniqueVisitors || 0,
    };
  };

  const renderPremiumStep = ([eventName, label], index) => {
    const stats = getPremiumEventStats(eventName);

    return (
      <article
        key={eventName}
        style={{
          background: "rgba(102,208,195,0.055)",
          border: "1px solid rgba(102,208,195,0.14)",
          borderRadius: "14px",
          padding: "14px",
          minHeight: "92px",
          display: "grid",
          gap: "8px",
          alignContent: "space-between",
        }}
      >
        <span
          style={{
            color: adminColors.muted,
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          خطوة {index + 1}
        </span>
        <strong style={{ color: adminColors.brand, fontSize: 28 }}>
          {stats.count}
        </strong>
        <span style={{ color: adminColors.text, fontSize: 13, lineHeight: 1.7 }}>
          {label}
        </span>
        <small style={{ color: adminColors.muted, lineHeight: 1.6 }}>
          {stats.uniqueVisitors} مستخدم فريد
        </small>
      </article>
    );
  };

  const renderPortfolioStep = ([eventName, label]) => {
    const stats = getPortfolioEventStats(eventName);

    return (
      <article
        key={eventName}
        style={{
          background: "rgba(102,208,195,0.055)",
          border: "1px solid rgba(102,208,195,0.14)",
          borderRadius: "14px",
          padding: "12px",
          display: "grid",
          gap: "7px",
        }}
      >
        <span style={{ color: adminColors.textSoft, fontSize: 12, fontWeight: 800 }}>
          {label}
        </span>
        <strong style={{ color: adminColors.brand, fontSize: 24 }}>
          {stats.count}
        </strong>
        <small style={{ color: adminColors.muted }}>
          {stats.uniqueVisitors} مستخدم فريد
        </small>
      </article>
    );
  };

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

  const applyOpportunityFilters = () => {
    setOpportunityFilterVersion((currentVersion) => currentVersion + 1);
  };

  const resetOpportunityFilters = () => {
    setOpportunityStatus("active");
    setOpportunitySearch("");
    setOpportunityCityFilter("");
    setOpportunitySourceFilter("");
    setOpportunityRewardFilter("");
    setOpportunityFeaturedFilter("");
    applyOpportunityFilters();
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
    window.setTimeout(() => {
      document
        .getElementById("admin-opportunity-form")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
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

  const renderAdminMetricCard = ([label, value, hint]) => (
    <div key={label} style={cardStyle}>
      <p style={{ color: adminColors.muted, margin: "0 0 8px", fontSize: 13 }}>
        {label}
      </p>
      <strong style={{ color: adminColors.brand, fontSize: 28, lineHeight: 1.2 }}>
        {value}
      </strong>
      {hint ? (
        <small
          style={{
            display: "block",
            color: adminColors.textSoft,
            marginTop: 8,
            lineHeight: 1.6,
          }}
        >
          {hint}
        </small>
      ) : null}
    </div>
  );

  const renderStatusBadge = (label, tone = "neutral") => {
    const toneColors = {
      active: ["rgba(52,211,153,0.12)", "rgba(52,211,153,0.28)", "#86efac"],
      pending: ["rgba(250,204,21,0.12)", "rgba(250,204,21,0.28)", "#fde68a"],
      expired: ["rgba(248,113,113,0.12)", "rgba(248,113,113,0.28)", "#fecaca"],
      neutral: [
        "rgba(102,208,195,0.12)",
        "rgba(102,208,195,0.22)",
        adminColors.brand,
      ],
    };
    const [background, border, color] = toneColors[tone] || toneColors.neutral;

    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 28,
          padding: "4px 10px",
          borderRadius: "999px",
          background,
          border: `1px solid ${border}`,
          color,
          fontSize: 12,
          fontWeight: 900,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    );
  };

  const renderUserManagement = () => {
    const summary = {
      ...emptyUserManagement.summary,
      ...(userManagement.summary || {}),
    };
    const emailSettings = {
      ...emptyUserManagement.emailSettings,
      ...(userManagement.emailSettings || {}),
    };
    const users = userManagement.users || [];
    const subscriptions = userManagement.subscriptions || [];
    const planBreakdown = userManagement.planBreakdown || [];
    const manualSubscriptionInputStyle = {
      width: "100%",
      boxSizing: "border-box",
      background: adminColors.inputBg,
      border: `1px solid ${adminColors.inputBorder}`,
      borderRadius: "10px",
      color: adminColors.text,
      padding: "11px 12px",
      fontFamily: "inherit",
    };

    return (
      <div style={{ display: "grid", gap: "12px" }}>
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: "12px",
          }}
        >
          {[
            [
              "زوار مميزين من البداية",
              summary.allTimeVisitors,
              "كل جهاز/متصفح له معرف زائر مستقل.",
            ],
            [
              "جميع الزيارات من البداية",
              summary.allTimePageVisits,
              "كل فتح صفحة في المنصة.",
            ],
            [
              "النشطين الآن",
              summary.activeVisitors,
              `آخر ${summary.activeWindowMinutes || 5} دقائق.`,
            ],
            [
              "حسابات الوصول",
              summary.totalUsers,
              "حسابات دربك+ أو زوار وصلوا لحدود المحتوى.",
            ],
            ["حسابات ببيانات دخول", summary.contactUsers],
            ["إجمالي الاشتراكات", summary.totalSubscriptions],
            ["مشتركين نشطين", summary.activeSubscriptions],
            ["بانتظار الدفع", summary.pendingSubscriptions],
            ["اشتراكات منتهية", summary.expiredSubscriptions],
            ["حسابات الإدارة", summary.adminUsers],
            [
              "إجمالي مدفوعات مسجلة",
              formatAdminCurrency(summary.totalPaidRevenueSar),
              "حسب الاشتراكات النشطة أو المنتهية، بدون طلبات الدفع المعلقة.",
            ],
            [
              "قيمة الاشتراكات النشطة",
              formatAdminCurrency(summary.activeRevenueSar),
            ],
          ].map(renderAdminMetricCard)}
        </section>

        <section
          style={{
            ...cardStyle,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
            borderColor: emailSettings.resendConfigured
              ? "rgba(102,208,195,0.22)"
              : "rgba(251,191,36,0.28)",
          }}
        >
          <div style={{ display: "grid", gap: "6px" }}>
            <h3 style={{ color: adminColors.brand, margin: 0 }}>
              إشعارات الدفع عبر الإيميل
            </h3>
            <p style={{ color: adminColors.muted, margin: 0, lineHeight: 1.7 }}>
              الحالة:{" "}
              <strong
                style={{
                  color: emailSettings.resendConfigured
                    ? adminColors.brandStrong
                    : "#fbbf24",
                }}
              >
                {emailSettings.resendConfigured ? "Resend مفعّل" : "Resend غير مفعّل"}
              </strong>
            </p>
            <small style={{ color: adminColors.textSoft, lineHeight: 1.8 }}>
              من: {emailSettings.emailFrom || "-"} · إلى:{" "}
              {emailSettings.emailTo || "-"}
            </small>
          </div>

          <button
            type="button"
            onClick={sendAdminEmailTest}
            disabled={testingAdminEmail}
            style={{
              background: adminColors.brand,
              color: "#061312",
              border: "none",
              borderRadius: "999px",
              padding: "11px 16px",
              cursor: testingAdminEmail ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              fontWeight: 900,
            }}
          >
            {testingAdminEmail ? "جار الاختبار..." : "اختبار البريد"}
          </button>
        </section>

        <section
          style={{
            ...cardStyle,
            borderColor: "rgba(102,208,195,0.22)",
            background:
              "linear-gradient(135deg, rgba(102,208,195,0.08), rgba(255,255,255,0.025))",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
              marginBottom: "14px",
            }}
          >
            <div>
              <h3 style={{ color: adminColors.brand, margin: "0 0 6px" }}>
                تفعيل أو تحديث اشتراك يدوي
              </h3>
              <p
                style={{
                  color: adminColors.textSoft,
                  margin: 0,
                  lineHeight: 1.8,
                  fontSize: 13,
                  maxWidth: 720,
                }}
              >
                استخدمها بعد التأكد من الدفع في ميسر أو عند مساعدة مستخدم نسي
                الرمز. اكتب رمزًا جديدًا وأرسله له مباشرة، لأن دربك لا يعرض
                الرموز القديمة.
              </p>
            </div>
            {renderStatusBadge("لا يعرض الرمز القديم", "neutral")}
          </div>

          <form
            onSubmit={saveManualSubscription}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: "10px",
              alignItems: "end",
            }}
          >
            <label style={{ display: "grid", gap: "6px", color: adminColors.muted }}>
              <span style={{ fontSize: 12, fontWeight: 800 }}>
                البريد الإلكتروني أو رقم حساب قديم
              </span>
              <input
                type="text"
                inputMode="text"
                value={manualSubscriptionForm.contact}
                onChange={(e) =>
                  updateManualSubscriptionField("contact", e.target.value)
                }
                placeholder="email@example.com أو 05xxxxxxxx"
                style={manualSubscriptionInputStyle}
              />
            </label>

            <label style={{ display: "grid", gap: "6px", color: adminColors.muted }}>
              <span style={{ fontSize: 12, fontWeight: 800 }}>رمز دخول جديد</span>
              <input
                value={manualSubscriptionForm.accessCode}
                onChange={(e) =>
                  updateManualSubscriptionField("accessCode", e.target.value)
                }
                placeholder="مثال: Darbak872"
                autoComplete="off"
                style={manualSubscriptionInputStyle}
              />
            </label>

            <label style={{ display: "grid", gap: "6px", color: adminColors.muted }}>
              <span style={{ fontSize: 12, fontWeight: 800 }}>الباقة</span>
              <select
                value={manualSubscriptionForm.planId}
                onChange={(e) =>
                  updateManualSubscriptionField("planId", e.target.value)
                }
                style={manualSubscriptionInputStyle}
              >
                {manualSubscriptionPlanOptions.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.label}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: "6px", color: adminColors.muted }}>
              <span style={{ fontSize: 12, fontWeight: 800 }}>عدد الأيام</span>
              <input
                type="number"
                min="1"
                value={manualSubscriptionForm.days}
                onChange={(e) =>
                  updateManualSubscriptionField("days", e.target.value)
                }
                style={manualSubscriptionInputStyle}
              />
            </label>

            <label style={{ display: "grid", gap: "6px", color: adminColors.muted }}>
              <span style={{ fontSize: 12, fontWeight: 800 }}>القيمة</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={manualSubscriptionForm.priceSar}
                onChange={(e) =>
                  updateManualSubscriptionField("priceSar", e.target.value)
                }
                style={manualSubscriptionInputStyle}
              />
            </label>

            <label style={{ display: "grid", gap: "6px", color: adminColors.muted }}>
              <span style={{ fontSize: 12, fontWeight: 800 }}>
                رقم عملية ميسر اختياري
              </span>
              <input
                value={manualSubscriptionForm.providerPaymentId}
                onChange={(e) =>
                  updateManualSubscriptionField("providerPaymentId", e.target.value)
                }
                placeholder="pay_..."
                style={manualSubscriptionInputStyle}
              />
            </label>

            <button
              type="submit"
              disabled={savingManualSubscription}
              style={{
                background: adminColors.brand,
                color: "#061312",
                border: "none",
                borderRadius: "10px",
                padding: "12px 16px",
                cursor: savingManualSubscription ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                fontWeight: 900,
                minHeight: 45,
              }}
            >
              {savingManualSubscription ? "جار التفعيل..." : "تفعيل دربك+"}
            </button>
          </form>
        </section>

        <section style={cardStyle}>
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
                توزيع الباقات
              </h3>
              <p style={{ color: adminColors.muted, margin: 0, lineHeight: 1.7 }}>
                يوضح أكثر الباقات استخدامًا وقيمة المدفوعات المسجلة لكل باقة.
              </p>
            </div>
            {renderStatusBadge(`${summary.totalSubscriptions} اشتراك`, "neutral")}
          </div>

          {planBreakdown.length === 0 ? (
            <p style={{ color: adminColors.muted, margin: 0 }}>
              لا توجد اشتراكات مسجلة بعد.
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "10px",
              }}
            >
              {planBreakdown.map((plan) => (
                <article
                  key={plan.planId || "unknown"}
                  style={{
                    border: `1px solid ${adminColors.inputBorder}`,
                    borderRadius: "12px",
                    padding: "12px",
                    background: "rgba(255,255,255,0.025)",
                  }}
                >
                  <strong style={{ color: adminColors.text }}>
                    {getSubscriptionPlanLabel(plan.planId)}
                  </strong>
                  <p style={{ color: adminColors.brand, margin: "8px 0 4px" }}>
                    {plan.count || 0} اشتراك
                  </p>
                  <small style={{ color: adminColors.muted }}>
                    {formatAdminCurrency(plan.revenue)}
                  </small>
                </article>
              ))}
            </div>
          )}
        </section>

        <section style={cardStyle}>
          <h3 style={{ color: adminColors.brand, margin: "0 0 6px" }}>
            الاشتراكات
          </h3>
          <p style={{ color: adminColors.muted, margin: "0 0 12px", lineHeight: 1.7 }}>
            آخر الاشتراكات وحالتها. لا يتم عرض رمز الدخول لأنه محفوظ بطريقة مشفرة.
          </p>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                minWidth: 900,
                borderCollapse: "collapse",
                color: adminColors.text,
              }}
            >
              <thead>
                <tr style={{ color: adminColors.muted, fontSize: 12 }}>
                  <th style={{ textAlign: "right", padding: "10px" }}>الحساب</th>
                  <th style={{ textAlign: "right", padding: "10px" }}>الحالة</th>
                  <th style={{ textAlign: "right", padding: "10px" }}>الباقة</th>
                  <th style={{ textAlign: "right", padding: "10px" }}>القيمة</th>
                  <th style={{ textAlign: "right", padding: "10px" }}>ينتهي في</th>
                  <th style={{ textAlign: "right", padding: "10px" }}>مزود الدفع</th>
                  <th style={{ textAlign: "right", padding: "10px" }}>آخر تحديث</th>
                  <th style={{ textAlign: "right", padding: "10px" }}>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ padding: "14px", color: adminColors.muted }}>
                      لا توجد اشتراكات في هذا العرض.
                    </td>
                  </tr>
                ) : (
                  subscriptions.map((subscription) => {
                    const statusTone =
                      subscription.status === "active"
                        ? "active"
                        : subscription.status === "pending"
                        ? "pending"
                        : subscription.status === "expired"
                        ? "expired"
                        : "neutral";
                    const canResendPaymentEmail =
                      Boolean(subscription.providerPaymentId) &&
                      ["active", "expired"].includes(subscription.status);
                    const isResendingPaymentEmail =
                      resendingPaymentEmailId === subscription.id;

                    return (
                      <tr
                        key={subscription.id}
                        style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
                      >
                        <td style={{ padding: "10px", whiteSpace: "nowrap" }}>
                          {subscription.email || "-"}
                        </td>
                        <td style={{ padding: "10px" }}>
                          {renderStatusBadge(
                            getSubscriptionStatusLabel(subscription),
                            statusTone
                          )}
                        </td>
                        <td style={{ padding: "10px" }}>
                          {getSubscriptionPlanLabel(subscription.planId)}
                        </td>
                        <td style={{ padding: "10px" }}>
                          {formatAdminCurrency(subscription.priceSar)}
                        </td>
                        <td style={{ padding: "10px" }}>
                          {formatAdminDateTime(subscription.expiresAt)}
                        </td>
                        <td style={{ padding: "10px" }}>
                          {subscription.provider || "-"}
                        </td>
                        <td style={{ padding: "10px" }}>
                          {formatAdminDateTime(subscription.updatedAt)}
                        </td>
                        <td style={{ padding: "10px" }}>
                          <div
                            style={{
                              display: "flex",
                              gap: "7px",
                              flexWrap: "wrap",
                              alignItems: "center",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                prefillManualSubscriptionContact(subscription.email)
                              }
                              style={{
                                background: "rgba(102,208,195,0.1)",
                                border: `1px solid ${adminColors.inputBorder}`,
                                borderRadius: "999px",
                                color: adminColors.brand,
                                cursor: "pointer",
                                fontFamily: "inherit",
                                fontSize: 12,
                                fontWeight: 800,
                                padding: "7px 10px",
                                whiteSpace: "nowrap",
                              }}
                            >
                              استخدم الحساب
                            </button>
                            <button
                              type="button"
                              onClick={() => resendPaymentEmail(subscription)}
                              disabled={!canResendPaymentEmail || isResendingPaymentEmail}
                              title={
                                canResendPaymentEmail
                                  ? "إعادة إرسال إيميل الدفع للإدارة"
                                  : "متاح فقط للاشتراكات المفعلة ولديها رقم عملية دفع"
                              }
                              style={{
                                background: canResendPaymentEmail
                                  ? "rgba(142,231,220,0.14)"
                                  : "rgba(255,255,255,0.035)",
                                border: `1px solid ${
                                  canResendPaymentEmail
                                    ? "rgba(142,231,220,0.35)"
                                    : "rgba(255,255,255,0.08)"
                                }`,
                                borderRadius: "999px",
                                color: canResendPaymentEmail
                                  ? adminColors.brandStrong
                                  : adminColors.muted,
                                cursor:
                                  !canResendPaymentEmail || isResendingPaymentEmail
                                    ? "not-allowed"
                                    : "pointer",
                                fontFamily: "inherit",
                                fontSize: 12,
                                fontWeight: 900,
                                padding: "7px 10px",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {isResendingPaymentEmail
                                ? "جار الإرسال..."
                                : "إيميل الدفع"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section style={cardStyle}>
          <h3 style={{ color: adminColors.brand, margin: "0 0 6px" }}>
            المستخدمين
          </h3>
          <p style={{ color: adminColors.muted, margin: "0 0 12px", lineHeight: 1.7 }}>
            يعرض الحسابات التي دخلت أو استخدمت الوصول المجاني أو دربك+.
          </p>

          <div style={{ display: "grid", gap: "10px" }}>
            {users.length === 0 ? (
              <p style={{ color: adminColors.muted, margin: 0 }}>
                لا يوجد مستخدمين مطابقين للبحث الحالي.
              </p>
            ) : (
              users.map((user) => {
                const statusTone =
                  user.accessType === "premium" || user.accessType === "admin"
                    ? "active"
                    : user.accessType === "free"
                    ? "neutral"
                    : "pending";

                return (
                  <article
                    key={user.id}
                    style={{
                      border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: "12px",
                      padding: "12px",
                      display: "grid",
                      gap: "10px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "10px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <strong style={{ color: adminColors.text }}>
                          {user.contact || "زائر بدون حساب"}
                        </strong>
                        <p
                          style={{
                            margin: "5px 0 0",
                            color: adminColors.muted,
                            fontSize: 12,
                            lineHeight: 1.7,
                          }}
                        >
                          {user.visitorId ? `Visitor ID: ${user.visitorId}` : "حساب دخول"}
                        </p>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          flexWrap: "wrap",
                        }}
                      >
                        {renderStatusBadge(getAccessTypeLabel(user.accessType), statusTone)}
                        {user.contact ? (
                          <button
                            type="button"
                            onClick={() =>
                              prefillManualSubscriptionContact(user.contact)
                            }
                            style={{
                              background: "rgba(102,208,195,0.1)",
                              border: `1px solid ${adminColors.inputBorder}`,
                              borderRadius: "999px",
                              color: adminColors.brand,
                              cursor: "pointer",
                              fontFamily: "inherit",
                              fontSize: 12,
                              fontWeight: 800,
                              padding: "7px 10px",
                            }}
                          >
                            تفعيل/تحديث
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                        gap: "8px",
                        color: adminColors.textSoft,
                        fontSize: 13,
                      }}
                    >
                      <span>ينتهي: {formatAdminDateTime(user.premiumExpiresAt)}</span>
                      <span>مشاهدات اليوم: {user.dailyViewsCount || 0}</span>
                      <span>عناصر اليوم: {user.dailyItemsCount || 0}</span>
                      <span>آخر يوم مشاهدة: {user.lastViewedDate || "-"}</span>
                      <span>رمز دخول: {user.hasAccessCode ? "موجود" : "غير موجود"}</span>
                      <span>آخر تحديث: {formatAdminDateTime(user.updatedAt)}</span>
                    </div>

                    {user.subscription ? (
                      <small style={{ color: adminColors.brand, lineHeight: 1.7 }}>
                        الاشتراك المرتبط: {getSubscriptionPlanLabel(user.subscription.planId)} ·{" "}
                        {getSubscriptionStatusLabel(user.subscription)} ·{" "}
                        {formatAdminCurrency(user.subscription.priceSar)}
                      </small>
                    ) : null}
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    );
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
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, max-content))",
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
          <option value="users">المستخدمين والاشتراكات</option>
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
        ) : adminView === "users" ? (
          <>
            <select
              value={userStatus}
              onChange={(e) => setUserStatus(e.target.value)}
              style={{
                background: adminColors.inputBg,
                border: `1px solid ${adminColors.inputBorder}`,
                borderRadius: "10px",
                color: adminColors.text,
                padding: "11px 12px",
                fontFamily: "inherit",
              }}
            >
              {userStatusOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  fetchUserManagement();
                }
              }}
              placeholder="بحث بالبريد"
              style={{
                minWidth: "220px",
                background: adminColors.inputBg,
                border: `1px solid ${adminColors.inputBorder}`,
                borderRadius: "10px",
                color: adminColors.text,
                padding: "11px 12px",
                fontFamily: "inherit",
              }}
            />
          </>
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
              opportunityFilterStatusOptions.map(([value, label]) => (
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

        {adminView === "experiences" && (
          <input
            value={experienceSearch}
            onChange={(e) => setExperienceSearch(e.target.value)}
            placeholder="ابحثي في التجارب المقبولة بالجهة، المدينة، التخصص أو اسم السفير"
            style={{
              minWidth: "320px",
              background: adminColors.inputBg,
              border: `1px solid ${adminColors.inputBorder}`,
              borderRadius: "10px",
              color: adminColors.text,
              padding: "11px 12px",
              fontFamily: "inherit",
            }}
          />
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

          <section style={cardStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
                alignItems: "flex-start",
                flexWrap: "wrap",
                marginBottom: "14px",
              }}
            >
              <div>
                <h3 style={{ color: adminColors.brand, margin: "0 0 6px" }}>
                  مسار دربك+
                </h3>
                <p
                  style={{
                    color: adminColors.muted,
                    margin: 0,
                    fontSize: 13,
                    lineHeight: 1.7,
                  }}
                >
                  يوضح لك أين يتوقف الطالب: هل شاهد العرض، بدأ الدفع، رجع من ميسر،
                  أو تفعل اشتراكه.
                </p>
              </div>
              <strong
                style={{
                  color: adminColors.text,
                  background: "rgba(102,208,195,0.12)",
                  border: "1px solid rgba(102,208,195,0.2)",
                  borderRadius: "999px",
                  padding: "8px 12px",
                  fontSize: 13,
                }}
              >
                {analytics.rangeLabel || `${analytics.days} يوم`}
              </strong>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: "10px",
                marginBottom: "14px",
              }}
            >
              {[
                [
                  "شاهدوا نافذة الاشتراك",
                  analytics.premiumFunnelSummary?.gateOpened?.events || 0,
                  `${analytics.premiumFunnelSummary?.gateOpened?.uniqueVisitors || 0} مستخدم فريد`,
                ],
                [
                  "بدأوا الدفع",
                  analytics.premiumFunnelSummary?.checkoutStarted?.events || 0,
                  `${analytics.premiumFunnelSummary?.checkoutStarted?.uniqueVisitors || 0} مستخدم فريد`,
                ],
                [
                  "مدفوعات ميسر ناجحة",
                  analytics.premiumFunnelSummary?.paymentSuccessful?.events || 0,
                  "مشتركين حقيقيين فقط",
                ],
                [
                  "تفعيلات يدوية",
                  analytics.premiumFunnelSummary?.manualActiveSubscriptions || 0,
                  "منفصلة عن ميسر",
                ],
                [
                  "حسابات إدارة/تجربة",
                  analytics.premiumFunnelSummary?.adminAccessUsers || 0,
                  "لا تدخل في المدفوعات",
                ],
              ].map(([label, value, hint]) => renderAdminMetricCard([label, value, hint]))}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: "10px",
                marginBottom: "14px",
              }}
            >
              {premiumFunnelSteps.map(renderPremiumStep)}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "12px",
              }}
            >
              {renderAnalyticsList(
                "تفاصيل إضافية لدربك+",
                premiumSupportSteps.map(([eventName, label]) => ({
                  label,
                  count: getPremiumEventStats(eventName).count,
                }))
              )}
              {renderAnalyticsList(
                "الباقات الأكثر اختيارًا",
                analytics.topPremiumPlans || [],
                (label) => premiumPlanLabels[label] || label
              )}
            </div>
          </section>

          <section style={cardStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
                alignItems: "flex-start",
                flexWrap: "wrap",
                marginBottom: "14px",
              }}
            >
              <div>
                <h3 style={{ color: adminColors.brand, margin: "0 0 6px" }}>
                  ملفات الأعمال Portfolio
                </h3>
                <p
                  style={{
                    color: adminColors.muted,
                    margin: 0,
                    fontSize: 13,
                    lineHeight: 1.7,
                  }}
                >
                  متابعة بناء الملفات، الطلاب، التخصصات، الملفات المرفوعة،
                  ومشاركة LinkedIn والبطاقة الرقمية.
                </p>
              </div>
              <strong
                style={{
                  color: adminColors.text,
                  background: "rgba(102,208,195,0.12)",
                  border: "1px solid rgba(102,208,195,0.2)",
                  borderRadius: "999px",
                  padding: "8px 12px",
                  fontSize: 13,
                }}
              >
                {analytics.portfolioSummary?.totalPortfolios || 0} ملف
              </strong>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: "10px",
                marginBottom: "14px",
              }}
            >
              {[
                [
                  "إجمالي ملفات الأعمال",
                  analytics.portfolioSummary?.totalPortfolios || 0,
                  "كل الملفات المحفوظة",
                ],
                [
                  "ملفات منشورة",
                  analytics.portfolioSummary?.publishedPortfolios || 0,
                  "اختاروا نشر الرابط",
                ],
                [
                  "ملفات جديدة في الفترة",
                  analytics.portfolioSummary?.recentPortfoliosCreated || 0,
                  analytics.rangeLabel || `${analytics.days} يوم`,
                ],
                [
                  "مع سيرة ذاتية",
                  analytics.portfolioSummary?.portfoliosWithCv || 0,
                  "PDF مرفوع",
                ],
                [
                  "مع صورة شخصية",
                  analytics.portfolioSummary?.portfoliosWithAvatar || 0,
                  "صورة مضغوطة",
                ],
                [
                  "مع مشاريع",
                  analytics.portfolioSummary?.portfoliosWithProjects || 0,
                  "فيها مشروع واحد على الأقل",
                ],
                [
                  "مع شهادات",
                  analytics.portfolioSummary?.portfoliosWithCertifications || 0,
                  "دورات أو شهادات",
                ],
                [
                  "مشاهدات الروابط العامة",
                  analytics.portfolioSummary?.totalPublicViews || 0,
                  `متوسط ${analytics.portfolioSummary?.averagePublicViews || 0}`,
                ],
              ].map(renderAdminMetricCard)}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: "10px",
                marginBottom: "14px",
              }}
            >
              {portfolioFunnelSteps.map(renderPortfolioStep)}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "12px",
                marginBottom: "14px",
              }}
            >
              {renderAnalyticsList("تخصصات ملفات الأعمال", analytics.topPortfolioMajors)}
              {renderAnalyticsList("مدن ملفات الأعمال", analytics.topPortfolioCities)}
              {renderAnalyticsList(
                "جامعات ملفات الأعمال",
                analytics.topPortfolioUniversities
              )}
              {renderAnalyticsList(
                "حالات الجاهزية",
                analytics.topPortfolioReadiness
              )}
              {renderAnalyticsList(
                "أكثر ملفات الأعمال مشاهدة",
                analytics.topViewedPortfolios
              )}
            </div>

            <div
              style={{
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: "14px",
                overflowX: "auto",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "minmax(160px, 1.2fr) minmax(130px, 1fr) minmax(130px, 1fr) minmax(130px, 1fr) minmax(150px, 1fr)",
                  gap: "10px",
                  padding: "10px 12px",
                  color: adminColors.muted,
                  fontSize: 12,
                  fontWeight: 900,
                  borderBottom: "1px solid rgba(255,255,255,0.07)",
                  minWidth: "760px",
                }}
              >
                <span>الطالب</span>
                <span>التخصص</span>
                <span>المدينة / الجامعة</span>
                <span>الملفات والمحتوى</span>
                <span>الحالة</span>
              </div>
              <div>
                {(analytics.recentPortfolios || []).length === 0 ? (
                  <p style={{ color: adminColors.muted, margin: 0, padding: "14px" }}>
                    لا توجد ملفات أعمال بعد.
                  </p>
                ) : (
                  analytics.recentPortfolios.map((portfolio) => (
                    <article
                      key={portfolio.id || portfolio.slug}
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "minmax(160px, 1.2fr) minmax(130px, 1fr) minmax(130px, 1fr) minmax(130px, 1fr) minmax(150px, 1fr)",
                        gap: "10px",
                        minWidth: "760px",
                        padding: "12px",
                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                        color: adminColors.text,
                        alignItems: "start",
                      }}
                    >
                      <div style={{ display: "grid", gap: "4px" }}>
                        <strong style={{ color: adminColors.brand }}>
                          {portfolio.fullName || "بدون اسم"}
                        </strong>
                        <small style={{ color: adminColors.muted, direction: "ltr" }}>
                          {portfolio.email || portfolio.slug || "-"}
                        </small>
                      </div>
                      <span style={{ lineHeight: 1.7 }}>
                        {portfolio.major || "-"}
                        {portfolio.degreeLevel ? ` · ${portfolio.degreeLevel}` : ""}
                      </span>
                      <span style={{ lineHeight: 1.7 }}>
                        {[portfolio.city, portfolio.university].filter(Boolean).join(" · ") ||
                          "-"}
                      </span>
                      <span style={{ lineHeight: 1.8, color: adminColors.textSoft }}>
                        {portfolio.hasCv ? "CV" : "بدون CV"} ·{" "}
                        {portfolio.hasAvatar ? "صورة" : "بدون صورة"} ·{" "}
                        {portfolio.projectsCount || 0} مشاريع ·{" "}
                        {portfolio.certificationsCount || 0} شهادات
                      </span>
                      <span style={{ lineHeight: 1.8, color: adminColors.textSoft }}>
                        {portfolio.isPublished ? "منشور" : "غير منشور"} ·{" "}
                        {portfolio.viewCount || 0} مشاهدة
                        <br />
                        <small style={{ color: adminColors.muted }}>
                          {formatAdminDateTime(portfolio.updatedAt)}
                        </small>
                      </span>
                    </article>
                  ))
                )}
              </div>
            </div>
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
      ) : adminView === "users" ? (
        renderUserManagement()
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
          <section
            style={{
              ...cardStyle,
              display: "grid",
              gap: "12px",
            }}
          >
            <div>
              <h2 style={{ color: adminColors.brand, margin: "0 0 6px" }}>
                فلاتر الفرص
              </h2>
              <p style={{ color: adminColors.muted, margin: 0, lineHeight: 1.8 }}>
                ابحثي بسرعة حسب الجهة، المدينة، المصدر، المكافأة أو حالة التمييز.
              </p>
            </div>
            <div className="admin-opportunity-filters">
              <label style={{ color: adminColors.textSoft, fontSize: "13px" }}>
                بحث
                <input
                  value={opportunitySearch}
                  onChange={(e) => setOpportunitySearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applyOpportunityFilters();
                    }
                  }}
                  placeholder="اسم الجهة، الفرصة، التخصص..."
                  style={adminSelectStyle}
                />
              </label>

              <label style={{ color: adminColors.textSoft, fontSize: "13px" }}>
                المدينة أو المنطقة
                <select
                  value={opportunityCityFilter}
                  onChange={(e) => setOpportunityCityFilter(e.target.value)}
                  style={adminSelectStyle}
                >
                  <option value="">كل المدن والمناطق</option>
                  {opportunityCityOptions.map((cityName) => (
                    <option key={`filter-city-${cityName}`} value={cityName}>
                      {cityName}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ color: adminColors.textSoft, fontSize: "13px" }}>
                المصدر
                <select
                  value={opportunitySourceFilter}
                  onChange={(e) => setOpportunitySourceFilter(e.target.value)}
                  style={adminSelectStyle}
                >
                  <option value="">كل المصادر</option>
                  <option value="admin">إضافة إدارية</option>
                  <option value="visitor">من زائر</option>
                </select>
              </label>

              <label style={{ color: adminColors.textSoft, fontSize: "13px" }}>
                المكافأة
                <select
                  value={opportunityRewardFilter}
                  onChange={(e) => setOpportunityRewardFilter(e.target.value)}
                  style={adminSelectStyle}
                >
                  <option value="">الكل</option>
                  <option value="yes">يوجد مكافأة</option>
                  <option value="no">لا يوجد مكافأة</option>
                </select>
              </label>

              <label style={{ color: adminColors.textSoft, fontSize: "13px" }}>
                التمييز
                <select
                  value={opportunityFeaturedFilter}
                  onChange={(e) => setOpportunityFeaturedFilter(e.target.value)}
                  style={adminSelectStyle}
                >
                  <option value="">الكل</option>
                  <option value="true">مميزة فقط</option>
                  <option value="false">غير مميزة</option>
                </select>
              </label>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={resetOpportunityFilters}
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
                مسح الفلاتر
              </button>
              <button
                type="button"
                onClick={applyOpportunityFilters}
                disabled={loading}
                style={{
                  background: adminColors.brand,
                  color: "#061312",
                  border: "none",
                  borderRadius: "10px",
                  padding: "9px 14px",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  fontWeight: "bold",
                }}
              >
                تطبيق الفلاتر
              </button>
            </div>
          </section>

          <form
            id="admin-opportunity-form"
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
            <div className="admin-opportunities-grid">
              {opportunities.map((opportunity) => {
              const applicationState = getOpportunityApplicationState(
                opportunity.deadline,
                opportunity.status
              );
              const generalOpportunity = isGeneralOpportunity(opportunity);
              const sourceLabel =
                opportunity.sourceType === "visitor" ? "من زائر" : "إضافة إدارية";
              const primarySpecialties = generalOpportunity
                ? "جميع التخصصات"
                : (opportunity.specialties || []).slice(0, 3).join("، ") ||
                  (opportunity.majorCategories || []).slice(0, 2).join("، ") ||
                  "عام";
              const notePreview =
                (opportunity.note || "").trim().length > 115
                  ? `${opportunity.note.trim().slice(0, 115)}...`
                  : opportunity.note || "لا توجد ملاحظة للطلاب.";

              return (
              <article
                key={opportunity._id}
                className="admin-opportunity-card"
                style={{
                  ...cardStyle,
                  display: "grid",
                  gap: "12px",
                  minHeight: "320px",
                  alignContent: "space-between",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "14px",
                      background: "rgba(125,219,205,0.12)",
                      border: "1px solid rgba(125,219,205,0.25)",
                      color: adminColors.brand,
                      display: "grid",
                      placeItems: "center",
                      fontWeight: "900",
                      flex: "0 0 auto",
                    }}
                    aria-hidden="true"
                  >
                    {(opportunity.organizationName || "ف").trim().slice(0, 1)}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h3
                      style={{
                        color: adminColors.brand,
                        margin: "0 0 5px",
                        fontSize: "17px",
                        lineHeight: 1.5,
                        overflowWrap: "anywhere",
                      }}
                    >
                      {opportunity.organizationName}
                    </h3>
                    <p
                      style={{
                        color: adminColors.textSoft,
                        margin: 0,
                        lineHeight: 1.7,
                        fontSize: "13px",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {opportunity.title}
                      {getOpportunityCitiesText(opportunity)
                        ? ` - ${getOpportunityCitiesText(opportunity)}`
                        : ""}
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "7px",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={getOpportunityBadgeStyle(applicationState.tone)}>
                    {applicationState.label}
                  </span>
                  <span
                    style={{
                      ...getOpportunityBadgeStyle(
                        opportunity.sourceType === "visitor" ? "draft" : "open"
                      ),
                      color:
                        opportunity.sourceType === "visitor"
                          ? "#fde68a"
                          : adminColors.brand,
                    }}
                  >
                    {sourceLabel}
                  </span>
                  {opportunity.featured && (
                    <span style={getOpportunityBadgeStyle("open")}>مميزة</span>
                  )}
                  {[
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
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: "8px",
                    color: adminColors.textSoft,
                    fontSize: "12px",
                    lineHeight: 1.7,
                  }}
                >
                  {[
                    ["المدن", getOpportunityCitiesText(opportunity) || "كل المدن"],
                    ["التخصص", primarySpecialties],
                    [
                      "ينتهي",
                      opportunity.deadline
                        ? formatDateForInput(opportunity.deadline)
                        : "غير محدد",
                    ],
                    ["آخر تحديث", formatAdminDateTime(opportunity.updatedAt)],
                  ].map(([label, value]) => (
                    <div
                      key={`${opportunity._id}-${label}`}
                      style={{
                        background: "rgba(255,255,255,0.032)",
                        border: "1px solid rgba(255,255,255,0.065)",
                        borderRadius: "12px",
                        padding: "9px 10px",
                        minWidth: 0,
                      }}
                    >
                      <span style={{ color: adminColors.muted, display: "block" }}>
                        {label}
                      </span>
                      <strong
                        style={{
                          color: adminColors.text,
                          fontWeight: "700",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {value}
                      </strong>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    color: adminColors.text,
                    lineHeight: 1.8,
                    fontSize: "13px",
                    background: "rgba(255,255,255,0.026)",
                    border: "1px solid rgba(255,255,255,0.055)",
                    borderRadius: "12px",
                    padding: "10px",
                    minHeight: "64px",
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                  }}
                >
                  {notePreview}
                </div>

                {(opportunity.submitterContact ||
                  opportunity.applicationUrl ||
                  opportunity.sourceUrl) && (
                  <div
                    style={{
                      color: adminColors.textSoft,
                      fontSize: "12px",
                      lineHeight: 1.8,
                      display: "grid",
                      gap: "3px",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {opportunity.submitterContact && (
                      <span>تواصل المرسل: {opportunity.submitterContact}</span>
                    )}
                    {opportunity.applicationUrl && (
                      <span>رابط التقديم: {opportunity.applicationUrl}</span>
                    )}
                    {opportunity.sourceUrl && (
                      <span>رابط المصدر: {opportunity.sourceUrl}</span>
                    )}
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    marginTop: "auto",
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
              })}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {visibleExperiences.length === 0 && !loading ? (
            <div style={{ ...cardStyle, color: adminColors.muted, textAlign: "center" }}>
              {experienceSearch.trim()
                ? "لا توجد تجربة مطابقة لبحثك في هذا التصنيف."
                : "لا توجد تجارب في هذا التصنيف."}
            </div>
          ) : (
            visibleExperiences.map((exp) => (
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
                  رابط سفير دربك:{" "}
                  {exp.ambassadorDisplayName
                    ? `${exp.ambassadorDisplayName} - `
                    : ""}
                  {exp.ambassadorLinkedInUrl}
                </a>
              )}

              {isActiveFeaturedAmbassador(exp) && (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    margin: "0 0 12px",
                    color: adminColors.brand,
                    background: "rgba(125,219,205,0.1)",
                    border: "1px solid rgba(125,219,205,0.3)",
                    borderRadius: "999px",
                    padding: "7px 10px",
                    fontSize: "12px",
                    fontWeight: 900,
                  }}
                >
                  ⭐ سفير دربك لهذا الأسبوع
                  {exp.ambassadorDisplayName && (
                    <span style={{ color: adminColors.text, fontWeight: 900 }}>
                      {exp.ambassadorDisplayName}
                    </span>
                  )}
                  {exp.featuredAmbassadorUntil && (
                    <span style={{ color: adminColors.textSoft, fontWeight: 700 }}>
                      حتى {formatAdminDateTime(exp.featuredAmbassadorUntil)}
                    </span>
                  )}
                </div>
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
                      ["ambassadorDisplayName", "اسم السفير الظاهر"],
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
                    <button
                      type="button"
                      onClick={() => toggleFeaturedAmbassador(exp)}
                      disabled={
                        updatingFeaturedExperienceId === exp._id ||
                        (exp.status || "approved") !== "approved"
                      }
                      title={
                        (exp.status || "approved") !== "approved"
                          ? "اختاري من التجارب المقبولة فقط"
                          : ""
                      }
                      style={{
                        background: isActiveFeaturedAmbassador(exp)
                          ? "rgba(245,158,11,0.12)"
                          : "rgba(125,219,205,0.08)",
                        color: isActiveFeaturedAmbassador(exp)
                          ? "#fde68a"
                          : adminColors.brand,
                        border: isActiveFeaturedAmbassador(exp)
                          ? "1px solid rgba(245,158,11,0.35)"
                          : "1px solid rgba(125,219,205,0.35)",
                        borderRadius: "10px",
                        padding: "9px 14px",
                        cursor:
                          updatingFeaturedExperienceId === exp._id ||
                          (exp.status || "approved") !== "approved"
                            ? "not-allowed"
                            : "pointer",
                        opacity:
                          (exp.status || "approved") !== "approved" ? 0.45 : 1,
                        fontFamily: "inherit",
                        fontWeight: "bold",
                      }}
                    >
                      {updatingFeaturedExperienceId === exp._id
                        ? "تحديث..."
                        : isActiveFeaturedAmbassador(exp)
                        ? "إلغاء سفير الأسبوع"
                        : "تمييز كسفير أسبوع"}
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

        .admin-opportunity-filters {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
        }

        .admin-opportunities-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          align-items: stretch;
        }

        .admin-opportunity-card {
          transition: transform 0.18s ease, border-color 0.18s ease;
        }

        .admin-opportunity-card:hover {
          transform: translateY(-2px);
          border-color: rgba(102, 208, 195, 0.28) !important;
        }

        @media (max-width: 900px) {
          .admin-opportunity-filters,
          .admin-opportunities-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}
