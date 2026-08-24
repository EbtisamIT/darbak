const normalizeText = (value = "") =>
  value
    .toString()
    .toLowerCase()
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}+#.\-\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "you", "your", "are", "will",
  "على", "الى", "في", "من", "عن", "مع", "لديه", "لديها", "يكون", "تكون", "مطلوب", "فرصه",
  "التدريب", "تدريب", "الجهة", "الشركة", "شركه", "العمل", "متدرب", "متدربة",
  "طلاب", "طالبات", "التقديم", "السيرة", "السيره", "الذاتية", "الذاتيه", "الشروط",
  "المتطلبات", "التخصصات", "الاعلان", "الإعلان", "البرنامج", "العامه", "عامة",
]);

const KNOWN_TERMS = [
  "react", "javascript", "typescript", "node.js", "nodejs", "python", "java", "sql",
  "html", "css", "figma", "power bi", "excel", "data analysis", "google analytics",
  "ui ux", "ux", "ui", "cybersecurity", "networking", "aws", "azure", "git", "github",
  "machine learning", "artificial intelligence", "microsoft office", "sap", "autocad",
  "revit", "matlab", "php", "laravel", "flutter", "dart", "c#", "c++",
  "تحليل البيانات", "امن سيبراني", "الامن السيبراني", "تصميم تجربه المستخدم", "تجربة المستخدم",
  "تطوير الويب", "قواعد البيانات", "ذكاء اصطناعي", "الذكاء الاصطناعي", "شبكات", "محاسبة",
  "مالية", "موارد بشرية", "ادارة اعمال", "اداره اعمال", "تسويق", "قانون", "هندسة",
];

const unique = (values = []) => Array.from(new Set(values.filter(Boolean)));

const getEntryText = (entry = {}) =>
  [
    entry.title,
    entry.subtitle,
    entry.organization,
    entry.description,
    entry.details,
    ...(entry.achievements || []).map((item) => item.text || item.html || ""),
  ]
    .filter(Boolean)
    .join(" ");

const collectResumeFacts = (resume = {}) => {
  const personal = resume.personalInfo || {};
  const skills = unique((resume.skills || []).map((item) => item.toString().trim()));
  const experience = resume.experience || resume.experiences || [];
  const projects = resume.projects || [];
  const certifications = resume.certifications || [];
  const education = resume.education || [];

  return {
    skills,
    skillText: normalizeText(skills.join(" ")),
    experienceText: normalizeText(experience.map(getEntryText).join(" ")),
    projectsText: normalizeText(projects.map(getEntryText).join(" ")),
    educationText: normalizeText(
      [personal.major, personal.headline, personal.university, ...education.map(getEntryText)].join(" ")
    ),
    certificationsText: normalizeText(certifications.map(getEntryText).join(" ")),
  };
};

const extractTerms = (jobDescription = "") => {
  const text = normalizeText(jobDescription);
  const known = KNOWN_TERMS.filter((term) => text.includes(normalizeText(term)));
  const keywords = text
    .split(" ")
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word))
    .filter((word, index, items) => items.indexOf(word) === index)
    .slice(0, 24);

  return unique([...known, ...keywords]).slice(0, 30);
};

const extractReviewRequirements = (jobText = "") => {
  const text = normalizeText(jobText);
  const requirements = [];
  if (text.includes("مرحله التدريب التعاوني")) {
    requirements.push("التأكد من أنك في مرحلة التدريب التعاوني");
  }
  if (text.includes("جهه تعليميه معتمده")) {
    requirements.push("التأكد من أن الجهة التعليمية معتمدة");
  }
  if (text.includes("الجنسيه") || text.includes("سعودي") || text.includes("سعوديه")) {
    requirements.push("التأكد من شرط الجنسية");
  }
  if (text.includes("المعدل") || text.includes("gpa")) {
    requirements.push("التأكد من شرط المعدل");
  }
  return requirements;
};

