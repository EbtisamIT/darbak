import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiBriefcase,
  FiCheck,
  FiCompass,
  FiFileText,
  FiMapPin,
  FiSend,
  FiStar,
  FiUsers,
} from "react-icons/fi";
import API_BASE_URL from "../config/api";
import AnimatedCount from "../components/AnimatedCount";
import ResumeServicePromo from "../components/ResumeServicePromo";
import { cityOptions, specializationOptions } from "../data/trainingOptions";

const homeFont = "'Aniq', 'Cairo', sans-serif";

const services = [
  {
    icon: FiCompass,
    title: "اكتشف",
    copy: "جهات وفرص وتجارب طلاب تساعدك تختار بثقة.",
    features: ["وين أتدرب؟", "فرص حالية", "تجارب ومقابلات الطلاب"],
    cta: "استكشف الجهات",
    to: "/where-to-train",
  },
  {
    icon: FiFileText,
    title: "جهّز سيرتك",
    copy: "نبدأ من معلوماتك الموجودة في دربك ونكمل الناقص فقط.",
    features: ["سيرتك الأساسية", "نسخة إنجليزية", "قوالب ومعاينة"],
    cta: "ابدأ سيرتي",
    to: "/my-resume",
  },
  {
    icon: FiSend,
    title: "جهّز تقديمك",
    copy: "خصص تقديمك للجهة مع الحفاظ على معلوماتك الحقيقية.",
    features: ["سيرة مخصصة", "خطاب تقديم", "رسالة إيميل"],
    cta: "شوف سيرتي",
    to: "/my-resume",
  },
];

const readCollection = (payload) => Array.isArray(payload) ? payload : payload?.data || [];
const formatPlanPrice = (plan = {}) => typeof plan.priceSar === "number"
  ? `${plan.priceSar.toLocaleString("en-US", { minimumFractionDigits: plan.priceSar % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })} ريال`
  : "";
const formatPlanPeriod = (plan = {}) => {
  const days = Number(plan.durationDays || 0);
  if (days === 30) return "/ شهر";
  if (days === 90) return "/ 3 أشهر";
  return days ? `/ ${days} يوم` : "";
};
const getPlanPerks = (plan = {}) => {
  const isResumePlan = plan.planKey === "darbak_resume" || plan.id === "darbak_resume";
  const limit = Number(plan.aiResumeUsageLimit || 0);

  return isResumePlan
    ? [
      "جميع مزايا دربك+",
      "سيرة أساسية من بياناتك",
      "نسخة إنجليزية مستقلة",
      limit ? `${limit} تخصيصات للتقديم شهريًا` : "تخصيصات للتقديم",
      "خطاب تقديم ورسالة إيميل",
      "تحميل السيرة PDF",
    ]
    : [
      "استكشف جهات التدريب",
      "شاهد تجارب الطلاب",
      "تابع الفرص الحالية",
      "استخدم وين أتدرب؟",
    ];
};

const HeroAtmosphere = () => (
  <div className="home-hero-atmosphere" aria-hidden="true">
    <i className="home-star home-star-one" />
    <i className="home-star home-star-two" />
    <i className="home-star home-star-three" />
    <i className="home-star home-star-four" />
  </div>
);

