import {
  formatResumeDateRange,
  normalizeResume,
  prepareResumeFactsForSave,
  prepareResumeForSave,
} from "./resumeDefaults";

describe("tailored resume reload", () => {
  it("formats experience ISO dates as month and year in Arabic and English", () => {
    const entry = { startDate: "2026-02-01", endDate: "2026-05-01" };

    expect(formatResumeDateRange(entry, "ar")).toBe("فبراير 2026 – مايو 2026");
    expect(formatResumeDateRange(entry, "en")).toBe("Feb 2026 – May 2026");
    expect(formatResumeDateRange({ startDate: "2026-02-01", isCurrent: true }, "en"))
      .toBe("Feb 2026 – Present");
  });

  it("keeps a saved customized summary when normalizing a version payload", () => {
    const customizedSummary = "متخصصة في تقنية المعلومات مع إبراز تطوير الويب وتصميم الواجهات.";
    const versionPayload = {
      personalInfo: { fullName: "سارة أحمد", headline: "خريجة تقنية المعلومات" },
      summary: customizedSummary,
      projects: [{ id: "darbak", title: "دربك" }],
      skills: ["React.js"],
      settings: { language: "ar", direction: "rtl" },
    };

    const reopened = normalizeResume(versionPayload);

    expect(reopened.summary).toBe(customizedSummary);
    expect(reopened.personalInfo.headline).toBe("خريجة تقنية المعلومات");
  });

  it("preserves student-owned entry facts separately from generated presentation", () => {
    const resume = normalizeResume({
      projects: [{
        id: "project-1",
        title: "تحليل رضا العملاء",
        description: "صياغة مولدة قديمة",
        achievements: [{ id: "generated-1", text: "نقطة مولدة" }],
        userSourceDescription: "مشروع جامعي",
        userSourceContributions: [],
      }],
    });

    expect(resume.projects[0].description).toBe("صياغة مولدة قديمة");
    expect(resume.projects[0].userSourceDescription).toBe("مشروع جامعي");
    expect(resume.projects[0].userSourceContributions).toEqual([]);
  });

  it("keeps ResumeProfile ownership and compact row type in facts autosaves", () => {
    const payload = prepareResumeForSave({
      workflow: { factsOwner: "resume", isSetupComplete: true, lastStep: "review" },
      experience: [{ id: "experience-1", title: "متدربة", entryType: "internship" }],
    });

    expect(payload.workflow).toMatchObject({ factsOwner: "resume", isSetupComplete: true });
    expect(payload.experience[0].entryType).toBe("internship");
  });

  it("whitelists source facts without presentation or localization state", () => {
    const payload = prepareResumeFactsForSave({
      personalInfo: { fullName: "سارة" },
      summary: "نبذة عربية معتمدة",
      projects: [{ id: "project-1", title: "مشروع", userSourceDescription: "حللت البيانات" }],
      skills: ["Power BI"],
      sectionOrder: ["summary", "projects", "skills"],
      settings: { language: "en", direction: "ltr" },
      localizedDisplay: { entries: { "projects:project-1": { title: "Project" } } },
    });

    expect(payload.personalInfo.fullName).toBe("سارة");
    expect(payload.projects[0].userSourceDescription).toBe("حللت البيانات");
    expect(payload.skills).toEqual(["Power BI"]);
    expect(payload).not.toHaveProperty("summary");
    expect(payload).not.toHaveProperty("localizedDisplay");
    expect(payload).not.toHaveProperty("settings");
    expect(payload).not.toHaveProperty("sectionOrder");
  });
});
