import React, { useEffect, useMemo, useState } from "react";
import { getEnglishReviewItems } from "./resumeLocalization";

const REVIEWABLE_SECTIONS = new Set(["experience", "projects", "certifications", "volunteering"]);

const sectionLabel = {
  experience: "خبرة",
  projects: "مشروع",
  certifications: "شهادة أو دورة",
  volunteering: "نشاط",
};

const reviewKeyForItem = (item) => {
  const entryKey = `${item.section}:${item.entryId}`;
  return item.field === "achievement"
    ? `achievements:${entryKey}:${item.achievementId || item.index}`
    : `entries:${entryKey}:${item.field}`;
};

const groupKeyForItem = (item) => `groups:${item.section}:${item.entryId}`;

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);

const reviewValueForItem = (item, values = {}) => String(
  hasOwn(values, item.fieldKey) ? values[item.fieldKey] : item.generatedValue || ""
).trim();

export const canApproveEnglishReviewGroup = (group, values = {}) =>
  Array.isArray(group?.items) && group.items.length > 0 &&
  group.items.every((item) => Boolean(reviewValueForItem(item, values)));

const groupItems = (items) => items.reduce((groups, item) => {
  if (!REVIEWABLE_SECTIONS.has(item.section) || !item.entryId) return groups;
  const key = groupKeyForItem(item);
  if (!groups[key]) {
    groups[key] = {
      key,
      section: item.section,
      entryId: item.entryId,
      label: sectionLabel[item.section] || "عنصر",
      items: [],
      status: "translated_pending_review",
    };
  }
  groups[key].items.push(item);
  if (item.localizationState === "missing_translation") groups[key].status = "missing_translation";
  else if (item.localizationState === "stale" && groups[key].status !== "missing_translation") {
    groups[key].status = "stale";
  }
  return groups;
}, {});

export const getEnglishReviewGroups = (resume = {}) => {
  return Object.values(groupItems(getEnglishReviewItems(resume)));
};

export const applyEnglishReviewGroup = (
  resume,
  group,
  values = {},
  status = "approved",
  persistedRecords = {},
) => {
  // Never record an empty approval. An empty generated value is a missing
  // translation and must be edited once, not returned as the same question.
  if (!canApproveEnglishReviewGroup(group, values)) return resume;

  const localizedDisplay = {
    ...(resume.localizedDisplay || {}),
    entries: { ...(resume.localizedDisplay?.entries || {}) },
    achievements: { ...(resume.localizedDisplay?.achievements || {}) },
    review: { ...(resume.localizedDisplay?.review || {}) },
    sourceHashes: { ...(resume.localizedDisplay?.sourceHashes || {}) },
    staleFields: [...(resume.localizedDisplay?.staleFields || [])],
  };

  group.items.forEach((item) => {
    const nextValue = reviewValueForItem(item, values);
    const entryKey = `${item.section}:${item.entryId}`;
    if (item.field === "achievement") {
      const achievementKey = `${entryKey}:${item.achievementId || item.index}`;
      localizedDisplay.achievements[achievementKey] = nextValue;
    } else {
      localizedDisplay.entries[entryKey] = {
        ...(localizedDisplay.entries[entryKey] || {}),
        [item.field]: nextValue,
      };
    }
    const reviewKey = reviewKeyForItem(item);
    const persistedRecord = persistedRecords[reviewKey] || {
      key: reviewKey,
      itemId: item.entryId,
      field: item.field,
      sourceText: item.value,
      targetText: nextValue,
      status: "approved",
      approved: true,
      approvedByUser: true,
      updatedAt: new Date().toISOString(),
    };
    localizedDisplay.review[reviewKey] = persistedRecord;
    const translationId = item.field === "achievement"
      ? `${item.section}:${item.entryId}:achievement:${item.achievementId || item.index || ""}`
      : `${item.section}:${item.entryId}:${item.field}`;
    if (persistedRecord.sourceHash) localizedDisplay.sourceHashes[translationId] = persistedRecord.sourceHash;
    localizedDisplay.staleFields = localizedDisplay.staleFields.filter((field) => field !== translationId);
  });

  localizedDisplay.review[group.key] = {
    approved: true,
    status,
    section: group.section,
    entryId: group.entryId,
    label: group.label,
    items: group.items,
  };

  return { ...resume, localizedDisplay };
};

const sourceText = (group) => group.items.map((item) => item.value).filter(Boolean).join("\n");
const translatedText = (group) => group.items.map((item) => item.generatedValue).filter(Boolean).join("\n");
const currentLocalizedValue = (resume, item) => {
  if (item.localizationState === "stale") return "";
  const entryKey = `${item.section}:${item.entryId}`;
  if (item.field === "achievement") {
    return resume.localizedDisplay?.achievements?.[`${entryKey}:${item.achievementId || item.index}`] || item.generatedValue || "";
  }
  return resume.localizedDisplay?.entries?.[entryKey]?.[item.field] || item.generatedValue || "";
};

