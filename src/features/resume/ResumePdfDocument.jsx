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
  getAtsClassicDensityMode,
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

const atsDensityStyles = {
  short: {
    pageVerticalPadding: 46,
    lineHeight: 1.38,
    sectionBefore: 18.5,
    smallSectionBefore: 20,
    headingAfter: 7,
    itemGap: 11.75,
    headerPadding: 15,
    headerAfter: 14,
    nameAfter: 4,
    headlineAfter: 8,
  },
  medium: {
    pageVerticalPadding: 43,
    lineHeight: 1.32,
    sectionBefore: 12,
    headingAfter: 5,
    itemGap: 8,
    headerPadding: 12,
    headerAfter: 10,
    nameAfter: 3,
    headlineAfter: 6,
  },
  long: {
    pageVerticalPadding: 40,
    lineHeight: 1.27,
    sectionBefore: 10,
    headingAfter: 4,
    itemGap: 6.5,
    headerPadding: 10,
    headerAfter: 8,
    nameAfter: 2,
    headlineAfter: 5,
  },
};

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

const createStyles = (resume = {}, rewardPresentation = false) => {
  const rewardV11 = rewardPresentation === "v11";
  const direction = getResumeDirection(resume);
  const isAtsClassic = isAtsClassicTemplate(resume);
  const atsDensity = isAtsClassic ? getAtsClassicDensityMode(resume) : "medium";
  const atsSpacing = atsDensityStyles[atsDensity];
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
      paddingTop: rewardV11 && isAtsClassic ? 34 : isAtsClassic ? atsSpacing.pageVerticalPadding : isCompact ? 28 : 34,
      paddingHorizontal: isAtsClassic ? 48 : isCompact ? 34 : 40,
      paddingBottom: rewardV11 && isAtsClassic ? 30 : isAtsClassic ? atsSpacing.pageVerticalPadding : isCompact ? 26 : 32,
      fontFamily: isAtsClassic && !isArabic ? "Helvetica" : "Tajawal",
      fontSize: sizes.body,
      color: ink,
      lineHeight: isAtsClassic ? atsSpacing.lineHeight : 1.45,
      direction,
      textAlign: direction === "rtl" ? "right" : "left",
    },
    header: {
      paddingBottom: isAtsClassic ? atsSpacing.headerPadding : 12,
      borderBottomWidth: isAtsClassic ? 1 : 2,
      borderBottomColor: accent,
      marginBottom: rewardV11 && isAtsClassic ? 8 : isAtsClassic ? atsSpacing.headerAfter : isCompact ? 10 : 14,
    },
    name: {
      fontSize: sizes.name,
      fontWeight: 700,
      marginBottom: rewardPresentation && !isArabic ? 0 : isAtsClassic ? atsSpacing.nameAfter : 3,
      lineHeight: rewardPresentation ? 1.25 : undefined,
      color: ink,
      letterSpacing: isAtsClassic && !isArabic ? -0.15 : 0,
    },
    headline: {
      fontSize: sizes.title,
      color: isAtsClassic ? "#304353" : accent,
      fontWeight: isAtsClassic ? 400 : 700,
      marginBottom: rewardPresentation && !isArabic ? 8 : isAtsClassic ? atsSpacing.headlineAfter : 7,
      lineHeight: rewardPresentation ? 1.35 : undefined,
    },
    rewardEnglishNameGap: { height: 8 },
    contactLine: {
      color: muted,
      fontSize: isAtsClassic ? 9.2 : sizes.body - 1,
      lineHeight: isAtsClassic ? 1.35 : 1.45,
    },
    rewardContactRow: {
      flexDirection: isArabic ? "row-reverse" : "row",
      flexWrap: "wrap",
      alignItems: "center",
    },
    rewardContactItem: {
      color: muted,
      fontSize: 9.2,
      lineHeight: 1.35,
    },
    rewardContactSeparator: {
      color: muted,
      fontSize: 9.2,
      marginHorizontal: 4,
    },
    rewardLtrText: { direction: "ltr" },
    rewardRtlText: { direction: "rtl" },
    section: {
      marginTop: rewardPresentation && isAtsClassic
        ? rewardV11 ? 5 : Math.max(8, atsSpacing.sectionBefore - 4)
        : isAtsClassic ? atsSpacing.sectionBefore : isCompact ? 8 : 12,
      breakInside: "avoid",
    },
    shortSmallSection: {
      marginTop: rewardPresentation
        ? rewardV11 ? 5 : atsDensityStyles.short.smallSectionBefore - 4
        : atsDensityStyles.short.smallSectionBefore,
    },
    sectionTitle: {
      fontSize: sizes.section,
      fontWeight: 700,
      color: isAtsClassic ? ink : accent,
      marginBottom: rewardV11 && isAtsClassic ? 4 : isAtsClassic ? atsSpacing.headingAfter + 1 : 5,
      paddingBottom: isAtsClassic ? 4 : 3,
      borderBottomWidth: 1,
      borderBottomColor: line,
    },
    paragraph: {
      color: ink,
      marginBottom: isAtsClassic ? 2 : 3,
    },
    entry: {
      marginBottom: rewardV11 && isAtsClassic ? 5 : isAtsClassic ? atsSpacing.itemGap : isCompact ? 6 : 8,
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
      textAlign: isAtsClassic
        ? isArabic ? "left" : "right"
        : direction === "rtl" ? "right" : "left",
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
      marginBottom: isAtsClassic ? 4 : 2,
      direction: isAtsClassic && isArabic ? "ltr" : direction,
      textAlign: isAtsClassic && isArabic ? "right" : direction === "rtl" ? "right" : "left",
    },
    bulletLine: {
      marginTop: rewardV11 && isAtsClassic ? 1.5 : isAtsClassic ? 2.5 : 2,
      paddingLeft: isAtsClassic && !isArabic ? 13 : 0,
      paddingRight: isAtsClassic && isArabic ? 13 : 0,
      textIndent: isAtsClassic ? -9 : 0,
      color: ink,
    },
    rewardBulletRow: {
      display: "flex",
      flexDirection: isArabic ? "row-reverse" : "row",
      marginTop: 2,
      alignItems: "flex-start",
    },
    rewardBulletGlyph: {
      width: 13,
      fontFamily: "Helvetica",
      fontSize: 12,
      fontWeight: 700,
      textAlign: "center",
      color: ink,
    },
    rewardBulletText: {
      flexGrow: 1,
      flexBasis: 0,
      color: ink,
      textAlign: isArabic ? "right" : "left",
    },
    arabicProjectEntry: {
      marginBottom: atsSpacing.itemGap + 1.5,
    },
    arabicProjectTitle: {
      marginBottom: 1,
    },
    arabicEducationFacts: {
      lineHeight: 1.42,
      marginTop: 1,
      marginBottom: 2,
    },
    arabicCertificationSub: {
      lineHeight: 1.4,
      marginTop: 1,
    },
    arabicActivityTitle: {
      marginBottom: 2.5,
    },
    englishProjectEntry: {
      marginBottom: atsSpacing.itemGap + 1.5,
    },
    englishProjectTitle: {
      marginBottom: 1,
    },
    englishEducationFacts: {
      lineHeight: 1.42,
      marginTop: 1,
      marginBottom: 2,
    },
    englishCertificationSub: {
      lineHeight: 1.4,
      marginTop: 1,
    },
    englishActivityTitle: {
      marginBottom: 2.5,
    },
    languageList: {
      display: "flex",
      flexDirection: "column",
      gap: 3,
    },
    skillsLine: {
      color: ink,
      lineHeight: isAtsClassic ? 1.45 : 1.6,
      direction: isAtsClassic && isArabic ? "ltr" : direction,
      textAlign: isAtsClassic && isArabic ? "right" : direction === "rtl" ? "right" : "left",
    },
    rewardSkillWrap: { display: "flex", flexDirection: isArabic ? "row-reverse" : "row", flexWrap: "wrap" },
    rewardSkill: { width: "25%", fontSize: sizes.body, paddingHorizontal: 5, marginBottom: 4 },
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

