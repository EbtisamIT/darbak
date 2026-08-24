import { normalizeResume } from "./resumeDefaults";

describe("tailored resume reload", () => {
  it("keeps a saved customized summary when normalizing a version payload", () => {
    const customizedSummary = "متخصصة في تقنية المعلومات مع إبراز تطوير الويب وتصميم الواجهات.";
    const versionPayload = {
      personalInfo: { fullName: "ابتسام علي", headline: "خريجة تقنية المعلومات" },
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
