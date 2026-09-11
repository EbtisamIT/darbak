import React from "react";
import {
  FiArrowLeft,
  FiClock,
  FiEye,
  FiGlobe,
  FiMoreHorizontal,
  FiZap,
} from "react-icons/fi";
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

const ResumeDashboardHeader = ({ englishNeedsUpdate, hasEnglishVersion, onOpenResume, onReviewResume, onCreateCustomization, onOpenEnglish }) => (
  <header className="resume-dashboard-header">
    <div>
      <span>سيرتي بدربك</span>
      <h1>سيرتي</h1>
      <p>سيرتك الأساسية، التخصيصات، والترجمة من مكان واحد.</p>
    </div>
    <div className="resume-dashboard-header-actions">
      <button type="button" className="is-primary" onClick={onOpenResume}><FiEye aria-hidden="true" /> فتح السيرة</button>
      <button type="button" onClick={onReviewResume}>مراجعة وتحديث البيانات</button>
      <button type="button" onClick={onCreateCustomization}><FiZap aria-hidden="true" /> تخصيص لفرصة</button>
      <button type="button" onClick={onOpenEnglish}><FiGlobe aria-hidden="true" /> {hasEnglishVersion ? "النسخة الإنجليزية" : "إنشاء الإنجليزية"}{englishNeedsUpdate ? <small>تحتاج تحديث</small> : null}</button>
    </div>
  </header>
);
const ResumeMasterCard = ({ resume, factsFreshness, onOpenResume }) => (
  <section className="resume-dashboard-master-summary">
    <div className="resume-dashboard-master-thumbnail" aria-hidden="true">
      <strong>{resume.personalInfo?.fullName || "سيرتي"}</strong>
      <span>{resume.personalInfo?.headline || resume.personalInfo?.major || "السيرة الأساسية"}</span>
      <i /><i /><i />
    </div>
    <div>
      <span>السيرة الحالية · قالب {resume.settings?.template || "نظيف"}</span>
      <h2>{factsFreshness?.changed ? "تحتاج تحديث" : "محدثة ✓"}</h2>
      <p>آخر تحديث {relativeDate(resume.updatedAt)} · {formatDate(resume.updatedAt)}</p>
      <button type="button" onClick={onOpenResume}>فتح السيرة <FiArrowLeft aria-hidden="true" /></button>
    </div>
  </section>
);

const ResumeActionRequired = ({ factsFreshness, onReviewResume }) => {
  if (!factsFreshness?.changed) return null;
  return (
    <section className="resume-dashboard-action-required">
      <div>
        <span>تحديث مطلوب</span>
        <strong>عندك تغييرات جديدة لم تُطبّق على السيرة</strong>
      </div>
      <button type="button" onClick={onReviewResume}>تحديث السيرة <FiArrowLeft aria-hidden="true" /></button>
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

const ResumeDashboard = ({
  resume,
  resumeExists,
  versions = [],
  loadingVersions = false,
  onOpenResume,
  onReviewResumeSetup,
  onStartFromPortfolio,
  onStartFromScratch,
  onCustomize,
  onCreateEnglish,
  onOpenVersion,
  onViewAllCustomizations,
  factsFreshness = {},
  showAllCustomizations = false,
}) => {
  // The API returns newest first, but be explicit so historical duplicate
  // English translation records cannot make the dashboard open a stale copy.
  const englishVersion = versions
    .filter((version) => version.variantType === "translation" || version.language === "en")
    .sort((left, right) => new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0))[0];
  const customizations = versions.filter((version) => version.variantType === "tailored");
  // Opening an existing version and refreshing it are separate actions. A
  // stale flag must not strand the student on the dashboard or start AI work.
  const openEnglish = () => englishVersion ? onOpenVersion(englishVersion) : onCreateEnglish();

  if (!resumeExists) {
    return <section className="resume-dashboard resume-dashboard-onboarding"><div className="resume-dashboard-hero"><span>سيرتي بدربك</span><h2>نجهز سيرتك من معلوماتك في دربك.</h2><p>عندنا بعض معلوماتك بالفعل، وبنسألك فقط عن الناقص.</p><button type="button" onClick={onStartFromPortfolio}>ابدأ سيرتي <FiArrowLeft aria-hidden="true" /></button><button type="button" className="resume-dashboard-text-action" onClick={onStartFromScratch}>أو ابدأ من الصفر</button></div></section>;
  }

  return (
    <section className="resume-dashboard" dir="rtl">
      <ResumeDashboardHeader englishNeedsUpdate={Boolean(englishVersion?.needsLocalizationRefresh)} hasEnglishVersion={Boolean(englishVersion)} onOpenResume={onOpenResume} onReviewResume={onReviewResumeSetup} onCreateCustomization={onCustomize} onOpenEnglish={openEnglish} />
      {showAllCustomizations ? <>
        <div className="resume-dashboard-section-head"><div><span>تخصيصاتك</span><h2>كل نسخة جهزتها لفرصة تبقى محفوظة هنا بشكل مستقل.</h2></div><button type="button" onClick={onOpenResume}>العودة للسيرة</button></div>
        <RecentCustomizations versions={customizations} loading={loadingVersions} onOpen={onOpenVersion} title="" helper="" limit={customizations.length || 3} />
      </> : <>
        <ResumeMasterCard resume={resume} factsFreshness={factsFreshness} onOpenResume={onOpenResume} />
        <ResumeActionRequired factsFreshness={factsFreshness} onReviewResume={onReviewResumeSetup} />
        <RecentCustomizations versions={customizations} loading={loadingVersions} onOpen={onOpenVersion} limit={3} />
        {customizations.length > 3 ? <button type="button" className="resume-dashboard-all-customizations" onClick={onViewAllCustomizations}>عرض كل التخصيصات</button> : null}
      </>}
    </section>
  );
};

export default ResumeDashboard;
