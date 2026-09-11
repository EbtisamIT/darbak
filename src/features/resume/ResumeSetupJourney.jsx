import React, { useEffect, useMemo, useState } from "react";
import { FiArrowLeft, FiArrowRight, FiCheck } from "react-icons/fi";
import ResumeBuilder from "./ResumeBuilder";
import { getResumeCompletionItems } from "./resumeValidation";
import { getScopedResumeStorageKey } from "./resumeStorageScope";

export const RESUME_SETUP_STEPS = [
  { id: "personal", label: "البيانات الأساسية" },
  { id: "education", label: "التعليم", sections: ["education"] },
  { id: "experience", label: "الخبرات", sections: ["experience"] },
  { id: "projects", label: "المشاريع", sections: ["projects"] },
  { id: "skills", label: "المهارات", sections: ["skills"] },
  { id: "certifications", label: "الشهادات والدورات", sections: ["certifications"] },
  { id: "volunteering", label: "الأنشطة واللغات", sections: ["volunteering", "languages"] },
  { id: "review", label: "مراجعة" },
];

const REVIEW_STEP_STORAGE_KEY = "darbak_resume_facts_review_step";

const getInitialStepIndex = (mode, storageScope) => {
  if (mode !== "review") return 0;
  try {
    const key = getScopedResumeStorageKey(REVIEW_STEP_STORAGE_KEY, storageScope);
    const savedStep = key ? window.localStorage.getItem(key) : "";
    const index = RESUME_SETUP_STEPS.findIndex((step) => step.id === savedStep);
    return index >= 0 ? index : 0;
  } catch {
    return 0;
  }
};

const ResumeReviewSummary = ({ resume, onOpenStep }) => {
  const experience = resume.experiences || resume.experience || [];
  const rows = [
    ["البيانات الأساسية", [resume.personalInfo?.fullName, resume.personalInfo?.major, resume.personalInfo?.city].filter(Boolean).join(" · ") || "غير مكتملة", 0],
    ["التعليم", resume.education?.[0]?.title || resume.personalInfo?.degree || "غير مكتمل", 1],
    ["الخبرات", `${experience.length} ${experience.length === 1 ? "خبرة" : "خبرات"}`, 2],
    ["المشاريع", `${(resume.projects || []).length} ${(resume.projects || []).length === 1 ? "مشروع" : "مشاريع"}`, 3],
    ["المهارات", (resume.skills || []).join(" · ") || "لا توجد مهارات", 4],
    ["الشهادات والدورات", `${(resume.certifications || []).length} ${(resume.certifications || []).length === 1 ? "شهادة" : "شهادات"}`, 5],
  ];
  return (
    <section className="resume-setup-review-summary">
      <header><strong>راجع بياناتك قبل تحديث المسودة</strong><span>يمكنك الرجوع لأي خطوة وتعديلها قبل تشغيل كاتب السيرة.</span></header>
      <div>{rows.map(([label, value, index]) => <button type="button" key={label} onClick={() => onOpenStep(index)}><span>{label}</span><strong>{value}</strong><FiArrowRight aria-hidden="true" /></button>)}</div>
    </section>
  );
};

