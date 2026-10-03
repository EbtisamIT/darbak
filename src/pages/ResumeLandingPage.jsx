import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ResumePreview from "../features/resume/ResumePreview";
import { hasResumeAccessPass } from "../utils/premiumAccess";
import { setPageSeo } from "../utils/seoMetadata";
import { trackEvent } from "../utils/analytics";
import "./ResumeLandingPage.css";

const exampleResume = {
  personalInfo: {
    fullName: "سارة أحمد",
    headline: "طالبة نظم معلومات",
    email: "sara@example.com",
    phone: "05xxxxxxxx",
    city: "الرياض",
  },
  summary: "طالبة نظم معلومات مهتمة بتحليل البيانات وتطوير حلول رقمية. طبقت مهاراتي في مشروع جامعي لتنظيم بيانات المبيعات وعرضها بوضوح.",
  education: [{ id: "education-example", title: "بكالوريوس نظم المعلومات", organization: "جامعة مثال", location: "الرياض", period: "التخرج المتوقع 2027" }],
  experience: [],
  projects: [{ id: "project-example", title: "لوحة تحليل المبيعات", description: "نظمت بيانات مشروع جامعي وصممت لوحة تعرض المؤشرات الأساسية.", tools: ["Power BI", "Excel"] }],
  skills: ["تحليل البيانات", "Power BI", "Microsoft Excel", "التواصل"],
  certifications: [],
  volunteering: [],
  languages: [{ id: "arabic-example", name: "العربية", level: "اللغة الأم" }, { id: "english-example", name: "الإنجليزية", level: "متقدم" }],
  settings: { language: "ar", direction: "rtl", template: "ats-classic", density: "comfortable", fontSize: "medium" },
};

const templates = [
  { id: "ats-classic", name: "Darbak ATS Classic", description: "بنية أحادية العمود ونص واضح بتسلسل قراءة خطي." },
  { id: "formal", name: "Darbak Professional", description: "القالب الرسمي الموجود في دربك، بتفاصيل هادئة ولمسة مهنية." },
];

const atsPoints = [
  "قالب أحادي العمود",
  "عناوين أقسام قياسية",
  "نص قابل للاستخراج والنسخ",
  "بيانات التواصل داخل جسم السيرة",
  "بدون جداول أو أعمدة جانبية معقدة",
  "مهارات ونقاط بصيغة نصية",
  "اختبارات استخراج PDF بالعربي والإنجليزي",
];

const steps = [
  "تدخل معلوماتك مرة واحدة",
  "دربك يرتب ويصيغ المحتوى بشكل مهني",
  "تبني نسخة عربية",
  "تنشئ نسخة إنجليزية مستقلة",
  "تختار القالب المناسب",
  "تنزل PDF جاهز للتقديم",
];

const included = [
  "سيرة عربية ونسخة إنجليزية مستقلة",
  "قالب ATS Classic والقالب الرسمي Professional",
  "صياغة النبذة والخبرات والمشاريع",
  "مراجعة بياناتك وتعديلها",
  "PDF جاهز للتقديم",
  "تخصيص السيرة لفرص التدريب",
];

const questions = [
  ["هل السيرة في دربك ATS؟", "قوالب دربك مصممة لتكون سهلة القراءة لأنظمة ATS، ونختبر استخراج النص وترتيب الأقسام بالعربي والإنجليزي. تختلف الأنظمة بين الجهات، لذلك ما نضمن درجة موحدة أو قبولًا مضمونًا."],
  ["هل دربك يكتب معلومات من عنده؟", "لا. يعتمد على المعلومات التي تدخلها أنت ويعيد صياغتها بشكل مهني فقط."],
  ["هل أقدر أعدل السيرة؟", "نعم، تقدر تراجع وتعدل بياناتك قبل وبعد بناء السيرة."],
  ["هل فيه نسخة إنجليزية؟", "نعم، تقدر تنشئ نسخة إنجليزية مستقلة ومراجعتها قبل التنزيل."],
];

