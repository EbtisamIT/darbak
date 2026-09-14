const { z } = require("zod");

const MAX_RESUME_TRANSLATIONS = 240;

const resumeTranslationItemSchema = z
  .object({
    id: z.string().min(1).max(180),
    text: z.string().min(1).max(1600),
  })
  .strict();

// This is the only structured-output contract used by Resume English
// localization. Runtime limits live in normal application constants; callers
// never inspect or modify Zod internals.
const resumeTextTranslationSchema = z
  .object({
    translations: z.array(resumeTranslationItemSchema).max(MAX_RESUME_TRANSLATIONS),
  })
  .strict();

const validateResumeTranslationCoverage = (requestedItems = [], response = {}) => {
  const parsed = resumeTextTranslationSchema.parse(response);
  if (requestedItems.length > MAX_RESUME_TRANSLATIONS) {
    const error = new Error("تجاوزت دفعة الترجمة الحد المسموح.");
    error.code = "RESUME_TRANSLATION_BATCH_TOO_LARGE";
    throw error;
  }

  const requestedIds = requestedItems.map((item) => String(item?.id || ""));
  const requestedSet = new Set(requestedIds);
  const responseById = new Map();
  const duplicateIds = new Set();
  const unexpectedIds = new Set();

  parsed.translations.forEach((item) => {
    if (!requestedSet.has(item.id)) unexpectedIds.add(item.id);
    if (responseById.has(item.id)) duplicateIds.add(item.id);
    responseById.set(item.id, item.text.trim());
  });

  const missingIds = requestedIds.filter((id) => !responseById.get(id));
  if (missingIds.length || duplicateIds.size || unexpectedIds.size) {
    const error = new Error("رجعت دفعة ترجمة غير مكتملة.");
    error.code = "RESUME_TRANSLATION_RESPONSE_INCOMPLETE";
    error.translationContractIssues = {
      missingIds,
      duplicateIds: [...duplicateIds],
      unexpectedIds: [...unexpectedIds],
    };
    throw error;
  }

  return requestedIds.map((id) => ({ id, text: responseById.get(id) }));
};

module.exports = {
  MAX_RESUME_TRANSLATIONS,
  resumeTextTranslationSchema,
  validateResumeTranslationCoverage,
};
