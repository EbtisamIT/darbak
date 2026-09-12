const cleanText = (value = "", max = 1600) => String(value || "").trim().slice(0, max);

const parseStructuredAnswerFieldKey = (fieldKey = "") => {
  const match = cleanText(fieldKey, 160).match(/^(project_description|experience_description|activity_description):(.+)$/u);
  if (!match) return null;
  return { type: match[1], itemId: cleanText(match[2], 120) };
};

const validateProjectDescriptionAnswer = (answer = "") => {
  const value = cleanText(answer);
  return {
    accepted: Boolean(value),
    reason: value ? "" : "answer_required",
    message: value ? "" : "اكتب إجابتك أو اختر تخطي.",
  };
};

const GENERIC_WEAK_DETAILS = new Set([
  "مشروع",
  "مشروع جامعي",
  "مشروع تخرج",
  "تطبيق",
  "نشاط",
  "نادي طلابي",
  "تدريب",
  "internship",
  "academic project",
  "student project",
]);

const hasMeaningfulResumeDetail = (value = "") => {
  const text = cleanText(value, 1600);
  if (!text) return false;
  const normalized = text.toLocaleLowerCase("ar").replace(/[.،,:؛!?]/gu, "").trim();
  if (GENERIC_WEAK_DETAILS.has(normalized)) return false;
  return normalized.split(/\s+/u).filter(Boolean).length >= 2 || normalized.length >= 24;
};

const buildUserSourceEnrichmentFacts = (facts = {}, portfolioFacts = {}) => {
  const portfolioBySection = Object.fromEntries(["projects", "experiences", "volunteering"].map((section) => [
    section,
    new Map((Array.isArray(portfolioFacts[section]) ? portfolioFacts[section] : []).map((entry) => [cleanText(entry?.id || entry?._id, 120), entry])),
  ]));
  const selectEntries = (section) => (Array.isArray(facts[section]) ? facts[section] : []).map((entry) => {
    const id = cleanText(entry?.id || entry?._id, 120);
    const portfolioEntry = portfolioBySection[section].get(id) || {};
    const userDescription = cleanText(
      entry?.userSourceDescription || portfolioEntry?.userSourceDescription,
      1600,
    );
    const userContributions = [
      ...(Array.isArray(entry?.userSourceContributions) ? entry.userSourceContributions : []),
      ...(Array.isArray(portfolioEntry?.userSourceContributions) ? portfolioEntry.userSourceContributions : []),
    ].map((item) => cleanText(item?.text || item, 400)).filter(Boolean);
    return {
      ...entry,
      description: userDescription,
      details: userDescription,
      responsibilities: userContributions,
      contributions: userContributions,
      achievements: userContributions,
      generatedPresentationExists: Boolean(
        hasMeaningfulResumeDetail(entry?.description || entry?.details)
        || (Array.isArray(entry?.achievements) && entry.achievements.some((item) => hasMeaningfulResumeDetail(item?.text || item?.html || item))),
      ),
    };
  });
  return {
    ...facts,
    projects: selectEntries("projects"),
    experiences: selectEntries("experiences"),
    volunteering: selectEntries("volunteering"),
  };
};

const buildEnrichmentDiagnostics = (facts = {}, state = {}) => {
  const questions = buildEnrichmentQuestions(facts, state);
  const eligible = new Set(questions.map((question) => question.fieldKey));
  return [
    ["experiences", "experience_description", 950],
    ["projects", "project_description", 900],
    ["volunteering", "activity_description", 500],
  ].flatMap(([section, type, baseScore]) => (Array.isArray(facts[section]) ? facts[section] : []).map((entry, index) => {
    const itemId = cleanText(entry?.id || entry?._id, 120) || `${section}-${index}`;
    return {
      candidateSection: section,
      itemId,
      userSourceHasMeaningfulDetail: Boolean(
        hasMeaningfulResumeDetail(entry?.description || entry?.details)
        || (entry?.userSourceContributions || []).some((item) => hasMeaningfulResumeDetail(item)),
      ),
      generatedPresentationExists: Boolean(entry?.generatedPresentationExists),
      enrichmentEligible: eligible.has(`${type}:${itemId}`),
      priorityScore: section === "projects" && index > 0 ? 800 : baseScore,
    };
  }));
};

