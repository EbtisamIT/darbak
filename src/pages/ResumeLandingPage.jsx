import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import ResumePreview from "../features/resume/ResumePreview";
import { hasResumeAccessPass, PREMIUM_STATUS_EVENT, startSubscriptionFlow } from "../utils/premiumAccess";
import { setPageSeo } from "../utils/seoMetadata";
import { trackEvent } from "../utils/analytics";
import {
  getResumeDiscoveryAttribution,
  setResumeDiscoveryAttribution,
  trackResumeDiscovery,
} from "../utils/resumeDiscovery";
import { getDemoResume } from "./resumeLandingDemo";
import useResumeDiscoveryAccess from "../utils/useResumeDiscoveryAccess";
import "./ResumeLandingPage.css";

const templates = [
  { id: "ats-classic", name: "Darbak ATS Classic", description: "بنية أحادية العمود وتسلسل قراءة واضح لأنظمة ATS." },
  { id: "formal", name: "Darbak Professional", description: "القالب الرسمي الموجود في دربك، بهيئة مهنية هادئة." },
];

const decisions = [
  { title: "أبرز أقوى الأدلة", text: "مشروع لوحة المبيعات مرتبط بتحليل البيانات، لذلك يظهر قبل مشروع الحجز الأقل صلة بهذه الفرصة." },
  { title: "حوّل الوصف إلى نقاط مهنية", before: "سويت داشبورد للمبيعات", after: "حللت بيانات المبيعات الشهرية وصممت لوحة مؤشرات لمقارنة أداء الفروع والمنتجات." },
  { title: "رتب المهارات حسب الاستخدام", text: "Power BI وExcel وSQL تتقدم لأنها مدعومة بالمشاريع والخبرة، لا لأنها أُضيفت من عندنا." },
  { title: "ما اخترع معلومات", text: "لا يضيف نسبًا أو أرقامًا أو أدوات لم تذكرها الطالبة في بياناتها." },
];

const atsPoints = [
  "قالب أحادي العمود وعناوين أقسام قياسية",
  "النص قابل للاستخراج والنسخ، وبيانات التواصل داخل جسم السيرة",
  "بدون جداول أو أعمدة جانبية معقدة؛ المهارات والنقاط نصية",
  "اختبارات استخراج PDF بالعربي والإنجليزي",
];

const steps = [
  "تدخل معلوماتك الحقيقية مرة واحدة",
  "تراجع الصياغة المهنية وتعدلها",
  "تبني سيرة عربية ونسخة إنجليزية مستقلة",
  "تختار القالب المناسب",
  "تخصص نسخة لفرصة من معلوماتك الموجودة",
  "تنزل PDF وملف تقديمك",
];

const included = [
  "سيرة عربية ونسخة إنجليزية مستقلة",
  "قالب ATS Classic والقالب الرسمي Professional",
  "صياغة النبذة والخبرات والمشاريع",
  "مراجعة بياناتك وتعديلها",
  "PDF جاهز للتقديم",
  "تخصيص السيرة للفرص مع خطاب ورسالة تقديم عند توفر بياناتهما",
];

const questions = [
  ["هل السيرة في دربك ATS؟", "قوالب دربك مصممة لتكون سهلة القراءة لأنظمة ATS، ونختبر استخراج النص وترتيب الأقسام بالعربي والإنجليزي. تختلف الأنظمة بين الجهات، لذلك ما نضمن درجة موحدة أو قبولًا مضمونًا."],
  ["هل دربك يكتب معلومات من عنده؟", "لا. يعتمد على المعلومات التي تدخلها أنت ويعيد صياغتها بشكل مهني فقط."],
  ["هل أقدر أعدل السيرة؟", "نعم، تقدر تراجع وتعدل بياناتك قبل وبعد بناء السيرة."],
  ["هل فيه نسخة إنجليزية؟", "نعم، تقدر تنشئ نسخة إنجليزية مستقلة ومراجعتها قبل التنزيل."],
  ["وش يعني تخصيص السيرة لفرصة؟", "نبرز الخبرات والمشاريع والمهارات الموجودة في سيرتك والأقرب لمتطلبات الفرصة، من دون إضافة حقائق جديدة."],
];

const outputTabs = [
  { id: "resume", label: "السيرة المخصصة" },
  { id: "letter", label: "Cover Letter" },
  { id: "email", label: "رسالة التقديم" },
];

