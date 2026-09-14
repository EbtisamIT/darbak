import React, { useMemo } from "react";
import { FiArrowLeft } from "react-icons/fi";
import ResumeDataSimpleForm from "./ResumeDataSimpleForm";
import { getResumeCompletionItems } from "./resumeValidation";

export const RESUME_SETUP_STEPS = [
  { id: "personal", label: "بياناتك", target: "resume-data-personal" },
  { id: "education", label: "التعليم", target: "resume-section-education-facts" },
  { id: "experience", label: "الخبرات", target: "resume-data-experience" },
  { id: "projects", label: "المشاريع", target: "resume-data-projects" },
  { id: "skills", label: "المهارات", target: "resume-data-skills" },
  { id: "certifications", label: "الشهادات والدورات", target: "resume-data-certifications" },
  { id: "volunteering", label: "الأنشطة واللغات", target: "resume-data-volunteering" },
];

const countLabel = (count, singular, plural) => `${count} ${count === 1 ? singular : plural}`;

const ResumeSetupJourney = ({ resume, onChange, onAutosave, onBuild, building = false, mode = "setup", onExit }) => {
  const completion = useMemo(() => getResumeCompletionItems(resume), [resume]);
  const missing = completion.filter((item) => item.status !== "complete");
  const experience = resume.experience || resume.experiences || [];
  const isReviewMode = mode === "review";

  const finish = async () => {
    const saved = await onAutosave?.(resume);
    if (saved === false) return;
    onBuild(resume);
  };

  const jumpTo = (target) => {
    if (!target) return;
    document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="resume-setup-journey resume-data-v5" dir="rtl">
      <header className="resume-journey-section-head">
        <span className="resume-journey-eyebrow">{isReviewMode ? "تحديث بيانات السيرة" : "إعداد السيرة"}</span>
        <h2>{isReviewMode ? "راجع وحدّث بياناتك بسهولة" : "أدخل بياناتك، ودربك يكتب سيرتك"}</h2>
        <p>كل الأقسام أمامك في صفحة واحدة، ونحفظ تعديلاتك تلقائيًا. لن يعمل كاتب السيرة إلا بعد ضغط الزر الأخير.</p>
      </header>

      <nav className="resume-data-quick-nav" aria-label="أقسام بيانات السيرة">
        {RESUME_SETUP_STEPS.map((step) => <button type="button" key={step.id} onClick={() => jumpTo(step.target)}>{step.label}</button>)}
      </nav>

      <ResumeDataSimpleForm resume={resume} onChange={onChange} />

      <section className="resume-setup-review-summary">
        <header><strong>ملخص بياناتك</strong><span>راجع الأعداد بسرعة، ثم ابنِ أو حدّث المسودة.</span></header>
        <div className="resume-data-summary-grid">
          <span>{countLabel(experience.length, "خبرة", "خبرات")}</span>
          <span>{countLabel((resume.projects || []).length, "مشروع", "مشاريع")}</span>
          <span>{countLabel((resume.skills || []).length, "مهارة", "مهارات")}</span>
          <span>{countLabel((resume.certifications || []).length, "شهادة أو دورة", "شهادات ودورات")}</span>
        </div>
        <small>{missing.length ? `باقي ${missing.length} عناصر أساسية تحتاج مراجعة.` : "البيانات الأساسية جاهزة ✓"}</small>
      </section>

      <footer className="resume-journey-actions resume-data-final-actions">
        {isReviewMode ? <button type="button" className="is-secondary" onClick={onExit}>رجوع للوحة السيرة</button> : <span />}
        <button type="button" className="is-primary" onClick={finish} disabled={building}>
          {building ? (isReviewMode ? "جاري تحديث المسودة..." : "جاري بناء السيرة...") : isReviewMode ? "تحديث المسودة" : "ابنِ سيرتي"} <FiArrowLeft aria-hidden="true" />
        </button>
      </footer>
    </section>
  );
};

export default ResumeSetupJourney;
