import React, { useMemo, useState } from "react";
import {
  FiArrowLeft,
  FiArrowRight,
  FiBriefcase,
  FiCheckCircle,
  FiEdit3,
  FiFileText,
  FiLayers,
  FiUser,
} from "react-icons/fi";

const textAreaPlaceholder = `اكتب المعلومات مثل ما هي عندك، حتى لو كانت نقاط سريعة.
مثال:
- مشروع لوحة تحكم للمبيعات باستخدام React وPower BI
- تدريب صيفي في قسم تقنية المعلومات
- شهادة Excel من منصة كذا`;

const buildInitialRawInput = (resume = {}, sourceMode = "scratch") => {
  const personal = resume.personalInfo || {};
  const listToText = (items = [], formatter) =>
    (Array.isArray(items) ? items : [])
      .map(formatter)
      .filter(Boolean)
      .join("\n\n");

  return {
    sourceMode,
    basic: {
      language: resume.settings?.language === "en" ? "en" : "ar",
      fullName: personal.fullName || "",
      email: personal.email || "",
      phone: personal.phone || "",
      city: personal.city || "",
      major: personal.major || personal.headline || "",
      university: personal.university || "",
      targetTitle: personal.headline || "",
      linkedinUrl: personal.linkedinUrl || "",
      githubUrl: personal.githubUrl || "",
      portfolioUrl: personal.portfolioUrl || "",
    },
    educationText: listToText(resume.education, (item) =>
      [item.title, item.organization, item.period, item.description].filter(Boolean).join(" - ")
    ),
    experiencesText: listToText(resume.experience || resume.experiences, (item) =>
      [
        item.title,
        item.organization,
        item.period,
        item.location,
        item.description,
        ...(item.achievements || []).map((achievement) => achievement.text),
      ]
        .filter(Boolean)
        .join("\n")
    ),
    projectsText: listToText(resume.projects, (item) =>
      [
        item.title,
        item.subtitle,
        item.url,
        item.description,
        ...(item.achievements || []).map((achievement) => achievement.text),
      ]
        .filter(Boolean)
        .join("\n")
    ),
    skillsText: (resume.skills || []).join("، "),
    certificationsText: listToText(resume.certifications, (item) =>
      [item.title, item.organization, item.period, item.description].filter(Boolean).join(" - ")
    ),
    volunteeringText: listToText(resume.volunteering, (item) =>
      [
        item.title,
        item.organization,
        item.period,
        item.location,
        ...(item.achievements || []).map((achievement) => achievement.text),
      ]
        .filter(Boolean)
        .join("\n")
    ),
    languagesText: (resume.languages || [])
      .map((language) => [language.name, language.level].filter(Boolean).join(" - "))
      .filter(Boolean)
      .join("\n"),
    notesText: "",
  };
};

const steps = [
  {
    key: "basic",
    title: "بياناتك الأساسية",
    helper: "نحتاجها عشان نكتب رأس السيرة ونختار اللغة والأسلوب.",
    icon: FiUser,
  },
  {
    key: "education",
    title: "التعليم والهدف",
    helper: "اكتب الجامعة، التخصص، المعدل إذا تحب، والهدف التدريبي.",
    icon: FiFileText,
  },
  {
    key: "experience",
    title: "خبراتك وأنشطتك",
    helper: "أي تدريب، عمل جزئي، تطوع، نشاط أو مسؤولية جامعية.",
    icon: FiBriefcase,
  },
  {
    key: "projects",
    title: "مشاريعك ومهاراتك",
    helper: "المشاريع هي نقطة قوة الطلاب، حتى لو كانت مشاريع مواد.",
    icon: FiLayers,
  },
  {
    key: "extras",
    title: "الدورات واللغات",
    helper: "أي شهادة، دورة، لغة، روابط أو ملاحظة تساعدنا نرتب السيرة.",
    icon: FiEdit3,
  },
];

