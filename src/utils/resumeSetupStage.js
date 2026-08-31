const isValidEmail = (value) => /^\S+@\S+\.\S+$/.test(String(value || "").trim());

export const getResumeSetupFields = (source = {}, fallbackEmail = "") => {
  const major = source.major === "أخرى" ? source.majorOther : source.major;
  const city = source.city === "أخرى" ? source.cityOther : source.city;
  const university = source.university === "أخرى" ? source.universityOther : source.university;
  const degree = source.degreeLevel === "أخرى" ? source.degreeOther : source.degreeLevel;
  const skills = String(source.skills || "")
    .split(/[,،]/)
    .map((skill) => skill.trim())
    .filter(Boolean);
  const hasEvidence = [...(source.projects || []), ...(source.experiences || [])]
    .some((entry) => entry?.title || entry?.description || entry?.organization || entry?.url);

  return [
    ["fullName", "الاسم", Boolean(source.fullName?.trim())],
    ["major", "التخصص", Boolean(major?.trim())],
    ["city", "المدينة", Boolean(city?.trim())],
    ["university", "الجامعة", Boolean(university?.trim())],
    ["education", "الدرجة أو الحالة التعليمية", Boolean(degree?.trim() || source.studentStatus)],
    ["email", "وسيلة التواصل", Boolean(source.email?.trim() || isValidEmail(fallbackEmail))],
    ["bio", "نبذة مهنية", Boolean(source.bio?.trim())],
    ["skills", "مهارة واحدة على الأقل", Boolean(skills.length)],
    ["evidence", "مشروع أو خبرة واحدة على الأقل", hasEvidence],
  ];
};

export const getResumeSetupProgress = (stageFields, currentFields) => {
  const currentByKey = new Map(
    currentFields.map(([key, label, complete]) => [key, { label, complete }])
  );

  return stageFields.filter(([key]) => currentByKey.get(key)?.complete).length;
};