const EnglishTranslationReview = ({ resume, onApproveGroup, onOpenEditor }) => {
  const groups = useMemo(() => getEnglishReviewGroups(resume), [resume]);
  const [editingKey, setEditingKey] = useState("");
  const [values, setValues] = useState({});
  const [activeKey, setActiveKey] = useState("");
  const [savingKey, setSavingKey] = useState("");
  const [saveError, setSaveError] = useState("");
  const pendingGroups = groups.filter((group) => group.status !== "approved");

  useEffect(() => {
    if (!activeKey || !groups.some((group) => group.key === activeKey && group.status !== "approved")) {
      setActiveKey(pendingGroups[0]?.key || "");
    }
  }, [activeKey, groups, pendingGroups]);

  const beginEdit = (group) => {
    setEditingKey(group.key);
    setValues(Object.fromEntries(group.items.map((item) => [
      item.fieldKey,
      currentLocalizedValue(resume, item),
    ])));
  };

  const approve = async (group, edited = false) => {
    if (savingKey) return;
    try {
      setSavingKey(group.key);
      setSaveError("");
      await onApproveGroup?.(group, values, edited ? "edited_and_approved" : "approved");
      setEditingKey("");
      const nextPending = groups.find((candidate) => candidate.status !== "approved" && candidate.key !== group.key);
      setActiveKey(nextPending?.key || "");
    } catch (error) {
      setSaveError(error?.response?.data?.error || "تعذر حفظ الاعتماد، حاول مرة أخرى.");
    } finally {
      setSavingKey("");
    }
  };

  if (!groups.length || !pendingGroups.length) {
    return (
      <section className="english-translation-review" dir="rtl">
        <header>
          <span>مراجعة النسخة الإنجليزية</span>
          <h2>اكتملت مراجعة النسخة الإنجليزية ✓</h2>
          <p>تم حفظ الترجمات المعتمدة، والنسخة جاهزة للفتح.</p>
        </header>
        <button type="button" className="english-review-primary" onClick={onOpenEditor}>حفظ وفتح النسخة الإنجليزية</button>
      </section>
    );
  }

  return (
    <section className="english-translation-review" dir="rtl">
      <header>
        <span>مراجعة النسخة الإنجليزية</span>
        <h2>راجع الترجمات التالية</h2>
        <p>دربك جهز الترجمة لك، راجعها واعتمدها أو عدّلها إذا احتجت.</p>
        <strong>باقي {pendingGroups.length} عناصر للمراجعة</strong>
      </header>
      {saveError && <p className="english-review-error">{saveError}</p>}
      <div className="english-review-list">
        {groups.map((group) => {
          const isEditing = editingKey === group.key;
          const isApproved = group.status === "approved";
          const needsManualTranslation = ["missing_translation", "stale"].includes(group.status);
          const canApprove = canApproveEnglishReviewGroup(group, isEditing ? values : {});
          return (
            <article key={group.key} className={`english-review-card${isApproved ? " is-approved" : ""}${activeKey === group.key ? " is-active" : ""}`}>
              <div className="english-review-card-head">
                <span>{group.label}</span>
                {isApproved && <b>تم الاعتماد ✓</b>}
              </div>
              {(!isApproved || isEditing) && <>
                <div className="english-review-copy">
                  <label>النص العربي<pre>{sourceText(group)}</pre></label>
                  <label>{needsManualTranslation ? "الترجمة الإنجليزية" : "الترجمة المقترحة"}<pre dir="ltr">{translatedText(group) || "لا توجد ترجمة إنجليزية محفوظة لهذا النص"}</pre></label>
                </div>
                {needsManualTranslation && !isEditing && (
                  <p className="english-review-helper">أضف الترجمة الإنجليزية لهذا العنصر.</p>
                )}
                {isEditing ? (
                  <div className="english-review-edit-fields">
                    {group.items.map((item) => (
                      <label key={item.fieldKey}>
                        {item.label}
                        <textarea
                          dir="ltr"
                          value={values[item.fieldKey] ?? ""}
                          onChange={(event) => setValues((current) => ({ ...current, [item.fieldKey]: event.target.value }))}
                        />
                      </label>
                    ))}
                    <button type="button" className="english-review-primary" disabled={!canApprove || savingKey === group.key} onClick={() => approve(group, true)}>{savingKey === group.key ? "جارٍ الحفظ..." : needsManualTranslation ? "حفظ الترجمة" : "اعتماد التعديل"}</button>
                  </div>
                ) : (
                  <div className="english-review-actions">
                    {canApprove ? <>
                      <button type="button" className="english-review-primary" disabled={savingKey === group.key} onClick={() => approve(group)}>{savingKey === group.key ? "جارٍ الحفظ..." : "اعتماد"}</button>
                      <button type="button" onClick={() => beginEdit(group)}>تعديل</button>
                    </> : (
                      <button type="button" className="english-review-primary" onClick={() => beginEdit(group)}>إضافة ترجمة إنجليزية</button>
                    )}
                  </div>
                )}
              </>}
              {isApproved && !isEditing && <button type="button" className="english-review-edit-again" onClick={() => beginEdit(group)}>تعديل</button>}
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default EnglishTranslationReview;
