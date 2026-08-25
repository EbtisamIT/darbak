import React from "react";
import {
  FiArrowLeft,
  FiCheck,
  FiFilePlus,
  FiPlayCircle,
} from "react-icons/fi";
import { ApplicationDetailsEditor, PersonalInfoEditor } from "./ResumeBuilder";

export const RESUME_JOURNEY_STEPS = [
  { id: "data", label: "بياناتك" },
  { id: "missing", label: "نكمل الناقص", shortLabel: "الناقص" },
  { id: "draft", label: "مسودتك الذكية", shortLabel: "المسودة" },
  { id: "polish", label: "لمساتك الأخيرة", shortLabel: "اللمسات" },
  { id: "ready", label: "جاهزة للتقديم", shortLabel: "جاهزة" },
];

const getStepIndex = (stepId) =>
  Math.max(0, RESUME_JOURNEY_STEPS.findIndex((step) => step.id === stepId));

export const ResumeJourneyStepper = ({ currentStep = "data", onStepChange }) => {
  const currentIndex = getStepIndex(currentStep);

  return (
    <nav className="resume-journey-stepper" aria-label="مراحل إنشاء السيرة">
      <div className="resume-journey-stepper-track" aria-hidden="true" />
      <div className="resume-journey-stepper-list">
        {RESUME_JOURNEY_STEPS.map((step, index) => {
          const complete = index < currentIndex;
          const current = index === currentIndex;
          const available = index <= currentIndex;
          return (
            <button
              type="button"
              key={step.id}
              className={`resume-journey-step${complete ? " is-complete" : ""}${
                current ? " is-current" : ""
              }`}
              onClick={() => available && onStepChange?.(step.id)}
              disabled={!available}
              aria-current={current ? "step" : undefined}
            >
              <span className="resume-journey-step-dot">
                {complete ? <FiCheck aria-hidden="true" /> : index + 1}
              </span>
              <span aria-label={step.label}>{step.shortLabel || step.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

const formatDate = (value) => {
  if (!value) return "غير محفوظة بعد";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "محفوظة مؤخرًا";
  return new Intl.DateTimeFormat("ar-SA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
};

const importedFields = (resume = {}) => {
  const personal = resume.personalInfo || {};
  return [
    ["الاسم", personal.fullName],
    ["البريد", personal.email],
    ["التخصص", personal.major || personal.headline],
    ["الجامعة", personal.university],
    ["المدينة", personal.city],
  ].filter(([, value]) => Boolean(value));
};

export const ResumeJourneyStart = ({
  resumeExists,
  resume,
  onPortfolio,
  onContinue,
  onScratch,
}) => {
  const personal = resume.personalInfo || {};
  const profileHighlights = [
    personal.fullName && "اسمك",
    (personal.major || personal.headline) && "تخصصك",
    personal.university && "جامعتك",
    (resume.skills || []).filter(Boolean).length && "مهاراتك",
    (resume.projects || []).filter((project) => project?.name || project?.title).length && "مشاريعك",
  ].filter(Boolean);
  const hasImportedData = profileHighlights.length > 0;

  return (
    <section className="resume-journey-screen resume-journey-start">
      <div className="resume-journey-intro">
        <span className="resume-journey-eyebrow">سيرتي بدربك · بداية ذكية</span>
        <h2>{hasImportedData ? "جهزنا لك بداية من بياناتك" : "خلّنا نجهّز الأساسيات أولًا"}</h2>
        <p>
          {hasImportedData
            ? `استخدمنا ${profileHighlights.join("، ")} من ملفك المهني وحسابك.`
            : "سنرتب المعلومات الموجودة في حسابك، ثم نطلب منك التفاصيل الضرورية فقط بدل نموذج طويل."}
        </p>
        <button type="button" className="resume-journey-primary-cta" onClick={onPortfolio}>
          راجع معلوماتي وكمل الناقص <FiArrowLeft aria-hidden="true" />
        </button>
      </div>

      {resumeExists && (
        <article className="resume-journey-saved-card is-secondary">
          <div>
            <span>سيرة محفوظة</span>
            <strong>{resume.personalInfo?.fullName || "سيرتك الأساسية"}</strong>
            <small>آخر تعديل: {formatDate(resume.updatedAt)}</small>
          </div>
          <button type="button" className="is-text" onClick={onContinue}>
            <FiPlayCircle aria-hidden="true" /> متابعة السيرة
          </button>
        </article>
      )}

      <div className="resume-journey-start-options">
        <button type="button" className="resume-journey-scratch-option" onClick={onScratch}>
          <FiFilePlus aria-hidden="true" />
          <span>تفضّل البداية اليدوية؟</span>
          <strong>ابدأ ببيانات فارغة</strong>
        </button>
      </div>
    </section>
  );
};

export const ResumeJourneyPersonal = ({
  resume,
  source = "portfolio",
  onChange,
  onContinue,
  onBack,
}) => {
  const fields = importedFields(resume);
  const missing = [
    ["رقم التواصل", resume.personalInfo?.phone],
    ["المسمى المهني", resume.personalInfo?.headline],
  ].filter(([, value]) => !value);

  return (
    <section className="resume-journey-screen resume-journey-personal">
      <header className="resume-journey-section-head">
        <span className="resume-journey-eyebrow">المرحلة الأولى من خمس</span>
        <h2>بياناتك في دربك</h2>
        <p>راجع المعلومات التي وجدناها. أي تعديل هنا يخص سيرتك فقط ولا يغيّر ملفك المهني.</p>
      </header>

      <div className="resume-journey-personal-summary">
        <article>
          <span>{source === "scratch" ? "بداية جديدة" : "تم الاستيراد"}</span>
          <strong>
            {source === "scratch"
              ? "تقدر تضيف معلوماتك هنا"
              : `${fields.length} معلومات جاهزة للمراجعة`}
          </strong>
          <p>
            {source === "scratch"
              ? "هذه البيانات تخص سيرتك فقط، ولن تعدّل ملفك المهني الأساسي."
              : "لن نغيّر ملفك المهني؛ أي تعديل هنا يخص سيرتك فقط."}
          </p>
        </article>
        <article>
          <span>المطلوب إكماله</span>
          <strong>
            {missing.length
              ? missing.map(([label]) => label).join("، ")
              : "معلوماتك الأساسية مكتملة"}
          </strong>
          <p>رقم التواصل والمسمى المهني يساعدان على اكتمال رأس السيرة.</p>
        </article>
      </div>

      <div className="resume-journey-personal-editor">
        <PersonalInfoEditor resume={resume} onChange={onChange} />
        <ApplicationDetailsEditor resume={resume} onChange={onChange} />
      </div>

      <footer className="resume-journey-actions">
        <button type="button" className="is-secondary" onClick={onBack}>
          رجوع
        </button>
        <button type="button" className="is-primary" onClick={onContinue}>
          متابعة للناقص <FiArrowLeft aria-hidden="true" />
        </button>
      </footer>
    </section>
  );
};

export const ResumeJourneyMissing = ({ resume, onChange, onBack, onContinue }) => {
  const personal = resume.personalInfo || {};
  const missing = [
    ["phone", "رقم التواصل", "05xxxxxxxx"],
    ["headline", "المسمى المهني", "مثال: متخصص/ة في نظم المعلومات"],
  ].filter(([field]) => !personal[field]);

  const updatePersonal = (field, value) =>
    onChange({
      ...resume,
      personalInfo: { ...personal, [field]: value },
    });

  return (
    <section className="resume-journey-screen resume-journey-missing">
      <header className="resume-journey-section-head">
        <span className="resume-journey-eyebrow">المرحلة الثانية من خمس</span>
        <h2>{missing.length ? "نكمل التفاصيل الصغيرة" : "أساسياتك مكتملة"}</h2>
        <p>
          {missing.length
            ? "نحتاج هذه المعلومات فقط حتى يكون رأس السيرة واضحًا وجاهزًا للتواصل."
            : "كل ما نحتاجه في هذه المرحلة موجود بالفعل في بياناتك."}
        </p>
      </header>

      <div className="resume-journey-missing-card">
        {missing.length ? (
          missing.map(([field, label, placeholder]) => (
            <label key={field}>
              <span>{label}</span>
              <input
                value={personal[field] || ""}
                onChange={(event) => updatePersonal(field, event.target.value)}
                placeholder={placeholder}
              />
            </label>
          ))
        ) : (
          <div className="resume-journey-complete-note">
            <FiCheck aria-hidden="true" />
            <div>
              <strong>معلومات التواصل والمسمى المهني جاهزة.</strong>
              <p>عند المتابعة سنستخدم هذه البيانات لإعداد مسودتك الذكية.</p>
            </div>
          </div>
        )}
      </div>

      <footer className="resume-journey-actions">
        <button type="button" className="is-secondary" onClick={onBack}>
          رجوع
        </button>
        <button type="button" className="is-primary" onClick={onContinue}>
          {missing.length ? "حفظ والمتابعة للمسودة" : "إنشاء المسودة الذكية"}
          {missing.length ? <FiCheck aria-hidden="true" /> : <FiArrowLeft aria-hidden="true" />}
        </button>
      </footer>
    </section>
  );
};
