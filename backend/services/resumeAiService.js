const OpenAI = require("openai");
const { zodTextFormat } = require("openai/helpers/zod");
const { z } = require("zod");
const { normalizeResumeSkills } = require("./resumeSkillNormalization");

const DEFAULT_RESUME_MODEL = "gpt-5.6-terra";
const DEFAULT_LIGHT_MODEL = "gpt-5.6-luna";
const MAX_INPUT_CHARS = 18000;

const shortString = (max = 240) => z.string().max(max).default("");
const stringList = (maxItems = 12, maxLength = 220) =>
  z.array(z.string().max(maxLength)).max(maxItems).default([]);

const educationSchema = z
  .object({
    sourceId: shortString(80),
    title: shortString(160),
    organization: shortString(180),
    degree: shortString(120),
    major: shortString(160),
    dates: shortString(100),
    location: shortString(100),
    details: shortString(700),
    bullets: stringList(4, 260),
  })
  .strict();

const experienceSchema = z
  .object({
    sourceId: shortString(80),
    title: shortString(160),
    organization: shortString(180),
    dates: shortString(100),
    location: shortString(100),
    bullets: stringList(4, 300),
  })
  .strict();

const projectSchema = z
  .object({
    sourceId: shortString(80),
    name: shortString(180),
    description: shortString(700),
    technologies: stringList(12, 80),
    bullets: stringList(4, 300),
    url: shortString(260),
  })
  .strict();

const skillSchema = z
  .object({
    name: shortString(80),
    evidenceSourceId: shortString(80),
  })
  .strict();

const certificationSchema = z
  .object({
    sourceId: shortString(80),
    name: shortString(180),
    issuer: shortString(160),
    date: shortString(80),
    details: shortString(500),
  })
  .strict();

const volunteeringSchema = z
  .object({
    sourceId: shortString(80),
    title: shortString(160),
    organization: shortString(180),
    dates: shortString(100),
    location: shortString(100),
    bullets: stringList(4, 280),
  })
  .strict();

const languageSchema = z
  .object({
    name: shortString(80),
    level: shortString(80),
  })
  .strict();

const questionSchema = z
  .object({
    section: shortString(80),
    question: shortString(260),
  })
  .strict();

const editorialCheckSchema = z
  .object({
    concise: z.boolean().default(false),
    noRepeatedIdeas: z.boolean().default(false),
    naturalArabic: z.boolean().default(false),
    evidenceBased: z.boolean().default(false),
    noUnnecessaryToolListing: z.boolean().default(false),
  })
  .strict()
  .default({
    concise: false,
    noRepeatedIdeas: false,
    naturalArabic: false,
    evidenceBased: false,
    noUnnecessaryToolListing: false,
  });

const resumeDraftSchema = z
  .object({
    targetTitle: shortString(160),
    professionalSummary: shortString(900),
    editorialCheck: editorialCheckSchema,
    education: z.array(educationSchema).max(6).default([]),
    experiences: z.array(experienceSchema).max(8).default([]),
    projects: z.array(projectSchema).max(8).default([]),
    skills: z.array(skillSchema).max(30).default([]),
    certifications: z.array(certificationSchema).max(10).default([]),
    volunteering: z.array(volunteeringSchema).max(8).default([]),
    languages: z.array(languageSchema).max(8).default([]),
    missingInformation: z.array(questionSchema).max(12).default([]),
    warnings: z.array(z.string().max(280)).max(10).default([]),
  })
  .strict();

const tailoredResumeDraftSchema = resumeDraftSchema
  .extend({
    missingRequirements: z
      .array(
        z
          .object({
            requirement: shortString(180),
            note: shortString(260),
          })
          .strict()
      )
      .max(12)
      .default([]),
  })
  .strict();

const rewriteSectionSchema = z
  .object({
    sectionKey: shortString(80),
    title: shortString(180),
    content: shortString(1200),
    bullets: stringList(6, 280),
    missingInformation: z.array(questionSchema).max(6).default([]),
    warnings: z.array(z.string().max(280)).max(6).default([]),
  })
  .strict();

