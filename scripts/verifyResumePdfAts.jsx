import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import React from "react";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { renderToBuffer } from "@react-pdf/renderer";
import ResumePdfDocument from "../src/features/resume/ResumePdfDocument.jsx";
import { getAtsClassicDensityMode } from "../src/features/resume/resumeAtsClassic.js";

const templates = ["clean", "ats-classic"];
const standardFontDataUrl = `${path.resolve("node_modules/pdfjs-dist/standard_fonts")}${path.sep}`;

const extractPdfText = async (buffer) => {
  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    standardFontDataUrl,
  });
  const document = await loadingTask.promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join(" "));
  }
  const result = {
    numpages: document.numPages,
    text: pages.join(" "),
  };
  await loadingTask.destroy();
  return result;
};

const makeResume = (language, template, densityScenario = "short") => {
  const english = language === "en";
  const resume = {
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

  if (["medium", "long"].includes(densityScenario)) {
    resume.experience = [{
      id: "experience-1",
      title: english ? "Business Analysis Intern" : "متدربة تحليل أعمال",
      organization: english ? "Example Company" : "شركة مثال",
      location: english ? "Riyadh" : "الرياض",
      startDate: "2026-01-01",
      endDate: "2026-04-01",
      achievements: [{
        id: "experience-bullet-1",
        text: english
          ? "Reviewed weekly operational reports and organized source data."
          : "راجعت التقارير التشغيلية الأسبوعية ونظمت البيانات المصدرية.",
      }, {
        id: "experience-bullet-2",
        text: english
          ? "Documented findings for the weekly team review."
          : "وثقت النتائج للمراجعة الأسبوعية مع الفريق.",
      }],
    }];
  }

  if (densityScenario === "long") {
    resume.experience.push({
      id: "experience-2",
      title: english ? "Data Operations Trainee" : "متدربة عمليات بيانات",
      organization: english ? "Second Company" : "الشركة الثانية",
      location: english ? "Jeddah" : "جدة",
      startDate: "2025-06-01",
      endDate: "2025-09-01",
      achievements: Array.from({ length: 5 }, (_, index) => ({
        id: `long-experience-bullet-${index + 1}`,
        text: english
          ? `Documented and reviewed operational data workflow ${index + 1}.`
          : `وثقت وراجعت مسار عمل البيانات التشغيلية ${index + 1}.`,
      })),
    });
    resume.projects.push(...Array.from({ length: 3 }, (_, projectIndex) => ({
      id: `long-project-${projectIndex + 1}`,
      title: english ? `Applied Analytics Project ${projectIndex + 1}` : `مشروع تحليلي تطبيقي ${projectIndex + 1}`,
      technologies: ["SQL", "Microsoft Excel"],
      achievements: Array.from({ length: 4 }, (_, bulletIndex) => ({
        id: `long-project-${projectIndex + 1}-bullet-${bulletIndex + 1}`,
        text: english
          ? `Completed a documented analysis task ${bulletIndex + 1} for the applied solution.`
          : `أنجزت مهمة تحليل موثقة ${bulletIndex + 1} ضمن الحل التطبيقي.`,
      })),
    })));
  }

  return resume;
};

const normalizeExtractedText = (value = "") => value.replace(/\s+/g, " ").trim();
const compactArabicText = (value = "") => value
  .replace(/\s+/g, "")
  .replace(/\.ساهمت/g, "ساهمت")
  .replace(/طلابية\./g, "طلابية")
  // PDF.js can return the lam/alef/hamza glyph order as "األ" even when the
  // visible and source text is "الأ". Normalize that extractor-only form.
  .replace(/األ/g, "الأ")
  .replace(/طالبية/g, "طلابية")
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

const renderAndExtract = async (language, template, densityScenario = "short") => {
  const resume = makeResume(language, template, densityScenario);
  const buffer = await renderToBuffer(<ResumePdfDocument resume={resume} />);
  if (process.env.DEBUG_PDF_ATS === "1") {
    const debugDir = path.resolve("tmp/pdfs/density-debug");
    await fs.mkdir(debugDir, { recursive: true });
    await fs.writeFile(path.join(debugDir, `${template}-${densityScenario}-${language}.pdf`), buffer);
  }
  const parsed = await extractPdfText(buffer);
  return {
    buffer,
    density: template === "ats-classic" ? getAtsClassicDensityMode(resume) : null,
    pageCount: parsed.numpages,
    text: normalizeExtractedText(parsed.text),
  };
};

const verifyDensityScenario = (result, language, scenario) => {
  const english = language === "en";
  const text = english ? result.text : compactArabicText(result.text);
  const experienceHeading = english ? "Experience" : "الخبرات";
  const educationHeading = english ? "Education" : "التعليم";
  const projectHeading = english ? "Projects" : "المشاريع";
  const mediumMarkers = english
    ? ["Business Analysis Intern", "Example Company", "Reviewed weekly operational reports"]
    : ["متدربةتحليلأعمال", "شركةمثال", "راجعتالتقاريرالتشغيليةالأسبوعية"];
  const longMarkers = english
    ? ["Data Operations Trainee", "Second Company", "Applied Analytics Project 3"]
    : ["متدربةعملياتبيانات", "الشركةالثانية", "مشروعتحليليتطبيقي3"];
  const markers = scenario === "long" ? [...mediumMarkers, ...longMarkers] : mediumMarkers;

  assert.equal(result.density, scenario, `Expected ${scenario} ATS density mode for ${language}`);
  assertPresent(text, markers);
  assertOnce(text, markers);
  assertInReadingOrder(text, [experienceHeading, educationHeading, projectHeading]);
  return markers.length;
};

const verifyEnglish = (result, template) => {
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
  if (template === "ats-classic") {
    assert.equal(
      (result.text.match(/•/g) || []).length,
      3,
      "Expected every English ATS project/activity bullet to remain extractable"
    );
  }
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
    "ساهمتفيتنظيمفعاليةتقنيةطلابية",
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
    "ساهمتفيتنظيمفعاليةتقنيةطلابية",
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
  if (template === "ats-classic") {
    assert.equal(
      (result.text.match(/•/g) || []).length,
      3,
      "Expected every Arabic ATS project/activity bullet to remain extractable"
    );
    assert.ok(
      result.text.includes("Power BI, Microsoft Excel"),
      "Expected mixed-language project tools to remain intact"
    );
    assert.ok(
      result.text.includes("Power BI | Microsoft Excel | SQL"),
      "Expected mixed-language skills to remain intact"
    );
  }
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
        ? verifyEnglish(result, template)
        : verifyArabic(result, template);
      results[template][language] = {
        ...result,
        coverage: `${expectedFieldCount}/${expectedFieldCount}`,
      };
    }
  }

  const densityScenarios = {};
  for (const scenario of ["medium", "long"]) {
    densityScenarios[scenario] = {};
    for (const language of ["en", "ar"]) {
      const result = await renderAndExtract(language, "ats-classic", scenario);
      const expectedFieldCount = verifyDensityScenario(result, language, scenario);
      densityScenarios[scenario][language] = {
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
  report.densityScenarios = Object.fromEntries(Object.entries(densityScenarios).map(([scenario, languages]) => [
    scenario,
    Object.fromEntries(Object.entries(languages).map(([language, result]) => [language, {
      pass: true,
      density: result.density,
      coverage: result.coverage,
      pageCount: result.pageCount,
    }])),
  ]));
  process.stdout.write(JSON.stringify(report, null, 2));
};

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
