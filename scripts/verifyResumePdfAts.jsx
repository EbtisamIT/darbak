import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import React from "react";
import pdfParse from "pdf-parse";
import { renderToBuffer } from "@react-pdf/renderer";
import ResumePdfDocument from "../src/features/resume/ResumePdfDocument.jsx";

const templates = ["clean", "ats-classic"];

const makeResume = (language, template) => {
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
      studentStatus: "student",
      expectedGraduationYear: "2027",
      gpa: "4.60",
      gpaScale: "5",
    },
    summary: english
      ? "Information Systems student with project experience in data analysis and interface design."
      : "طالبة نظم معلومات لديها خبرة تطبيقية في تحليل البيانات وتصميم الواجهات.",
    education: [{
      id: "education-1",
      title: english ? "Bachelor's Degree in Information Systems" : "بكالوريوس نظم المعلومات",
      organization: english ? "King Saud University" : "جامعة الملك سعود",
      location: english ? "Riyadh" : "الرياض",
    }],
    experience: [],
    projects: [{
      id: "project-1",
      title: english ? "Sales Performance Dashboard" : "لوحة متابعة أداء المبيعات",
      technologies: ["Power BI", "Microsoft Excel"],
      achievements: [{
        id: "project-bullet-1",
        text: english
          ? "Analyzed monthly sales data and compared branch performance."
          : "حللت بيانات المبيعات الشهرية وقارنت أداء الفروع.",
      }, {
        id: "project-bullet-2",
        text: english
          ? "Designed a dashboard to support performance monitoring."
          : "صممت لوحة مؤشرات لدعم متابعة الأداء.",
      }],
    }],
    skills: ["Power BI", "Microsoft Excel", "SQL"],
    certifications: [{
      id: "certification-1",
      title: english ? "Data Analysis Fundamentals" : "أساسيات تحليل البيانات",
      organization: english ? "Darbak Academy" : "أكاديمية دربك",
      startDate: "2025",
    }],
    volunteering: [{
      id: "activity-1",
      title: english ? "Information Systems Club Member" : "عضوة نادي نظم المعلومات",
      organization: english ? "King Saud University" : "جامعة الملك سعود",
      achievements: [{
        id: "activity-bullet-1",
        text: english ? "Helped organize a student technology event." : "ساهمت في تنظيم فعالية تقنية طلابية.",
      }],
    }],
    languages: [{
      id: "language-1",
      name: english ? "Arabic" : "العربية",
      level: english ? "Native" : "اللغة الأم",
    }],
    sectionOrder: [
      "summary",
      "education",
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
      template,
      accentColor: "#42cfc3",
    },
  };
};

const normalizeExtractedText = (value = "") => value.replace(/\s+/g, " ").trim();
const compactArabicText = (value = "") => value
  .replace(/\s+/g, "")
  // pdf.js can reverse Arabic word runs around the conjunction in this
  // heading while preserving every glyph and the section position.
  .replace(/اتوالشهاداتالدور/g, "الدوراتوالشهادات");
const occurrenceCount = (text, value) => text.split(value).length - 1;

const assertOnce = (text, values) => values.forEach((value) => {
  assert.equal(occurrenceCount(text, value), 1, `Expected exactly one extracted occurrence of: ${value}`);
});

const assertPresent = (text, values) => values.forEach((value) => {
  assert.ok(text.includes(value), `Expected extracted text to contain: ${value}`);
});

const assertInReadingOrder = (text, values) => {
  let previousIndex = -1;
  values.forEach((value) => {
    const index = text.indexOf(value);
    assert.ok(index > previousIndex, `Expected ${value} after the previous extracted field`);
    previousIndex = index;
  });
};

const renderAndExtract = async (language, template) => {
  const buffer = await renderToBuffer(<ResumePdfDocument resume={makeResume(language, template)} />);
  const parsed = await pdfParse(buffer);
  return {
    buffer,
    pageCount: parsed.numpages,
    text: normalizeExtractedText(parsed.text),
  };
};