const resumeEntryPayloadSchema = z
  .object({
    id: shortString(100),
    title: shortString(180),
    subtitle: shortString(180),
    organization: shortString(180),
    period: shortString(120),
    startDate: shortString(80),
    endDate: shortString(80),
    isCurrent: z.boolean().default(false),
    location: shortString(120),
    url: shortString(260),
    description: shortString(800),
    details: shortString(800),
    achievements: z
      .array(
        z
          .object({
            id: shortString(100),
            text: shortString(320),
            html: shortString(500),
          })
          .strict()
      )
      .max(8)
      .default([]),
  })
  .strict();

// Translation deliberately asks the model for short text replacements only.
// Resume structure, IDs, dates and contact data remain entirely server-owned.
const resumeTextTranslationSchema = z
  .object({
    translations: z
      .array(
        z
          .object({
            id: shortString(180),
            text: shortString(1600),
          })
          .strict()
      )
      .max(240)
      .default([]),
  })
  .strict();

const SYSTEM_PROMPT = `أنت كاتب سير ذاتية متخصص في طلاب الجامعات والخريجين الجدد والمتقدمين للتدريب التعاوني في السعودية.

حوّل المعلومات الخام إلى محتوى سيرة ذاتية مهني، مختصر وطبيعي ومتوافق مع ATS.

التزم بالقواعد التالية:

* استخدم فقط الحقائق التي قدمها المستخدم.
* لا تخترع مهارة أو خبرة أو أداة أو شهادة أو رقمًا أو نتيجة.
* لا تغير الاسم أو التواريخ أو الجهات أو التخصص.
* إذا كانت معلومة مهمة ناقصة، ضع سؤالًا داخل missingInformation بدل اختراعها.
* اكتب نبذة من سطرين إلى أربعة أسطر.
* اجعل كل خبرة أو مشروع يحتوي على نقطتين إلى أربع نقاط قوية.
* ابدأ النقاط بأفعال واضحة.
* لا تستخدم ضمير المتكلم.
* لا تستخدم عبارات عامة مثل مجتهد وشغوف وسريع التعلم بدون دليل.
* لا تقترح مهارة إلا إذا ظهرت في خبرة أو مشروع أو معلومة قدمها المستخدم.
* لا تضف نسبًا أو أرقامًا تقريبية.
* حافظ على لغة السيرة المطلوبة.
* في الإنجليزية استخدم لغة مهنية طبيعية وليست ترجمة حرفية.
* اجعل الناتج مناسبًا لطالب أو خريج جديد، ولا تبالغ في مستوى الخبرة.
* إذا لم توجد خبرة، أبرز المشاريع والتعليم والأنشطة بدل اختراع خبرة.`;

const getClient = () => {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error("OPENAI_API_KEY is missing");
    error.code = "OPENAI_KEY_MISSING";
    throw error;
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: Number(process.env.OPENAI_RESUME_TIMEOUT_MS || 45000),
  });
};

const truncateForModel = (value = "") =>
  value.toString().slice(0, MAX_INPUT_CHARS);

const safeJsonInput = (payload = {}) => truncateForModel(JSON.stringify(payload, null, 2));

const getUsage = (response = {}) => ({
  inputTokens: Number(response.usage?.input_tokens || response.usage?.prompt_tokens || 0),
  outputTokens: Number(response.usage?.output_tokens || response.usage?.completion_tokens || 0),
  totalTokens: Number(response.usage?.total_tokens || 0),
});

const parseAiResponse = (response = {}, schema) => {
  const parsed = response.output_parsed;
  if (parsed) return schema.parse(parsed);

  // Some compatible Responses API models return the structured JSON as text while
  // leaving output_parsed empty. Accept that valid JSON instead of failing a usable
  // translation solely because the SDK did not hydrate output_parsed.
  return parseJsonObjectOutput(response, schema);
};

const parseJsonObjectOutput = (response = {}, schema) => {
  const fallbackOutput = (Array.isArray(response.output) ? response.output : [])
    .flatMap((item) => (Array.isArray(item?.content) ? item.content : []))
    .map((content) => content?.text || content?.value || "")
    .filter(Boolean)
    .join("\n");
  const rawOutput = (response.output_text || fallbackOutput || "").trim();
  if (!rawOutput) {
    const error = new Error("لم يرجع النموذج محتوى قابلًا للقراءة.");
    error.code = "OPENAI_PARSE_EMPTY";
    error.responseStatus = response.status || "";
    error.incompleteReason = response.incomplete_details?.reason || "";
    throw error;
  }

  // JSON mode should return an object, but tolerate a fenced response if a model adds one.
  const normalized = rawOutput
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    return schema.parse(JSON.parse(normalized));
  } catch (cause) {
    const error = new Error("لم تكتمل ترجمة السيرة بصيغة صالحة.");
    error.code = "OPENAI_PARSE_EMPTY";
    error.cause = cause;
    error.responseStatus = response.status || "";
    error.incompleteReason = response.incomplete_details?.reason || "";
    throw error;
  }
};

