import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiArrowLeft,
  FiCheck,
  FiFileText,
  FiFolder,
  FiMail,
  FiSend,
  FiUsers,
} from "react-icons/fi";
import API_BASE_URL from "../config/api";
import AnimatedCount from "../components/AnimatedCount";
import { cityOptions, specializationOptions } from "../data/trainingOptions";
import {
  getStoredPremiumPass,
  getStoredAccessIdentity,
  passHasEntitlement,
  PREMIUM_STATUS_EVENT,
} from "../utils/premiumAccess";

const homeFont = "'IBM Plex Sans Arabic', 'Aniq', 'Cairo', sans-serif";

const readCollection = (payload) => {
  if (Array.isArray(payload)) return payload;
  return payload?.data || payload?.opportunities || payload?.experiences || payload?.interviews || [];
};
const fetchJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
};
const formatPlanPrice = (plan = {}) => typeof plan.priceSar === "number"
  ? `${plan.priceSar.toLocaleString("en-US", { minimumFractionDigits: plan.priceSar % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })} ريال`
  : "السعر غير متاح حاليًا";
const formatPlanPeriod = (plan = {}) => {
  const days = Number(plan.durationDays || 0);
  if (days === 30) return "/ شهر";
  if (days === 90) return "/ 3 أشهر";
  return days ? `/ ${days} يوم` : "";
};
const homepagePlanFallbacks = [
  {
    id: "darbak_plus",
    planKey: "darbak_plus",
    label: "دربك+",
    priceSar: 5.99,
    durationDays: 30,
    aiResumeUsageLimit: 0,
  },
  {
    id: "one_time_90",
    planKey: "darbak_plus",
    label: "دربك+ 3 أشهر",
    priceSar: 15,
    durationDays: 90,
    aiResumeUsageLimit: 0,
  },
  {
    id: "darbak_resume",
    planKey: "darbak_resume",
    label: "دربك+ سيرة",
    priceSar: null,
    durationDays: 30,
    aiResumeUsageLimit: 10,
  },
];

const mergeHomepagePlans = (apiPlans = []) => {
  const plansById = new Map(apiPlans.map((plan) => [plan.id, plan]));
  return homepagePlanFallbacks.map((fallbackPlan) => ({
    ...fallbackPlan,
    ...(plansById.get(fallbackPlan.id) || {}),
  }));
};
const HeroAtmosphere = () => (
  <div className="home-hero-atmosphere" aria-hidden="true">
    <i className="home-star home-star-one" />
    <i className="home-star home-star-two" />
    <i className="home-star home-star-three" />
    <i className="home-star home-star-four" />
  </div>
);

const OpportunityLogo = ({ opportunity }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const organizationName = opportunity.organizationName || opportunity.title || "دربك";
  const logoUrl = typeof opportunity.logoUrl === "string" ? opportunity.logoUrl.trim() : "";

  return (
    <span className="home-opportunity-logo" aria-label={`شعار ${organizationName}`}>
      {logoUrl && !imageFailed ? (
        <img src={logoUrl} alt={`شعار ${organizationName}`} onError={() => setImageFailed(true)} />
      ) : (
        <b>{organizationName.charAt(0)}</b>
      )}
    </span>
  );
};

