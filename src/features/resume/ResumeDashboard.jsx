import React, { useMemo, useState } from "react";
import {
  FiArrowLeft,
  FiClock,
  FiDownload,
  FiEdit3,
  FiEye,
  FiGlobe,
  FiMoreHorizontal,
  FiZap,
} from "react-icons/fi";
import { getResumeCompletionItems } from "./resumeValidation";
import { getEnglishReviewGroups } from "./EnglishTranslationReview";

const formatDate = (value) => {
  if (!value) return "لم تُحفظ بعد";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "تم الحفظ مؤخرًا";
  return new Intl.DateTimeFormat("ar-SA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
};

const relativeDate = (value) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "مؤخرًا";
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days <= 0) return "اليوم";
  if (days === 1) return "أمس";
  if (days < 7) return `قبل ${days} أيام`;
  return formatDate(value);
};

export const getResumeReviewSummary = (resume = {}) => {
  const groups = getEnglishReviewGroups(resume);
  const pending = groups.filter((group) => group.status === "pending").length;
  return { total: groups.length, pending, approved: groups.length - pending };
};

export const getCustomizationStatus = (version = {}) => {
  const pack = version.applicationPack || {};
  const review = getResumeReviewSummary(version.resumePayload || {});
  const hasEnglish = version.language === "en" || Boolean(version.resumePayload?.localizedDisplay);
  const packParts = [pack.resume, pack.trainingLetter, pack.email].filter(Boolean);
  const ready = packParts.length > 0 && packParts.every(
    (part) => part.status === "ready" || part.status === "unavailable"
  );
  return {
    state: review.pending ? "needs_review" : ready ? "ready" : "draft",
    pendingReviewCount: review.pending,
    hasArabic: version.language !== "en",
    hasEnglish,
    hasResume: pack.resume?.status === "ready",
    hasLetter: pack.trainingLetter?.status === "ready",
    hasEmail: pack.email?.status === "ready",
  };
};

const getPackIdentity = (version) => [
  version.companyName || version.applicationPack?.applicationInfo?.organizationName || "",
  version.applicationPack?.applicationInfo?.opportunityTitle || version.roleTitle || "",
].join("|").trim();

const getPackContext = (version, applicationPacks) => {
  const identity = getPackIdentity(version);
  const matchingPacks = applicationPacks.filter((candidate) => getPackIdentity(candidate) === identity);
  const occurrence = matchingPacks.findIndex((candidate) => candidate._id === version._id) + 1;
  const opportunityTitle = version.applicationPack?.applicationInfo?.opportunityTitle || version.roleTitle || "";
  const savedLabel = matchingPacks.length > 1 ? `تقديم محفوظ ${occurrence}` : "";
  return [opportunityTitle, savedLabel].filter(Boolean).join(" · ");
};

const ResumeDashboardHeader = ({ hasEnglishVersion, onOpenResume, onDownloadPdf, onCreateCustomization, onOpenEnglish }) => (
  <header className="resume-dashboard-header">
    <div>
      <span>سيرتي بدربك</span>
      <h1>سيرتي</h1>
      <p>سيرتك الأساسية، التخصيصات، والترجمة من مكان واحد.</p>
    </div>
    <div className="resume-dashboard-header-actions">
      <button type="button" onClick={onOpenResume}><FiEye aria-hidden="true" /> عرض السيرة</button>
      <button type="button" onClick={onDownloadPdf}><FiDownload aria-hidden="true" /> تحميل PDF</button>
      <button type="button" className="is-primary" onClick={onCreateCustomization}><FiZap aria-hidden="true" /> تخصيص لفرصة</button>
      <button type="button" onClick={onOpenEnglish}><FiGlobe aria-hidden="true" /> {hasEnglishVersion ? "النسخة الإنجليزية" : "إنشاء الإنجليزية"}</button>
    </div>
  </header>
);

const ResumeDashboardTabs = ({ activeTab, reviewCount, onChange }) => (
  <nav className="resume-dashboard-tabs" role="tablist" aria-label="أقسام سيرتي">
    {[
      ["overview", "نظرة عامة"],
      ["review", "مراجعة"],
      ["customizations", "التخصيصات"],
      ["english", "النسخة الإنجليزية"],
    ].map(([id, label]) => (
      <button key={id} type="button" role="tab" aria-selected={activeTab === id} className={activeTab === id ? "is-active" : ""} onClick={() => onChange(id)}>
        {label}{id === "review" && reviewCount ? <b>{reviewCount}</b> : null}
      </button>
    ))}
  </nav>
);