const createStructuredResponse = async ({
  model,
  schema,
  schemaName,
  input,
  instructions = SYSTEM_PROMPT,
  maxOutputTokens = 5500,
  safetyIdentifier = "",
}) => {
  const client = getClient();
  let response;
  try {
    response = await client.responses.parse({
      model,
      instructions,
      input,
      text: {
        format: zodTextFormat(schema, schemaName),
      },
      max_output_tokens: maxOutputTokens,
      store: false,
      ...(safetyIdentifier ? { safety_identifier: safetyIdentifier } : {}),
    });
  } catch (error) {
    error.resumeAiModel = model;
    throw error;
  }

  return {
    data: parseAiResponse(response, schema),
    usage: getUsage(response),
    responseId: response.id || "",
    model: response.model || model,
  };
};

const createJsonObjectResponse = async ({
  model,
  schema,
  input,
  instructions = SYSTEM_PROMPT,
  maxOutputTokens = 5500,
  safetyIdentifier = "",
}) => {
  const client = getClient();
  let response;

  try {
    response = await client.responses.create({
      model,
      instructions: `${instructions}\n\nأعد JSON فقط دون Markdown أو شرح خارج JSON. يجب أن يحتوي الناتج على جميع حقول السيرة المطلوبة، واستخدم قيمًا فارغة أو مصفوفات فارغة عند غياب البيانات.`,
      input,
      text: { format: { type: "json_object" } },
      max_output_tokens: maxOutputTokens,
      store: false,
      ...(safetyIdentifier ? { safety_identifier: safetyIdentifier } : {}),
    });
  } catch (error) {
    error.resumeAiModel = model;
    throw error;
  }

  return {
    data: parseJsonObjectOutput(response, schema),
    usage: getUsage(response),
    responseId: response.id || "",
    model: response.model || model,
  };
};

const generateResumeDraft = async ({ rawInput, portfolio, language, targetTitle, userKey }) =>
  createStructuredResponse({
    model: process.env.OPENAI_RESUME_MODEL || DEFAULT_RESUME_MODEL,
    schema: resumeDraftSchema,
    schemaName: "darbak_resume_draft",
    safetyIdentifier: userKey,
    input: `أنشئ مسودة سيرة ذاتية منظمة من البيانات التالية فقط. لا تضف أي معلومة غير موجودة.\n\n${safeJsonInput({
      language,
      targetTitle,
      rawInput,
      portfolio,
    })}`,
  });

const rewriteResumeSection = async ({ sectionKey, currentSection, rawFacts, language, userKey }) =>
  createStructuredResponse({
    model: process.env.OPENAI_RESUME_LIGHT_MODEL || DEFAULT_LIGHT_MODEL,
    schema: rewriteSectionSchema,
    schemaName: "darbak_resume_section_rewrite",
    safetyIdentifier: userKey,
    maxOutputTokens: 2200,
    input: `أعد صياغة قسم واحد فقط من السيرة. لا تغير بقية السيرة ولا تضف حقائق جديدة.\n\n${safeJsonInput({
      language,
      sectionKey,
      currentSection,
      rawFacts,
    })}`,
  });

const tailorResumeToOpportunity = async ({ resume, opportunity, language, userKey }) =>
  createStructuredResponse({
    model: process.env.OPENAI_RESUME_MODEL || DEFAULT_RESUME_MODEL,
    schema: tailoredResumeDraftSchema,
    schemaName: "darbak_tailored_resume",
    safetyIdentifier: userKey,
    input: `خصص نسخة جديدة من السيرة لفرصة تدريب محددة. لا تعدل السيرة الأساسية في قاعدة البيانات ولا تضف مهارات غير مذكورة في بيانات الطالب. أعد missingRequirements لما تطلبه الفرصة ولا يظهر في بيانات الطالب.\n\n${safeJsonInput({
      language,
      resume,
      opportunity,
    })}`,
  });