export default function ResumeLandingPage() {
  const [activeTemplate, setActiveTemplate] = useState("ats-classic");
  const [hasResumeAccess, setHasResumeAccess] = useState(() => hasResumeAccessPass());
  const previewRef = useRef(null);
  const resumeTarget = hasResumeAccess ? "/my-resume" : "/subscribe?plan=darbak_resume&source=resume-landing";

  useEffect(() => {
    setPageSeo({
      title: "سيرتي بدربك | سيرة عربية وإنجليزية محسنة للـ ATS",
      description: "ابنِ سيرتك الذاتية بالعربي والإنجليزي في دربك، بصياغة مهنية وقوالب واضحة ومصممة لتكون سهلة القراءة بواسطة أنظمة ATS.",
      path: "/resume",
    });
    trackEvent("resume_landing_view");
    const refreshAccess = () => setHasResumeAccess(hasResumeAccessPass());
    window.addEventListener("focus", refreshAccess);
    window.addEventListener("storage", refreshAccess);
    return () => {
      window.removeEventListener("focus", refreshAccess);
      window.removeEventListener("storage", refreshAccess);
    };
  }, []);

  const trackCta = (placement) => trackEvent("resume_cta_clicked", { metadata: { placement } });
  const showExample = (template, placement) => {
    setActiveTemplate(template);
    trackEvent("resume_example_clicked", { metadata: { template, placement } });
    previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="resume-landing" dir="rtl">
      <section className="resume-landing-hero">
        <div className="resume-landing-hero-copy">
          <span className="resume-landing-eyebrow">سيرتي بدربك <span aria-hidden="true">✦</span></span>
          <h1>سيرتك تستحق أكثر من قالب جاهز.</h1>
          <p>دربك يبني سيرتك من معلوماتك الحقيقية، يرتبها ويصيغها مهنيًا، ويعطيك نسخة عربية وإنجليزية بقوالب مصممة لتكون واضحة لأنظمة ATS.</p>
          <div className="resume-landing-actions">
            <Link className="resume-landing-button resume-landing-button-primary" to={resumeTarget} onClick={() => trackCta("hero")}>ابدأ بناء سيرتي</Link>
            <button className="resume-landing-button resume-landing-button-secondary" type="button" onClick={() => showExample("ats-classic", "hero")}>شاهد نموذج حقيقي</button>
          </div>
          <small>بدون اختراع معلومات • تقدر تعدل كل شيء • PDF جاهز للتقديم</small>
        </div>
        <div className="resume-landing-hero-art" aria-hidden="true">
          <div className="resume-landing-art-sheet"><i /><i /><i /><b /><i /><i /><b /><i /><i /><i /></div>
          <span className="resume-landing-art-label">من معلوماتك إلى سيرة مرتبة</span>
        </div>
      </section>

      <section className="resume-landing-section" aria-labelledby="resume-templates-title">
        <div className="resume-landing-section-heading"><span>الناتج النهائي</span><h2 id="resume-templates-title">شوف كيف بتطلع سيرتك</h2><p>معاينة من قوالب دربك الفعلية ببيانات توضيحية، وليست سيرة طالب حقيقي.</p></div>
        <div className="resume-landing-template-grid">
          {templates.map((template) => (
            <article className="resume-landing-template" key={template.id}>
              <div className="resume-landing-template-window" aria-hidden="true"><div className="resume-landing-template-scaled"><ResumePreview resume={{ ...exampleResume, settings: { ...exampleResume.settings, template: template.id } }} showPageEstimate={false} /></div></div>
              <div className="resume-landing-template-info"><div><h3>{template.name}</h3><p>{template.description}</p></div><button type="button" onClick={() => showExample(template.id, "template_card")}>معاينة <span aria-hidden="true">↖</span></button></div>
            </article>
          ))}
        </div>
        <div className="resume-landing-full-preview" id="resume-example-preview" ref={previewRef}>
          <div className="resume-landing-preview-heading"><div><span>نموذج توضيحي</span><h3>{templates.find((template) => template.id === activeTemplate)?.name}</h3></div><span>القالب الفعلي • معلومات افتراضية</span></div>
          <div className="resume-landing-preview-paper"><ResumePreview resume={{ ...exampleResume, settings: { ...exampleResume.settings, template: activeTemplate } }} showPageEstimate={false} /></div>
        </div>
      </section>

      <section className="resume-landing-section resume-landing-ats" aria-labelledby="resume-ats-title">
        <div className="resume-landing-section-heading"><span>وضوح يمكن اختباره</span><h2 id="resume-ats-title">ليش نقول إنها محسنة للـ ATS؟</h2><p>تصميم السيرة يساعد برامج القراءة الآلية والبشر يلقون المعلومات بتسلسل واضح.</p></div>
        <div className="resume-landing-ats-layout"><ul>{atsPoints.map((point) => <li key={point}><span aria-hidden="true">✓</span>{point}</li>)}</ul><div className="resume-landing-proof"><span>فحص القالب في دربك</span><h3>النص يبقى نصًا، مو صورة</h3><p>اختبارات استخراج PDF الحالية لعينة ATS Classic:</p><div><span>استخراج النص العربي</span><strong>PASS</strong></div><div><span>استخراج النص الإنجليزي</span><strong>PASS</strong></div><div><span>ترتيب الأقسام</span><strong>PASS</strong></div><div><span>نصوص مفقودة أو مكررة في العينة</span><strong>0</strong></div></div></div>
        <p className="resume-landing-disclaimer">تختلف أنظمة ATS بين الشركات والمنصات، لذلك ما نعدك بدرجة موحدة أو قبول مضمون. هدفنا أن تكون سيرتك منظمة، قابلة للقراءة آليًا، ومبنية بدون عناصر تصميم قد تعيق استخراج النص.</p>
      </section>

      <section className="resume-landing-section" aria-labelledby="resume-steps-title"><div className="resume-landing-section-heading"><span>رحلة بسيطة</span><h2 id="resume-steps-title">وش يسوي دربك بسيرتك؟</h2></div><ol className="resume-landing-steps">{steps.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, "0")}</span><p>{step}</p></li>)}</ol></section>

      <section className="resume-landing-section resume-landing-trust" aria-labelledby="resume-trust-title"><div><span className="resume-landing-eyebrow">المعلومة لك، والصياغة تساعدك</span><h2 id="resume-trust-title">نعتمد على معلوماتك أنت</h2><p>لا نختلق خبرة أو أرقام. لا نضيف مهارات ما قلتها، ولا نغيّر حقائقك. نعيد الصياغة والترتيب فقط، وتقدر تراجع الناتج وتعدله.</p></div><div className="resume-landing-trust-mark" aria-hidden="true">✦</div></section>

      <section className="resume-landing-section" aria-labelledby="resume-included-title"><div className="resume-landing-section-heading"><span>كل أدوات السيرة في مكان واحد</span><h2 id="resume-included-title">وش يشمل سيرتي بدربك؟</h2></div><ul className="resume-landing-included">{included.map((item) => <li key={item}><span aria-hidden="true">✓</span>{item}</li>)}</ul></section>

      <section className="resume-landing-section resume-landing-faq" aria-labelledby="resume-faq-title"><div className="resume-landing-section-heading"><span>عندك سؤال؟</span><h2 id="resume-faq-title">إجابات سريعة وواضحة</h2></div><div>{questions.map(([question, answer], index) => <details key={question}><summary onClick={(event) => { if (!event.currentTarget.parentElement.open) trackEvent("resume_faq_opened", { metadata: { questionIndex: index } }); }}>{question}</summary><p>{answer}</p></details>)}</div></section>

      <section className="resume-landing-final"><span>الخطوة الجاية تبدأ منك</span><h2>جاهز تبدأ سيرتك؟</h2><p>اكتب معلوماتك كما هي، ودربك يساعدك تظهرها بصورة مهنية وواضحة.</p><Link className="resume-landing-button resume-landing-button-primary" to={resumeTarget} onClick={() => trackCta("final")}>ابدأ بناء سيرتي</Link></section>
    </main>
  );
}
