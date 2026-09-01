const { normalizeResumeSkills } = require("./resumeSkillNormalization");

const ARABIC_CHARACTERS = /[\u0600-\u06FF]/u;
const GENERIC_SUMMARY = /\b(hardworking|passionate|motivated|seeking an opportunity)\b|مجتهد|شغوف|باحث عن فرصة/u;

const safeText = (value = "", max = 900) => (value || "").toString().replace(/\s+/g, " ").trim().slice(0, max);
const list = (value) => (Array.isArray(value) ? value : []);
const objectList = (value) => list(value).filter((entry) => entry && typeof entry === "object");
const isEnglish = (language) => language === "en";
const comparable = (value = "") => safeText(value, 260).toLocaleLowerCase();

const QUALITY_RULE_SECTIONS = {
  summary_missing: ["summary"],
  english_language_mixing: ["summary", "experiences", "projects"],
  unsupported_skill: ["skills"],
  experience_identity_conflict: ["experiences"],
};

const HARD_QUALITY_RULES = new Set([
  "summary_missing",
  "english_language_mixing",
  "unsupported_skill",
  "experience_identity_conflict",
]);

const AUTO_FIXED_QUALITY_RULES = new Set([
  "headline_conflict",
]);

const SOFT_QUALITY_RULES = new Set([
  "professional_context_copied_as_summary",
  "generic_summary",
]);

const getQualityFailureSections = (errors = []) => {
  const sections = new Set();
  (Array.isArray(errors) ? errors : []).forEach((error) => {
    if (String(error || "").startsWith("project_missing_bullet:")) {
      sections.add("projects");
      return;
    }
    (QUALITY_RULE_SECTIONS[error] || []).forEach((section) => sections.add(section));
  });
  return Array.from(sections);
};

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
  professionalContext: safeText(facts.professionalContext, 900),
  confirmedAnswers: list(answers).map((answer) => ({ fieldKey: answer.fieldKey || answer.questionId, answer: safeText(answer.answer, 600) })),
});

const matchFact = (entry = {}, facts = []) => {
  const entryId = safeText(entry.sourceId || entry.id, 120);
  const exact = facts.find((fact) => safeText(fact.id, 120) === entryId);
  if (exact) return exact;

  const title = comparable(entry.title || entry.name);
  const organization = comparable(entry.organization || entry.company);
  const period = comparable(entry.dates || entry.period);
  return facts.find((fact) => {
    const factTitle = comparable(fact.title || fact.name);
    const factOrganization = comparable(fact.organization || fact.company);
    const factPeriod = comparable(fact.period || fact.dates);
    // Identity is the role/project name plus known company or dates. Bullets
    // are deliberately excluded: professional wording may be rephrased.
    return Boolean(
      title && factTitle === title &&
      ((!organization || factOrganization === organization) || (!period || factPeriod === period))
    );
  }) || facts.find((fact) => title && comparable(fact.title || fact.name) === title);
};

