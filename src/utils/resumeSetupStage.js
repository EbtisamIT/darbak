const isValidEmail = (value) => /^\S+@\S+\.\S+$/.test(String(value || "").trim());

export const getResumeSetupInputId = (key) => `resume-setup-${key}`;

const valueFor = (source = {}, key, fallbackEmail = "") => {
  const major = source.major === "أخرى" ? source.majorOther : source.major;
  const city = source.city === "أخرى" ? source.cityOther : source.city;
  const university = source.university === "أخرى" ? source.universityOther : source.university;
  const degree = source.degreeLevel === "أخرى" ? source.degreeOther : source.degreeLevel;
  const validStudentStatus = ["student", "graduate", "expected_graduate"].includes(source.studentStatus)
    ? source.studentStatus
    : "";
  const skills = Array.isArray(source.skills)
    ? source.skills
    : String(source.skills || "").split(/[,،]/);
  const evidence = [...(source.projects || []), ...(source.experiences || [])]
    .find((entry) => entry?.title || entry?.description || entry?.organization || entry?.url);

  const values = {
    fullName: source.fullName,
    major,
    city,
    university,
    education: degree || validStudentStatus,
    email: isValidEmail(source.email) ? source.email : isValidEmail(fallbackEmail) ? fallbackEmail : "",
    bio: source.bio,
    skills: skills.map((skill) => String(skill || "").trim()).filter(Boolean).join("، "),
    evidence: evidence?.title || evidence?.organization || evidence?.description || "",
  };

  return String(values[key] || "").trim();
};

export const getResumeSetupFields = (source = {}, fallbackEmail = "") => {
  return [
    ["fullName", "الاسم", Boolean(valueFor(source, "fullName", fallbackEmail))],
    ["major", "التخصص", Boolean(valueFor(source, "major", fallbackEmail))],
    ["city", "المدينة", Boolean(valueFor(source, "city", fallbackEmail))],
    ["university", "الجامعة", Boolean(valueFor(source, "university", fallbackEmail))],
    ["education", "الدرجة أو الحالة التعليمية", Boolean(valueFor(source, "education", fallbackEmail))],
    ["email", "وسيلة التواصل", Boolean(valueFor(source, "email", fallbackEmail))],
    ["skills", "مهارة واحدة على الأقل", Boolean(valueFor(source, "skills", fallbackEmail))],
    ["evidence", "مشروع أو خبرة واحدة على الأقل", Boolean(valueFor(source, "evidence", fallbackEmail))],
  ];
};

// One live source of truth for the onboarding UI. Workflow completion only
// controls whether onboarding is entered; it never marks a fact as complete.
export const getResumeSetupCompleteness = (source = {}, fallbackEmail = "") => {
  const fields = getResumeSetupFields(source, fallbackEmail);
  const values = Object.fromEntries(
    fields.map(([key]) => [key, valueFor(source, key, fallbackEmail)])
  );
  const completedCount = fields.filter(([, , complete]) => complete).length;

  return {
    fields,
    values,
    completedCount,
    totalCount: fields.length,
    missingCount: fields.length - completedCount,
  };
};

export const getResumeSetupProgress = (stageFields, currentFields) => {
  const currentByKey = new Map(
    currentFields.map(([key, label, complete]) => [key, { label, complete }])
  );

  return stageFields.filter(([key]) => currentByKey.get(key)?.complete).length;
};
