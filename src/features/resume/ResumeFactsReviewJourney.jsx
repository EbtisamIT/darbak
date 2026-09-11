import React, { useMemo } from "react";
import { FiArrowLeft, FiCheck, FiRefreshCw } from "react-icons/fi";
import ResumeBuilder from "./ResumeBuilder";
import { getResumeCompletionItems } from "./resumeValidation";

const STEPS = [
  ["personal", "بياناتك"],
  ["education", "التعليم"],
  ["experience", "الخبرات"],
  ["projects", "المشاريع"],
  ["skills", "المهارات"],
  ["certifications", "الشهادات"],
];

const sectionStatus = (resume, key) => {
  if (key === "personal") {
    const personal = resume.personalInfo || {};
    return personal.fullName && personal.email && personal.phone && personal.major ? "مكتمل" : "ناقص";
  }
  if (key === "experience") return (resume.experiences || resume.experience || []).length ? "مكتمل" : "ناقص";
  if (key === "skills") return (resume.skills || []).length ? "مكتمل" : "ناقص";
  if (key === "education") return (resume.education || []).length ? "مكتمل" : "ناقص";
  return (resume[key] || []).length ? "مكتمل" : "ناقص";
};

const ResumeFactsReviewJourney = ({ resume, freshness, onChange, onBack, onRebuild, rebuilding = false }) => {
  const completion = useMemo(() => getResumeCompletionItems(resume), [resume]);
  const missing = completion.filter((item) => item.status !== "complete").length;
  const changes = freshness?.changes || [];

  return (
    <section className="resume-facts-review-journey" dir="rtl">
      <header className="resume-journey-section-head">
        <span className="resume-journey-eyebrow">بيانات سيرتك</span>
        <h2>راجع بيانات سيرتك ثم حدّثها عندما تكون جاهزة</h2>
        <p>هذه البيانات تخص سيرتك فقط ولا تعدّل ملفك المهني. الحفظ التلقائي يحفظ ما تكتبه، ولن نشغّل كاتب السيرة إلا عندما تضغط زر التحديث.</p>
      </header>
      <nav className="resume-facts-review-steps" aria-label="خطوات مراجعة بيانات السيرة">
        {STEPS.map(([key, label]) => (
          <button type="button" key={key} onClick={() => document.getElementById(`resume-section-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            <span>{label}</span><em className={sectionStatus(resume, key) === "مكتمل" ? "is-complete" : "is-missing"}>{sectionStatus(resume, key)}</em>
          </button>
        ))}
      </nav>
      <section className={`resume-facts-review-status${freshness?.changed ? " is-changed" : ""}`}>
        {freshness?.changed ? <><FiRefreshCw aria-hidden="true" /><div><strong>{freshness.baselineMissing ? "راجع بياناتك قبل أول تحديث للسيرة" : `تم اكتشاف ${changes.length || 1} تغييرات`}</strong><span>{changes.length ? changes.join(" · ") : "تم تعديل بيانات السيرة منذ آخر بناء."}</span></div></> : <><FiCheck aria-hidden="true" /><div><strong>سيرتك محدثة ✓</strong><span>{missing ? `باقي ${missing} حقول ناقصة يمكنك مراجعتها لاحقًا.` : "لا توجد تغييرات جديدة تحتاج إعادة بناء."}</span></div></>}
      </section>
      <ResumeBuilder
        resume={resume}
        onChange={onChange}
        hideCompletedChecklist
        showStartOptions={false}
        showSettings={false}
        visibleSections={["education", "experience", "projects", "skills", "certifications", "volunteering"]}
      />
      <footer className="resume-journey-actions resume-facts-review-actions">
        <button type="button" className="is-secondary" onClick={onBack}>رجوع للوحة السيرة</button>
        {freshness?.changed && <button type="button" className="is-primary" onClick={onRebuild} disabled={rebuilding}>{rebuilding ? "جاري تحديث السيرة..." : "تحديث السيرة بهذه التغييرات"}<FiArrowLeft aria-hidden="true" /></button>}
      </footer>
    </section>
  );
};

export default ResumeFactsReviewJourney;
