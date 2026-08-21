const OpenAI = require("openai");
const { zodTextFormat } = require("openai/helpers/zod");
const { z } = require("zod");

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

const resumeDraftSchema = z
  .object({
    targetTitle: shortString(160),
    professionalSummary: shortString(900),
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

const translatedResumePayloadSchema = z
  .object({
    personalInfo: z
      .object({
        fullName: shortString(180),
        email: shortString(180),
        phone: shortString(80),
        city: shortString(120),
        major: shortString(180),
        university: shortString(180),
        headline: shortString(180),
        linkedinUrl: shortString(260),
        portfolioUrl: shortString(260),
        githubUrl: shortString(260),
        personalUrl: shortString(260),
      })
      .strict(),
    summary: shortString(1200),
    education: z.array(resumeEntryPayloadSchema).max(10).default([]),
    experience: z.array(resumeEntryPayloadSchema).max(10).default([]),
    experiences: z.array(resumeEntryPayloadSchema).max(10).default([]),
    projects: z.array(resumeEntryPayloadSchema).max(10).default([]),
    certifications: z.array(resumeEntryPayloadSchema).max(12).default([]),
    volunteering: z.array(resumeEntryPayloadSchema).max(10).default([]),
    languages: z
      .array(
        z
          .object({
            id: shortString(100),
            name: shortString(80),
            level: shortString(80),
          })
          .strict()
      )
      .max(8)
      .default([]),
    links: z.array(z.any()).max(0).default([]),
    skills: z.array(z.string().max(80)).max(40).default([]),
    sectionOrder: z.array(z.string().max(80)).max(12).default([]),
    hiddenSections: z.array(z.string().max(80)).max(12).default([]),
    settings: z
      .object({
        language: z.literal("en").default("en"),
        direction: z.literal("ltr").default("ltr"),
        density: z.enum(["comfortable", "compact"]).default("comfortable"),
        fontSize: z.enum(["small", "medium", "large"]).default("medium"),
        accentColor: shortString(20).default("#42cfc3"),
      })
      .strict(),
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
  if (!parsed) {
    const error = new Error("لم يكتمل توليد المسودة بشكل صحيح.");
    error.code = "OPENAI_PARSE_EMPTY";
    throw error;
  }
  return schema.parse(parsed);
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
      ...(safetyIdentifier ? { safety_identifier: safety_identifier } : {}),
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

const translateResumeToEnglish = async ({ resume, userKey }) =>
  createJsonObjectResponse({
    // Keep translation on the model already verified for the Resume Agent unless a
    // dedicated lightweight model was intentionally configured.
    model:
      process.env.OPENAI_RESUME_AGENT_MODEL ||
      process.env.OPENAI_RESUME_LIGHT_MODEL ||
      DEFAULT_RESUME_MODEL,
    schema: translatedResumePayloadSchema,
    schemaName: "darbak_resume_translate_en",
    safetyIdentifier: userKey,
    // Translation can be longer than the Arabic source; leave enough room for a
    // full two-page resume rather than returning an incomplete response.
    maxOutputTokens: 12000,
    input: `أعد النتيجة بصيغة JSON صحيحة فقط. ترجم السيرة التالية إلى الإنجليزية المهنية المناسبة للتدريب التعاوني فقط.

قواعد صارمة:
- لا تضف أي خبرة أو مهارة أو رقم أو جهة غير موجودة.
- لا تغيّر التواريخ أو البريد أو الهاتف.
- لا تضف روابط داخل السيرة. links يجب أن تكون [].
- حافظ على نفس ترتيب الأقسام والعناصر.
- حوّل النقاط إلى صياغة محايدة احترافية بدون ضمير المتكلم.
- اضبط settings.language="en" و settings.direction="ltr".

${safeJsonInput({ resume })}`,
  });

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

const mapDraftToResumePayload = (draft = {}, baseResume = {}, rawInput = {}, language = "ar") => {
  const personal = rawInput?.basic || rawInput?.personalInfo || {};
  const educationRaw = rawInput?.education || {};
  const resumeLanguage = language === "en" ? "en" : "ar";

  return {
    personalInfo: {
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
      linkedinUrl: personal.linkedinUrl || baseResume.personalInfo?.linkedinUrl || "",
      githubUrl: personal.githubUrl || baseResume.personalInfo?.githubUrl || "",
      portfolioUrl: personal.portfolioUrl || baseResume.personalInfo?.portfolioUrl || "",
      personalUrl: personal.personalUrl || baseResume.personalInfo?.personalUrl || "",
      headline: draft.targetTitle || personal.targetTitle || baseResume.personalInfo?.headline || "",
    },
    summary: draft.professionalSummary || baseResume.summary || "",
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
    skills: (draft.skills || []).map((skill) => skill.name).filter(Boolean),
    settings: {
      language: resumeLanguage,
      direction: resumeLanguage === "en" ? "ltr" : "rtl",
      density: baseResume.settings?.density || "comfortable",
      fontSize: baseResume.settings?.fontSize || "medium",
      accentColor: baseResume.settings?.accentColor || "#42cfc3",
    },
  };
};

module.exports = {
  DEFAULT_LIGHT_MODEL,
  DEFAULT_RESUME_MODEL,
  generateResumeDraft,
  mapDraftToResumePayload,
  resumeDraftSchema,
  rewriteResumeSection,
  tailorResumeToOpportunity,
  translateResumeToEnglish,
  tailoredResumeDraftSchema,
};
