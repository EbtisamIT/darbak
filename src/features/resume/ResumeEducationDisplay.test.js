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
});
