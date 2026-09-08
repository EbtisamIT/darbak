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
    academicTrack: "artificial_intelligence",
    relevantCoursework: ["قواعد البيانات", "هياكل البيانات"],
  }, portfolio.email);
  assert.strictEqual(enrichedStudent.personalInfo.studyStartYear, "2023");
  assert.strictEqual(enrichedStudent.personalInfo.expectedGraduationYear, "2027");
  assert.strictEqual(enrichedStudent.personalInfo.academicTrack, "artificial_intelligence");
  assert.deepStrictEqual(enrichedStudent.personalInfo.relevantCoursework, ["قواعد البيانات", "هياكل البيانات"]);
  assert.deepStrictEqual(enrichedStudent.sectionOrder.slice(0, 4), ["summary", "education", "projects", "skills"]);

  const graduateWithExperience = mapPortfolioToResumePayload({
    ...portfolio,
    studentStatus: "graduate",
    experiences: [{ title: "متدرب", description: "خبرة عملية" }],
  }, portfolio.email);
  assert.deepStrictEqual(graduateWithExperience.sectionOrder.slice(0, 4), ["summary", "experience", "education", "projects"]);
}

// Academic tracks are explicit list selections. Legacy free-text values are
// not facts and must not reach the verified resume payload.
{
  const explicitTrack = mapPortfolioToResumePayload({
    ...portfolio,
    academicTrack: "business_analytics",
  }, portfolio.email);
  const legacyTrack = mapPortfolioToResumePayload({
    ...portfolio,
    academicTrack: "تطوير الأعمال",
  }, portfolio.email);
  assert.strictEqual(explicitTrack.personalInfo.academicTrack, "business_analytics");
  assert.strictEqual(legacyTrack.personalInfo.academicTrack, "");
}

// Repeatable onboarding experiences keep their own stable identity and every
// saved responsibility reaches the verified payload that the agent receives.
{
  const experiencePortfolio = {
    ...portfolio,
    experiences: [
      {
        id: "experience-accounting",
        title: "متدربة محاسبة",
        organization: "شركة مثال",
        city: "الرياض",
        experienceType: "internship",
        startDate: "2026-01-01",
        endDate: "2026-04-01",
        responsibilities: [
          { id: "responsibility-invoices", text: "مراجعة الفواتير" },
          { id: "responsibility-reports", text: "إعداد التقارير الأسبوعية" },
        ],
      },
      {
        id: "experience-support",
        title: "مساعدة تقنية",
        organization: "نادي التقنية",
        experienceType: "volunteering",
        current: true,
        responsibilities: [
          { id: "responsibility-support", text: "دعم فعاليات النادي التقنية" },
        ],
      },
    ],
  };
  const verified = buildVerifiedResumeFacts(experiencePortfolio, experiencePortfolio.email);
  assert.strictEqual(verified.experiences.length, 2);
  assert.deepStrictEqual(verified.experiences.map((entry) => entry.id), ["experience-accounting", "experience-support"]);
  assert.strictEqual(verified.experiences[0].experienceType, "internship");
  assert.strictEqual(verified.experiences[1].isCurrent, true);
  assert.deepStrictEqual(
    verified.experiences[0].achievements.map((item) => item.text),
    ["مراجعة الفواتير", "إعداد التقارير الأسبوعية"],
  );
  assert.deepStrictEqual(
    verified.experiences[0].achievements.map((item) => item.id),
    ["responsibility-invoices", "responsibility-reports"],
  );

  const afterRemovingFirst = buildVerifiedResumeFacts({
    ...experiencePortfolio,
    experiences: [experiencePortfolio.experiences[1]],
  }, experiencePortfolio.email);
  assert.deepStrictEqual(afterRemovingFirst.experiences.map((entry) => entry.id), ["experience-support"]);

  const noExperience = buildVerifiedResumeFacts({ ...experiencePortfolio, experiences: [] }, experiencePortfolio.email);
  assert.deepStrictEqual(noExperience.experiences, []);
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
  assert.strictEqual(composed.summary, nouraPortfolio.bio);
  assert.strictEqual(composed.projects[0].description, "Analyzed customer satisfaction feedback.");
}

