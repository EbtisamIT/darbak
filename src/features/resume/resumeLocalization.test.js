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

    expect(localized.skills).toEqual(["React", "Web Development", "Node.js"]);
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
});