const ResumeSetupJourney = ({ resume, onChange, onAutosave, onBuild, building = false, mode = "setup", storageScope = "", onExit }) => {
  const initialStepIndex = getInitialStepIndex(mode, storageScope);
  const [stepIndex, setStepIndex] = useState(initialStepIndex);
  const [highestReached, setHighestReached] = useState(mode === "review" ? RESUME_SETUP_STEPS.length - 1 : initialStepIndex);
  const step = RESUME_SETUP_STEPS[stepIndex];
  const completion = useMemo(() => getResumeCompletionItems(resume), [resume]);
  const missing = completion.filter((item) => item.status !== "complete");
  const isReviewMode = mode === "review";

  useEffect(() => {
    if (!isReviewMode) return;
    try {
      const key = getScopedResumeStorageKey(REVIEW_STEP_STORAGE_KEY, storageScope);
      if (key) window.localStorage.setItem(key, step.id);
    } catch {
      // Step restoration is optional; resume facts remain in the backend.
    }
  }, [isReviewMode, step.id, storageScope]);

  const moveTo = async (nextIndex) => {
    const saved = await onAutosave?.(resume);
    if (saved === false) return;
    setStepIndex(nextIndex);
    setHighestReached((current) => Math.max(current, nextIndex));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const finish = async () => {
    const saved = await onAutosave?.(resume);
    if (saved === false) return;
    onBuild(resume);
  };

  return (
    <section className="resume-setup-journey" dir="rtl">
      <header className="resume-journey-section-head">
        <span className="resume-journey-eyebrow">{isReviewMode ? "تحديث بيانات السيرة" : "إعداد السيرة لأول مرة"}</span>
        <h2>{isReviewMode ? "راجع بياناتك خطوة بخطوة" : "أكمل بيانات سيرتك قبل البناء"}</h2>
        <p>{isReviewMode ? "نعرض أحدث القيم المحفوظة ونحفظ تعديلاتك تلقائيًا. لن نحدّث المسودة إلا عند ضغط الزر الأخير." : "نحفظ ما تكتبه دون تشغيل الوكيل. لن تُبنى السيرة إلا عند ضغط «ابنِ سيرتي»."}</p>
      </header>

      <nav className="resume-facts-review-steps" aria-label="خطوات إعداد السيرة">
        {RESUME_SETUP_STEPS.map((candidate, index) => (
          <button
            type="button"
            key={candidate.id}
            className={index === stepIndex ? "is-current" : ""}
            disabled={!isReviewMode && index > highestReached + 1}
            onClick={() => (isReviewMode || index <= highestReached + 1) && moveTo(index)}
          >
            <span>{candidate.label}</span>
            {index < stepIndex ? <em className="is-complete"><FiCheck aria-hidden="true" /></em> : null}
          </button>
        ))}
      </nav>
      <div className="resume-setup-progress" aria-label={`الخطوة ${stepIndex + 1} من ${RESUME_SETUP_STEPS.length}`}>
        <span>{stepIndex + 1} من {RESUME_SETUP_STEPS.length}</span>
        <i><b style={{ width: `${((stepIndex + 1) / RESUME_SETUP_STEPS.length) * 100}%` }} /></i>
      </div>

      {step.id === "review" ? (
        <>
          <section className="resume-facts-review-status"><div><strong>{missing.length ? `باقي ${missing.length} عناصر تحتاج مراجعة` : "بياناتك جاهزة للبناء ✓"}</strong><span>{missing.length ? missing.map((item) => item.title).join(" · ") : "سيستخدم كاتب السيرة أحدث بياناتك المحفوظة فقط."}</span></div></section>
          <ResumeReviewSummary resume={resume} onOpenStep={moveTo} />
        </>
      ) : (
        <ResumeBuilder
          resume={resume}
          onChange={onChange}
          showStartOptions={false}
          showCompletionPanel={false}
          showSettings={false}
          showPersonalInfo={step.id === "personal"}
          showApplicationDetails={step.id === "personal"}
          visibleSections={step.sections || []}
        />
      )}

      <footer className="resume-journey-actions">
        {stepIndex > 0 ? (
          <button type="button" className="is-secondary" onClick={() => moveTo(stepIndex - 1)}>
            <FiArrowRight aria-hidden="true" /> رجوع
          </button>
        ) : isReviewMode ? <button type="button" className="is-secondary" onClick={onExit}>رجوع للوحة السيرة</button> : <span />}
        {stepIndex < RESUME_SETUP_STEPS.length - 1 ? (
          <button type="button" className="is-primary" onClick={() => moveTo(stepIndex + 1)}>
            التالي <FiArrowLeft aria-hidden="true" />
          </button>
        ) : (
          <button type="button" className="is-primary" onClick={finish} disabled={building}>
            {building ? (isReviewMode ? "جاري تحديث المسودة..." : "جاري بناء السيرة...") : isReviewMode ? "تحديث المسودة" : "ابنِ سيرتي"} <FiArrowLeft aria-hidden="true" />
          </button>
        )}
      </footer>
    </section>
  );
};

export default ResumeSetupJourney;
