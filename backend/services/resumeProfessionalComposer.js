const { normalizeResumeSkills } = require("./resumeSkillNormalization");

const ARABIC_CHARACTERS = /[\u0600-\u06FF]/u;
const GENERIC_SUMMARY = /\b(hardworking|passionate|motivated|seeking an opportunity)\b|مجتهد|شغوف|باحث عن فرصة/u;

const safeText = (value = "", max = 900) => (value || "").toString().replace(/\s+/g, " ").trim().slice(0, max);
const list = (value) => (Array.isArray(value) ? value : []);
const isEnglish = (language) => language === "en";

const buildDeterministicHeadline = (personalInfo = {}, language = "ar") => {
  const major = safeText(personalInfo.major, 160);
  const status = safeText(personalInfo.studentStatus, 40);
  const gender = safeText(personalInfo.grammaticalGender, 20);
  if (!major) return "";
  if (isEnglish(language)) {
    if (status === "graduate") return `${major} Graduate`;
    if (status === "student") return `${major} Student`;
    return `${major} Specialist`;
  }
  if (status === "graduate") return `${gender === "masculine" ? "خريج" : "خريجة"} ${major}`;
  if (status === "student") return `${gender === "masculine" ? "طالب" : "طالبة"} ${major}`;
  return `${gender === "masculine" ? "متخصص" : "متخصصة"} ${major}`;
};

const compactVerifiedResumeFacts = (facts = {}, answers = []) => ({
  personalInfo: facts.personalInfo || {},
  education: list(facts.education).map((entry) => ({ id: entry.id, title: entry.title, organization: entry.organization, period: entry.period, location: entry.location, description: entry.description })),
  experiences: list(facts.experiences).map((entry) => ({ id: entry.id, title: entry.title, organization: entry.organization, period: entry.period, location: entry.location, description: entry.description, achievements: entry.achievements })),
  projects: list(facts.projects).map((entry) => ({ id: entry.id, title: entry.title, description: entry.description, url: entry.url, achievements: entry.achievements })),
  certifications: list(facts.certifications).map((entry) => ({ id: entry.id, title: entry.title, organization: entry.organization, period: entry.period })),
  volunteering: list(facts.volunteering).map((entry) => ({ id: entry.id, title: entry.title, organization: entry.organization, period: entry.period, description: entry.description })),
  languages: list(facts.languages).map((entry) => ({ name: entry.name, level: entry.level })),
  skills: normalizeResumeSkills(list(facts.skills)),
  confirmedAnswers: list(answers).map((answer) => ({ fieldKey: answer.fieldKey || answer.questionId, answer: safeText(answer.answer, 600) })),
});

const matchFact = (entry = {}, facts = []) => facts.find((fact) => fact.id === entry.id)
  || facts.find((fact) => safeText(fact.title || fact.name).toLowerCase() === safeText(entry.title || entry.name).toLowerCase());

const preserveProjectDescription = (project = {}, verifiedProject = {}) => {
  const description = safeText(project.description || verifiedProject.description, 700);
  const bullets = list(project.bullets).map((bullet) => safeText(bullet, 300)).filter(Boolean);
  return {
    ...project,
    name: safeText(verifiedProject.title || project.name, 180),
    description,
    url: safeText(verifiedProject.url || project.url, 260),
    bullets: bullets.length || !description ? bullets : [description],
  };
};

