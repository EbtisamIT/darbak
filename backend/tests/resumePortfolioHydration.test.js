const assert = require("assert");
const {
  mapPortfolioToResumePayload,
  hydrateResumeFromPortfolio,
} = require("../services/resumePortfolioHydration");

const portfolio = {
  fullName: "سارة أحمد",
  email: "sara@example.com",
  phone: "0500000000",
  city: "الرياض",
  major: "تقنية المعلومات",
  university: "جامعة الملك سعود",
  degreeLevel: "بكالوريوس",
  studentStatus: "student",
  graduationYear: "2027",
  gpa: "4.5",
  gpaScale: "5",
  professionalHeadline: "طالبة تقنية معلومات",
  bio: "مهتمة بتطوير المنتجات الرقمية.",
  skills: ["React", "UI/UX"],
  projects: [{ name: "دربك", description: "منصة لرحلة التدريب", link: "https://darbak.sa" }],
  experiences: [{ title: "مساعدة مطورة", organization: "نادي التقنية", period: "2025", description: "طورت واجهات." }],
  certifications: [{ title: "ITIL v4", provider: "PeopleCert", year: "2025" }],
  volunteering: [{ title: "عضوة", organization: "نادي إنجاز", description: "نظمت فعاليات." }],
  languages: [{ name: "العربية", level: "أم" }, { name: "English", level: "متقدم" }],
  linkedinUrl: "https://linkedin.com/in/sara",
  githubUrl: "https://github.com/sara",
  personalWebsite: "https://sara.dev",
  slug: "sara-ahmed",
};

const mapped = mapPortfolioToResumePayload(portfolio, portfolio.email, {
  frontendUrl: "https://darbak.sa",
  sectionOrder: ["summary", "education", "projects", "skills"],
});

// Case A: no master exists -> a complete master payload is produced.
{
  const result = hydrateResumeFromPortfolio(null, mapped);
  assert.strictEqual(result.changed, true);
  assert.strictEqual(result.resume.personalInfo.fullName, "سارة أحمد");
  assert.strictEqual(result.resume.personalInfo.major, "تقنية المعلومات");
  assert.strictEqual(result.resume.personalInfo.degree, "بكالوريوس");
  assert.strictEqual(result.resume.projects[0].title, "دربك");
  assert.strictEqual(result.resume.projects[0].url, "https://darbak.sa");
  assert.deepStrictEqual(result.resume.skills, ["React", "UI/UX"]);
}

// Case B: an old, empty master is backfilled.
{
  const result = hydrateResumeFromPortfolio({ personalInfo: {}, skills: [], projects: [] }, mapped);
  assert.strictEqual(result.changed, true);
  assert.strictEqual(result.patch.personalInfo.university, "جامعة الملك سعود");
  assert.strictEqual(result.patch.projects[0].title, "دربك");
  assert.strictEqual(result.patch.certifications[0].organization, "PeopleCert");
}

// Case C: a student-written summary is never overwritten.
{
  const result = hydrateResumeFromPortfolio(
    { personalInfo: { fullName: "سارة أحمد" }, summary: "نبذة كتبتها بنفسي", skills: [] },
    mapped
  );
  assert.strictEqual(result.resume.summary, "نبذة كتبتها بنفسي");
  assert.strictEqual(Object.prototype.hasOwnProperty.call(result.patch, "summary"), false);
}

// Case D: Portfolio array shapes normalize to the Resume entry shape.
{
  assert.deepStrictEqual(
    Object.keys(mapped.projects[0]).sort(),
    ["achievements", "description", "details", "endDate", "id", "isCurrent", "location", "organization", "period", "startDate", "subtitle", "title", "url"].sort()
  );
  assert.strictEqual(mapped.certifications[0].title, "ITIL v4");
  assert.strictEqual(mapped.certifications[0].organization, "PeopleCert");
  assert.strictEqual(mapped.languages[1].name, "English");
}

// Case E: after the persisted payload is read again, no fields are lost.
{
  const first = hydrateResumeFromPortfolio(null, mapped).resume;
  const reopened = hydrateResumeFromPortfolio(first, mapped);
  assert.strictEqual(reopened.resume.personalInfo.fullName, "سارة أحمد");
  assert.strictEqual(reopened.resume.projects.length, 1);
  assert.strictEqual(reopened.resume.skills.length, 2);
}

// Case F: an invalid legacy numeric phone is repaired from the professional
// profile without overwriting valid student-entered resume facts.
{
  const result = hydrateResumeFromPortfolio(
    {
      personalInfo: {
        fullName: "اسم عدلته بنفسي",
        phone: 0,
        graduationYear: "",
        gpa: "",
        gpaScale: "",
      },
    },
    mapped
  );
  assert.strictEqual(result.resume.personalInfo.fullName, "اسم عدلته بنفسي");
  assert.strictEqual(result.resume.personalInfo.phone, "0500000000");
  assert.strictEqual(typeof result.resume.personalInfo.phone, "string");
  assert.strictEqual(result.resume.personalInfo.graduationYear, "2027");
  assert.strictEqual(result.resume.personalInfo.gpa, "4.5");
  assert.strictEqual(result.resume.personalInfo.gpaScale, "5");
}

console.log("resumePortfolioHydration tests passed");