function LanguageSwitch({ language, onChange, label }) {
  return (
    <div className="resume-landing-language-switch" role="group" aria-label={label}>
      <button type="button" className={language === "ar" ? "is-active" : ""} aria-pressed={language === "ar"} onClick={() => onChange("ar")}>العربية</button>
      <button type="button" className={language === "en" ? "is-active" : ""} aria-pressed={language === "en"} onClick={() => onChange("en")}>English</button>
    </div>
  );
}

function TailoredOutput({ tab }) {
  if (tab === "letter") return (
    <div className="resume-landing-output-copy">
      <strong>خطاب تقديم — مثال توضيحي</strong>
      <p>فريق التوظيف المحترم،</p>
      <p>أتقدم لفرصة التدريب التعاوني في تحليل الأعمال. أنا طالبة نظم معلومات في مسار تحليل الأعمال، واستخدمت Power BI وExcel في مشروع لوحة متابعة أداء المبيعات. خلال تدريبي وثقت متطلبات مستخدمين ونظمتها لفريق التطوير، وأتطلع لتطبيق هذه الخبرة مع فريقكم.</p>
      <p>مع خالص التحية،<br />سارة أحمد</p>
      <small>خطاب مهني للجهة، وليس خطاب التدريب الرسمي من الجامعة.</small>
    </div>
  );
  if (tab === "email") return (
    <div className="resume-landing-output-copy">
      <strong>رسالة الإيميل — مثال توضيحي</strong>
      <p><b>الموضوع:</b> التقديم على تدريب تعاوني — Business Analyst</p>
      <p>مرحبًا فريق التوظيف،</p>
      <p>أرغب بالتقديم على فرصة التدريب التعاوني في تحليل الأعمال. أرفقت سيرتي المخصصة وخطاب التقديم؛ لدي مشروع في تحليل بيانات المبيعات باستخدام Power BI وExcel، وتجربة في توثيق متطلبات المستخدمين.</p>
      <p>شكرًا لوقتكم،<br />سارة أحمد</p>
      <small>قد يطلب المنتج تفاصيل إضافية قبل تجهيز رسالة الإيميل الفعلية.</small>
    </div>
  );
  return (
    <div className="resume-landing-output-copy">
      <strong>ما الذي تغيّر في النسخة المخصصة؟</strong>
      <p>النبذة تبرز تحليل الأعمال وتوثيق المتطلبات. مشروع لوحة المبيعات يظهر أولًا، وتتقدم المهارات المرتبطة بالفرصة.</p>
      <p className="resume-landing-highlight-list">Business Analysis <span>•</span> Requirements Gathering <span>•</span> Power BI <span>•</span> Excel <span>•</span> SQL</p>
      <small>كلها مستندة إلى بيانات المثال الأصلية؛ لم تُضَف خبرة أو مهارة جديدة.</small>
    </div>
  );
}

