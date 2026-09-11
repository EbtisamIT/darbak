import { getLocalizedResumeForDisplay } from "./resumeLocalization";
import { getResumeDisplaySkills, normalizeDisplaySkills } from "./resumeSkillDisplay";

describe("Skills Intelligence V2 display", () => {
  const sourceSkills = ["figma", "excel", "web design", "ux", "ui", "software development"];
  const staleResume = {
    settings: { language: "ar" },
    personalInfo: { major: "تقنية المعلومات", studentStatus: "student" },
    skills: ["web design", "ux", "ui", "software development", "Microsoft Excel", "Figma"],
    projects: [{
      id: "project-1",
      title: "تطبيق ويب",
      description: "تطوير برمجيات وتطبيق ويب مع تصميم الويب والواجهات وتجربة المستخدم باستخدام Figma.",
    }],
    verifiedResumeFacts: {
      personalInfo: { major: "تقنية المعلومات", studentStatus: "student" },
      skills: sourceSkills,
      projects: [{
        id: "project-1",
        title: "تطبيق ويب",
        description: "تطوير برمجيات وتطبيق ويب مع تصميم الويب والواجهات وتجربة المستخدم باستخدام Figma.",
      }],
      experiences: [],
    },
  };

  it("normalizes casing and combines explicit UI and UX entries", () => {
    expect(normalizeDisplaySkills(sourceSkills)).toEqual([
      "Figma",
      "Microsoft Excel",
      "Web Design",
      "Software Development",
      "UI/UX",
    ]);
  });

  it("re-ranks a stale saved resume from current verified facts at render time", () => {
    const display = getLocalizedResumeForDisplay(staleResume);
    expect(display.skills).toEqual([
      "Software Development",
      "UI/UX",
      "Web Design",
      "Figma",
      "Microsoft Excel",
    ]);
  });

  it("does not mutate or delete source skills", () => {
    const before = [...sourceSkills];
    getResumeDisplaySkills(staleResume);
    expect(sourceSkills).toEqual(before);
  });

  it("keeps an ambiguous unsplittable value as one normalized item", () => {
    expect(normalizeDisplaySkills(["custom workflow platform"])).toEqual(["custom workflow platform"]);
  });
});
