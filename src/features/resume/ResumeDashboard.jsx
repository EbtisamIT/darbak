import React from "react";
import {
  FiArrowLeft,
  FiClock,
  FiEdit3,
  FiZap,
} from "react-icons/fi";
import { getResumeCompletionItems } from "./resumeValidation";

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
}) => {
  const completed = getResumeCompletionItems(resume).filter(
    (item) => item.status === "complete"
  ).length;
  const completion = Math.round((completed / getResumeCompletionItems(resume).length) * 100);
  const usage = resume.access || {};
  const usageLabel = usage.aiResumeUsageLimit
    ? `${usage.aiResumeUsageCount || 0} / ${usage.aiResumeUsageLimit}`
    : "غير متاح";
  const usageProgress = usage.aiResumeUsageLimit
    ? Math.min(100, Math.round(((usage.aiResumeUsageCount || 0) / usage.aiResumeUsageLimit) * 100))
    : 0;
  const masterLanguage = resume.settings?.language === "en" ? "English" : "العربية";
  const englishVersion = versions.find(
    (version) => version.variantType === "translation" || version.language === "en"
  );
  const applicationPacks = versions.filter((version) => version.variantType === "tailored");
  const getPackIdentity = (version) => [
    version.companyName || version.applicationPack?.applicationInfo?.organizationName || "",
    version.applicationPack?.applicationInfo?.opportunityTitle || version.roleTitle || "",
  ].join("|").trim();
  const getPackContext = (version) => {
    const identity = getPackIdentity(version);
    const matchingPacks = applicationPacks.filter((candidate) => getPackIdentity(candidate) === identity);
    const occurrence = matchingPacks.findIndex((candidate) => candidate._id === version._id) + 1;
    const opportunityTitle = version.applicationPack?.applicationInfo?.opportunityTitle || version.roleTitle || "";
    const savedLabel = matchingPacks.length > 1 ? `تقديم محفوظ ${occurrence}` : "";

    return [opportunityTitle, savedLabel, version.applicationPack?.applicationInfo?.city, formatDate(version.updatedAt)]
      .filter(Boolean)
      .join(" · ");
  };
  const packStatus = (version, key) => version.applicationPack?.[key]?.status || "ready";
  const packLine = (version, key, label) => {
    const status = packStatus(version, key);
    return `${status === "ready" ? "✓" : status === "needs_input" ? "○" : "—"} ${label}${status === "needs_input" ? " تحتاج معلومة" : status === "unavailable" ? " غير متاحة" : ""}`;
  };

  if (!resumeExists) {
    return (
      <section className="resume-dashboard resume-dashboard-onboarding">
        <div className="resume-dashboard-hero">
          <span>سيرتي بدربك</span>
          <h2>نجهز سيرتك من معلوماتك في دربك.</h2>
          <p>عندنا بعض معلوماتك بالفعل، وبنسألك فقط عن الناقص.</p>
          <button type="button" onClick={onStartFromPortfolio}>
            ابدأ سيرتي <FiArrowLeft aria-hidden="true" />
          </button>
          <button type="button" className="resume-dashboard-text-action" onClick={onStartFromScratch}>
            أو ابدأ من الصفر
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="resume-dashboard">
      <div className="resume-dashboard-hero">
        <div>
          <span>سيرتي بدربك</span>
          <h2>كل سيرك في مكان واحد.</h2>
          <p>السيرة الأساسية هي مرجعك، والنسخ تبقى مستقلة لكل استخدام.</p>
        </div>
      </div>

      <div className="resume-dashboard-summary-grid">
        <article className="resume-dashboard-master-card">
          <div className="resume-dashboard-card-head">
            <span>سيرتي الأساسية</span>
            <FiEdit3 aria-hidden="true" />
          </div>
          <small className="resume-dashboard-language">{masterLanguage}</small>
          <strong>{completion}% مكتملة</strong>
          <p>آخر تعديل: {formatDate(resume.updatedAt)}</p>
          <div className="resume-dashboard-progress" aria-label={`اكتمال السيرة ${completion}%`}>
            <span style={{ width: `${completion}%` }} />
          </div>
          <button type="button" onClick={onOpenEditor}>
            فتح السيرة <FiArrowLeft aria-hidden="true" />
          </button>
          <button type="button" className="is-text" onClick={onEditProfile}>
            تعديل بيانات السيرة
          </button>
          <button type="button" className="is-text" onClick={onReviewResumeSetup}>
            ابدأ مراجعة بيانات السيرة من البداية
          </button>
          <button type="button" className="is-secondary" onClick={onCustomize}>
            <FiZap aria-hidden="true" /> تخصيص لفرصة
          </button>
          <button type="button" className="is-text" onClick={() => englishVersion ? onOpenVersion(englishVersion) : onCreateEnglish()}>
            {englishVersion ? "فتح النسخة الإنجليزية" : "إنشاء نسخة إنجليزية"}
          </button>
        </article>

        <article className="resume-dashboard-usage-card">
          <span>استخدامك هذا الشهر</span>
          <strong>{usage.aiResumeUsageLimit ? `${usage.aiResumeUsageCount || 0} من ${usage.aiResumeUsageLimit} تخصيصات` : usageLabel}</strong>
          {usage.aiResumeUsageLimit ? <div className="resume-dashboard-progress"><span style={{ width: `${usageProgress}%` }} /></div> : null}
        </article>
      </div>

      <div className="resume-dashboard-list-head">
        <div>
          <span>تقديماتي</span>
          <p>كل ملف تقديم محفوظ ومستقل عن سيرتك الأساسية.</p>
        </div>
      </div>

      {loadingVersions ? (
        <div className="resume-dashboard-empty">جاري تحميل النسخ المخصصة...</div>
      ) : applicationPacks.length ? (
        <div className="resume-dashboard-version-list">
          {applicationPacks.map((version) => (
            <article className="resume-dashboard-application-card" key={version._id}>
              <div>
                <strong>{version.companyName || version.name}</strong>
                <span>{getPackContext(version) || "تقديم مخصص"}</span>
                <span className="resume-dashboard-pack-status">{packLine(version, "resume", "السيرة الذاتية")} · {packLine(version, "trainingLetter", "خطاب التقديم")} · {packLine(version, "email", "الإيميل")}</span>
              </div>
              <button type="button" onClick={() => onOpenVersion(version)}>فتح ملف التقديم <FiArrowLeft aria-hidden="true" /></button>
            </article>
          ))}
        </div>
      ) : (
        <div className="resume-dashboard-empty">
          <FiClock aria-hidden="true" />
          <strong>ما جهزت ملف تقديم بعد.</strong>
          <span>افتح فرصة من دربك واختر «جهّز تقديمي لهذه الجهة» لنبدأ من بياناتك مباشرة.</span>
        </div>
      )}
    </section>
  );
};

export default ResumeDashboard;
