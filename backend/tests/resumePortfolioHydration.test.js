const assert = require("assert");
const {
  mapPortfolioToResumePayload,
  buildVerifiedResumeFacts,
  composeCanonicalResume,
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
  assert.deepStrictEqual(result.resume.skills, ["React.js", "UI/UX"]);
  assert.strictEqual(result.resume.education[0].endDate, "2027");
  assert.strictEqual(result.resume.education[0].isCurrent, false);
}

// Student enrichment facts are optional, persist from Portfolio, and influence
// only the initial section presentation for students without experience.
{
  const enrichedStudent = mapPortfolioToResumePayload({
    ...portfolio,
    experiences: [],
    studyStartYear: "2023",
    expectedGraduationYear: "2027",
    graduationYear: "",
    academicTrack: "الذكاء الاصطناعي",
    relevantCoursework: ["قواعد البيانات", "هياكل البيانات"],
  }, portfolio.email);
  assert.strictEqual(enrichedStudent.personalInfo.studyStartYear, "2023");
  assert.strictEqual(enrichedStudent.personalInfo.expectedGraduationYear, "2027");
  assert.deepStrictEqual(enrichedStudent.personalInfo.relevantCoursework, ["قواعد البيانات", "هياكل البيانات"]);
  assert.deepStrictEqual(enrichedStudent.sectionOrder.slice(0, 4), ["summary", "education", "projects", "skills"]);

  const graduateWithExperience = mapPortfolioToResumePayload({
    ...portfolio,
    studentStatus: "graduate",
    experiences: [{ title: "متدرب", description: "خبرة عملية" }],
  }, portfolio.email);
  assert.deepStrictEqual(graduateWithExperience.sectionOrder.slice(0, 4), ["summary", "experience", "education", "projects"]);
}

// Noura acceptance: verified Portfolio facts always win over a stale local or
// legacy ResumeProfile, while the summary remains presentation.
{
  const nouraPortfolio = {
    ...portfolio,
    _id: "noura-portfolio",
    fullName: "Noura Abdullah Alotaibi",
    major: "Business Administration",
    university: "University of Jeddah",
    city: "Jeddah",
    degreeLevel: "Bachelor's",
    studentStatus: "graduate",
    graduationYear: "2026",
    gpa: "4.35",
    gpaScale: "5",
    projects: [{ title: "Customer Satisfaction Analysis", description: "Analyzed customer satisfaction feedback." }],
  };
  const verified = buildVerifiedResumeFacts(nouraPortfolio, "noura@example.com");
  const composed = composeCanonicalResume({
    personalInfo: {
      university: "Imam Mohammad Ibn Saud Islamic University",
      city: "Riyadh",
      studentStatus: "student",
      major: "Business Administration",
    },
    summary: "Presentation text stays editable.",
    projects: [{ id: verified.projects[0].id, title: "Customer Satisfaction Analysis", description: "" }],
    settings: { language: "ar" },
  }, nouraPortfolio, "noura@example.com");
  assert.strictEqual(composed.personalInfo.university, "University of Jeddah");
  assert.strictEqual(composed.personalInfo.city, "Jeddah");
  assert.strictEqual(composed.personalInfo.studentStatus, "graduate");
  assert.strictEqual(composed.personalInfo.headline, "خريج/ة Business Administration");
  assert.strictEqual(composed.summary, "Presentation text stays editable.");
  assert.strictEqual(composed.projects[0].description, "Analyzed customer satisfaction feedback.");
}

// Case G: a legacy education item with no year is completed from Portfolio,
// without replacing any student-entered education date.
{
  const result = hydrateResumeFromPortfolio(
    {
      personalInfo: { graduationYear: "", gpa: "", gpaScale: "" },
      education: [{
        id: "old-education",
        title: "بكالوريوس",
        organization: "جامعة الملك سعود",
        period: "",
        endDate: "",
        isCurrent: true,
      }],
    },
    mapped
  );
  assert.strictEqual(result.resume.education[0].endDate, "2027");
  assert.strictEqual(result.resume.education[0].isCurrent, false);
  assert.strictEqual(result.resume.personalInfo.gpa, "4.5");
  assert.strictEqual(result.resume.personalInfo.gpaScale, "5");
}

// A Portfolio-derived profile repairs stale identity facts from an older draft.
// This prevents a new account from inheriting another profile's university/city.
{
  const result = hydrateResumeFromPortfolio(
    {
      workflow: { source: "portfolio" },
      personalInfo: {
        fullName: "Noura Abdullah Alotaibi",
        major: "Business Administration",
        university: "Imam Mohammad Ibn Saud Islamic University",
        city: "Riyadh",
        degree: "Bachelor's",
        studentStatus: "student",
      },
      education: [{ title: "Bachelor's", organization: "Imam Mohammad Ibn Saud Islamic University", period: "2024" }],
    },
    mapPortfolioToResumePayload({
      ...portfolio,
      fullName: "Noura Abdullah Alotaibi",
      major: "Business Administration",
      university: "University of Jeddah",
      city: "Jeddah",
      degreeLevel: "Bachelor's",
      studentStatus: "graduate",
      graduationYear: "2026",
      gpa: "4.35",
      gpaScale: "5",
    }, "noura@example.com")
  );
  assert.strictEqual(result.resume.personalInfo.university, "University of Jeddah");
  assert.strictEqual(result.resume.personalInfo.city, "Jeddah");
  assert.strictEqual(result.resume.personalInfo.studentStatus, "graduate");
  assert.strictEqual(result.resume.education.length, 1);
  assert.strictEqual(result.resume.education[0].organization, "University of Jeddah");
}