const containsTerm = (text = "", term = "") => {
  const normalizedTerm = normalizeText(term);
  return Boolean(normalizedTerm) && text.includes(normalizedTerm);
};

const ratioScore = (matched = 0, total = 0, weight = 0) =>
  total ? Math.round((matched / total) * weight) : 0;

const createSuggestions = ({ facts, matchedSkills, missingSkills, jobTerms }) => {
  const suggestions = [];

  if (matchedSkills.length) {
    suggestions.push({
      section: "skills",
      type: "reorder",
      before: facts.skills,
      after: [...matchedSkills, ...facts.skills.filter((skill) => !matchedSkills.includes(skill))],
      reason: "هذه المهارات موجودة أصلًا في سيرتك ومرتبطة بمتطلبات الفرصة.",
      status: "pending",
    });
  }

  if (missingSkills.length) {
    suggestions.push({
      section: "missing_requirements",
      type: "notice",
      before: "",
      after: missingSkills,
      reason: "هذه متطلبات ظهرت في الفرصة ولم نجد لها دليلًا في سيرتك. أضفها فقط إذا كانت لديك بالفعل.",
      status: "pending",
    });
  }

  if (!facts.projectsText && !facts.experienceText) {
    suggestions.push({
      section: "projects",
      type: "notice",
      before: "",
      after: "أضف مشروعًا جامعيًا أو تجربة عملية واحدة على الأقل قبل التقديم.",
      reason: "الفرصة تحتوي متطلبات عملية ولا توجد مشاريع أو خبرات ظاهرة في سيرتك.",
      status: "pending",
    });
  }

  return suggestions.slice(0, 8);
};

const compareResumeToJob = ({ resume = {}, job = {} } = {}) => {
  const jobText = [job.title, job.company, job.description, ...(job.requirements || [])]
    .filter(Boolean)
    .join(" ");
  const terms = extractTerms(jobText);
  const reviewRequirements = extractReviewRequirements(jobText);
  const facts = collectResumeFacts(resume);

  const matchedSkills = facts.skills.filter((skill) => containsTerm(jobText, skill));
  const missingSkills = terms.filter(
    (term) => !containsTerm(facts.skillText, term) && !containsTerm(facts.experienceText, term) && !containsTerm(facts.projectsText, term)
  );
  const matchedExperienceTerms = terms.filter(
    (term) => containsTerm(facts.experienceText, term) || containsTerm(facts.projectsText, term)
  );
  const matchedEducationTerms = terms.filter((term) => containsTerm(facts.educationText, term));
  const matchedCertificationTerms = terms.filter((term) => containsTerm(facts.certificationsText, term));

  const score = Math.min(
    100,
    ratioScore(matchedSkills.length, Math.max(terms.length, facts.skills.length, 1), 45) +
      ratioScore(matchedExperienceTerms.length, Math.max(terms.length, 1), 30) +
      ratioScore(matchedEducationTerms.length, Math.max(terms.length, 1), 15) +
      ratioScore(matchedCertificationTerms.length, Math.max(terms.length, 1), 10)
  );

  return {
    score,
    classification: score >= 60 ? "مرتفع" : score >= 30 ? "متوسط" : "منخفض",
    label: "توافق السيرة مع الفرصة",
    disclaimer: "المؤشر يساعدك على ترتيب السيرة حسب المعلومات المتوفرة، ولا يضمن القبول أو اجتياز أي نظام توظيف.",
    job: {
      title: job.title || "",
      company: job.company || "",
      terms,
    },
    breakdown: {
      skills: { weight: 45, matched: matchedSkills, missing: missingSkills },
      experience: { weight: 30, matched: matchedExperienceTerms },
      education: { weight: 15, matched: matchedEducationTerms },
      certifications: { weight: 10, matched: matchedCertificationTerms },
      reviewRequirements,
    },
    suggestions: createSuggestions({ facts, matchedSkills, missingSkills, jobTerms: terms }),
  };
};

module.exports = {
  compareResumeToJob,
  extractTerms,
};
