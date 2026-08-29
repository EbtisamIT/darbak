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
  const year = String(personal.graduationYear || entry.period || entry.endDate || "").trim();
  const gpa = String(personal.gpa || "").trim();
  const gpaScale = String(personal.gpaScale || "").trim();
  const degreeIncludesMajor = major && degree.toLowerCase().includes(major.toLowerCase());
  const title = degree && major && !degreeIncludesMajor
    ? language === "en" ? `${degree} in ${major}` : `${degree} في ${major}`
    : degree || major;

  return {
    title,
    subtitle: [university, city].filter(Boolean).join(" — "),
    facts: [
      year,
      gpa && (language === "en" ? `GPA: ${gpa}${gpaScale ? `/${gpaScale}` : ""}` : `المعدل: ${gpa}${gpaScale ? `/${gpaScale}` : ""}`),
    ].filter(Boolean),
  };
};
