const crypto = require("crypto");
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
const {
  compactVerifiedResumeFacts,
  composeProfessionalDraft,
  runProfessionalQualityGate,
  getQualityFailureSections,
} = require("../services/resumeProfessionalComposer");
const { buildVerifiedResumeFacts } = require("../services/resumePortfolioHydration");

setSensitiveDataLoggingEnabled(false);

const DEFAULT_RESUME_AGENT_MODEL = "gpt-5.6-terra";
const DEFAULT_MAX_TURNS = 6;
const MAX_ANSWER_LENGTH = 1600;
const MAX_FACT_TEXT_LENGTH = 22000;
const PENDING_DRAFT_TTL_MS = 48 * 60 * 60 * 1000;
const RESUME_AGENT_MAX_OUTPUT_TOKENS = 6000;

const questionSchema = z
  .object({
    id: z.string().max(90).default(""),
    fieldKey: z.string().max(90).default(""),
    section: z.string().max(90).default(""),
    question: z.string().max(320).default(""),
    whyNeeded: z.string().max(260).default(""),
    reason: z.string().max(120).default(""),
    inputType: z
      .enum(["text", "textarea", "date", "url", "select", "number"])
      .default("textarea"),
    options: z.array(z.string().max(120)).max(8).default([]),
  })
  .strict();

const validationResultSchema = z
  .object({
    valid: z.boolean().default(false),
    errors: z.array(z.string().max(320)).max(30).default([]),
    warnings: z.array(z.string().max(320)).max(30).default([]),
  })
  .strict();

const candidateAssessmentSchema = z
  .object({
    candidateLevel: z.enum(["student", "graduate", "early_career"]).default("student"),
    professionalIdentity: z.string().max(240).default(""),
    strongestEvidence: z.array(z.string().max(180)).max(5).default([]),
    relevantThemes: z.array(z.string().max(120)).max(5).default([]),
    weakOrMissingAreas: z.array(z.string().max(160)).max(5).default([]),
    positioning: z.string().max(360).default(""),
    avoidClaims: z.array(z.string().max(160)).max(8).default([]),
  })
  .strict()
  .default({
    candidateLevel: "student",
    professionalIdentity: "",
    strongestEvidence: [],
    relevantThemes: [],
    weakOrMissingAreas: [],
    positioning: "",
    avoidClaims: [],
  });

const qualitySchema = z
  .object({
    unsupportedClaims: z.array(z.string().max(160)).max(20).default([]),
    genericSummary: z.boolean().default(false),
    statusConflict: z.boolean().default(false),
    languageMixing: z.boolean().default(false),
    emptyImportantSections: z.array(z.string().max(160)).max(12).default([]),
    needsRepair: z.boolean().default(false),
  })
  .strict()
  .default({
    unsupportedClaims: [],
    genericSummary: false,
    statusConflict: false,
    languageMixing: false,
    emptyImportantSections: [],
    needsRepair: false,
  });

const sourceMapEntrySchema = z
  .object({
    path: z.string().max(180).default(""),
    sourceId: z.string().max(100).default(""),
    sourceText: z.string().max(500).default(""),
  })
  .strict();

