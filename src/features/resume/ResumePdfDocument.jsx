import React from "react";
import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import {
  formatResumeDateRange,
  getResumeDirection,
  getVisibleSectionOrder,
  hasEntryContent,
  stripHtml,
} from "./resumeDefaults";
import { getLocalizedResumeForDisplay } from "./resumeLocalization";
import { getResumeEducationDisplay } from "./resumeEducationDisplay";
import {
  getAtsClassicSectionOrder,
  getResumeEntryTools,
  isAtsClassicTemplate,
} from "./resumeAtsClassic";

// React PDF fetches fonts outside the normal React asset pipeline. Using an
// absolute URL keeps the font available in local development and production.
const pdfFontBaseUrl = process.env.NODE_ENV === "test"
  ? `${process.cwd()}/public`
  : typeof window !== "undefined"
    ? window.location.origin
    : "";

Font.register({
  family: "Tajawal",
  fonts: [
    { src: `${pdfFontBaseUrl}/fonts/Tajawal-Regular.ttf`, fontWeight: 400 },
    { src: `${pdfFontBaseUrl}/fonts/Tajawal-Bold.ttf`, fontWeight: 700 },
  ],
});

const INK = "#17201f";
const MUTED = "#65706f";
const LINE = "#d9e5e2";
const ATS_INK = "#152433";
const ATS_MUTED = "#65727d";
const ATS_LINE = "#cfdcda";
const ATS_ACCENT = "#2a9b90";

const fontSizes = {
  small: {
    body: 9.2,
    section: 11,
    name: 22,
    title: 10.5,
  },
  medium: {
    body: 10,
    section: 12,
    name: 24,
    title: 11.5,
  },
  large: {
    body: 11,
    section: 13,
    name: 26,
    title: 12.5,
  },
};

const createStyles = (resume = {}) => {
  const direction = getResumeDirection(resume);
  const isAtsClassic = isAtsClassicTemplate(resume);
  const isArabic = resume.settings?.language !== "en";
  const isCompact = !isAtsClassic && resume.settings?.density === "compact";
  const sizes = isAtsClassic
    ? {
      body: isArabic ? 10.2 : 9.8,
      section: isArabic ? 12.5 : 12.25,
      name: 22,
      title: isArabic ? 11.8 : 11.5,
      itemTitle: isArabic ? 11 : 10.8,
      metadata: isArabic ? 9.7 : 9.4,
    }
    : fontSizes[resume.settings?.fontSize || "medium"] || fontSizes.medium;
  const accent = isAtsClassic ? ATS_ACCENT : resume.settings?.accentColor || "#42cfc3";
  const ink = isAtsClassic ? ATS_INK : INK;
  const muted = isAtsClassic ? ATS_MUTED : MUTED;
  const line = isAtsClassic ? ATS_LINE : LINE;

  return StyleSheet.create({
    page: {
      paddingTop: isAtsClassic ? 43 : isCompact ? 28 : 34,
      paddingHorizontal: isAtsClassic ? 48 : isCompact ? 34 : 40,
      paddingBottom: isAtsClassic ? 43 : isCompact ? 26 : 32,
      fontFamily: isAtsClassic && !isArabic ? "Helvetica" : "Tajawal",
      fontSize: sizes.body,
      color: ink,
      lineHeight: isAtsClassic ? 1.32 : 1.45,
      direction,
      textAlign: direction === "rtl" ? "right" : "left",
    },
    header: {
      paddingBottom: isAtsClassic ? 12 : 12,
      borderBottomWidth: isAtsClassic ? 1 : 2,
      borderBottomColor: accent,
      marginBottom: isAtsClassic ? 10 : isCompact ? 10 : 14,
    },
    name: {
      fontSize: sizes.name,
      fontWeight: 700,
      marginBottom: isAtsClassic ? 3 : 3,
      color: ink,
      letterSpacing: isAtsClassic && !isArabic ? -0.15 : 0,
    },
    headline: {
      fontSize: sizes.title,
      color: isAtsClassic ? "#304353" : accent,
      fontWeight: isAtsClassic ? 400 : 700,
      marginBottom: isAtsClassic ? 6 : 7,
    },
    contactLine: {
      color: muted,
      fontSize: isAtsClassic ? 9.2 : sizes.body - 1,
      lineHeight: isAtsClassic ? 1.35 : 1.45,
    },
    section: {
      marginTop: isAtsClassic ? 12 : isCompact ? 8 : 12,
      breakInside: "avoid",
    },
    sectionTitle: {
      fontSize: sizes.section,
      fontWeight: 700,
      color: isAtsClassic ? ink : accent,
      marginBottom: isAtsClassic ? 5 : 5,
      paddingBottom: isAtsClassic ? 3 : 3,
      borderBottomWidth: 1,
      borderBottomColor: line,
    },
    paragraph: {
      color: ink,
      marginBottom: isAtsClassic ? 2 : 3,
    },
    entry: {
      marginBottom: isAtsClassic ? 8 : isCompact ? 6 : 8,
      breakInside: "avoid",
    },
    entryTitle: {
      fontWeight: 700,
      color: ink,
      fontSize: isAtsClassic ? sizes.itemTitle : sizes.body,
      lineHeight: isAtsClassic ? 1.25 : 1.45,
      marginBottom: isAtsClassic ? 2 : 1,
    },
    entryDate: {
      color: muted,
      fontSize: isAtsClassic ? sizes.metadata : sizes.body - 1,
      lineHeight: isAtsClassic ? 1.3 : 1.45,
      marginBottom: isAtsClassic ? 3 : 2,
    },
    entrySub: {
      color: muted,
      fontSize: isAtsClassic ? sizes.metadata : sizes.body - 0.5,
      lineHeight: isAtsClassic ? 1.3 : 1.45,
      marginBottom: isAtsClassic ? 3 : 2,
    },
    toolsLine: {
      color: muted,
      fontSize: isAtsClassic ? sizes.metadata : sizes.body - 0.5,
      lineHeight: 1.3,
      marginBottom: isAtsClassic ? 3 : 2,
    },
    bulletLine: {
      marginTop: 2,
      paddingLeft: isAtsClassic && !isArabic ? 8 : 0,
      paddingRight: isAtsClassic && isArabic ? 8 : 0,
      color: ink,
    },
    languageList: {
      display: "flex",
      flexDirection: "column",
      gap: 3,
    },
    skillsLine: {
      color: ink,
      lineHeight: isAtsClassic ? 1.45 : 1.6,
    },
    link: {
      color: "#167a73",
      textDecoration: "none",
    },
    footer: {
      position: "absolute",
      left: 40,
      right: 40,
      bottom: 16,
      color: "#99a3a1",
      fontSize: 8,
      textAlign: "center",
    },
  });
};

