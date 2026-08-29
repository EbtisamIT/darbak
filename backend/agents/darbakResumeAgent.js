const mongoose = require("mongoose");
const { Agent, run, tool, setSensitiveDataLoggingEnabled } = require("@openai/agents");
const { z } = require("zod");

const Opportunity = require("../models/Opportunity");
const Portfolio = require("../models/Portfolio");
const ResumePendingDraft = require("../models/ResumePendingDraft");
const ResumeProfile = require("../models/ResumeProfile");
const {
  resumeDraftSchema,
  tailoredResumeDraftSchema,
} = require("../services/resumeAiService");

setSensitiveDataLoggingEnabled(false);

const DEFAULT_RESUME_AGENT_MODEL = "gpt-5.6-terra";
const DEFAULT_MAX_TURNS = 6;
const MAX_ANSWER_LENGTH = 1600;
const MAX_FACT_TEXT_LENGTH = 22000;
const PENDING_DRAFT_TTL_MS = 48 * 60 * 60 * 1000;

const questionSchema = z
  .object({
    id: z.string().max(90).default(""),
    fieldKey: z.string().max(90).default(""),
    section: z.string().max(90).default(""),
    question: z.string().max(320).default(""),
    whyNeeded: z.string().max(260).default(""),
    inputType: z
      .enum(["text", "textarea", "date", "url", "select", "number"])
      .default("textarea"),
  })
  .strict();

const validationResultSchema = z
  .object({
    valid: z.boolean().default(false),
    errors: z.array(z.string().max(320)).max(30).default([]),
    warnings: z.array(z.string().max(320)).max(30).default([]),
  })
  .strict();

const sourceMapEntrySchema = z
  .object({
    path: z.string().max(180).default(""),
    sourceId: z.string().max(100).default(""),
    sourceText: z.string().max(500).default(""),
  })
  .strict();

const sourceMapSchema = z.array(sourceMapEntrySchema).max(120).default([]);
const applicationPackSchema = z.object({
  trainingLetter: z.object({ body: z.string().max(2200).default(""), status: z.enum(["ready", "needs_input", "unavailable"]).default("ready") }).strict(),
  email: z.object({ subject: z.string().max(220).default(""), body: z.string().max(1600).default(""), status: z.enum(["ready", "needs_input", "unavailable"]).default("ready") }).strict(),
  missingApplicationFields: z.array(z.object({ key: z.string().max(80), label: z.string().max(160), appliesTo: z.enum(["trainingLetter", "email"]) }).strict()).max(6).default([]),
}).strict().default({ trainingLetter: { body: "", status: "ready" }, email: { subject: "", body: "", status: "ready" }, missingApplicationFields: [] });

const resumeAgentOutputSchema = z
  .object({
    status: z.enum([
      "needs_information",
      "draft_ready",
      "tailored_draft_ready",
      "cannot_continue",
    ]),
    message: z.string().max(1200).default(""),
    questions: z.array(questionSchema).max(3).default([]),
    draft: tailoredResumeDraftSchema.nullable().default(null),
    applicationPack: applicationPackSchema,
    missingInformation: z
      .array(
        z
          .object({
            section: z.string().max(90).default(""),
            question: z.string().max(320).default(""),
          })
          .strict()
      )
      .max(20)
      .default([]),
    warnings: z.array(z.string().max(320)).max(20).default([]),
    changesSummary: z.array(z.string().max(320)).max(12).default([]),
    validationStatus: validationResultSchema.default({
      valid: false,
      errors: [],
      warnings: [],
    }),
    pendingDraftId: z.string().max(80).default(""),
  })
  .strict();

const safeString = (value = "", maxLength = 600) =>
  (value || "")
    .toString()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const safeText = (value = "", maxLength = 2200) =>
  (value || "")
    .toString()
    .replace(/\r\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);

const getQuestionFieldKey = (question = {}) => {
  const text = safeString(`${question.section || ""} ${question.question || ""} ${question.whyNeeded || ""}`, 700).toLowerCase();
  const section = safeString(question.section, 40).toLowerCase();
  const explicit = safeString(question.fieldKey || question.id, 90);
  const knownFields = [
    [/(phone|جوال|هاتف|رقم التواصل)/, "phone"],
    [/(full.?name|الاسم الكامل|اسمك الكامل)/, "full_name"],
    [/(headline|المسمى|المسمى المهني)/, "professional_headline"],
    [/(graduation|التخرج|سنة التخرج)/, "graduation_year"],
    [/(gpa|المعدل)/, "gpa"],
    [/(university|الجامعة)/, "university"],
    [/(degree|الدرجة)/, "degree"],
    [/(major|التخصص)/, "major"],
    [/(training.?period|فترة التدريب)/, "training_period"],
    [/(target.?field|المجال التدريبي|المسمى التدريبي)/, "target_field"],
    [/(description|وصف الفرصة|متطلبات الفرصة|وصف الوظيفة)/, "opportunity_description"],
  ];
  const matched = knownFields.find(([pattern]) => pattern.test(text));
  if (matched) return matched[1];
  return explicit || `${section || "general"}_${safeString(question.question, 50).replace(/\s+/g, "_")}`;
};

const withStableQuestionKeys = (output = {}) => ({
  ...output,
  questions: (Array.isArray(output.questions) ? output.questions : []).map((question) => ({
    ...question,
    fieldKey: getQuestionFieldKey(question),
  })),
});

const normalizeComparable = (value = "") =>
  safeString(value, 1200)
    .toLowerCase()
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const SKILL_ALIASES = {
  react: ["react", "ريأكت", "رياكت", "ري اكت"],
  figma: ["figma", "فيقما", "فيجما"],
  java: ["java", "جافا"],
  javascript: ["javascript", "java script", "js", "جافاسكربت", "جافا سكربت", "جافا سكريبت"],
  python: ["python", "بايثون"],
  "power bi": ["power bi", "powerbi", "باور بي اي", "باور بي آي"],
};