// An old inferred academic track must disappear when Portfolio has no explicit
// academic track fact; professional context remains separate.
{
  const saraPortfolio = {
    ...portfolio,
    _id: "sara-portfolio",
    major: "نظم المعلومات الإدارية",
    studentStatus: "طالبة",
    academicTrack: "",
    bio: "مهتمة بتحليل الأعمال والبيانات، وأحب أبرز مشروعي في Power BI.",
  };
  const composed = composeCanonicalResume({
    personalInfo: { academicTrack: "تطوير الأعمال" },
    settings: { language: "en" },
  }, saraPortfolio, saraPortfolio.email);
  assert.strictEqual(composed.personalInfo.academicTrack, "");
  assert.strictEqual(composed.verifiedResumeFacts.professionalContext, saraPortfolio.bio);
  assert.strictEqual(composed.personalInfo.headline, "طالبة نظم المعلومات الإدارية");
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
    ["achievements", "description", "details", "endDate", "experienceType", "id", "isCurrent", "location", "organization", "period", "startDate", "subtitle", "technologies", "title", "url"].sort()
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
    summary: "نبذة وكيل معتمدة.",
    experiences: [{
      id: verified.experiences[0].id,
      title: verified.experiences[0].title,
      achievements: [{ id: "approved-exp-bullet", text: "نقطة خبرة معتمدة." }],
    }],
    projects: [{
      id: verified.projects[0].id,
      title: verified.projects[0].title,
      achievements: [{ id: "approved-project-bullet", text: "نقطة مشروع معتمدة." }],
    }],
    settings: { language: "ar" },
  };
  const reopened = composeCanonicalResume(master, { ...portfolio, _id: "approved-draft-portfolio" }, portfolio.email);
  assert.strictEqual(reopened.summary, "نبذة وكيل معتمدة.");
  assert.deepStrictEqual(reopened.experiences[0].achievements.map((item) => item.text), ["نقطة خبرة معتمدة."]);
  assert.deepStrictEqual(reopened.projects[0].achievements.map((item) => item.text), ["نقطة مشروع معتمدة."]);
  assert.strictEqual(reopened.projects[0].description, "منصة لرحلة التدريب");
}

// An English translation must never become the presentation source for the
// Arabic master, even if a legacy client previously saved it into ResumeProfile.
{
  const verified = buildVerifiedResumeFacts({ ...portfolio, _id: "arabic-master-presentation" }, portfolio.email);
  const master = {
    personalInfo: verified.personalInfo,
    summary: "English translation summary marker.",
    experiences: [{
      id: verified.experiences[0].id,
      title: verified.experiences[0].title,
      description: "English experience description marker.",
      achievements: [{ id: "english-exp", text: "English experience bullet marker." }],
    }],
    projects: [{
      id: verified.projects[0].id,
      title: verified.projects[0].title,
      description: "English project description marker.",
      achievements: [{ id: "english-project", text: "English project bullet marker." }],
    }],
    settings: { language: "ar" },
  };
  const reopened = composeCanonicalResume(master, { ...portfolio, _id: "arabic-master-presentation" }, portfolio.email, {
    language: "ar",
  });
  assert.strictEqual(reopened.summary, portfolio.bio);
  assert.strictEqual(reopened.experiences[0].description, verified.experiences[0].description);
  assert.deepStrictEqual(reopened.experiences[0].achievements, verified.experiences[0].achievements);
  assert.strictEqual(reopened.projects[0].description, verified.projects[0].description);
  assert.deepStrictEqual(reopened.projects[0].achievements, verified.projects[0].achievements);
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
