import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  FiArrowLeft,
  FiBriefcase,
  FiClock,
  FiMessageCircle,
  FiStar,
} from "react-icons/fi";
import API_BASE_URL from "../config/api";
import { getOrganizationLogoUrl } from "../data/organizationLogos";
import { darbakGuideOrganizations } from "../data/darbakGuideSuggestions";
import { darbakContactDirectoryOrganizations } from "../data/darbakContactDirectory";
import { healthHospitalSuggestions } from "../data/healthHospitalSuggestions";
import { trainingInteractiveOrganizations } from "../data/trainingInteractiveDirectory";
import { trackEvent } from "../utils/analytics";
import "./CompaniesPage.css";

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getOpportunityCities = (opportunity) => {
  const cities = Array.isArray(opportunity.cities)
    ? opportunity.cities.filter(Boolean)
    : [];
  return cities.length > 0 ? cities : opportunity.city ? [opportunity.city] : [];
};

const getOpportunityPath = (opportunity) =>
  opportunity?._id || opportunity?.id
    ? `/where-to-train/opportunity/${opportunity._id || opportunity.id}`
    : "/where-to-train";

const normalizeCompanyName = (value = "") =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[أإآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getApplicationSuggestionsForCompany = (company = {}) => {
  const aliases = [company.name, company.nameAr, company.nameEn, ...(company.aliases || [])]
    .map(normalizeCompanyName)
    .filter((alias) => alias.length >= 3);
  if (!aliases.length) return [];
  const allSuggestions = [
    ...darbakGuideOrganizations,
    ...darbakContactDirectoryOrganizations,
    ...healthHospitalSuggestions,
    ...trainingInteractiveOrganizations,
  ];
  const seen = new Set();
  return allSuggestions.filter((item) => {
    const name = normalizeCompanyName(item.name);
    const matches = name && aliases.some((alias) => name === alias || name.includes(alias) || alias.includes(name));
    const key = `${name}|${item.email || (item.emails || [])[0] || item.applicationUrl || item.url || ""}`;
    if (!matches || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((item) => ({ ...item, sourceType: "application_suggestion" }));
};

function CompanyLogo({ company, logoUrl }) {
  const [hasFailed, setHasFailed] = useState(false);

  return (
    <span className="company-profile-logo" aria-hidden="true">
      {logoUrl && !hasFailed ? (
        <img src={logoUrl} alt="" onError={() => setHasFailed(true)} />
      ) : (
        company.name.slice(0, 1)
      )}
    </span>
  );
}

function EmptyCompanyState({ label, companyName = "هذه الجهة" }) {
  return (
    <div className="company-content-empty">
      <span>لا يوجد {label} حاليًا لـ{companyName}</span>
      <small>نضيف المحتوى المعتمد إلى هذه الصفحة أولًا بأول.</small>
    </div>
  );
}

function ExperienceCard({ experience, company, onOpen }) {
  const navigate = useNavigate();
  const experienceId = experience._id || experience.id;
  const summary = String(experience.description || "")
    .replace(/\s+/g, " ")
    .trim();

  return (
    <article
      className="company-content-card company-experience-card"
      role="button"
      tabIndex={0}
      onClick={() => { onOpen?.("experience", experienceId); if (experienceId) navigate(`/experiences/${experienceId}`); }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && experienceId) { onOpen?.("experience", experienceId); navigate(`/experiences/${experienceId}`); }
      }}
    >
      <div className="company-card-topline">
        <span className="company-card-icon"><FiStar aria-hidden="true" /></span>
        {experience.starRating ? <small>{experience.starRating}/5</small> : null}
      </div>
      <h3>{experience.title || `تجربة تدريب في ${company.name}`}</h3>
      <p>{[experience.major || experience.majorCategory, experience.city].filter(Boolean).join(" · ")}</p>
      {summary ? <em>{summary.slice(0, 122)}{summary.length > 122 ? "..." : ""}</em> : null}
      <span className="company-card-link">اقرأ التجربة <FiArrowLeft aria-hidden="true" /></span>
    </article>
  );
}

function InterviewCard({ interview, onOpen, company }) {
  return (
    <article className="company-content-card company-interview-card">
      <div className="company-card-topline">
        <span className="company-card-icon"><FiMessageCircle aria-hidden="true" /></span>
        <small>{interview.questionsCount || interview.questions?.length || 0} سؤال</small>
      </div>
      <h3>{interview.major || "تخصصات متعددة"}</h3>
      <p>{Array.isArray(interview.cities) && interview.cities.length ? interview.cities.join("، ") : "مقابلة تدريب"}</p>
      <button type="button" className="company-outline-button" onClick={() => onOpen(interview, company)}>
        عرض الأسئلة <FiArrowLeft aria-hidden="true" />
      </button>
    </article>
  );
}

function OpportunityCard({ opportunity, logoUrl, onOpen, company }) {
  const navigate = useNavigate();
  const cities = getOpportunityCities(opportunity);
  const isClosed =
    opportunity.status === "expired" ||
    (opportunity.deadline && new Date(opportunity.deadline) < new Date());

  return (
    <article
      className="company-content-card company-opportunity-card"
      role="button"
      tabIndex={0}
      onClick={() => { onOpen?.("opportunity", opportunity._id || opportunity.id); navigate(getOpportunityPath(opportunity)); }}
      onKeyDown={(event) => {
        if (event.key === "Enter") { onOpen?.("opportunity", opportunity._id || opportunity.id); navigate(getOpportunityPath(opportunity)); }
      }}
    >
      <div className="company-opportunity-heading">
        <span className="company-opportunity-mini-logo" aria-hidden="true">
          {logoUrl ? <img src={logoUrl} alt="" /> : "أ"}
        </span>
        <span className={isClosed ? "company-status is-closed" : "company-status"}>
          {isClosed ? "مغلق" : "مفتوح"}
        </span>
      </div>
      <h3>{opportunity.title || "فرصة تدريب"}</h3>
      <p>{cities.join("، ") || company.name}</p>
      <em>
        {(opportunity.specialties || opportunity.majorCategories || []).slice(0, 2).join("، ") || "تخصصات متعددة"}
      </em>
      {opportunity.deadline ? (
        <small className="company-deadline"><FiClock aria-hidden="true" /> ينتهي {formatDate(opportunity.deadline)}</small>
      ) : null}
      <span className="company-card-link">عرض الفرصة <FiArrowLeft aria-hidden="true" /></span>
    </article>
  );
}

function ApplicationSuggestionCard({ suggestion, company }) {
  const applicationPath = `/where-to-train?organization=${encodeURIComponent(suggestion.name || company.name)}`;
  const contactLabel = suggestion.contactType || (suggestion.email || suggestion.emails?.length ? "بريد للتقديم أو التواصل" : "طريقة تقديم من دليل دربك");
  return (
    <article className="company-content-card company-suggestion-card">
      <div className="company-card-topline"><span className="company-card-icon"><FiBriefcase aria-hidden="true" /></span><small>طريقة تقديم</small></div>
      <h3>{suggestion.name || company.name}</h3>
      <p>{contactLabel}</p>
      <em>{suggestion.note || "هذه قناة تقديم أو تواصل من دليل دربك وليست فرصة تدريب منشورة."}</em>
      <Link className="company-card-link" to={applicationPath}>عرض طريقة التقديم في وين أتدرب <FiArrowLeft aria-hidden="true" /></Link>
    </article>
  );
}

export default function CompanyProfilePage() {
  const { companySlug } = useParams();
  const [company, setCompany] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [content, setContent] = useState({
    experiences: [],
    interviews: [],
    opportunities: [],
    overview: null,
    applicationSuggestions: [],
  });
  const [experienceCity, setExperienceCity] = useState("");
  const [experienceMajor, setExperienceMajor] = useState("");
  const [selectedInterview, setSelectedInterview] = useState(null);
  const logoUrl = useMemo(() => company ? (company.logoUrl || getOrganizationLogoUrl({ name: company.name, url: company.website })) : "", [company]);

  useEffect(() => {
    let active = true;
    const loadContent = async () => {
      try {
        setLoading(true);
        setError("");
        const companyResponse = await axios.get(`${API_BASE_URL}/api/companies/${companySlug}/content`);
        const nextCompany = companyResponse.data?.company;
        if (!nextCompany) throw new Error("missing company");
        if (!active) return;
        setCompany(nextCompany);
        const applicationSuggestions = getApplicationSuggestionsForCompany(nextCompany);
        setContent({
          experiences: Array.isArray(companyResponse.data?.data?.experiences) ? companyResponse.data.data.experiences : [],
          interviews: Array.isArray(companyResponse.data?.data?.interviews) ? companyResponse.data.data.interviews : [],
          opportunities: Array.isArray(companyResponse.data?.data?.opportunities) ? companyResponse.data.data.opportunities : [],
          overview: { ...(companyResponse.data?.data?.overview || {}), applicationSuggestionsCount: applicationSuggestions.length },
          applicationSuggestions,
        });
      } catch (requestError) {
        if (active) setError("تعذر تحميل محتوى الشركة حاليًا. حاول مرة أخرى.");
      } finally {
        if (active) setLoading(false);
      }
    };

    loadContent();

    return () => {
      active = false;
    };
  }, [companySlug]);

  useEffect(() => {
    if (!company) return undefined;
    const previousTitle = document.title;
    const description = company.shortDescription || `تجارب وفرص التدريب في ${company.name} | دربك`;
    document.title = `تجارب وفرص التدريب في ${company.name} | دربك`;
    let meta = document.querySelector('meta[name="description"]');
    const createdMeta = !meta;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    const previousDescription = meta.content;
    meta.content = description;
    return () => {
      document.title = previousTitle;
      if (createdMeta) meta.remove(); else meta.content = previousDescription;
    };
  }, [company]);

  useEffect(() => {
    if (!company) return;
    trackEvent("company_page_viewed", { metadata: { companySlug: company.slug, companyName: company.name } });
  }, [company]);

  const tabs = [
    { id: "overview", label: "نظرة عامة" },
    { id: "experiences", label: "التجارب", count: content.experiences.length },
    { id: "interviews", label: "المقابلات", count: content.interviews.length },
    { id: "opportunities", label: "الفرص", count: content.opportunities.length },
  ];

  const experienceCities = useMemo(
    () => Array.from(new Set(content.experiences.map((item) => item.city).filter(Boolean))).sort(),
    [content.experiences]
  );
  const experienceMajors = useMemo(
    () => Array.from(new Set(content.experiences.map((item) => item.major || item.majorCategory).filter(Boolean))).sort(),
    [content.experiences]
  );
  const filteredExperiences = useMemo(() => content.experiences.filter((item) =>
    (!experienceCity || item.city === experienceCity) &&
    (!experienceMajor || (item.major || item.majorCategory) === experienceMajor)
  ), [content.experiences, experienceCity, experienceMajor]);

  const renderTab = () => {
    if (loading) return <div className="company-content-state">جارِ تحميل المحتوى...</div>;
    if (error) return <div className="company-content-state is-error">{error}</div>;

    if (activeTab === "overview") {
      const overview = content.overview || {};
      return (
        <div className="company-overview">
          <div className="company-overview-stats">
            <article><strong>{overview.experiencesCount || 0}</strong><span>تجربة منشورة</span></article>
            <article><strong>{overview.openOpportunitiesCount || 0}</strong><span>فرصة مفتوحة</span></article>
            <article><strong>{overview.interviewsCount || 0}</strong><span>مراجعة مقابلة</span></article>
          </div>
          {overview.applicationSuggestionsCount ? <div className="company-application-methods-note">طرق تقديم متاحة في وين أتدرب: {overview.applicationSuggestionsCount}</div> : null}
          <div className="company-overview-grid">
            <article className="company-overview-panel"><h2>المدن التي ظهر فيها التدريب</h2><div className="company-tags">{overview.cities?.length ? overview.cities.map((item) => <span key={item.label}>{item.label}<small>{item.count}</small></span>) : <p>تظهر المدن هنا عند توفرها داخل تجارب وفرص الجهة.</p>}</div></article>
            <article className="company-overview-panel"><h2>التخصصات الأكثر ظهورًا</h2><div className="company-tags">{overview.majors?.length ? overview.majors.map((item) => <span key={item.label}>{item.label}<small>{item.count}</small></span>) : <p>تظهر التخصصات هنا عند توفر محتوى مرتبط بالجهة.</p>}</div></article>
          </div>
          <div className="company-overview-latest">
            <article><h2>أحدث التجارب</h2>{content.experiences.slice(0, 2).map((item) => <button key={item._id || item.id} type="button" onClick={() => setActiveTab("experiences")}>{item.title || `تجربة تدريب في ${company.name}`}<small>{item.major || item.city || "اقرأ التفاصيل"}</small></button>)}{content.experiences.length === 0 && <p>لا توجد تجارب منشورة بعد.</p>}<button className="company-overview-link" type="button" onClick={() => setActiveTab("experiences")}>عرض كل التجارب</button></article>
            <article><h2>أحدث مراجعة مقابلة</h2>{content.interviews.slice(0, 1).map((item) => <button key={`${item.organizationName}-${item.major}`} type="button" onClick={() => { setActiveTab("interviews"); setSelectedInterview(item); }}>{item.major || "مقابلة تدريب"}<small>{item.questionsCount || 0} سؤال من طلاب سابقين</small></button>)}{content.interviews.length === 0 && <p>لا توجد مراجعات مقابلات بعد.</p>}<button className="company-overview-link" type="button" onClick={() => setActiveTab("interviews")}>عرض المقابلات</button></article>
            <article><h2>فرص الجهة</h2>{content.opportunities.filter((item) => item.status !== "expired").slice(0, 1).map((item) => <button key={item._id || item.id} type="button" onClick={() => setActiveTab("opportunities")}>{item.title || "فرصة تدريب"}<small>{getOpportunityCities(item).join("، ") || "فرصة مفتوحة"}</small></button>)}{!content.opportunities.some((item) => item.status !== "expired") && <p>لا توجد فرصة مفتوحة الآن.</p>}<button className="company-overview-link" type="button" onClick={() => setActiveTab("opportunities")}>شوف الفرص الحالية</button></article>
          </div>
        </div>
      );
    }

    if (activeTab === "experiences") {
      return content.experiences.length ? (<>
        <div className="company-content-filters">
          <select value={experienceCity} onChange={(event) => setExperienceCity(event.target.value)}><option value="">كل المدن</option>{experienceCities.map((city) => <option key={city} value={city}>{city}</option>)}</select>
          <select value={experienceMajor} onChange={(event) => setExperienceMajor(event.target.value)}><option value="">كل التخصصات</option>{experienceMajors.map((major) => <option key={major} value={major}>{major}</option>)}</select>
          {(experienceCity || experienceMajor) && <button type="button" onClick={() => { setExperienceCity(""); setExperienceMajor(""); }}>إلغاء التصفية</button>}
        </div>
        {filteredExperiences.length ? <div className="company-content-grid">
          {filteredExperiences.map((experience) => (
            <ExperienceCard
              key={experience._id || experience.id}
              experience={experience}
              company={company}
              onOpen={(contentType, itemId) => trackEvent("company_content_opened", { metadata: { companySlug: company.slug, companyName: company.name, contentType, itemId } })}
            />
          ))}
        </div> : <EmptyCompanyState label="تجارب مطابقة" companyName={company?.name} />}
      </>) : <EmptyCompanyState label="تجارب" companyName={company?.name} />;
    }

    if (activeTab === "interviews") {
      return content.interviews.length ? (
        <div className="company-content-grid company-interviews-grid">
          {content.interviews.map((interview) => (
            <InterviewCard
              key={`${interview.organizationName}-${interview.major}`}
              interview={interview}
              company={company}
              onOpen={(item) => { trackEvent("company_content_opened", { metadata: { companySlug: company.slug, companyName: company.name, contentType: "interview" } }); setSelectedInterview(item); }}
            />
          ))}
        </div>
      ) : <EmptyCompanyState label="مقابلات" companyName={company?.name} />;
    }

    return <div className="company-opportunities-section">
      {content.opportunities.length ? <div className="company-content-grid">
        {content.opportunities.map((opportunity) => (
          <OpportunityCard
            key={opportunity._id || opportunity.id}
            opportunity={opportunity}
            logoUrl={opportunity.logoUrl || logoUrl}
            company={company}
            onOpen={(contentType, itemId) => trackEvent("company_content_opened", { metadata: { companySlug: company.slug, companyName: company.name, contentType, itemId } })}
          />
        ))}
      </div> : <EmptyCompanyState label="فرص منشورة" companyName={company?.name} />}
      {content.applicationSuggestions.length ? <section className="company-application-suggestions"><div><h2>طرق التقديم على الجهة</h2><p>هذه قنوات من «وين أتدرب» وليست فرصًا منشورة حاليًا.</p></div><div className="company-content-grid">{content.applicationSuggestions.slice(0, 6).map((suggestion, index) => <ApplicationSuggestionCard key={`${suggestion.id || suggestion.name}-${index}`} suggestion={suggestion} company={company} />)}</div></section> : null}
    </div>;
  };

  if (!company && loading) return <main className="company-profile-page" dir="rtl"><div className="company-content-state">جارِ تحميل الشركة...</div></main>;
  if (!company) return <main className="company-profile-page" dir="rtl"><Link className="company-back-link" to="/companies"><FiArrowLeft aria-hidden="true" /> الشركات</Link><div className="company-content-state is-error">هذه الشركة غير متاحة في الدليل حاليًا.</div></main>;

  return (
    <main className="company-profile-page" dir="rtl">
      <Link className="company-back-link" to="/companies">
        <FiArrowLeft aria-hidden="true" /> الشركات
      </Link>

      <section className="company-profile-hero">
        <CompanyLogo company={company} logoUrl={logoUrl} />
        <div>
          <span className="company-profile-eyebrow">صفحة جهة تدريب</span>
          <h1>{company.name}</h1>
          <p>{company.shortDescription || `استكشف ما شاركه طلاب دربك عن التدريب والمقابلات والفرص المرتبطة بـ${company.name}.`}</p>
          <div className="company-profile-meta">
            <span><FiBriefcase aria-hidden="true" /> جهة تدريب في دربك</span>
          </div>
        </div>
      </section>

      <div className="company-tabs" role="tablist" aria-label={`محتوى ${company.name}`}>
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? "is-active" : ""}
            onClick={() => { setActiveTab(tab.id); trackEvent("company_tab_viewed", { metadata: { companySlug: company.slug, companyName: company.name, tab: tab.id } }); }}
          >
            {tab.label}
            {!loading && tab.id !== "overview" && <small>{tab.count}</small>}
          </button>
        ))}
      </div>

      <section className="company-content-section">{renderTab()}</section>

      {selectedInterview && (
        <div className="company-interview-overlay" onMouseDown={() => setSelectedInterview(null)}>
          <article className="company-interview-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="company-modal-close"
              onClick={() => setSelectedInterview(null)}
              aria-label="إغلاق"
            >
              ×
            </button>
            <span>أسئلة مقابلة {company.name}</span>
            <h2>{selectedInterview.major || "تخصصات متعددة"}</h2>
            <p>{selectedInterview.cities?.length ? selectedInterview.cities.join("، ") : "شاركها طلاب سابقون"}</p>
            <div className="company-interview-questions">
              {(selectedInterview.questions || []).map((question, index) => (
                <p key={`${question}-${index}`}>{question}</p>
              ))}
            </div>
          </article>
        </div>
      )}
    </main>
  );
}
