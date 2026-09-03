import {
  applyVerifiedResumeFacts,
  canonicalEnglishMajor,
  canonicalEnglishStudentStatus,
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
  it("uses canonical MIS and status values without manual review", () => {
    const sara = {
      personalInfo: {
        fullName: "سارة أحمد",
        major: "نظم المعلومات الإدارية",
        university: "جامعة الملك سعود",
        city: "الرياض",
        degree: "بكالوريوس",
        studentStatus: "طالبة",
        academicTrack: "",
        headline: "طالبة نظم المعلومات الإدارية",
      },
      education: [{ id: "edu-1", title: "بكالوريوس", organization: "جامعة الملك سعود", location: "الرياض" }],
      projects: [],
      experience: [],
      certifications: [],
      volunteering: [],
      settings: { language: "en", direction: "ltr" },
    };
    const localized = getLocalizedResumeForDisplay(sara);
    expect(canonicalEnglishMajor("نظم المعلومات الإدارية")).toBe("Management Information Systems");
    expect(canonicalEnglishStudentStatus("طالبة")).toBe("Student");
    expect(localized.personalInfo.headline).toBe("Management Information Systems Student");
    expect(localized.education[0].organization).toBe("King Saud University");
    expect(getEnglishReviewItems(sara).some((item) => ["major", "studentStatus", "university", "degree"].includes(item.field))).toBe(false);
    expect(localized.personalInfo.academicTrack || "").toBe("");
  });
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

  it("keeps a saved Sol V3 summary unchanged for English preview and PDF payloads", () => {
    const resume = {
      ...englishResume,
      summary: "SOL_V3_SUMMARY_MARKER",
      summaryProvenance: {
        summaryWriterVersion: "v3",
        summarySourceAtSave: "sol_v3",
        summarySourceAtRender: "saved_master_summary",
      },
    };

    expect(getLocalizedResumeForDisplay(resume).summary).toBe("SOL_V3_SUMMARY_MARKER");
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

  it("uses an approved coursework translation without changing the Arabic source fact", () => {
    const resume = {
      ...englishResume,
      personalInfo: {
        ...englishResume.personalInfo,
        relevantCoursework: ["قواعد البيانات"],
      },
      localizedDisplay: {
        personalInfo: { relevantCoursework: ["Database Systems"] },
        review: {
          "personal:relevantCoursework:0": { source: "قواعد البيانات", approved: true },
        },
      },
    };

    expect(getLocalizedResumeForDisplay(resume).personalInfo.relevantCoursework)
      .toEqual(["Database Systems"]);
    expect(resume.personalInfo.relevantCoursework).toEqual(["قواعد البيانات"]);
    expect(getEnglishReviewItems(resume).some((item) => item.field === "relevantCoursework")).toBe(false);
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

  it("uses the saved English project title by stable project id in both the summary and Projects section", () => {
    const resume = {
      ...englishResume,
      summary: "Built the Appointment Booking System to help users schedule and manage appointments.",
      projects: [{
        id: "appointment-booking",
        title: "نظام حجز مواعيد",
        description: "نظام يتيح للمستخدمين حجز المواعيد وتعديلها وإلغائها.",
        achievements: [{ id: "booking-bullet", text: "Built appointment booking and management flows." }],
      }],
      localizedDisplay: {
        entries: {
          "projects:appointment-booking": {
            title: "Appointment Booking System",
          },
        },
      },
    };

    const localized = getLocalizedResumeForDisplay(resume);
    const refreshed = getLocalizedResumeForDisplay({
      ...resume,
      projects: resume.projects.map((project) => ({ ...project })),
    });

    expect(localized.summary).toContain("Appointment Booking System");
    expect(localized.projects[0]).toMatchObject({
      id: "appointment-booking",
      title: "Appointment Booking System",
    });
    expect(localized.projects[0].achievements[0].text).toBe("Built appointment booking and management flows.");
    expect(refreshed.projects[0].title).toBe("Appointment Booking System");
    expect(resume.projects[0].title).toBe("نظام حجز مواعيد");
  });

  it("uses canonical list values without asking for manual English localization", () => {
    const resume = {
      ...englishResume,
      personalInfo: {
        ...englishResume.personalInfo,
        city: "أبها",
        university: "جامعة الملك خالد",
      },
    };

    const localized = getLocalizedResumeForDisplay(resume);
    const reviews = getEnglishReviewItems(resume);

    expect(localized.personalInfo.city).toBe("Abha");
    expect(localized.personalInfo.university).toBe("King Khalid University");
    expect(reviews.some((item) => ["city", "university"].includes(item.field))).toBe(false);
  });

  it("keeps a generated project localization tied to its stable id and flags only a changed Arabic source for review", () => {
    const resume = {
      ...englishResume,
      projects: [{
        id: "appointment-booking",
        title: "نظام حجز مواعيد",
        description: "نظام يتيح للمستخدمين حجز المواعيد وتعديلها وإلغائها.",
        achievements: [{ id: "booking-bullet", text: "يدعم إدارة المواعيد." }],
      }],
      localizedDisplay: {
        entries: {
          "projects:appointment-booking": {
            title: "Appointment Booking System",
            description: "A web application for booking, updating, and cancelling appointments.",
          },
        },
        achievements: {
          "projects:appointment-booking:booking-bullet": "Supports appointment management.",
        },
        review: {
          "entries:projects:appointment-booking:title": { source: "نظام حجز مواعيد", approved: true },
          "entries:projects:appointment-booking:description": { source: "نظام يتيح للمستخدمين حجز المواعيد وتعديلها وإلغائها.", approved: true },
          "achievements:projects:appointment-booking:booking-bullet": { source: "يدعم إدارة المواعيد.", approved: true },
        },
      },
    };

    const localized = getLocalizedResumeForDisplay(resume);
    expect(localized.projects[0]).toMatchObject({
      id: "appointment-booking",
      title: "Appointment Booking System",
      description: "A web application for booking, updating, and cancelling appointments.",
    });
    expect(localized.projects[0].achievements[0].text).toBe("Supports appointment management.");
    expect(getEnglishReviewItems(resume)).toEqual([]);

    const changedSource = {
      ...resume,
      verifiedResumeFacts: {
        projects: [{
          ...resume.projects[0],
          title: "نظام إدارة المواعيد",
        }],
      },
    };
    const changedReviews = getEnglishReviewItems(changedSource);
    expect(changedReviews.some((item) => (
      item.field === "title" && item.localizationState === "review"
    ))).toBe(true);
    expect(resume.projects[0].title).toBe("نظام حجز مواعيد");
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

  it("keeps Noura's confirmed graduate identity and University of Jeddah in English", () => {
    const resume = {
      personalInfo: {
        fullName: "Noura Abdullah Alotaibi",
        englishName: "Noura Abdullah Alotaibi",
        major: "Business Administration",
        university: "University of Jeddah",
        city: "Jeddah",
        degree: "Bachelor's",
        studentStatus: "graduate",
        graduationYear: "2026",
        gpa: "4.35",
        gpaScale: "5",
        headline: "Business Administration Student",
      },
      summary: "Graduate in Business Administration with skills in Microsoft PowerPointB and Excel.",
      education: [{ id: "noura-education", title: "Bachelor's", organization: "University of Jeddah", location: "Jeddah" }],
      projects: [{ id: "customer-satisfaction", title: "Customer Satisfaction Analysis", description: "Analyzed customer satisfaction feedback." }],
      skills: ["Microsoft PowerPointB", "React", "React.js"],
      settings: { language: "en", direction: "ltr" },
    };

    const localized = getLocalizedResumeForDisplay(resume);
    const education = getResumeEducationDisplay(localized.education[0], localized.personalInfo, "en");

    expect(localized.personalInfo.headline).toBe("Business Administration Graduate");
    expect(localized.personalInfo.university).toBe("University of Jeddah");
    expect(localized.personalInfo.city).toBe("Jeddah");
    expect(localized.summary).not.toMatch(/Student/);
    expect(localized.summary).toMatch(/Graduate/);
    expect(localized.skills).toEqual(["Microsoft PowerPoint", "React.js"]);
    expect(education.facts).toEqual(["2026", "GPA: 4.35/5"]);
    expect(localized.projects[0].description).toBe("Analyzed customer satisfaction feedback.");
  });

  it("uses explicit Arabic grammatical gender without inferring it from a name", () => {
    const localized = getLocalizedResumeForDisplay({
      personalInfo: { major: "إدارة أعمال", studentStatus: "graduate", grammaticalGender: "feminine" },
      settings: { language: "ar", direction: "rtl" },
    });
    expect(localized.personalInfo.headline).toBe("خريجة إدارة أعمال");
  });

  it("uses the verified Noura facts before preview localization", () => {
    const resume = {
      personalInfo: {
        university: "Imam Mohammad Ibn Saud Islamic University",
        city: "Riyadh",
        studentStatus: "student",
      },
      summary: "Graduate in Business Administration with Excel skills.",
      projects: [{ id: "customer", title: "Customer Satisfaction Analysis", description: "" }],
      settings: { language: "en", direction: "ltr" },
      verifiedResumeFacts: {
        personalInfo: {
          fullName: "Noura Abdullah Alotaibi",
          englishName: "Noura Abdullah Alotaibi",
          major: "Business Administration",
          university: "University of Jeddah",
          city: "Jeddah",
          degree: "Bachelor's",
          studentStatus: "graduate",
          graduationYear: "2026",
          gpa: "4.35",
          gpaScale: "5",
        },
        education: [{ id: "education", title: "Bachelor's", organization: "University of Jeddah", location: "Jeddah" }],
        projects: [{ id: "customer", title: "Customer Satisfaction Analysis", description: "Analyzed customer satisfaction feedback." }],
        experiences: [], certifications: [], volunteering: [], skills: ["Microsoft PowerPoint"], languages: [], links: [],
      },
    };
    const verified = applyVerifiedResumeFacts(resume);
    const localized = getLocalizedResumeForDisplay(resume);
    expect(verified.personalInfo.university).toBe("University of Jeddah");
    expect(localized.personalInfo.headline).toBe("Business Administration Graduate");
    expect(localized.personalInfo.city).toBe("Jeddah");
    expect(localized.projects[0].description).toBe("Analyzed customer satisfaction feedback.");
    expect(localized.summary).not.toMatch(/[\u0600-\u06FF]/);
  });
});
