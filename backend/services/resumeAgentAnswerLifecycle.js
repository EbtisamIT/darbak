const cleanText = (value = "", max = 1600) => String(value || "").trim().slice(0, max);

const parseStructuredAnswerFieldKey = (fieldKey = "") => {
  const match = cleanText(fieldKey, 160).match(/^(project_description|experience_description):(.+)$/u);
  if (!match) return null;
  return { type: match[1], itemId: cleanText(match[2], 120) };
};

const validateProjectDescriptionAnswer = (answer = "") => {
  const value = cleanText(answer);
  const words = value.split(/\s+/u).filter(Boolean);
  const genericOnly = /^(?:مشروع(?:\s+(?:جامعي|تخرج))?|university project|academic project|graduation project)[.!؟\s]*$/iu.test(value);
  const accepted = !genericOnly && value.length >= 20 && words.length >= 4;
  return {
    accepted,
    reason: accepted ? "" : "project_description_needs_revision",
    message: accepted
      ? ""
      : "نحتاج وصفًا أوضح لما نفذته في المشروع، مثل الخطوات أو الأدوات التي استخدمتها.",
  };
};

const buildPendingProjectDescriptionQuestion = (facts = {}, state = {}) => {
  const answered = new Set((Array.isArray(state.answers) ? state.answers : [])
    .map((answer) => cleanText(answer?.fieldKey || answer?.questionId, 160))
    .filter(Boolean));
  const skipped = new Set((Array.isArray(state.skippedFieldKeys) ? state.skippedFieldKeys : [])
    .map((fieldKey) => cleanText(fieldKey, 160))
    .filter(Boolean));
  const project = (Array.isArray(facts.projects) ? facts.projects : []).find((entry) => {
    const id = cleanText(entry?.id || entry?._id, 120);
    const fieldKey = id ? `project_description:${id}` : "";
    return fieldKey && !cleanText(entry?.description || entry?.details, 1600) && !answered.has(fieldKey) && !skipped.has(fieldKey);
  });
  if (!project) return null;
  const projectId = cleanText(project.id || project._id, 120);
  const fieldKey = `project_description:${projectId}`;
  return {
    id: fieldKey,
    fieldKey,
    section: "projects",
    itemTitle: cleanText(project.title || project.name, 140),
    question: `وش سويت في مشروع ${cleanText(project.title || project.name, 140) || "هذا المشروع"}؟ اذكر باختصار أهم شيء نفذته، وإذا استخدمت أدوات معينة اذكرها.`,
    whyNeeded: "نستخدم إجابتك لصياغة نقاط المشروع بدقة، ويمكنك تخطي السؤال.",
    reason: "project_description_missing",
    inputType: "textarea",
    options: [],
  };
};

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
  (Array.isArray(answers) ? answers : []).forEach((answer) => {
    const parsed = parseStructuredAnswerFieldKey(answer?.fieldKey || answer?.questionId);
    const value = cleanText(answer?.answer || answer?.value);
    if (parsed?.type === "project_description" && parsed.itemId && value) {
      projectAnswers.set(parsed.itemId, value);
    }
    if (parsed?.type === "experience_description" && parsed.itemId && value) {
      experienceAnswers.set(parsed.itemId, value);
    }
  });

  return {
    ...facts,
    projects: (Array.isArray(facts.projects) ? facts.projects : []).map((project) => {
      const id = cleanText(project?.id || project?._id, 120);
      const answer = projectAnswers.get(id);
      return answer ? { ...project, description: answer, details: answer } : project;
    }),
    experiences: (Array.isArray(facts.experiences) ? facts.experiences : []).map((experience) => {
      const id = cleanText(experience?.id || experience?._id, 120);
      const answer = experienceAnswers.get(id);
      return answer ? { ...experience, description: answer, details: answer } : experience;
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
  if (Object.prototype.hasOwnProperty.call(project, "details")) project.details = value;
  return true;
};

const applyExperienceDescriptionAnswer = (source = {}, answer = {}) => {
  const parsed = parseStructuredAnswerFieldKey(answer.fieldKey || answer.questionId);
  const value = cleanText(answer.answer || answer.value);
  const experiences = Array.isArray(source.experiences) ? source.experiences : source.experience;
  if (parsed?.type !== "experience_description" || !value || !Array.isArray(experiences)) return false;
  const experience = experiences.find((entry) => cleanText(entry?.id || entry?._id, 120) === parsed.itemId);
  if (!experience) return false;
  experience.description = value;
  if (Object.prototype.hasOwnProperty.call(experience, "details")) experience.details = value;
  return true;
};

module.exports = {
  applyProjectDescriptionAnswer,
  applyExperienceDescriptionAnswer,
  buildPendingProjectDescriptionQuestion,
  mergeStructuredAnswersIntoFacts,
  parseStructuredAnswerFieldKey,
  upsertAnswersByFieldKey,
  validateProjectDescriptionAnswer,
};