const containsNormalizedPhrase = (text = "", phrase = "") => {
  const comparablePhrase = normalizeComparable(phrase);
  if (!comparablePhrase) return false;
  const escapedPhrase = comparablePhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s|و)${escapedPhrase}(?=\\s|$)`).test(text);
};

const isSkillMentionedInFacts = (skillName = "", factTextComparable = "") => {
  const normalizedSkill = normalizeComparable(skillName);
  if (!normalizedSkill) return true;
  const aliases = SKILL_ALIASES[normalizedSkill] || [skillName];
  return aliases.some((alias) => containsNormalizedPhrase(factTextComparable, alias));
};

const isConfirmedSkill = (skillName = "", facts = {}) => {
  const normalized = normalizeComparable(skillName);
  if (!normalized) return true;
  const confirmed = facts?.allowedSkills || new Set();
  if (confirmed.has(normalized)) return true;
  const aliases = SKILL_ALIASES[normalized] || [skillName];
  return aliases.some((alias) => confirmed.has(normalizeComparable(alias)));
};

const safeArray = (value = [], maxItems = 12, mapper = (item) => item) =>
  (Array.isArray(value) ? value : [])
    .slice(0, maxItems)
    .map(mapper)
    .filter((item) => {
      if (typeof item === "string") return Boolean(item.trim());
      return Boolean(item);
    });

const getContext = (runContext = {}) => runContext.context || {};

const getAccessQuery = (context = {}) => ({
  contact: context.access?.contact,
  accessCodeHash: context.access?.accessCodeHash,
});

const sourceId = (prefix, value, index = 0) =>
  `${prefix}_${safeString(value || index + 1, 50).replace(/[^a-zA-Z0-9_-]/g, "_") || index + 1}`;

const entryText = (entry = {}) =>
  [
    entry.title,
    entry.subtitle,
    entry.organization,
    entry.period,
    entry.startDate,
    entry.endDate,
    entry.location,
    entry.description,
    entry.details,
    ...(entry.achievements || []).map((achievement) => achievement.text || achievement.html),
  ]
    .filter(Boolean)
    .join(" | ");

const addSource = (sources, source) => {
  const text = safeText(source.text || "", 1800);
  if (!text) return;
  sources.push({
    sourceId: source.sourceId,
    section: source.section,
    label: safeString(source.label, 180),
    text,
  });
};

const mapPortfolioToFacts = (portfolio = null) => {
  if (!portfolio) return { profile: null, sources: [] };
  const sources = [];
  const profile = {
    fullName: safeString(portfolio.fullName, 120),
    major: safeString(portfolio.major, 160),
    university: safeString(portfolio.university, 180),
    city: safeString(portfolio.city, 100),
    degreeLevel: safeString(portfolio.degreeLevel, 100),
    studentStatus: safeString(portfolio.studentStatus, 40),
    graduationYear: safeString(portfolio.graduationYear, 20),
    gpa: safeString(portfolio.gpa, 20),
    gpaScale: safeString(portfolio.gpaScale, 20),
    professionalHeadline: safeString(portfolio.professionalHeadline, 140),
    readinessStatus: safeString(portfolio.readinessStatus, 160),
    linkedinUrl: safeString(portfolio.linkedinUrl, 260),
    email: safeString(portfolio.email, 160),
    phone: safeString(portfolio.phone, 40),
    bio: safeText(portfolio.bio, 900),
    skills: safeArray(portfolio.skills, 40, (skill) => safeString(skill, 80)),
    projects: safeArray(portfolio.projects, 10, (project, index) => ({
      sourceId: sourceId("portfolio_project", project._id || project.title, index),
      title: safeString(project.title, 180),
      description: safeText(project.description, 900),
      link: safeString(project.link || project.url, 260),
    })),
    certifications: safeArray(portfolio.certifications, 12, (certification, index) => ({
      sourceId: sourceId("portfolio_cert", certification._id || certification.title, index),
      title: safeString(certification.title, 180),
      issuer: safeString(certification.issuer || certification.provider, 160),
      year: safeString(certification.year, 80),
    })),
    experiences: safeArray(portfolio.experiences, 12, (experience, index) => ({
      sourceId: sourceId("portfolio_experience", experience._id || experience.title, index),
      title: safeString(experience.title, 180),
      organization: safeString(experience.organization, 180),
      description: safeText(experience.description || experience.details, 900),
    })),
    volunteering: safeArray(portfolio.volunteering, 12, (activity, index) => ({
      sourceId: sourceId("portfolio_volunteering", activity._id || activity.title, index),
      title: safeString(activity.title, 180),
      organization: safeString(activity.organization, 180),
      description: safeText(activity.description || activity.details, 900),
    })),
    languages: safeArray(portfolio.languages, 12, (language) => ({
      name: safeString(language.name, 80),
      level: safeString(language.level, 80),
    })),
  };

  addSource(sources, {
    sourceId: "portfolio_basic",
    section: "personalInfo",
    label: "بيانات الملف المهني",
    text: [
      profile.fullName,
      profile.major,
      profile.university,
      profile.city,
      profile.degreeLevel,
      profile.studentStatus,
      profile.graduationYear,
      profile.gpa,
      profile.gpaScale,
      profile.professionalHeadline,
      profile.phone,
      profile.bio,
      ...(profile.skills || []),
    ].join(" | "),
  });

  profile.projects.forEach((project) =>
    addSource(sources, {
      sourceId: project.sourceId,
      section: "projects",
      label: project.title,
      text: [project.title, project.description, project.link].join(" | "),
    })
  );

  profile.certifications.forEach((certification) =>
    addSource(sources, {
      sourceId: certification.sourceId,
      section: "certifications",
      label: certification.title,
      text: [certification.title, certification.issuer, certification.year].join(" | "),
    })
  );

  ["experiences", "volunteering"].forEach((section) => {
    profile[section].forEach((entry) =>
      addSource(sources, {
        sourceId: entry.sourceId,
        section,
        label: entry.title,
        text: [entry.title, entry.organization, entry.description].join(" | "),
      })
    );
  });

  return { profile, sources };
};

const mapResumeToFacts = (resume = null) => {
  if (!resume) return { resume: null, sources: [] };
  const sources = [];
  const resumePayload = {
    _id: resume._id?.toString?.() || "",
    personalInfo: resume.personalInfo || {},
    summary: safeText(resume.summary, 900),
    education: resume.education || [],
    experiences: resume.experiences || resume.experience || [],
    projects: resume.projects || [],
    certifications: resume.certifications || [],
    volunteering: resume.volunteering || [],
    languages: resume.languages || [],
    links: resume.links || [],
    skills: resume.skills || [],
    settings: resume.settings || {},
  };

  addSource(sources, {
    sourceId: "resume_basic",
    section: "personalInfo",
    label: "بيانات السيرة الحالية",
    text: JSON.stringify({
      personalInfo: resumePayload.personalInfo,
      summary: resumePayload.summary,
      skills: resumePayload.skills,
    }).slice(0, 2200),
  });

  ["education", "experiences", "projects", "certifications", "volunteering"].forEach((section) => {
    safeArray(resumePayload[section], 12, (entry, index) => ({ entry, index })).forEach(
      ({ entry, index }) =>
        addSource(sources, {
          sourceId: sourceId(`resume_${section}`, entry.id || entry.title, index),
          section,
          label: entry.title || entry.organization || section,
          text: entryText(entry),
        })
    );
  });

  return { resume: resumePayload, sources };
};

const mapAnswersToFacts = (answers = []) => {
  const sources = [];
  const cleanAnswers = safeArray(answers, 30, (answer, index) => ({
    questionId: safeString(answer.fieldKey || answer.questionId || answer.id || `answer_${index + 1}`, 90),
    section: safeString(answer.section, 90),
    question: safeString(answer.question, 320),
    answer: safeText(answer.answer || answer.value, MAX_ANSWER_LENGTH),
  }));

  cleanAnswers.forEach((answer, index) =>
    addSource(sources, {
      sourceId: sourceId("answer", answer.questionId, index),
      section: answer.section || "answers",
      label: answer.question || answer.questionId,
      text: answer.answer,
    })
  );

  return { answers: cleanAnswers, sources };
};

const mapOpportunityToFacts = (opportunity = null) => {
  if (!opportunity) return { opportunity: null, sources: [] };
  const mapped = {
    _id: opportunity._id?.toString?.() || "",
    organizationName: safeString(opportunity.organizationName, 180),
    title: safeString(opportunity.title, 180),
    city: safeString(opportunity.city, 100),
    cities: safeArray(opportunity.cities, 12, (city) => safeString(city, 100)),
    description: safeText(opportunity.description || opportunity.note, 1800),
    requirements: safeText(opportunity.requirements, 1800),
    majorCategories: safeArray(opportunity.majorCategories, 12, (major) => safeString(major, 120)),
    specialties: safeArray(opportunity.specialties, 30, (specialty) => safeString(specialty, 120)),
  };

  return {
    opportunity: mapped,
    sources: [
      {
        sourceId: "opportunity_requirements",
        section: "opportunity",
        label: `${mapped.organizationName} - ${mapped.title}`,
        text: JSON.stringify(mapped).slice(0, 2500),
      },
    ],
  };
};

const extractNumbers = (text = "") =>
  new Set(
    (safeText(text, MAX_FACT_TEXT_LENGTH).match(/[\d٠-٩]+(?:[.,][\d٠-٩]+)?%?/g) || []).map(
      (value) => value.trim()
    )
  );

const collectFacts = ({ profile, resume, opportunity, collectedFacts } = {}) => {
  const profileFacts = mapPortfolioToFacts(profile);
  const resumeFacts = mapResumeToFacts(resume);
  const answerFacts = mapAnswersToFacts(collectedFacts?.answers || []);
  const opportunityFacts = mapOpportunityToFacts(opportunity);
  const sources = [
    ...profileFacts.sources,
    ...resumeFacts.sources,
    ...answerFacts.sources,
    ...opportunityFacts.sources,
  ].slice(0, 80);
  const sourceIds = new Set(sources.map((source) => source.sourceId));
  const factText = safeText(
    JSON.stringify({
      profile: profileFacts.profile,
      resume: resumeFacts.resume,
      answers: answerFacts.answers,
    }),
    MAX_FACT_TEXT_LENGTH
  );
  const opportunityText = safeText(JSON.stringify(opportunityFacts.opportunity || {}), 6000);
  const allowedNumbers = extractNumbers(factText);
  const allowedSkills = new Set(
    [
      ...(profileFacts.profile?.skills || []),
      ...(resumeFacts.resume?.skills || []),
      ...sources.flatMap((source) => source.text.split(/[،,\n|]/g)),
    ]
      .map(normalizeComparable)
      .filter(Boolean)
  );

  return {
    profile: profileFacts.profile,
    resume: resumeFacts.resume,
    answers: answerFacts.answers,
    opportunity: opportunityFacts.opportunity,
    sources,
    sourceIds,
    allowedSkills,
    factText,
    opportunityText,
    allowedNumbers,
  };
};

const isConfirmedQuestion = (question = {}, facts = {}) => {
  const sectionAliases = {
    المهارات: "skills",
    المشاريع: "projects",
    التعليم: "education",
    الخبرات: "experiences",
    الخبرة: "experiences",
    الشهادات: "certifications",
    الدورات: "certifications",
    الأنشطة: "volunteering",
    التطوع: "volunteering",
    اللغات: "languages",
  };
  const normalizedSection = normalizeComparable(question.section);
  const section = sectionAliases[normalizedSection] || normalizedSection;
  const answeredQuestionIds = new Set(
    (facts.answers || [])
      .map((answer) => normalizeComparable(answer.fieldKey || answer.questionId || answer.id || ""))
      .filter(Boolean)
  );
  const fieldKey = getQuestionFieldKey(question);
  if (fieldKey && answeredQuestionIds.has(normalizeComparable(fieldKey))) return true;
  const text = normalizeComparable(`${question.question || ""} ${question.whyNeeded || ""}`);
  const profile = facts.profile || {};
  const resume = facts.resume || {};
  const confirmedBySection = {
    skills: (profile.skills || []).length || (resume.skills || []).length,
    projects: (profile.projects || []).length || (resume.projects || []).length,
    education:
      (resume.education || []).length ||
      Boolean(profile.major || profile.university || profile.degreeLevel),
    certifications: (profile.certifications || []).length || (resume.certifications || []).length,
    experiences:
      (profile.experiences || []).length ||
      (resume.experiences || resume.experience || []).length,
    volunteering: (profile.volunteering || []).length || (resume.volunteering || []).length,
    languages: (profile.languages || []).length || (resume.languages || []).length,
  };
  if (confirmedBySection[section]) return true;

  const confirmedText = (facts.sources || []).map((source) => source.text).join(" | ");
  const confirmedComparable = normalizeComparable(confirmedText);
  const asksEducationalStatus = ["طالبه", "طالب", "خريجه", "خريج", "متوقع التخرج"].some((term) =>
    text.includes(term)
  );
  if (
    asksEducationalStatus &&
    ["طالبه", "طالب", "خريجه", "خريج", "متوقع التخرج"].some((term) =>
      confirmedComparable.includes(term)
    )
  ) {
    return true;
  }
  return text.length > 2 && containsNormalizedPhrase(normalizeComparable(confirmedText), text);
};

const isKnownOpportunityContextQuestion = (question = {}, facts = {}) => {
  if (!facts.opportunity?._id) return false;
  const text = normalizeComparable(`${question.section || ""} ${question.question || ""} ${question.whyNeeded || ""}`);
  return ["وصف الفرصه", "متطلبات الفرصه", "وصف الوظيفه", "job description", "opportunity description"]
    .some((term) => text.includes(normalizeComparable(term)));
};

const filterConfirmedQuestions = (output = {}, facts = {}) => {
  if (output.status !== "needs_information") return output;
  const questions = (output.questions || []).filter(
    (question) => !isConfirmedQuestion(question, facts) && !isKnownOpportunityContextQuestion(question, facts)
  );
  return { ...output, questions };
};

const isDeferredTailorQuestion = (question = {}) => {
  const text = normalizeComparable(`${question.section || ""} ${question.question || ""} ${question.whyNeeded || ""}`);
  return [
    "مرحله التدريب", "اهليه", "مؤهل", "الجنسية", "المعدل", "جهه تعليميه", "معتمده",
    "فتره التدريب", "تاريخ البدايه", "تاريخ البدء", "خطاب", "ايميل", "بريد تقديم",
  ].some((term) => text.includes(term));
};

const hasNoBlockingTailorQuestions = (output = {}, facts = {}) =>
  output.status === "needs_information" &&
  Array.isArray(output.questions) &&
  output.questions.length > 0 &&
  output.questions.every(
    (question) =>
      isDeferredTailorQuestion(question) ||
      isConfirmedQuestion(question, facts) ||
      isKnownOpportunityContextQuestion(question, facts)
  );

const flattenDraftText = (draft = {}) =>
  safeText(
    [
      draft.targetTitle,
      draft.professionalSummary,
      ...(draft.education || []).flatMap((item) => [
        item.title,
        item.organization,
        item.degree,
        item.major,
        item.dates,
        item.details,
        ...(item.bullets || []),
      ]),
      ...(draft.experiences || []).flatMap((item) => [
        item.title,
        item.organization,
        item.dates,
        item.location,
        ...(item.bullets || []),
      ]),
      ...(draft.projects || []).flatMap((item) => [
        item.name,
        item.description,
        ...(item.technologies || []),
        ...(item.bullets || []),
      ]),
      ...(draft.certifications || []).flatMap((item) => [
        item.name,
        item.issuer,
        item.date,
        item.details,
      ]),
      ...(draft.volunteering || []).flatMap((item) => [
        item.title,
        item.organization,
        item.dates,
        ...(item.bullets || []),
      ]),
      ...(draft.skills || []).map((skill) => skill.name),
      ...(draft.languages || []).flatMap((language) => [language.name, language.level]),
    ].join("\n"),
    MAX_FACT_TEXT_LENGTH
  );

const sourceMapHasBullet = (sourceMap = {}, key = "") => {
  if (Array.isArray(sourceMap)) {
    return sourceMap.some(
      (entry) =>
        safeString(entry.path, 180) === key && Boolean(safeString(entry.sourceId, 100))
    );
  }
  const value = sourceMap?.[key];
  if (typeof value === "string") return Boolean(value.trim());
  if (value && typeof value === "object") return Boolean(value.sourceId);
  return false;
};

const getKnownSourceIdVariants = (facts = {}) => {
  const variants = new Set();
  const add = (value = "") => {
    const clean = safeString(value, 100);
    if (!clean) return;
    variants.add(clean);
    variants.add(normalizeComparable(clean));
  };

  (facts?.sources || []).forEach((source) => add(source.sourceId));
  (facts?.answers || []).forEach((answer, index) => {
    const questionId = safeString(answer.questionId || answer.id || `answer_${index + 1}`, 90);
    add(questionId);
    add(`answer_${questionId}`);
    add(`answers_${questionId}`);
  });

  return variants;
};

const normalizeDraftSourceId = (sourceIdValue = "", facts = {}) => {
  const clean = safeString(sourceIdValue, 100);
  if (!clean) return "";

  const sourceIds = facts?.sourceIds || new Set((facts?.sources || []).map((source) => source.sourceId));
  if (sourceIds.has(clean)) return clean;

  const cleanComparable = normalizeComparable(clean);
  const answerFacts = mapAnswersToFacts(facts?.answers || []);
  const matchedAnswerSource = answerFacts.sources.find((source) => {
    const sourceComparable = normalizeComparable(source.sourceId);
    return (
      source.sourceId === clean ||
      source.sourceId === `answer_${clean}` ||
      sourceComparable === cleanComparable ||
      sourceComparable === normalizeComparable(`answer_${clean}`)
    );
  });

  return matchedAnswerSource?.sourceId || clean;
};

const sourceMapEntryHasKnownSource = (entry = {}, facts = {}) => {
  const sourceIds = facts?.sourceIds || new Set((facts?.sources || []).map((source) => source.sourceId));
  const variants = getKnownSourceIdVariants(facts);
  const normalizedSourceId = normalizeDraftSourceId(entry.sourceId, facts);
  const comparableSourceId = normalizeComparable(entry.sourceId);

  return (
    sourceIds.has(normalizedSourceId) ||
    variants.has(entry.sourceId) ||
    variants.has(comparableSourceId) ||
    variants.has(normalizeComparable(normalizedSourceId))
  );
};

const sourceMapHasVerifiedBullet = (sourceMap = {}, key = "", facts = {}) => {
  if (Array.isArray(sourceMap)) {
    return sourceMap.some(
      (entry) =>
        safeString(entry.path, 180) === key && sourceMapEntryHasKnownSource(entry, facts)
    );
  }

  const value = sourceMap?.[key];
  if (typeof value === "string") {
    return sourceMapEntryHasKnownSource({ sourceId: value }, facts);
  }
  if (value && typeof value === "object") {
    return sourceMapEntryHasKnownSource(value, facts);
  }

  return false;
};

const getAnswerSources = (facts = {}) => mapAnswersToFacts(facts?.answers || []).sources;

const getFirstVerifiedSourceId = (facts = {}) => {
  const sourceIds = facts?.sourceIds || new Set((facts?.sources || []).map((source) => source.sourceId));
  return Array.from(sourceIds)[0] || "";
};

const getSourceForClaimText = (claimText = "", facts = {}) => {
  const normalizedClaim = normalizeComparable(claimText);
  if (!normalizedClaim) return "";

  const answerSources = getAnswerSources(facts);
  const allSources = [...answerSources, ...(facts?.sources || [])];
  const skillMatch = allSources.find((source) =>
    isSkillMentionedInFacts(claimText, normalizeComparable(source.text || ""))
  );
  if (skillMatch?.sourceId) return skillMatch.sourceId;

  const claimTokens = normalizedClaim
    .split(/\s+/)
    .filter((token) => token.length > 2)
    .slice(0, 10);
  const textMatch = allSources.find((source) => {
    const sourceText = normalizeComparable(source.text || "");
    const matches = claimTokens.filter((token) => containsNormalizedPhrase(sourceText, token));
    return matches.length >= Math.min(2, claimTokens.length);
  });

  return textMatch?.sourceId || "";
};

const ensureKnownSourceId = (sourceIdValue = "", facts = {}, fallbackText = "") => {
  const normalized = normalizeDraftSourceId(sourceIdValue, facts);
  const sourceIds = facts?.sourceIds || new Set((facts?.sources || []).map((source) => source.sourceId));
  if (normalized && sourceIds.has(normalized)) return normalized;
  return getSourceForClaimText(fallbackText, facts) || getFirstVerifiedSourceId(facts);
};

const sourceMapContainsPath = (sourceMap = [], path = "") =>
  Array.isArray(sourceMap) &&
  sourceMap.some((entry) => safeString(entry.path, 180) === path);

const neutralizeArabicResumeBullet = (value = "") => {
  let text = safeText(value, 600);
  const replacements = [
    [/^قمت\s+ب(?:ـ)?/u, ""],
    [/^عملت\s+على\s+/u, "العمل على "],
    [/^شاركت\s+في\s+/u, "المشاركة في "],
    [/^ساهمت\s+في\s+/u, "المساهمة في "],
    [/^طورت\s+/u, "تطوير "],
    [/^طوّرت\s+/u, "تطوير "],
    [/^صممت\s+/u, "تصميم "],
    [/^صمّم(?:ت)?\s+/u, "تصميم "],
    [/^صمم\s+/u, "تصميم "],
    [/^بنيت\s+/u, "بناء "],
    [/^بنت\s+/u, "بناء "],
    [/^بنى\s+/u, "بناء "],
    [/^استخدمت\s+/u, "استخدام "],
    [/^استخدم\s+/u, "استخدام "],
    [/^حللت\s+/u, "تحليل "],
    [/^حلل\s+/u, "تحليل "],
    [/^أعددت\s+/u, "إعداد "],
    [/^اعددت\s+/u, "إعداد "],
    [/^أنشأت\s+/u, "إنشاء "],
    [/^انشأت\s+/u, "إنشاء "],
    [/^نسقت\s+/u, "تنسيق "],
    [/^نسق\s+/u, "تنسيق "],
  ];
  replacements.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });
  return text.trim();
};

const normalizeDraftTone = (draft = {}) => {
  const nextDraft = JSON.parse(JSON.stringify(draft || {}));
  ["projects", "experiences", "volunteering"].forEach((section) => {
    (nextDraft[section] || []).forEach((entry) => {
      entry.bullets = (entry.bullets || []).map(neutralizeArabicResumeBullet).filter(Boolean);
    });
  });
  return nextDraft;
};

// These claims can affect a student's eligibility or identity. They must be
// explicitly present in Portfolio, ResumeProfile, or an answered question; a
// requirement in the opportunity is never evidence for them.
const getSensitiveSummaryClaims = (summary = "") => {
  const comparable = normalizeComparable(summary);
  const claimGroups = [
    ["طالبه", "طالب"],
    ["خريجه", "خريج"],
    ["متوقع التخرج"],
    ["مؤهله للتدريب التعاوني", "مؤهل للتدريب التعاوني", "اهلية التدريب"],
    ["الجنسيه السعوديه", "سعوديه", "سعودي"],
    ["المعدل التراكمي", "المعدل", "gpa"],
  ];
  return claimGroups
    .map((terms) => terms.find((term) => comparable.includes(term)) || "")
    .filter(Boolean);
};

const repairDraftEvidenceSources = ({ draft, sourceMap = [], facts = {} } = {}) => {
  const repairedDraft = normalizeDraftTone(draft || {});
  const repairedSourceMap = Array.isArray(sourceMap)
    ? sourceMap.map((entry) => ({ ...entry }))
    : Object.entries(sourceMap || {}).map(([path, value]) => ({
        path,
        sourceId: typeof value === "string" ? value : value?.sourceId || "",
        sourceText: typeof value === "object" ? value?.sourceText || "" : "",
      }));

  const addBulletSource = (path, sourceId, sourceText) => {
    if (!path || !sourceId || sourceMapContainsPath(repairedSourceMap, path)) return;
    repairedSourceMap.push({
      path,
      sourceId,
      sourceText: safeText(sourceText, 500),
    });
  };

  (repairedDraft.projects || []).forEach((project, projectIndex) => {
    const projectText = [
      project.name,
      project.description,
      ...(project.technologies || []),
      ...(project.bullets || []),
    ].join(" | ");
    project.sourceId = ensureKnownSourceId(project.sourceId, facts, projectText);
    (project.bullets || []).forEach((bullet, bulletIndex) => {
      const sourceIdForBullet = getSourceForClaimText(bullet, facts) || project.sourceId;
      addBulletSource(`projects.${projectIndex}.bullets.${bulletIndex}`, sourceIdForBullet, bullet);
    });
  });

  (repairedDraft.experiences || []).forEach((experience, experienceIndex) => {
    const experienceText = [
      experience.title,
      experience.organization,
      experience.dates,
      experience.location,
      ...(experience.bullets || []),
    ].join(" | ");
    experience.sourceId = ensureKnownSourceId(experience.sourceId, facts, experienceText);
    (experience.bullets || []).forEach((bullet, bulletIndex) => {
      const sourceIdForBullet = getSourceForClaimText(bullet, facts) || experience.sourceId;
      addBulletSource(`experiences.${experienceIndex}.bullets.${bulletIndex}`, sourceIdForBullet, bullet);
    });
  });

  (repairedDraft.volunteering || []).forEach((item, itemIndex) => {
    const itemText = [item.title, item.organization, item.dates, ...(item.bullets || [])].join(" | ");
    item.sourceId = ensureKnownSourceId(item.sourceId, facts, itemText);
    (item.bullets || []).forEach((bullet, bulletIndex) => {
      const sourceIdForBullet = getSourceForClaimText(bullet, facts) || item.sourceId;
      addBulletSource(`volunteering.${itemIndex}.bullets.${bulletIndex}`, sourceIdForBullet, bullet);
    });
  });

  (repairedDraft.skills || []).forEach((skill) => {
    skill.evidenceSourceId = ensureKnownSourceId(skill.evidenceSourceId, facts, skill.name);
  });

  return { draft: repairedDraft, sourceMap: repairedSourceMap };
};

const validateResumeClaims = ({ draft, facts, sourceMap = {}, purpose = "create_resume" } = {}) => {
  const parsed =
    tailoredResumeDraftSchema.safeParse(draft).success
      ? tailoredResumeDraftSchema.parse(draft)
      : resumeDraftSchema.safeParse(draft).success
        ? { ...resumeDraftSchema.parse(draft), missingRequirements: [] }
        : null;

  if (!parsed) {
    return {
      valid: false,
      errors: ["صيغة المسودة غير صالحة."],
      warnings: [],
    };
  }

  const errors = [];
  const warnings = [];
  const sourceIds = facts?.sourceIds || new Set((facts?.sources || []).map((source) => source.sourceId));
  const factText = facts?.factText || "";
  const factTextComparable = normalizeComparable(factText);
  const opportunityComparable = normalizeComparable(facts?.opportunityText || "");
  const allowedNumbers = facts?.allowedNumbers || extractNumbers(factText);

  if (purpose === "tailor_resume") {
    getSensitiveSummaryClaims(parsed.professionalSummary).forEach((claim) => {
      if (!containsNormalizedPhrase(factTextComparable, claim)) {
        errors.push(`لا يمكن إضافة معلومة حالة أو أهلية داخل النبذة دون دليل من بيانات الطالب: ${claim}`);
      }
    });
  }

  const draftNumbers = Array.from(extractNumbers(flattenDraftText(parsed)));
  draftNumbers.forEach((number) => {
    if (!allowedNumbers.has(number)) {
      errors.push(`تحتوي المسودة على رقم غير مذكور في بيانات الطالب: ${number}`);
    }
  });

  const checkSourceId = (sourceIdValue, label) => {
    const clean = normalizeDraftSourceId(sourceIdValue, facts);
    if (!clean) {
      warnings.push(`لم يتم ربط مصدر مباشر للمعلومة: ${label}`);
      return;
    }
    if (!sourceIds.has(clean)) {
      warnings.push(`مصدر المعلومة يحتاج مراجعة: ${label}`);
    }
  };

  (parsed.education || []).forEach((item, index) => {
    checkSourceId(item.sourceId, `التعليم ${index + 1}`);
    [item.organization, item.degree, item.major, item.dates]
      .filter(Boolean)
      .forEach((value) => {
        const comparable = normalizeComparable(value);
        if (comparable && !factTextComparable.includes(comparable)) {
          warnings.push(`قد تحتاج معلومة التعليم للمراجعة: ${value}`);
        }
      });
  });

  (parsed.experiences || []).forEach((item, index) => {
    checkSourceId(item.sourceId, `الخبرة ${index + 1}`);
    [item.organization, item.dates].filter(Boolean).forEach((value) => {
      const comparable = normalizeComparable(value);
      if (comparable && !factTextComparable.includes(comparable)) {
        warnings.push(`قد تحتاج جهة أو تاريخ الخبرة للمراجعة: ${value}`);
      }
    });
    (item.bullets || []).forEach((bullet, bulletIndex) => {
      if (!sourceMapHasVerifiedBullet(sourceMap, `experiences.${index}.bullets.${bulletIndex}`, facts)) {
        warnings.push(`نقطة الخبرة ${index + 1}.${bulletIndex + 1} تحتاج ربط مصدر أدق.`);
      }
    });
  });

  (parsed.projects || []).forEach((item, index) => {
    checkSourceId(item.sourceId, `المشروع ${index + 1}`);
    (item.technologies || []).forEach((technology) => {
      if (!isSkillMentionedInFacts(technology, factTextComparable)) {
        errors.push(`تمت إضافة أداة أو تقنية غير مذكورة: ${technology}`);
      }
    });
    (item.bullets || []).forEach((bullet, bulletIndex) => {
      if (!sourceMapHasVerifiedBullet(sourceMap, `projects.${index}.bullets.${bulletIndex}`, facts)) {
        warnings.push(`نقطة المشروع ${index + 1}.${bulletIndex + 1} تحتاج ربط مصدر أدق.`);
      }
    });
  });

  (parsed.certifications || []).forEach((item, index) => {
    checkSourceId(item.sourceId, `الشهادة ${index + 1}`);
    [item.name, item.issuer, item.date].filter(Boolean).forEach((value) => {
      const comparable = normalizeComparable(value);
      if (comparable && !factTextComparable.includes(comparable)) {
        errors.push(`تمت إضافة شهادة أو جهة شهادة غير موجودة: ${value}`);
      }
    });
  });

  (parsed.volunteering || []).forEach((item, index) => {
    checkSourceId(item.sourceId, `النشاط ${index + 1}`);
    (item.bullets || []).forEach((bullet, bulletIndex) => {
      if (!sourceMapHasVerifiedBullet(sourceMap, `volunteering.${index}.bullets.${bulletIndex}`, facts)) {
        warnings.push(`نقطة النشاط ${index + 1}.${bulletIndex + 1} تحتاج ربط مصدر أدق.`);
      }
    });
  });

  (parsed.skills || []).forEach((skill) => {
    const skillName = normalizeComparable(skill.name);
    checkSourceId(skill.evidenceSourceId, `المهارة ${skill.name}`);
    if (!isConfirmedSkill(skill.name, facts) && !isSkillMentionedInFacts(skill.name, factTextComparable)) {
      errors.push(`تمت إضافة مهارة غير مذكورة في بيانات الطالب: ${skill.name}`);
    }
    if (
      purpose === "tailor_resume" &&
      skillName &&
      containsNormalizedPhrase(opportunityComparable, skill.name) &&
      !isConfirmedSkill(skill.name, facts) && !isSkillMentionedInFacts(skill.name, factTextComparable)
    ) {
      errors.push(`لا يمكن إضافة متطلب الفرصة كمهارة للطالب بدون دليل: ${skill.name}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors: Array.from(new Set(errors)).slice(0, 30),
    warnings: Array.from(new Set(warnings)).slice(0, 30),
  };
};

