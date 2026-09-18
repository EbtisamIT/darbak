import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import React from "react";
import pdfParse from "pdf-parse";
import { renderToBuffer } from "@react-pdf/renderer";
import ResumePdfDocument from "../src/features/resume/ResumePdfDocument.jsx";

const makeResume = (language) => {
  const english = language === "en";
  return {
    personalInfo: {
      fullName: english ? "Rahaf Alqahtani" : "رهف القحطاني",
      headline: english ? "Information Systems Student" : "طالبة نظم معلومات",
      email: "rahaf@example.com",
      phone: "0501234567",
      city: english ? "Riyadh" : "الرياض",
      major: english ? "Information Systems" : "نظم المعلومات",
      university: english ? "King Saud University" : "جامعة الملك سعود",
      degree: english ? "Bachelor's Degree" : "بكالوريوس",
      studentStatus: english ? "Student" : "طالبة",
      expectedGraduationYear: "2027",
    },
    summary: english
      ? "Information Systems student with project experience in data analysis and interface design."
      : "طالبة نظم معلومات لديها خبرة تطبيقية في تحليل البيانات وتصميم الواجهات.",
    education: [{
      id: "education-1",
      title: english ? "Bachelor's Degree in Information Systems" : "بكالوريوس نظم المعلومات",
      organization: english ? "King Saud University" : "جامعة الملك سعود",
      location: english ? "Riyadh" : "الرياض",
      endDate: "2027",
    }],
    experience: [],
    projects: [{
      id: "project-1",
      title: english ? "Sales Dashboard" : "لوحة متابعة المبيعات",
      achievements: [{
        id: "project-bullet-1",
        text: english
          ? "Analyzed sales data and presented branch performance in a dashboard."
          : "حللت بيانات المبيعات وعرضت أداء الفروع في لوحة مؤشرات.",
      }],
    }],
    skills: english
      ? ["Power BI", "Microsoft Excel", "SQL"]
      : ["Power BI", "Microsoft Excel", "SQL"],
    certifications: [{
      id: "certification-1",
      title: english ? "Data Analysis Fundamentals" : "أساسيات تحليل البيانات",
      organization: english ? "Darbak Academy" : "أكاديمية دربك",
      startDate: "2025",
    }],
    volunteering: [],
    languages: [{
      id: "language-1",
      name: english ? "Arabic" : "العربية",
      level: english ? "Native" : "اللغة الأم",
    }],
    sectionOrder: [
      "summary",
      "education",
      "experience",
      "projects",
      "skills",
      "certifications",
      "volunteering",
      "languages",
    ],
    hiddenSections: [],
    settings: {
      language,
      direction: english ? "ltr" : "rtl",
      density: "comfortable",
      fontSize: "medium",
      template: "clean",
      accentColor: "#42cfc3",
    },
  };
};

const normalizeExtractedText = (value = "") => value.replace(/\s+/g, " ").trim();

const occurrenceCount = (text, value) => text.split(value).length - 1;

const assertOnce = (text, values) => values.forEach((value) => {
  assert.equal(occurrenceCount(text, value), 1, `Expected exactly one extracted occurrence of: ${value}`);
});

const assertInReadingOrder = (text, values) => {
  let previousIndex = -1;
  values.forEach((value) => {
    const index = text.indexOf(value);
    assert.ok(index > previousIndex, `Expected ${value} after the previous extracted field`);
    previousIndex = index;
  });
};

const renderAndExtract = async (language) => {
  const buffer = await renderToBuffer(<ResumePdfDocument resume={makeResume(language)} />);
  const parsed = await pdfParse(buffer);
  return { buffer, text: normalizeExtractedText(parsed.text) };
};

const verifyEnglish = (text) => {
  const orderedValues = [
    "Rahaf Alqahtani",
    "Information Systems Student",
    "rahaf@example.com",
    "Professional Summary",
    "Information Systems student with project experience",
    "Education",
    "King Saud University",
    "Projects",
    "Sales Dashboard",
    "Analyzed sales data",
    "Skills",
    "Power BI | Microsoft Excel | SQL",
    "Certifications",
    "Data Analysis Fundamentals",
    "Languages",
    "Arabic — Native",
  ];
  assertOnce(text, orderedValues);
  assertInReadingOrder(text, orderedValues);
};

const verifyArabic = (text) => {
  // PDF text extractors can insert spaces at Arabic shaping boundaries (for
  // example "المهار ات"). Removing whitespace lets this regression verify
  // the glyph content and section order without hiding missing text.
  const compactText = text.replace(/\s+/g, "");
  const requiredValues = [
    "رهف القحطاني",
    "rahaf@example.com",
    "النبذة المهنية",
    "التعليم",
    "جامعة الملك سعود",
    "المشاريع",
    "لوحة متابعة المبيعات",
    "المهارات",
    "SQL",
    "الشهادات",
    "أساسيات تحليل البيانات",
    "اللغات",
  ].map((value) => value.replace(/\s+/g, ""));
  assertOnce(compactText, requiredValues);

  const headingOrder = [
    "النبذة المهنية",
    "التعليم",
    "المشاريع",
    "المهارات",
    "الشهادات",
    "اللغات",
  ].map((value) => value.replace(/\s+/g, ""));
  assertInReadingOrder(compactText, headingOrder);
};

const main = async () => {
  const [english, arabic] = await Promise.all([
    renderAndExtract("en"),
    renderAndExtract("ar"),
  ]);

  if (process.env.DEBUG_PDF_ATS === "1") {
    process.stderr.write(`ENGLISH EXTRACT:\n${english.text}\n\nARABIC EXTRACT:\n${arabic.text}\n`);
  }

  verifyEnglish(english.text);
  verifyArabic(arabic.text);

  if (process.argv.includes("--write-artifact")) {
    const outputDir = path.resolve("output/pdf");
    const tempDir = path.resolve("tmp/pdfs");
    await fs.mkdir(outputDir, { recursive: true });
    await fs.mkdir(tempDir, { recursive: true });
    await fs.writeFile(path.join(outputDir, "darbak-resume-ats-safe-rahaf.pdf"), english.buffer);
    await fs.writeFile(path.join(tempDir, "darbak-resume-ats-safe-rahaf-ar.pdf"), arabic.buffer);
  }

  process.stdout.write(JSON.stringify({
    english: { pass: true, text: english.text },
    arabic: { pass: true, text: arabic.text },
  }, null, 2));
};

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
