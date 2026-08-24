import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiBriefcase,
  FiCheck,
  FiChevronLeft,
  FiClipboard,
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

const journey = [
  { icon: FiCompass, title: "نكتشف الجهات", copy: "نرتب الجهات والفرص الأقرب لتخصصك ومدينتك.", to: "/where-to-train" },
  { icon: FiStar, title: "نقرأ التجارب والمقابلات", copy: "تعرف على التجربة قبل اتخاذ قرارك.", to: "/experiences" },
  { icon: FiFileText, title: "نجهّز سيرتك", copy: "نبدأ من معلوماتك الموجودة في دربك.", to: "/my-resume/build" },
  { icon: FiSend, title: "نجهّز تقديمك لكل جهة", copy: "سيرة وخطاب وإيميل متسق للجهة.", to: "/my-resume" },
  { icon: FiClipboard, title: "نتابع تقديماتك", copy: "كل تقديماتك محفوظة في مكان واحد.", to: "/my-resume" },
];

const readCollection = (payload) => Array.isArray(payload) ? payload : payload?.data || [];

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
  const [major, setMajor] = useState("");
  const [city, setCity] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      fetch(`${API_BASE_URL}/api/home-stats`).then((response) => response.json()),
      fetch(`${API_BASE_URL}/api/opportunities`).then((response) => response.json()),
      fetch(`${API_BASE_URL}/api/experiences?limit=3`).then((response) => response.json()),
    ]).then(([statsResult, opportunitiesResult, experiencesResult]) => {
      if (!alive) return;
      if (statsResult.status === "fulfilled") setStats(statsResult.value || {});
      if (opportunitiesResult.status === "fulfilled") setOpportunities(readCollection(opportunitiesResult.value).slice(0, 3));
      if (experiencesResult.status === "fulfilled") setExperiences(readCollection(experiencesResult.value).slice(0, 3));
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
        <div className="home-hero-content">
          <div className="home-hero-copy">
            <span className="home-eyebrow">دربك للتدريب التعاوني</span>
            <h1>دربك معك من البحث عن جهة حتى التقديم.</h1>
            <p>عرّفنا بتخصصك ومدينتك، ودربك يرتب لك الرحلة من اكتشاف الجهات وتجارب الطلاب إلى سيرتك وتقديمك لكل جهة.</p>
            <div className="home-hero-actions">
              <button className="home-button home-button-primary" type="button" onClick={beginJourney}>
                ابدأ رحلتي <FiArrowLeft aria-hidden="true" />
              </button>
              <Link className="home-button home-button-secondary" to="/where-to-train?tab=opportunities">استعرض الفرص</Link>
            </div>
          </div>
          <form className="home-start-card" onSubmit={(event) => { event.preventDefault(); beginJourney(); }}>
            <span>تشخيص سريع لرحلتك</span>
            <h2>اختر تخصصك ومدينتك، ودربك يجهز لك البداية</h2>
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
        </div>
      </section>

      <section className="home-section home-journey-section">
        <div className="home-section-heading">
          <span>رحلتك في دربك</span>
          <h2>خطوات بسيطة من أول بحث إلى أول تقديم</h2>
        </div>
        <div className="home-journey-grid">
          {journey.map(({ icon: Icon, title, copy, to }, index) => (
            <Link key={title} className="home-journey-step" to={to}>
              <span className="home-step-number">0{index + 1}</span>
              <span className="home-step-icon"><Icon aria-hidden="true" /></span>
              <strong>{title}</strong>
              <small>{copy}</small>
              <FiChevronLeft aria-hidden="true" />
            </Link>
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
        .home-hero, .home-section, .home-company-section { width: min(1120px, calc(100% - 40px)); margin-inline: auto; }
        .home-hero { position: relative; padding: 76px 0 42px; text-align: right; }
        .home-hero-atmosphere { position: absolute; inset: 0; overflow: hidden; pointer-events: none; opacity: .9; }
        .home-hero-atmosphere::before { content: ""; position: absolute; width: min(58%, 670px); height: 2px; top: 54%; left: 1%; border-radius: 999px; background: linear-gradient(90deg, transparent, rgba(126, 222, 207, .5) 22%, rgba(126, 222, 207, .1) 75%, transparent); box-shadow: 0 0 18px rgba(126, 222, 207, .1); }
        .home-hero-atmosphere::after { content: ""; position: absolute; width: 440px; height: 280px; top: 17%; left: 21%; background: radial-gradient(ellipse, rgba(126, 222, 207, .06), transparent 68%); }
        .home-star { position: absolute; width: 5px; height: 5px; border-radius: 50%; background: rgba(238, 255, 251, .82); box-shadow: 0 0 10px rgba(211, 255, 246, .32); animation: homeTwinkle 3.6s ease-in-out infinite; }
        .home-star-one { top: 24%; right: 11%; }.home-star-two { top: 43%; right: 43%; animation-delay: .65s; }.home-star-three { top: 22%; left: 31%; animation-delay: 1.2s; }.home-star-four { bottom: 18%; left: 13%; animation-delay: 1.75s; }
        @keyframes homeTwinkle { 0%, 100% { opacity: .26; transform: scale(.75); } 50% { opacity: .86; transform: scale(1.15); } }
        .home-eyebrow, .home-section-heading > span, .home-resume-copy > span, .home-company-section > div > span { color: var(--app-brand); font-weight: 900; font-size: 13px; }
        .home-eyebrow { display: inline-flex; padding: 7px 12px; border: 1px solid var(--app-brand-border); border-radius: 999px; background: var(--app-brand-soft); }
        .home-hero-content { position: relative; z-index: 1; display: grid; grid-template-columns: minmax(0, 1fr) minmax(340px, .78fr); align-items: center; gap: clamp(32px, 6vw, 80px); }
        .home-hero h1 { max-width: 690px; margin: 18px 0 14px; font-size: clamp(40px, 4.7vw, 60px); line-height: 1.22; letter-spacing: -1px; }
        .home-hero p { max-width: 650px; margin: 0; color: var(--app-text-soft); font-size: 17px; line-height: 1.95; }
        .home-hero-actions { display: flex; justify-content: flex-start; gap: 12px; margin-top: 28px; flex-wrap: wrap; }
        .home-button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 46px; padding: 0 18px; border-radius: 12px; font: inherit; font-weight: 900; text-decoration: none; cursor: pointer; transition: transform .18s ease, background .18s ease; }
        .home-button:hover { transform: translateY(-2px); }
        .home-button-primary { border: 1px solid transparent; background: var(--app-brand); color: #061212; box-shadow: 0 12px 28px var(--app-brand-soft); }
        .home-button-secondary { border: 1px solid var(--app-brand-border); background: transparent; color: var(--app-brand-strong); }
        .home-start-card { display: grid; gap: 13px; padding: 24px; border: 1px solid var(--app-brand-border); border-radius: 22px; background: color-mix(in srgb, var(--app-surface) 94%, transparent); box-shadow: 0 24px 62px var(--app-shadow), 0 0 42px var(--app-brand-soft); }
        .home-start-card > span { color: var(--app-brand); font-weight: 900; font-size: 13px; }.home-start-card h2 { margin: -2px 0 4px; font-size: 23px; line-height: 1.45; }.home-start-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }.home-start-card label { display: grid; gap: 6px; color: var(--app-text-soft); font-weight: 800; font-size: 12px; }.home-start-card select { height: 48px; border: 1px solid var(--app-border); border-radius: 12px; background: var(--app-input-bg); color: var(--app-text); padding: 0 10px; font: inherit; }.home-start-card .home-button { width: 100%; margin-top: 1px; }.home-start-flow { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; padding-top: 5px; border-top: 1px solid var(--app-border-soft); color: var(--app-muted); font-size: 10.5px; font-weight: 800; line-height: 1.6; }.home-start-flow i { width: 10px; height: 1px; background: var(--app-brand-border); }
        .home-hero-path { display: none; }
        .home-hero-path i { width: 34px; height: 1px; background: var(--app-brand-border); }
        .home-section { padding: 42px 0; }
        .home-section-heading { margin-bottom: 24px; }
        .home-section-heading h2, .home-resume-copy h2, .home-company-section h2 { margin: 7px 0 0; font-size: clamp(26px, 3vw, 37px); line-height: 1.35; }
        .home-heading-row { display: flex; justify-content: space-between; align-items: end; gap: 16px; }
        .home-heading-row > a { display: inline-flex; align-items: center; gap: 6px; color: var(--app-brand); font-weight: 800; text-decoration: none; white-space: nowrap; }
        .home-heading-inline { display: flex; justify-content: space-between; align-items: end; gap: 20px; }
        .home-heading-inline p { max-width: 330px; margin: 0; color: var(--app-text-soft); line-height: 1.7; }
        .home-journey-section { padding-top: 28px; border-top: 1px solid var(--app-border-soft); }
        .home-journey-grid { position: relative; display: grid; grid-template-columns: repeat(5, 1fr); border: 1px solid var(--app-border); border-radius: 18px; overflow: hidden; }.home-journey-grid::before { content: ""; position: absolute; top: 52px; right: 9%; left: 9%; height: 1px; background: var(--app-brand-border); opacity: .8; }
        .home-journey-step { position: relative; min-height: 162px; padding: 18px; display: flex; flex-direction: column; gap: 7px; color: var(--app-text); text-decoration: none; border-inline-start: 1px solid var(--app-border-soft); transition: background .18s ease, transform .18s ease; }
        .home-journey-step:first-child { border-inline-start: 0; }
        .home-journey-step:hover { background: var(--app-input-bg); transform: translateY(-2px); }
        .home-step-number { color: var(--app-muted); font-size: 11px; font-weight: 900; }
        .home-step-icon { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 11px; color: var(--app-brand); background: var(--app-brand-soft); border: 1px solid var(--app-brand-border); }
        .home-journey-step strong { font-size: 16px; line-height: 1.55; } .home-journey-step small { color: var(--app-text-soft); line-height: 1.6; }
        .home-journey-step > svg { margin-top: auto; color: var(--app-brand); }
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
          .home-hero, .home-section, .home-company-section { width: min(100% - 28px, 600px); }
          .home-hero { padding: 46px 0 24px; }.home-hero-content { grid-template-columns: 1fr; gap: 28px; }.home-hero h1 { font-size: 38px; }.home-hero p { font-size: 15.5px; }.home-hero-actions .home-button { width: min(100%, 330px); }
          .home-start-card { padding: 18px; }.home-start-card h2 { font-size: 21px; }.home-start-fields { grid-template-columns: 1fr; }.home-start-flow { font-size: 10px; }
          .home-section { padding: 30px 0; }.home-section-heading { margin-bottom: 17px; }.home-section-heading h2 { font-size: 26px; }.home-journey-section { padding-top: 20px; }.home-journey-grid::before { display: none; }.home-journey-grid { grid-template-columns: 1fr; }.home-journey-step { min-height: auto; display: grid; grid-template-columns: 30px 40px 1fr auto; align-items: center; border-inline-start: 0; border-top: 1px solid var(--app-border-soft); }.home-journey-step:first-child { border-top: 0; }.home-journey-step small { grid-column: 3 / 5; }.home-journey-step > svg { margin: 0; grid-row: 1; grid-column: 4; }
          .home-resume-section { grid-template-columns: 1fr; gap: 24px; padding: 26px 18px; }.home-resume-copy ul { grid-template-columns: 1fr; gap: 8px; }.home-heading-inline, .home-heading-row { align-items: flex-start; flex-direction: column; }.home-finder-section { padding: 24px 18px; }.home-finder-layout { grid-template-columns: 1fr; gap: 16px; }.home-finder-form { grid-template-columns: 1fr; }.home-finder-form .home-button { width: 100%; }.home-preview-grid { display: flex; overflow-x: auto; padding-bottom: 6px; scroll-snap-type: x mandatory; }.home-content-card { flex: 0 0 min(275px, 82vw); scroll-snap-align: start; }.home-stats-grid { grid-template-columns: repeat(2, 1fr); }.home-stats-grid a:nth-child(3) { border-inline-start: 0; border-top: 1px solid var(--app-border-soft); }.home-stats-grid a:nth-child(4) { border-top: 1px solid var(--app-border-soft); }.home-company-section { grid-template-columns: auto 1fr; padding: 20px; }.home-company-section .home-button { grid-column: 1 / -1; width: 100%; }
        }
      `}</style>
    </main>
  );
};

export default HomePage;