const cloneResumePayload = (resume = {}) => JSON.parse(JSON.stringify(resume || {}));

const getResumeEntries = (resume = {}, section) => {
  if (section === "experience") {
    if (Array.isArray(resume.experience) && resume.experience.length) return resume.experience;
    if (Array.isArray(resume.experiences)) return resume.experiences;
    return Array.isArray(resume.experience) ? resume.experience : [];
  }
  return Array.isArray(resume[section]) ? resume[section] : [];
};

const collectResumeTextForTranslation = (resume = {}) => {
  const items = [];
  const add = (id, text, target) => {
    const cleanText = typeof text === "string" ? text.trim() : "";
    if (cleanText) items.push({ id, text: cleanText, target });
  };

  add("summary", resume.summary, { kind: "root", key: "summary" });
  ["education", "experience", "projects", "certifications", "volunteering"].forEach(
    (section) => {
      getResumeEntries(resume, section).forEach((entry, index) => {
        const entryId = entry?.id || `${section}-${index}`;
        ["description"].forEach((key) => {
          const text = key === "description" ? entry.description || entry.details : entry[key];
          add(`${section}:${entryId}:${key}`, text, { kind: "entry", section, entryId, key });
        });
        (Array.isArray(entry?.achievements) ? entry.achievements : []).forEach((achievement, bulletIndex) => {
          const bulletId = achievement?.id || `${bulletIndex}`;
          add(`${section}:${entryId}:achievement:${bulletId}`, achievement?.text, {
            kind: "achievement",
            section,
            entryId,
            bulletId,
          });
        });
      });
    }
  );

  return items;
};

const translationStructure = (resume = {}) => ({
  personalInfo: resume.personalInfo || {},
  skills: Array.isArray(resume.skills) ? resume.skills : [],
  languages: Array.isArray(resume.languages) ? resume.languages : [],
  entries: ["education", "experience", "projects", "certifications", "volunteering"].map(
    (section) =>
      getResumeEntries(resume, section).map((entry) => ({
        id: entry?.id || "",
        title: entry?.title || "",
        subtitle: entry?.subtitle || "",
        organization: entry?.organization || "",
        period: entry?.period || "",
        startDate: entry?.startDate || "",
        endDate: entry?.endDate || "",
        location: entry?.location || "",
        url: entry?.url || "",
      }))
  ),
});

const assertTranslationIntegrity = (source, translated) => {
  if (JSON.stringify(translationStructure(source)) !== JSON.stringify(translationStructure(translated))) {
    const error = new Error("تعذر التحقق من ثبات حقائق السيرة أثناء الترجمة.");
    error.code = "RESUME_TRANSLATION_FACTS_CHANGED";
    throw error;
  }
};

const assertEnglishSummaryIntegrity = (resume = {}) => {
  const summary = String(resume.summary || "").trim();
  const status = resume.personalInfo?.studentStatus || "";
  if (/[؀-ۿ]/.test(summary) ||
    (status === "graduate" && /\bstudent\b/i.test(summary)) ||
    (status === "student" && /\bgraduate\b/i.test(summary))) {
    const error = new Error("تعذر التحقق من اتساق نبذة النسخة الإنجليزية.");
    error.code = "RESUME_TRANSLATION_SUMMARY_INVALID";
    throw error;
  }
};