const loadStudentProfileTool = tool({
  name: "load_student_profile",
  description: "Read the authenticated student's professional portfolio from Darbak. Read-only.",
  parameters: z.object({}).strict(),
  execute: async (_input, runContext) => {
    const context = getContext(runContext);
    const portfolio = await Portfolio.findOne(getAccessQuery(context)).lean();
    return mapPortfolioToFacts(portfolio);
  },
});

const loadCurrentResumeTool = tool({
  name: "load_current_resume",
  description: "Read the authenticated student's latest approved base resume. Read-only.",
  parameters: z.object({}).strict(),
  execute: async (_input, runContext) => {
    const context = getContext(runContext);
    const resume = await ResumeProfile.findOne(getAccessQuery(context)).lean();
    return mapResumeToFacts(resume);
  },
});

const loadOpportunityTool = tool({
  name: "load_opportunity",
  description: "Read a trusted Darbak training opportunity for resume tailoring. Read-only.",
  parameters: z
    .object({
      opportunityId: z.string().max(80).default(""),
    })
    .strict(),
  execute: async ({ opportunityId }, runContext) => {
    const context = getContext(runContext);
    const trustedId = safeString(context.opportunityId, 80);
    const requestedId = safeString(opportunityId || trustedId, 80);
    if (!trustedId || requestedId !== trustedId || !mongoose.Types.ObjectId.isValid(requestedId)) {
      return { opportunity: null, sources: [], error: "opportunity_not_allowed" };
    }
    const opportunity = await Opportunity.findById(requestedId).lean();
    return mapOpportunityToFacts(opportunity);
  },
});