// Case H: without a confirmed year, "current" is only used for a confirmed
// student status.
{
  const noYear = mapPortfolioToResumePayload(
    { ...portfolio, graduationYear: "", studentStatus: "student" },
    portfolio.email
  );
  assert.strictEqual(noYear.education[0].endDate, "");
  assert.strictEqual(noYear.education[0].isCurrent, true);
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
    ["achievements", "description", "details", "endDate", "id", "isCurrent", "location", "organization", "period", "startDate", "subtitle", "technologies", "title", "url"].sort()
  );
  assert.strictEqual(mapped.certifications[0].title, "ITIL v4");
  assert.strictEqual(mapped.certifications[0].organization, "PeopleCert");
  assert.strictEqual(mapped.languages[1].name, "English");
}

// Multiple Portfolio projects and certifications remain distinct after a
// hydrate/reload cycle, including their stable item IDs and optional metadata.
{
  const collectionPortfolio = {
    ...portfolio,
    projects: [
      { id: "project-one", title: "مشروع أول", description: "وصف الأول", technologies: ["React.js"], url: "https://example.com/one" },
      { id: "project-two", title: "مشروع ثانٍ", description: "وصف الثاني", technologies: ["Firebase"] },
      { id: "project-three", title: "مشروع ثالث", description: "وصف الثالث" },
    ],
    certifications: [
      { id: "cert-one", title: "شهادة أولى", provider: "جهة أولى", year: "2025", credentialUrl: "https://example.com/cert-one" },
      { id: "cert-two", title: "شهادة ثانية", provider: "جهة ثانية", year: "2026" },
    ],
  };
  const collectionPayload = mapPortfolioToResumePayload(collectionPortfolio, collectionPortfolio.email);
  const reopened = hydrateResumeFromPortfolio(null, collectionPayload).resume;
  assert.deepStrictEqual(reopened.projects.map((project) => project.id), ["project-one", "project-two", "project-three"]);
  assert.deepStrictEqual(reopened.certifications.map((certification) => certification.id), ["cert-one", "cert-two"]);
  assert.deepStrictEqual(reopened.projects[0].technologies, ["React.js"]);
  assert.strictEqual(reopened.certifications[0].url, "https://example.com/cert-one");
  const withoutMiddleProject = {
    ...collectionPortfolio,
    projects: collectionPortfolio.projects.filter((project) => project.id !== "project-two"),
  };
  const afterRemoval = mapPortfolioToResumePayload(withoutMiddleProject, withoutMiddleProject.email);
  assert.deepStrictEqual(afterRemoval.projects.map((project) => project.id), ["project-one", "project-three"]);
}

// Case E: after the persisted payload is read again, no fields are lost.
{
  const first = hydrateResumeFromPortfolio(null, mapped).resume;
  const reopened = hydrateResumeFromPortfolio(first, mapped);
  assert.strictEqual(reopened.resume.personalInfo.fullName, "سارة أحمد");
  assert.strictEqual(reopened.resume.projects.length, 1);
  assert.strictEqual(reopened.resume.skills.length, 2);
}

// An approved Agent draft owns presentation wording after it is persisted.
// Portfolio keeps entry identity and facts, while the canonical resume keeps
// the reviewed summary and rewritten bullets for editor and PDF rendering.
{
  const verified = buildVerifiedResumeFacts({ ...portfolio, _id: "approved-draft-portfolio" }, portfolio.email);
  const master = {
    personalInfo: verified.personalInfo,
    summary: "Reviewed Agent summary marker.",
    experiences: [{
      id: verified.experiences[0].id,
      title: verified.experiences[0].title,
      achievements: [{ id: "approved-exp-bullet", text: "Reviewed experience bullet marker." }],
    }],
    projects: [{
      id: verified.projects[0].id,
      title: verified.projects[0].title,
      achievements: [{ id: "approved-project-bullet", text: "Reviewed project bullet marker." }],
    }],
    settings: { language: "ar" },
  };
  const reopened = composeCanonicalResume(master, { ...portfolio, _id: "approved-draft-portfolio" }, portfolio.email);
  assert.strictEqual(reopened.summary, "Reviewed Agent summary marker.");
  assert.deepStrictEqual(reopened.experiences[0].achievements.map((item) => item.text), ["Reviewed experience bullet marker."]);
  assert.deepStrictEqual(reopened.projects[0].achievements.map((item) => item.text), ["Reviewed project bullet marker."]);
  assert.strictEqual(reopened.projects[0].description, "منصة لرحلة التدريب");
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
