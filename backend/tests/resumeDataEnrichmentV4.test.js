const assert = require("assert");
const Portfolio = require("../models/Portfolio");
const { buildVerifiedResumeFacts } = require("../services/resumePortfolioHydration");

const portfolio = {
  fullName: "طالب اختبار",
  major: "تقنية المعلومات",
  university: "جامعة اختبار",
  city: "الرياض",
  degreeLevel: "بكالوريوس",
  studentStatus: "student",
  expectedGraduationYear: "2027",
  academicTrack: "مسار أنظمة المعلومات",
  academicTrackSource: "custom",
  honors: ["مرتبة الشرف"],
  certifications: [{ id: "cert-1", title: "شهادة مهنية", provider: "جهة", issueDate: "2026-01-01", expirationDate: "2028-01-01", credentialId: "C-1" }],
  courses: [{ id: "course-1", title: "تحليل البيانات", provider: "منصة", year: "2026" }],
};

const document = new Portfolio(portfolio);
assert.strictEqual(document.courses[0].title, "تحليل البيانات");
assert.strictEqual(document.certifications[0].credentialId, "C-1");
assert.strictEqual(document.honors[0], "مرتبة الشرف");

const facts = buildVerifiedResumeFacts(portfolio, "student@example.com");
assert.strictEqual(facts.personalInfo.academicTrack, "مسار أنظمة المعلومات");
assert.deepStrictEqual(facts.personalInfo.honors, ["مرتبة الشرف"]);
assert.strictEqual(facts.certifications[0].period, "2026-01-01");
assert.strictEqual(facts.courses[0].title, "تحليل البيانات");

console.log("resumeDataEnrichmentV4 tests passed");