const ResumeStatusCards = ({ resume, completion, customizations, review, onOpenResume }) => (
  <div className="resume-dashboard-status-cards">
    <article>
      <span>السيرة الأساسية</span>
      <strong>{completion >= 100 ? "جاهزة" : "تحتاج مراجعة"}</strong>
      <button type="button" onClick={onOpenResume}>فتح السيرة</button>
    </article>
    <article>
      <span>التخصيصات</span>
      <strong>{customizations.length}</strong>
      <small>نسخ مستقلة للفرص</small>
    </article>
    <article className={review.pending ? "is-amber" : ""}>
      <span>بانتظار اعتمادك</span>
      <strong>{review.pending || "لا يوجد"}</strong>
      <small>{review.pending ? "ترجمة تحتاج مراجعة" : "كل الترجمات جاهزة"}</small>
    </article>
    <article>
      <span>آخر تحديث</span>
      <strong>{relativeDate(resume.updatedAt)}</strong>
      <small>{formatDate(resume.updatedAt)}</small>
    </article>
  </div>
);

const ResumeActionRequired = ({ review, englishVersion, onReview, onUpdateEnglish }) => {
  if (!review.pending && !englishVersion?.needsLocalizationRefresh) return null;
  const stale = englishVersion?.needsLocalizationRefresh;
  return (
    <section className="resume-dashboard-action-required">
      <div>
        <span>{stale ? "تحديث مطلوب" : "مطلوب منك"}</span>
        <strong>{stale ? "النسخة الإنجليزية تحتاج تحديث" : `لديك ${review.pending} ${review.pending === 1 ? "ترجمة تحتاج مراجعة" : "ترجمات تحتاج مراجعة"}`}</strong>
      </div>
      <button type="button" onClick={stale ? onUpdateEnglish : onReview}>{stale ? "تحديث النسخة الإنجليزية" : "مراجعة الترجمات"}<FiArrowLeft aria-hidden="true" /></button>
    </section>
  );
};

const CustomizationCard = ({ version, applicationPacks, onOpen }) => {
  const status = getCustomizationStatus(version);
  const company = version.companyName || version.applicationPack?.applicationInfo?.organizationName || version.name || "جهة تدريب";
  const title = getPackContext(version, applicationPacks) || "تقديم مخصص";
  return (
    <article className="resume-customization-card">
      <div className="resume-customization-logo" aria-hidden="true">{company.slice(0, 1)}</div>
      <div className="resume-customization-copy">
        <div><strong>{company}</strong><button type="button" aria-label="خيارات التخصيص"><FiMoreHorizontal aria-hidden="true" /></button></div>
        <span>{title}</span>
        <small>آخر تحديث {relativeDate(version.updatedAt || version.createdAt)}</small>
        <div className="resume-customization-badges">
          {status.hasResume ? <em>تم تخصيص النبذة</em> : null}
          {status.hasLetter ? <em>خطاب تقديم جاهز</em> : null}
          {status.hasEnglish ? <em>{status.pendingReviewCount ? `English يحتاج مراجعة (${status.pendingReviewCount})` : "عربي + English"}</em> : null}
        </div>
      </div>
      <div className="resume-customization-actions">
        <span className={`resume-customization-state is-${status.state}`}>{status.state === "ready" ? "جاهز" : status.state === "needs_review" ? "يحتاج مراجعة" : "مسودة"}</span>
        <button type="button" onClick={() => onOpen(version)}>فتح التخصيص <FiArrowLeft aria-hidden="true" /></button>
      </div>
    </article>
  );
};

const RecentCustomizations = ({ versions, loading, onOpen, limit = 3, title = "آخر التخصيصات", helper = "كل نسخة مستقلة عن سيرتك الأساسية." }) => (
  <section className="resume-dashboard-section">
    <header><div><h2>{title}</h2><p>{helper}</p></div></header>
    {loading ? <div className="resume-dashboard-empty">جاري تحميل التخصيصات...</div> : versions.length ? (
      <div className="resume-customization-list">{versions.slice(0, limit).map((version) => <CustomizationCard key={version._id} version={version} applicationPacks={versions} onOpen={onOpen} />)}</div>
    ) : <div className="resume-dashboard-empty"><FiClock aria-hidden="true" /><strong>ما جهزت تخصيص بعد.</strong><span>افتح فرصة واختر «جهّز تقديمي لهذه الجهة» لنبدأ من بياناتك.</span></div>}
  </section>
);

const ResumeReviewQueue = ({ review, onReview }) => (
  <section className="resume-dashboard-review-queue">
    <header><div><span>مراجعة البيانات</span><h2>{review.approved} من {review.total} تمت مراجعتها</h2></div><button type="button" onClick={onReview}>{review.pending ? "مراجعة الآن" : "فتح النسخة الإنجليزية"}</button></header>
    <div className="resume-dashboard-progress" aria-label={`${review.approved} من ${review.total} تمت مراجعتها`}><span style={{ width: `${review.total ? Math.round((review.approved / review.total) * 100) : 100}%` }} /></div>
    {review.pending ? <p>تظهر هنا العناصر التي تحتاج اعتمادك فقط، وبعد الاعتماد تبقى محفوظة في النسخة الإنجليزية.</p> : <p>لا توجد ترجمات معلقة حاليًا.</p>}
  </section>
);

