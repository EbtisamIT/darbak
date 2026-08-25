import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { pdf } from "@react-pdf/renderer";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  FiDownload,
  FiEye,
  FiCheck,
  FiRefreshCw,
  FiSave,
  FiZap,
} from "react-icons/fi";
import API_BASE_URL from "../config/api";
import {
  PREMIUM_ACCESS_EVENT,
  PREMIUM_STATUS_EVENT,
  getAccessHeaders,
  getStoredPremiumPass,
  passHasEntitlement,
} from "../utils/premiumAccess";
import { getVisitorId, trackEvent, trackEventOncePerSession } from "../utils/analytics";
import ResumeAgentFlow from "../features/resume/ResumeAgentFlow";
import ResumeBuilder, { SettingsEditor } from "../features/resume/ResumeBuilder";
import ResumePdfDocument from "../features/resume/ResumePdfDocument";
import ResumePreview from "../features/resume/ResumePreview";
import ResumeJobMatchPanel from "../features/resume/ResumeJobMatchPanel";
import ResumeDashboard from "../features/resume/ResumeDashboard";
import ApplicationPackPanel from "../features/resume/ApplicationPackPanel";
import {
  ResumeJourneyPersonal,
  ResumeJourneyMissing,
  ResumeJourneyStepper,
} from "../features/resume/ResumeJourney";
import {
  createEmptyResume,
  getResumeFileName,
  normalizeResume,
  prepareResumeForSave,
} from "../features/resume/resumeDefaults";
import { estimateResumePages } from "../features/resume/resumeValidation";
import { getEnglishReviewItems } from "../features/resume/resumeLocalization";

const LOCAL_DRAFT_KEY = "darbak_resume_draft_v2";

const getSnapshot = (resume) => JSON.stringify(prepareResumeForSave(resume));

