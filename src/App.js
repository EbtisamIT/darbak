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

const PLATFORM_UPDATE_NOTICE_KEY = "darbak_training_diagnosis_quiz_seen_v1";
const ADMIN_REVIEW_PATH = "/darbak-owner-review-2026";

const diagnosisFearOptions = [
  { value: "unknownTargets", label: "ما أعرف الجهات" },
  { value: "noCv", label: "ما عندي CV" },
  { value: "rejection", label: "أخاف ما أنقبل" },
  { value: "email", label: "ما أعرف أرسل إيميل" },
  { value: "late", label: "متأخر/ة وما بدأت" },
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
      name: "صياد/ة المكافآت",
      percent,
      stage: "عين على التجربة وعين على المكافأة",
      note: "الطموح مفهوم، بس لا تخلي المكافأة تخفي جودة البيئة.",
    };
  }

  if (answers.fear === "late") {
    return {
      name: "طالب/ة آخر لحظة",
      percent,
      stage: "الوقت بدأ يركض، بس باقي في مجال",
      note: "لا تنتظر/ين القروب. ابدأ/ي بخطوة صغيرة اليوم.",
    };
  }

  if (answers.hasCv === "no" || answers.fear === "noCv") {
    return {
      name: "جاهز/ة بس ناقصك CV",
      percent,
      stage: "الحماس موجود، الملف يحتاج ترتيب",
      note: "ابدأ/ي بالسيرة ثم اطلع/ي على الجهات المناسبة.",
    };
  }

  if (answers.appliedBefore === "yes" && answers.knowsWhere === "yes") {
    return {
      name: "باحث/ة تدريب محترف/ة",
      percent,
      stage: "باقي لك جهة مرتبة تبدأ منها",
      note: "رتب/ي خياراتك حسب المدينة والتخصص وكمّل/ي تقديمك.",
    };
  }

  if (answers.knowsWhere === "no" && answers.appliedBefore === "no") {
    return {
      name: "بانتظار رابط القروب",
      percent,
      stage: "لا تجعل/ين القروب هو الخطة الوحيدة",
      note: "دربك يعطيك قائمة تبدأ منها بدون دوخة البحث.",
    };
  }

  if (answers.fear === "unknownTargets" || answers.fear === "email") {
    return {
      name: "جاهز/ة بس ضايع/ة",
      percent,
      stage: "تعرف/ين الهدف، لكن البداية مو واضحة",
      note: "ابدأ/ي بجهات مناسبة ثم استخدم/ي نموذج تواصل بسيط.",
    };
  }

  return {
    name: "متدرب/ة تحت الضغط",
    percent,
    stage: "قبل الزحمة بخطوة",
    note: "وضعك قابل للإنقاذ، بس يحتاج بداية مرتبة.",
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
  const shareOrigin =
    typeof window !== "undefined" ? window.location.origin : "https://darbak.onrender.com";
  const shareText = `تشخيص دربك
الاسم: ${diagnosis.name}
التخصص: ${selectedMajorLabel || "غير محدد"}
المدينة: ${selectedCityLabel}
مستوى الضياع: ${diagnosis.percent}%
الحالة: ${diagnosis.stage}
الحل المقترح: ${suggestedSolution}
التوصية: ${diagnosis.note}

ابدأ/ي من دربك: ${shareOrigin}/where-to-train`;

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
      setShareStatus("انسخ/ي التشخيص يدويًا إذا ما ظهرت المشاركة.");
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
        جاوب/ي على كم سؤال، ودربك يشخّص لك حالتك التدريبية ويعطيك أول خطوة
        تبدأ/ين منها.
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
          <option value="">اختر/ي تخصصك</option>
          {specializationOptions.map((specialization) => (
            <option key={specialization.value} value={specialization.value}>
              {specialization.label}
            </option>
          ))}
        </select>
      </label>

      <label style={fieldLabelStyle}>
        أي مدينة تبغى/ين تتدرب/ين فيها؟
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
          label: "تعرف/ين وين تقدم/ين؟",
          options: [
            ["yes", "عندي فكرة"],
            ["no", "ضايع/ة شوي"],
          ],
        },
        {
          field: "priority",
          label: "تبغى/ين مكافأة ولا الأهم التجربة؟",
          options: [
            ["experience", "الأهم التجربة"],
            ["reward", "مكافأة لو أمكن"],
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
          onClick={() => setStep("result")}
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
    <div style={{ display: "grid", gap: "13px" }}>
      <div
        style={{
          border: "1px solid var(--app-brand-border)",
          borderRadius: "20px",
          padding: "18px",
          background:
            "linear-gradient(145deg, var(--app-card), var(--app-surface))",
          boxShadow: "0 18px 40px var(--app-shadow)",
          textAlign: "right",
        }}
      >
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
        <div style={{ display: "grid", gap: "10px", color: "var(--app-text)" }}>
          <strong style={{ fontSize: "22px", textAlign: "center" }}>
            {diagnosis.name}
          </strong>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: "8px",
            }}
          >
            {[
              ["التخصص", selectedMajorLabel],
              ["المدينة", selectedCityLabel],
              ["مستوى الضياع", `${diagnosis.percent}%`],
              ["المرحلة", diagnosis.stage],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  background: "var(--app-input-bg)",
                  border: "1px solid var(--app-border)",
                  borderRadius: "13px",
                  padding: "10px",
                  minHeight: "58px",
                }}
              >
                <span
                  style={{
                    display: "block",
                    color: "var(--app-brand)",
                    fontSize: "11px",
                    fontWeight: "900",
                    marginBottom: "4px",
                  }}
                >
                  {label}
                </span>
                <span
                  style={{
                    color: "var(--app-text)",
                    fontSize: "13px",
                    lineHeight: 1.55,
                    fontWeight: "800",
                  }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>

          <div
            style={{
              background: "var(--app-brand-soft)",
              border: "1px solid var(--app-brand-border)",
              borderRadius: "14px",
              padding: "11px",
              color: "var(--app-text)",
              lineHeight: 1.75,
              fontSize: "13px",
            }}
          >
            <strong style={{ color: "var(--app-brand)" }}>الحل المقترح: </strong>
            {suggestedSolution}
          </div>
          <p
            style={{
              margin: 0,
              color: "var(--app-text-soft)",
              fontSize: "13px",
              lineHeight: 1.8,
              textAlign: "center",
            }}
          >
            {diagnosis.note}
          </p>
        </div>
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
          onClick={openTrainingFinder}
          style={{
            background: "var(--app-brand)",
            color: "#07100e",
            border: "none",
            borderRadius: "12px",
            padding: "10px 15px",
            cursor: "pointer",
            fontFamily: "inherit",
            fontWeight: "900",
          }}
        >
          اعرف/ي وين تتدرب/ين الآن
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

  if (isAdminPage) {
    return (
      <div
        style={{
          ...appStyle,
          backgroundColor: "#0b0f14",
          color: "#cbd5e1",
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
      <Navbar theme={theme} setTheme={setTheme} />

      <PageBanner />
      <PlatformUpdateNotice />

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