const HomePage = () => {
  const [stats, setStats] = useState({});
  const [opportunities, setOpportunities] = useState([]);
  const [experiences, setExperiences] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [subscriptionPlans, setSubscriptionPlans] = useState(homepagePlanFallbacks);
  const [major, setMajor] = useState("");
  const [city, setCity] = useState("");
  const [highlightedPlanId, setHighlightedPlanId] = useState("");
  const [journeyReady, setJourneyReady] = useState(false);
  const [premiumPass, setPremiumPass] = useState(() => getStoredPremiumPass());
  const defaultPreviewsRef = useRef({ opportunities: [], experiences: [], interviews: [] });
  const pricingRef = useRef(null);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      fetchJson(`${API_BASE_URL}/api/home-stats`),
      fetchJson(`${API_BASE_URL}/api/opportunities`),
      fetchJson(`${API_BASE_URL}/api/experiences?limit=3`),
      fetchJson(`${API_BASE_URL}/api/interviews`),
      fetchJson(`${API_BASE_URL}/api/subscriptions/plans`),
    ]).then(([statsResult, opportunitiesResult, experiencesResult, interviewsResult, plansResult]) => {
      if (!alive) return;
      if (statsResult.status === "fulfilled") setStats(statsResult.value || {});
      const nextOpportunities = opportunitiesResult.status === "fulfilled" ? readCollection(opportunitiesResult.value).slice(0, 3) : [];
      const nextExperiences = experiencesResult.status === "fulfilled" ? readCollection(experiencesResult.value).slice(0, 2) : [];
      const nextInterviews = interviewsResult.status === "fulfilled" ? readCollection(interviewsResult.value).slice(0, 2) : [];
      defaultPreviewsRef.current = {
        opportunities: nextOpportunities,
        experiences: nextExperiences,
        interviews: nextInterviews,
      };
      setOpportunities(nextOpportunities);
      setExperiences(nextExperiences);
      setInterviews(nextInterviews);
      if (plansResult.status === "fulfilled") {
        setSubscriptionPlans(mergeHomepagePlans(readCollection(plansResult.value?.plans)));
      }
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!journeyReady || !major || !city) return;
    let alive = true;
    const params = new URLSearchParams({ major, city });
    const cityParams = new URLSearchParams({ city });

    const loadPreview = async (resource, limit) => {
      const exactParams = new URLSearchParams(params);
      exactParams.set("limit", String(limit));
      const exact = await fetchJson(`${API_BASE_URL}/api/${resource}?${exactParams.toString()}`);
      const exactItems = readCollection(exact).slice(0, limit);
      if (exactItems.length) return exactItems;

      const fallbackParams = new URLSearchParams(cityParams);
      fallbackParams.set("limit", String(limit));
      const cityOnly = await fetchJson(`${API_BASE_URL}/api/${resource}?${fallbackParams.toString()}`);
      return readCollection(cityOnly).slice(0, limit);
    };

    Promise.allSettled([
      loadPreview("opportunities", 3),
      loadPreview("experiences", 2),
      loadPreview("interviews", 2),
    ]).then(([opportunityResult, experienceResult, interviewResult]) => {
      if (!alive) return;
      if (opportunityResult.status === "fulfilled" && opportunityResult.value.length) {
        setOpportunities(opportunityResult.value);
      } else {
        setOpportunities(defaultPreviewsRef.current.opportunities);
      }
      if (experienceResult.status === "fulfilled" && experienceResult.value.length) {
        setExperiences(experienceResult.value);
      } else {
        setExperiences(defaultPreviewsRef.current.experiences);
      }
      if (interviewResult.status === "fulfilled" && interviewResult.value.length) {
        setInterviews(interviewResult.value);
      } else {
        setInterviews(defaultPreviewsRef.current.interviews);
      }
    });

    return () => { alive = false; };
  }, [city, journeyReady, major]);

  useEffect(() => {
    const refreshPremiumPass = () => setPremiumPass(getStoredPremiumPass());
    window.addEventListener(PREMIUM_STATUS_EVENT, refreshPremiumPass);
    window.addEventListener("storage", refreshPremiumPass);
    return () => {
      window.removeEventListener(PREMIUM_STATUS_EVENT, refreshPremiumPass);
      window.removeEventListener("storage", refreshPremiumPass);
    };
  }, []);

  useEffect(() => {
    if (window.location.hash !== "#pricing") return;

    const frame = window.requestAnimationFrame(() => {
      pricingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    return () => window.cancelAnimationFrame(frame);
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

  const beginJourney = () => setJourneyReady(true);
  const showResumePlan = () => {
    setHighlightedPlanId("darbak_resume");
    pricingRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const hasCurrentPlan = (plan) => {
    if (!premiumPass) return false;
    if (plan.id === "darbak_resume") {
      return passHasEntitlement(premiumPass, "resume_builder");
    }
    return premiumPass.planId === plan.id;
  };
  const resumeAccessActive = passHasEntitlement(premiumPass, "resume_builder");
  const activePlanLabel = premiumPass?.planId === "one_time_90"
    ? "دربك 90 يوم"
    : premiumPass?.planId === "darbak_plus"
      ? "دربك+"
      : "";
  const experienceUrl = () => {
    const params = new URLSearchParams();
    if (major) params.set("major", major);
    if (city) params.set("city", city);
    return `/experiences${params.toString() ? `?${params}` : ""}`;
  };
  const resumeJourneyCta = resumeAccessActive
    ? "جهّز تقديمي"
    : activePlanLabel
      ? "رقِّ إلى دربك + سيرتي"
      : getStoredAccessIdentity().contact
        ? "اشترك وابدأ"
        : "شوف باقة سيرتي";

  return (
    <main className="home-page" dir="rtl">
      <section className="home-hero">
        <HeroAtmosphere />
        <div className="home-hero-layout">
          <div className="home-hero-copy">
            <span className="home-eyebrow">منصة سعودية لرحلة التدريب التعاوني</span>
            <h1><span className="home-title-brand">دربك</span> معك من البحث عن جهة حتى <span className="home-title-brand">التقديم.</span></h1>
            <p>اكتشف الجهات والفرص، شوف تجارب ومقابلات الطلاب، وجهّز تقديمك لما تلقى الجهة المناسبة.</p>
          </div>
          <form className="home-start-card" onSubmit={(event) => { event.preventDefault(); beginJourney(); }}>
            <span className="home-start-kicker">ابدأ من هنا</span>
            <h2>خلّنا نرتب لك البداية</h2>
            <div className="home-start-fields">
              <label>التخصص
                <select required value={major} onChange={(event) => setMajor(event.target.value)}>
                  <option value="">اختر تخصصك</option>
                  {specializationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label>المدينة
                <select required value={city} onChange={(event) => setCity(event.target.value)}>
                  <option value="">اختر مدينتك</option>
                  {cityOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>
            <button className="home-button home-button-primary" type="submit">رتّب لي رحلتي <FiArrowLeft aria-hidden="true" /></button>
            <div className="home-start-flow">جهات وفرص مناسبة <i /> تجارب ومقابلات <i /> سيرتك وتقديمك</div>
          </form>
        </div>
      </section>

      {journeyReady && <section className="home-journey-result" aria-live="polite">
        <div className="home-journey-result-head"><span>رحلتك جاهزة</span><h2>ثلاث خطوات، ونبدأ بالأقرب لك</h2></div>
        <div className="home-journey-result-grid">
          <article><b>01</b><strong>اكتشف</strong><p>جهات وفرص تناسب تخصصك ومدينتك.</p><Link to={finderUrl()}>شوف الجهات والفرص <FiArrowLeft /></Link></article>
          <article><b>02</b><strong>اعرف قبل ما تقدم</strong><p>تجارب ومقابلات من طلاب سبقوك.</p><Link to={experienceUrl()}>شوف التجارب <FiArrowLeft /></Link></article>
          <article className="home-journey-resume"><b>03</b><span>ضمن باقة سيرتي ✨</span><strong>جهّز تقديمك</strong><p>سيرة مخصصة + خطاب تقديم + رسالة إيميل.</p>{activePlanLabel && <small>باقتك الحالية: {activePlanLabel}</small>}<Link to="/my-resume">{resumeJourneyCta} <FiArrowLeft /></Link></article>
        </div>
      </section>}

      <section className="home-story-section">
        <div className="home-story-grid">
          <div className="home-story-copy">
            <span>01 — وين أتدرب؟</span>
            <h2>مو لازم تبدأ بحثك <b>من الصفر.</b></h2>
            <p>دربك يرتب لك الجهات والفرص حسب تخصصك ومدينتك، ويجمع لك الخيارات التي تستحق تعرف عنها.</p>
            <ul>
              <li><FiCheck /> فلترة حسب التخصص والمدينة</li>
              <li><FiCheck /> جهات مقترحة وفرص حالية</li>
              <li><FiCheck /> معلومات تساعدك تبدأ التقديم</li>
            </ul>
            <Link className="home-story-link" to={finderUrl()}>استكشف الجهات <FiArrowLeft /></Link>
          </div>
          <div className="home-story-visual" aria-label="فرص وجهات من دربك">
            <div className="home-visual-head"><strong>جهات وفرص مناسبة</strong><span>محدثة من دربك</span></div>
            <div className="home-visual-list">
              {opportunities.slice(0, 3).map((opportunity) => (
                <Link className="home-story-item" key={opportunity._id} to={`/where-to-train?tab=opportunities&opportunity=${opportunity._id}`}>
                  <OpportunityLogo opportunity={opportunity} />
                  <div><strong>{opportunity.organizationName || "جهة تدريب"}</strong><small>{opportunity.title || "فرصة تدريب تعاوني"} · {opportunity.city || opportunity.cities?.[0] || "السعودية"}</small></div>
                </Link>
              ))}
              {!opportunities.length && <p className="home-empty-copy">تظهر الجهات والفرص الحالية هنا.</p>}
            </div>
          </div>
        </div>
      </section>

      <section className="home-story-section home-story-alt">
        <div className="home-story-grid home-story-reverse">
          <div className="home-story-visual" aria-label="تجارب الطلاب والمقابلات">
            <div className="home-visual-head"><strong>تجارب الطلاب</strong><span>من اللي سبقوك</span></div>
            <div className="home-visual-tabs"><Link to="/experiences">تجارب التدريب</Link><Link to="/interviews">المقابلات</Link></div>
            <div className="home-visual-list">
              {experiences.slice(0, 2).map((experience) => <Link className="home-story-note" key={experience._id} to={`/experiences/${experience._id}`}><strong>{experience.organizationName || experience.companyName || "تجربة تدريب"}</strong><small>{experience.major || experience.majorCategory || "تدريب تعاوني"} · {experience.city || "السعودية"}</small><p>{experience.description ? `“${experience.description.slice(0, 96)}${experience.description.length > 96 ? "…" : ""}”` : "اقرأ التجربة وتفاصيلها من الطالب."}</p></Link>)}
              {interviews[0] && <Link className="home-story-note home-interview-note" to="/interviews"><strong>مقابلة في {interviews[0].organizationName || "جهة تدريب"}</strong><small>{interviews[0].questionsCount || 0} أسئلة من تجارب الطلاب</small></Link>}
            </div>
          </div>
          <div className="home-story-copy">
            <span>02 — التجارب والمقابلات</span>
            <h2>اعرف الجهة <b>من اللي سبقوك.</b></h2>
            <p>تجارب التدريب والمقابلات قلب دربك. تعرف منها طبيعة الجهة والأسئلة والتجربة قبل ما تأخذ قرارك.</p>
            <ul><li><FiCheck /> تجارب تدريب حقيقية</li><li><FiCheck /> أسئلة وتجارب مقابلات</li><li><FiCheck /> تفاصيل تساعدك تستعد</li></ul>
            <Link className="home-story-link" to="/experiences">شوف التجارب <FiArrowLeft /></Link>
          </div>
        </div>
      </section>

      <section className="home-story-section">
        <div className="home-story-grid">
          <div className="home-story-copy">
            <span>03 — تجهيز التقديم</span>
            <i className="home-pack-access-badge">ضمن باقة سيرتي ✨</i>
            <h2>لقيت الجهة؟ <b>خلّ دربك يجهز تقديمك.</b></h2>
            <p>بدل ما تعيد تجهيز كل شيء لكل جهة، دربك يبرز الأنسب من بياناتك ويجهز لك ملف تقديم مرتبًا.</p>
            <ul><li><FiCheck /> سيرة مخصصة للجهة</li><li><FiCheck /> خطاب تقديم مختصر</li><li><FiCheck /> رسالة إيميل جاهزة</li></ul>
            <button className="home-button home-button-primary" type="button" onClick={showResumePlan}>شوف سيرتي ✨ <FiArrowLeft /></button>
          </div>
          <div className="home-story-visual home-pack-visual" aria-label="ملف تقديم متكامل">
            <div className="home-visual-head"><strong>ملف تقديمك</strong><span>3 من 3 جاهزة ✓</span></div>
            <div className="home-pack-cards">{[
              [FiFileText, "السيرة الذاتية", "جاهزة", "نسخة مخصصة للجهة"],
              [FiSend, "خطاب التقديم", "جاهز", "رسالة مهنية للجهة"],
              [FiMail, "رسالة الإيميل", "جاهزة", "مهيأة للإرسال"],
            ].map(([Icon, title, status, note]) => <div className="home-pack-card" key={title}><Icon /><span>✓ {status}</span><strong>{title}</strong><small>{note}</small></div>)}</div>
          </div>
        </div>
      </section>

      <section className="home-story-section home-story-alt">
        <div className="home-story-grid home-story-reverse">
          <div className="home-story-visual home-dashboard-visual" aria-label="تقديماتك محفوظة">
            <div className="home-visual-head"><strong>تقديماتي</strong><span>كلها في مكان واحد</span></div>
            {["السيرة الذاتية", "خطاب التقديم", "رسالة الإيميل"].map((item) => <div className="home-dashboard-row" key={item}><FiFolder /><div><strong>{item}</strong><small>محفوظ ضمن ملف التقديم للجهة</small></div><i /></div>)}
          </div>
          <div className="home-story-copy">
            <span>04 — تقديماتي</span>
            <h2>كل جهة لها ملفها. <b>وكلها محفوظة عندك.</b></h2>
            <p>ما تضيع بين نسخ السيرة والرسائل. كل تقديم محفوظ كملف مستقل وتقدر ترجع له وقت ما تحتاج.</p>
            <ul><li><FiCheck /> نسخة مستقلة لكل جهة</li><li><FiCheck /> السيرة والخطاب والإيميل معًا</li><li><FiCheck /> ترجع له من تقديماتي</li></ul>
            <Link className="home-story-link" to="/my-resume">افتح تقديماتي <FiArrowLeft /></Link>
          </div>
        </div>
      </section>

      <section className="home-pricing-section" aria-label="الباقات والاشتراكات" id="pricing" ref={pricingRef}>
        <div className="home-section-heading home-pricing-heading">
          <span>الاشتراك بسيط</span>
          <h2>اختر الباقة اللي تناسبك</h2>
        </div>
        <div className="home-pricing-grid">
          {subscriptionPlans.map((plan) => {
            const isResumePlan = plan.planKey === "darbak_resume" || plan.id === "darbak_resume";
            const isCurrentPlan = hasCurrentPlan(plan);
            const summary = isResumePlan
              ? `سيرة مخصصة + خطاب تقديم + رسالة إيميل · ${plan.aiResumeUsageLimit || 10} تخصيصات شهريًا`
              : plan.id === "one_time_90"
                ? "مناسبة لموسم البحث والتقديم للتدريب"
                : "استكشف الجهات والفرص والتجارب";
            const cta = isCurrentPlan ? (isResumePlan ? "افتح سيرتي" : "باقتك الحالية ✓") : "عرض التفاصيل";
            return (
              <article className={`home-pricing-card${isResumePlan ? " home-pricing-card-highlighted" : ""}${highlightedPlanId === plan.id ? " is-highlighted" : ""}`} key={plan.id}>
                <div>
                  <span>{plan.label}</span>
                  {isResumePlan && <small className="home-plan-new-badge">الجديد للتقديم</small>}
                  <strong>{formatPlanPrice(plan)} <em>{formatPlanPeriod(plan)}</em></strong>
                </div>
                <p>{summary}</p>
                {isCurrentPlan && isResumePlan ? <Link to="/my-resume">{cta}</Link> : <Link to={isCurrentPlan ? "#" : `/subscribe?plan=${plan.id}`} onClick={(event) => { if (isCurrentPlan) event.preventDefault(); }}>{cta}<FiArrowLeft aria-hidden="true" /></Link>}
              </article>
            );
          })}
          {!subscriptionPlans.length && <p className="home-plan-loading">تظهر الباقات الحالية هنا عند تحميلها.</p>}
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
        :root[data-theme="light"] .home-page { --app-bg: #062c2a; --app-surface: #0b3734; --app-surface-2: #10413d; --app-card: #0d3936; --app-text: #f2fffc; --app-text-soft: #c8e5e0; --app-muted: #94beb8; --app-muted-2: #d3ece8; --app-brand: #79dcd1; --app-brand-strong: #9aebe1; --app-brand-soft: rgba(121, 220, 209, .12); --app-brand-border: rgba(121, 220, 209, .38); --app-border: rgba(218, 255, 248, .14); --app-border-soft: rgba(218, 255, 248, .08); --app-input-bg: rgba(218, 255, 248, .055); --app-shadow: rgba(0, 20, 18, .32); background: #062c2a; }
        .home-page::before { content: ""; position: absolute; inset: 0; z-index: -2; pointer-events: none; opacity: .82; background-image: radial-gradient(circle, rgba(228, 255, 251, .48) 1px, transparent 1.6px), radial-gradient(circle, rgba(126, 222, 207, .32) 1px, transparent 1.5px), radial-gradient(circle, rgba(255, 255, 255, .24) .8px, transparent 1.4px), radial-gradient(ellipse at 20% 8%, rgba(59, 159, 154, .13), transparent 27%), radial-gradient(ellipse at 80% 50%, rgba(52, 121, 133, .08), transparent 29%); background-size: 137px 137px, 211px 211px, 89px 89px, auto, auto; background-position: 18px 29px, 83px 54px, 41px 9px, center, center; }
        .home-page::after { content: ""; position: absolute; z-index: -1; pointer-events: none; top: 390px; right: -18%; width: 70%; height: 620px; background: radial-gradient(ellipse, rgba(99, 213, 196, .06), transparent 67%); }
        .home-hero, .home-section, .home-company-section, .home-pricing-section, .home-resume-section { width: min(1200px, calc(100% - 40px)); margin-inline: auto; }
        .home-hero { position: relative; padding: 64px 0 46px; }
        .home-hero-atmosphere { position: absolute; inset-block: 0; left: 50%; width: 100vw; transform: translateX(-50%); overflow: hidden; pointer-events: none; opacity: .92; }
        .home-hero-atmosphere::before { content: ""; position: absolute; width: min(61%, 710px); height: 250px; top: 18%; left: -4%; border-radius: 50%; background: radial-gradient(ellipse, rgba(59, 159, 154, .18), rgba(52, 121, 133, .07) 38%, transparent 72%); filter: blur(6px); }
        .home-hero-atmosphere::after { content: ""; position: absolute; width: 370px; height: 250px; top: 7%; right: -12%; border-radius: 50%; background: radial-gradient(ellipse, rgba(126, 222, 207, .09), transparent 70%); filter: blur(8px); }
        .home-star { position: absolute; width: 5px; height: 5px; border-radius: 50%; background: rgba(238, 255, 251, .82); box-shadow: 0 0 10px rgba(211, 255, 246, .32); animation: homeTwinkle 3.6s ease-in-out infinite; }
        .home-star-one { top: 24%; right: 11%; }.home-star-two { top: 43%; right: 43%; animation-delay: .65s; }.home-star-three { top: 22%; left: 31%; animation-delay: 1.2s; }.home-star-four { bottom: 18%; left: 13%; animation-delay: 1.75s; }
        @keyframes homeTwinkle { 0%, 100% { opacity: .26; transform: scale(.75); } 50% { opacity: .86; transform: scale(1.15); } }
        .home-eyebrow, .home-section-heading > span, .home-resume-copy > span, .home-company-section > div > span, .home-diagnosis-copy > span, .home-plans-intro > span { color: var(--app-brand); font-weight: 900; font-size: 13px; }
        .home-eyebrow { display: inline-flex; padding: 5px 10px; border: 1px solid var(--app-brand-border); border-radius: 999px; background: var(--app-brand-soft); font-size: 11px; }
        .home-hero-layout { position: relative; z-index: 1; display: grid; grid-template-columns: minmax(0, 1.12fr) minmax(340px, .88fr); align-items: center; gap: 56px; }.home-hero-copy { max-width: 690px; }.home-hero h1 { margin: 16px 0 12px; font-size: clamp(42px, 5.2vw, 64px); line-height: 1.18; letter-spacing: -1px; }.home-title-brand { color: var(--app-brand); text-shadow: 0 0 22px var(--app-brand-soft); }.home-hero p { max-width: 600px; margin: 0; color: var(--app-text-soft); font-size: 17px; line-height: 1.9; }
        .home-button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 46px; padding: 0 18px; border-radius: 12px; font: inherit; font-weight: 900; text-decoration: none; cursor: pointer; transition: transform .18s ease, background .18s ease; }
        .home-button:hover { transform: translateY(-2px); }
        .home-button-primary { border: 1px solid transparent; background: var(--app-brand); color: #061212; box-shadow: 0 12px 28px var(--app-brand-soft); }
        .home-button-secondary { border: 1px solid var(--app-brand-border); background: transparent; color: var(--app-brand-strong); }
        .home-services-grid { position: relative; z-index: 1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; text-align: right; border: 1px solid var(--app-border); border-radius: 16px; background: var(--app-surface); overflow: hidden; }.home-service-card { position: relative; min-height: 150px; padding: 22px 22px 20px 48px; box-sizing: border-box; border-inline-start: 1px solid var(--app-border-soft); }.home-service-card:first-child { border-inline-start: 0; }.home-service-card:not(:last-child)::after { content: ""; position: absolute; width: 26px; height: 1px; bottom: 30px; left: -13px; background: var(--app-brand-border); z-index: 2; }.home-service-icon { width: 36px; height: 36px; display: grid; place-items: center; border: 1px solid var(--app-brand-border); border-radius: 11px; color: var(--app-brand); background: var(--app-brand-soft); }.home-service-card h3 { margin: 12px 0 4px; font-size: 19px; }.home-service-card p { margin: 0; color: var(--app-text-soft); font-size: 13px; line-height: 1.75; }.home-step-number { position: absolute; top: 20px; left: 20px; color: var(--app-brand); font-size: 11px; font-weight: 900; }
        .home-start-card { display: grid; gap: 13px; padding: 24px; border: 1px solid var(--app-brand-border); border-radius: 18px; background: var(--app-surface); box-shadow: 0 18px 46px var(--app-brand-soft); }.home-start-kicker { color: var(--app-brand); font-weight: 800; font-size: 12px; }.home-start-card h2 { margin: -6px 0 2px; font-size: 25px; }.home-start-fields { display: grid; gap: 10px; }.home-start-card label { display: grid; gap: 6px; color: var(--app-text-soft); font-weight: 700; font-size: 12px; }.home-start-card select { height: 47px; border: 1px solid var(--app-border); border-radius: 11px; background: var(--app-input-bg); color: var(--app-text); padding: 0 10px; font: inherit; }.home-start-card .home-button { width: 100%; margin-top: 1px; }.home-start-flow { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; padding-top: 7px; border-top: 1px solid var(--app-border-soft); color: var(--app-muted); font-size: 10px; font-weight: 700; line-height: 1.6; }.home-start-flow i { width: 8px; height: 1px; background: var(--app-brand-border); }
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
        .home-pricing-section { padding: 34px 0 38px; }.home-pricing-heading { text-align: center; }.home-pricing-heading p { max-width: 560px; margin: 10px auto 0; color: var(--app-text-soft); line-height: 1.8; }.home-pricing-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; max-width: 1040px; margin: 0 auto; }.home-pricing-card { display: grid; gap: 18px; padding: 22px; border: 1px solid var(--app-border); border-radius: 18px; background: var(--app-surface); transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease; }.home-pricing-card-highlighted { border-color: var(--app-brand-border); box-shadow: 0 16px 40px var(--app-brand-soft); }.home-pricing-card.is-highlighted { border-color: var(--app-brand); box-shadow: 0 0 0 3px var(--app-brand-soft), 0 18px 46px var(--app-brand-soft); transform: translateY(-3px); }.home-pricing-card-head { display: flex; align-items: start; justify-content: space-between; gap: 14px; }.home-pricing-card-head > div { display: grid; gap: 6px; }.home-pricing-card-head span { color: var(--app-brand); font-size: 19px; font-weight: 900; }.home-pricing-card-head small { width: fit-content; padding: 4px 8px; border-radius: 999px; color: var(--app-brand); background: var(--app-brand-soft); font-size: 10px; font-weight: 900; }.home-pricing-card-head strong { display: grid; text-align: left; font-size: 23px; white-space: nowrap; }.home-pricing-card-head em { color: var(--app-muted); font-size: 10px; font-style: normal; font-weight: 700; }.home-pricing-card ul { display: grid; gap: 9px; min-height: 102px; margin: 0; padding: 0; list-style: none; color: var(--app-text-soft); font-size: 13px; }.home-pricing-card li { display: flex; align-items: center; gap: 7px; }.home-pricing-card li svg { color: var(--app-brand); }.home-pricing-card .home-button { width: 100%; }.home-pricing-card .is-current-plan { opacity: .72; cursor: default; }.home-plan-loading { margin: 0; color: var(--app-muted); text-align: center; }
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
        .home-section { padding: 34px 0; }.home-journey-section { padding-top: 8px; }.home-section-heading { margin-bottom: 18px; }.home-finder-section { margin-top: 0; }.home-opportunities-section { padding-top: 20px; }
        .home-resume-section { display: grid; grid-template-columns: minmax(0, 1fr) 390px; align-items: center; gap: 34px; margin-top: 18px; padding: 26px 30px; box-sizing: border-box; border: 1px solid var(--app-brand-border); border-radius: 18px; background: var(--app-surface); }.home-resume-copy > span { color: var(--app-brand); font-weight: 800; font-size: 13px; }.home-resume-copy h2 { margin: 6px 0; font-size: clamp(23px, 2.6vw, 32px); }.home-resume-copy p { max-width: 570px; margin: 0 0 17px; color: var(--app-text-soft); line-height: 1.75; }.home-pack-preview-compact { grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 10px; box-shadow: none; }.home-pack-preview-compact .home-preview-row { grid-template-columns: 16px 1fr; gap: 6px; min-height: 52px; padding: 10px; font-size: 12px; }.home-pack-preview-compact .home-preview-row strong { font-size: 12px; }.home-pricing-section { padding: 28px 0 32px; }.home-pricing-heading { display: flex; align-items: baseline; justify-content: space-between; text-align: right; }.home-pricing-heading h2 { font-size: 25px; }.home-pricing-grid { grid-template-columns: repeat(3, 1fr); max-width: none; gap: 10px; }.home-pricing-card { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 7px 12px; min-height: 110px; padding: 16px; border-radius: 15px; }.home-pricing-card > div { display: grid; gap: 5px; }.home-pricing-card > div > span { color: var(--app-brand); font-weight: 800; font-size: 14px; }.home-pricing-card > div > strong { font-size: 19px; }.home-plan-new-badge { width: fit-content; padding: 3px 7px; border-radius: 999px; background: var(--app-brand-soft); color: var(--app-brand); font-size: 10px; font-weight: 800; }.home-pricing-card em { color: var(--app-muted); font-size: 10px; font-style: normal; font-weight: 600; }.home-pricing-card p { grid-column: 1 / -1; margin: 0; color: var(--app-text-soft); font-size: 12px; }.home-pricing-card > a { justify-self: end; color: var(--app-brand); font-size: 12px; font-weight: 800; text-decoration: none; white-space: nowrap; }
        .home-hero { padding: 82px 0 72px; }.home-hero-layout { grid-template-columns: minmax(0, 1fr) minmax(360px, .88fr); gap: 54px; }.home-hero h1 { max-width: 670px; font-size: clamp(38px, 4.4vw, 58px); line-height: 1.16; font-weight: 700; letter-spacing: -.03em; }.home-hero p { font-size: 18px; }.home-start-card { gap: 12px; padding: 26px; border: 1px solid color-mix(in srgb, var(--app-brand) 58%, var(--app-border)); border-radius: 22px; background: rgba(16, 23, 27, .98); box-shadow: 0 30px 92px rgba(0, 0, 0, .22), 0 0 0 1px rgba(126, 222, 207, .06) inset; }.home-start-card h2 { font-size: 27px; }.home-start-fields { grid-template-columns: 1fr 1fr; gap: 10px; margin: 5px 0 1px; }.home-start-card label { color: var(--app-text); font-weight: 800; }.home-start-card select { height: 52px; border-radius: 13px; border-color: var(--app-brand-border); }.home-start-card select:focus { outline: 0; border-color: var(--app-brand); box-shadow: 0 0 0 3px var(--app-brand-soft); }.home-start-card .home-button { min-height: 52px; }.home-start-flow { margin-top: 3px; font-size: 11px; }
        .home-journey-result { width: min(1180px, calc(100% - 40px)); margin: -20px auto 10px; padding: 20px; border: 1px solid var(--app-brand-border); border-radius: 18px; background: rgba(15, 23, 27, .96); box-shadow: 0 18px 46px var(--app-shadow); }.home-journey-result-head { display: flex; align-items: baseline; justify-content: space-between; gap: 18px; margin-bottom: 15px; }.home-journey-result-head span { color: var(--app-brand); font-weight: 900; font-size: 13px; }.home-journey-result-head h2 { margin: 0; font-size: 21px; }.home-journey-result-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }.home-journey-result-grid article { display: grid; align-content: start; gap: 7px; min-height: 150px; padding: 15px; border: 1px solid var(--app-border-soft); border-radius: 14px; background: var(--app-input-bg); }.home-journey-result-grid b { color: var(--app-brand); font-size: 11px; }.home-journey-result-grid strong { font-size: 17px; }.home-journey-result-grid p { min-height: 38px; margin: 0; color: var(--app-text-soft); font-size: 13px; line-height: 1.55; }.home-journey-result-grid small { color: var(--app-muted); font-size: 11px; }.home-journey-result-grid a { display: inline-flex; align-items: center; gap: 5px; margin-top: auto; color: var(--app-brand); font-size: 13px; font-weight: 900; text-decoration: none; }.home-journey-resume { border-color: var(--app-brand-border) !important; }.home-journey-resume > span, .home-pack-access-badge { width: fit-content; padding: 3px 7px; border: 1px solid var(--app-brand-border); border-radius: 999px; background: var(--app-brand-soft); color: var(--app-brand); font-size: 10px; font-style: normal; font-weight: 900; }
        .home-story-section { position: relative; padding: 80px 0; border-bottom: 1px solid var(--app-border); }.home-story-section::before { content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none; }.home-story-alt::before { background: rgba(10, 16, 19, .46); }.home-story-grid { width: min(1180px, calc(100% - 40px)); margin-inline: auto; display: grid; grid-template-columns: minmax(0, 1fr) minmax(360px, .92fr); gap: 64px; align-items: center; }.home-story-reverse .home-story-visual { order: 2; }.home-story-reverse .home-story-copy { order: 1; }.home-story-copy > span { color: var(--app-brand); font-size: 13px; font-weight: 900; }.home-story-copy h2 { max-width: 570px; margin: 9px 0 15px; font-size: clamp(36px, 4.6vw, 56px); line-height: 1.12; letter-spacing: -.035em; }.home-story-copy h2 b { color: var(--app-brand); font-weight: 900; }.home-story-copy > p { max-width: 550px; margin: 0; color: var(--app-text-soft); font-size: 16px; line-height: 1.9; }.home-story-copy ul { display: grid; gap: 10px; margin: 23px 0 0; padding: 0; list-style: none; color: var(--app-text-soft); font-size: 14px; }.home-story-copy li { display: flex; align-items: center; gap: 9px; }.home-story-copy li svg { width: 23px; height: 23px; padding: 5px; box-sizing: border-box; color: var(--app-brand); border: 1px solid var(--app-brand-border); border-radius: 7px; background: var(--app-brand-soft); }.home-story-link { display: inline-flex; align-items: center; gap: 7px; margin-top: 25px; color: var(--app-brand); font-weight: 900; text-decoration: none; }.home-story-visual { min-height: 330px; padding: 18px; box-sizing: border-box; border: 1px solid var(--app-border); border-radius: 20px; background: rgba(15, 23, 27, .94); box-shadow: 0 26px 70px rgba(0, 0, 0, .14); }.home-visual-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 2px 2px 14px; border-bottom: 1px solid var(--app-border-soft); }.home-visual-head strong { font-size: 14px; }.home-visual-head span { color: var(--app-brand); font-size: 11px; font-weight: 800; }.home-visual-list { display: grid; gap: 10px; margin-top: 14px; }.home-story-item, .home-story-note { display: grid; grid-template-columns: auto 1fr; gap: 11px; align-items: center; padding: 13px; border: 1px solid var(--app-border-soft); border-radius: 14px; background: var(--app-input-bg); color: var(--app-text); text-decoration: none; }.home-story-item:hover, .home-story-note:hover { border-color: var(--app-brand-border); }.home-opportunity-logo { width: 42px; height: 42px; min-width: 42px; display: grid; place-items: center; overflow: hidden; border: 1px solid var(--app-brand-border); border-radius: 14px; background: var(--app-brand-soft); color: var(--app-brand); }.home-opportunity-logo img { width: 25px; height: 25px; display: block; object-fit: contain; padding: 3px; box-sizing: border-box; border-radius: 6px; background: #ffffff; }.home-opportunity-logo b { width: 32px; height: 32px; display: grid; place-items: center; border: 1px solid var(--app-brand-border); border-radius: 10px; background: var(--app-input-bg); color: var(--app-brand); font-size: 18px; font-weight: 900; }.home-story-item div, .home-story-note { min-width: 0; }.home-story-item strong, .home-story-note strong, .home-pack-card strong, .home-dashboard-row strong { display: block; font-size: 14px; }.home-story-item small, .home-story-note small, .home-pack-card small, .home-dashboard-row small { display: block; margin-top: 4px; color: var(--app-muted); font-size: 11px; line-height: 1.5; }.home-visual-tabs { display: flex; gap: 8px; margin-top: 13px; }.home-visual-tabs a { padding: 6px 10px; border: 1px solid var(--app-brand-border); border-radius: 999px; color: var(--app-brand); background: var(--app-brand-soft); font-size: 11px; font-weight: 800; text-decoration: none; }.home-story-note { display: block; }.home-story-note p { margin: 8px 0 0; color: var(--app-text-soft); font-size: 12px; line-height: 1.75; }.home-interview-note { border-color: var(--app-brand-border); }.home-pack-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; margin-top: 15px; }.home-pack-card { position: relative; display: grid; align-content: start; gap: 7px; min-height: 138px; padding: 14px; border: 1px solid var(--app-border-soft); border-radius: 14px; background: var(--app-input-bg); }.home-pack-card > svg { width: 22px; height: 22px; color: var(--app-brand); }.home-pack-card > span { width: fit-content; padding: 3px 7px; border: 1px solid var(--app-brand-border); border-radius: 999px; color: var(--app-brand); background: var(--app-brand-soft); font-size: 10px; font-weight: 900; }.home-pack-card strong { font-size: 15px; }.home-pack-card small { line-height: 1.6; }.home-dashboard-row { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: center; margin-top: 11px; padding: 13px; border: 1px solid var(--app-border-soft); border-radius: 13px; background: var(--app-input-bg); }.home-dashboard-row > svg { color: var(--app-brand); }.home-dashboard-row i { width: 8px; height: 8px; border-radius: 50%; background: var(--app-brand); }
        @media (max-width: 800px) {
          .home-hero, .home-section, .home-company-section, .home-pricing-section, .home-resume-section { width: min(100% - 28px, 600px); }
          .home-hero { padding: 52px 0 48px; }.home-hero-atmosphere { left: 0; width: 100%; transform: none; }.home-hero-layout { grid-template-columns: 1fr; gap: 26px; }.home-hero h1 { font-size: 42px; }.home-hero p { font-size: 16px; }.home-start-card { padding: 20px; }.home-start-fields { grid-template-columns: 1fr; }.home-journey-result { width: min(100% - 28px, 600px); margin-top: -12px; padding: 15px; }.home-journey-result-head { display: block; }.home-journey-result-head h2 { margin-top: 4px; font-size: 19px; }.home-journey-result-grid { grid-template-columns: 1fr; }.home-journey-result-grid article { min-height: 0; }
          .home-section { padding: 27px 0; }.home-section-heading { margin-bottom: 16px; }.home-section-heading h2 { font-size: 26px; }.home-heading-inline, .home-heading-row { align-items: flex-start; flex-direction: column; }.home-finder-section { padding: 22px 18px; }.home-finder-layout { grid-template-columns: 1fr; gap: 16px; }.home-finder-form { grid-template-columns: 1fr; }.home-finder-form .home-button { width: 100%; }.home-preview-grid { grid-template-columns: 1fr; gap: 10px; }.home-content-card { min-height: 132px; }.home-resume-section { grid-template-columns: 1fr; gap: 18px; padding: 23px 18px; }.home-pack-preview-compact { grid-template-columns: 1fr; }.home-pricing-heading { display: block; }.home-pricing-grid { grid-template-columns: 1fr; }.home-pricing-card { min-height: 0; }.home-stats-grid { grid-template-columns: repeat(2, 1fr); }.home-stats-grid a:nth-child(3) { border-inline-start: 0; border-top: 1px solid var(--app-border-soft); }.home-stats-grid a:nth-child(4) { border-top: 1px solid var(--app-border-soft); }.home-company-section { grid-template-columns: auto 1fr; padding: 20px; }.home-company-section .home-button { grid-column: 1 / -1; width: 100%; }
          .home-story-section { padding: 52px 0; }.home-story-grid { width: min(100% - 28px, 600px); grid-template-columns: 1fr; gap: 28px; }.home-story-reverse .home-story-visual, .home-story-reverse .home-story-copy { order: initial; }.home-story-copy h2 { font-size: 34px; }.home-story-visual { min-height: 0; padding: 15px; }.home-pack-cards { grid-template-columns: 1fr; }.home-pack-card { min-height: 0; }.home-pricing-heading { display: block; }
        }
      `}</style>
    </main>
  );
};

export default HomePage;