const buildEnrichmentQuestions = (facts = {}, state = {}) => {
  const answered = new Set((Array.isArray(state.answers) ? state.answers : [])
    .map((answer) => cleanText(answer?.fieldKey || answer?.questionId, 160))
    .filter(Boolean));
  const skipped = new Set((Array.isArray(state.skippedFieldKeys) ? state.skippedFieldKeys : [])
    .map((fieldKey) => cleanText(fieldKey, 160))
    .filter(Boolean));
  const isPending = (fieldKey) => fieldKey && !answered.has(fieldKey) && !skipped.has(fieldKey);
  const questions = [];
  const hasContributions = (entry = {}) => Boolean(
    hasMeaningfulResumeDetail(entry.description || entry.details)
    || (Array.isArray(entry.responsibilities) && entry.responsibilities.some((item) => hasMeaningfulResumeDetail(item?.text || item)))
    || (Array.isArray(entry.contributions) && entry.contributions.some((item) => hasMeaningfulResumeDetail(item?.text || item)))
    || (Array.isArray(entry.achievements) && entry.achievements.some((item) => hasMeaningfulResumeDetail(item?.text || item)))
  );
  const addQuestion = ({ type, section, entry, index, prefix, question, reason, tip, impact }) => {
    const title = cleanText(entry?.title || entry?.name, 140);
    const itemId = cleanText(entry?.id || entry?._id, 120) || `${prefix}-${index}-${title || "item"}`;
    const fieldKey = `${type}:${itemId}`;
    if (!isPending(fieldKey) || hasContributions(entry)) return false;
    questions.push({
      id: fieldKey,
      fieldKey,
      questionType: "enrichment",
      section,
      itemTitle: title,
      question: question(title),
      whyNeeded: tip,
      reason,
      inputType: "textarea",
      options: [],
      resumeValueImpact: impact,
      stableOrder: index,
    });
    return true;
  };

  (Array.isArray(facts.experiences) ? facts.experiences : []).forEach((entry, index) => addQuestion({
    type: "experience_description",
    section: "experiences",
    entry,
    index,
    prefix: "portfolio-experience",
    question: (title) => `وش أبرز المهام اللي اشتغلت عليها في ${title || "هذه الخبرة"}؟`,
    reason: "experience_description_missing",
    tip: "اذكر المهام اللي كنت تنفذها فعليًا، حتى لو كانت بسيطة.",
    impact: 950,
  }));
  (Array.isArray(facts.projects) ? facts.projects : []).forEach((entry, index) => addQuestion({
    type: "project_description",
    section: "projects",
    entry,
    index,
    prefix: "portfolio-project",
    question: (title) => `وش سويت في مشروع ${title || "هذا المشروع"}؟`,
    reason: "project_description_missing",
    tip: "ركز على الخطوات اللي نفذتها بنفسك، وإذا استخدمت أداة معينة اذكرها.",
    impact: index === 0 ? 900 : 800,
  }));
  (Array.isArray(facts.volunteering) ? facts.volunteering : []).forEach((entry, index) => addQuestion({
    type: "activity_description",
    section: "volunteering",
    entry,
    index,
    prefix: "portfolio-volunteering",
    question: (title) => `وش أبرز مساهمة لك في ${title || "هذا النشاط"}؟`,
    reason: "activity_description_missing",
    tip: "وش الشيء اللي شاركت فيه أو ساهمت بإنجازه؟",
    impact: 500,
  }));
  const hasHigherImpactQuestion = questions.some((question) => question.section === "experiences" || question.section === "projects");
  const eligibleQuestions = hasHigherImpactQuestion
    ? questions.filter((question) => question.section !== "volunteering")
    : questions;
  return eligibleQuestions
    .sort((left, right) => right.resumeValueImpact - left.resumeValueImpact
      || left.section.localeCompare(right.section)
      || left.stableOrder - right.stableOrder)
    .slice(0, 3)
    .map(({ resumeValueImpact, stableOrder, ...question }) => question);
};

const buildPendingProjectDescriptionQuestion = (facts = {}, state = {}) =>
  buildEnrichmentQuestions(facts, state).find((question) => question.section === "projects") || null;

const upsertAnswersByFieldKey = (existing = [], incoming = []) => {
  const byKey = new Map();
  [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(incoming) ? incoming : [])]
    .forEach((answer) => {
      const fieldKey = cleanText(answer?.fieldKey || answer?.questionId, 160);
      if (fieldKey) byKey.set(fieldKey, { ...answer, fieldKey, questionId: fieldKey });
    });
  return Array.from(byKey.values()).slice(-40);
};

const mergeStructuredAnswersIntoFacts = (facts = {}, answers = []) => {
  const projectAnswers = new Map();
  const experienceAnswers = new Map();
  const activityAnswers = new Map();
  (Array.isArray(answers) ? answers : []).forEach((answer) => {
    const parsed = parseStructuredAnswerFieldKey(answer?.fieldKey || answer?.questionId);
    const value = cleanText(answer?.answer || answer?.value);
    if (parsed?.type === "project_description" && parsed.itemId && value) {
      projectAnswers.set(parsed.itemId, value);
    }
    if (parsed?.type === "experience_description" && parsed.itemId && value) {
      experienceAnswers.set(parsed.itemId, value);
    }
    if (parsed?.type === "activity_description" && parsed.itemId && value) {
      activityAnswers.set(parsed.itemId, value);
    }
  });

  return {
    ...facts,
    projects: (Array.isArray(facts.projects) ? facts.projects : []).map((project) => {
      const id = cleanText(project?.id || project?._id, 120);
      const answer = projectAnswers.get(id);
      return answer ? { ...project, description: answer, details: answer, userSourceDescription: answer } : project;
    }),
    experiences: (Array.isArray(facts.experiences) ? facts.experiences : []).map((experience) => {
      const id = cleanText(experience?.id || experience?._id, 120);
      const answer = experienceAnswers.get(id);
      return answer ? { ...experience, description: answer, details: answer, achievements: [answer], userSourceDescription: answer, userSourceContributions: [answer] } : experience;
    }),
    volunteering: (Array.isArray(facts.volunteering) ? facts.volunteering : []).map((activity) => {
      const id = cleanText(activity?.id || activity?._id, 120);
      const answer = activityAnswers.get(id);
      return answer ? { ...activity, description: answer, details: answer, achievements: [answer], userSourceDescription: answer, userSourceContributions: [answer] } : activity;
    }),
  };
};