const EnglishVersionTab = ({ englishVersion, review, onOpenEnglish, onReview }) => (
  <section className="resume-dashboard-english-tab">
    <div className={`resume-dashboard-english-status${review.pending ? " is-amber" : ""}`}>
      <FiGlobe aria-hidden="true" />
      <div><span>النسخة الإنجليزية</span><strong>{englishVersion?.needsLocalizationRefresh ? "تحتاج تحديث" : review.pending ? `تحتاج مراجعة ${review.pending} ${review.pending === 1 ? "عنصر" : "عناصر"}` : englishVersion ? "النسخة الإنجليزية جاهزة" : "لم تُنشأ بعد"}</strong></div>
      <button type="button" onClick={onOpenEnglish}>{englishVersion ? "فتح النسخة" : "إنشاء النسخة"}</button>
    </div>
    {englishVersion && <ResumeReviewQueue review={review} onReview={onReview} />}
  </section>
);

const ResumeDashboard = ({
  resume,
  resumeExists,
  versions = [],
  loadingVersions = false,
  onOpenEditor,
  onEditProfile,
  onReviewResumeSetup,
  onStartFromPortfolio,
  onStartFromScratch,
  onCustomize,
  onCreateEnglish,
  onOpenVersion,
  onDownloadPdf,
  onOpenEnglishReview,
  initialTab = "overview",
}) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const completionItems = getResumeCompletionItems(resume);
  const completion = Math.round((completionItems.filter((item) => item.status === "complete").length / completionItems.length) * 100);
  const englishVersion = versions.find((version) => version.variantType === "translation" || version.language === "en");
  const customizations = versions.filter((version) => version.variantType === "tailored");
  const review = useMemo(() => getResumeReviewSummary(englishVersion?.resumePayload || resume), [englishVersion?.resumePayload, resume]);
  // Opening an existing version and refreshing it are separate actions. A
  // stale flag must not strand the student on the dashboard or start AI work.
  const openEnglish = () => englishVersion ? onOpenVersion(englishVersion) : onCreateEnglish();

  if (!resumeExists) {
    return <section className="resume-dashboard resume-dashboard-onboarding"><div className="resume-dashboard-hero"><span>سيرتي بدربك</span><h2>نجهز سيرتك من معلوماتك في دربك.</h2><p>عندنا بعض معلوماتك بالفعل، وبنسألك فقط عن الناقص.</p><button type="button" onClick={onStartFromPortfolio}>ابدأ سيرتي <FiArrowLeft aria-hidden="true" /></button><button type="button" className="resume-dashboard-text-action" onClick={onStartFromScratch}>أو ابدأ من الصفر</button></div></section>;
  }

  return (
    <section className="resume-dashboard" dir="rtl">
      <ResumeDashboardHeader hasEnglishVersion={Boolean(englishVersion)} onOpenResume={onOpenEditor} onDownloadPdf={onDownloadPdf} onCreateCustomization={onCustomize} onOpenEnglish={openEnglish} />
      <ResumeDashboardTabs activeTab={activeTab} reviewCount={review.pending} onChange={setActiveTab} />
      {activeTab === "overview" && <>
        <ResumeStatusCards resume={resume} completion={completion} customizations={customizations} review={review} onOpenResume={onOpenEditor} />
        <ResumeActionRequired review={review} englishVersion={englishVersion} onReview={onOpenEnglishReview} onUpdateEnglish={onCreateEnglish} />
        <RecentCustomizations versions={customizations} loading={loadingVersions} onOpen={onOpenVersion} />
      </>}
      {activeTab === "review" && <ResumeReviewQueue review={review} onReview={onOpenEnglishReview} />}
      {activeTab === "customizations" && <><div className="resume-dashboard-section-head"><div><span>تخصيصاتك</span><h2>كل نسخة جهزتها لفرصة تبقى محفوظة هنا بشكل مستقل.</h2></div><button type="button" onClick={onCustomize}>+ تخصيص لفرصة</button></div><RecentCustomizations versions={customizations} loading={loadingVersions} onOpen={onOpenVersion} title="" helper="" limit={customizations.length || 3} /></>}
      {activeTab === "english" && <EnglishVersionTab englishVersion={englishVersion} review={review} onOpenEnglish={openEnglish} onReview={onOpenEnglishReview} />}
      <button type="button" className="resume-dashboard-profile-link" onClick={onEditProfile}><FiEdit3 aria-hidden="true" /> تعديل بيانات السيرة</button>
      <button type="button" className="resume-dashboard-review-link" onClick={onReviewResumeSetup}>مراجعة بيانات السيرة من البداية</button>
    </section>
  );
};

export default ResumeDashboard;