const HomePage = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({});
  const [opportunities, setOpportunities] = useState([]);
  const [experiences, setExperiences] = useState([]);
  const [subscriptionPlans, setSubscriptionPlans] = useState([]);
  const [major, setMajor] = useState("");
  const [city, setCity] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      fetch(`${API_BASE_URL}/api/home-stats`).then((response) => response.json()),
      fetch(`${API_BASE_URL}/api/opportunities`).then((response) => response.json()),
      fetch(`${API_BASE_URL}/api/experiences?limit=3`).then((response) => response.json()),
      fetch(`${API_BASE_URL}/api/subscriptions/plans`).then((response) => response.json()),
    ]).then(([statsResult, opportunitiesResult, experiencesResult, plansResult]) => {
      if (!alive) return;
      if (statsResult.status === "fulfilled") setStats(statsResult.value || {});
      if (opportunitiesResult.status === "fulfilled") setOpportunities(readCollection(opportunitiesResult.value).slice(0, 3));
      if (experiencesResult.status === "fulfilled") setExperiences(readCollection(experiencesResult.value).slice(0, 3));
      if (plansResult.status === "fulfilled") setSubscriptionPlans(readCollection(plansResult.value?.plans));
    });
    return () => { alive = false; };
  }, []);

  const statItems = useMemo(() => [
    { value: stats.experiencesCount, label: "تجربة طلابية", to: "/experiences" },
    { value: stats.organizationsCount, label: "جهة تدريب", to: "/where-to-train" },
    { value: stats.currentProgramsCount, label: "فرصة وبرنامج", to: "/where-to-train?tab=opportunities" },
    { value: stats.studentsAppliedCount, label: "تقديم عبر دربك", to: "/my-resume" },
  ], [stats]);

  const finderUrl = () => {
    const params = new URLSearchParams();
    if (major) params.set("major", major);
    if (city) params.set("city", city);
    return `/where-to-train${params.toString() ? `?${params}` : ""}`;
  };

  const beginJourney = () => navigate(finderUrl());

  return (
    <main className="home-page" dir="rtl">
      <section className="home-hero">
        <HeroAtmosphere />
        <div className="home-hero-copy">
          <span className="home-eyebrow">دربك للتدريب التعاوني</span>
          <h1>دربك معك من البحث عن جهة حتى التقديم</h1>
          <p>اكتشف الجهات، جهّز سيرتك، وخلّ دربك يجهز تقديمك لكل جهة.</p>
        </div>
      </section>

      <section className="home-diagnosis-section">
        <div className="home-diagnosis-copy">
          <span>تشخيص سريع لرحلتك</span>
          <h2>خلّنا نرتب لك البداية</h2>
          <p>اختر تخصصك ومدينتك، ثم نأخذك من الجهات المناسبة إلى التقديم خطوة بخطوة.</p>
        </div>
        <form className="home-start-card" onSubmit={(event) => { event.preventDefault(); beginJourney(); }}>
          <div className="home-start-fields">
            <label>تخصصك
              <select required value={major} onChange={(event) => setMajor(event.target.value)}>
                <option value="">اختر تخصصك</option>
                {specializationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label>مدينتك
              <select required value={city} onChange={(event) => setCity(event.target.value)}>
                <option value="">اختر مدينتك</option>
                {cityOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </div>
          <button className="home-button home-button-primary" type="submit">شخّص رحلتي <FiArrowLeft aria-hidden="true" /></button>
          <div className="home-start-flow">جهات مناسبة <i /> تجارب ومقابلات <i /> سيرتك <i /> تقديمك لكل جهة</div>
        </form>
      </section>

      <section className="home-section home-journey-section">
        <div className="home-section-heading">
          <span>رحلتك في دربك</span>
          <h2>كل خطوة تكمل اللي قبلها</h2>
        </div>
        <div className="home-services-grid">
          {services.map(({ icon: Icon, title, copy, features, cta, to }, index) => (
            <article className="home-service-card" key={title}>
              <span className="home-step-number">0{index + 1}</span>
              <span className="home-service-icon"><Icon aria-hidden="true" /></span>
              <h3>{title}</h3>
              <p>{copy}</p>
              <ul>{features.map((feature) => <li key={feature}><FiCheck aria-hidden="true" />{feature}</li>)}</ul>
              <Link to={to}>{cta}<FiArrowLeft aria-hidden="true" /></Link>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section home-resume-section">
        <div className="home-resume-copy">
          <span>سيرتي بدربك</span>
          <h2>مو بس سيرة ذاتية</h2>
          <p>اختر الجهة، ودربك يجهز لك تقديمك كاملًا من معلوماتك الحقيقية.</p>
          <ul>
            <li><FiCheck aria-hidden="true" /> سيرة مخصصة</li>
            <li><FiCheck aria-hidden="true" /> خطاب تقديم</li>
            <li><FiCheck aria-hidden="true" /> رسالة إيميل</li>
          </ul>
          <Link className="home-button home-button-primary" to="/my-resume">جرّب سيرتي <FiArrowLeft aria-hidden="true" /></Link>
        </div>
        <div className="home-pack-preview" aria-label="معاينة ملف تقديم">
          <div className="home-preview-header"><FiBriefcase aria-hidden="true" /> تقديمك شبه جاهز <span>3 من 3 جاهزة ✓</span></div>
          {["السيرة الذاتية", "خطاب التقديم", "رسالة الإيميل"].map((item, index) => (
            <div className="home-preview-row" key={item}>
              <span className={index === 2 ? "home-preview-pending" : "home-preview-ready"}>{index === 2 ? "○" : "✓"}</span>
              <strong>{item}</strong>
              <small>{index === 2 ? "أضف فترة التدريب" : "جاهزة"}</small>
            </div>
          ))}
          <div className="home-preview-footer">ماذا خصصنا؟ <span>أبرزنا أقوى مشاريعك ومهاراتك.</span></div>
        </div>
        <ResumeServicePromo placement="home" compact />
      </section>

      <section className="home-pricing-section" aria-label="الباقات والاشتراكات">
        <div className="home-section-heading home-pricing-heading">
          <span>الباقات</span>
          <h2>اختر اللي يناسب رحلتك</h2>
          <p>ابدأ بدربك، وإذا احتجت تجهيز سيرتك وتقديماتك بالذكاء ارتقِ في أي وقت.</p>
        </div>
        <div className="home-pricing-grid">
          {subscriptionPlans.map((plan) => {
            const isResumePlan = plan.planKey === "darbak_resume" || plan.id === "darbak_resume";
            return (
              <article className={`home-pricing-card${isResumePlan ? " home-pricing-card-highlighted" : ""}`} key={plan.id}>
                <div className="home-pricing-card-head">
                  <div><span>{plan.label}</span>{isResumePlan && <small>الأكمل للتقديم</small>}</div>
                  <strong>{formatPlanPrice(plan)}<em>{formatPlanPeriod(plan)}</em></strong>
                </div>
                <ul>{getPlanPerks(plan).slice(0, 6).map((perk) => <li key={perk}><FiCheck aria-hidden="true" />{perk}</li>)}</ul>
                <Link className="home-button home-button-secondary" to={`/subscribe?plan=${plan.id}`}>{isResumePlan ? "ابدأ سيرتي" : "اشترك الآن"}<FiArrowLeft aria-hidden="true" /></Link>
              </article>
            );
          })}
          {!subscriptionPlans.length && <p className="home-plan-loading">تظهر الباقات الحالية هنا عند تحميلها.</p>}
        </div>
      </section>

      <section className="home-section home-finder-section">
        <div className="home-finder-layout">
          <div>
            <div className="home-section-heading home-heading-inline">
              <div><span>وين أتدرب؟</span><h2>ابدأ من تخصصك ومدينتك</h2></div>
              <p>نرتب لك الجهات والفرص الأقرب لرحلتك.</p>
            </div>
            <div className="home-finder-form">
              <label>التخصص
                <select value={major} onChange={(event) => setMajor(event.target.value)}>
                  <option value="">اختر تخصصك</option>
                  {specializationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label>المدينة
                <select value={city} onChange={(event) => setCity(event.target.value)}>
                  <option value="">كل المدن</option>
                  {cityOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <Link className="home-button home-button-primary" to={finderUrl()}>اعرض لي الجهات <FiArrowLeft aria-hidden="true" /></Link>
            </div>
          </div>
          <div className="home-finder-example">
            <span>مثال جهة في دربك</span>
            <strong>{opportunities[0]?.organizationName || "جهات وفرص مناسبة لتخصصك"}</strong>
            <p>{opportunities[0]?.title || "اختر تخصصك ومدينتك لنبدأ ترتيب الخيارات."}</p>
            <small><FiMapPin /> {opportunities[0]?.city || "حسب مدينتك"}</small>
          </div>
        </div>
      </section>

      <section className="home-section home-opportunities-section">
        <div className="home-section-heading home-heading-row"><div><span>فرص مفتوحة الآن</span><h2>فرص يمكنك البدء منها اليوم</h2></div><Link to="/where-to-train?tab=opportunities">عرض كل الفرص <FiArrowLeft /></Link></div>
        <div className="home-preview-grid">
          {opportunities.length ? opportunities.map((opportunity) => (
            <Link className="home-content-card" key={opportunity._id} to={`/where-to-train?tab=opportunities&opportunity=${opportunity._id}`}>
              <span className="home-card-badge">فرصة تدريب</span>
              <h3>{opportunity.title || "فرصة تدريب تعاوني"}</h3>
              <p>{opportunity.organizationName || "جهة تدريب"}</p>
              <small><FiMapPin /> {opportunity.city || opportunity.cities?.[0] || "السعودية"}</small>
            </Link>
          )) : <p className="home-empty-copy">تظهر أحدث فرص التدريب هنا عند توفرها.</p>}
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-heading home-heading-row"><div><span>تجارب الطلاب</span><h2>قبل ما تقدم، شوف تجارب اللي سبقوك</h2></div><Link to="/experiences">استكشف التجارب <FiArrowLeft /></Link></div>
        <div className="home-preview-grid">
          {experiences.length ? experiences.map((experience) => (
            <Link className="home-content-card home-experience-card" key={experience._id} to={`/experiences/${experience._id}`}>
              <span className="home-card-badge"><FiStar /> تجربة طالب</span>
              <h3>{experience.organizationName || experience.companyName || "تجربة تدريب"}</h3>
              <p>{experience.major || experience.majorCategory || "تدريب تعاوني"}</p>
              {experience.description && <em>{experience.description.slice(0, 112)}{experience.description.length > 112 ? "…" : ""}</em>}
              <small><FiMapPin /> {experience.city || "السعودية"}</small>
            </Link>
          )) : <p className="home-empty-copy">تظهر أحدث تجارب الطلاب هنا.</p>}
        </div>
      </section>

      <section className="home-section home-stats-section">
        <div className="home-section-heading"><span>أرقام دربك</span><h2>أثر يتوسع مع كل طالب وجهة</h2></div>
        <div className="home-stats-grid">
          {statItems.map((item) => <Link key={item.label} to={item.to}><strong>{typeof item.value === "number" ? <AnimatedCount value={item.value} prefix="+" /> : "..."}</strong><span>{item.label}</span></Link>)}
        </div>
      </section>

      <section className="home-company-section">
        <FiUsers aria-hidden="true" />
        <div><span>للشركات</span><h2>تبحث عن متدربين؟</h2><p>استقبل طلبات التدريب في صفحة مرتبة من دربك.</p></div>
        <Link className="home-button home-button-secondary" to="/partners">اطلب صفحة تقديم لشركتك</Link>
      </section>

      <style>{`
        .home-page { position: relative; min-height: 100vh; color: var(--app-text); background: var(--app-bg); font-family: ${homeFont}; overflow: hidden; padding-bottom: 42px; isolation: isolate; }
        .home-page::before { content: ""; position: absolute; inset: 0; z-index: -2; pointer-events: none; background: radial-gradient(ellipse at 50% 10%, rgba(126, 222, 207, .045), transparent 31%), radial-gradient(circle at 18% 18%, rgba(126, 222, 207, .045), transparent 20%); }
        .home-page::after { content: ""; position: absolute; z-index: -1; pointer-events: none; top: 420px; right: -18%; width: 70%; height: 380px; background: radial-gradient(ellipse, rgba(99, 213, 196, .075), transparent 67%); }
        .home-hero, .home-section, .home-company-section, .home-pricing-section, .home-diagnosis-section { width: min(1120px, calc(100% - 40px)); margin-inline: auto; }
        .home-hero { position: relative; padding: 76px 0 28px; text-align: center; }
        .home-hero-atmosphere { position: absolute; inset: 0; overflow: hidden; pointer-events: none; opacity: .92; background-image: radial-gradient(circle, rgba(228, 255, 251, .7) 1px, transparent 1.6px), radial-gradient(circle, rgba(126, 222, 207, .48) 1px, transparent 1.5px), radial-gradient(circle, rgba(255, 255, 255, .38) .8px, transparent 1.4px); background-size: 137px 137px, 211px 211px, 89px 89px; background-position: 18px 29px, 83px 54px, 41px 9px; mask-image: linear-gradient(90deg, transparent, black 12%, black 88%, transparent); }
        .home-hero-atmosphere::before { content: ""; position: absolute; width: min(61%, 710px); height: 250px; top: 18%; left: -4%; border-radius: 50%; background: radial-gradient(ellipse, rgba(59, 159, 154, .18), rgba(52, 121, 133, .07) 38%, transparent 72%); filter: blur(6px); }
        .home-hero-atmosphere::after { content: ""; position: absolute; width: min(58%, 670px); height: 2px; top: 54%; left: 1%; border-radius: 999px; background: linear-gradient(90deg, transparent, rgba(126, 222, 207, .56) 24%, rgba(126, 222, 207, .09) 78%, transparent); box-shadow: 0 0 20px rgba(126, 222, 207, .12); }
        .home-star { position: absolute; width: 5px; height: 5px; border-radius: 50%; background: rgba(238, 255, 251, .82); box-shadow: 0 0 10px rgba(211, 255, 246, .32); animation: homeTwinkle 3.6s ease-in-out infinite; }
        .home-star-one { top: 24%; right: 11%; }.home-star-two { top: 43%; right: 43%; animation-delay: .65s; }.home-star-three { top: 22%; left: 31%; animation-delay: 1.2s; }.home-star-four { bottom: 18%; left: 13%; animation-delay: 1.75s; }
        @keyframes homeTwinkle { 0%, 100% { opacity: .26; transform: scale(.75); } 50% { opacity: .86; transform: scale(1.15); } }
        .home-eyebrow, .home-section-heading > span, .home-resume-copy > span, .home-company-section > div > span, .home-diagnosis-copy > span, .home-plans-intro > span { color: var(--app-brand); font-weight: 900; font-size: 13px; }
        .home-eyebrow { display: inline-flex; padding: 7px 12px; border: 1px solid var(--app-brand-border); border-radius: 999px; background: var(--app-brand-soft); }
        .home-hero-copy { position: relative; z-index: 1; max-width: 790px; margin: 0 auto 30px; }.home-hero h1 { max-width: 760px; margin: 16px auto 12px; font-size: clamp(42px, 5.2vw, 67px); line-height: 1.18; letter-spacing: -1px; }.home-hero p { max-width: 590px; margin: 0 auto; color: var(--app-text-soft); font-size: 17px; line-height: 1.9; }
        .home-button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 46px; padding: 0 18px; border-radius: 12px; font: inherit; font-weight: 900; text-decoration: none; cursor: pointer; transition: transform .18s ease, background .18s ease; }
        .home-button:hover { transform: translateY(-2px); }
        .home-button-primary { border: 1px solid transparent; background: var(--app-brand); color: #061212; box-shadow: 0 12px 28px var(--app-brand-soft); }
        .home-button-secondary { border: 1px solid var(--app-brand-border); background: transparent; color: var(--app-brand-strong); }
        .home-services-grid { position: relative; z-index: 1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; text-align: right; }.home-service-card { display: flex; flex-direction: column; min-height: 230px; padding: 21px; box-sizing: border-box; border: 1px solid var(--app-border); border-radius: 18px; background: color-mix(in srgb, var(--app-surface) 94%, transparent); box-shadow: 0 16px 38px rgba(0, 0, 0, .12); }.home-service-icon { width: 40px; height: 40px; display: grid; place-items: center; border: 1px solid var(--app-brand-border); border-radius: 12px; color: var(--app-brand); background: var(--app-brand-soft); }.home-service-card h3 { margin: 14px 0 5px; font-size: 22px; }.home-service-card p { margin: 0; color: var(--app-text-soft); font-size: 13px; line-height: 1.75; }.home-service-card ul { display: grid; gap: 6px; padding: 0; margin: 15px 0; list-style: none; color: var(--app-muted); font-size: 12px; }.home-service-card li { display: flex; align-items: center; gap: 6px; }.home-service-card li svg { color: var(--app-brand); }.home-service-card > a { display: inline-flex; align-items: center; gap: 6px; width: fit-content; margin-top: auto; color: var(--app-brand); font-weight: 900; text-decoration: none; font-size: 13px; }
        .home-diagnosis-section { display: grid; grid-template-columns: minmax(250px, .8fr) minmax(420px, 1.2fr); align-items: center; gap: 34px; margin-top: 18px; padding: 31px 36px; box-sizing: border-box; border-radius: 20px; border: 1px solid var(--app-brand-border); background: radial-gradient(circle at 92% 10%, var(--app-brand-soft), transparent 38%), var(--app-input-bg); }.home-diagnosis-copy h2 { margin: 7px 0; font-size: clamp(25px, 3vw, 35px); }.home-diagnosis-copy p { margin: 0; color: var(--app-text-soft); line-height: 1.8; }.home-start-card { display: grid; gap: 13px; padding: 0; background: transparent; }.home-start-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }.home-start-card label { display: grid; gap: 6px; color: var(--app-text-soft); font-weight: 800; font-size: 12px; }.home-start-card select { height: 48px; border: 1px solid var(--app-border); border-radius: 12px; background: var(--app-surface); color: var(--app-text); padding: 0 10px; font: inherit; }.home-start-card .home-button { width: 100%; margin-top: 1px; }.home-start-flow { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; padding-top: 5px; border-top: 1px solid var(--app-border-soft); color: var(--app-muted); font-size: 10.5px; font-weight: 800; line-height: 1.6; }.home-start-flow i { width: 10px; height: 1px; background: var(--app-brand-border); }
        .home-hero-path { display: none; }
        .home-hero-path i { width: 34px; height: 1px; background: var(--app-brand-border); }
        .home-section { padding: 42px 0; }
        .home-section-heading { margin-bottom: 24px; }
        .home-section-heading h2, .home-resume-copy h2, .home-company-section h2 { margin: 7px 0 0; font-size: clamp(26px, 3vw, 37px); line-height: 1.35; }
        .home-heading-row { display: flex; justify-content: space-between; align-items: end; gap: 16px; }
        .home-heading-row > a { display: inline-flex; align-items: center; gap: 6px; color: var(--app-brand); font-weight: 800; text-decoration: none; white-space: nowrap; }
        .home-heading-inline { display: flex; justify-content: space-between; align-items: end; gap: 20px; }
        .home-heading-inline p { max-width: 330px; margin: 0; color: var(--app-text-soft); line-height: 1.7; }
        .home-journey-section { padding-top: 32px; }.home-step-number { color: var(--app-brand); font-size: 11px; font-weight: 900; letter-spacing: .08em; }
        .home-resume-section { display: grid; grid-template-columns: 1fr minmax(320px, .8fr); align-items: center; gap: 42px; padding: 42px; box-sizing: border-box; border: 1px solid var(--app-brand-border); border-radius: 22px; background: color-mix(in srgb, var(--app-input-bg) 92%, transparent); }
        .home-resume-copy p { max-width: 480px; color: var(--app-text-soft); line-height: 1.8; }
        .home-resume-copy ul { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(3, max-content); gap: 10px 20px; margin: 24px 0; }
        .home-resume-copy li { display: flex; align-items: center; gap: 6px; color: var(--app-text-soft); font-weight: 800; font-size: 14px; } .home-resume-copy li svg { color: var(--app-brand); }
        .home-pack-preview { display: grid; gap: 10px; padding: 16px; border: 1px solid var(--app-brand-border); border-radius: 16px; background: var(--app-surface); box-shadow: 0 20px 50px var(--app-shadow), 0 0 34px var(--app-brand-soft); }
        .home-preview-header { display: flex; align-items: center; gap: 8px; padding: 6px 4px 14px; color: var(--app-brand); font-weight: 900; border-bottom: 1px solid var(--app-border-soft); }.home-preview-header span { margin-right: auto; padding: 4px 7px; border-radius: 999px; background: var(--app-brand-soft); font-size: 10px; }
        .home-preview-row { display: grid; grid-template-columns: 22px 1fr auto; align-items: center; gap: 9px; padding: 12px; border: 1px solid var(--app-border-soft); border-radius: 11px; }
        .home-preview-row small { color: var(--app-text-muted); font-size: 11px; } .home-preview-ready { color: var(--app-brand); } .home-preview-pending { color: var(--app-muted); }
        .home-preview-footer { padding: 10px 4px 2px; color: var(--app-brand); font-size: 12px; font-weight: 800; } .home-preview-footer span { color: var(--app-text-muted); font-weight: 600; }
        .resume-service-promo { display: none; }
        .home-pricing-section { padding: 34px 0 38px; }.home-pricing-heading { text-align: center; }.home-pricing-heading p { max-width: 560px; margin: 10px auto 0; color: var(--app-text-soft); line-height: 1.8; }.home-pricing-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; max-width: 760px; margin: 0 auto; }.home-pricing-card { display: grid; gap: 18px; padding: 22px; border: 1px solid var(--app-border); border-radius: 18px; background: var(--app-surface); }.home-pricing-card-highlighted { border-color: var(--app-brand-border); box-shadow: 0 16px 40px var(--app-brand-soft); }.home-pricing-card-head { display: flex; align-items: start; justify-content: space-between; gap: 14px; }.home-pricing-card-head > div { display: grid; gap: 6px; }.home-pricing-card-head span { color: var(--app-brand); font-size: 19px; font-weight: 900; }.home-pricing-card-head small { width: fit-content; padding: 4px 8px; border-radius: 999px; color: var(--app-brand); background: var(--app-brand-soft); font-size: 10px; font-weight: 900; }.home-pricing-card-head strong { display: grid; text-align: left; font-size: 23px; white-space: nowrap; }.home-pricing-card-head em { color: var(--app-muted); font-size: 10px; font-style: normal; font-weight: 700; }.home-pricing-card ul { display: grid; gap: 9px; min-height: 102px; margin: 0; padding: 0; list-style: none; color: var(--app-text-soft); font-size: 13px; }.home-pricing-card li { display: flex; align-items: center; gap: 7px; }.home-pricing-card li svg { color: var(--app-brand); }.home-pricing-card .home-button { width: 100%; }.home-plan-loading { margin: 0; color: var(--app-muted); text-align: center; }
        .home-finder-section { padding: 34px; border-radius: 22px 22px 0 0; background: var(--app-surface); border: 1px solid var(--app-border); border-bottom: 0; box-sizing: border-box; }
        .home-finder-layout { display: grid; grid-template-columns: 1fr 280px; align-items: stretch; gap: 28px; }.home-finder-example { display: grid; align-content: center; gap: 8px; padding: 20px; border-radius: 14px; border: 1px solid var(--app-brand-border); background: var(--app-input-bg); }.home-finder-example span { color: var(--app-brand); font-size: 12px; font-weight: 900; }.home-finder-example strong { font-size: 18px; line-height: 1.5; }.home-finder-example p, .home-finder-example small { margin: 0; color: var(--app-text-soft); font-size: 13px; line-height: 1.6; }.home-finder-example small { display: flex; align-items: center; gap: 6px; color: var(--app-muted); }.home-finder-example svg { color: var(--app-brand); }
        .home-finder-form { display: grid; grid-template-columns: 1fr 1fr auto; align-items: end; gap: 14px; }
        .home-finder-form label { display: grid; gap: 8px; color: var(--app-text-soft); font-size: 13px; font-weight: 800; }
        .home-finder-form select { min-width: 0; height: 48px; border: 1px solid var(--app-border); border-radius: 11px; background: var(--app-input-bg); color: var(--app-text); padding: 0 12px; font: inherit; }
        .home-opportunities-section { padding-top: 18px; }.home-preview-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .home-content-card { min-height: 142px; display: flex; flex-direction: column; align-items: flex-start; padding: 17px; border: 1px solid var(--app-border); border-radius: 16px; background: var(--app-surface); color: var(--app-text); text-decoration: none; transition: transform .18s ease, border-color .18s ease; }
        .home-content-card:hover { transform: translateY(-3px); border-color: var(--app-brand-border); }
        .home-card-badge { display: inline-flex; align-items: center; gap: 5px; color: var(--app-brand); font-size: 12px; font-weight: 900; }
        .home-content-card h3 { margin: 12px 0 5px; font-size: 17px; line-height: 1.55; } .home-content-card p { margin: 0; color: var(--app-text-soft); }.home-experience-card em { margin-top: 9px; color: var(--app-muted); font-size: 12px; line-height: 1.65; font-style: normal; }
        .home-content-card small { display: flex; align-items: center; gap: 5px; margin-top: auto; color: var(--app-muted); } .home-content-card small svg { color: var(--app-brand); }
        .home-empty-copy { color: var(--app-muted); }
        .home-stats-section { text-align: center; padding: 28px 0; }.home-stats-section .home-section-heading { display: none; }.home-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; padding: 6px; border: 1px solid var(--app-border); border-radius: 15px; background: var(--app-surface); }
        .home-stats-grid a { padding: 10px 16px; text-decoration: none; border-inline-start: 1px solid var(--app-border-soft); }.home-stats-grid a:first-child { border-inline-start: 0; }.home-stats-grid strong { display: block; color: var(--app-brand); font-size: 28px; } .home-stats-grid span { color: var(--app-text-soft); font-weight: 800; font-size: 12px; }
        .home-company-section { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 16px; margin-top: 14px; padding: 21px 26px; box-sizing: border-box; border-radius: 15px; border: 1px solid var(--app-border); background: var(--app-surface); }
        .home-company-section > svg { width: 36px; height: 36px; color: var(--app-brand); } .home-company-section h2 { font-size: 23px; margin-top: 3px; } .home-company-section p { margin: 4px 0 0; color: var(--app-text-soft); }
        @media (max-width: 800px) {
          .home-hero, .home-section, .home-company-section, .home-pricing-section, .home-diagnosis-section { width: min(100% - 28px, 600px); }
          .home-hero { padding: 46px 0 20px; }.home-hero h1 { font-size: 39px; }.home-hero p { font-size: 15.5px; }.home-hero-copy { margin-bottom: 23px; }.home-services-grid { grid-template-columns: 1fr; gap: 10px; }.home-service-card { min-height: auto; padding: 18px; }.home-service-card h3 { margin-top: 10px; }.home-service-card ul { grid-template-columns: 1fr 1fr; margin: 11px 0; }.home-diagnosis-section { grid-template-columns: 1fr; gap: 19px; margin-top: 14px; padding: 23px 18px; }.home-start-fields { grid-template-columns: 1fr; }.home-start-flow { font-size: 10px; }
          .home-section { padding: 30px 0; }.home-section-heading { margin-bottom: 17px; }.home-section-heading h2 { font-size: 26px; }.home-journey-section { padding-top: 24px; }.home-pricing-section { padding: 28px 0 32px; }.home-pricing-card { padding: 19px; }.home-pricing-card ul { min-height: 0; }
          .home-resume-section { grid-template-columns: 1fr; gap: 24px; padding: 26px 18px; }.home-resume-copy ul { grid-template-columns: 1fr; gap: 8px; }.home-heading-inline, .home-heading-row { align-items: flex-start; flex-direction: column; }.home-finder-section { padding: 24px 18px; }.home-finder-layout { grid-template-columns: 1fr; gap: 16px; }.home-finder-form { grid-template-columns: 1fr; }.home-finder-form .home-button { width: 100%; }.home-preview-grid { display: flex; overflow-x: auto; padding-bottom: 6px; scroll-snap-type: x mandatory; }.home-content-card { flex: 0 0 min(275px, 82vw); scroll-snap-align: start; }.home-stats-grid { grid-template-columns: repeat(2, 1fr); }.home-stats-grid a:nth-child(3) { border-inline-start: 0; border-top: 1px solid var(--app-border-soft); }.home-stats-grid a:nth-child(4) { border-top: 1px solid var(--app-border-soft); }.home-company-section { grid-template-columns: auto 1fr; padding: 20px; }.home-company-section .home-button { grid-column: 1 / -1; width: 100%; }
        }
      `}</style>
    </main>
  );
};

export default HomePage;
