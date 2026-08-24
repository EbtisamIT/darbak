import React, {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import Footer from "./pages/Footer";
import { guideUrl } from "./components/TrainingGuideBanner";
import {
  cityOptions as trainingCityOptions,
  specializationOptions,
} from "./data/trainingOptions";
import { trackEvent } from "./utils/analytics";
import {
  PREMIUM_ACCESS_EVENT,
  PREMIUM_STATUS_EVENT,
  getStoredPremiumPass,
  hasActivePremiumPass,
  passHasEntitlement,
} from "./utils/premiumAccess";

const ExperiencesPage = lazy(() => import("./pages/ExperiencesPage"));
const InterviewsPage = lazy(() => import("./pages/InterviewsPage"));
const TrainingFinderPage = lazy(() => import("./pages/TrainingFinderPage"));
const AddExperienceModal = lazy(() => import("./pages/AddExperienceModal"));
const LegalPage = lazy(() => import("./pages/LegalPage"));
const AdminReviewPage = lazy(() => import("./pages/AdminReviewPage"));
const PortfolioPage = lazy(() => import("./pages/PortfolioPage"));
const PortfolioBuilderPage = lazy(() => import("./pages/PortfolioBuilderPage"));
const CompanyApplyPage = lazy(() => import("./pages/CompanyApplyPage"));
const MyApplicationsPage = lazy(() => import("./pages/MyApplicationsPage"));
const PartnersPage = lazy(() => import("./pages/PartnersPage"));
const MyResumePage = lazy(() => import("./pages/MyResumePage"));
const PremiumAccessGate = lazy(() => import("./components/PremiumAccessGate"));
const AccountModal = lazy(() => import("./components/AccountModal"));
const SavedItemsDrawer = lazy(() => import("./components/SavedItemsDrawer"));
const DarbakAssistant = lazy(() => import("./components/DarbakAssistant"));

const PLATFORM_UPDATE_NOTICE_KEY = "darbak_portfolio_announcement_seen_v1";
const PORTFOLIO_ANNOUNCEMENT_EVENT = "darbak:open-portfolio-announcement";
const ADMIN_REVIEW_PATH = "/darbak-owner-review-2026";
const cvProductUrl =
  "https://darbakk.com/%D8%B3%D9%8A%D8%B1%D8%A9-%D8%A7%D9%84%D8%AA%D8%AF%D8%B1%D9%8A%D8%A8-%D8%A7%D9%84%D8%AA%D8%B9%D8%A7%D9%88%D9%86%D9%8A/p1027158085";

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

const markPlatformUpdateNoticeSeen = () => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(PLATFORM_UPDATE_NOTICE_KEY, "true");
  } catch {
    // Ignore storage quota or private browsing errors.
  }
};

const PageLoadingFallback = () => (
  <div
    style={{
      minHeight: "260px",
      display: "grid",
      placeItems: "center",
      color: "var(--app-text-soft)",
      fontFamily: "'Aniq', 'Cairo', sans-serif",
      fontWeight: 800,
    }}
  >
    جارِ التحميل...
  </div>
);