const readLocalDraft = () => {
  try {
    const raw = localStorage.getItem(LOCAL_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeLocalDraft = (resume) => {
  try {
    localStorage.setItem(
      LOCAL_DRAFT_KEY,
      JSON.stringify({
        kind: "master",
        savedAt: new Date().toISOString(),
        resume: prepareResumeForSave(resume),
      })
    );
  } catch {
    // Local draft is a safety net only; failing here should not block editing.
  }
};

const hasResumeDraftContent = (resume = {}) => {
  const personal = resume.personalInfo || {};
  return Boolean(
    Object.values(personal).some((value) => value && value.toString().trim()) ||
      resume.summary?.trim() ||
      (resume.skills || []).some(Boolean) ||
      ["education", "experience", "experiences", "projects", "certifications", "volunteering", "languages", "links"].some(
        (section) => (resume[section] || []).some((item) => Object.values(item || {}).some(Boolean))
      )
  );
};

const mergeLocalResumeDraft = (serverResume = {}, localResume = {}) => {
  const mergedPersonalInfo = { ...(serverResume.personalInfo || {}) };
  Object.entries(localResume.personalInfo || {}).forEach(([key, value]) => {
    if (value && value.toString().trim()) mergedPersonalInfo[key] = value;
  });
  const preferLocalSection = (section) =>
    (localResume[section] || []).some((item) => Object.values(item || {}).some(Boolean))
      ? localResume[section]
      : serverResume[section] || [];

  return normalizeResume({
    ...serverResume,
    ...localResume,
    personalInfo: mergedPersonalInfo,
    summary: localResume.summary?.trim() || serverResume.summary || "",
    education: preferLocalSection("education"),
    experience: preferLocalSection("experience"),
    experiences: preferLocalSection("experiences"),
    projects: preferLocalSection("projects"),
    certifications: preferLocalSection("certifications"),
    volunteering: preferLocalSection("volunteering"),
    languages: preferLocalSection("languages"),
    links: preferLocalSection("links"),
    skills: (localResume.skills || []).some(Boolean)
      ? localResume.skills
      : serverResume.skills || [],
    access: serverResume.access,
  });
};

const ResumeAccessPreview = ({ premiumPass, onUpgrade, onExplore }) => {
  const [resumePlan, setResumePlan] = useState(null);
  const currentPlanId = premiumPass?.planId || "";
  const currentPlanLabel = currentPlanId === "one_time_90"
    ? "دربك 90 يوم"
    : currentPlanId === "darbak_plus"
      ? "دربك+"
      : "";

  useEffect(() => {
    trackEventOncePerSession(
      "resume_preview_viewed",
      {
        metadata: {
          planId: "darbak_resume",
          sourcePage: "my_resume",
        },
      },
      `my_resume:${currentPlanId || "visitor"}`
    );
  }, [currentPlanId]);

  useEffect(() => {
    let isMounted = true;
    axios.get(`${API_BASE_URL}/api/subscriptions/plans`)
      .then(({ data }) => {
        if (!isMounted) return;
        const plans = Array.isArray(data?.plans) ? data.plans : [];
        setResumePlan(plans.find((plan) => plan.id === "darbak_resume") || null);
      })
      .catch(() => isMounted && setResumePlan(null));

    return () => {
      isMounted = false;
    };
  }, []);

  const priceLabel = typeof resumePlan?.priceSar === "number"
    ? `${resumePlan.priceSar.toLocaleString("en-US", {
      minimumFractionDigits: resumePlan.priceSar % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })} ر.س`
    : "السعر يظهر قبل الاشتراك";
  const durationLabel = resumePlan?.durationDays ? `${resumePlan.durationDays} يوم` : "";
  const monthlyCustomizations = resumePlan?.aiResumeUsageLimit
    ? `${resumePlan.aiResumeUsageLimit} تخصيصات شهريًا`
    : "تخصيصات شهرية للسيرة";

  return (
    <main className="resume-page resume-page-v2" dir="rtl">
      <section className="resume-access-state resume-access-preview">
        <span className="resume-access-badge">ضمن باقة دربك + سيرتي ✨</span>
        <h1>✨ جهّز تقديمك كامل للجهة</h1>
        <p>بدل ما تعدل سيرتك وتكتب الخطاب والإيميل كل مرة، دربك يجهزها لك حسب الجهة اللي اخترتها.</p>
        <div className="resume-access-pack" aria-label="معاينة ملف التقديم">
          <div className="resume-access-pack-title">
            <strong>تقديمك للجهة</strong>
            <span>3 من 3 جاهزة ✓</span>
          </div>
          {[
            ["السيرة المخصصة", "نبرز الأنسب من خبراتك ومشاريعك"],
            ["خطاب التقديم", "مخصص للجهة"],
            ["رسالة الإيميل", "جاهزة للنسخ والإرسال"],
          ].map(([title, note]) => (
            <div className="resume-access-pack-item" key={title}>
              <FiCheck aria-hidden="true" />
              <span><strong>{title} — جاهزة ✓</strong><small>{note}</small></span>
            </div>
          ))}
        </div>
        <div className="resume-access-value">
          <strong>{monthlyCustomizations}</strong>
          <span>{priceLabel}{durationLabel && ` / ${durationLabel}`}</span>
        </div>
        {currentPlanLabel && <p className="resume-current-plan">باقتك الحالية: <strong>{currentPlanLabel}</strong></p>}
        <div className="resume-access-actions">
          <button type="button" onClick={onUpgrade}>✨ رقِّ وابدأ تجهيز تقديمك</button>
          <button type="button" onClick={onExplore}>أكمل استكشاف الجهات</button>
        </div>
      </section>
    </main>
  );
};

const PortfolioPrerequisite = ({ readiness, onCompleteProfile }) => {
  const required = readiness?.required || [];
  const completedCount = Number(readiness?.completedCount || 0);
  const totalCount = Number(readiness?.totalCount || required.length || 1);
  const percentage = Math.round((completedCount / totalCount) * 100);
  const missing = required.filter((field) => !field.complete);

  return (
    <main className="resume-page resume-page-v2" dir="rtl">
      <section className="resume-portfolio-prerequisite">
        <span className="resume-access-badge">ملفك المهني هو أساس سيرتك ✨</span>
        <h1>قبل ما نبني سيرتك ✨</h1>
        <p>خلّنا نكمل ملفك المهني أولًا، عشان نستخدم معلوماتك في سيرتك وتقديماتك بدون ما تعيد كتابتها كل مرة.</p>
        <div className="resume-portfolio-progress" aria-label={`اكتمال الملف المهني ${percentage}%`}>
          <div className="resume-portfolio-progress-head"><strong>اكتمال المعلومات الأساسية</strong><span>{completedCount} من {totalCount}</span></div>
          <div><i style={{ width: `${percentage}%` }} /></div>
        </div>
        <div className="resume-portfolio-checklist">
          {required.map((field) => (
            <span className={field.complete ? "is-complete" : ""} key={field.key}>
              {field.complete ? "✓" : "○"} {field.label}
            </span>
          ))}
        </div>
        {missing.length > 0 && <p className="resume-portfolio-note">سنطلب منك الناقص فقط، أما LinkedIn والشهادات فاختيارية.</p>}
        <button type="button" onClick={onCompleteProfile}>كمّل ملفي المهني ←</button>
      </section>
    </main>
  );
};

const MyResumePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [resume, setResume] = useState(() => normalizeResume(createEmptyResume()));
  const [activeMobileTab, setActiveMobileTab] = useState("content");
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState("idle");
  const [error, setError] = useState("");
  const [accessIssue, setAccessIssue] = useState("");
  const [message, setMessage] = useState("");
  const [lastServerResume, setLastServerResume] = useState(null);
  const [resumeExists, setResumeExists] = useState(false);
  const [hasExistingResumeData, setHasExistingResumeData] = useState(false);
  const [resumeMode, setResumeMode] = useState("dashboard");
  const [agentConfig, setAgentConfig] = useState(null);
  const [editingTailoredVersion, setEditingTailoredVersion] = useState(false);
  const [editingVersionId, setEditingVersionId] = useState("");
  const [editingVersionType, setEditingVersionType] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [englishNameStepOpen, setEnglishNameStepOpen] = useState(false);
  const [englishNameInput, setEnglishNameInput] = useState("");
  const [englishNameError, setEnglishNameError] = useState("");
  const [tailoredVersions, setTailoredVersions] = useState([]);
  const [loadingTailoredVersions, setLoadingTailoredVersions] = useState(false);
  const [applicationPack, setApplicationPack] = useState(null);
  const [journeyStep, setJourneyStep] = useState("data");
  const [journeyView, setJourneyView] = useState("start");
  const [journeySource, setJourneySource] = useState("portfolio");
  const [portfolioReadiness, setPortfolioReadiness] = useState(null);

  const hasLoadedRef = useRef(false);
  const saveTimerRef = useRef(null);
  const lastSavedSnapshotRef = useRef("");
  const lastRouteRef = useRef("");

  const estimatedPages = useMemo(() => estimateResumePages(resume), [resume]);
  const routeOpportunityId =
    searchParams.get("opportunityId") ||
    searchParams.get("opportunity") ||
    searchParams.get("jobId") ||
    "";
  const routeTailorContext = location.state?.tailorContext || null;
  const routeVersionId = location.pathname.match(/^\/my-resume\/versions\/([^/]+)$/)?.[1] || "";
  const routeView = routeVersionId
    ? "version"
    : location.pathname === "/my-resume/build"
    ? "build"
    : location.pathname === "/my-resume/edit"
    ? "edit"
    : location.pathname === "/my-resume/tailor"
    ? "tailor"
    : "dashboard";
  const isTailoredApplicationFlow = routeView === "tailor" ||
    (editingTailoredVersion && editingVersionType === "tailored");

  const openResumeUpgrade = useCallback(() => {
    trackEvent("resume_upgrade_clicked", {
      metadata: {
        planId: "darbak_resume",
        sourcePage: "my_resume_preview",
      },
    });
    window.dispatchEvent(
      new CustomEvent(PREMIUM_ACCESS_EVENT, {
        detail: {
          feature: "my_resume",
          title: "جهّز سيرتك وتقديمك لكل جهة",
          source: "my_resume_preview",
          defaultPlanId: "darbak_resume",
        },
      })
    );
  }, []);

  const loadTailoredVersions = useCallback(async () => {
    try {
      setLoadingTailoredVersions(true);
      const { data } = await axios.get(`${API_BASE_URL}/api/resume-agent/tailored-versions`, {
        headers: getAccessHeaders({ itemKey: "resume-agent:tailored-versions" }),
      });
      setTailoredVersions(Array.isArray(data.versions) ? data.versions : []);
    } catch {
      // A saved master resume must still be usable when version history is temporarily unavailable.
      setTailoredVersions([]);
    } finally {
      setLoadingTailoredVersions(false);
    }
  }, []);

  const loadResume = useCallback(
    async ({ preferLocalDraft = true } = {}) => {
      try {
        setLoading(true);
        setError("");
        setAccessIssue("");

        const { data } = await axios.get(`${API_BASE_URL}/api/resume/me`, {
          headers: getAccessHeaders({ itemKey: "resume:me" }),
        });

        const serverResume = normalizeResume(data.resume || createEmptyResume());
        const localDraft = preferLocalDraft ? readLocalDraft() : null;
        const localResume = localDraft?.kind === "master" && localDraft?.resume
          ? normalizeResume(localDraft.resume)
          : null;
        const shouldUseLocal =
          localResume &&
          hasResumeDraftContent(localResume) &&
          localDraft?.savedAt &&
          (!data.resume?.updatedAt ||
            new Date(localDraft.savedAt).getTime() > new Date(data.resume.updatedAt).getTime());

        const nextResume = shouldUseLocal
          ? mergeLocalResumeDraft(serverResume, localResume)
          : serverResume;

        setResume(nextResume);
        setResumeExists(Boolean(data.exists));
        setHasExistingResumeData(Boolean(data.hasExistingResumeData || data.exists));
        setPortfolioReadiness(data.portfolioReadiness || null);
        setLastServerResume(serverResume);
        lastSavedSnapshotRef.current = getSnapshot(serverResume);
        hasLoadedRef.current = true;
        setSaveState("saved");

        if (data.portfolioImported && !shouldUseLocal) {
          setMessage("نقدر نستخدم بيانات ملفك المهني كبداية لمسودة السيرة.");
        } else if (shouldUseLocal) {
          setMessage("استعدنا نسخة محفوظة محليًا حتى لا تضيع تعديلاتك.");
        }
      } catch (err) {
        const canKeepWorking = hasLoadedRef.current;
        if (!canKeepWorking) hasLoadedRef.current = false;
        const status = err.response?.status;
        const reason = err.response?.data?.reason;
        if (status === 401) {
          setAccessIssue("login_required");
          setError("سجل دخولك أولًا بنفس بريدك ورمزك حتى نفتح خدمة السيرة.");
          return;
        }
        if (reason === "resume_plan_not_launched") {
          setAccessIssue("not_launched");
          setError("خدمة سيرتي بدربك قيد التجهيز حاليًا، وتظهر الآن للمعاينة الإدارية فقط.");
          return;
        }
        if (status === 402 || status === 403 || reason === "resume_plan_required") {
          setAccessIssue("plan_required");
          setError("خدمة سيرتي بدربك متاحة ضمن باقة دربك+ سيرة.");
          return;
        }
        setError(
          canKeepWorking
            ? "تعذر تحديث بيانات السيرة. ما زلت تشاهد آخر نسخة محفوظة."
            : err.response?.data?.error || "تعذر تحميل السيرة. حاول مرة أخرى."
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const saveResume = useCallback(
    async ({ manual = false } = {}) => {
      const isJourneySave = manual && resumeMode === "dashboard";
      if (!hasLoadedRef.current || (resumeMode !== "editor" && !isJourneySave)) return false;
      if (editingTailoredVersion) {
        if (editingVersionType === "translation" && editingVersionId) {
          try {
            setSaveState("saving");
            const { data } = await axios.put(
              `${API_BASE_URL}/api/resume-agent/tailored-versions/${editingVersionId}`,
              prepareResumeForSave(resume),
              { headers: getAccessHeaders({ itemKey: `resume-version:${editingVersionId}` }) }
            );
            const savedResume = normalizeResume({ ...data.resume, access: resume.access });
            setResume(savedResume);
            setSaveState("saved");
            if (manual) setMessage(data.message || "تم حفظ النسخة الإنجليزية.");
            return true;
          } catch (err) {
            setSaveState("error");
            setError(err.response?.data?.error || "تعذر حفظ النسخة الإنجليزية.");
            return false;
          }
        }
        setSaveState("saved");
        if (manual) {
          setMessage("هذه نسخة مخصصة محفوظة مستقلة. عدّل السيرة الأساسية إذا كنت تريد حفظ تغييرات عامة.");
        }
        return true;
      }

      const snapshot = getSnapshot(resume);
      writeLocalDraft(resume);

      if (!manual && snapshot === lastSavedSnapshotRef.current) {
        setSaveState("saved");
        return;
      }

      try {
        setSaveState("saving");
        setError("");
        const payload = {
          ...prepareResumeForSave(resume),
          visitorId: getVisitorId(),
        };
        const { data } = await axios.put(`${API_BASE_URL}/api/resume/me`, payload, {
          headers: getAccessHeaders({ itemKey: "resume:me" }),
        });
        const savedResume = normalizeResume(data.resume || payload);
        lastSavedSnapshotRef.current = getSnapshot(savedResume);
        setLastServerResume(savedResume);
        setResumeExists(true);
        setHasExistingResumeData(true);
        setSaveState("saved");
        setMessage(manual ? data.message || "تم حفظ سيرتك." : "");
        return true;
      } catch (err) {
        setSaveState("error");
        setError(err.response?.data?.error || "تعذر حفظ السيرة. احتفظنا بنسخة مؤقتة في هذا الجهاز.");
        return false;
      }
    },
    [editingTailoredVersion, editingVersionId, editingVersionType, resume, resumeMode]
  );

  const handleDownloadPdf = useCallback(async () => {
    try {
      setPdfLoading(true);
      setError("");
      let normalizedResume = normalizeResume(resume);
      if (normalizedResume.settings?.language === "en") {
        const currentEnglishName = (normalizedResume.personalInfo?.englishName || "").trim();
        if (currentEnglishName.split(/\s+/).filter(Boolean).length < 2) {
          const englishName = window.prompt(
            "باقي خطوة قبل تحميل النسخة الإنجليزية\nاكتب اسمك بالإنجليزي كما تستخدمه رسميًا."
          )?.trim();
          if (!englishName || englishName.split(/\s+/).filter(Boolean).length < 2) {
            setMessage("اكتب اسمك الرسمي بالإنجليزية من كلمتين على الأقل قبل تحميل PDF.");
            return;
          }
          const master = normalizeResume(lastServerResume || resume);
          const masterPayload = prepareResumeForSave({
            ...master,
            personalInfo: { ...master.personalInfo, englishName },
          });
          const { data } = await axios.put(`${API_BASE_URL}/api/resume/me`, masterPayload, {
            headers: getAccessHeaders({ itemKey: "resume:me" }),
          });
          const savedMaster = normalizeResume(data.resume || masterPayload);
          setLastServerResume(savedMaster);
          normalizedResume = normalizeResume({
            ...normalizedResume,
            personalInfo: { ...normalizedResume.personalInfo, englishName },
            localizedDisplay: {
              ...(normalizedResume.localizedDisplay || {}),
              personalInfo: {
                ...(normalizedResume.localizedDisplay?.personalInfo || {}),
                fullName: englishName,
              },
            },
          });
          setResume(normalizedResume);
        }
        const reviews = getEnglishReviewItems(normalizedResume);
        if (reviews.length) {
          setMessage(`راجِع ${reviews.length} عناصر قبل تحميل النسخة الإنجليزية. أضف قيمة عرض إنجليزية لكل اسم أو جهة ظاهرة.`);
          return;
        }
      }
      const blob = await pdf(<ResumePdfDocument resume={normalizedResume} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = getResumeFileName(normalizedResume);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1200);
      trackEvent("resume_pdf_downloaded", {
        page: "/my-resume",
        metadata: {
          sourcePage: editingTailoredVersion ? "tailored_resume" : "master_resume",
          packType: applicationPack?.packType || "",
        },
      });
    } catch (err) {
      console.error("Resume PDF download error:", err);
      const detail =
        process.env.NODE_ENV === "development" && err?.message
          ? ` (${err.message})`
          : "";
      setError(`تعذر تحميل ملف PDF الآن. احفظ السيرة ثم حاول مرة أخرى.${detail}`);
    } finally {
      setPdfLoading(false);
    }
  }, [applicationPack?.packType, editingTailoredVersion, lastServerResume, resume]);

  const createEnglishVersion = useCallback(async () => {
    try {
      setTranslating(true);
      setError("");
      setMessage("");
      const { data } = await axios.post(
        `${API_BASE_URL}/api/resume/ai/translate-en`,
        {
          resume: prepareResumeForSave(resume),
          visitorId: getVisitorId(),
        },
        {
          headers: getAccessHeaders({ itemKey: "resume:translate-en" }),
        }
      );
      const translatedResume = normalizeResume({
        ...data.version?.resumePayload,
        access: {
          ...(resume.access || {}),
          ...(data.usage || {}),
        },
      });
      setResume(translatedResume);
      setEditingTailoredVersion(true);
      setEditingVersionId(data.version?._id || "");
      setEditingVersionType("translation");
      setResumeMode("editor");
      if (data.version?._id) navigate(`/my-resume/versions/${data.version._id}`);
      setMessage(
        data.message || "تم تجهيز نسخة إنجليزية رسمية للمراجعة. راجعها قبل الحفظ أو التحميل."
      );
      trackEvent("resume_translate_english_clicked", {
        page: "/my-resume",
        metadata: {
          usageCount: data.usage?.aiResumeUsageCount,
          usageLimit: data.usage?.aiResumeUsageLimit,
        },
      });
    } catch (err) {
      setError(err.response?.data?.error || "تعذر ترجمة السيرة الآن.");
    } finally {
      setTranslating(false);
    }
  }, [navigate, resume]);

  const handleTranslateToEnglish = useCallback(() => {
    const englishName = (lastServerResume?.personalInfo?.englishName || resume.personalInfo?.englishName || "").trim();
    if (englishName.split(/\s+/).filter(Boolean).length >= 2 && !/[\u0600-\u06FF]/.test(englishName)) {
      createEnglishVersion();
      return;
    }
    setEnglishNameInput(englishName);
    setEnglishNameError("");
    setEnglishNameStepOpen(true);
  }, [createEnglishVersion, lastServerResume, resume.personalInfo?.englishName]);

  const submitEnglishNameStep = async () => {
    const englishName = englishNameInput.trim().replace(/\s+/g, " ");
    if (!englishName) return setEnglishNameError("اكتب الاسم الكامل بالإنجليزي.");
    if (/[\u0600-\u06FF]/.test(englishName)) return setEnglishNameError("استخدم أحرفًا إنجليزية فقط.");
    if (englishName.split(" ").filter(Boolean).length < 2) return setEnglishNameError("اكتب الاسم من كلمتين على الأقل.");
    try {
      const master = normalizeResume(lastServerResume || resume);
      const payload = prepareResumeForSave({
        ...master,
        personalInfo: { ...master.personalInfo, englishName },
      });
      const { data } = await axios.put(`${API_BASE_URL}/api/resume/me`, payload, {
        headers: getAccessHeaders({ itemKey: "resume:me" }),
      });
      const savedMaster = normalizeResume(data.resume || payload);
      setLastServerResume(savedMaster);
      setEnglishNameStepOpen(false);
      createEnglishVersion();
    } catch (err) {
      setEnglishNameError(err.response?.data?.error || "تعذر حفظ الاسم الآن. حاول مرة أخرى.");
    }
  };

  useEffect(() => {
    trackEvent("resume_page_view", { page: "/my-resume" });
    // A version route loads its own ResumeTailoredVersion below. Loading the
    // master here races that request and can overwrite version presentation
    // fields (such as a tailored summary) after refresh.
    if (routeView !== "version") loadResume();
    loadTailoredVersions();
  }, [loadResume, loadTailoredVersions, routeView]);

  useEffect(() => {
    const refreshAfterAccessChange = () => {
      loadResume({ preferLocalDraft: true });
    };

    window.addEventListener(PREMIUM_STATUS_EVENT, refreshAfterAccessChange);
    window.addEventListener("storage", refreshAfterAccessChange);

    return () => {
      window.removeEventListener(PREMIUM_STATUS_EVENT, refreshAfterAccessChange);
      window.removeEventListener("storage", refreshAfterAccessChange);
    };
  }, [loadResume]);

  useEffect(() => {
    if (
      !hasLoadedRef.current ||
      resumeMode !== "editor" ||
      (editingTailoredVersion && editingVersionType !== "translation")
    ) return undefined;

    const snapshot = getSnapshot(resume);
    // A translated version is an independent ResumeTailoredVersion. It must never
    // become the generic local draft that is later merged over the master profile.
    if (!editingTailoredVersion) writeLocalDraft(resume);
    if (snapshot === lastSavedSnapshotRef.current) {
      setSaveState("saved");
      return undefined;
    }

    setSaveState("saving");
    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveResume();
    }, 800);

    return () => window.clearTimeout(saveTimerRef.current);
  }, [editingTailoredVersion, editingVersionType, resume, resumeMode, saveResume]);

  const handleUsePortfolio = () => {
    loadResume({ preferLocalDraft: false });
    trackEvent("resume_use_portfolio_clicked", { page: "/my-resume" });
  };

  const startJourneyFromPortfolio = () => {
    setJourneySource("portfolio");
    handleUsePortfolio();
    navigate("/my-resume/build");
  };

  const handleCreateScratch = () => {
    if (!window.confirm("إنشاء سيرة جديدة من الصفر؟ سيتم استبدال البيانات الحالية في المحرر.")) {
      return;
    }
    setResume((current) =>
      normalizeResume({
        ...createEmptyResume(),
        access: current.access,
      })
    );
    trackEvent("resume_create_scratch_clicked", { page: "/my-resume" });
  };

  const startJourneyFromScratch = () => {
    setJourneySource("scratch");
    setResume((current) =>
      normalizeResume({
        ...createEmptyResume(),
        access: current.access,
      })
    );
    navigate("/my-resume/build");
    trackEvent("resume_create_scratch_clicked", {
      page: "/my-resume",
      metadata: { source: "journey" },
    });
  };

  const handleContinueSaved = () => {
    if (lastServerResume) {
      setResume(normalizeResume(lastServerResume));
      setMessage("رجعنا آخر نسخة محفوظة في حسابك.");
    } else {
      loadResume({ preferLocalDraft: true });
    }
    trackEvent("resume_continue_saved_clicked", { page: "/my-resume" });
  };

  const continueJourneyToMissing = () => {
    navigate("/my-resume/build?step=missing");
  };

  const finishJourneyBasics = async () => {
    const saved = await saveResume({ manual: true });
    if (saved) startAgent({ purpose: "create_resume", source: "professional_profile" });
  };

  const handleCustomizeLater = () => {
    if (!routeOpportunityId) {
      setError("");
      setMessage("");
      navigate("/my-resume/tailor");
      trackEvent("resume_tailor_missing_opportunity", { page: "/my-resume" });
      return;
    }

    setError("");
    setMessage("");
    navigate(`/my-resume/tailor${location.search}`);
    trackEvent("resume_tailor_match_opened", { page: "/my-resume" });
  };

  const startTailoringForMatchedOpportunity = (matchResult = {}) => {
    const selectedOpportunityId = routeOpportunityId || matchResult.job?.id || "";
    const externalJob = selectedOpportunityId ? null : routeTailorContext || matchResult.job || null;
    if (!selectedOpportunityId && !externalJob?.company) return;
    setAgentConfig({
      purpose: "tailor_resume",
      source: "existing_resume",
      language: resume.settings?.language || "ar",
      opportunityId: selectedOpportunityId,
      externalJob,
    });
    setResumeMode("agent");
    setJourneyStep("draft");
    navigate(`/my-resume/tailor${location.search}`);
    trackEvent("resume_agent_tailor_started", { page: "/my-resume" });
  };

  const startAgent = ({ purpose = "create_resume", source = "professional_profile" } = {}) => {
    setError("");
    setMessage("");
    setEditingTailoredVersion(false);
    setEditingVersionId("");
    setEditingVersionType("");
    setAgentConfig({
      purpose,
      source,
      language: resume.settings?.language || "ar",
      opportunityId: purpose === "tailor_resume" ? routeOpportunityId : "",
    });
    setResumeMode("agent");
    setJourneyStep("draft");
    navigate("/my-resume/build?step=draft");
    trackEvent("resume_agent_started", { page: "/my-resume", metadata: { purpose, source } });
  };

  const loadTailoredVersion = useCallback(async (versionId) => {
    if (!versionId) return;
    try {
      setLoading(true);
      setError("");
      const { data } = await axios.get(
        `${API_BASE_URL}/api/resume-agent/tailored-versions/${versionId}`,
        { headers: getAccessHeaders({ itemKey: `resume-agent:tailored-version:${versionId}` }) }
      );
      const loadedResume = normalizeResume(data.version?.resumePayload || createEmptyResume());
      setResume({ ...loadedResume, access: resume.access || {} });
      setEditingTailoredVersion(true);
      setEditingVersionId(data.version?._id || versionId);
      setEditingVersionType(data.version?.variantType || "tailored");
      setApplicationPack(data.version?.applicationPack || null);
      setResumeMode("editor");
      setJourneyStep("ready");
      setActiveMobileTab("preview");
      setMessage(`فتحت نسخة ${data.version?.name || "مخصصة"} بدون تغيير سيرتك الأساسية.`);
    } catch (err) {
      setError(err.response?.data?.error || "تعذر فتح النسخة المخصصة.");
    } finally {
      setLoading(false);
    }
  }, [resume.access]);

  const openTailoredVersion = (version) => {
    if (version?._id) navigate(`/my-resume/versions/${version._id}`);
  };

  useEffect(() => {
    const routeKey = `${location.pathname}${location.search}`;
    if (lastRouteRef.current === routeKey) return;
    lastRouteRef.current = routeKey;

    const openMaster = () => {
      setEditingTailoredVersion(false);
      setEditingVersionId("");
      setEditingVersionType("");
      setApplicationPack(null);
      loadResume({ preferLocalDraft: false });
    };

    if (routeView === "version") {
      loadTailoredVersion(routeVersionId);
      return;
    }
    if (routeView === "edit") {
      openMaster();
      setResumeMode("editor");
      setJourneyStep("polish");
      setActiveMobileTab("content");
      return;
    }
    if (routeView === "build") {
      openMaster();
      const step = searchParams.get("step");
      if (step === "draft") {
        setAgentConfig({
          purpose: "create_resume",
          source: "professional_profile",
          language: "ar",
          opportunityId: "",
        });
        setResumeMode("agent");
        setJourneyStep("draft");
      } else {
        setResumeMode("dashboard");
        setJourneyView(step === "missing" ? "missing" : "personal");
        setJourneyStep(step === "missing" ? "missing" : "data");
      }
      return;
    }
    if (routeView === "tailor") {
      openMaster();
      setResumeMode("match");
      setJourneyStep("draft");
      return;
    }
    openMaster();
    setResumeMode("dashboard");
    setJourneyView("start");
    setJourneyStep("data");
  }, [loadResume, loadTailoredVersion, location.pathname, location.search, routeVersionId, routeView, searchParams]);

  const completeApplicationPackDetails = async ({ trainingStart, trainingEnd, targetField }) => {
    if (!editingVersionId) return;
    const { data } = await axios.put(
      `${API_BASE_URL}/api/resume-agent/tailored-versions/${editingVersionId}/application-pack`,
      { trainingStart, trainingEnd, targetField },
      { headers: getAccessHeaders({ itemKey: `resume-application-pack:${editingVersionId}` }) }
    );
    setApplicationPack(data.applicationPack || null);
    setMessage(data.message || "اكتملت رسالة التقديم.");
    loadTailoredVersions();
  };

  const handleAgentApproved = (data = {}) => {
    const approvedResume = data.resume || data.tailoredVersion?.resumePayload || null;
    if (!approvedResume) {
      setMessage(data.message || "تم اعتماد المسودة.");
      navigate("/my-resume/edit");
      return;
    }

    const savedResume = normalizeResume({
      ...approvedResume,
      access: {
        ...(resume.access || {}),
        ...(data.resume?.access || {}),
        ...(data.usage || {}),
      },
    });

    setResume(savedResume);
    if (data.resume) {
      setLastServerResume(savedResume);
      setResumeExists(true);
      setHasExistingResumeData(true);
      setEditingTailoredVersion(false);
      lastSavedSnapshotRef.current = getSnapshot(savedResume);
    } else {
      setEditingTailoredVersion(true);
      loadTailoredVersions();
    }
    setSaveState("saved");
    const remainingTailors = Math.max(
      0,
      Number(data.usage?.aiResumeUsageLimit || 0) - Number(data.usage?.aiResumeUsageCount || 0)
    );
    setMessage(
      data.tailoredVersion
        ? `تم إنشاء النسخة المخصصة ✓ متبقي لك ${remainingTailors} تخصيصات هذا الشهر.`
        : data.message || "اعتمدنا المسودة وفتحناها في المحرر."
    );
    if (data.tailoredVersion?._id) {
      navigate(`/my-resume/versions/${data.tailoredVersion._id}`);
    } else {
      navigate("/my-resume/edit");
    }
  };

  const cancelAgent = () => {
    setAgentConfig(null);
    navigate("/my-resume/build");
  };

  const returnToMasterResume = async () => {
    navigate("/my-resume/edit");
  };

  const renderSaveStatus = () => {
    if (saveState === "saving") return "جاري الحفظ...";
    if (saveState === "saved") return "تم الحفظ";
    if (saveState === "error") return "تعذر الحفظ";
    return "جاهز للتحرير";
  };

  const localPremiumPass = getStoredPremiumPass();
  const hasLocalResumeAccess = passHasEntitlement(localPremiumPass, "resume_builder");

  if (!hasLocalResumeAccess) {
    return <ResumeAccessPreview premiumPass={localPremiumPass} onUpgrade={openResumeUpgrade} onExplore={() => navigate("/")} />;
  }

  if (loading) {
    return (
      <main className="resume-page resume-page-v2" dir="rtl">
        <div className="resume-page-state">جارِ تجهيز سيرتك...</div>
      </main>
    );
  }

  if (error && accessIssue) {
    return <ResumeAccessPreview premiumPass={localPremiumPass} onUpgrade={openResumeUpgrade} onExplore={() => navigate("/")} />;
  }

  if (!hasExistingResumeData && portfolioReadiness && !portfolioReadiness.complete) {
    return (
      <PortfolioPrerequisite
        readiness={portfolioReadiness}
        onCompleteProfile={() => navigate("/portfolio?from=resume")}
      />
    );
  }

  return (
    <main className="resume-page resume-page-v2" dir="rtl">
      {englishNameStepOpen && (
        <div className="resume-english-name-overlay" role="dialog" aria-modal="true" aria-labelledby="english-name-title">
          <section className="resume-english-name-step">
            <span>قبل إنشاء النسخة الإنجليزية</span>
            <h2 id="english-name-title">اكتب اسمك بالإنجليزي</h2>
            <p>استخدم نفس الكتابة التي تستخدمها رسميًا.</p>
            <label>
              الاسم الكامل بالإنجليزي
              <input
                value={englishNameInput}
                onChange={(event) => { setEnglishNameInput(event.target.value); setEnglishNameError(""); }}
                placeholder="Sara Ahmed"
                dir="ltr"
                autoFocus
              />
            </label>
            {englishNameError && <p className="resume-english-name-error">{englishNameError}</p>}
            <button type="button" onClick={submitEnglishNameStep}>متابعة للنسخة الإنجليزية</button>
          </section>
        </div>
      )}
      {!(resumeMode === "dashboard" && journeyView === "start") && !(
        routeView === "tailor" && (resumeMode === "match" || resumeMode === "agent")
      ) && <section className="resume-topbar">
        <div>
          <span>سيرتي بدربك</span>
          <h1>{editingTailoredVersion && editingVersionType === "tailored" ? `نسختك المخصصة لـ ${applicationPack?.applicationInfo?.organizationName || "هذه الجهة"} ✓` : "جهزنا لك البداية من بياناتك في دربك."}</h1>
          <p>{editingTailoredVersion && editingVersionType === "tailored" ? "محفوظة بشكل مستقل عن سيرتك الأساسية." : "راجع الموجود، وكمل الناقص فقط."}</p>
        </div>
        <div className="resume-topbar-actions">
          {resumeMode === "editor" ? (
            <>
              {editingTailoredVersion && <button type="button" className="resume-icon-button" onClick={returnToMasterResume}>
                سيرتي الأساسية
              </button>}
              <span className={`resume-save-status is-${saveState}`}>{renderSaveStatus()}</span>
              <button type="button" className="resume-icon-button" onClick={() => setActiveMobileTab("preview")}>
                <FiEye aria-hidden="true" />
                معاينة
              </button>
              <button type="button" className="resume-icon-button" onClick={() => saveResume({ manual: true })}>
                <FiSave aria-hidden="true" />
                حفظ
              </button>
              <button
                type="button"
                className="resume-icon-button"
                onClick={handleTranslateToEnglish}
                disabled={translating}
              >
                <FiRefreshCw aria-hidden="true" />
                {translating ? "جاري الترجمة..." : "ترجمة EN"}
              </button>
              <button
                type="button"
                className="resume-download-link"
                onClick={handleDownloadPdf}
                disabled={pdfLoading}
              >
                <FiDownload aria-hidden="true" />
                {pdfLoading ? "تجهيز PDF..." : "تحميل PDF"}
              </button>
            </>
          ) : (
            <span className="resume-save-status is-idle">
              {resumeMode === "agent" ? "الوكيل يجهز المسودة قبل المحرر" : "ابدأ بإنشاء المسودة"}
            </span>
          )}
        </div>
      </section>}

      {!(resumeMode === "dashboard" && journeyView === "start") && !isTailoredApplicationFlow && <ResumeJourneyStepper
        currentStep={journeyStep}
        onStepChange={(step) => {
          if (step === "data") {
            navigate("/my-resume/build");
          }
          if (step === "missing") {
            navigate("/my-resume/build?step=missing");
          }
        }}
      />}

      {message && <div className="resume-page-message">{message}</div>}
      {error && !accessIssue && (
        <div className={hasLoadedRef.current ? "resume-page-notice" : "resume-page-error"}>
          {error}
        </div>
      )}
      {estimatedPages > 2 && (
        <div className="resume-page-warning">
          سيرتك تجاوزت صفحتين، جرّب اختصار بعض المحتوى. يمكنك التحميل رغم ذلك.
        </div>
      )}

      {resumeMode === "dashboard" && journeyView === "start" && (
        <ResumeDashboard
          resume={resume}
          resumeExists={resumeExists}
          versions={tailoredVersions}
          loadingVersions={loadingTailoredVersions}
          onStartFromPortfolio={startJourneyFromPortfolio}
          onStartFromScratch={startJourneyFromScratch}
          onOpenEditor={() => navigate("/my-resume/edit")}
          onCustomize={handleCustomizeLater}
          onCreateEnglish={handleTranslateToEnglish}
          onOpenVersion={openTailoredVersion}
        />
      )}

      {resumeMode === "dashboard" && journeyView === "personal" && (
        <ResumeJourneyPersonal
          resume={resume}
          source={journeySource}
          onChange={(nextResume) => setResume(normalizeResume(nextResume))}
          onBack={() => {
            navigate("/my-resume");
          }}
          onContinue={continueJourneyToMissing}
        />
      )}

      {resumeMode === "dashboard" && journeyView === "missing" && (
        <ResumeJourneyMissing
          resume={resume}
          onChange={(nextResume) => setResume(normalizeResume(nextResume))}
          onBack={() => {
            navigate("/my-resume/build");
          }}
          onContinue={finishJourneyBasics}
        />
      )}

      {resumeMode === "match" && (
        <ResumeJobMatchPanel
          opportunityId={routeOpportunityId}
          externalJob={routeTailorContext}
          onStartTailoring={startTailoringForMatchedOpportunity}
          onBack={() => {
            navigate("/my-resume");
          }}
        />
      )}

      {resumeMode === "agent" && agentConfig && (
        <ResumeAgentFlow
          key={[
            agentConfig.purpose,
            agentConfig.source,
            agentConfig.language,
          agentConfig.opportunityId,
          agentConfig.externalJob?.title || "",
          ].join(":")}
          purpose={agentConfig.purpose}
          source={agentConfig.source}
          language={agentConfig.language}
          opportunityId={agentConfig.opportunityId}
          externalJob={agentConfig.externalJob}
          onApproved={handleAgentApproved}
          onCancel={cancelAgent}
        />
      )}

      {resumeMode === "editor" && (
        <>
          {editingTailoredVersion && editingVersionType === "tailored" && applicationPack && (
            <ApplicationPackPanel
              pack={applicationPack}
              onCompleteDetails={completeApplicationPackDetails}
              onOpenResume={() => setActiveMobileTab("preview")}
            />
          )}
          <div className="resume-mobile-tabs" role="tablist" aria-label="السيرة">
            <button
              type="button"
              className={activeMobileTab === "content" ? "is-active" : ""}
              onClick={() => setActiveMobileTab("content")}
            >
              المحتوى
            </button>
            <button
              type="button"
              className={activeMobileTab === "design" ? "is-active" : ""}
              onClick={() => setActiveMobileTab("design")}
            >
              التصميم
            </button>
            <button
              type="button"
              className={activeMobileTab === "preview" ? "is-active" : ""}
              onClick={() => setActiveMobileTab("preview")}
            >
              معاينة
            </button>
          </div>

          <section className="resume-workspace-v2">
            <div className={`resume-editor-pane${activeMobileTab !== "content" ? " is-hidden-mobile" : ""}`}>
              <div className="resume-pane-head">
                <div>
                  <h2>المحرر</h2>
                  <p>رتّب الأقسام، أضف الإنجازات، وأخفِ أي قسم لا تحتاجه.</p>
                </div>
                <button type="button" onClick={() => loadResume({ preferLocalDraft: false })}>
                  <FiRefreshCw aria-hidden="true" />
                  تحديث
                </button>
              </div>
              <ResumeBuilder
                resume={resume}
                hideCompletedChecklist={editingTailoredVersion && editingVersionType === "tailored"}
                onChange={(nextResume) => setResume(normalizeResume(nextResume))}
                onUsePortfolio={handleUsePortfolio}
                onCreateScratch={handleCreateScratch}
                onContinueSaved={handleContinueSaved}
              />
            </div>

            <div className={`resume-design-pane${activeMobileTab !== "design" ? " is-hidden-mobile" : ""}`}>
              <div className="resume-pane-head">
                <div>
                  <h2>التصميم</h2>
                  <p>اختر شكل السيرة أولًا، ثم خصّص ما تحتاجه فقط.</p>
                </div>
              </div>
              <SettingsEditor
                resume={resume}
                onChange={(nextResume) => setResume(normalizeResume(nextResume))}
              />
            </div>

            <aside className={`resume-preview-pane${activeMobileTab !== "preview" ? " is-hidden-mobile" : ""}`}>
              <div className="resume-pane-head">
                <div>
                  <h2>معاينة A4</h2>
                  <p>{estimatedPages} صفحة تقريبًا</p>
                </div>
                <button type="button" onClick={handleCustomizeLater}>
                  <FiZap aria-hidden="true" />
                  خصصها لهذه الفرصة
                </button>
              </div>
              <div className="resume-paper-stage">
                <ResumePreview resume={normalizeResume(resume)} />
              </div>
            </aside>
          </section>
        </>
      )}

      {resumeMode === "editor" && <div className="resume-sticky-actions">
        {editingTailoredVersion && <button type="button" onClick={returnToMasterResume}>
          سيرتي الأساسية
        </button>}
        <button type="button" onClick={() => saveResume({ manual: true })}>
          <FiSave aria-hidden="true" />
          حفظ
        </button>
        <button type="button" onClick={handleTranslateToEnglish} disabled={translating}>
          <FiRefreshCw aria-hidden="true" />
          EN
        </button>
        <button type="button" onClick={handleDownloadPdf} disabled={pdfLoading}>
          <FiDownload aria-hidden="true" />
          {pdfLoading ? "تجهيز..." : "PDF"}
        </button>
      </div>}
    </main>
  );
};

export default MyResumePage;
