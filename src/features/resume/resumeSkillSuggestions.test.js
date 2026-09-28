import { getResumeSkillSuggestions } from "./resumeSkillSuggestions";

describe("resume skill suggestions", () => {
  it("suggests context skills without changing the selected source set", () => {
    const skills = ["Figma"];
    const suggestions = getResumeSkillSuggestions({
      skills,
      personalInfo: { major: "نظم المعلومات" },
    });
    expect(suggestions).toContain("تحليل البيانات");
    expect(skills).toEqual(["Figma"]);
  });

  it("never re-adds selected membership automatically", () => {
    const suggestions = getResumeSkillSuggestions({
      skills: ["Figma", "Microsoft Excel"],
      personalInfo: { major: "نظم المعلومات" },
    });
    expect(suggestions).not.toContain("Figma");
    expect(suggestions).not.toContain("Microsoft Excel");
  });
});