const verifyEnglish = (result) => {
  const orderedValues = [
    "Rahaf Alqahtani",
    "Information Systems Student",
    "rahaf@example.com",
    "0501234567",
    "Riyadh",
    "Professional Summary",
    "Information Systems student with project experience",
    "Education",
    "King Saud University",
    "Expected Graduation: 2027",
    "Projects",
    "Sales Performance Dashboard",
    "Analyzed monthly sales data",
    "Designed a dashboard",
    "Skills",
    "Power BI | Microsoft Excel | SQL",
    "Certifications",
    "Data Analysis Fundamentals",
    "Activities & Volunteering",
    "Information Systems Club Member",
    "Helped organize a student technology event.",
    "Languages",
    "Arabic",
    "Native",
  ];
  assertPresent(result.text, orderedValues);
  assertOnce(result.text, [
    "Rahaf Alqahtani",
    "Information Systems Student",
    "rahaf@example.com",
    "Professional Summary",
    "Education",
    "Projects",
    "Sales Performance Dashboard",
    "Analyzed monthly sales data",
    "Designed a dashboard",
    "Skills",
    "Certifications",
    "Data Analysis Fundamentals",
    "Activities & Volunteering",
    "Information Systems Club Member",
    "Helped organize a student technology event.",
    "Languages",
  ]);
  assertInReadingOrder(result.text, orderedValues);
  return orderedValues.length;
};

const verifyArabic = (result, template) => {
  const text = compactArabicText(result.text);
  const certificationHeading = template === "ats-classic" ? "الدوراتوالشهادات" : "الشهادات";
  const requiredValues = [
    "رهفالقحطاني",
    "rahaf@example.com",
    "0501234567",
    "النبذةالمهنية",
    "التعليم",
    "جامعةالملكسعود",
    "متوقعالتخرج:",
    "2027",
    "المشاريع",
    "لوحةمتابعةأداءالمبيعات",
    "حللتبياناتالمبيعاتالشهر",
    "وقارنتأداءالفروع",
    "صممتلوحةمؤشر",
    "لدعممتابعةالأداء",
    "المهارات",
    "PowerBI|MicrosoftExcel|SQL",
    certificationHeading,
    "أساسياتتحليلالبيانات",
    "الأنشطةوالتطوع",
    "عضوةنادينظمالمعلومات",
    "ساهمتفيتنظيمفعاليةتقنيةطلابية.",
    "اللغات",
    "العر",
    "بية",
    "اللغةالأم",
  ];
  assertPresent(text, requiredValues);
  assertOnce(text, [
    "رهفالقحطاني",
    "rahaf@example.com",
    "النبذةالمهنية",
    "التعليم",
    "المشاريع",
    "لوحةمتابعةأداءالمبيعات",
    "حللتبياناتالمبيعاتالشهر",
    "وقارنتأداءالفروع",
    "صممتلوحةمؤشر",
    "لدعممتابعةالأداء",
    "المهارات",
    certificationHeading,
    "أساسياتتحليلالبيانات",
    "الأنشطةوالتطوع",
    "عضوةنادينظمالمعلومات",
    "ساهمتفيتنظيمفعاليةتقنيةطلابية.",
    "اللغات",
  ]);
  assertInReadingOrder(text, [
    "النبذةالمهنية",
    "التعليم",
    "المشاريع",
    "المهارات",
    certificationHeading,
    "الأنشطةوالتطوع",
    "اللغات",
  ]);
  return requiredValues.length;
};

const main = async () => {
  const results = {};
  for (const template of templates) {
    results[template] = {};
    for (const language of ["en", "ar"]) {
      const result = await renderAndExtract(language, template);
      if (process.env.DEBUG_PDF_ATS === "1") {
        process.stderr.write(`${template} ${language}:\n${result.text}\n\n`);
      }
      const expectedFieldCount = language === "en"
        ? verifyEnglish(result)
        : verifyArabic(result, template);
      results[template][language] = {
        ...result,
        coverage: `${expectedFieldCount}/${expectedFieldCount}`,
      };
    }
  }

  if (process.argv.includes("--write-artifact")) {
    const outputDir = path.resolve("output/pdf");
    await fs.mkdir(outputDir, { recursive: true });
    await Promise.all([
      fs.writeFile(path.join(outputDir, "rahaf-current-en.pdf"), results.clean.en.buffer),
      fs.writeFile(path.join(outputDir, "rahaf-ats-classic-en.pdf"), results["ats-classic"].en.buffer),
      fs.writeFile(path.join(outputDir, "rahaf-current-ar.pdf"), results.clean.ar.buffer),
      fs.writeFile(path.join(outputDir, "rahaf-ats-classic-ar.pdf"), results["ats-classic"].ar.buffer),
    ]);
  }

  const report = Object.fromEntries(Object.entries(results).map(([template, languages]) => [
    template,
    Object.fromEntries(Object.entries(languages).map(([language, result]) => [language, {
      pass: true,
      coverage: result.coverage,
      pageCount: result.pageCount,
      text: result.text,
    }])),
  ]));
  process.stdout.write(JSON.stringify(report, null, 2));
};

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