const sectionTitles = {
  ar: {
    summary: "النبذة المهنية",
    education: "التعليم",
    experience: "الخبرات",
    projects: "المشاريع",
    skills: "المهارات",
    certifications: "الشهادات",
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

const atsClassicSectionTitles = {
  ...sectionTitles,
  ar: {
    ...sectionTitles.ar,
    certifications: "الدورات والشهادات",
  },
};

const getAchievementLines = (entry = {}) => {
  const achievements = Array.isArray(entry.achievements) ? entry.achievements : [];
  const lines = achievements
    .map((achievement) => achievement.text || stripHtml(achievement.html || ""))
    .filter(Boolean);
  if (lines.length) return lines;
  return [entry.description || entry.details].filter(Boolean);
};

const getCertificationDetails = (entry = {}) => {
  const year = String(entry.startDate || entry.period || entry.endDate || "").match(/\d{4}/)?.[0] || "";
  return [entry.organization || entry.subtitle, year].filter(Boolean).join(" | ");
};

const ResumeSection = ({ title, children, styles, atsClassic = false }) => {
  if (!children) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} minPresenceAhead={atsClassic ? 40 : 0}>{title}</Text>
      {children}
    </View>
  );
};

const EntryList = ({ entries = [], styles, language, sectionKey, personal, resume, atsClassic }) => {
  const visibleEntries = entries.filter(hasEntryContent);
  if (!visibleEntries.length) return null;

  return visibleEntries.map((entry) => {
    const education = sectionKey === "education"
      ? getResumeEducationDisplay(entry, personal, language, resume)
      : null;
    const isCertification = sectionKey === "certifications";
    const date = isCertification ? "" : formatResumeDateRange(entry, language);
    const title = education?.title || entry.title || entry.subtitle;
    const facts = education?.facts || [];
    const tools = sectionKey === "projects" ? getResumeEntryTools(entry) : [];
    const metadataSeparator = atsClassic ? " - " : " • ";
    const displaySubtitle = education?.subtitle || (isCertification
      ? getCertificationDetails(entry)
      : [entry.organization || entry.subtitle, entry.location].filter(Boolean).join(metadataSeparator));
    const displayDate = atsClassic ? date.replace(/ – /g, " - ") : date;

    return (
      <View key={entry.id || entry.title} style={styles.entry} wrap={atsClassic}>
        <Text style={styles.entryTitle} minPresenceAhead={atsClassic ? 32 : 0}>{title}</Text>
        {!atsClassic && displayDate && !education ? <Text style={styles.entryDate}>{displayDate}</Text> : null}
        {displaySubtitle ? <Text style={styles.entrySub}>{displaySubtitle}</Text> : null}
        {atsClassic && displayDate && !education ? <Text style={styles.entryDate}>{displayDate}</Text> : null}
        {facts.length ? <Text style={styles.entrySub}>{facts.join(" | ")}</Text> : null}
        {atsClassic && tools.length ? <Text style={styles.toolsLine}>{tools.join(", ")}</Text> : null}
        {!education && getAchievementLines(entry).map((line, index) => (
          <Text key={`${entry.id || entry.title}-${index}`} style={styles.bulletLine}>
            {`${atsClassic ? "-" : "•"} ${line}`}
          </Text>
        ))}
      </View>
    );
  });
};