const validateResumeClaimsTool = tool({
  name: "validate_resume_claims",
  description: "Deterministically validate a generated resume draft against original student facts.",
  parameters: z
    .object({
      draft: tailoredResumeDraftSchema,
      sourceMap: sourceMapSchema,
    })
    .strict(),
  execute: async ({ draft, sourceMap }, runContext) => {
    const context = getContext(runContext);
    const facts = await loadFactsForContext(context);
    const repaired = repairDraftEvidenceSources({ draft, sourceMap, facts });
    return validateResumeClaims({
      draft: repaired.draft,
      facts,
      sourceMap: repaired.sourceMap,
      purpose: context.purpose,
    });
  },
});

const createPendingResumeDraftTool = tool({
  name: "create_pending_resume_draft",
  description: "Create or update a temporary pending base resume draft. Does not approve or overwrite the resume.",
  parameters: z
    .object({
      draft: tailoredResumeDraftSchema,
      sourceMap: sourceMapSchema,
      changesSummary: z.array(z.string().max(320)).max(12).default([]),
      applicationPack: applicationPackSchema,
    })
    .strict(),
  execute: async ({ draft, sourceMap, changesSummary, applicationPack }, runContext) => {
    const context = getContext(runContext);
    const facts = await loadFactsForContext(context);
    const repaired = repairDraftEvidenceSources({ draft, sourceMap, facts });
    const validationResult = validateResumeClaims({
      draft: repaired.draft,
      facts,
      sourceMap: repaired.sourceMap,
      purpose: "create_resume",
    });
    if (!validationResult.valid) {
      return {
        ok: false,
        pendingDraftId: "",
        validationResult,
      };
    }

    const pending = await ResumePendingDraft.findOneAndUpdate(
      {
        agentSessionId: context.sessionId,
        draftType: "base_resume",
        status: "pending_review",
      },
      {
        $set: {
          userId: context.access?.user?._id,
          contact: context.access?.contact,
          accessCodeHash: context.access?.accessCodeHash,
          draftType: "base_resume",
          status: "pending_review",
          draft: repaired.draft,
          sourceMap: repaired.sourceMap,
          validationResult,
          agentSessionId: context.sessionId,
          changesSummary: safeArray(changesSummary, 12, (item) => safeString(item, 320)),
          expiresAt: new Date(Date.now() + PENDING_DRAFT_TTL_MS),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return {
      ok: true,
      pendingDraftId: pending._id.toString(),
      validationResult,
    };
  },
});

const createPendingTailoredVersionTool = tool({
  name: "create_pending_tailored_version",
  description: "Create a temporary pending tailored resume version for a Darbak opportunity. Never overwrites the base resume.",
  parameters: z
    .object({
      draft: tailoredResumeDraftSchema,
      sourceMap: sourceMapSchema,
      changesSummary: z.array(z.string().max(320)).max(12).default([]),
      applicationPack: applicationPackSchema,
    })
    .strict(),
  execute: async ({ draft, sourceMap, changesSummary, applicationPack }, runContext) => {
    const context = getContext(runContext);
    const facts = await loadFactsForContext(context);
    const repaired = repairDraftEvidenceSources({ draft, sourceMap, facts });
    const validationResult = validateResumeClaims({
      draft: repaired.draft,
      facts,
      sourceMap: repaired.sourceMap,
      purpose: "tailor_resume",
    });
    if (!validationResult.valid) {
      return {
        ok: false,
        pendingDraftId: "",
        validationResult,
      };
    }

    const pending = await ResumePendingDraft.findOneAndUpdate(
      {
        agentSessionId: context.sessionId,
        draftType: "tailored_resume",
        status: "pending_review",
      },
      {
        $set: {
          userId: context.access?.user?._id,
          contact: context.access?.contact,
          accessCodeHash: context.access?.accessCodeHash,
          draftType: "tailored_resume",
          status: "pending_review",
          draft: repaired.draft,
          sourceMap: repaired.sourceMap,
          validationResult,
          agentSessionId: context.sessionId,
          baseResumeId: context.baseResumeId || null,
          opportunityId: context.opportunityId || null,
          companyName: facts.opportunity?.organizationName || "",
          roleTitle: facts.opportunity?.title || "",
          changesSummary: safeArray(changesSummary, 12, (item) => safeString(item, 320)),
          applicationPack,
          expiresAt: new Date(Date.now() + PENDING_DRAFT_TTL_MS),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return {
      ok: true,
      pendingDraftId: pending._id.toString(),
      validationResult,
    };
  },
});

const loadFactsForContext = async (context = {}) => {
  const query = getAccessQuery(context);
  const [profile, resume, opportunity] = await Promise.all([
    Portfolio.findOne(query).lean(),
    ResumeProfile.findOne(query).lean(),
    context.opportunityId && mongoose.Types.ObjectId.isValid(context.opportunityId)
      ? Opportunity.findById(context.opportunityId).lean()
      : null,
  ]);

  return collectFacts({
    profile,
    resume,
    opportunity: context.collectedFacts?.externalJob || opportunity,
    collectedFacts: context.collectedFacts || {},
  });
};

const createAgentInstructions = () => `أنت وكيل السيرة الذاتية في منصة دربك، متخصص في طلاب الجامعات والخريجين الجدد والمتقدمين للتدريب التعاوني داخل السعودية.

مهمتك إدارة رحلة إنشاء السيرة من البداية إلى النهاية.

لا تطلب من الطالب كتابة محتوى مهني جاهز. اسمح له بالكتابة بأسلوبه العادي، ثم حول كلامه إلى صياغة مناسبة للسيرة.

قواعد إلزامية:

* لا تخترع معلومات أو مهارات أو أرقامًا.
* لا تغير التواريخ أو الجهات أو أسماء الشهادات.
* لا تضف نتيجة رقمية إلا إذا ذكرها الطالب.
* لا تضف أداة تقنية إلا إذا ظهرت في معلومات الطالب.
* لا تقل إن الطالب يتقن مهارة لمجرد أن الفرصة تطلبها.
* اربط كل نقطة منشأة بالمعلومة الخام التي بنيت عليها قدر الإمكان، لكن لا توقف إنشاء المسودة إذا كانت المعلومة موجودة في إجابات الطالب والربط التفصيلي يحتاج تحسين.
* إذا كانت المعلومة ناقصة، اسأل عنها بدل تخمينها.
* اسأل سؤالًا إلى ثلاثة أسئلة قصيرة في كل مرة.
* لا تعيد سؤالًا سبق أن أجاب عنه الطالب.
* لا تطيل المحادثة إذا كانت المعلومات كافية.
* اكتب بلغة السيرة التي اختارها الطالب.
* اجعل النبذة بين سطرين وأربعة.
* اجعل كل خبرة أو مشروع يحتوي على نقطتين إلى أربع نقاط.
* إذا أكد الطالب معلومة أو مهارة أو أداة داخل إجابات الجلسة، اعتبرها مصدرًا صالحًا للكتابة حتى لو لم تكن محفوظة سابقًا في الملف المهني.
* لا تكتب ملاحظة من نوع "لم يُدرج كذا بسبب تعذر التحقق" إذا كانت المعلومة مذكورة صراحة في إجابات الطالب أو الملف المهني؛ أدرجها في المكان المناسب.
* اكتب نقاط الخبرات والمشاريع بصياغة سيرة محايدة لا تتكلم عن الطالب بضمير الغائب ولا المتكلم.
* لا تبدأ النقاط بأفعال شخصية مثل: صمم، صممت، بنى، بنت، استخدم، استخدمت. استخدم صياغة اسمية/مصدرية مثل: تطوير، تصميم، استخدام، إعداد، تحليل، بناء، تنسيق.
* استخدم أفعالًا أو مصادر مهنية واضحة دون تحديد جنس الطالب.
* لا تستخدم عبارات عامة أو مبالغًا فيها.
* لا تستخدم ضمير المتكلم داخل السيرة.
* لا تحفظ أي تعديل نهائي قبل موافقة الطالب.
* أنشئ نسخة جديدة عند تخصيص السيرة لفرصة، ولا تستبدل السيرة الأساسية.
* عند التخصيص، متطلبات الإعلان هي سياق للمطابقة وليست حقائق عن الطالب: لا تنقل الجنسية أو المعدل أو حالة التخرج أو استحقاق التدريب إلى السيرة.
* لا تستخدم مسمى الفرصة أو تخصصها لتغيير headline الطالب أو تخصصه أو أدواره أو جهاته أو تواريخه. أبقِ هذه القيم من الملف المهني والسيرة فقط.
* استخدم متطلبات الفرصة فقط لترتيب الحقائق المثبتة، وإبراز المشاريع والمهارات المرتبطة، وتحسين النبذة والنقاط. إذا كان التخصص مختلفًا، اذكره كفجوة في التوافق ولا تعالجه بتغيير هوية الطالب.
* تنطبق قاعدة الحقائق أيضًا على النبذة المهنية: لا تصف الطالب بأنه طالب/خريج أو مؤهل للتدريب، ولا تذكر معدله أو جنسيته أو حالة تخرجه إلا إذا ظهرت تلك الحقيقة صراحة في بياناته أو إجابة موثقة منه.
* عند task=tailor_resume افصل العمل إلى ثلاث طبقات: (أ) السيرة المخصصة تُنشأ مباشرة من facts الطالب؛ (ب) الجنسية، المعدل، أهلية التدريب، والجهة التعليمية المعتمدة تُسجل فقط ضمن missingInformation كـ«متطلب يحتاج منك التأكد» ولا تُسأل عنها ولا توقف المسودة؛ (ج) فترة التدريب وتاريخ البداية وتفاصيل الإيميل أو الخطاب ليست ضمن السيرة، فلا تسأل عنها في هذا المسار.
* في task=tailor_resume لا تعد status=needs_information بسبب شرط في الإعلان أو تفصيل تقديم. اسأل فقط عن Fact طالب ضروري لادعاء تريد كتابته داخل السيرة ولا يوجد له دليل، وإلا أنشئ المسودة من البيانات المتاحة.
* عند task=tailor_resume أنشئ مع المسودة Application Pack واحدًا في نفس السياق: خطاب تدريب قصير ورسالة إيميل. لا تضف claim في الخطاب أو الإيميل غير موجود في facts الطالب أو المسودة. إذا كانت تعليمات التقديم تطلب فترة التدريب أو تاريخًا غير متوفر، أنشئ السيرة والخطاب، واجعل email.status=needs_input وأضف missingApplicationFields مناسبًا؛ لا تسأل عنه ولا توقف المسودة.

استخدم الأدوات بهذا الترتيب تقريبًا:
1. اقرأ الملف المهني والسيرة الحالية.
2. إذا كان الطلب تخصيصًا، اقرأ الفرصة المحددة فقط.
3. إن كانت المعلومات ناقصة، أعد status=needs_information مع أسئلة قصيرة.
4. إذا كانت كافية، أنشئ draft مع sourceMap لكل نقطة.
5. شغّل validate_resume_claims.
6. إذا valid=true أنشئ pending draft بالأداة المناسبة وأعد pendingDraftId حتى لو كانت هناك warnings عن ربط المصادر.
7. إذا validation فشل بسبب مهارة أو رقم أو جهة غير مذكورة، اسأل الطالب سؤالًا قصيرًا بدل إيقاف الرحلة.

لا تستخدم أي مصدر خارجي ولا تفترض معلومات عن الطالب أو الشركات.`;

const createDarbakResumeAgent = () =>
  new Agent({
    name: "Darbak Resume Agent",
    model: process.env.OPENAI_RESUME_AGENT_MODEL || DEFAULT_RESUME_AGENT_MODEL,
    instructions: createAgentInstructions(),
    tools: [
      loadStudentProfileTool,
      loadCurrentResumeTool,
      loadOpportunityTool,
      validateResumeClaimsTool,
      createPendingResumeDraftTool,
      createPendingTailoredVersionTool,
    ],
    outputType: resumeAgentOutputSchema,
  });

const buildAgentInput = ({ session, answers = [] }) =>
  safeText(
    JSON.stringify({
      task: session.purpose,
      source: session.source,
      language: session.language,
      sessionId: session.sessionId,
      answeredQuestionIds: session.answeredQuestionIds || [],
      collectedAnswers: session.collectedFacts?.answers || [],
      externalOpportunity: session.collectedFacts?.externalJob || null,
      newAnswers: safeArray(answers, 3, (answer) => ({
        questionId: safeString(answer.questionId || answer.id, 90),
        section: safeString(answer.section, 90),
        question: safeString(answer.question, 320),
        answer: safeText(answer.answer || answer.value, MAX_ANSWER_LENGTH),
      })),
      instruction:
        "أكمل نفس جلسة وكيل السيرة. لا تعيد سؤالًا تمت الإجابة عنه. إذا وجدت externalOpportunity فهي سياق الفرصة المعتمد، سواء كانت فرصة من دربك أو جهة خارجية: لا تطلب من الطالب وصف الفرصة أو رابطًا أو معرّفًا مرة أخرى. في tailor_resume أنشئ المسودة من facts المتاحة ولا توقفها لأهلية التدريب أو الجنسية أو المعدل أو فترة التدريب؛ أعدها فقط كملاحظات مراجعة. إذا تكفي المعلومات أنشئ المسودة والتحقق والمسودة المؤقتة.",
    }),
    MAX_FACT_TEXT_LENGTH
  );

const summarizeRunUsage = (result = {}, startedAt = Date.now()) => {
  const rawResponses = Array.isArray(result.rawResponses) ? result.rawResponses : [];
  const usage = rawResponses.reduce(
    (acc, response) => {
      const responseUsage = response?.usage || {};
      acc.inputTokens += Number(responseUsage.input_tokens || responseUsage.prompt_tokens || 0);
      acc.outputTokens += Number(responseUsage.output_tokens || responseUsage.completion_tokens || 0);
      acc.totalTokens += Number(responseUsage.total_tokens || 0);
      acc.model = response?.model || acc.model;
      return acc;
    },
    { model: "", inputTokens: 0, outputTokens: 0, totalTokens: 0 }
  );
  const newItems = Array.isArray(result.newItems) ? result.newItems : [];
  const toolsUsed = newItems
    .map((item) => item?.rawItem?.name || item?.name || item?.toolName || "")
    .filter(Boolean);

  return {
    ...usage,
    turns: rawResponses.length || 1,
    toolCalls: toolsUsed.length,
    toolsUsed: Array.from(new Set(toolsUsed)),
    durationMs: Date.now() - startedAt,
  };
};

const runDarbakResumeAgent = async ({ access, session, answers = [] }) => {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error("OPENAI_API_KEY is missing");
    error.code = "OPENAI_KEY_MISSING";
    throw error;
  }

  const startedAt = Date.now();
  const agent = createDarbakResumeAgent();
  const existingAnswers = Array.isArray(session.collectedFacts?.answers)
    ? session.collectedFacts.answers
    : [];
  const normalizedNewAnswers = safeArray(answers, 3, (answer) => ({
    questionId: safeString(answer.fieldKey || answer.questionId || answer.id, 90),
    section: safeString(answer.section, 90),
    question: safeString(answer.question, 320),
    answer: safeText(answer.answer || answer.value, MAX_ANSWER_LENGTH),
  }));
  const collectedFacts = {
    ...(session.collectedFacts || {}),
    answers: [...existingAnswers, ...normalizedNewAnswers].slice(-40),
  };
  const context = {
    access,
    sessionId: session.sessionId,
    purpose: session.purpose,
    source: session.source,
    language: session.language,
    opportunityId: session.opportunityId?.toString?.() || session.opportunityId || "",
    baseResumeId: session.baseResumeId?.toString?.() || session.baseResumeId || "",
    collectedFacts,
    answeredQuestionIds: session.answeredQuestionIds || [],
  };

  let result = await run(agent, buildAgentInput({ session, answers }), {
    context,
    maxTurns: Number(process.env.RESUME_AGENT_MAX_TURNS || DEFAULT_MAX_TURNS),
    previousResponseId: session.lastResponseId || undefined,
  });

  let output = resumeAgentOutputSchema.parse(result.finalOutput);
  const facts = await loadFactsForContext(context);
  if (session.purpose === "tailor_resume" && hasNoBlockingTailorQuestions(output, facts)) {
    result = await run(
      agent,
      "أسئلة أهلية التدريب أو تفاصيل خطاب التقديم غير مانعة لمسار تخصيص السيرة. لا تسأل عنها الآن. أنشئ مسودة مخصصة من facts الطالب المتاحة فقط، وضع الشروط غير المؤكدة ضمن missingInformation للمراجعة.",
      {
        context,
        maxTurns: Number(process.env.RESUME_AGENT_MAX_TURNS || DEFAULT_MAX_TURNS),
        previousResponseId: result.lastResponseId || undefined,
      }
    );
    output = resumeAgentOutputSchema.parse(result.finalOutput);
  }
  let filteredOutput = filterConfirmedQuestions(output, facts);
  // Filtering an already-confirmed question must not leave the UI on an empty
  // "needs information" step. Ask the same agent session to continue from its
  // saved facts and return a draft or genuinely missing fields instead.
  if (
    output.status === "needs_information" &&
    output.questions?.length > 0 &&
    filteredOutput.questions?.length === 0
  ) {
    result = await run(
      agent,
      "كل الأسئلة السابقة مؤكدة أصلًا في الملف المهني أو إجابات الطالب. لا تعرضها مرة أخرى؛ أنشئ المسودة من الحقائق المتاحة أو اسأل فقط عن حقل محدد غير موجود فعلًا.",
      {
        context,
        maxTurns: Number(process.env.RESUME_AGENT_MAX_TURNS || DEFAULT_MAX_TURNS),
        previousResponseId: result.lastResponseId || undefined,
      }
    );
    output = resumeAgentOutputSchema.parse(result.finalOutput);
    filteredOutput = filterConfirmedQuestions(output, facts);
  }
  return {
    output: withStableQuestionKeys(filteredOutput),
    lastResponseId: result.lastResponseId || "",
    usage: summarizeRunUsage(result, startedAt),
  };
};

module.exports = {
  PENDING_DRAFT_TTL_MS,
  resumeAgentOutputSchema,
  collectFacts,
  filterConfirmedQuestions,
  isDeferredTailorQuestion,
  runDarbakResumeAgent,
  validateResumeClaims,
};
