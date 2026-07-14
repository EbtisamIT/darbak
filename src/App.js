import React, { useEffect, useMemo, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from "react-router-dom";
import "./App.css";
import Navbar from "./pages/Navbar";
import HomePage from "./pages/HomePage";
import ExperiencesPage from "./pages/ExperiencesPage";
import TrainingFinderPage, {
  cityOptions as trainingCityOptions,
  specializationOptions,
} from "./pages/TrainingFinderPage";
import AddExperienceModal from "./pages/AddExperienceModal";
import LegalPage from "./pages/LegalPage";
import AdminReviewPage from "./pages/AdminReviewPage";
import Footer from "./pages/Footer";
import { guideUrl } from "./components/TrainingGuideBanner";
import PremiumAccessGate from "./components/PremiumAccessGate";
import SavedItemsDrawer from "./components/SavedItemsDrawer";
import { trackEvent } from "./utils/analytics";

const PLATFORM_UPDATE_NOTICE_KEY = "darbak_training_diagnosis_quiz_seen_v1";
const ADMIN_REVIEW_PATH = "/darbak-owner-review-2026";

const diagnosisFearOptions = [
  { value: "unknownTargets", label: "ما أعرف الجهات" },
  { value: "noCv", label: "ما عندي CV" },
  { value: "rejection", label: "أخاف ما أنقبل" },
  { value: "email", label: "ما أعرف أرسل إيميل" },
  { value: "late", label: "البداية متأخرة" },
];

const diagnosisDefaultAnswers = {
  major: "",
  city: "",
  hasCv: "",
  appliedBefore: "",
  knowsWhere: "",
  priority: "",
  fear: "",
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const buildTrainingDiagnosis = (answers) => {
  let lostScore = 34;

  if (answers.hasCv === "no") lostScore += 18;
  if (answers.appliedBefore === "no") lostScore += 12;
  if (answers.knowsWhere === "no") lostScore += 16;
  if (!answers.city) lostScore += 5;
  if (answers.priority === "reward") lostScore += 6;

  const fearScores = {
    unknownTargets: 14,
    noCv: 18,
    rejection: 12,
    email: 10,
    late: 18,
  };
  lostScore += fearScores[answers.fear] || 8;

  if (answers.hasCv === "yes") lostScore -= 7;
  if (answers.appliedBefore === "yes") lostScore -= 6;
  if (answers.knowsWhere === "yes") lostScore -= 8;

  const percent = clamp(lostScore, 29, 96);

  if (answers.priority === "reward") {
    return {
      name: "صياد المكافآت",
      percent,
      stage: "عين على التجربة وعين على المكافأة",
      note: "الطموح مفهوم، بس لا تخلي المكافأة تخفي جودة البيئة.",
    };
  }

  if (answers.fear === "late") {
    return {
      name: "طالب آخر لحظة",
      percent,
      stage: "الوقت بدأ يركض، بس باقي في مجال",
      note: "لا تنتظر القروب. ابدأ بخطوة صغيرة اليوم.",
    };
  }

  if (answers.hasCv === "no" || answers.fear === "noCv") {
    return {
      name: "جاهز لكن ناقصك CV",
      percent,
      stage: "الحماس موجود، الملف يحتاج ترتيب",
      note: "ابدأ بالسيرة ثم اطلع على الجهات المناسبة.",
    };
  }

  if (answers.appliedBefore === "yes" && answers.knowsWhere === "yes") {
    return {
      name: "باحث تدريب محترف",
      percent,
      stage: "باقي لك جهة مرتبة تبدأ منها",
      note: "رتب خياراتك حسب المدينة والتخصص وكمّل تقديمك.",
    };
  }

  if (answers.knowsWhere === "no" && answers.appliedBefore === "no") {
    return {
      name: "بانتظار رابط القروب",
      percent,
      stage: "لا تجعل القروب هو الخطة الوحيدة",
      note: "دربك يعطيك قائمة تبدأ منها بدون دوخة البحث.",
    };
  }

  if (answers.fear === "unknownTargets" || answers.fear === "email") {
    return {
      name: "جاهز لكن ضايع",
      percent,
      stage: "الهدف معروف، لكن البداية مو واضحة",
      note: "ابدأ بجهات مناسبة ثم استخدم نموذج تواصل بسيط.",
    };
  }

  return {
    name: "متدرب تحت الضغط",
    percent,
    stage: "قبل الزحمة بخطوة",
    note: "وضعك قابل للإنقاذ، بس يحتاج بداية مرتبة.",
  };
};

const buildGuideRecommendation = (answers) => {
  if (answers.fear === "unknownTargets") {
    return {
      title: "ابدأ بقائمة جهات بدل البحث من الصفر",
      text: "رتب أول قائمة تقديم لك بروابط وجهات واضحة بدل التنقل بين مصادر كثيرة.",
    };
  }

  if (answers.fear === "email") {
    return {
      title: "خل أول تواصل أسهل",
      text: "ابدأ بصياغة مرتبة وخطة متابعة واضحة بدل التردد قبل إرسال أول رسالة.",
    };
  }

  if (answers.fear === "late") {
    return {
      title: "اختصر وقت البحث وابدأ مباشرة",
      text: "لما الوقت يضغط، الأفضل تمشي على خطوات قصيرة: جهات، روابط، متابعة، ثم تقرير.",
    };
  }

  if (answers.hasCv === "no" || answers.fear === "noCv") {
    return {
      title: "رتب ملفك ثم ابدأ التقديم بثقة",
      text: "ابدأ من ترتيب الاستعداد، ثم انتقل للتقديم والمتابعة بدون تشتت.",
    };
  }

  if (answers.priority === "reward") {
    return {
      title: "دور على فرصة مناسبة بدون ما تضيع الجودة",
      text: "وازن بين المكافأة، البيئة، وجودة التجربة بخطة بحث ومتابعة أوضح.",
    };
  }

  return {
    title: "حوّل التشخيص إلى خطة تقديم",
    text: "خذ نتيجة التشخيص وحولها لخطوات عملية من البحث إلى التقديم والمتابعة.",
  };
};

const hasSeenPlatformUpdateNotice = () => {
  if (typeof window === "undefined") return true;

  try {
    return window.localStorage.getItem(PLATFORM_UPDATE_NOTICE_KEY) === "true";
  } catch {
    return true;
  }
};

const markPlatformUpdateNoticeSeen = () => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(PLATFORM_UPDATE_NOTICE_KEY, "true");
  } catch {
    // Ignore storage quota or private browsing errors.
  }
};

