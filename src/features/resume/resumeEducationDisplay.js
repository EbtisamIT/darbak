import { getAcademicTrackLabel } from "../../data/academicTracks";

const containsArabic = (value = "") => /[\u0600-\u06FF]/.test(String(value));

export const getResumeEducationDisplay = (entry = {}, personal = {}, language = "ar") => {
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
  const gpa = String(personal.gpa || "").trim();
  const gpaScale = String(personal.gpaScale || "").trim();
  const academicTrack = getAcademicTrackLabel(personal.academicTrack, language);
  const coursework = (Array.isArray(personal.relevantCoursework) ? personal.relevantCoursework : [])
    .map((course) => String(course || "").trim())
    .filter(Boolean);
  const degreeIncludesMajor = major && degree.toLowerCase().includes(major.toLowerCase());
  const title = degree && major && !degreeIncludesMajor
    ? language === "en" ? `${degree} in ${major}` : `${degree} في ${major}`
    : degree || major;

  const graduationLine = graduationYear
    ? (startYear ? `${startYear} – ${graduationYear}` : graduationYear)
    : expectedGraduationYear
      ? (language === "en" ? `Expected Graduation: ${expectedGraduationYear}` : `متوقع التخرج ${expectedGraduationYear}`)
      : startYear;

  return {
    title,
    subtitle: [university, city].filter(Boolean).join(" — "),
    facts: [
      graduationLine,
      gpa && (language === "en" ? `GPA: ${gpa}${gpaScale ? `/${gpaScale}` : ""}` : `المعدل: ${gpa}${gpaScale ? `/${gpaScale}` : ""}`),
      academicTrack && (language === "en" ? `Academic Track: ${academicTrack}` : `المسار الأكاديمي: ${academicTrack}`),
      coursework.length && (language === "en" ? `Relevant Coursework: ${coursework.join(", ")}` : `مقررات ذات صلة: ${coursework.join("، ")}`),
    ].filter(Boolean),
  };
};
