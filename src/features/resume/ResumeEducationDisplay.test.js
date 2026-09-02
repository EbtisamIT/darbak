import { getResumeEducationDisplay } from "./resumeEducationDisplay";

describe("getResumeEducationDisplay", () => {
  it("shows confirmed graduation year and GPA", () => {
    const display = getResumeEducationDisplay(
      { title: "بكالوريوس", organization: "جامعة الملك سعود", location: "الرياض" },
      { major: "تقنية المعلومات", graduationYear: "2027", gpa: "4.5", gpaScale: "5" },
      "ar"
    );

    expect(display.title).toBe("بكالوريوس في تقنية المعلومات");
    expect(display.facts).toEqual(["2027", "المعدل: 4.5/5"]);
  });

  it("does not invent graduation facts when they are missing", () => {
    const display = getResumeEducationDisplay(
      { title: "بكالوريوس", organization: "جامعة الملك سعود" },
      { major: "تقنية المعلومات" },
      "ar"
    );

    expect(display.facts).toEqual([]);
  });

  it("renders optional student education facts without inferring any missing value", () => {
    const display = getResumeEducationDisplay(
      { title: "بكالوريوس", organization: "جامعة الملك خالد", location: "أبها" },
      {
        major: "علوم الحاسب",
        studyStartYear: "2023",
        expectedGraduationYear: "2027",
        gpa: "4.70",
        gpaScale: "5",
        academicTrack: "الذكاء الاصطناعي",
        relevantCoursework: ["قواعد البيانات", "هياكل البيانات"],
      },
      "ar"
    );

    expect(display.title).toBe("بكالوريوس في علوم الحاسب");
    expect(display.subtitle).toBe("جامعة الملك خالد — أبها");
    expect(display.facts).toEqual([
      "متوقع التخرج 2027",
      "المعدل: 4.70/5",
      "المسار الأكاديمي: الذكاء الاصطناعي",
      "مقررات ذات صلة: قواعد البيانات، هياكل البيانات",
    ]);
  });

  it("uses English education labels for the same confirmed facts", () => {
    const display = getResumeEducationDisplay(
      { title: "Bachelor's", organization: "King Khalid University", location: "Abha" },
      {
        major: "Computer Science",
        studyStartYear: "2023",
        expectedGraduationYear: "2027",
        gpa: "4.70",
        gpaScale: "5",
        relevantCoursework: ["Databases", "Data Structures"],
      },
      "en"
    );

    expect(display.facts).toEqual([
      "Expected Graduation: 2027",
      "GPA: 4.70/5",
      "Relevant Coursework: Databases, Data Structures",
    ]);
  });
});
