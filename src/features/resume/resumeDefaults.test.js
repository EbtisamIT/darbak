import { formatResumeDateRange, normalizeResume } from "./resumeDefaults";

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
});