const shortSpacingSections = new Set(["skills", "certifications", "languages"]);

const ResumeSection = ({
  title,
  children,
  styles,
  atsClassic = false,
  sectionKey = "",
  shortDensity = false,
}) => {
  if (!children) return null;
  return (
    <View
      style={
        shortDensity && shortSpacingSections.has(sectionKey)
          ? [styles.section, styles.shortSmallSection]
          : styles.section
      }
    >
      <Text style={styles.sectionTitle} minPresenceAhead={atsClassic ? 40 : 0}>{title}</Text>
      {children}
    </View>
  );
};

const rewardMixedText = (value, styles) => String(value || "").split(/([A-Za-z][A-Za-z0-9.+#/-]*(?:\s+[A-Za-z][A-Za-z0-9.+#/-]*)*|\+?\d[\d./-]*\d|\d)/g)
  .filter(Boolean).map((part, index) => /^[A-Za-z+\d]/.test(part)
    ? <Text key={index} style={styles.rewardLtrText}>{part}</Text>
    : part);

const EntryList = ({ entries = [], styles, language, sectionKey, personal, resume, atsClassic, rewardPresentation }) => {
  const rewardV11 = rewardPresentation === "v11";
  const visibleEntries = entries.filter(hasEntryContent);
  if (!visibleEntries.length) return null;

  return visibleEntries.map((entry) => {
    const arabicAts = atsClassic && language === "ar";
    const englishAts = atsClassic && language === "en";
    const education = sectionKey === "education"
      ? getResumeEducationDisplay(entry, personal, language, resume)
      : null;
    const isCertification = sectionKey === "certifications";
    const date = isCertification ? "" : formatResumeDateRange(entry, language);
    const title = education?.title || entry.title || entry.subtitle;
    const facts = education?.facts || [];
    const tools = sectionKey === "projects" ? getResumeEntryTools(entry) : [];
    const metadataSeparator = atsClassic ? " - " : " • ";
    const displaySubtitle = rewardV11 && education
      ? [entry.organization || entry.subtitle, entry.location].filter(Boolean).join(metadataSeparator)
      : education?.subtitle || (isCertification
        ? rewardV11
          ? [entry.organization, entry.period].filter(Boolean).join(" | ")
          : getCertificationDetails(entry)
        : [entry.organization || entry.subtitle, entry.location].filter(Boolean).join(metadataSeparator));
    const displayDate = atsClassic ? date.replace(/ – /g, " - ") : date;

    return (
      <View
        key={entry.id || entry.title}
        style={[
          styles.entry,
          arabicAts && sectionKey === "projects" ? styles.arabicProjectEntry : null,
          englishAts && sectionKey === "projects" ? styles.englishProjectEntry : null,
        ]}
        wrap={atsClassic}
      >
        <Text
          style={[
            styles.entryTitle,
            arabicAts && sectionKey === "projects" ? styles.arabicProjectTitle : null,
            arabicAts && sectionKey === "volunteering" ? styles.arabicActivityTitle : null,
            englishAts && sectionKey === "projects" ? styles.englishProjectTitle : null,
            englishAts && sectionKey === "volunteering" ? styles.englishActivityTitle : null,
          ]}
          minPresenceAhead={atsClassic ? 32 : 0}
        >
          {title}
        </Text>
        {!atsClassic && displayDate && !education ? <Text style={styles.entryDate}>{displayDate}</Text> : null}
        {displaySubtitle ? (
          <Text
            style={[
              styles.entrySub,
              arabicAts && isCertification ? styles.arabicCertificationSub : null,
              englishAts && isCertification ? styles.englishCertificationSub : null,
            ]}
          >
            {rewardPresentation && arabicAts ? rewardMixedText(displaySubtitle, styles) : displaySubtitle}
          </Text>
        ) : null}
        {atsClassic && displayDate && !education ? <Text style={styles.entryDate}>
          {rewardPresentation && arabicAts ? rewardMixedText(displayDate, styles) : displayDate}
        </Text> : null}
        {facts.length ? (
          <Text
            style={[
              styles.entrySub,
              arabicAts ? styles.arabicEducationFacts : null,
              englishAts ? styles.englishEducationFacts : null,
            ]}
          >
            {rewardPresentation && arabicAts
              ? rewardMixedText(facts.join("   |   "), styles)
              : facts.join(arabicAts ? "   |   " : " | ")}
          </Text>
        ) : null}
        {atsClassic && tools.length ? <Text style={styles.toolsLine}>{tools.join(", ")}</Text> : null}
        {!education && getAchievementLines(entry).map((line, index) => rewardV11
          ? <View key={`${entry.id || entry.title}-${index}`} style={styles.rewardBulletRow}>
            <Text style={styles.rewardBulletGlyph}>•</Text>
            <Text style={styles.rewardBulletText}>{arabicAts ? rewardMixedText(line, styles) : line}</Text>
          </View>
          : <Text key={`${entry.id || entry.title}-${index}`} style={styles.bulletLine}>{`• ${line}`}</Text>
        )}
      </View>
    );
  });
};

const ResumePdfDocument = ({ resume = {}, rewardPresentation = false }) => {
  const rewardV11 = rewardPresentation === "v11";
  resume = getLocalizedResumeForDisplay(resume);
  const atsClassic = isAtsClassicTemplate(resume);
  const shortDensity = atsClassic && getAtsClassicDensityMode(resume) === "short";
  const styles = createStyles(resume, rewardPresentation);
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
  const rewardContactItems = (language === "ar" ? [
    ["city", personal.city, false], ["email", personal.email, true],
    ["phone", personal.phone, true], ["linkedin", personal.linkedinUrl, true],
  ] : [
    ["email", personal.email, true], ["phone", personal.phone, true],
    ["city", personal.city, false], ["linkedin", personal.linkedinUrl, true],
  ]).filter(([, value]) => value);

  const renderSection = (sectionKey) => {
    if (sectionKey === "summary" && resume.summary) {
      return (
        <ResumeSection key={sectionKey} sectionKey={sectionKey} title={titles.summary} styles={styles} atsClassic={atsClassic} shortDensity={shortDensity}>
          <Text style={styles.paragraph}>{rewardV11 && language === "ar"
            ? rewardMixedText(resume.summary, styles) : resume.summary}</Text>
        </ResumeSection>
      );
    }

    if (["education", "experience", "projects", "certifications", "volunteering"].includes(sectionKey)) {
      const entries = sectionKey === "experience" ? resume.experience || resume.experiences : resume[sectionKey];
      if (!entries?.some(hasEntryContent)) return null;
      return (
        <ResumeSection key={sectionKey} sectionKey={sectionKey} title={titles[sectionKey]} styles={styles} atsClassic={atsClassic} shortDensity={shortDensity}>
          <EntryList entries={entries} styles={styles} language={language} sectionKey={sectionKey} personal={personal} resume={resume} atsClassic={atsClassic} rewardPresentation={rewardPresentation} />
        </ResumeSection>
      );
    }

    if (sectionKey === "skills" && resume.skills?.length) {
      return (
        <ResumeSection key={sectionKey} sectionKey={sectionKey} title={titles.skills} styles={styles} atsClassic={atsClassic} shortDensity={shortDensity}>
          {rewardV11 ? <View style={styles.rewardSkillWrap}>{resume.skills.map((skill, index) =>
            <Text key={`${skill}-${index}`} style={styles.rewardSkill}>{skill}</Text>)}</View>
            : <Text style={styles.skillsLine}>{resume.skills.join(" | ")}</Text>}
        </ResumeSection>
      );
    }

    if (sectionKey === "languages" && resume.languages?.length) {
      return (
        <ResumeSection key={sectionKey} sectionKey={sectionKey} title={titles.languages} styles={styles} atsClassic={atsClassic} shortDensity={shortDensity}>
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
          {rewardPresentation && language === "en" && <View style={styles.rewardEnglishNameGap} />}
          <Text style={styles.headline}>{headline}</Text>
          {rewardPresentation ? <View style={styles.rewardContactRow}>
            {rewardContactItems.map(([key, value, ltr], index) => <React.Fragment key={key}>
              {index > 0 && <Text style={styles.rewardContactSeparator}>|</Text>}
              <Text style={[styles.rewardContactItem, ltr ? styles.rewardLtrText : styles.rewardRtlText]}>{value}</Text>
            </React.Fragment>)}
          </View> : <Text style={styles.contactLine}>{contactItems.join(" | ")}</Text>}
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