const escapeResumeHtml = (text = "") =>
  text
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const applyResumeTranslations = (resume, items, translations) => {
  const translatedResume = cloneResumePayload(resume);
  const replacements = new Map(
    (Array.isArray(translations) ? translations : [])
      .filter((item) => item?.id && typeof item.text === "string" && item.text.trim())
      .map((item) => [item.id, item.text.trim()])
  );
  let appliedCount = 0;

  items.forEach((item) => {
    const text = replacements.get(item.id);
    if (!text) return;
    const target = item.target;
    if (target.kind === "root") {
      translatedResume[target.key] = text;
    } else if (target.kind === "personal") {
      translatedResume.personalInfo = { ...(translatedResume.personalInfo || {}), [target.key]: text };
    } else if (target.kind === "entry" || target.kind === "achievement") {
      const entries = getResumeEntries(translatedResume, target.section);
      const entry = entries.find((candidate) => candidate?.id === target.entryId);
      if (!entry) return;
      if (target.kind === "entry") {
        entry[target.key] = text;
        if (target.key === "description") entry.details = text;
      } else {
        const achievement = (entry.achievements || []).find(
          (candidate, index) => (candidate?.id || `${index}`) === target.bulletId
        );
        if (!achievement) return;
        achievement.text = text;
        achievement.html = `<p>${escapeResumeHtml(text)}</p>`;
      }
    } else if (target.kind === "skill") {
      if (typeof translatedResume.skills?.[target.index] === "string") {
        translatedResume.skills[target.index] = text;
      } else if (translatedResume.skills?.[target.index]) {
        translatedResume.skills[target.index].name = text;
      }
    } else if (target.kind === "languageString") {
      translatedResume.languages[target.index] = text;
    } else if (target.kind === "language" && translatedResume.languages?.[target.index]) {
      translatedResume.languages[target.index][target.key] = text;
    } else {
      return;
    }
    appliedCount += 1;
  });

  // The editor uses both keys for historical data; retain the same translated values in each.
  translatedResume.experiences = cloneResumePayload(getResumeEntries(translatedResume, "experience"));
  translatedResume.experience = cloneResumePayload(getResumeEntries(translatedResume, "experience"));
  translatedResume.links = [];
  translatedResume.settings = {
    ...(translatedResume.settings || {}),
    language: "en",
    direction: "ltr",
  };

  return { resume: translatedResume, appliedCount };
};

const translateResumeToEnglish = async ({ resume, userKey }) => {
  const translationItems = collectResumeTextForTranslation(resume);
  if (!translationItems.length) {
    const error = new Error("أضف بعض محتوى السيرة أولًا حتى نجهز النسخة الإنجليزية.");
    error.code = "RESUME_TRANSLATION_EMPTY";
    throw error;
  }

  const result = await createStructuredResponse({
    model:
      process.env.OPENAI_RESUME_AGENT_MODEL ||
      process.env.OPENAI_RESUME_LIGHT_MODEL ||
      DEFAULT_RESUME_MODEL,
    schema: resumeTextTranslationSchema,
    schemaName: "darbak_resume_text_translation_en",
    safetyIdentifier: userKey,
    maxOutputTokens: Math.min(9000, Math.max(1800, translationItems.length * 70)),
    instructions: `${SYSTEM_PROMPT}

You translate only the provided resume text snippets into formal, practical, error-free English suitable for internship applications. Return JSON containing only translations. Keep technical product names and recognized tools such as React, Figma, Java, and Power BI unchanged when appropriate. Do not add facts, skills, achievements, numbers, employers, dates, or links.`,
    input: `Translate every text item below. Return the same id for each translation and no new ids. This is a JSON translation task.\n\n${safeJsonInput({ items: translationItems.map(({ id, text }) => ({ id, text })) })}`,
  });

  const merged = applyResumeTranslations(resume, translationItems, result.data.translations);
  if (!merged.appliedCount) {
    const error = new Error("لم تكتمل ترجمة النصوص المطلوبة.");
    error.code = "OPENAI_PARSE_EMPTY";
    throw error;
  }
  assertTranslationIntegrity(resume, merged.resume);
  assertEnglishSummaryIntegrity(merged.resume);

  return { ...result, data: merged.resume, translatedCount: merged.appliedCount };
};

const createAchievementItems = (bullets = [], prefix = "ai") =>
  (Array.isArray(bullets) ? bullets : [])
    .filter(Boolean)
    .slice(0, 6)
    .map((text, index) => {
      const cleanText = text.toString().trim();
      return {
        id: `${prefix}-bullet-${index + 1}`,
        text: cleanText,
        html: `<p>${cleanText
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;")}</p>`,
      };
    });

const normalizePresentationKey = (value = "") =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ");

