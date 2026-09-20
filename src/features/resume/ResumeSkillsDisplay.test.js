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

  it("uses current ResumeProfile membership instead of stale verified skills", () => {
    const current = {
      ...staleResume,
      personalInfo: { ...staleResume.personalInfo, fullName: "ابتسام علي" },
      skills: ["Data Analysis", "Microsoft Excel"],
      verifiedResumeFacts: {
        ...staleResume.verifiedResumeFacts,
        personalInfo: { ...staleResume.verifiedResumeFacts.personalInfo, fullName: "Ebtisam" },
        skills: ["Figma", "Microsoft Excel"],
      },
    };
    const display = getLocalizedResumeForDisplay(current);
    expect(display.personalInfo.fullName).toBe("ابتسام علي");
    expect(new Set(display.skills)).toEqual(new Set(["Data Analysis", "Microsoft Excel"]));
    expect(display.skills).not.toContain("Figma");
  });

  it("keeps all selected skills while deterministically reordering them", () => {
    const selected = Array.from({ length: 12 }, (_, index) => `Skill ${index + 1}`);
    const display = getResumeDisplaySkills({ ...staleResume, skills: selected }, selected);
    expect(display).toHaveLength(selected.length);
    expect(new Set(display)).toEqual(new Set(selected));
  });

  it("keeps an ambiguous unsplittable value as one normalized item", () => {
    expect(normalizeDisplaySkills(["custom workflow platform"])).toEqual(["custom workflow platform"]);
  });
});
