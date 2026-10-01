import React from "react";
import { render } from "@testing-library/react";
import ResumePreview from "./ResumePreview";
import { normalizeResume } from "./resumeDefaults";
import { assertNoArabicScript, getEnglishPdfValidation, getLocalizedResumeForDisplay } from "./resumeLocalization";

const persistedSummary = "Information Technology graduate of 2025 with training experience in website interface testing. Contributed to a student club website and a university project.";
const englishVersion = () => normalizeResume({
  personalInfo: {
    fullName: "Darbak QA Student",
    englishName: "Darbak QA Student",
    major: "تقنية المعلومات",
    degree: "بكالوريوس",
    studentStatus: "graduate",
    city: "الرياض",
    email: "qa@example.invalid",
  },
  summary: persistedSummary,
  projects: [{ id: "qa-project", title: "مشروع الاختبار" }],
  skills: ["SQL"],
  localizedDisplay: { entries: { "projects:qa-project": { title: "Testing Project" } } },
  settings: { language: "en", direction: "ltr", template: "ats-classic" },
});

describe("English summary presentation precedence", () => {
  test("renders persisted English verbatim, including student club evidence for a graduate", () => {
    const resume = englishVersion();
    const before = JSON.stringify(resume);
    const display = getLocalizedResumeForDisplay(resume);
    expect(display.summary).toBe(persistedSummary);
    expect(assertNoArabicScript(display)).toBe(true);
    expect(getEnglishPdfValidation(resume).valid).toBe(true);
    const { container, unmount } = render(<ResumePreview resume={resume} />);
    expect(container.querySelector(".resume-paper").textContent).toContain(persistedSummary);
    expect(container.querySelector(".resume-paper").textContent).not.toMatch(/[\u0600-\u06FF]/);
    unmount();
    // Fresh mounts receive persisted data, not a previous render's state.
    const reopened = render(<ResumePreview resume={JSON.parse(before)} />);
    expect(reopened.container.querySelector(".resume-paper").textContent).toContain(persistedSummary);
    expect(JSON.stringify(resume)).toBe(before);
  });

  test("stale source/review metadata never rewrites the last valid summary", () => {
    const resume = englishVersion();
    resume.localizedDisplay.staleFields = ["summary"];
    resume.localizedDisplay.needsRefresh = true;
    resume.personalInfo.studentStatus = "student";
    expect(getLocalizedResumeForDisplay(resume).summary).toBe(persistedSummary);
    expect(resume.localizedDisplay.staleFields).toEqual(["summary"]);
  });

  test("persisted presentation wins over a competing localized summary", () => {
    const resume = englishVersion();
    resume.localizedDisplay.summary = "Different English summary.";
    expect(getLocalizedResumeForDisplay(resume).summary).toBe(persistedSummary);
  });

  test("uses an English localized summary only if no valid persisted summary exists", () => {
    const resume = englishVersion();
    resume.summary = "";
    resume.localizedDisplay.summary = persistedSummary;
    expect(getLocalizedResumeForDisplay(resume).summary).toBe(persistedSummary);
  });

  test("does not invent a generic summary from untranslated source facts", () => {
    const resume = englishVersion();
    resume.summary = "";
    expect(getLocalizedResumeForDisplay(resume).summary).toBe("");
    expect(assertNoArabicScript(getLocalizedResumeForDisplay(resume))).toBe(true);
  });
});