// Tailoring may change emphasis, but it may only reorder entries that already
// exist in the master resume. Unknown draft items stay out of the version.
const orderMasterEntries = (masterEntries = [], draftEntries = []) => {
  const preferredIds = (draftEntries || [])
    .map((entry) => normalizePresentationKey(entry?.sourceId))
    .filter(Boolean);
  if (!preferredIds.length) return masterEntries;

  const rank = new Map(preferredIds.map((id, index) => [id, index]));
  return [...masterEntries].sort((left, right) => {
    const leftRank = rank.get(normalizePresentationKey(left?.id));
    const rightRank = rank.get(normalizePresentationKey(right?.id));
    return (leftRank ?? Number.MAX_SAFE_INTEGER) - (rightRank ?? Number.MAX_SAFE_INTEGER);
  });
};

const orderMasterSkills = (masterSkills = [], draftSkills = []) => {
  const preferredSkills = (draftSkills || [])
    .map((skill) => normalizePresentationKey(skill?.name))
    .filter(Boolean);
  if (!preferredSkills.length) return masterSkills;

  const rank = new Map(preferredSkills.map((name, index) => [name, index]));
  return [...masterSkills].sort((left, right) => {
    const leftName = normalizePresentationKey(typeof left === "string" ? left : left?.name);
    const rightName = normalizePresentationKey(typeof right === "string" ? right : right?.name);
    return (rank.get(leftName) ?? Number.MAX_SAFE_INTEGER) - (rank.get(rightName) ?? Number.MAX_SAFE_INTEGER);
  });
};

const buildConfirmedHeadline = (personal = {}, language = "ar") => {
  const major = String(personal.major || "").trim();
  const status = personal.studentStatus;
  if (!major) return "";
  if (language === "en") {
    if (status === "graduate") return `${major} Graduate`;
    if (status === "student") return `${major} Student`;
    return `${major} Specialist`;
  }
  const feminine = personal.grammaticalGender === "feminine";
  const masculine = personal.grammaticalGender === "masculine";
  if (status === "graduate") return `${feminine ? "خريجة" : masculine ? "خريج" : "خريج/ة"} ${major}`;
  if (status === "student") return `${feminine ? "طالبة" : masculine ? "طالب" : "طالب/ة"} ${major}`;
  return `${feminine ? "متخصصة" : masculine ? "متخصص" : "متخصص/ة"} في ${major}`;
};

const buildFactGroundedSummary = ({ personal = {}, resume = {}, language = "ar" } = {}) => {
  const major = String(personal.major || "").trim();
  const degree = String(personal.degree || "").trim();
  const skills = normalizeResumeSkills(resume.skills || []).slice(0, 3);
  const project = (resume.projects || []).find((item) => item?.title || item?.name);
  const experience = (resume.experiences || resume.experience || []).find((item) => item?.title || item?.organization);
  const projectName = String(project?.title || project?.name || "").trim();
  const experienceName = String(experience?.title || "").trim();

  if (language === "en") {
    const identity = personal.studentStatus === "graduate"
      ? `Graduate in ${major}`
      : personal.studentStatus === "student"
        ? `Student of ${major}`
        : major ? `${major} professional` : "Early-career professional";
    return [
      identity,
      degree ? `with a ${degree} background.` : ".",
      skills.length ? `Skills include ${skills.join(", ")}.` : "",
      projectName ? `Project experience includes ${projectName}.` : experienceName ? `Experience includes ${experienceName}.` : "",
    ].join(" ").replace(/\s+\./g, ".").trim();
  }

  const identity = major ? `خلفية أكاديمية في ${major}` : "خلفية أكاديمية ومهنية";
  return [
    identity,
    degree ? `ضمن ${degree}.` : ".",
    skills.length ? `تشمل المهارات ${skills.join("، ")}.` : "",
    projectName ? `تتضمن الخبرات العملية مشروع ${projectName}.` : experienceName ? `تتضمن الخبرات العملية ${experienceName}.` : "",
  ].join(" ").replace(/\s+\./g, ".").trim();
};