const containsOnlyVerifiedArabicProperNouns = (text = "", facts = {}) => {
  const arabicPhrases = String(text || "").match(/[\u0600-\u06FF][\u0600-\u06FF\s-]*/gu) || [];
  if (!arabicPhrases.length) return true;
  const verifiedText = comparable(JSON.stringify(facts || {}));
  return arabicPhrases.every((phrase) => {
    const normalized = comparable(phrase);
    return normalized && verifiedText.includes(normalized);
  });
};

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
  // Experience identity belongs to the student's verified facts. The agent
  // may improve bullets, but it may not omit or replace a fact the student
  // entered in their professional profile.
  const experiences = list(verifiedFacts.experiences).map((fact) => {
    const entry = list(draft.experiences).find((candidate) => matchFact(candidate, [fact])) || {};
    const sourceBullets = list(entry.bullets).map((bullet) => safeText(bullet, 300)).filter(Boolean);
    const fallbackBullet = safeText(fact.description, 300);
    return {
      ...entry,
      sourceId: fact.id,
      title: fact.title,
      organization: fact.organization,
      dates: fact.period,
      location: fact.location,
      bullets: sourceBullets.length ? sourceBullets : (fallbackBullet ? [fallbackBullet] : []),
    };
  });
  const projects = list(draft.projects).map((entry) => {
    const fact = matchFact(entry, list(verifiedFacts.projects)) || {};
    const allowedTechnologies = new Set(normalizeResumeSkills(list(verifiedFacts.skills)).map((skill) => skill.toLowerCase()));
    return {
      ...preserveProjectDescription(entry, fact),
      sourceId: fact.id || entry.sourceId || "",
      technologies: normalizeResumeSkills(list(entry.technologies))
        .filter((technology) => allowedTechnologies.has(technology.toLowerCase())),
    };
  });
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
  const detectedRules = [];
  const safeDraft = draft && typeof draft === "object" ? draft : {};
  const safeFacts = verifiedFacts && typeof verifiedFacts === "object" ? verifiedFacts : {};
  const summary = safeText(safeDraft.professionalSummary, 900);
  const professionalContext = safeText(safeFacts.professionalContext, 900);
  const expectedHeadline = buildDeterministicHeadline(safeFacts.personalInfo || {}, language);
  const experiences = objectList(safeDraft.experiences);
  const projects = objectList(safeDraft.projects);
  const skills = objectList(safeDraft.skills);
  const verifiedProjects = objectList(safeFacts.projects);
  const verifiedExperiences = objectList(safeFacts.experiences);
  const verifiedSkills = normalizeResumeSkills(list(safeFacts.skills));
  if (!summary) detectedRules.push("summary_missing");
  if (professionalContext && summary.toLocaleLowerCase() === professionalContext.toLocaleLowerCase()) detectedRules.push("professional_context_copied_as_summary");
  if (GENERIC_SUMMARY.test(summary)) detectedRules.push("generic_summary");
  if (safeText(safeDraft.targetTitle, 180) !== expectedHeadline) detectedRules.push("headline_conflict");
  if (isEnglish(language) && [summary, safeDraft.targetTitle, ...experiences.flatMap((entry) => list(entry.bullets)), ...projects.flatMap((entry) => list(entry.bullets))]
    .some((text) => ARABIC_CHARACTERS.test(text || "") && !containsOnlyVerifiedArabicProperNouns(text, safeFacts))) {
    detectedRules.push("english_language_mixing");
  }
  const verifiedSkillSet = new Set(verifiedSkills.map((skill) => skill.toLowerCase()));
  skills.forEach((skill) => {
    if (!verifiedSkillSet.has(safeText(skill.name, 80).toLowerCase())) detectedRules.push("unsupported_skill");
  });
  projects.forEach((project) => {
    const fact = matchFact(project, verifiedProjects);
    if (safeText(fact?.description) && !list(project.bullets).length) {
      detectedRules.push(`project_missing_bullet:${fact.id || project.sourceId || "unknown"}`);
    }
  });
  experiences.forEach((entry) => {
    if (entry.sourceId && !matchFact(entry, verifiedExperiences)) detectedRules.push("experience_identity_conflict");
  });
  const hardErrors = detectedRules.filter((rule) =>
    HARD_QUALITY_RULES.has(rule) || rule.startsWith("project_missing_bullet:")
  );
  const autoFixes = detectedRules.filter((rule) => AUTO_FIXED_QUALITY_RULES.has(rule));
  const warnings = detectedRules.filter((rule) => SOFT_QUALITY_RULES.has(rule));
  return {
    unsupportedClaims: hardErrors.filter((error) => /unsupported|identity/.test(error)),
    genericSummary: warnings.includes("generic_summary"),
    statusConflict: false,
    languageMixing: hardErrors.includes("english_language_mixing"),
    emptyImportantSections: hardErrors.filter((error) => /missing|project_missing/.test(error)),
    needsRepair: hardErrors.length > 0,
    errors: hardErrors,
    warnings,
    autoFixes,
    failedSections: getQualityFailureSections(hardErrors),
  };
};

module.exports = {
  buildDeterministicHeadline,
  compactVerifiedResumeFacts,
  composeProfessionalDraft,
  runProfessionalQualityGate,
  getQualityFailureSections,
};