function PageBanner() {
  const location = useLocation();
  const isExperiencesPage = location.pathname === "/experiences";

  if (!isExperiencesPage) return null;

  return (
    <div
      style={{
        width: "min(920px, calc(100% - 28px))",
        margin: "8px auto -18px",
        color: "var(--app-text-soft)",
        textAlign: "center",
        padding: "6px 14px",
        fontSize: "15px",
        fontWeight: "400",
        letterSpacing: 0,
        lineHeight: 1.75,
        fontFamily: "'Aniq', 'Cairo', sans-serif",
      }}
    >
      <span style={{ color: "var(--app-brand)", fontWeight: "600" }}>
        تنويه:
      </span>{" "}
      خذ من تجارب غيرك ما يفيدك، لكن تذكّر أن لكل طالب رحلته وتجربته الخاصة. 🤍
    </div>
  );
}

function GuideAnnouncementBar() {
  const location = useLocation();

  const trackGuideBarClick = () => {
    trackEvent("training_guide_bar_click", {
      page: location.pathname,
      metadata: { source: "top_announcement_bar" },
    });
  };

  return (
    <div className="top-guide-announcement" dir="rtl">
      <a
        className="top-guide-announcement__link"
        href={guideUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={trackGuideBarClick}
      >
        <span className="top-guide-announcement__eyebrow">رحلة المتدرب</span>
        <span className="top-guide-announcement__text">
          اختصر طريق التدريب من التقديم إلى المتابعة وكتابة التقرير
        </span>
        <span className="top-guide-announcement__action">ابدأ بخطوة مرتبة</span>
      </a>
    </div>
  );
}

function PlatformUpdateNotice() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotice, setShowNotice] = useState(false);
  const [step, setStep] = useState("intro");
  const [answers, setAnswers] = useState(diagnosisDefaultAnswers);
  const [shareStatus, setShareStatus] = useState("");

  useEffect(() => {
    const isAdminPage = location.pathname === ADMIN_REVIEW_PATH;
    const isTrainingFinderPage = location.pathname === "/where-to-train";

    setShowNotice(
      !isAdminPage && !isTrainingFinderPage && !hasSeenPlatformUpdateNotice()
    );
  }, [location.pathname]);

  useEffect(() => {
    const openDiagnosisCard = () => {
      setStep("intro");
      setAnswers(diagnosisDefaultAnswers);
      setShareStatus("");
      setShowNotice(true);
    };

    window.addEventListener("darbak:open-training-diagnosis", openDiagnosisCard);
    return () => {
      window.removeEventListener(
        "darbak:open-training-diagnosis",
        openDiagnosisCard
      );
    };
  }, []);

  const diagnosis = useMemo(
    () => buildTrainingDiagnosis(answers),
    [answers]
  );
  const selectedMajorLabel =
    specializationOptions.find((option) => option.value === answers.major)
      ?.label || answers.major;
  const selectedCityLabel = answers.city || "كل المدن";
  const isReadyForDiagnosis =
    answers.major &&
    answers.hasCv &&
    answers.appliedBefore &&
    answers.knowsWhere &&
    answers.priority &&
    answers.fear;
  const targetCount = answers.city ? 12 : 15;
  const experienceCount = answers.appliedBefore === "yes" ? 6 : 4;
  const suggestedSolution = `${targetCount} جهة مناسبة + ${experienceCount} تجارب سابقة + نموذج إيميل تقديم`;
  const guideRecommendation = buildGuideRecommendation(answers);
  const shareOrigin =
    typeof window !== "undefined" ? window.location.origin : "https://darbak.space";
  const shareText = `تشخيص دربك
الاسم: ${diagnosis.name}
التخصص: ${selectedMajorLabel || "غير محدد"}
المدينة: ${selectedCityLabel}
مستوى الضياع: ${diagnosis.percent}%
الحالة: ${diagnosis.stage}
الحل المقترح: ${suggestedSolution}
التوصية: ${diagnosis.note}

ابدأ من دربك: ${shareOrigin}/where-to-train`;

  const closeNotice = () => {
    markPlatformUpdateNoticeSeen();
    setShowNotice(false);
  };

  const updateAnswer = (field, value) => {
    setAnswers((currentAnswers) => ({
      ...currentAnswers,
      [field]: value,
    }));
    setShareStatus("");
  };

  const openTrainingFinder = () => {
    closeNotice();
    const params = new URLSearchParams();

    if (answers.major) params.set("major", answers.major);
    if (answers.city) params.set("city", answers.city);

    navigate(`/where-to-train${params.toString() ? `?${params}` : ""}`);
  };

  const trackGuideClick = () => {
    trackEvent("diagnosis_store_click", {
      major: selectedMajorLabel,
      city: answers.city,
      resultsCount: diagnosis.percent,
      metadata: {
        diagnosisName: diagnosis.name,
        diagnosisPercent: diagnosis.percent,
        stage: diagnosis.stage,
        hasCv: answers.hasCv,
        appliedBefore: answers.appliedBefore,
        knowsWhere: answers.knowsWhere,
        priority: answers.priority,
        fear: answers.fear,
        guideTitle: guideRecommendation.title,
      },
    });
    markPlatformUpdateNoticeSeen();
  };

  const completeDiagnosis = () => {
    trackEvent("diagnosis_completed", {
      major: selectedMajorLabel,
      city: answers.city,
      resultsCount: diagnosis.percent,
      metadata: {
        diagnosisName: diagnosis.name,
        diagnosisPercent: diagnosis.percent,
        stage: diagnosis.stage,
        hasCv: answers.hasCv,
        appliedBefore: answers.appliedBefore,
        knowsWhere: answers.knowsWhere,
        priority: answers.priority,
        fear: answers.fear,
      },
    });
    setStep("result");
  };

  const shareDiagnosis = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "تشخيص دربك",
          text: shareText,
        });
        setShareStatus("تم فتح المشاركة.");
        return;
      }

      await navigator.clipboard.writeText(shareText);
      setShareStatus("تم نسخ التشخيص.");
    } catch {
      setShareStatus("انسخ التشخيص يدويًا إذا ما ظهرت المشاركة.");
    }
  };

  const optionButtonStyle = (active) => ({
    border: `1px solid ${
      active ? "var(--app-brand)" : "var(--app-brand-border)"
    }`,
    background: active ? "var(--app-brand)" : "var(--app-input-bg)",
    color: active ? "#07100e" : "var(--app-text)",
    borderRadius: "999px",
    padding: "9px 12px",
    cursor: "pointer",
    fontFamily: "inherit",
    fontWeight: active ? "900" : "700",
    fontSize: "13px",
    lineHeight: 1.4,
  });
  const fieldLabelStyle = {
    display: "grid",
    gap: "7px",
    color: "var(--app-text-soft)",
    fontSize: "13px",
    fontWeight: "800",
    textAlign: "right",
  };
  const selectStyle = {
    width: "100%",
    padding: "11px 12px",
    borderRadius: "13px",
    border: "1px solid var(--app-border)",
    background: "var(--app-input-bg)",
    color: "var(--app-text)",
    fontFamily: "inherit",
    outline: "none",
  };

  const renderIntro = () => (
    <>
      <div
        aria-hidden="true"
        style={{
          width: "54px",
          height: "54px",
          borderRadius: "18px",
          display: "grid",
          placeItems: "center",
          margin: "0 auto 12px",
          background: "var(--app-brand-soft)",
          color: "var(--app-brand)",
          fontSize: "25px",
        }}
      >
        🎯
      </div>
      <p
        style={{
          margin: 0,
          color: "var(--app-brand)",
          fontWeight: "800",
          fontSize: "14px",
        }}
      >
        بطاقة تشخيص المتدرب
      </p>
      <h2
        id="platform-update-title"
        style={{
          margin: "4px 0 0",
          color: "var(--app-text)",
          fontSize: "clamp(22px, 4vw, 29px)",
          lineHeight: 1.45,
        }}
      >
        خل دربك يرتب لك البداية
      </h2>
      <p
        style={{
          margin: "10px auto 0",
          color: "var(--app-text-soft)",
          fontSize: "14px",
          lineHeight: 1.9,
          maxWidth: "410px",
        }}
      >
        جاوب على كم سؤال، ودربك يشخّص لك حالتك التدريبية ويعطيك أول خطوة
        تبدأ منها.
      </p>
      <div
        style={{
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          justifyContent: "center",
          marginTop: "18px",
        }}
      >
        <button
          type="button"
          onClick={() => setStep("questions")}
          style={{
            background: "var(--app-brand)",
            color: "#07100e",
            border: "none",
            borderRadius: "12px",
            padding: "10px 16px",
            cursor: "pointer",
            fontFamily: "inherit",
            fontWeight: "900",
            boxShadow: "0 0 14px var(--app-brand-border)",
          }}
        >
          ابدأ التشخيص
        </button>
        <button
          type="button"
          onClick={closeNotice}
          style={{
            background: "transparent",
            color: "var(--app-text-soft)",
            border: "1px solid var(--app-border)",
            borderRadius: "12px",
            padding: "10px 14px",
            cursor: "pointer",
            fontFamily: "inherit",
            fontWeight: "700",
          }}
        >
          لاحقًا
        </button>
      </div>
    </>
  );

  const renderQuestions = () => (
    <div style={{ display: "grid", gap: "13px" }}>
      <div style={{ textAlign: "center" }}>
        <p
          style={{
            margin: 0,
            color: "var(--app-brand)",
            fontSize: "13px",
            fontWeight: "900",
          }}
        >
          أسئلة سريعة
        </p>
        <h2
          id="platform-update-title"
          style={{
            margin: "3px 0 0",
            color: "var(--app-text)",
            fontSize: "clamp(20px, 4vw, 25px)",
            lineHeight: 1.45,
          }}
        >
          نعطيك تشخيصك التدريبي
        </h2>
      </div>

      <label style={fieldLabelStyle}>
        وش تخصصك؟
        <select
          value={answers.major}
          onChange={(event) => updateAnswer("major", event.target.value)}
          style={selectStyle}
        >
          <option value="">اختر تخصصك</option>
          {specializationOptions.map((specialization) => (
            <option key={specialization.value} value={specialization.value}>
              {specialization.label}
            </option>
          ))}
        </select>
      </label>

      <label style={fieldLabelStyle}>
        أي مدينة مناسبة للتدريب؟
        <select
          value={answers.city}
          onChange={(event) => updateAnswer("city", event.target.value)}
          style={selectStyle}
        >
          <option value="">كل المدن</option>
          {trainingCityOptions.map((cityName) => (
            <option key={cityName} value={cityName}>
              {cityName}
            </option>
          ))}
        </select>
      </label>

      {[
        {
          field: "hasCv",
          label: "عندك CV جاهز؟",
          options: [
            ["yes", "نعم جاهز"],
            ["no", "لسه أحتاج أرتبه"],
          ],
        },
        {
          field: "appliedBefore",
          label: "قدمت على جهات قبل؟",
          options: [
            ["yes", "نعم قدمت"],
            ["no", "لا، ما بدأت"],
          ],
        },
        {
          field: "knowsWhere",
          label: "تعرف وين تقدم؟",
          options: [
            ["yes", "عندي فكرة"],
            ["no", "ضايع شوي"],
          ],
        },
        {
          field: "priority",
          label: "المكافأة أهم أم التجربة؟",
          options: [
            ["experience", "الأهم التجربة"],
            ["reward", "المكافأة أهم شيء"],
            ["both", "الاثنين مهمين"],
          ],
        },
      ].map((question) => (
        <div key={question.field} style={{ display: "grid", gap: "8px" }}>
          <div style={{ ...fieldLabelStyle, display: "block" }}>
            {question.label}
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {question.options.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => updateAnswer(question.field, value)}
                style={optionButtonStyle(answers[question.field] === value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div style={{ display: "grid", gap: "8px" }}>
        <div style={{ ...fieldLabelStyle, display: "block" }}>
          أكثر شيء مخوفك؟
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {diagnosisFearOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => updateAnswer("fear", option.value)}
              style={optionButtonStyle(answers.fear === option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "10px",
          flexWrap: "wrap",
          marginTop: "2px",
        }}
      >
        <button
          type="button"
          onClick={() => setStep("intro")}
          style={{
            background: "transparent",
            color: "var(--app-text-soft)",
            border: "1px solid var(--app-border)",
            borderRadius: "12px",
            padding: "10px 14px",
            cursor: "pointer",
            fontFamily: "inherit",
            fontWeight: "700",
          }}
        >
          رجوع
        </button>
        <button
          type="button"
          disabled={!isReadyForDiagnosis}
          onClick={completeDiagnosis}
          style={{
            background: isReadyForDiagnosis
              ? "var(--app-brand)"
              : "var(--app-border)",
            color: isReadyForDiagnosis ? "#07100e" : "var(--app-text-soft)",
            border: "none",
            borderRadius: "12px",
            padding: "10px 16px",
            cursor: isReadyForDiagnosis ? "pointer" : "not-allowed",
            fontFamily: "inherit",
            fontWeight: "900",
          }}
        >
          اعرض التشخيص
        </button>
      </div>
    </div>
  );

  const renderResult = () => (
    <div
      style={{
        border: "1px solid var(--app-brand-border)",
        borderRadius: "22px",
        padding: "18px",
        background:
          "linear-gradient(145deg, var(--app-card), var(--app-surface))",
        boxShadow: "0 18px 40px var(--app-shadow)",
        textAlign: "right",
        display: "grid",
        gap: "16px",
      }}
    >
      <div>
        <p
          id="platform-update-title"
          style={{
            margin: "0 0 10px",
            textAlign: "center",
            color: "var(--app-brand)",
            fontSize: "15px",
            fontWeight: "900",
          }}
        >
          تشخيص دربك
        </p>
        <strong
          style={{
            display: "block",
            fontSize: "24px",
            lineHeight: 1.35,
            textAlign: "center",
            color: "var(--app-text)",
            marginBottom: "12px",
          }}
        >
          {diagnosis.name}
        </strong>

        <div style={{ display: "grid", gap: "13px", color: "var(--app-text)" }}>
          {[
            ["التخصص", selectedMajorLabel],
            ["المدينة", selectedCityLabel],
            ["مستوى الضياع", `${diagnosis.percent}%`],
            ["المرحلة الحالية", diagnosis.stage],
            ["الحل المقترح", suggestedSolution],
            ["التوصية", diagnosis.note],
          ].map(([label, value]) => (
            <div key={label} style={{ display: "grid", gap: "3px" }}>
              <span
                style={{
                  color: "var(--app-brand)",
                  fontSize: "15px",
                  fontWeight: "900",
                  lineHeight: 1.4,
                }}
              >
                {label}
              </span>
              <span
                style={{
                  color: "var(--app-text)",
                  fontSize: label === "مستوى الضياع" ? "22px" : "15px",
                  lineHeight: 1.8,
                  fontWeight: label === "مستوى الضياع" ? "900" : "700",
                }}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          borderTop: "1px solid var(--app-border)",
          paddingTop: "15px",
          display: "grid",
          gap: "12px",
        }}
      >
        <div style={{ display: "grid", gap: "5px" }}>
          <span
            style={{
              color: "var(--app-brand)",
              fontSize: "14px",
              fontWeight: "900",
            }}
          >
            الخطوة التالية
          </span>
          <strong
            style={{
              color: "var(--app-text)",
              fontSize: "18px",
              lineHeight: 1.55,
            }}
          >
            {guideRecommendation.title}
          </strong>
          <p
            style={{
              margin: 0,
              color: "var(--app-text-soft)",
              fontSize: "14px",
              lineHeight: 1.8,
            }}
          >
            {guideRecommendation.text}
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: "9px",
          }}
        >
          <button
            type="button"
            onClick={openTrainingFinder}
            style={{
              display: "grid",
              gap: "4px",
              background: "var(--app-brand)",
              color: "#07100e",
              border: "none",
              borderRadius: "14px",
              padding: "12px",
              cursor: "pointer",
              fontFamily: "inherit",
              textAlign: "right",
            }}
          >
            <strong style={{ fontSize: "14px", lineHeight: 1.5 }}>
              اعرض جهات تناسبك الآن
            </strong>
            <span style={{ fontSize: "12px", lineHeight: 1.6, fontWeight: "700" }}>
              نبدأ من تخصصك ومدينتك مباشرة
            </span>
          </button>

          <a
            href={guideUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={trackGuideClick}
            style={{ textDecoration: "none", minWidth: 0 }}
          >
            <button
              type="button"
              style={{
                width: "100%",
                height: "100%",
                display: "grid",
                gap: "4px",
                background: "var(--app-card)",
                color: "var(--app-text)",
                border: "1px solid var(--app-brand-border)",
                borderRadius: "14px",
                padding: "12px",
                cursor: "pointer",
                fontFamily: "inherit",
                textAlign: "right",
              }}
            >
              <strong
                style={{
                  color: "var(--app-brand)",
                  fontSize: "14px",
                  lineHeight: 1.5,
                }}
              >
                خذ خطة التدريب الجاهزة
              </strong>
              <span
                style={{
                  color: "var(--app-text-soft)",
                  fontSize: "12px",
                  lineHeight: 1.6,
                  fontWeight: "700",
                }}
              >
                رحلة المتدرب: جهات، روابط، متابعة، وتقرير بدون تشتت
              </span>
            </button>
          </a>
        </div>

        <div
          style={{
            display: "flex",
            gap: "9px",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => setStep("questions")}
            style={{
              background: "transparent",
              color: "var(--app-text-soft)",
              border: "1px solid var(--app-border)",
              borderRadius: "12px",
              padding: "10px 14px",
              cursor: "pointer",
              fontFamily: "inherit",
              fontWeight: "800",
            }}
          >
            تعديل الإجابات
          </button>
          <button
            type="button"
            onClick={shareDiagnosis}
            style={{
              background: "transparent",
              color: "var(--app-brand)",
              border: "1px solid var(--app-brand-border)",
              borderRadius: "12px",
              padding: "10px 14px",
              cursor: "pointer",
              fontFamily: "inherit",
              fontWeight: "800",
            }}
          >
            مشاركة التشخيص
          </button>
        </div>

        {shareStatus && (
          <p
            style={{
              margin: 0,
              color: "var(--app-text-soft)",
              textAlign: "center",
              fontSize: "12px",
            }}
          >
            {shareStatus}
          </p>
        )}
      </div>
    </div>
  );

  if (!showNotice) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="platform-update-title"
      onClick={closeNotice}
      aria-live="polite"
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "18px",
        background: "var(--app-overlay)",
        backdropFilter: "blur(8px)",
        zIndex: 2500,
        direction: "rtl",
        fontFamily: "'Aniq', 'Cairo', sans-serif",
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          position: "relative",
          width:
            step === "questions" ? "min(680px, 100%)" : "min(540px, 100%)",
          maxHeight: "88vh",
          overflowY: "auto",
          background: "var(--app-surface)",
          border: "1px solid var(--app-brand-border)",
          borderRadius: "22px",
          boxShadow: "0 24px 70px var(--app-shadow)",
          color: "var(--app-text)",
          padding: "28px 24px 22px",
          textAlign: "center",
        }}
      >
        <button
          type="button"
          onClick={closeNotice}
          aria-label="إغلاق بطاقة التشخيص"
          style={{
            position: "absolute",
            top: "12px",
            left: "12px",
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            border: "1px solid var(--app-border)",
            background: "var(--app-input-bg)",
            color: "var(--app-text-soft)",
            cursor: "pointer",
            fontSize: "19px",
            lineHeight: 1,
          }}
        >
          ×
        </button>

        {step === "intro" && renderIntro()}
        {step === "questions" && renderQuestions()}
        {step === "result" && renderResult()}
      </div>
    </div>
  );
}

function AppLayout({ theme, setTheme }) {
  const location = useLocation();
  const isAdminPage = location.pathname === ADMIN_REVIEW_PATH;
  const appStyle = {
    minHeight: "100vh",
    backgroundColor: "var(--app-bg)",
    color: "var(--app-text-soft)",
    fontFamily: "'Cairo', sans-serif",
    display: "flex",
    flexDirection: "column",
    transition: "background-color 0.25s ease, color 0.25s ease",
  };

  const contentContainer = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  };

  const contentStyle = {
    width: "100%",
    maxWidth: "1200px",
    padding: "40px 20px",
  };

  useEffect(() => {
    if (isAdminPage) return;

    trackEvent("page_view", {
      page: location.pathname,
      metadata: { search: location.search },
    });
  }, [isAdminPage, location.pathname, location.search]);

  useEffect(() => {
    if (isAdminPage || typeof document === "undefined") return undefined;

    const sendSessionPing = () => {
      if (document.visibilityState !== "visible") return;

      trackEvent("session_ping", {
        page: location.pathname,
      });
    };

    sendSessionPing();
    const intervalId = window.setInterval(sendSessionPing, 60 * 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        sendSessionPing();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isAdminPage, location.pathname]);

  if (isAdminPage) {
    return (
      <div
        style={{
          ...appStyle,
          backgroundColor: "#0b0f14",
          color: "#d8e5e2",
        }}
      >
        <div
          style={{
            width: "100%",
            minHeight: "100vh",
            boxSizing: "border-box",
            padding: "34px 16px",
          }}
        >
          <Routes>
            <Route path={ADMIN_REVIEW_PATH} element={<AdminReviewPage />} />
          </Routes>
        </div>
      </div>
    );
  }

  return (
    <div style={appStyle}>
      <GuideAnnouncementBar />
      <Navbar theme={theme} setTheme={setTheme} />

      <PageBanner />
      <PlatformUpdateNotice />
      <PremiumAccessGate />
      <SavedItemsDrawer />

      {/* المحتوى */}
      <div style={contentContainer}>
        <div className="app-content-frame" style={contentStyle}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/experiences" element={<ExperiencesPage />} />
            <Route path="/where-to-train" element={<TrainingFinderPage />} />
            <Route path="/legal" element={<LegalPage />} />
            <Route path="/terms" element={<LegalPage />} />
            <Route path="/privacy" element={<LegalPage />} />
            <Route path="/AddExperienceModal" element={<AddExperienceModal />} />
          </Routes>
        </div>
      </div>

      <Footer />
    </div>
  );
}

function App() {
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "dark";
    return window.localStorage.getItem("darbak_theme") || "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("darbak_theme", theme);
  }, [theme]);

  return (
    <Router>
      <AppLayout theme={theme} setTheme={setTheme} />
    </Router>
  );
}

export default App;