const sourceMapSchema = z.array(sourceMapEntrySchema).max(120).default([]);
const applicationPackSchema = z.object({
  // A base-resume run has no application pack. Keep the same structured
  // contract while accepting the empty object the model correctly returns.
  trainingLetter: z.object({ body: z.string().max(2200).default(""), status: z.enum(["ready", "needs_input", "unavailable"]).default("ready") }).strict().default({ body: "", status: "ready" }),
  email: z.object({ subject: z.string().max(220).default(""), body: z.string().max(1600).default(""), status: z.enum(["ready", "needs_input", "unavailable"]).default("ready") }).strict().default({ subject: "", body: "", status: "ready" }),
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
    candidateAssessment: candidateAssessmentSchema,
    quality: qualitySchema,
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

// Repairs deliberately return only one failed presentation section. The
// canonical facts, identity, education and every unrelated section remain
// server-owned from the first structured draft.
const resumeQualityRepairSchema = z
  .object({
    sectionKey: z.enum(["summary", "experiences", "projects", "skills"]),
    professionalSummary: resumeDraftSchema.shape.professionalSummary.optional(),
    experiences: resumeDraftSchema.shape.experiences.optional(),
    projects: resumeDraftSchema.shape.projects.optional(),
    skills: resumeDraftSchema.shape.skills.optional(),
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

const BASE_MISSING_FIELD_KEYS = new Set([
  "phone",
  "full_name",
  "professional_headline",
  "graduation_year",
  "expected_graduation_year",
  "gpa",
  "gpa_scale",
  "university",
  "degree",
  "student_status",
  "major",
  "city",
  "training_period",
  "target_field",
  "opportunity_description",
]);

const OPTIONAL_MISSING_FIELD_KEYS = new Set([
  "professional_context",
  "certification_details",
]);

const getEntriesForQuestion = (facts = {}, section = "") => {
  const normalizedSection = safeString(section, 90).toLowerCase();
  const key = normalizedSection.includes("experience") || normalizedSection.includes("خبر")
    ? "experiences"
    : normalizedSection.includes("project") || normalizedSection.includes("مشروع")
      ? "projects"
      : normalizedSection.includes("certification") || normalizedSection.includes("شهاد") || normalizedSection.includes("دور")
        ? "certifications"
        : "";
  if (!key) return [];
  const entries = [
    ...(Array.isArray(facts.resume?.[key]) ? facts.resume[key] : []),
    ...(Array.isArray(facts.profile?.[key]) ? facts.profile[key] : []),
  ];
  const seen = new Set();
  return entries.filter((entry) => {
    const id = safeString(entry?.id || entry?._id, 120);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

const findQuestionEntry = (question = {}, facts = {}, section = "") => {
  const entries = getEntriesForQuestion(facts, section);
  if (!entries.length) return null;
  const text = safeString(`${question.question || ""} ${question.whyNeeded || ""} ${question.reason || ""}`, 700).toLowerCase();
  const explicitId = safeString(question.entryId || question.sourceId || "", 120);
  if (explicitId) {
    const exact = entries.find((entry) => safeString(entry.id || entry._id, 120) === explicitId);
    if (exact) return exact;
  }
  const mentioned = entries.filter((entry) => {
    const title = safeString(entry.title || entry.name, 180).toLowerCase();
    return title && text.includes(title);
  });
  if (mentioned.length === 1) return mentioned[0];
  return entries.length === 1 ? entries[0] : null;
};

const getExplicitAllowedFieldKey = (question = {}, facts = {}) => {
  const explicit = safeString(question.fieldKey || question.id, 90);
  if (!explicit) return "";
  if (BASE_MISSING_FIELD_KEYS.has(explicit) || OPTIONAL_MISSING_FIELD_KEYS.has(explicit)) return explicit;
  const match = explicit.match(/^(project_description|experience_description|certification_details):(.+)$/u);
  if (!match) return "";
  const [, type, entryId] = match;
  const section = type === "project_description" ? "projects" : type === "experience_description" ? "experiences" : "certifications";
  return getEntriesForQuestion(facts, section).some((entry) => safeString(entry.id || entry._id, 120) === entryId)
    ? explicit
    : "";
};

const inputTypeForFieldKey = (fieldKey = "", requested = "") => {
  if (["graduation_year", "expected_graduation_year", "gpa", "gpa_scale"].includes(fieldKey)) return "number";
  if (fieldKey === "opportunity_description" || fieldKey.endsWith("_description") || fieldKey.includes("_description:")) return "textarea";
  if (["training_period", "target_field"].includes(fieldKey)) return "text";
  return ["text", "textarea", "date", "url", "select", "number"].includes(requested) ? requested : "text";
};

const missingReasonForFieldKey = (fieldKey = "", provided = "") =>
  safeString(provided, 120) || {
    phone: "phone_missing",
    graduation_year: "graduation_year_missing",
    expected_graduation_year: "expected_graduation_year_missing",
    gpa: "gpa_missing",
    project_description: "project_description_missing",
    experience_description: "experience_description_missing",
    opportunity_description: "opportunity_description_missing",
  }[fieldKey.split(":")[0]] || "required_fact_missing";

const getQuestionFieldKey = (question = {}, facts = {}) => {
  const text = safeString(`${question.section || ""} ${question.question || ""} ${question.whyNeeded || ""} ${question.reason || ""}`, 700).toLowerCase();
  const section = safeString(question.section, 40).toLowerCase();
  const explicit = getExplicitAllowedFieldKey(question, facts);
  if (explicit) return explicit;
  const projectEntry = findQuestionEntry(question, facts, "projects");
  const experienceEntry = findQuestionEntry(question, facts, "experiences");
  const certificationEntry = findQuestionEntry(question, facts, "certifications");
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
    [/(وصف الفرصة|متطلبات الفرصة|وصف الوظيفة|opportunity description|job description)/, "opportunity_description"],
  ];
  if (/(project|مشروع)/.test(text) && /(description|وصف|دور|نفذت|عملت)/.test(text) && projectEntry) {
    return `project_description:${safeString(projectEntry.id || projectEntry._id, 120)}`;
  }
  if (/(experience|خبر|تدريب)/.test(text) && /(description|وصف|مهام|مسؤوليات|دور)/.test(text) && experienceEntry) {
    return `experience_description:${safeString(experienceEntry.id || experienceEntry._id, 120)}`;
  }
  if (/(certification|شهاد|دور)/.test(text) && /(description|تفاصيل|provider|جهة)/.test(text) && certificationEntry) {
    return `certification_details:${safeString(certificationEntry.id || certificationEntry._id, 120)}`;
  }
  const matched = knownFields.find(([pattern]) => pattern.test(text));
  if (matched) return matched[1];
  return "";
};

const normalizeNeedsInformationOutput = (output = {}, facts = {}) => {
  if (output.status !== "needs_information") return output;
  const rawQuestions = Array.isArray(output.questions) && output.questions.length
    ? output.questions
    : (output.missingInformation || []).map((item) => ({ ...item, inputType: "textarea" }));
  const rejected = [];
  const questions = rawQuestions.reduce((normalized, question) => {
    const fieldKey = getQuestionFieldKey(question, facts);
    if (!fieldKey || OPTIONAL_MISSING_FIELD_KEYS.has(fieldKey.split(":")[0])) {
      rejected.push(question);
      return normalized;
    }
    normalized.push({
      ...question,
      id: fieldKey,
      fieldKey,
      inputType: inputTypeForFieldKey(fieldKey, question.inputType),
      options: Array.isArray(question.options) ? question.options : [],
      reason: missingReasonForFieldKey(fieldKey, question.reason || question.whyNeeded),
    });
    return normalized;
  }, []);
  return {
    ...output,
    questions,
    warnings: rejected.length
      ? [...(output.warnings || []), "AGENT_UNMAPPABLE_MISSING_INFORMATION"].slice(0, 20)
      : output.warnings || [],
  };
};

const withStableQuestionKeys = (output = {}) => ({
  ...output,
  questions: (Array.isArray(output.questions) ? output.questions : []).map((question) => ({
    ...question,
    fieldKey: safeString(question.fieldKey, 90) || getQuestionFieldKey(question),
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
  "react js": ["react", "react.js", "react js", "ريأكت", "رياكت", "ري اكت"],
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

const isConfirmedCertificationValue = (value = "", facts = {}) => {
  const comparableValue = normalizeComparable(value);
  if (!comparableValue) return true;

  return (facts?.sources || [])
    .filter((source) => source.section === "certifications")
    .some((source) => {
      const sourceText = normalizeComparable(source.text || "");
      return sourceText.includes(comparableValue);
    });
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

// A mismatch between a student's major and an opportunity's explicitly listed
// majors is an eligibility signal for the student to review. It is not a
// resume-integrity error: tailoring may still safely emphasize verified,
// transferable evidence.
const MAJOR_FAMILIES = {
  computing: [
    "computer science",
    "علوم الحاسب",
    "علوم الحاسوب",
    "تقنية المعلومات",
    "information technology",
    "نظم المعلومات",
    "information systems",
    "هندسة البرمجيات",
    "software engineering",
    "الحاسب والتقنية",
    "computing",
  ],
  business: [
    "business administration",
    "ادارة الاعمال",
    "إدارة الأعمال",
    "accounting",
    "المحاسبة",
    "finance",
    "التمويل",
    "marketing",
    "التسويق",
    "human resources",
    "الموارد البشرية",
    "المالية والادارية",
    "المالية والإدارية",
  ],
};

const getMajorFamilies = (major = "") => {
  const comparable = normalizeComparable(major);
  if (!comparable) return [];
  return Object.entries(MAJOR_FAMILIES)
    .filter(([, values]) => values.some((value) => {
      const normalizedValue = normalizeComparable(value);
      return comparable.includes(normalizedValue) || normalizedValue.includes(comparable);
    }))
    .map(([family]) => family);
};

const opportunityMajorRequirementsArePreferredOnly = (opportunity = {}) => {
  const text = normalizeComparable([opportunity.requirements, opportunity.description].filter(Boolean).join(" "));
  if (!text) return false;
  const preferred = /يفضل|مفضل|preferred/.test(text);
  const required = /يشترط|مطلوب|التخصصات المطلوبه|required|must/.test(text);
  return preferred && !required;
};

const getTailoringEligibilityWarnings = (facts = {}) => {
  const opportunity = facts.opportunity || {};
  const candidateMajor = safeString(facts.profile?.major || facts.resume?.personalInfo?.major, 160);
  const listedMajors = Array.from(new Set([
    ...(opportunity.majorCategories || []),
    ...(opportunity.specialties || []),
  ].map((major) => safeString(major, 160)).filter(Boolean)));

  if (!candidateMajor || !listedMajors.length || opportunityMajorRequirementsArePreferredOnly(opportunity)) return [];

  const candidateComparable = normalizeComparable(candidateMajor);
  const candidateFamilies = getMajorFamilies(candidateMajor);
  const matchesListedMajor = listedMajors.some((listedMajor) => {
    const listedComparable = normalizeComparable(listedMajor);
    if (!listedComparable) return false;
    if (candidateComparable.includes(listedComparable) || listedComparable.includes(candidateComparable)) return true;
    const listedFamilies = getMajorFamilies(listedMajor);
    return listedFamilies.some((family) => candidateFamilies.includes(family));
  });

  return matchesListedMajor
    ? []
    : [{
        code: "specialization_mismatch",
        message: "هذه الفرصة تحدد تخصصات لا تشمل تخصصك الحالي. نقدر نجهز تقديمك بالاعتماد على مهاراتك وخبراتك الحقيقية، لكن تحقق من شروط الأهلية قبل الإرسال.",
      }];
};

// Tailoring may reorder and frame verified evidence, but it should not replace
// a strong master presentation when the opportunity has little in common with
// the student's confirmed background. This intentionally uses only student
// facts, never requirements from the opportunity as candidate evidence.
const getTailoringRelevanceStrength = (facts = {}) => {
  const opportunityText = normalizeComparable(facts.opportunityText || "");
  if (!opportunityText) return "medium";

  const candidateSkills = [
    ...(Array.isArray(facts.profile?.skills) ? facts.profile.skills : []),
    ...(Array.isArray(facts.resume?.skills) ? facts.resume.skills : []),
  ]
    .map((skill) => normalizeComparable(typeof skill === "string" ? skill : skill?.name || skill?.title || ""))
    .filter((skill) => skill.length >= 3);
  const candidateEvidence = normalizeComparable(JSON.stringify({
    profile: facts.profile || {},
    resume: facts.resume || {},
    answers: facts.answers || [],
  }));
  const skillMatches = candidateSkills.filter((skill) => opportunityText.includes(skill));
  const transferableTerms = [
    "analysis", "تحليل", "reports", "reporting", "تقارير", "organize", "organized", "تنظيم",
    "coordination", "coordinate", "تنسيق", "follow up", "متابعة", "systems", "system", "نظام",
    "data", "بيانات", "excel", "power bi", "project management", "ادارة المشاريع", "إدارة المشاريع",
  ];
  const transferableMatches = transferableTerms.filter((term) => {
    const normalizedTerm = normalizeComparable(term);
    return normalizedTerm.length >= 3 && opportunityText.includes(normalizedTerm) && candidateEvidence.includes(normalizedTerm);
  });
  const evidenceScore = new Set([...skillMatches, ...transferableMatches]).size;
  if (evidenceScore >= 2) return "high";
  if (evidenceScore === 1) return "medium";
  return getTailoringEligibilityWarnings(facts).some((warning) => warning.code === "specialization_mismatch")
    ? "low"
    : "medium";
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

const getFallbackMissingQuestion = (facts = {}) => {
  const answers = new Set(
    (facts.answers || [])
      .map((answer) => normalizeComparable(answer.fieldKey || answer.questionId || answer.id || ""))
      .filter(Boolean)
  );
  const projects = getEntriesForQuestion(facts, "projects");
  const projectWithoutDescription = projects.find((project) =>
    !safeText(project.description || project.details || project.summary, 1600)
  );

  const projectId = safeString(projectWithoutDescription?.id || projectWithoutDescription?._id, 120);
  const projectFieldKey = projectId ? `project_description:${projectId}` : "";
  if (projectWithoutDescription && projectFieldKey && !answers.has(normalizeComparable(projectFieldKey))) {
    return {
      id: projectFieldKey,
      fieldKey: projectFieldKey,
      section: "projects",
      question: `اكتب وصفًا مختصرًا لمشروع ${safeString(projectWithoutDescription.title || projectWithoutDescription.name, 120) || "هذا"}.`,
      whyNeeded: "نستخدمه لتحويل المشروع إلى نقاط مهنية دقيقة دون افتراض معلومات.",
      reason: "project_description_missing",
      inputType: "textarea",
      options: [],
    };
  }

  const experiences = getEntriesForQuestion(facts, "experiences");
  const experienceWithoutDescription = experiences.find((experience) =>
    !safeText(experience.description || experience.details || experience.summary, 1600)
  );
  const experienceId = safeString(experienceWithoutDescription?.id || experienceWithoutDescription?._id, 120);
  const experienceFieldKey = experienceId ? `experience_description:${experienceId}` : "";
  if (experienceWithoutDescription && experienceFieldKey && !answers.has(normalizeComparable(experienceFieldKey))) {
    return {
      id: experienceFieldKey,
      fieldKey: experienceFieldKey,
      section: "experiences",
      question: `اكتب وصفًا مختصرًا لما نفذته في ${safeString(experienceWithoutDescription.title, 120) || "هذه الخبرة"}.`,
      whyNeeded: "نستخدمه لصياغة نقاط خبرة دقيقة دون افتراض مسؤوليات.",
      reason: "experience_description_missing",
      inputType: "textarea",
      options: [],
    };
  }

  return null;
};

const ensureActionableNeedsInformation = (output = {}, facts = {}) => {
  if (output.status !== "needs_information" || (output.questions || []).length) return output;
  const fallbackQuestion = getFallbackMissingQuestion(facts);
  if (fallbackQuestion) return { ...output, questions: [fallbackQuestion] };

  return {
    ...output,
    status: "cannot_continue",
    message: "نحتاج تحديد المعلومة الناقصة بدقة قبل متابعة بناء السيرة.",
    warnings: [...(output.warnings || []), "AGENT_UNMAPPABLE_MISSING_INFORMATION"].slice(0, 20),
  };
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

const hasVerifiedSummaryStatus = (claim = "", facts = {}, factTextComparable = "") => {
  const normalizedClaim = normalizeComparable(claim);
  const statuses = [
    facts?.profile?.studentStatus,
    facts?.resume?.personalInfo?.studentStatus,
    facts?.resume?.studentStatus,
  ].map(normalizeComparable);

  if (["طالب", "طالبه"].includes(normalizedClaim)) {
    return statuses.includes("student") || statuses.includes("طالب") || statuses.includes("طالبه") ||
      containsNormalizedPhrase(factTextComparable, claim);
  }
  if (["خريج", "خريجه"].includes(normalizedClaim)) {
    return statuses.includes("graduate") || statuses.includes("خريج") || statuses.includes("خريجه") ||
      containsNormalizedPhrase(factTextComparable, claim);
  }
  if (normalizedClaim === "متوقع التخرج") {
    return statuses.includes("expected_graduate") || statuses.includes("متوقع التخرج") ||
      containsNormalizedPhrase(factTextComparable, claim);
  }
  return containsNormalizedPhrase(factTextComparable, claim);
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
      if (!hasVerifiedSummaryStatus(claim, facts, factTextComparable)) {
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
      if (!isConfirmedSkill(technology, facts) && !isSkillMentionedInFacts(technology, factTextComparable)) {
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
      if (
        comparable &&
        !factTextComparable.includes(comparable) &&
        !isConfirmedCertificationValue(value, facts)
      ) {
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
        contact: context.access?.contact,
        accessCodeHash: context.access?.accessCodeHash,
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
        contact: context.access?.contact,
        accessCodeHash: context.access?.accessCodeHash,
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

const createAgentInstructions = () => `أنت Professional Resume Writer في منصة دربك، متخصص في السير الذاتية ATS للطلاب والخريجين والمبتدئين داخل السعودية.

مهمتك إدارة رحلة إنشاء السيرة من البداية إلى النهاية. أنت كاتب مهني لا formatter ولا مترجم حرفي: قيّم evidence المتاح داخليًا، حدّد positioning صادقًا، ثم اكتب محتوى واضحًا ومهنيًا.

قبل كتابة draft أنشئ candidateAssessment داخليًا ومختصرًا: مستوى المرشح، أقوى evidence، themes المرتبطة، الجوانب الناقصة، positioning، وما يجب تجنب ادعائه. لا تعرض reasoning طويلًا للمستخدم.

الحقائق المحمية داخل verifiedResumeFacts هي المصدر الوحيد للاسم والتواصل والمدينة والجامعة والتخصص والدرجة وحالة الطالب وسنة التخرج والمعدل والتواريخ والشهادات. لا تغيّرها ولا تكتبها بحرية. headline يأتي حتميًا من major + studentStatus + grammaticalGender؛ أعده كما ورد في الحقائق ولا تبتكر Intern أو Trainee.

اكتب summary من 2–3 جمل غالبًا: الهوية المهنية، أقوى evidence عملي، 2–3 capabilities مثبتة، واتجاه مهني واقعي. لا تستخدم ضمير المتكلم أو enthusiasm عام أو قوائم مهارات مكررة أو claims غير مثبتة. لا تذكر لغة تحقق أو مصدر بيانات داخل محتوى السيرة: امنع عبارات «في نطاق المهارات الموثقة»، «بحسب المعلومات المتاحة»، «وفق البيانات المقدمة»، «القدرات المثبتة»، و«المعلومات الموثقة»، وبالإنجليزية امنع documented skills وverified skills وverified capabilities وbased on available information وaccording to provided data. استخدم بدلها صياغة مهنية مباشرة مثل «خبرة تطبيقية باستخدام» فقط عندما تدعمها facts أو المشاريع.

قواعد الكتابة العربية المهنية:
* اكتب نبذة عربية فصحى خفيفة وطبيعية من 2–3 جمل (45–75 كلمة غالبًا عندما تسمح الحقائق)، لا ترجمة حرفية من الإنجليزية.
* ابدأ بالهوية المهنية ثم أقوى دليل عملي: خبرة تدريبية للخريج عند توفرها، أو مشروع تطبيقي للطالب، ثم قدرات مدعومة واتجاه مهني منطقي.
* قبل كتابة خاتمة النبذة صنّف قوة الدليل داخليًا إلى strong أو moderate أو limited. عند وجود خبرة أو مشاريع واضحة في المجال استخدم خاتمة مباشرة مثل «يركز على…» أو «يعمل على تطوير خبرته في…»، ولا تستخدم «يتجه نحو» أو «يسعى إلى» أو «يطمح إلى». عند الدليل المتوسط يمكن استخدام «يهتم بتطوير خبرته في…»، وعند الدليل المحدود فقط استخدم صياغة أخف مثل «مهتم بفرص في…». لا تجعل الخاتمة قائمة أدوات ولا تكرر أدوات ذكرتها في الجمل السابقة إلا إذا أضافت معنى جديدًا.
* لا تكرر headline حرفيًا إن لم تضف الجملة معنى جديدًا، ولا تحوّل النبذة إلى قائمة Skills. اذكر أداة أو أداتين فقط إذا أضافتا معنى مهنيًا؛ قسم المهارات يعرض بقية الأدوات.
* تجنب العبارات الآلية أو العامة مثل: «تشمل المهارات»، «تتضمن الخبرات»، «يمتلك أساسًا في»، «خلفية أكاديمية ضمن بكالوريوس»، «تطبيق عملي من خلال»، «تشمل القدرات المثبتة»، «شغوف»، «طموح»، «متميز»، «سريع التعلم»، «قادر على العمل تحت الضغط»، و«بيئة ديناميكية» ما لم تكن حقيقة مثبتة ذات صلة مباشرة.
* لا تملأ السيرة بعبارات عامة عند قلة البيانات؛ اكتب نبذة أقصر مبنية على التخصص والمشروع أو النشاط المتاح فقط.
* بعد كتابة النبذة، راجعها ككاتب سيرة محترف قبل إرجاع المسودة: احذف أي جملة لا تضيف معنى مهمًا، ادمج الأفكار المتكررة، وخفف المصطلحات الرسمية المصطنعة. فضّل الفعل المباشر المناسب للسياق على تراكيب مثل «يتجه الاهتمام المهني»، من دون إضافة حقيقة جديدة.
* اكتب نقاط الخبرة من 2–4 نقاط بحسب كمية الحقائق. اجمع المهام المتشابهة، وابدأ كل نقطة بفعل مهني أو مصدر واضح مثل: تنظيم، إعداد، تنسيق، تحليل، تطوير، متابعة. لا تستخدم «المسؤول عن»، ولا تكرر المعنى بصيغتين، ولا تضف أثرًا أو رقمًا غير موثق.
* اكتب نقاط المشروع من 1–3 نقاط مختلفة: ما الذي نُفذ، الوظائف الأساسية، ثم الأدوات الموثقة عند الحاجة. لا تكرر وصف المشروع حرفيًا في نقطتين ولا تضف تقنية غير مثبتة.
* أبقِ أسماء الأدوات والجهات الرسمية بالإنجليزية عند الحاجة، مثل Python وReact.js وMicrosoft Excel وPower BI، لكن اجعل الجملة العربية نفسها سليمة ومترابطة.
* داخل draft أعد editorialCheck للنبذة فقط بهذه القيم المنطقية: concise وnoRepeatedIdeas وnaturalArabic وevidenceBased وnoUnnecessaryToolListing. اجعل كل قيمة true فقط بعد مراجعة النبذة وفق اسمها؛ هذا فحص تحريري موجز وليس محتوى ظاهرًا للمستخدم.

professionalContext، إن وُجد، هو كلام الطالب العادي عن المجال الذي يهتم به أو ما يريد إبرازه. استخدمه فقط لفهم positioning وcandidate assessment؛ لا تنسخه حرفيًا كنص summary.

اكتب experience bullets بأفعال مهنية واضحة، 2–5 فقط، ومن المهام المثبتة. اكتب project bullets من وصف المشروع والحقائق فقط. إذا كان وصف المشروع غير كافٍ، اجعل needsMoreInformation ضمن missingInformation ولا تخترع bullet. لا تضف metrics أو achievements أو tools أو roles أو employment status غير موجودة.

في الإنجليزية اكتب business English طبيعيًا ولا تستخدم أحرفًا عربية في headline أو summary أو bullets. في العربية استخدم عربية مهنية طبيعية مع إبقاء أسماء الأدوات الرسمية مثل React.js وMicrosoft Excel.

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
* اجعل السؤال structured: اختر inputType المناسب (number للمعدل أو السنة، date للتاريخ، url للرابط، وselect فقط إذا كانت الخيارات واضحة وأعد options). لا تطلب فقرة طويلة عندما تكفي إجابة قصيرة. عند status=needs_information أعد دائمًا fieldKey وquestion وinputType وreason، واستخدم فقط مفاتيح قابلة للتحرير: phone، full_name، major، city، university، degree، student_status، graduation_year، expected_graduation_year، gpa، gpa_scale، training_period، target_field، opportunity_description أو project_description:<projectId> أو experience_description:<experienceId>. لا تخترع fieldKey جديدًا. إذا كان التفصيل اختياريًا لتحسين الصياغة فقط فلا تعد needs_information؛ أكمل بالحقائق المتاحة.
* لا تطيل المحادثة إذا كانت المعلومات كافية.
* اكتب بلغة السيرة التي اختارها الطالب.
* اجعل النبذة بين سطرين وأربعة.
* اجعل كل خبرة أو مشروع يحتوي على نقطتين إلى أربع نقاط.
* إذا أكد الطالب معلومة أو مهارة أو أداة داخل إجابات الجلسة، اعتبرها مصدرًا صالحًا للكتابة حتى لو لم تكن محفوظة سابقًا في الملف المهني.
* لا تكتب ملاحظة من نوع "لم يُدرج كذا بسبب تعذر التحقق" إذا كانت المعلومة مذكورة صراحة في إجابات الطالب أو الملف المهني؛ أدرجها في المكان المناسب.
* اكتب نقاط الخبرات والمشاريع بصياغة سيرة محايدة لا تتكلم عن الطالب بضمير الغائب ولا المتكلم.
* استخدم أفعالًا أو مصادر مهنية واضحة دون تحديد جنس الطالب.
* لا تستخدم عبارات عامة أو مبالغًا فيها.
* لا تستخدم ضمير المتكلم داخل السيرة.
* لا تحفظ أي تعديل نهائي قبل موافقة الطالب.
* أنشئ نسخة جديدة عند تخصيص السيرة لفرصة، ولا تستبدل السيرة الأساسية.
* عند التخصيص، متطلبات الإعلان هي سياق للمطابقة وليست حقائق عن الطالب: لا تنقل الجنسية أو المعدل أو حالة التخرج أو استحقاق التدريب إلى السيرة.
* لا تستخدم مسمى الفرصة أو تخصصها لتغيير headline الطالب أو تخصصه أو أدواره أو جهاته أو تواريخه. أبقِ هذه القيم من الملف المهني والسيرة فقط.
* استخدم متطلبات الفرصة فقط لترتيب الحقائق المثبتة، وإبراز المشاريع والمهارات المرتبطة، وتحسين النبذة والنقاط. إذا كان التخصص مختلفًا، لا تغيّر هوية الطالب ولا تحوّل ذلك إلى سبب لإيقاف المسودة أو إلى claim عن أهليته؛ الخادم يعرض تنبيه الأهلية عند وجود شرط تخصص صريح.
* تنطبق قاعدة الحقائق أيضًا على النبذة المهنية: لا تصف الطالب بأنه طالب/خريج أو مؤهل للتدريب، ولا تذكر معدله أو جنسيته أو حالة تخرجه إلا إذا ظهرت تلك الحقيقة صراحة في بياناته أو إجابة موثقة منه.
* عند task=tailor_resume افصل العمل إلى ثلاث طبقات: (أ) السيرة المخصصة تُنشأ مباشرة من facts الطالب؛ (ب) الجنسية، المعدل، أهلية التدريب، والجهة التعليمية المعتمدة تُسجل فقط ضمن missingInformation كـ«متطلب يحتاج منك التأكد» ولا تُسأل عنها ولا توقف المسودة؛ (ج) فترة التدريب وتاريخ البداية وتفاصيل الإيميل أو الخطاب ليست ضمن السيرة، فلا تسأل عنها في هذا المسار.
* في task=tailor_resume لا تعد status=needs_information بسبب شرط في الإعلان أو تفصيل تقديم. اسأل فقط عن Fact طالب ضروري لادعاء تريد كتابته داخل السيرة ولا يوجد له دليل، وإلا أنشئ المسودة من البيانات المتاحة.
* عند task=tailor_resume أنشئ مع المسودة Application Pack واحدًا في نفس السياق: خطاب تدريب قصير ورسالة إيميل. لا تضف claim في الخطاب أو الإيميل غير موجود في facts الطالب أو المسودة. إذا كانت تعليمات التقديم تطلب فترة التدريب أو تاريخًا غير متوفر، أنشئ السيرة والخطاب، واجعل email.status=needs_input وأضف missingApplicationFields مناسبًا؛ لا تسأل عنه ولا توقف المسودة.

البيانات المتحققة والسياق الموثوق يمران لك مباشرة ضمن input. لا تطلب أو تبحث عن مصادر إضافية. إذا كانت كافية أعد draft structured، وإذا لم تكن كافية أعد needs_information فقط مع fieldKey واضح. الخادم هو الذي يتحقق ويحفظ المسودة بعد ردك.

لا تستخدم أي مصدر خارجي ولا تفترض معلومات عن الطالب أو الشركات.`;

const createDarbakResumeAgent = () =>
  new Agent({
    name: "Darbak Resume Agent",
    model: process.env.OPENAI_RESUME_AGENT_MODEL || DEFAULT_RESUME_AGENT_MODEL,
    // Full structured drafts are materially larger than a missing-information
    // response. Give the model a bounded, explicit output budget so a valid
    // draft is not cut off after the student answers the final question.
    modelSettings: {
      maxTokens: RESUME_AGENT_MAX_OUTPUT_TOKENS,
    },
    instructions: createAgentInstructions(),
    tools: [],
    outputType: resumeAgentOutputSchema,
  });

const createDarbakResumeRepairAgent = () =>
  new Agent({
    name: "Darbak Resume Quality Repair Agent",
    model: process.env.OPENAI_RESUME_AGENT_MODEL || DEFAULT_RESUME_AGENT_MODEL,
    modelSettings: { maxTokens: 1800 },
    instructions: `أنت تصلح قسمًا واحدًا فقط من مسودة سيرة ذاتية بعد فحص آلي محدد.
استخدم الحقائق المتحققة المعطاة فقط، ولا تغير الاسم أو التعليم أو المسمى أو أي قسم لا يطلب منك إصلاحه.
أعد sectionKey نفسه تمامًا وأعد محتوى القسم المطلوب فقط. لا تضف حقائق أو مهارات أو أرقامًا.
إذا كان سبب الفشل متعلقًا باللغة الإنجليزية، اجعل النص المطلوب فقط إنجليزيًا طبيعيًا بلا أحرف عربية.
إذا كان القسم projects، لا تحذف وصف مشروع متحققًا منه واكتب bullet واحدًا على الأقل عندما يكون الوصف موجودًا.
إذا كان القسم skills، استخدم فقط المهارات المتحققة.` ,
    tools: [],
    outputType: resumeQualityRepairSchema,
  });

const buildAgentInput = ({ session, answers = [], verifiedResumeFacts = {} }) =>
  safeText(
    JSON.stringify({
      task: session.purpose,
      source: session.source,
      language: session.language,
      sessionId: session.sessionId,
      answeredQuestionIds: session.answeredQuestionIds || [],
      verifiedResumeFacts,
      collectedAnswers: session.collectedFacts?.answers || [],
      externalOpportunity: session.collectedFacts?.externalJob || null,
      newAnswers: safeArray(answers, 3, (answer) => ({
        questionId: safeString(answer.questionId || answer.id, 90),
        section: safeString(answer.section, 90),
        question: safeString(answer.question, 320),
        answer: safeText(answer.answer || answer.value, MAX_ANSWER_LENGTH),
      })),
      instruction:
        "اكتب من verifiedResumeFacts والإجابات المؤكدة فقط. لا تعيد سؤالًا تمت الإجابة عنه. إذا وجدت externalOpportunity فهي سياق الفرصة المعتمد ولا تطلب وصفها أو رابطًا مرة أخرى. في tailor_resume لا توقف المسودة لأهلية التدريب أو الجنسية أو المعدل أو فترة التدريب؛ ضعها كملاحظات مراجعة فقط.",
    }),
    MAX_FACT_TEXT_LENGTH
  );

const selectRepairFacts = (verifiedResumeFacts = {}, sectionKey = "") => {
  const base = {
    personalInfo: verifiedResumeFacts.personalInfo || {},
    confirmedAnswers: verifiedResumeFacts.confirmedAnswers || [],
  };
  if (sectionKey === "summary") {
    return {
      ...base,
      professionalContext: verifiedResumeFacts.professionalContext || "",
      experiences: verifiedResumeFacts.experiences || [],
      projects: verifiedResumeFacts.projects || [],
      skills: verifiedResumeFacts.skills || [],
      certifications: verifiedResumeFacts.certifications || [],
      volunteering: verifiedResumeFacts.volunteering || [],
    };
  }
  return { ...base, [sectionKey]: verifiedResumeFacts[sectionKey] || [] };
};

const getRepairSectionForQuality = ({ quality = {}, draft = {}, language = "ar" } = {}) => {
  const errors = Array.isArray(quality.errors) ? quality.errors : [];
  const sections = getQualityFailureSections(errors);
  if (errors.includes("english_language_mixing")) {
    if (/[\u0600-\u06FF]/u.test(safeString(draft.professionalSummary, 900))) return "summary";
    if ((draft.experiences || []).some((entry) => (entry.bullets || []).some((bullet) => /[\u0600-\u06FF]/u.test(safeString(bullet, 300))))) return "experiences";
    if ((draft.projects || []).some((entry) => (entry.bullets || []).some((bullet) => /[\u0600-\u06FF]/u.test(safeString(bullet, 300))))) return "projects";
  }
  return sections.find((section) => ["summary", "experiences", "projects", "skills"].includes(section)) || "";
};

const buildQualityRepairInput = ({ sectionKey, draft, verifiedResumeFacts, quality, language }) =>
  safeText(JSON.stringify({
    task: "repair_resume_section",
    language,
    sectionKey,
    failureRules: Array.isArray(quality.errors) ? quality.errors : [],
    verifiedResumeFacts: selectRepairFacts(verifiedResumeFacts, sectionKey),
    failedSection: sectionKey === "summary"
      ? { professionalSummary: draft.professionalSummary || "" }
      : { [sectionKey]: draft[sectionKey] || [] },
  }), MAX_FACT_TEXT_LENGTH);

const mergeQualityRepair = ({ draft = {}, repair = {}, expectedSection = "" } = {}) => {
  if (!expectedSection || repair.sectionKey !== expectedSection) {
    throw Object.assign(new Error("Repair returned an unexpected section"), { code: "INVALID_AGENT_RESPONSE" });
  }
  if (expectedSection === "summary") {
    return { ...draft, professionalSummary: safeText(repair.professionalSummary, 900) };
  }
  return { ...draft, [expectedSection]: Array.isArray(repair[expectedSection]) ? repair[expectedSection] : [] };
};

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

const buildGenerationCacheKey = ({ session = {}, verifiedResumeFacts = {}, collectedFacts = {} } = {}) => {
  const answersByField = new Map();
  safeArray(collectedFacts.answers, 40, (answer) => ({
    fieldKey: safeString(answer.fieldKey || answer.questionId || answer.id, 90),
    answer: safeText(answer.answer || answer.value, MAX_ANSWER_LENGTH),
  })).forEach((answer) => {
    if (answer.fieldKey) answersByField.set(answer.fieldKey, answer.answer);
  });
  const payload = JSON.stringify({
    // The output cache lives on the session document, but retaining an owner
    // component also prevents a cache key from ever being reusable across
    // accounts if its storage implementation changes later.
    owner: session.userId?.toString?.() || session.contact || "",
    purpose: session.purpose,
    language: session.language,
    verifiedResumeFacts,
    answers: Array.from(answersByField.entries()).sort(([a], [b]) => a.localeCompare(b)),
  });
  return crypto.createHash("sha256").update(payload).digest("hex");
};

const getReusableDraftOutput = (session = {}, cacheKey = "") => {
  const cached = session.collectedFacts?.agentOutputCache;
  if (!cached || cached.key !== cacheKey || cached.rejected) return null;
  const parsed = resumeAgentOutputSchema.safeParse(cached.output);
  if (!parsed.success || !["draft_ready", "tailored_draft_ready"].includes(parsed.data.status)) return null;
  return parsed.data;
};

const markAgentOutputCacheRejected = (session = {}, cacheKey = "") => {
  const cached = session.collectedFacts?.agentOutputCache;
  if (!cached || cached.key !== cacheKey) return false;
  session.collectedFacts = {
    ...(session.collectedFacts || {}),
    agentOutputCache: {
      ...cached,
      rejected: true,
      rejectedAt: new Date().toISOString(),
    },
  };
  if (typeof session.markModified === "function") session.markModified("collectedFacts");
  return true;
};

// A cached structured response is safe to reuse only after both deterministic
// gates pass. Claim-validation failures are just as final as quality failures;
// keeping either response cached traps the student in the same retry loop.
const shouldRejectCachedDraft = ({ validationResult = {}, quality = {} } = {}) =>
  validationResult?.valid === false || Boolean(quality?.needsRepair);

const classifyClaimValidationFailures = (errors = []) => Array.from(new Set(
  safeArray(errors, 30, (error) => safeString(error, 320)).map((error) => {
    if (/مهارة|skill/i.test(error)) return "unsupported_skill";
    if (/أداة|تقنية|رقم|معلومة حالة|أهلية|شهادة|جهة شهادة/i.test(error)) return "unsupported_claim";
    return "claim_validation_failed";
  })
));

const persistQualityDiagnostics = (session = {}, trace = {}, failureCode = "") => {
  if (!session || !trace.generationId) return;
  session.collectedFacts = {
    ...(session.collectedFacts || {}),
    // Deliberately code-only: this makes production failures diagnosable
    // without storing the student's text or any resume facts in diagnostics.
    qualityDiagnostics: {
      generationId: trace.generationId,
      failureCode: safeString(failureCode, 80),
      qualityFailureRules: safeArray(trace.qualityFailureRules, 12, (rule) => safeString(rule, 100)),
      failedSections: safeArray(trace.failedSections, 4, (section) => safeString(section, 40)),
      initialGenerationSucceeded: Boolean(trace.initialGenerationSucceeded),
      repairAttempted: Boolean(trace.repairAttempted),
      repairSucceeded: Boolean(trace.repairSucceeded),
      aiCalls: Number(trace.aiCalls || 0),
      cachedDraftUsed: Boolean(trace.reusedModelOutput),
      recordedAt: new Date().toISOString(),
    },
  };
  if (typeof session.markModified === "function") session.markModified("collectedFacts");
};

const buildAgentStageError = (stage, error, trace = {}) => {
  const wrapped = error instanceof Error ? error : new Error("Resume agent failed");
  const isStructuredOutputError =
    wrapped.name === "ZodError" ||
    wrapped.name === "ModelBehaviorError" ||
    /structured output|json schema|output.*parse|parse.*output/i.test(wrapped.message || "");
  if (!wrapped.code && !wrapped.status) {
    wrapped.code = isStructuredOutputError
      ? "INVALID_AGENT_RESPONSE"
      : wrapped.name === "APIConnectionError"
        ? "AGENT_UNAVAILABLE"
        : "GENERATION_FAILED";
  }
  wrapped.resumeAgentTrace = {
    stage,
    modelCallStarted: Boolean(trace.modelCallStarted),
    modelCallSucceeded: Boolean(trace.modelCallSucceeded),
    structuredOutputValid: Boolean(trace.structuredOutputValid),
    composerCompleted: Boolean(trace.composerCompleted),
    qualityGateCompleted: Boolean(trace.qualityGateCompleted),
    saveCompleted: Boolean(trace.saveCompleted),
    reusedModelOutput: Boolean(trace.reusedModelOutput),
    initialGenerationSucceeded: Boolean(trace.initialGenerationSucceeded),
    repairAttempted: Boolean(trace.repairAttempted),
    repairSucceeded: Boolean(trace.repairSucceeded),
    aiCalls: Number(trace.aiCalls || 0),
    qualityFailureRules: Array.isArray(trace.qualityFailureRules) ? trace.qualityFailureRules.slice(0, 12) : [],
    failedSections: Array.isArray(trace.failedSections) ? trace.failedSections.slice(0, 4) : [],
    generationId: safeString(trace.generationId, 64),
    turns: Number(trace.turns || 0),
    toolCalls: Number(trace.toolCalls || 0),
  };
  return wrapped;
};

const buildDeterministicSourceMap = (draft = {}, facts = {}) => {
  const mapSection = (section) => safeArray(draft[section], 12, (entry, index) =>
    safeArray(entry.bullets, 5, (bullet, bulletIndex) => ({
      path: `${section}.${index}.bullets.${bulletIndex}`,
      sourceId: getSourceForClaimText(bullet, facts) || entry.sourceId || getFirstVerifiedSourceId(facts),
      sourceText: safeText(bullet, 500),
    }))
  ).flat();
  return [
    ...mapSection("experiences"),
    ...mapSection("projects"),
    ...mapSection("volunteering"),
  ].filter((entry) => entry.sourceId);
};

const persistProfessionalDraft = async ({ context = {}, draft = {}, sourceMap = [], validationResult = {}, changesSummary = [], applicationPack = {} }) => {
  const isTailored = context.purpose === "tailor_resume";
  const pending = await ResumePendingDraft.findOneAndUpdate(
    {
      agentSessionId: context.sessionId,
      contact: context.access?.contact,
      accessCodeHash: context.access?.accessCodeHash,
      draftType: isTailored ? "tailored_resume" : "base_resume",
      status: "pending_review",
    },
    {
      $set: {
        userId: context.access?.user?._id,
        contact: context.access?.contact,
        accessCodeHash: context.access?.accessCodeHash,
        draftType: isTailored ? "tailored_resume" : "base_resume",
        status: "pending_review",
        draft,
        sourceMap,
        validationResult,
        agentSessionId: context.sessionId,
        baseResumeId: context.baseResumeId || null,
        opportunityId: context.opportunityId || null,
        companyName: context.collectedFacts?.externalJob?.organizationName || "",
        roleTitle: context.collectedFacts?.externalJob?.title || "",
        changesSummary: safeArray(changesSummary, 12, (item) => safeString(item, 320)),
        applicationPack,
        expiresAt: new Date(Date.now() + PENDING_DRAFT_TTL_MS),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  return pending._id.toString();
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

  const profile = await Portfolio.findOne(getAccessQuery(context)).lean();
  const verifiedResumeFacts = compactVerifiedResumeFacts(
    buildVerifiedResumeFacts(profile || {}, access?.contact || ""),
    collectedFacts.answers
  );
  const generationCacheKey = buildGenerationCacheKey({
    session,
    verifiedResumeFacts,
    collectedFacts,
  });
  const trace = {
    generationId: crypto.randomUUID(),
    modelCallStarted: false,
    modelCallSucceeded: false,
    structuredOutputValid: false,
    composerCompleted: false,
    qualityGateCompleted: false,
    saveCompleted: false,
    reusedModelOutput: false,
    turns: 0,
    toolCalls: 0,
    initialGenerationSucceeded: false,
    repairAttempted: false,
    repairSucceeded: false,
    aiCalls: 0,
    qualityFailureRules: [],
    failedSections: [],
  };
  let result = null;
  let output = getReusableDraftOutput(session, generationCacheKey);

  if (output) {
    trace.modelCallSucceeded = true;
    trace.structuredOutputValid = true;
    trace.reusedModelOutput = true;
    trace.initialGenerationSucceeded = true;
  } else {
    try {
      trace.modelCallStarted = true;
      trace.aiCalls += 1;
      result = await run(agent, buildAgentInput({ session, answers, verifiedResumeFacts }), {
        context,
        maxTurns: 1,
      });
      trace.modelCallSucceeded = true;
      trace.turns = summarizeRunUsage(result, startedAt).turns;
      trace.toolCalls = summarizeRunUsage(result, startedAt).toolCalls;
    } catch (error) {
      throw buildAgentStageError("terra_call", error, trace);
    }

    try {
      output = resumeAgentOutputSchema.parse(result.finalOutput);
      trace.structuredOutputValid = true;
      trace.initialGenerationSucceeded = true;
    } catch (error) {
      throw buildAgentStageError("structured_output", error, trace);
    }

    if (["draft_ready", "tailored_draft_ready"].includes(output.status) && output.draft) {
      try {
        session.collectedFacts = {
          ...(session.collectedFacts || {}),
          agentOutputCache: {
            key: generationCacheKey,
            output,
            createdAt: new Date().toISOString(),
          },
        };
        if (typeof session.markModified === "function") session.markModified("collectedFacts");
        await session.save();
      } catch (error) {
        throw buildAgentStageError("cache_save", error, trace);
      }
    }
  }

  let facts;
  let filteredOutput;
  let tailoringRelevance = "";
  try {
    facts = await loadFactsForContext(context);
    filteredOutput = ensureActionableNeedsInformation(
      filterConfirmedQuestions(normalizeNeedsInformationOutput(output, facts), facts),
      facts
    );
    if (session.purpose === "tailor_resume") {
      filteredOutput.eligibilityWarnings = getTailoringEligibilityWarnings(facts);
      tailoringRelevance = getTailoringRelevanceStrength(facts);
    }
  } catch (error) {
    throw buildAgentStageError("facts_loading", error, trace);
  }
  if (["draft_ready", "tailored_draft_ready"].includes(filteredOutput.status) && filteredOutput.draft) {
    let composedDraft;
    let sourceMap;
    let validationResult;
    let quality;
    try {
      composedDraft = composeProfessionalDraft({
        draft: filteredOutput.draft,
        verifiedFacts: verifiedResumeFacts,
        language: session.language,
      });
    } catch (error) {
      throw buildAgentStageError("professional_composer", error, trace);
    }
    try {
      sourceMap = buildDeterministicSourceMap(composedDraft, facts);
    } catch (error) {
      throw buildAgentStageError("source_mapping", error, trace);
    }
    try {
      validationResult = validateResumeClaims({
        draft: composedDraft,
        facts,
        sourceMap,
        purpose: session.purpose,
      });
      trace.composerCompleted = true;
    } catch (error) {
      throw buildAgentStageError("claims_validation", error, trace);
    }
    try {
      quality = runProfessionalQualityGate({
        draft: composedDraft,
        verifiedFacts: verifiedResumeFacts,
        language: session.language,
      });
      trace.qualityGateCompleted = true;
    } catch (error) {
      // Keep the already-valid structured draft cached, but never turn a
      // validator runtime fault into a successful resume or a second full
      // generation. Its non-PII reason is retained for production diagnosis.
      trace.qualityFailureRules = ["quality_gate_runtime_error"];
      trace.failedSections = [];
      persistQualityDiagnostics(session, trace, "professional_quality_gate");
      throw buildAgentStageError("professional_quality_gate", error, trace);
    }
    trace.qualityFailureRules = Array.isArray(quality.errors) ? quality.errors.slice(0, 12) : [];
    if (!validationResult.valid) {
      trace.qualityFailureRules = Array.from(new Set([
        ...trace.qualityFailureRules,
        ...classifyClaimValidationFailures(validationResult.errors),
      ])).slice(0, 12);
    }
    trace.failedSections = getQualityFailureSections(trace.qualityFailureRules);

    const repairSection = getRepairSectionForQuality({
      quality,
      draft: composedDraft,
      language: session.language,
    });
    if (validationResult.valid && quality.needsRepair && repairSection) {
      trace.repairAttempted = true;
      let repairOutput;
      try {
        trace.aiCalls += 1;
        const repairResult = await run(
          createDarbakResumeRepairAgent(),
          buildQualityRepairInput({
            sectionKey: repairSection,
            draft: composedDraft,
            verifiedResumeFacts,
            quality,
            language: session.language,
          }),
          { context, maxTurns: 1 }
        );
        repairOutput = resumeQualityRepairSchema.parse(repairResult.finalOutput);
      } catch (error) {
        trace.qualityFailureRules = [...trace.qualityFailureRules, "quality_repair_failed"].slice(0, 12);
        trace.failedSections = [repairSection];
        repairOutput = null;
      }

      if (repairOutput) try {
        const repairedDraft = composeProfessionalDraft({
          draft: mergeQualityRepair({
            draft: composedDraft,
            repair: repairOutput,
            expectedSection: repairSection,
          }),
          verifiedFacts: verifiedResumeFacts,
          language: session.language,
        });
        const repairedSourceMap = buildDeterministicSourceMap(repairedDraft, facts);
        const repairedValidation = validateResumeClaims({
          draft: repairedDraft,
          facts,
          sourceMap: repairedSourceMap,
          purpose: session.purpose,
        });
        const repairedQuality = runProfessionalQualityGate({
          draft: repairedDraft,
          verifiedFacts: verifiedResumeFacts,
          language: session.language,
        });
        trace.qualityFailureRules = Array.isArray(repairedQuality.errors) ? repairedQuality.errors.slice(0, 12) : [];
        trace.failedSections = getQualityFailureSections(trace.qualityFailureRules);
        if (repairedValidation.valid && !repairedQuality.needsRepair) {
          composedDraft = repairedDraft;
          sourceMap = repairedSourceMap;
          validationResult = repairedValidation;
          quality = repairedQuality;
          trace.repairSucceeded = true;
          // Replace the reusable structured draft only after the repaired
          // section passes both deterministic gates. A refresh can now reuse
          // this approved content without another Terra call.
          output = { ...output, draft: composedDraft };
          session.collectedFacts = {
            ...(session.collectedFacts || {}),
            agentOutputCache: {
              key: generationCacheKey,
              output,
              createdAt: new Date().toISOString(),
            },
          };
          if (typeof session.markModified === "function") session.markModified("collectedFacts");
          await session.save();
        } else {
          validationResult = repairedValidation;
          quality = repairedQuality;
        }
      } catch (error) {
        trace.qualityFailureRules = [...trace.qualityFailureRules, "quality_repair_validation_failed"].slice(0, 12);
        trace.failedSections = [repairSection];
      }
    }
    filteredOutput = {
      ...filteredOutput,
      draft: composedDraft,
      quality,
      validationStatus: {
        ...validationResult,
        ...(tailoringRelevance ? { tailoringRelevance } : {}),
      },
    };
    if (tailoringRelevance) validationResult.tailoringRelevance = tailoringRelevance;
    if (!validationResult.valid) {
      trace.qualityFailureRules = Array.from(new Set([
        ...trace.qualityFailureRules,
        ...classifyClaimValidationFailures(validationResult.errors),
      ])).slice(0, 12);
      trace.failedSections = getQualityFailureSections(trace.qualityFailureRules);
    }
    if (!validationResult.valid || quality.needsRepair) {
      // The raw model response was cached before deterministic validation. A
      // rejected draft must never be reused on retry, otherwise the student is
      // trapped in the same quality-gate failure without a new generation.
      if (shouldRejectCachedDraft({ validationResult, quality }) && markAgentOutputCacheRejected(session, generationCacheKey)) {
        try {
          await session.save();
        } catch (error) {
          throw buildAgentStageError("cache_invalidation", error, trace);
        }
      }
      filteredOutput = {
        ...filteredOutput,
        status: "cannot_continue",
        message: "تعذر التحقق من جودة المسودة هذه المرة. يمكنك المحاولة مرة أخرى دون فقد إجابتك.",
        warnings: ["quality_validation_failed", ...(filteredOutput.warnings || []), ...validationResult.errors, ...quality.errors].slice(0, 20),
        pendingDraftId: "",
      };
      persistQualityDiagnostics(session, trace, "quality_validation_failed");
    } else {
      try {
        filteredOutput.pendingDraftId = await persistProfessionalDraft({
          context,
          draft: composedDraft,
          sourceMap,
          validationResult,
          changesSummary: filteredOutput.changesSummary,
          applicationPack: filteredOutput.applicationPack,
        });
        trace.saveCompleted = true;
      } catch (error) {
        throw buildAgentStageError("draft_persistence", error, trace);
      }
    }
  }
  const usage = result
    ? summarizeRunUsage(result, startedAt)
    : {
        model: session.usage?.model || "",
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        durationMs: Date.now() - startedAt,
        toolsUsed: [],
        turns: 0,
        toolCalls: 0,
        reusedModelOutput: true,
      };
  return {
    output: withStableQuestionKeys(filteredOutput),
    lastResponseId: result?.lastResponseId || session.lastResponseId || "",
    usage: {
      ...usage,
      aiCalls: trace.aiCalls,
      initialGenerationSucceeded: trace.initialGenerationSucceeded,
      repairAttempted: trace.repairAttempted,
      repairSucceeded: trace.repairSucceeded,
      cachedDraftUsed: trace.reusedModelOutput,
      generationId: trace.generationId,
      qualityFailureRules: trace.qualityFailureRules,
      failedSections: trace.failedSections,
    },
  };
};

module.exports = {
  PENDING_DRAFT_TTL_MS,
  resumeAgentOutputSchema,
  collectFacts,
  filterConfirmedQuestions,
  ensureActionableNeedsInformation,
  normalizeNeedsInformationOutput,
  getQuestionFieldKey,
  isDeferredTailorQuestion,
  buildGenerationCacheKey,
  getAccessQuery,
  getReusableDraftOutput,
  markAgentOutputCacheRejected,
  shouldRejectCachedDraft,
  classifyClaimValidationFailures,
  persistQualityDiagnostics,
  buildAgentStageError,
  getRepairSectionForQuality,
  mergeQualityRepair,
  buildQualityRepairInput,
  createAgentInstructions,
  runDarbakResumeAgent,
  validateResumeClaims,
  getTailoringEligibilityWarnings,
  getTailoringRelevanceStrength,
};
