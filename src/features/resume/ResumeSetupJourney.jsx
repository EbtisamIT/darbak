import React, { useMemo, useState } from "react";
import { FiArrowLeft, FiArrowRight, FiCheck } from "react-icons/fi";
import ResumeBuilder from "./ResumeBuilder";
import { getResumeCompletionItems } from "./resumeValidation";

export const RESUME_SETUP_STEPS = [
  { id: "personal", label: "البيانات الأساسية" },
  { id: "education", label: "التعليم", sections: ["education"] },
  { id: "experience", label: "الخبرات", sections: ["experience"] },
  { id: "projects", label: "المشاريع", sections: ["projects"] },
  { id: "skills", label: "المهارات", sections: ["skills"] },
  { id: "certifications", label: "الشهادات", sections: ["certifications"] },
  { id: "volunteering", label: "الأنشطة", sections: ["volunteering"] },
  { id: "review", label: "مراجعة الناقص" },
];

const ResumeSetupJourney = ({ resume, onChange, onAutosave, onBuild, building = false }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [highestReached, setHighestReached] = useState(0);
  const step = RESUME_SETUP_STEPS[stepIndex];
  const completion = useMemo(() => getResumeCompletionItems(resume), [resume]);
  const missing = completion.filter((item) => item.status !== "complete");

  const moveTo = async (nextIndex) => {
    const saved = await onAutosave?.(resume);
    if (saved === false) return;
    setStepIndex(nextIndex);
    setHighestReached((current) => Math.max(current, nextIndex));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <section className="resume-setup-journey" dir="rtl">
      <header className="resume-journey-section-head">
        <span className="resume-journey-eyebrow">إعداد السيرة لأول مرة</span>
        <h2>أكمل بيانات سيرتك قبل البناء</h2>
        <p>نحفظ ما تكتبه دون تشغيل الوكيل. لن تُبنى السيرة إلا عند ضغط «ابنِ سيرتي».</p>
      </header>

      <nav className="resume-facts-review-steps" aria-label="خطوات إعداد السيرة">
        {RESUME_SETUP_STEPS.map((candidate, index) => (
          <button
            type="button"
            key={candidate.id}
            className={index === stepIndex ? "is-current" : ""}
            disabled={index > highestReached + 1}
            onClick={() => index <= highestReached + 1 && moveTo(index)}
          >
            <span>{candidate.label}</span>
            {index < stepIndex ? <em className="is-complete"><FiCheck aria-hidden="true" /></em> : null}
          </button>
        ))}
      </nav>

      {step.id === "review" ? (
        <section className="resume-facts-review-status">
          <div>
            <strong>{missing.length ? `باقي ${missing.length} عناصر تحتاج مراجعة` : "بياناتك جاهزة للبناء ✓"}</strong>
            <span>{missing.length ? missing.map((item) => item.title).join(" · ") : "يمكنك الآن إنشاء السيرة من أحدث بياناتك المحفوظة."}</span>
          </div>
        </section>
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
        ) : <span />}
        {stepIndex < RESUME_SETUP_STEPS.length - 1 ? (
          <button type="button" className="is-primary" onClick={() => moveTo(stepIndex + 1)}>
            التالي <FiArrowLeft aria-hidden="true" />
          </button>
        ) : (
          <button type="button" className="is-primary" onClick={() => onBuild(resume)} disabled={building}>
            {building ? "جاري بناء السيرة..." : "ابنِ سيرتي"} <FiArrowLeft aria-hidden="true" />
          </button>
        )}
      </footer>
    </section>
  );
};

export default ResumeSetupJourney;
