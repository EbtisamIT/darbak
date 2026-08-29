import React from "react";
import {
  formatResumeDateRange,
  getResumeDirection,
  getVisibleSectionOrder,
  hasEntryContent,
  stripHtml,
} from "./resumeDefaults";
import { estimateResumePages } from "./resumeValidation";
import { getLocalizedResumeForDisplay } from "./resumeLocalization";
import { getResumeEducationDisplay } from "./resumeEducationDisplay";

const labels = {
  ar: {
    summary: "النبذة المهنية",
    education: "التعليم",
    experience: "الخبرات",
    projects: "المشاريع",
    skills: "المهارات",
    certifications: "الدورات والشهادات",
    volunteering: "الأنشطة والتطوع",
    languages: "اللغات",
  },
  en: {
    summary: "Professional Summary",
    education: "Education",
    experience: "Experience",
    projects: "Projects",
    skills: "Skills",
    certifications: "Certifications",
    volunteering: "Activities & Volunteering",
    languages: "Languages",
  },
};

const getAchievementLines = (entry = {}) => {
  const achievements = Array.isArray(entry.achievements) ? entry.achievements : [];
  const lines = achievements
    .map((achievement) => achievement.text || stripHtml(achievement.html || ""))
    .filter(Boolean);
  return lines.length ? lines : [entry.description || entry.details].filter(Boolean);
};

const EntryPreview = ({ entry, language, sectionKey, personal }) => {
  const education = sectionKey === "education"
    ? getResumeEducationDisplay(entry, personal, language)
    : null;
  const date = formatResumeDateRange(entry, language);
  const subtitle = education?.subtitle || [entry.organization || entry.subtitle, entry.location]
    .filter(Boolean)
    .join(" • ");
  const title = education?.title || entry.title || entry.subtitle;
  const facts = education?.facts || [];

  return (
    <article className="resume-paper-entry">
      <div className="resume-paper-entry-head">
        <strong>{title}</strong>
        {date && !education && <span>{date}</span>}
      </div>
      {subtitle && <p className="resume-paper-muted">{subtitle}</p>}
      {facts.length > 0 && <p className="resume-paper-muted">{facts.join(" | ")}</p>}
      {!education && getAchievementLines(entry).length > 0 && (
        <ul>
          {getAchievementLines(entry).map((line, index) => (
            <li key={`${entry.id || entry.title}-${index}`}>{line}</li>
          ))}
        </ul>
      )}
    </article>
  );
};

const ResumePreview = ({ resume }) => {
  resume = getLocalizedResumeForDisplay(resume);
  const language = resume.settings?.language === "en" ? "en" : "ar";
  const direction = getResumeDirection(resume);
  const titles = labels[language];
  const personal = resume.personalInfo || {};
  const estimatedPages = estimateResumePages(resume);
  const headline =
    personal.headline ||
    personal.major ||
    (language === "en" ? "Professional profile" : "الملف المهني");
  const contactItems = [
    personal.email,
    personal.phone,
    personal.city,
  ].filter(Boolean);
  const accentColor = resume.settings?.accentColor || "#42cfc3";

  const renderSection = (sectionKey) => {
    if (sectionKey === "summary" && resume.summary) {
      return (
        <section className="resume-paper-section" key={sectionKey}>
          <h3>{titles.summary}</h3>
          <p>{resume.summary}</p>
        </section>
      );
    }

    if (["education", "experience", "projects", "certifications", "volunteering"].includes(sectionKey)) {
      const entries = sectionKey === "experience" ? resume.experience || resume.experiences : resume[sectionKey];
      const visibleEntries = (entries || []).filter(hasEntryContent);
      if (!visibleEntries.length) return null;

      return (
        <section className="resume-paper-section" key={sectionKey}>
          <h3>{titles[sectionKey]}</h3>
          {visibleEntries.map((entry) => (
            <EntryPreview key={entry.id || entry.title} entry={entry} language={language} sectionKey={sectionKey} personal={personal} />
          ))}
        </section>
      );
    }

    if (sectionKey === "skills" && resume.skills?.length) {
      return (
        <section className="resume-paper-section" key={sectionKey}>
          <h3>{titles.skills}</h3>
          <div className="resume-paper-chips">
            {resume.skills.map((skill) => (
              <span key={skill}>{skill}</span>
            ))}
          </div>
        </section>
      );
    }

    if (sectionKey === "languages" && resume.languages?.length) {
      const languages = resume.languages.filter((item) => item.name || item.level);
      if (!languages.length) return null;
      return (
        <section className="resume-paper-section" key={sectionKey}>
          <h3>{titles.languages}</h3>
          <div className="resume-paper-chips">
            {languages.map((item) => (
              <span key={item.id}>{[item.name, item.level].filter(Boolean).join(" - ")}</span>
            ))}
          </div>
        </section>
      );
    }

    return null;
  };

  return (
    <div
      className={`resume-paper density-${resume.settings?.density || "comfortable"} font-${
        resume.settings?.fontSize || "medium"
      } template-${resume.settings?.template || "clean"}`}
      dir={direction}
      style={{ "--resume-accent": accentColor }}
    >
      <header className="resume-paper-header">
        <h2>{personal.fullName || (language === "en" ? "Student Name" : "اسم الطالب")}</h2>
        <p>{headline}</p>
        <div>
          {contactItems.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </header>

      {getVisibleSectionOrder(resume).map(renderSection)}

      {!resume.summary &&
        !resume.skills.length &&
        !resume.projects.some(hasEntryContent) &&
        !resume.education.some(hasEntryContent) && (
          <div className="resume-paper-empty">
            ابدأ بكتابة بياناتك وستظهر هنا سيرة مرتبة قابلة للتحميل.
          </div>
        )}

      {estimatedPages > 1 && (
        <div className="resume-paper-page-note">المعاينة تقدّر السيرة بحوالي {estimatedPages} صفحات.</div>
      )}
    </div>
  );
};

export default ResumePreview;
