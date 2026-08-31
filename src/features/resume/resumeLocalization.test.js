import {
  getEnglishReviewItems,
  getLocalizedResumeForDisplay,
} from "./resumeLocalization";
import { getResumeEducationDisplay } from "./resumeEducationDisplay";

const englishResume = {
  personalInfo: {
    fullName: "ابتسام علي",
    englishName: "Ebtisam Ali",
    major: "تقنية المعلومات",
    university: "جامعة الإمام محمد بن سعود الإسلامية",
    city: "الرياض",
    degree: "بكالوريوس",
    studentStatus: "graduate",
    graduationYear: "2024",
    gpa: "4.75",
    gpaScale: "5.00",
    headline: "متخصصة في تقنية المعلومات",
  },
  education: [{
    id: "portfolio-education",
    title: "بكالوريوس",
    organization: "جامعة الإمام محمد بن سعود الإسلامية",
    location: "الرياض",
  }],
  experience: [],
  projects: [],
  certifications: [],
  volunteering: [],
  settings: { language: "en", direction: "ltr" },
};

describe("English resume presentation", () => {
  it("keeps source facts immutable while showing deterministic English display values", () => {
    const localized = getLocalizedResumeForDisplay(englishResume);

    expect(englishResume.personalInfo.major).toBe("تقنية المعلومات");
    expect(localized.personalInfo.fullName).toBe("Ebtisam Ali");
    expect(localized.personalInfo.major).toBe("Information Technology");
    expect(localized.personalInfo.university).toBe("Imam Mohammad Ibn Saud Islamic University");
    expect(localized.personalInfo.city).toBe("Riyadh");
    expect(localized.personalInfo.headline).toBe("Information Technology Graduate");
  });

  it("replaces the current Arabic headline form with a confirmed English student headline", () => {
    const localized = getLocalizedResumeForDisplay({
      ...englishResume,
      personalInfo: {
        ...englishResume.personalInfo,
        studentStatus: "student",
        headline: "متخصصة تقنية المعلومات",
      },
    });

    expect(localized.personalInfo.headline).toBe("Information Technology Student");
  });

  it("renders structured education without leaking projects or training content", () => {
    const localized = getLocalizedResumeForDisplay(englishResume);
    const education = getResumeEducationDisplay(localized.education[0], localized.personalInfo, "en");

    expect(education.title).toBe("Bachelor's Degree in Information Technology");
    expect(education.subtitle).toBe("Imam Mohammad Ibn Saud Islamic University — Riyadh");
    expect(education.facts).toEqual(["2024", "GPA: 4.75/5.00"]);
  });

  it("keeps unknown Arabic identity values in review instead of inventing an English value", () => {
    const reviewItems = getEnglishReviewItems({
      ...englishResume,
      personalInfo: {
        ...englishResume.personalInfo,
        university: "جامعة غير معروفة",
      },
    });

    expect(reviewItems.some((item) => item.field === "university")).toBe(true);
  });

  it("does not let an empty saved display value block a known English university", () => {
    const resume = {
      ...englishResume,
      localizedDisplay: { personalInfo: { university: "" } },
    };

    expect(getEnglishReviewItems(resume).some((item) => item.field === "university")).toBe(false);
    expect(getLocalizedResumeForDisplay(resume).personalInfo.university)
      .toBe("Imam Mohammad Ibn Saud Islamic University");
  });

  it("uses the same English university display in validation and education", () => {
    expect(getEnglishReviewItems(englishResume).some(
      (item) => item.section === "education" && item.field === "organization",
    )).toBe(false);
    expect(getLocalizedResumeForDisplay(englishResume).education[0].organization)
      .toBe("Imam Mohammad Ibn Saud Islamic University");
  });

  it("does not block PDF validation when education uses the localized profile university", () => {
    const resume = {
      ...englishResume,
      education: [{
        ...englishResume.education[0],
        organization: "جامعة الإمام محمد بن سعود الإسلامية — الرياض",
      }],
    };

    expect(getEnglishReviewItems(resume).some(
      (item) => item.section === "education" && item.field === "organization",
    )).toBe(false);
  });

  it("uses English display values for known skills, activities, and languages", () => {
    const localized = getLocalizedResumeForDisplay({
      ...englishResume,
      skills: ["React", "تطوير الويب", "نظام نود.جي إس"],
      languages: [{ id: "ar", name: "العربية", level: "اللغة الام" }],
      volunteering: [{
        id: "injaz",
        title: "مبرمجة",
        organization: "نادي إنجاز",
        location: "الرياض",
        description: "Participated in technology club events.",
      }],
    });

    expect(localized.skills).toEqual(["React.js", "Web Development", "Node.js"]);
    expect(localized.languages[0]).toMatchObject({ name: "Arabic", level: "Native" });
    expect(localized.volunteering[0]).toMatchObject({ title: "Programmer", organization: "Injaz Club" });
  });

  it("does not render an untranslated Arabic skill in an English resume", () => {
    const localized = getLocalizedResumeForDisplay({
      ...englishResume,
      skills: ["مهارة غير معروفة"],
    });

    expect(localized.skills).toEqual([]);
    expect(getEnglishReviewItems({ ...englishResume, skills: ["مهارة غير معروفة"] })
      .some((item) => item.section === "skills")).toBe(true);
  });

  it("cleans the English presentation without changing the source facts", () => {
    const resume = {
      ...englishResume,
      summary: "Interested in software development and UI/UX. Founded Darbak, a platform for sharing cooperative training experiences and exploring training environments.",
      education: [
        ...englishResume.education,
        { ...englishResume.education[0], id: "duplicate-education" },
      ],
      skills: [
        "Git HUb",
        "React",
        "Time managmaet",
        "UI/ UX",
        "React.js • نظام نود.جي إس • تطوير الويب",
      ],
      projects: [{
        id: "darbak-project",
        title: "دربك",
        description: "A Saudi platform that compiles students' cooperative training experiences.",
      }],
    };

    const localized = getLocalizedResumeForDisplay(resume);

    expect(localized.education).toHaveLength(1);
    expect(localized.skills).toEqual([
      "GitHub",
      "React.js",
      "Time Management",
      "UI/UX",
      "Node.js",
      "Web Development",
    ]);
    expect(localized.summary).toMatch(/^Information Technology Graduate\./);
    expect(localized.projects[0].achievements).toHaveLength(2);
    expect(resume.skills).toContain("Git HUb");
    expect(resume.education).toHaveLength(2);
  });
});
