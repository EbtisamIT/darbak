import { getEducationDetailLevel, getResumeEducationDisplay } from "./resumeEducationDisplay";

describe("resume education intelligence", () => {
  const education = { title: "بكالوريوس", organization: "جامعة الملك خالد", location: "أبها" };

  it("uses rich education for a student without experience", () => {
    const personal = {
      major: "علوم الحاسب",
      studentStatus: "student",
      studyStartYear: "2023",
      expectedGraduationYear: "2027",
      gpa: "4.70",
      gpaScale: "5",
      academicTrack: "artificial_intelligence",
      relevantCoursework: ["قواعد البيانات", "هياكل البيانات"],
    };
    const display = getResumeEducationDisplay(education, personal, "ar", { personalInfo: personal });

    expect(display.detailLevel).toBe("rich");
    expect(display.title).toBe("بكالوريوس في علوم الحاسب");
    expect(display.subtitle).toBe("جامعة الملك خالد — أبها");
    expect(display.facts).toEqual([
      "2023 – 2027 (متوقع)",
      "المعدل: 4.70/5",
      "المسار الأكاديمي: الذكاء الاصطناعي",
      "مقررات ذات صلة: قواعد البيانات، هياكل البيانات",
    ]);
  });

  it("uses standard education for a student with strong projects", () => {
    const personal = {
      major: "علوم الحاسب",
      studentStatus: "student",
      expectedGraduationYear: "2027",
      gpa: "4.70",
      gpaScale: "5",
      academicTrack: "artificial_intelligence",
      relevantCoursework: ["قواعد البيانات"],
    };
    const resume = {
      personalInfo: personal,
      projects: [
        { id: "p1", title: "مشروع أول", description: "وصف موثق" },
        { id: "p2", title: "مشروع ثان", description: "وصف موثق" },
      ],
    };
    const display = getResumeEducationDisplay(education, personal, "ar", resume);

    expect(display.detailLevel).toBe("standard");
    expect(display.subtitle).toBe("جامعة الملك خالد");
    expect(display.facts).toEqual([
      "متوقع التخرج: 2027",
      "المعدل: 4.70/5",
      "المسار الأكاديمي: الذكاء الاصطناعي",
    ]);
  });

  it("uses concise education for a graduate with a substantive internship", () => {
    const personal = {
      major: "المحاسبة",
      studentStatus: "graduate",
      studyStartYear: "2021",
      graduationYear: "2025",
      gpa: "4.35",
      gpaScale: "5",
      academicTrack: "business_analytics",
      relevantCoursework: ["المحاسبة المالية"],
    };
    const resume = {
      personalInfo: personal,
      experiences: [{
        title: "متدربة محاسبة",
        achievements: [{ text: "مراجعة الفواتير" }, { text: "إعداد التقارير" }],
      }],
    };
    const display = getResumeEducationDisplay(education, personal, "ar", resume);

    expect(display.detailLevel).toBe("concise");
    expect(display.subtitle).toBe("جامعة الملك خالد");
    expect(display.facts).toEqual(["2025", "المعدل: 4.35/5"]);
  });

  it("does not infer dates, GPA, track, coursework, or honors", () => {
    const personal = { major: "تقنية المعلومات", studentStatus: "graduate" };
    const display = getResumeEducationDisplay(education, personal, "ar", { personalInfo: personal });

    expect(display.detailLevel).toBe("rich");
    expect(display.facts).toEqual([]);
  });

  it("renders the same confirmed facts in English without Arabic script", () => {
    const personal = {
      major: "Computer Science",
      studentStatus: "student",
      studyStartYear: "2023",
      expectedGraduationYear: "2027",
      gpa: "4.70",
      gpaScale: "5",
      academicTrack: "artificial_intelligence",
      relevantCoursework: ["Databases", "Data Structures"],
    };
    const display = getResumeEducationDisplay(
      { title: "Bachelor's", organization: "King Khalid University", location: "Abha" },
      personal,
      "en",
      { personalInfo: personal },
    );

    expect(display.facts).toEqual([
      "2023 – 2027 (Expected)",
      "GPA: 4.70/5",
      "Academic Track: Artificial Intelligence",
      "Relevant Coursework: Databases, Data Structures",
    ]);
    expect(JSON.stringify(display)).not.toMatch(/[\u0600-\u06FF]/);
  });

  it("returns a stable detail level for identical facts", () => {
    const resume = { personalInfo: { studentStatus: "student" }, projects: [] };
    expect(getEducationDetailLevel(resume)).toBe(getEducationDetailLevel(resume));
  });
});