const ResumePdfDocument = ({ resume = {} }) => {
  resume = getLocalizedResumeForDisplay(resume);
  const atsClassic = isAtsClassicTemplate(resume);
  const styles = createStyles(resume);
  const language = resume.settings?.language === "en" ? "en" : "ar";
  const titles = (atsClassic ? atsClassicSectionTitles : sectionTitles)[language];
  const personal = resume.personalInfo || {};
  const order = atsClassic ? getAtsClassicSectionOrder(resume) : getVisibleSectionOrder(resume);
  const headline =
    personal.headline ||
    [personal.major, personal.university].filter(Boolean).join(" - ") ||
    (language === "en" ? "Co-op Training Candidate" : "مرشح للتدريب التعاوني");
  const contactItems = [
    personal.email,
    personal.phone,
    personal.city,
  ].filter(Boolean);

  const renderSection = (sectionKey) => {
    if (sectionKey === "summary" && resume.summary) {
      return (
        <ResumeSection key={sectionKey} title={titles.summary} styles={styles} atsClassic={atsClassic}>
          <Text style={styles.paragraph}>{resume.summary}</Text>
        </ResumeSection>
      );
    }

    if (["education", "experience", "projects", "certifications", "volunteering"].includes(sectionKey)) {
      const entries = sectionKey === "experience" ? resume.experience || resume.experiences : resume[sectionKey];
      if (!entries?.some(hasEntryContent)) return null;
      return (
        <ResumeSection key={sectionKey} title={titles[sectionKey]} styles={styles} atsClassic={atsClassic}>
          <EntryList entries={entries} styles={styles} language={language} sectionKey={sectionKey} personal={personal} resume={resume} atsClassic={atsClassic} />
        </ResumeSection>
      );
    }

    if (sectionKey === "skills" && resume.skills?.length) {
      return (
        <ResumeSection key={sectionKey} title={titles.skills} styles={styles} atsClassic={atsClassic}>
          <Text style={styles.skillsLine}>{resume.skills.join(" | ")}</Text>
        </ResumeSection>
      );
    }

    if (sectionKey === "languages" && resume.languages?.length) {
      return (
        <ResumeSection key={sectionKey} title={titles.languages} styles={styles} atsClassic={atsClassic}>
          <View style={styles.languageList}>
            {resume.languages
              .filter((languageItem) => languageItem.name || languageItem.level)
              .map((languageItem) => (
                <Text key={languageItem.id} style={styles.entrySub}>
                  {[languageItem.name, languageItem.level].filter(Boolean).join(atsClassic ? " - " : " — ")}
                </Text>
              ))}
          </View>
        </ResumeSection>
      );
    }

    return null;
  };

  return (
    <Document title={personal.fullName || "Darbak CV"}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.name}>{personal.fullName || (language === "en" ? "Student Name" : "اسم الطالب")}</Text>
          <Text style={styles.headline}>{headline}</Text>
          <Text style={styles.contactLine}>{contactItems.join(" | ")}</Text>
        </View>

        {order.map(renderSection)}

        {!atsClassic ? <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        /> : null}
      </Page>
    </Document>
  );
};

export default ResumePdfDocument;