function PageBanner() {
  const location = useLocation();
  const isExperiencesPage = location.pathname.startsWith("/experiences");

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

function SubscribeRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const subscribeSource = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("source") || "subscribe_page";
  }, [location.search]);
  const subscribePlan = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const plan = params.get("plan") || "";
    return ["resume", "darbak_resume", "darbak_plus_resume"].includes(plan)
      ? "darbak_resume"
      : plan;
  }, [location.search]);
  const subscribeStep = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("step") || "";
  }, [location.search]);
  const hasRequestedPlanAccess = useCallback(() => {
    const pass = getStoredPremiumPass();
    if (!pass) return false;

    if (subscribePlan === "darbak_resume") {
      return passHasEntitlement(pass, "resume_builder");
    }

    return hasActivePremiumPass();
  }, [subscribePlan]);
  const [isPremiumActive, setIsPremiumActive] = useState(
    () => typeof window !== "undefined" && hasRequestedPlanAccess()
  );

  const openSubscribeGate = useCallback(() => {
    if (hasRequestedPlanAccess()) {
      setIsPremiumActive(true);
      return;
    }

    window.dispatchEvent(
      new CustomEvent(PREMIUM_ACCESS_EVENT, {
        detail: {
          feature: "subscribe_page",
          title: subscribePlan === "darbak_resume" ? "دربك+ سيرة" : "دربك+",
          source: subscribeSource,
          defaultPlanId: subscribePlan || "darbak_plus",
          openCheckout: subscribeStep === "checkout",
        },
      })
    );
  }, [hasRequestedPlanAccess, subscribePlan, subscribeSource, subscribeStep]);

  useEffect(() => {
    const refreshPremiumStatus = () =>
      setIsPremiumActive(hasRequestedPlanAccess());

    refreshPremiumStatus();
    window.addEventListener(PREMIUM_STATUS_EVENT, refreshPremiumStatus);
    window.addEventListener("storage", refreshPremiumStatus);
    window.addEventListener("focus", refreshPremiumStatus);
    return () => {
      window.removeEventListener(PREMIUM_STATUS_EVENT, refreshPremiumStatus);
      window.removeEventListener("storage", refreshPremiumStatus);
      window.removeEventListener("focus", refreshPremiumStatus);
    };
  }, [hasRequestedPlanAccess]);

  useEffect(() => {
    trackEvent("subscribe_page_view", {
      page: location.pathname,
      metadata: {
        source: subscribeSource,
        plan: subscribePlan || "darbak_plus",
      },
    });

    if (isPremiumActive) return undefined;

    const openTimer = window.setTimeout(openSubscribeGate, 0);
    return () => window.clearTimeout(openTimer);
  }, [
    isPremiumActive,
    location.pathname,
    openSubscribeGate,
    subscribePlan,
    subscribeSource,
  ]);

  if (isPremiumActive) {
    return (
      <section
        dir="rtl"
        style={{
          minHeight: "52vh",
          display: "grid",
          placeItems: "center",
          textAlign: "center",
          padding: "28px 14px",
        }}
      >
        <div
          style={{
            width: "min(520px, 100%)",
            border: "1px solid var(--app-brand-border)",
            borderRadius: "22px",
            background: "var(--app-surface)",
            boxShadow: "0 18px 46px var(--app-shadow)",
            padding: "28px",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              borderRadius: "999px",
              background: "var(--app-brand-soft)",
              color: "var(--app-brand)",
              padding: "6px 14px",
              fontWeight: 900,
              marginBottom: "12px",
            }}
          >
            {subscribePlan === "darbak_resume"
              ? "دربك+ سيرة فعال"
              : "دربك+ فعال"}
          </span>
          <h1
            style={{
              margin: "0 0 10px",
              color: "var(--app-text)",
              fontSize: "clamp(24px, 4vw, 34px)",
              lineHeight: 1.35,
            }}
          >
            المزايا المتقدمة مفتوحة لك
          </h1>
          <p
            style={{
              margin: "0 auto 20px",
              color: "var(--app-text-soft)",
              lineHeight: 1.8,
              maxWidth: "420px",
            }}
          >
            حسابك يملك وصولًا كاملًا، لذلك ما نعرض لك باقات الاشتراك.
          </p>
          <button
            type="button"
            onClick={() =>
              navigate(
                subscribePlan === "darbak_resume"
                  ? "/my-resume"
                  : "/where-to-train"
              )
            }
            style={{
              border: "none",
              borderRadius: "14px",
              background: "var(--app-brand)",
              color: "var(--app-bg)",
              padding: "12px 20px",
              fontFamily: "inherit",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            {subscribePlan === "darbak_resume"
              ? "افتح سيرتي بدربك"
              : "استكشف الفرص والجهات"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      dir="rtl"
      style={{
        minHeight: "52vh",
        display: "grid",
        placeItems: "center",
        textAlign: "center",
        padding: "28px 14px",
      }}
    >
      <div
        style={{
          width: "min(560px, 100%)",
          border: "1px solid var(--app-border)",
          borderRadius: "22px",
          background: "var(--app-surface)",
          boxShadow: "0 18px 46px var(--app-shadow)",
          padding: "28px",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            borderRadius: "999px",
            background: "var(--app-brand-soft)",
            color: "var(--app-brand)",
            padding: "6px 14px",
            fontWeight: 900,
            marginBottom: "12px",
          }}
        >
          دربك+
        </span>
        <h1
          style={{
            margin: "0 0 10px",
            color: "var(--app-text)",
            fontSize: "clamp(26px, 4vw, 38px)",
            lineHeight: 1.35,
          }}
        >
          كمل استكشاف التجارب والفرص
        </h1>
        <p
          style={{
            margin: "0 auto 20px",
            color: "var(--app-text-soft)",
            lineHeight: 1.8,
            maxWidth: "430px",
          }}
        >
          باقات دربك+ تفتح لك المزايا المتقدمة، ولو ما ظهرت النافذة اضغط الزر
          بالأسفل.
        </p>
        <div
          style={{
            display: "flex",
            gap: "10px",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={openSubscribeGate}
            style={{
              border: "none",
              borderRadius: "14px",
              background: "var(--app-brand)",
              color: "var(--app-bg)",
              padding: "12px 20px",
              fontFamily: "inherit",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            عرض باقات دربك+
          </button>
          <button
            type="button"
            onClick={() => navigate("/")}
            style={{
              border: "1px solid var(--app-border)",
              borderRadius: "14px",
              background: "transparent",
              color: "var(--app-text)",
              padding: "12px 20px",
              fontFamily: "inherit",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            الرجوع للرئيسية
          </button>
        </div>
      </div>
    </section>
  );
}

function PlatformUpdateNotice() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotice, setShowNotice] = useState(false);
  const [noticeMode, setNoticeMode] = useState("portfolio");
  const [step, setStep] = useState("intro");
  const [answers, setAnswers] = useState(diagnosisDefaultAnswers);
  const [shareStatus, setShareStatus] = useState("");
  const portfolioAnnouncementTrackedRef = useRef(false);

  useEffect(() => {
    const isAdminPage = location.pathname === ADMIN_REVIEW_PATH;
    if (isAdminPage) setShowNotice(false);
  }, [location.pathname]);

  useEffect(() => {
    const openPortfolioAnnouncement = () => {
      setNoticeMode("portfolio");
      setStep("intro");
      setShareStatus("");
      portfolioAnnouncementTrackedRef.current = false;
      setShowNotice(true);
    };

    const openDiagnosisCard = () => {
      setNoticeMode("diagnosis");
      setStep("intro");
      setAnswers(diagnosisDefaultAnswers);
      setShareStatus("");
      setShowNotice(true);
    };

    window.addEventListener(
      PORTFOLIO_ANNOUNCEMENT_EVENT,
      openPortfolioAnnouncement
    );
    window.addEventListener("darbak:open-training-diagnosis", openDiagnosisCard);
    return () => {
      window.removeEventListener(
        PORTFOLIO_ANNOUNCEMENT_EVENT,
        openPortfolioAnnouncement
      );
      window.removeEventListener(
        "darbak:open-training-diagnosis",
        openDiagnosisCard
      );
    };
  }, []);

  useEffect(() => {
    if (
      !showNotice ||
      noticeMode !== "portfolio" ||
      portfolioAnnouncementTrackedRef.current
    ) {
      return;
    }

    portfolioAnnouncementTrackedRef.current = true;
    trackEvent("portfolio_announcement_viewed", {
      page: location.pathname,
      metadata: { source: "portfolio_nav_click" },
    });
  }, [location.pathname, noticeMode, showNotice]);

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
  const shouldShowCvProduct =
    answers.hasCv === "no" ||
    answers.fear === "noCv" ||
    diagnosis.name.includes("CV");
  const diagnosisPromo = shouldShowCvProduct
    ? {
        eventName: "diagnosis_cv_product_click",
        source: "cv_design_product",
        eyebrow: "تحتاج ترتيب السيرة؟",
        title: "لا تؤجل التقديم بسبب السيرة الذاتية.",
        description:
          "ننشئ لك سيرة ذاتية احترافية من الصفر، جاهزة للتقديم ومتوافقة مع أنظمة ATS.",
        buttonText: "أنشئ سيرتي الذاتية",
        href: cvProductUrl,
      }
    : {
        eventName: "diagnosis_store_click",
        source: "training_guide_file",
        eyebrow: "جاهز تبدأ بخطة أوضح؟",
        title: "خذ دليل رحلة المتدرب وابدأ من قائمة مرتبة.",
        description:
          "ملف يساعدك تختصر البحث: جهات، روابط تقديم، إيميلات، متابعة الطلبات، وخطوات من البداية إلى التقرير.",
        buttonText: "افتح دليل رحلة المتدرب",
        href: guideUrl,
      };
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
    if (noticeMode === "portfolio") {
      markPlatformUpdateNoticeSeen();
    }
    setShowNotice(false);
  };

  const goToPortfolioBuilder = () => {
    markPlatformUpdateNoticeSeen();
    setShowNotice(false);
    trackEvent("portfolio_announcement_cta_clicked", {
      page: location.pathname,
      metadata: { action: "create_portfolio" },
    });
    navigate("/portfolio");
  };

  const browsePlatformFirst = () => {
    markPlatformUpdateNoticeSeen();
    setShowNotice(false);
    trackEvent("portfolio_announcement_cta_clicked", {
      page: location.pathname,
      metadata: { action: "browse_platform" },
    });
    navigate("/");
  };

  const openTraineeGuide = () => {
    markPlatformUpdateNoticeSeen();
    trackEvent("portfolio_announcement_cta_clicked", {
      page: location.pathname,
      metadata: { action: "trainee_guide" },
    });
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

  const trackDiagnosisPromoClick = () => {
    trackEvent(diagnosisPromo.eventName, {
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
        source: diagnosisPromo.source,
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

  const renderPortfolioAnnouncement = () => (
    <>
      <div className="portfolio-announcement-badge">ميزة جديدة ⚡</div>
      <div className="portfolio-announcement-icon" aria-hidden="true">
        ▤
      </div>
      <h2 id="portfolio-announcement-title" className="portfolio-announcement-title">
        أطلقنا ملف الأعمال الرقمي الخاص بك
      </h2>
      <p className="portfolio-announcement-text">
        الآن في <strong>دربك</strong> تقدر تبني هويتك المهنية في رابط مستقل:
        بطاقة رقمية، جاهزيتك للمقابلات، مشاريعك، وسيرتك الذاتية بشكل مرتب
        ومناسب للمشاركة مع جهات التدريب.
      </p>

      <div className="portfolio-announcement-features">
        <div>✨ رابط مخصص باسمك ومشاركته سريعة.</div>
        <div>🪪 بطاقة رقمية تعرض جاهزيتك ومعلوماتك المهنية.</div>
        <div>📁 مساحة مرتبة لمشاريعك وشهاداتك وسيرتك الذاتية.</div>
      </div>

      <div className="portfolio-announcement-actions">
        <button
          type="button"
          className="portfolio-announcement-primary"
          onClick={goToPortfolioBuilder}
        >
          استكشف الميزة
        </button>
        <button
          type="button"
          className="portfolio-announcement-secondary"
          onClick={browsePlatformFirst}
        >
          منصة دربك
        </button>
        <a
          className="portfolio-announcement-link"
          href={guideUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={openTraineeGuide}
        >
          رحلة المتدرب
        </a>
      </div>
    </>
  );

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
            href={diagnosisPromo.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={trackDiagnosisPromoClick}
            style={{ textDecoration: "none", minWidth: 0 }}
          >
            <span
              style={{
                width: "100%",
                height: "100%",
                display: "grid",
                gap: "8px",
                background:
                  "linear-gradient(135deg, var(--app-brand-soft), transparent 72%), var(--app-card)",
                color: "var(--app-text)",
                border: "1px solid var(--app-brand-border)",
                borderRadius: "14px",
                padding: "12px",
                cursor: "pointer",
                fontFamily: "inherit",
                textAlign: "right",
                boxSizing: "border-box",
              }}
            >
              <span
                style={{
                  color: "var(--app-brand)",
                  fontSize: "12px",
                  lineHeight: 1.5,
                  fontWeight: "900",
                }}
              >
                {diagnosisPromo.eyebrow}
              </span>
              <strong
                style={{
                  color: "var(--app-text)",
                  fontSize: "14px",
                  lineHeight: 1.5,
                }}
              >
                {diagnosisPromo.title}
              </strong>
              <span
                style={{
                  color: "var(--app-text-soft)",
                  fontSize: "12px",
                  lineHeight: 1.6,
                  fontWeight: "700",
                }}
              >
                {diagnosisPromo.description}
              </span>
              <span
                style={{
                  width: "fit-content",
                  borderRadius: "12px",
                  background: "var(--app-brand)",
                  color: "#07100e",
                  fontSize: "12.5px",
                  fontWeight: "900",
                  lineHeight: 1.5,
                  padding: "8px 11px",
                }}
              >
                {diagnosisPromo.buttonText}
              </span>
            </span>
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
      aria-labelledby={
        noticeMode === "portfolio"
          ? "portfolio-announcement-title"
          : "platform-update-title"
      }
      onClick={closeNotice}
      aria-live="polite"
      className={
        noticeMode === "portfolio"
          ? "portfolio-announcement-overlay"
          : "platform-update-overlay"
      }
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className={
          noticeMode === "portfolio"
            ? "portfolio-announcement-card"
            : "platform-update-card"
        }
        style={
          noticeMode === "diagnosis" && step === "questions"
            ? { width: "min(680px, 100%)" }
            : undefined
        }
      >
        <button
          type="button"
          onClick={closeNotice}
          aria-label={noticeMode === "portfolio" ? "إغلاق إعلان ملف الأعمال" : "إغلاق بطاقة التشخيص"}
          className={
            noticeMode === "portfolio"
              ? "portfolio-announcement-close"
              : "platform-update-close"
          }
        >
          ×
        </button>

        {noticeMode === "portfolio" && renderPortfolioAnnouncement()}
        {noticeMode === "diagnosis" && step === "intro" && renderIntro()}
        {noticeMode === "diagnosis" && step === "questions" && renderQuestions()}
        {noticeMode === "diagnosis" && step === "result" && renderResult()}
      </div>
    </div>
  );
}

function AppLayout({ theme, setTheme }) {
  const location = useLocation();
  const isAdminPage = location.pathname === ADMIN_REVIEW_PATH;
  const isPublicPortfolioPage = location.pathname.startsWith("/p/");
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

  const sessionStartedAtRef = useRef(null);
  const lastDurationSentRef = useRef(0);

  useEffect(() => {
    if (isAdminPage || typeof window === "undefined") return undefined;

    sessionStartedAtRef.current = Date.now();
    lastDurationSentRef.current = 0;

    const sendSessionDuration = (reason = "interval") => {
      if (!sessionStartedAtRef.current) return;

      const durationSeconds = Math.round(
        (Date.now() - sessionStartedAtRef.current) / 1000
      );

      if (durationSeconds < 5) return;
      if (durationSeconds - lastDurationSentRef.current < 15 && reason !== "exit") {
        return;
      }

      const cappedDurationSeconds = Math.min(durationSeconds, 3 * 60 * 60);
      lastDurationSentRef.current = durationSeconds;

      trackEvent("session_duration", {
        resultsCount: cappedDurationSeconds,
        metadata: {
          durationSeconds: cappedDurationSeconds,
          reason,
        },
      });
    };

    const intervalId = window.setInterval(
      () => sendSessionDuration("interval"),
      60 * 1000
    );

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        sendSessionDuration("hidden");
      }
    };

    const handlePageHide = () => {
      sendSessionDuration("exit");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handlePageHide);

    return () => {
      sendSessionDuration("exit");
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handlePageHide);
    };
  }, [isAdminPage]);

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
          <Suspense fallback={<PageLoadingFallback />}>
            <Routes>
              <Route path={ADMIN_REVIEW_PATH} element={<AdminReviewPage />} />
            </Routes>
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <div style={appStyle}>
      <Navbar theme={theme} setTheme={setTheme} />

      <PageBanner />
      {!isPublicPortfolioPage && <PlatformUpdateNotice />}
      {!isPublicPortfolioPage && (
        <Suspense fallback={null}>
          <PremiumAccessGate />
          <AccountModal />
          <SavedItemsDrawer />
          <DarbakAssistant />
        </Suspense>
      )}

      {/* المحتوى */}
      <div style={contentContainer}>
        <div className="app-content-frame" style={contentStyle}>
          <Suspense fallback={<PageLoadingFallback />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/experiences" element={<ExperiencesPage />} />
              <Route path="/experiences/city/:citySlug" element={<ExperiencesPage />} />
              <Route path="/experiences/major/:majorSlug" element={<ExperiencesPage />} />
              <Route
                path="/experiences/city/:citySlug/major/:majorSlug"
                element={<ExperiencesPage />}
              />
              <Route path="/experiences/:experienceId" element={<ExperiencesPage />} />
              <Route path="/interviews" element={<InterviewsPage />} />
              <Route path="/where-to-train" element={<TrainingFinderPage />} />
              <Route path="/subscribe" element={<SubscribeRoute />} />
              <Route path="/my-resume" element={<MyResumePage />} />
              <Route path="/my-resume/build" element={<MyResumePage />} />
              <Route path="/my-resume/edit" element={<MyResumePage />} />
              <Route path="/my-resume/versions/:versionId" element={<MyResumePage />} />
              <Route path="/my-resume/tailor" element={<MyResumePage />} />
              <Route path="/partners" element={<PartnersPage />} />
              <Route path="/portofoili" element={<PortfolioBuilderPage />} />
              <Route path="/portfolio" element={<PortfolioBuilderPage />} />
              <Route path="/applications" element={<MyApplicationsPage />} />
              <Route
                path="/where-to-train/opportunity/:organizationSlug/:opportunityId"
                element={<TrainingFinderPage />}
              />
              <Route
                path="/where-to-train/opportunity/:opportunityId"
                element={<TrainingFinderPage />}
              />
              <Route
                path="/where-to-train/city/:citySlug"
                element={<TrainingFinderPage />}
              />
              <Route
                path="/where-to-train/major/:majorSlug"
                element={<TrainingFinderPage />}
              />
              <Route
                path="/where-to-train/city/:citySlug/major/:majorSlug"
                element={<TrainingFinderPage />}
              />
              <Route path="/apply/:companySlug" element={<CompanyApplyPage />} />
              <Route path="/p/:slug" element={<PortfolioPage />} />
              <Route path="/legal" element={<LegalPage />} />
              <Route path="/terms" element={<LegalPage />} />
              <Route path="/privacy" element={<LegalPage />} />
              <Route path="/add-experience" element={<AddExperienceModal />} />
              <Route path="/AddExperienceModal" element={<AddExperienceModal />} />
            </Routes>
          </Suspense>
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