const applyProjectDescriptionAnswer = (source = {}, answer = {}) => {
  const parsed = parseStructuredAnswerFieldKey(answer.fieldKey || answer.questionId);
  const value = cleanText(answer.answer || answer.value);
  if (parsed?.type !== "project_description" || !value || !Array.isArray(source.projects)) return false;
  const project = source.projects.find((entry, index) => {
    const explicitId = cleanText(entry?.id || entry?._id, 120);
    const derivedPortfolioId = `portfolio-project-${index}-${cleanText(entry?.title || entry?.name, 140)}`;
    return explicitId === parsed.itemId || (!explicitId && derivedPortfolioId === parsed.itemId);
  });
  if (!project) return false;
  project.description = value;
  project.userSourceDescription = value;
  if (Object.prototype.hasOwnProperty.call(project, "details")) project.details = value;
  return true;
};

const applyExperienceDescriptionAnswer = (source = {}, answer = {}) => {
  const parsed = parseStructuredAnswerFieldKey(answer.fieldKey || answer.questionId);
  const value = cleanText(answer.answer || answer.value);
  const experiences = Array.isArray(source.experiences) ? source.experiences : source.experience;
  if (parsed?.type !== "experience_description" || !value || !Array.isArray(experiences)) return false;
  const experience = experiences.find((entry, index) => {
    const explicitId = cleanText(entry?.id || entry?._id, 120);
    const derivedId = `portfolio-experience-${index}-${cleanText(entry?.title || entry?.name, 140)}`;
    return explicitId === parsed.itemId || (!explicitId && derivedId === parsed.itemId);
  });
  if (!experience) return false;
  experience.description = value;
  experience.userSourceDescription = value;
  const responsibilityId = `enrichment-${parsed.itemId}`.slice(0, 120);
  experience.responsibilities = Array.isArray(experience.responsibilities) ? experience.responsibilities : [];
  if (!experience.responsibilities.some((item) => cleanText(item?.text || item) === value)) {
    experience.responsibilities.push({ id: responsibilityId, text: value });
  }
  experience.userSourceContributions = Array.from(new Set([
    ...(Array.isArray(experience.userSourceContributions) ? experience.userSourceContributions : []),
    value,
  ]));
  if (Object.prototype.hasOwnProperty.call(experience, "details")) experience.details = value;
  return true;
};

const applyActivityDescriptionAnswer = (source = {}, answer = {}) => {
  const parsed = parseStructuredAnswerFieldKey(answer.fieldKey || answer.questionId);
  const value = cleanText(answer.answer || answer.value);
  if (parsed?.type !== "activity_description" || !value || !Array.isArray(source.volunteering)) return false;
  const activity = source.volunteering.find((entry, index) => {
    const explicitId = cleanText(entry?.id || entry?._id, 120);
    const derivedId = `portfolio-volunteering-${index}-${cleanText(entry?.title || entry?.name, 140)}`;
    return explicitId === parsed.itemId || (!explicitId && derivedId === parsed.itemId);
  });
  if (!activity) return false;
  activity.description = value;
  activity.userSourceDescription = value;
  const contributionId = `enrichment-${parsed.itemId}`.slice(0, 120);
  activity.responsibilities = Array.isArray(activity.responsibilities) ? activity.responsibilities : [];
  if (!activity.responsibilities.some((item) => cleanText(item?.text || item) === value)) {
    activity.responsibilities.push({ id: contributionId, text: value });
  }
  activity.userSourceContributions = Array.from(new Set([
    ...(Array.isArray(activity.userSourceContributions) ? activity.userSourceContributions : []),
    value,
  ]));
  if (Object.prototype.hasOwnProperty.call(activity, "details")) activity.details = value;
  return true;
};

module.exports = {
  applyProjectDescriptionAnswer,
  applyExperienceDescriptionAnswer,
  applyActivityDescriptionAnswer,
  buildEnrichmentQuestions,
  buildEnrichmentDiagnostics,
  buildUserSourceEnrichmentFacts,
  buildPendingProjectDescriptionQuestion,
  hasMeaningfulResumeDetail,
  mergeStructuredAnswersIntoFacts,
  parseStructuredAnswerFieldKey,
  upsertAnswersByFieldKey,
  validateProjectDescriptionAnswer,
};
