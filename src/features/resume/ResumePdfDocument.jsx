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

// React PDF fetches fonts outside the normal React asset pipeline. Using an
// absolute URL keeps the font available in local development and production.
const pdfFontBaseUrl = typeof window !== "undefined" ? window.location.origin : "";

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
  const isCompact = resume.settings?.density === "compact";
  const sizes = fontSizes[resume.settings?.fontSize || "medium"] || fontSizes.medium;
  const accent = resume.settings?.accentColor || "#42cfc3";

  return StyleSheet.create({
    page: {
      paddingTop: isCompact ? 28 : 34,
      paddingHorizontal: isCompact ? 34 : 40,
      paddingBottom: isCompact ? 26 : 32,
      fontFamily: "Tajawal",
      fontSize: sizes.body,
      color: INK,
      lineHeight: 1.45,
      direction,
      textAlign: direction === "rtl" ? "right" : "left",
    },
    header: {
      paddingBottom: 12,
      borderBottomWidth: 2,
      borderBottomColor: accent,
      marginBottom: isCompact ? 10 : 14,
    },
    name: {
      fontSize: sizes.name,
      fontWeight: 700,
      marginBottom: 3,
      color: INK,
    },
    headline: {
      fontSize: sizes.title,
      color: accent,
      fontWeight: 700,
      marginBottom: 7,
    },
    contactRow: {
      display: "flex",
      flexDirection: direction === "rtl" ? "row-reverse" : "row",
      flexWrap: "wrap",
      gap: 8,
      color: MUTED,
      fontSize: sizes.body - 1,
    },
    section: {
      marginTop: isCompact ? 8 : 12,
      breakInside: "avoid",
    },
    sectionTitle: {
      fontSize: sizes.section,
      fontWeight: 700,
      color: accent,
      marginBottom: 5,
      paddingBottom: 3,
      borderBottomWidth: 1,
      borderBottomColor: LINE,
    },
    paragraph: {
      color: INK,
      marginBottom: 3,
    },
    entry: {
      marginBottom: isCompact ? 6 : 8,
      breakInside: "avoid",
    },
    entryHead: {
      display: "flex",
      flexDirection: direction === "rtl" ? "row-reverse" : "row",
      justifyContent: "space-between",
      gap: 10,
      marginBottom: 1,
    },
    entryTitle: {
      fontWeight: 700,
      color: INK,
      maxWidth: "72%",
    },
    entryDate: {
      color: MUTED,
      fontSize: sizes.body - 1,
      maxWidth: "28%",
    },
    entrySub: {
      color: MUTED,
      fontSize: sizes.body - 0.5,
      marginBottom: 2,
    },
    bullet: {
      display: "flex",
      flexDirection: direction === "rtl" ? "row-reverse" : "row",
      gap: 4,
      marginTop: 2,
    },
    bulletMark: {
      color: accent,
      fontWeight: 700,
      width: 8,
    },
    bulletText: {
      flex: 1,
    },
    chips: {
      display: "flex",
      flexDirection: direction === "rtl" ? "row-reverse" : "row",
      flexWrap: "wrap",
      gap: 5,
    },
    chip: {
      paddingVertical: 2,
      paddingHorizontal: 6,
      borderWidth: 1,
      borderColor: LINE,
      borderRadius: 8,
      color: INK,
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
  if (lines.length) return lines;
  return [entry.description || entry.details].filter(Boolean);
};

const ResumeSection = ({ title, children, styles }) => {
  if (!children) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
};

const EntryList = ({ entries = [], styles, language, sectionKey, personal }) => {
  const visibleEntries = entries.filter(hasEntryContent);
  if (!visibleEntries.length) return null;

  return visibleEntries.map((entry) => {
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
      <View key={entry.id || entry.title} style={styles.entry} wrap={false}>
        <View style={styles.entryHead}>
          <Text style={styles.entryTitle}>{title}</Text>
          {date && !education ? <Text style={styles.entryDate}>{date}</Text> : null}
        </View>
        {subtitle ? <Text style={styles.entrySub}>{subtitle}</Text> : null}
        {facts.length ? <Text style={styles.entrySub}>{facts.join(" | ")}</Text> : null}
        {!education && getAchievementLines(entry).map((line, index) => (
          <View key={`${entry.id || entry.title}-${index}`} style={styles.bullet}>
            <Text style={styles.bulletMark}>•</Text>
            <Text style={styles.bulletText}>{line}</Text>
          </View>
        ))}
      </View>
    );
  });
};

const ResumePdfDocument = ({ resume = {} }) => {
  resume = getLocalizedResumeForDisplay(resume);
  const styles = createStyles(resume);
  const language = resume.settings?.language === "en" ? "en" : "ar";
  const titles = sectionTitles[language];
  const personal = resume.personalInfo || {};
  const order = getVisibleSectionOrder(resume);
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
        <ResumeSection key={sectionKey} title={titles.summary} styles={styles}>
          <Text style={styles.paragraph}>{resume.summary}</Text>
        </ResumeSection>
      );
    }

    if (["education", "experience", "projects", "certifications", "volunteering"].includes(sectionKey)) {
      const entries = sectionKey === "experience" ? resume.experience || resume.experiences : resume[sectionKey];
      if (!entries?.some(hasEntryContent)) return null;
      return (
        <ResumeSection key={sectionKey} title={titles[sectionKey]} styles={styles}>
          <EntryList entries={entries} styles={styles} language={language} sectionKey={sectionKey} personal={personal} />
        </ResumeSection>
      );
    }

    if (sectionKey === "skills" && resume.skills?.length) {
      return (
        <ResumeSection key={sectionKey} title={titles.skills} styles={styles}>
          <View style={styles.chips}>
            {resume.skills.map((skill) => (
              <Text key={skill} style={styles.chip}>
                {skill}
              </Text>
            ))}
          </View>
        </ResumeSection>
      );
    }

    if (sectionKey === "languages" && resume.languages?.length) {
      return (
        <ResumeSection key={sectionKey} title={titles.languages} styles={styles}>
          <View style={styles.chips}>
            {resume.languages
              .filter((languageItem) => languageItem.name || languageItem.level)
              .map((languageItem) => (
                <Text key={languageItem.id} style={styles.chip}>
                  {[languageItem.name, languageItem.level].filter(Boolean).join(" - ")}
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
          <View style={styles.contactRow}>
            {contactItems.map((item) => (
              <Text key={item}>{item}</Text>
            ))}
          </View>
        </View>

        {order.map(renderSection)}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
};

export default ResumePdfDocument;