const mapDraftToResumePayload = (draft = {}, baseResume = {}, rawInput = {}, language = "ar", options = {}) => {
  const personal = rawInput?.basic || rawInput?.personalInfo || {};
  const educationRaw = rawInput?.education || {};
  const resumeLanguage = language === "en" ? "en" : "ar";
  const approvedPresentationSummary = options.preserveIdentity ? "" : draft.professionalSummary;

  const personalInfo = {
    ...(baseResume.personalInfo || {}),
    fullName: personal.fullName || baseResume.personalInfo?.fullName || "",
    email: personal.email || baseResume.personalInfo?.email || "",
    phone: personal.phone || baseResume.personalInfo?.phone || "",
    city: personal.city || baseResume.personalInfo?.city || "",
    major: personal.major || baseResume.personalInfo?.major || "",
    university:
      personal.university ||
      educationRaw.university ||
      baseResume.personalInfo?.university ||
      "",
    degree: personal.degree || educationRaw.degree || baseResume.personalInfo?.degree || "",
    studentStatus: personal.studentStatus || baseResume.personalInfo?.studentStatus || "",
    grammaticalGender: personal.grammaticalGender || baseResume.personalInfo?.grammaticalGender || "",
    graduationYear: personal.graduationYear || educationRaw.graduationYear || baseResume.personalInfo?.graduationYear || "",
    gpa: personal.gpa || educationRaw.gpa || baseResume.personalInfo?.gpa || "",
    gpaScale: personal.gpaScale || educationRaw.gpaScale || baseResume.personalInfo?.gpaScale || "",
    linkedinUrl: personal.linkedinUrl || baseResume.personalInfo?.linkedinUrl || "",
    githubUrl: personal.githubUrl || baseResume.personalInfo?.githubUrl || "",
    portfolioUrl: personal.portfolioUrl || baseResume.personalInfo?.portfolioUrl || "",
    personalUrl: personal.personalUrl || baseResume.personalInfo?.personalUrl || "",
  };
  personalInfo.headline = buildConfirmedHeadline(personalInfo, resumeLanguage) || draft.targetTitle || personal.targetTitle || baseResume.personalInfo?.headline || "";

  const payload = {
    personalInfo: {
      ...personalInfo,
    },
    summary: "",
    education: (draft.education || []).map((item, index) => ({
      id: item.sourceId || `ai-education-${index + 1}`,
      title: item.degree || item.title || "",
      subtitle: item.major || "",
      organization: item.organization || "",
      period: item.dates || "",
      startDate: "",
      endDate: "",
      isCurrent: false,
      location: item.location || "",
      url: "",
      description: item.details || "",
      details: item.details || "",
      achievements: createAchievementItems(item.bullets, `ai-education-${index + 1}`),
    })),
    experiences: (draft.experiences || []).map((item, index) => ({
      id: item.sourceId || `ai-experience-${index + 1}`,
      title: item.title || "",
      subtitle: item.organization || "",
      organization: item.organization || "",
      period: item.dates || "",
      startDate: "",
      endDate: "",
      isCurrent: false,
      location: item.location || "",
      url: "",
      description: "",
      details: "",
      achievements: createAchievementItems(item.bullets, `ai-experience-${index + 1}`),
    })),
    experience: (draft.experiences || []).map((item, index) => ({
      id: item.sourceId || `ai-experience-${index + 1}`,
      title: item.title || "",
      subtitle: item.organization || "",
      organization: item.organization || "",
      period: item.dates || "",
      startDate: "",
      endDate: "",
      isCurrent: false,
      location: item.location || "",
      url: "",
      description: "",
      details: "",
      achievements: createAchievementItems(item.bullets, `ai-experience-${index + 1}`),
    })),
    projects: (draft.projects || []).map((item, index) => ({
      id: item.sourceId || `ai-project-${index + 1}`,
      title: item.name || "",
      subtitle: (item.technologies || []).join("، "),
      organization: "",
      period: "",
      startDate: "",
      endDate: "",
      isCurrent: false,
      location: "",
      url: item.url || "",
      description: item.description || "",
      details: item.description || "",
      achievements: createAchievementItems(item.bullets, `ai-project-${index + 1}`),
    })),
    certifications: (draft.certifications || []).map((item, index) => ({
      id: item.sourceId || `ai-cert-${index + 1}`,
      title: item.name || "",
      subtitle: item.issuer || "",
      organization: item.issuer || "",
      period: item.date || "",
      startDate: "",
      endDate: item.date || "",
      isCurrent: false,
      location: "",
      url: "",
      description: item.details || "",
      details: item.details || "",
      achievements: [],
    })),
    volunteering: (draft.volunteering || []).map((item, index) => ({
      id: item.sourceId || `ai-vol-${index + 1}`,
      title: item.title || "",
      subtitle: item.organization || "",
      organization: item.organization || "",
      period: item.dates || "",
      startDate: "",
      endDate: "",
      isCurrent: false,
      location: item.location || "",
      url: "",
      description: "",
      details: "",
      achievements: createAchievementItems(item.bullets, `ai-vol-${index + 1}`),
    })),
    languages: draft.languages || [],
    links: [],
    skills: normalizeResumeSkills((draft.skills || []).map((skill) => skill.name).filter(Boolean)),
    settings: {
      language: resumeLanguage,
      direction: resumeLanguage === "en" ? "ltr" : "rtl",
      density: baseResume.settings?.density || "comfortable",
      fontSize: baseResume.settings?.fontSize || "medium",
      accentColor: baseResume.settings?.accentColor || "#42cfc3",
    },
  };
  // An approved agent draft owns presentation wording. Facts remain
  // deterministic above, but never overwrite the reviewed summary with the
  // older fact-derived fallback during mapping or a later save.
  payload.summary = approvedPresentationSummary || buildFactGroundedSummary({ personal: payload.personalInfo, resume: payload, language: resumeLanguage }) || baseResume.summary || "";
  // A tailored resume is presentation-only: student identity and immutable
  // employment/education facts always come from the master resume.
  if (options.preserveIdentity) {
    payload.personalInfo = { ...(baseResume.personalInfo || {}) };
    payload.education = orderMasterEntries(baseResume.education || [], draft.education);
    payload.experiences = orderMasterEntries(baseResume.experiences || baseResume.experience || [], draft.experiences);
    payload.experience = payload.experiences;
    payload.projects = orderMasterEntries(baseResume.projects || [], draft.projects);
    payload.certifications = orderMasterEntries(baseResume.certifications || [], draft.certifications);
    payload.volunteering = orderMasterEntries(baseResume.volunteering || [], draft.volunteering);
    payload.skills = orderMasterSkills(baseResume.skills || [], draft.skills);
    payload.languages = baseResume.languages || [];
  }
  payload.skills = normalizeResumeSkills(payload.skills);
  payload.summary = approvedPresentationSummary || buildFactGroundedSummary({ personal: payload.personalInfo, resume: payload, language: resumeLanguage }) || payload.summary;
  return payload;
};

