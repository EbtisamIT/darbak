import { getAcademicTrackLabel } from "../../data/academicTracks";

const containsArabic = (value = "") => /[\u0600-\u06FF]/.test(String(value));
const list = (value) => (Array.isArray(value) ? value : []);

const entryEvidenceCount = (entry = {}) => {
  const achievements = list(entry.achievements)
    .filter((item) => String(item?.text || item?.html || item || "").trim());
  const responsibilities = list(entry.responsibilities)
    .filter((item) => String(item?.text || item || "").trim());
  const hasDescription = Boolean(String(entry.description || entry.details || "").trim());
  return Math.max(achievements.length, responsibilities.length, hasDescription ? 1 : 0);
};

export const getEducationDetailLevel = (resume = {}) => {
  const personal = resume.personalInfo || {};
  const experiences = list(resume.experiences?.length ? resume.experiences : resume.experience)
    .filter((entry) => entry && (entry.title || entry.organization || entry.description || entry.details));
  const projects = list(resume.projects)
    .filter((entry) => entry && (entry.title || entry.description || entry.details));
  const strongExperience = experiences.length >= 2 || experiences.some((entry) => entryEvidenceCount(entry) >= 2);
  const strongProjects = projects.filter((entry) => entryEvidenceCount(entry) >= 1).length >= 2;
  const status = String(personal.studentStatus || "").trim();

  if (strongExperience) return "concise";
  if (experiences.length || strongProjects) return "standard";
  if (["student", "expected_graduate", "graduate"].includes(status)) return "rich";
  return "standard";
};

export const getResumeEducationDisplay = (entry = {}, personal = {}, language = "ar", resume = {}) => {
  const detailLevel = getEducationDetailLevel({ ...resume, personalInfo: personal });
  const degree = String(entry.title || personal.degree || "").trim();
  const major = String(personal.major || "").trim();
  const entryUniversity = String(entry.organization || entry.subtitle || "").trim();
  const entryCity = String(entry.location || "").trim();
  const university = language === "en" && containsArabic(entryUniversity) && personal.university
    ? String(personal.university).trim()
    : (entryUniversity || String(personal.university || "").trim());
  const city = language === "en" && containsArabic(entryCity) && personal.city
    ? String(personal.city).trim()
    : (entryCity || String(personal.city || "").trim());
  const startYear = String(personal.studyStartYear || entry.startDate || "").trim();
  const graduationYear = String(personal.graduationYear || entry.period || entry.endDate || "").trim();
  const expectedGraduationYear = String(personal.expectedGraduationYear || "").trim();
  const isStudent = ["student", "expected_graduate"].includes(personal.studentStatus);
  const endYear = isStudent ? (expectedGraduationYear || graduationYear) : graduationYear;
  const gpa = String(personal.gpa || "").trim();
  const gpaScale = String(personal.gpaScale || "").trim();
  const academicTrack = getAcademicTrackLabel(personal.academicTrack, language);
  const coursework = list(personal.relevantCoursework)
    .map((course) => String(course || "").trim())
    .filter(Boolean);
  const degreeIncludesMajor = major && degree.toLowerCase().includes(major.toLowerCase());
  const title = degree && major && !degreeIncludesMajor
    ? language === "en" ? `${degree} in ${major}` : `${degree} في ${major}`
    : degree || major;

  let graduationLine = "";
  if (endYear) {
    if (isStudent) {
      graduationLine = detailLevel === "rich" && startYear
        ? `${startYear} – ${endYear} (${language === "en" ? "Expected" : "متوقع"})`
        : language === "en" ? `Expected Graduation: ${endYear}` : `متوقع التخرج: ${endYear}`;
    } else {
      graduationLine = detailLevel === "rich" && startYear ? `${startYear} – ${endYear}` : endYear;
    }
  } else if (detailLevel === "rich" && startYear) {
    graduationLine = startYear;
  }

  return {
    detailLevel,
    title,
    subtitle: [university, detailLevel === "rich" ? city : ""].filter(Boolean).join(" — "),
    facts: [
      graduationLine,
      gpa && (language === "en" ? `GPA: ${gpa}${gpaScale ? `/${gpaScale}` : ""}` : `المعدل: ${gpa}${gpaScale ? `/${gpaScale}` : ""}`),
      detailLevel !== "concise" && academicTrack && (language === "en" ? `Academic Track: ${academicTrack}` : `المسار الأكاديمي: ${academicTrack}`),
      detailLevel === "rich" && coursework.length && (language === "en" ? `Relevant Coursework: ${coursework.join(", ")}` : `مقررات ذات صلة: ${coursework.join("، ")}`),
    ].filter(Boolean),
  };
};