const composeProfessionalDraft = ({ draft = {}, verifiedFacts = {}, language = "ar" } = {}) => {
  const personalInfo = verifiedFacts.personalInfo || {};
  const experiences = list(draft.experiences).map((entry) => {
    const fact = matchFact(entry, list(verifiedFacts.experiences));
    return fact ? {
      ...entry,
      sourceId: fact.id,
      title: fact.title,
      organization: fact.organization,
      dates: fact.period,
      location: fact.location,
    } : entry;
  });
  const projects = list(draft.projects).map((entry) => preserveProjectDescription(entry, matchFact(entry, list(verifiedFacts.projects)) || {}));
  const verifiedSkills = normalizeResumeSkills(list(verifiedFacts.skills));
  const selectedSkills = normalizeResumeSkills(list(draft.skills).map((skill) => skill?.name || skill));
  const allowed = new Set(verifiedSkills.map((skill) => skill.toLowerCase()));
  const skills = selectedSkills.filter((skill) => allowed.has(skill.toLowerCase())).map((name) => ({ name, evidenceSourceId: "verified_skills" }));

  return {
    ...draft,
    targetTitle: buildDeterministicHeadline(personalInfo, language),
    education: list(verifiedFacts.education).map((fact) => ({
      sourceId: fact.id,
      title: fact.title,
      organization: fact.organization,
      degree: personalInfo.degree || fact.subtitle || "",
      major: personalInfo.major || "",
      dates: fact.period || personalInfo.graduationYear || "",
      location: fact.location || personalInfo.city || "",
      details: fact.description || "",
      bullets: [],
    })),
    experiences,
    projects,
    skills,
    certifications: list(verifiedFacts.certifications).map((fact) => ({
      sourceId: fact.id,
      name: fact.title,
      issuer: fact.organization || "",
      date: fact.period || "",
      details: fact.description || "",
    })),
    volunteering: list(draft.volunteering).map((entry) => {
      const fact = matchFact(entry, list(verifiedFacts.volunteering));
      return fact ? { ...entry, sourceId: fact.id, title: fact.title, organization: fact.organization, dates: fact.period, location: fact.location } : entry;
    }),
    languages: list(verifiedFacts.languages).map((fact) => ({ name: fact.name, level: fact.level })),
  };
};

const runProfessionalQualityGate = ({ draft = {}, verifiedFacts = {}, language = "ar" } = {}) => {
  const errors = [];
  const summary = safeText(draft.professionalSummary, 900);
  const expectedHeadline = buildDeterministicHeadline(verifiedFacts.personalInfo || {}, language);
  if (!summary) errors.push("summary_missing");
  if (GENERIC_SUMMARY.test(summary)) errors.push("generic_summary");
  if (safeText(draft.targetTitle, 180) !== expectedHeadline) errors.push("headline_conflict");
  if (isEnglish(language) && [summary, draft.targetTitle, ...list(draft.experiences).flatMap((entry) => entry.bullets || []), ...list(draft.projects).flatMap((entry) => entry.bullets || [])].some((text) => ARABIC_CHARACTERS.test(text || ""))) errors.push("english_language_mixing");
  const verifiedSkills = new Set(normalizeResumeSkills(list(verifiedFacts.skills)).map((skill) => skill.toLowerCase()));
  list(draft.skills).forEach((skill) => {
    if (!verifiedSkills.has(safeText(skill.name || skill, 80).toLowerCase())) errors.push("unsupported_skill");
  });
  list(verifiedFacts.projects).forEach((project) => {
    if (safeText(project.description) && !list(draft.projects).some((item) => safeText(item.name).toLowerCase() === safeText(project.title).toLowerCase() && list(item.bullets).length)) errors.push(`project_missing_bullet:${project.id}`);
  });
  const verifiedExperienceIds = new Set(list(verifiedFacts.experiences).map((entry) => entry.id));
  list(draft.experiences).forEach((entry) => {
    if (entry.sourceId && !verifiedExperienceIds.has(entry.sourceId)) errors.push("experience_identity_conflict");
  });
  return {
    unsupportedClaims: errors.filter((error) => /unsupported|identity/.test(error)),
    genericSummary: errors.includes("generic_summary"),
    statusConflict: errors.includes("headline_conflict"),
    languageMixing: errors.includes("english_language_mixing"),
    emptyImportantSections: errors.filter((error) => /missing|project_missing/.test(error)),
    needsRepair: errors.length > 0,
    errors,
  };
};

module.exports = {
  buildDeterministicHeadline,
  compactVerifiedResumeFacts,
  composeProfessionalDraft,
  runProfessionalQualityGate,
};