const ResumeAiWizard = ({
  initialResume,
  sourceMode = "scratch",
  isLoading = false,
  onGenerate,
  onCancel,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [rawInput, setRawInput] = useState(() => buildInitialRawInput(initialResume, sourceMode));

  const currentStep = steps[activeStep];
  const Icon = currentStep.icon;
  const canGenerate = useMemo(() => {
    const basic = rawInput.basic || {};
    return Boolean(
      basic.fullName?.trim() &&
        (basic.major?.trim() || basic.targetTitle?.trim()) &&
        (rawInput.educationText?.trim() ||
          rawInput.projectsText?.trim() ||
          rawInput.experiencesText?.trim() ||
          rawInput.skillsText?.trim())
    );
  }, [rawInput]);

  const updateBasic = (field, value) => {
    setRawInput((current) => ({
      ...current,
      basic: {
        ...(current.basic || {}),
        [field]: value,
      },
    }));
  };

  const updateField = (field, value) => {
    setRawInput((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const submit = () => {
    if (!canGenerate || isLoading) return;
    onGenerate?.({
      ...rawInput,
      sourceMode,
    });
  };

  return (
    <section className="resume-ai-shell" aria-labelledby="resume-ai-wizard-title">
      <div className="resume-ai-intro">
        <span className="resume-ai-badge">كاتب السيرة الذكي</span>
        <h2 id="resume-ai-wizard-title">خلّنا نكتب المسودة الأولى بدل ما تبدأ من صفحة فاضية.</h2>
        <p>
          اكتب معلوماتك بطريقتك، ودربك يحولها لمسودة مهنية قابلة للمراجعة والتعديل قبل
          الحفظ النهائي.
        </p>
      </div>

      <div className="resume-ai-layout">
        <aside className="resume-ai-steps" aria-label="خطوات كاتب السيرة">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            return (
              <button
                key={step.key}
                type="button"
                className={index === activeStep ? "is-active" : ""}
                onClick={() => setActiveStep(index)}
              >
                <StepIcon aria-hidden="true" />
                <span>{step.title}</span>
              </button>
            );
          })}
        </aside>

        <div className="resume-ai-panel">
          <div className="resume-ai-panel-head">
            <Icon aria-hidden="true" />
            <div>
              <h3>{currentStep.title}</h3>
              <p>{currentStep.helper}</p>
            </div>
          </div>

          {currentStep.key === "basic" && (
            <div className="resume-ai-form-grid">
              <label>
                لغة السيرة
                <select
                  value={rawInput.basic.language}
                  onChange={(event) => updateBasic("language", event.target.value)}
                >
                  <option value="ar">العربية</option>
                  <option value="en">English</option>
                </select>
              </label>
              <label>
                الاسم الكامل
                <input
                  value={rawInput.basic.fullName}
                  onChange={(event) => updateBasic("fullName", event.target.value)}
                  placeholder="مثال: ابتسام علي"
                />
              </label>
              <label>
                البريد الإلكتروني
                <input
                  value={rawInput.basic.email}
                  onChange={(event) => updateBasic("email", event.target.value)}
                  placeholder="name@example.com"
                />
              </label>
              <label>
                رقم التواصل
                <input
                  value={rawInput.basic.phone}
                  onChange={(event) => updateBasic("phone", event.target.value)}
                  placeholder="05xxxxxxxx"
                />
              </label>
              <label>
                المدينة
                <input
                  value={rawInput.basic.city}
                  onChange={(event) => updateBasic("city", event.target.value)}
                  placeholder="الرياض"
                />
              </label>
              <label>
                التخصص
                <input
                  value={rawInput.basic.major}
                  onChange={(event) => updateBasic("major", event.target.value)}
                  placeholder="نظم معلومات"
                />
              </label>
              <label>
                الجامعة
                <input
                  value={rawInput.basic.university}
                  onChange={(event) => updateBasic("university", event.target.value)}
                  placeholder="جامعة ..."
                />
              </label>
              <label className="resume-ai-wide">
                المسمى المستهدف في السيرة
                <input
                  value={rawInput.basic.targetTitle}
                  onChange={(event) => updateBasic("targetTitle", event.target.value)}
                  placeholder="مثال: متدرب نظم معلومات، محلل بيانات متدرب"
                />
              </label>
              <label>
                LinkedIn
                <input
                  value={rawInput.basic.linkedinUrl}
                  onChange={(event) => updateBasic("linkedinUrl", event.target.value)}
                  placeholder="https://linkedin.com/in/..."
                />
              </label>
              <label>
                GitHub أو رابط شخصي
                <input
                  value={rawInput.basic.githubUrl}
                  onChange={(event) => updateBasic("githubUrl", event.target.value)}
                  placeholder="اختياري"
                />
              </label>
            </div>
          )}

          {currentStep.key === "education" && (
            <div className="resume-ai-text-stack">
              <label>
                التعليم
                <textarea
                  rows={8}
                  value={rawInput.educationText}
                  onChange={(event) => updateField("educationText", event.target.value)}
                  placeholder="مثال: بكالوريوس نظم معلومات، جامعة الملك سعود، 2022 - حتى الآن، معدل ..."
                />
              </label>
              <label>
                ملاحظات عن هدفك التدريبي
                <textarea
                  rows={5}
                  value={rawInput.notesText}
                  onChange={(event) => updateField("notesText", event.target.value)}
                  placeholder="أي جهة أو مجال تستهدفه؟ أي شيء تبغى السيرة تبرزه؟"
                />
              </label>
            </div>
          )}

          {currentStep.key === "experience" && (
            <div className="resume-ai-text-stack">
              <label>
                الخبرات
                <textarea
                  rows={9}
                  value={rawInput.experiencesText}
                  onChange={(event) => updateField("experiencesText", event.target.value)}
                  placeholder={textAreaPlaceholder}
                />
              </label>
              <label>
                الأنشطة والتطوع
                <textarea
                  rows={6}
                  value={rawInput.volunteeringText}
                  onChange={(event) => updateField("volunteeringText", event.target.value)}
                  placeholder="مثال: عضوة في نادي التقنية، تنظيم فعالية، تطوع في ..."
                />
              </label>
            </div>
          )}

          {currentStep.key === "projects" && (
            <div className="resume-ai-text-stack">
              <label>
                المشاريع
                <textarea
                  rows={9}
                  value={rawInput.projectsText}
                  onChange={(event) => updateField("projectsText", event.target.value)}
                  placeholder={textAreaPlaceholder}
                />
              </label>
              <label>
                المهارات والأدوات
                <textarea
                  rows={5}
                  value={rawInput.skillsText}
                  onChange={(event) => updateField("skillsText", event.target.value)}
                  placeholder="مثال: Excel، Power BI، React، تحليل البيانات، كتابة التقارير"
                />
              </label>
            </div>
          )}

          {currentStep.key === "extras" && (
            <div className="resume-ai-text-stack">
              <label>
                الدورات والشهادات
                <textarea
                  rows={7}
                  value={rawInput.certificationsText}
                  onChange={(event) => updateField("certificationsText", event.target.value)}
                  placeholder="اسم الدورة، الجهة، التاريخ إن وجد"
                />
              </label>
              <label>
                اللغات
                <textarea
                  rows={4}
                  value={rawInput.languagesText}
                  onChange={(event) => updateField("languagesText", event.target.value)}
                  placeholder="العربية - ممتاز، الإنجليزية - متوسط"
                />
              </label>
            </div>
          )}

          <div className="resume-ai-actions">
            <button type="button" className="is-soft" onClick={onCancel} disabled={isLoading}>
              رجوع
            </button>
            <div>
              <button
                type="button"
                className="is-soft"
                onClick={() => setActiveStep((value) => Math.max(0, value - 1))}
                disabled={activeStep === 0 || isLoading}
              >
                <FiArrowRight aria-hidden="true" />
                السابق
              </button>
              {activeStep < steps.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setActiveStep((value) => Math.min(steps.length - 1, value + 1))}
                  disabled={isLoading}
                >
                  التالي
                  <FiArrowLeft aria-hidden="true" />
                </button>
              ) : (
                <button type="button" onClick={submit} disabled={!canGenerate || isLoading}>
                  <FiCheckCircle aria-hidden="true" />
                  {isLoading ? "نكتب المسودة..." : "ولّد مسودة السيرة"}
                </button>
              )}
            </div>
          </div>

          {!canGenerate && activeStep === steps.length - 1 && (
            <p className="resume-ai-hint">
              أضف الاسم والتخصص ومعلومة واحدة على الأقل عن تعليمك أو مشاريعك أو خبراتك حتى نكتب
              مسودة مفيدة.
            </p>
          )}
        </div>
      </div>
    </section>
  );
};

export default ResumeAiWizard;