export default function ResumeLandingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const resumeDiscovery = useResumeDiscoveryAccess();
  const [language, setLanguage] = useState("ar");
  const [activeTemplate, setActiveTemplate] = useState("ats-classic");
  const [tailored, setTailored] = useState(false);
  const [outputTab, setOutputTab] = useState("resume");
  const [hasResumeAccess, setHasResumeAccess] = useState(() => hasResumeAccessPass());
  const demoRef = useRef(null);
  const templateRef = useRef(null);
  const routeSource = new URLSearchParams(location.search).get("source");
  const storedSource = getResumeDiscoveryAttribution().source;
  const attributionSource = routeSource === "subscription_page" && storedSource
    ? storedSource
    : routeSource || storedSource;
  const resumeTarget = hasResumeAccess
    ? "/my-resume"
    : `/subscribe?plan=darbak_resume&source=${encodeURIComponent(attributionSource ? `resume-${attributionSource}` : "resume-landing")}`;
  const ctaLabel = hasResumeAccess ? resumeDiscovery.hasMaster ? "افتح سيرتي" : "ابدأ بناء سيرتي" : "ابدأ بناء سيرتي";

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const entrySource = params.get("source");
    if (entrySource && !(entrySource === "subscription_page" && getResumeDiscoveryAttribution().source)) setResumeDiscoveryAttribution({
      source: entrySource,
      pageContext: params.get("pageContext") || "resume_landing",
      opportunityId: params.get("opportunityId") || "",
    });
    setPageSeo({
      title: "سيرتي بدربك | سيرة عربية وإنجليزية محسنة للـ ATS",
      description: "ابنِ سيرتك الذاتية بالعربي والإنجليزي في دربك، بصياغة مهنية وقوالب واضحة ومصممة لتكون سهلة القراءة بواسطة أنظمة ATS.",
      path: "/resume",
    });
    const attribution = getResumeDiscoveryAttribution();
    trackResumeDiscovery("resume_landing_view", {
      source: attribution.source || "resume_landing", pageContext: "resume_landing",
      opportunityId: attribution.opportunityId || "",
      userState: hasResumeAccessPass() ? "resume_subscriber" : "non_subscriber",
    });
    const refreshAccess = () => setHasResumeAccess(hasResumeAccessPass());
    window.addEventListener("focus", refreshAccess);
    window.addEventListener("storage", refreshAccess);
    window.addEventListener(PREMIUM_STATUS_EVENT, refreshAccess);
    return () => {
      window.removeEventListener("focus", refreshAccess);
      window.removeEventListener("storage", refreshAccess);
      window.removeEventListener(PREMIUM_STATUS_EVENT, refreshAccess);
    };
  }, [location.search]);

  const trackCta = (placement) => trackResumeDiscovery("resume_cta_clicked", {
    placement, subscriber: hasResumeAccess, userState: hasResumeAccess ? "resume_subscriber" : "non_subscriber",
    pageContext: "resume_landing", planId: "darbak_resume",
  });
  const showDemo = () => {
    trackResumeDiscovery("resume_example_clicked", { placement: "hero", pageContext: "resume_landing" });
    demoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const showTemplate = (template) => {
    setActiveTemplate(template);
    trackResumeDiscovery("resume_example_clicked", { template, placement: "template_card", pageContext: "resume_landing" });
    templateRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const changeLanguage = (nextLanguage) => {
    setLanguage(nextLanguage);
    trackEvent("resume_demo_language_selected", { metadata: { language: nextLanguage } });
  };
  const startTailoringDemo = () => {
    setTailored(true);
    setOutputTab("resume");
    trackResumeDiscovery("resume_tailoring_demo_clicked", { pageContext: "resume_landing" });
  };

  return (
    <main className="resume-landing" dir="rtl">
      <section className="resume-landing-hero">
        <div className="resume-landing-hero-copy">
          <span className="resume-landing-eyebrow">سيرتي بدربك <span aria-hidden="true">✦</span></span>
          <h1>سيرتك تستحق أكثر من قالب جاهز.</h1>
          <p>دربك يبني سيرتك من معلوماتك الحقيقية، يصيغها مهنيًا، ويعطيك نسخة عربية وإنجليزية قابلة للتخصيص لكل فرصة تقدم عليها.</p>
          <div className="resume-landing-badges"><span>عربي + إنجليزي</span><span>ATS-friendly</span><span>قابلة للتخصيص للفرص</span><span>PDF جاهز</span></div>
          <div className="resume-landing-actions">
            <Link className="resume-landing-button resume-landing-button-primary" to={resumeTarget} onClick={(event) => {
              trackCta("hero");
              if (!hasResumeAccess) {
                event.preventDefault();
                startSubscriptionFlow({ planId: "darbak_resume", source: attributionSource ? `resume-${attributionSource}` : "resume-landing", returnTo: "/my-resume", navigate });
              }
            }}>{ctaLabel}</Link>
            <button className="resume-landing-button resume-landing-button-secondary" type="button" onClick={showDemo}>شاهد كيف يشتغل دربك</button>
          </div>
          <small>خصص نفس سيرتك لكل فرصة بدون تغيير حقائقك أو اختراع معلومات.</small>
        </div>
        <div className="resume-landing-hero-art" aria-hidden="true">
          <div className="resume-landing-art-sheet"><i /><i /><i /><b /><i /><i /><b /><i /><i /><i /></div>
          <span className="resume-landing-art-label">من معلوماتك إلى سيرة مرتبة</span>
        </div>
      </section>

      <section className="resume-landing-section" aria-labelledby="resume-demo-title" id="resume-demo" ref={demoRef}>
        <div className="resume-landing-section-heading"><span>مثال توضيحي ببيانات افتراضية</span><h2 id="resume-demo-title">شوف النتيجة بلغتين، بنفس الحقائق</h2><p>سارة أحمد شخصية افتراضية. النموذج غني لتشوف النبذة والخبرة والمشاريع والشهادات والأنشطة كما تظهر في القالب الفعلي.</p></div>
        <LanguageSwitch language={language} onChange={changeLanguage} label="لغة نموذج السيرة" />
        <div className="resume-landing-full-preview resume-landing-demo-preview">
          <div className="resume-landing-preview-heading"><div><span>مثال توضيحي — ليس سيرة طالب حقيقي</span><h3>{language === "ar" ? "سيرة سارة أحمد" : "Sara Ahmed's Resume"}</h3></div><span>نفس الخبرة والمشاريع باللغتين</span></div>
          <div className="resume-landing-preview-paper"><ResumePreview resume={getDemoResume(language, "ats-classic")} showPageEstimate={false} /></div>
        </div>
      </section>

      <section className="resume-landing-section" aria-labelledby="resume-decisions-title">
        <div className="resume-landing-section-heading"><span>قرار مفهوم، مو صندوق أسود</span><h2 id="resume-decisions-title">كيف يحسن دربك سيرتك؟</h2><p>هذه أمثلة مبسطة على قرارات صياغة وترتيب يمكن للطالب مراجعتها، وليست كشفًا لتفكير الوكيل الداخلي.</p></div>
        <div className="resume-landing-decisions">{decisions.map((decision, index) => <article key={decision.title}><span>0{index + 1}</span><h3>{decision.title}</h3>{decision.text && <p>{decision.text}</p>}{decision.before && <div className="resume-landing-before-after"><p><small>قبل</small>{decision.before}</p><p><small>بعد</small>{decision.after}</p></div>}</article>)}</div>
      </section>

      <section className="resume-landing-section" aria-labelledby="resume-tailor-title">
        <div className="resume-landing-section-heading"><span>نفس الحقائق، إبراز مختلف</span><h2 id="resume-tailor-title">نفس سيرتك، لكن أذكى لكل فرصة</h2><p>هذا عرض تفاعلي ثابت يوضح الفكرة؛ الضغط هنا لا يشغّل الوكيل ولا يحفظ شيئًا في حسابك.</p></div>
        <div className="resume-landing-tailor-grid">
          <article className="resume-landing-job"><span>فرصة افتراضية</span><h3>COOP — Business Analyst</h3><p>المهارات المطلوبة في مثال الفرصة:</p><div className="resume-landing-job-skills">{["Business Analysis", "Excel", "Power BI", "SQL", "Requirements Gathering"].map((skill) => <span key={skill}>{skill}</span>)}</div><button type="button" onClick={startTailoringDemo}>{tailored ? "شاهد التخصيص مرة أخرى" : "خصص سيرتي لهذه الفرصة"}</button></article>
          <div className="resume-landing-tailor-comparison" aria-live="polite">
            <article><span>قبل التخصيص</span><h3>سيرة نظم معلومات عامة</h3><p>طالبة نظم معلومات في مسار تحليل الأعمال، لديها مشروع في تحليل بيانات المبيعات وخبرة في إعداد التقارير.</p><small>Power BI · Excel · SQL · Figma · Data Analysis</small></article>
            {tailored && <article className="is-tailored"><span>بعد التخصيص — مثال توضيحي</span><h3>الأقرب لفرصة تحليل الأعمال</h3><p>طالبة نظم معلومات في مسار تحليل الأعمال. حللت بيانات المبيعات باستخدام Power BI وExcel، ووثقت متطلبات مستخدمين خلال التدريب.</p><small>Business Analysis · Requirements Gathering · Power BI · Excel · SQL</small></article>}
          </div>
        </div>
        {tailored && <div className="resume-landing-results"><div className="resume-landing-result-tabs" role="tablist" aria-label="مخرجات التخصيص">{outputTabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={outputTab === tab.id} onClick={() => setOutputTab(tab.id)}>{tab.label}</button>)}</div><div role="tabpanel"><TailoredOutput tab={outputTab} /></div></div>}
        <p className="resume-landing-tailor-note">دربك يعيد ترتيب وإبراز معلوماتك الموجودة فقط — ما يخترع خبرة أو مهارات جديدة. مخرجات هذا القسم أمثلة توضيحية، وليست ملفات منشأة لحسابك.</p>
      </section>

      <section className="resume-landing-section" aria-labelledby="resume-templates-title">
        <div className="resume-landing-section-heading"><span>قوالب دربك الحالية</span><h2 id="resume-templates-title">اختر الشكل اللي يناسبك</h2><p>معاينات من القالبين الفعليين ببيانات سارة الافتراضية نفسها، وليست تصميمات جديدة.</p></div>
        <div className="resume-landing-template-grid">{templates.map((template) => <article className="resume-landing-template" key={template.id}><div className="resume-landing-template-window" aria-hidden="true"><div className="resume-landing-template-scaled"><ResumePreview resume={getDemoResume(language, template.id)} showPageEstimate={false} /></div></div><div className="resume-landing-template-info"><div><h3>{template.name}</h3><p>{template.description}</p></div><button type="button" onClick={() => showTemplate(template.id)}>معاينة <span aria-hidden="true">↖</span></button></div></article>)}</div>
        <div className="resume-landing-full-preview" id="resume-example-preview" ref={templateRef}><div className="resume-landing-preview-heading"><div><span>مثال توضيحي — القالب الفعلي</span><h3>{templates.find((template) => template.id === activeTemplate)?.name}</h3></div><LanguageSwitch language={language} onChange={changeLanguage} label="لغة معاينة القالب" /></div><div className="resume-landing-preview-paper"><ResumePreview resume={getDemoResume(language, activeTemplate)} showPageEstimate={false} /></div></div>
      </section>

      <section className="resume-landing-section resume-landing-ats" aria-labelledby="resume-ats-title"><div className="resume-landing-section-heading"><span>فحص حقيقي لقالب ATS Classic</span><h2 id="resume-ats-title">مو بس شكله مرتب — اختبرناه تقنيًا</h2><p>نتائج عينة اختبار PDF الموجودة في المشروع، وليست درجة ATS خارجية.</p></div><div className="resume-landing-ats-layout"><ul>{atsPoints.map((point) => <li key={point}><span aria-hidden="true">✓</span>{point}</li>)}</ul><div className="resume-landing-proof"><span>فحص القالب في دربك</span><h3>النص يبقى نصًا، مو صورة</h3><p>في عينة الاختبار الحالية:</p><div><span>استخراج النص العربي</span><strong>PASS</strong></div><div><span>استخراج النص الإنجليزي</span><strong>PASS</strong></div><div><span>ترتيب الأقسام</span><strong>PASS</strong></div><div><span>نصوص مفقودة</span><strong>0</strong></div><div><span>نصوص مكررة</span><strong>0</strong></div></div></div><p className="resume-landing-disclaimer">أنظمة ATS تختلف بين الجهات، لذلك ما نضمن درجة موحدة أو قبولًا مضمونًا. قوالبنا مبنية لتكون واضحة وقابلة لاستخراج النص آليًا وفق اختبارات دربك.</p></section>

      <section className="resume-landing-section" aria-labelledby="resume-steps-title"><div className="resume-landing-section-heading"><span>من البداية إلى التقديم</span><h2 id="resume-steps-title">كيف تبدأ؟</h2><p>بعد الاشتراك تدخل بياناتك، تراجع المسودة، ثم تختار نسختك وقالبك قبل تنزيل PDF أو تجهيز تقديم مخصص.</p></div><ol className="resume-landing-steps">{steps.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, "0")}</span><p>{step}</p></li>)}</ol></section>

      <section className="resume-landing-section" aria-labelledby="resume-included-title"><div className="resume-landing-section-heading"><span>كل أدوات السيرة في مكان واحد</span><h2 id="resume-included-title">وش يشمل سيرتي بدربك؟</h2></div><ul className="resume-landing-included">{included.map((item) => <li key={item}><span aria-hidden="true">✓</span>{item}</li>)}</ul></section>

      <section className="resume-landing-section resume-landing-faq" aria-labelledby="resume-faq-title"><div className="resume-landing-section-heading"><span>عندك سؤال؟</span><h2 id="resume-faq-title">إجابات سريعة وواضحة</h2></div><div>{questions.map(([question, answer], index) => <details key={question}><summary onClick={(event) => { if (!event.currentTarget.parentElement.open) trackEvent("resume_faq_opened", { metadata: { questionIndex: index } }); }}>{question}</summary><p>{answer}</p></details>)}</div></section>

      <section className="resume-landing-final"><span>الخطوة الجاية تبدأ منك</span><h2>جاهز تبدأ سيرتك؟</h2><p>معلوماتك الحقيقية، بصياغة مهنية ونسخ يمكن تخصيصها لكل فرصة.</p><Link className="resume-landing-button resume-landing-button-primary" to={resumeTarget} onClick={(event) => {
        trackCta("final");
        if (!hasResumeAccess) {
          event.preventDefault();
          startSubscriptionFlow({ planId: "darbak_resume", source: attributionSource ? `resume-${attributionSource}` : "resume-landing", returnTo: "/my-resume", navigate });
        }
      }}>{ctaLabel}</Link>{hasResumeAccess && resumeDiscovery.hasMaster && <Link className="resume-landing-final-tailor" to="/my-resume/tailor" onClick={() => trackCta("final_tailor")}>سيرتك جاهزة؟ خصصها لفرصة</Link>}</section>
    </main>
  );
}
