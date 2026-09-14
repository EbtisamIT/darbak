const crypto = require("crypto");

const ALLOWED_SECTIONS = new Set(["experience", "projects", "certifications", "volunteering"]);
const ALLOWED_FIELDS = new Set(["title", "organization", "description", "achievement"]);
const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]{1,120}$/;
const ARABIC_PATTERN = /[\u0600-\u06FF]/;

const hashLocalizationSource = (value = "") =>
  crypto.createHash("sha256").update(String(value || "").trim()).digest("hex").slice(0, 16);

const getTranslationIdForReviewItem = (item = {}) =>
  item.field === "achievement"
    ? `${item.section}:${item.entryId}:achievement:${item.achievementId || item.index || ""}`
    : `${item.section}:${item.entryId}:${item.field}`;

const getReviewKeyForItem = (item = {}) =>
  item.field === "achievement"
    ? `achievements:${item.section}:${item.entryId}:${item.achievementId || item.index || ""}`
    : `entries:${item.section}:${item.entryId}:${item.field}`;

const buildEnglishLocalizationApprovalUpdate = ({
  versionPayload = {},
  groupKey = "",
  items = [],
  now = new Date(),
} = {}) => {
  if (!/^groups:(experience|projects|certifications|volunteering):[A-Za-z0-9_-]{1,120}$/.test(groupKey)) {
    const error = new Error("مفتاح الاعتماد غير صالح.");
    error.code = "INVALID_LOCALIZATION_KEY";
    throw error;
  }
  if (!Array.isArray(items) || !items.length || items.length > 20) {
    const error = new Error("لا توجد ترجمة صالحة للاعتماد.");
    error.code = "INVALID_LOCALIZATION_ITEMS";
    throw error;
  }

  const sourceHashes = versionPayload.localizedDisplay?.sourceHashes || {};
  const set = {};
  const records = {};
  items.forEach((item) => {
    const section = String(item.section || "");
    const entryId = String(item.entryId || "");
    const field = String(item.field || "");
    const targetText = String(item.targetText || "").trim();
    const sourceText = String(item.sourceText || "").trim();
    if (!ALLOWED_SECTIONS.has(section) || !ALLOWED_FIELDS.has(field) || !SAFE_ID_PATTERN.test(entryId)) {
      const error = new Error("بيانات عنصر الترجمة غير صالحة.");
      error.code = "INVALID_LOCALIZATION_ITEM";
      throw error;
    }
    if (!targetText || ARABIC_PATTERN.test(targetText)) {
      const error = new Error("أدخل قيمة إنجليزية صالحة قبل الاعتماد.");
      error.code = "INVALID_LOCALIZATION_TARGET";
      throw error;
    }

    const translationId = getTranslationIdForReviewItem(item);
    const sourceHash = hashLocalizationSource(sourceText);
    const expectedHash = sourceHashes[translationId];
    if (expectedHash && expectedHash !== sourceHash) {
      const error = new Error("تغير النص العربي لهذا العنصر. حدّث النسخة الإنجليزية أولًا.");
      error.code = "STALE_LOCALIZATION_SOURCE";
      throw error;
    }

    const reviewKey = getReviewKeyForItem(item);
    const record = {
      key: reviewKey,
      itemId: entryId,
      field,
      sourceText,
      sourceHash: expectedHash || sourceHash,
      targetText,
      status: "approved",
      approved: true,
      approvedByUser: true,
      updatedAt: now,
    };
    records[reviewKey] = record;
    set[`resumePayload.localizedDisplay.review.${reviewKey}`] = record;
    if (field === "achievement") {
      const achievementId = String(item.achievementId || item.index || "");
      if (!SAFE_ID_PATTERN.test(achievementId)) {
        const error = new Error("معرف نقطة الترجمة غير صالح.");
        error.code = "INVALID_LOCALIZATION_ITEM";
        throw error;
      }
      set[`resumePayload.localizedDisplay.achievements.${section}:${entryId}:${achievementId}`] = targetText;
    } else {
      set[`resumePayload.localizedDisplay.entries.${section}:${entryId}.${field}`] = targetText;
    }
  });

  return { set, records };
};

module.exports = {
  buildEnglishLocalizationApprovalUpdate,
  getReviewKeyForItem,
  getTranslationIdForReviewItem,
  hashLocalizationSource,
};