const comparablePresentationText = (value = "") =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();

const entryPresentationBullets = (entry = {}) =>
  (Array.isArray(entry?.achievements) ? entry.achievements : [])
    .map((achievement) => comparablePresentationText(achievement?.text || achievement?.html))
    .filter(Boolean);

const draftPresentationBullets = (entry = {}) =>
  (Array.isArray(entry?.bullets) ? entry.bullets : [])
    .map((bullet) => comparablePresentationText(bullet))
    .filter(Boolean);

const approvedDraftNeedsRematerialization = (draft = {}, resume = {}) => {
  const expectedSummary = comparablePresentationText(draft?.professionalSummary);
  if (expectedSummary && expectedSummary !== comparablePresentationText(resume?.summary)) return true;

  const resumeSections = {
    experiences: Array.isArray(resume?.experiences) ? resume.experiences : resume?.experience || [],
    projects: Array.isArray(resume?.projects) ? resume.projects : [],
  };

  return ["experiences", "projects"].some((section) =>
    (Array.isArray(draft?.[section]) ? draft[section] : []).some((draftEntry) => {
      const expectedBullets = draftPresentationBullets(draftEntry);
      if (!expectedBullets.length) return false;
      const sourceId = String(draftEntry?.sourceId || "").trim();
      const matchingEntry = resumeSections[section].find((entry) =>
        sourceId && String(entry?.id || "").trim() === sourceId
      );
      const persistedBullets = entryPresentationBullets(matchingEntry);
      return expectedBullets.some((bullet) => !persistedBullets.includes(bullet));
    })
  );
};

module.exports = {
  DEFAULT_LIGHT_MODEL,
  DEFAULT_RESUME_MODEL,
  generateResumeDraft,
  mapDraftToResumePayload,
  approvedDraftNeedsRematerialization,
  buildConfirmedHeadline,
  buildFactGroundedSummary,
  resumeDraftSchema,
  rewriteResumeSection,
  tailorResumeToOpportunity,
  translateResumeToEnglish,
  assertTranslationIntegrity,
  assertEnglishSummaryIntegrity,
  tailoredResumeDraftSchema,
};
