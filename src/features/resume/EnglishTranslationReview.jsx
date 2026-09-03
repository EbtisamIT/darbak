import React, { useEffect, useMemo, useState } from "react";
import { getEnglishReviewItems } from "./resumeLocalization";

const REVIEWABLE_SECTIONS = new Set(["projects", "certifications", "volunteering"]);

const sectionLabel = {
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
      status: "pending",
    };
  }
  groups[key].items.push(item);
  return groups;
}, {});

export const getEnglishReviewGroups = (resume = {}) => {
  const pendingGroups = groupItems(getEnglishReviewItems(resume));
  const savedReviews = resume.localizedDisplay?.review || {};
  const approvedGroups = Object.entries(savedReviews)
    .filter(([key, record]) => key.startsWith("groups:") && record?.approved && !pendingGroups[key])
    .map(([key, record]) => ({
      key,
      section: record.section,
      entryId: record.entryId,
      label: record.label || sectionLabel[record.section] || "عنصر",
      items: Array.isArray(record.items) ? record.items : [],
      status: record.status || "approved",
    }));

  return [...Object.values(pendingGroups), ...approvedGroups];
};

export const applyEnglishReviewGroup = (resume, group, values = {}, status = "approved") => {
  const localizedDisplay = {
    ...(resume.localizedDisplay || {}),
    entries: { ...(resume.localizedDisplay?.entries || {}) },
    achievements: { ...(resume.localizedDisplay?.achievements || {}) },
    review: { ...(resume.localizedDisplay?.review || {}) },
  };

  group.items.forEach((item) => {
    const nextValue = String(values[item.fieldKey] ?? item.generatedValue ?? "").trim();
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
    localizedDisplay.review[reviewKeyForItem(item)] = {
      source: item.value,
      approved: true,
    };
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
  const entryKey = `${item.section}:${item.entryId}`;
  if (item.field === "achievement") {
    return resume.localizedDisplay?.achievements?.[`${entryKey}:${item.achievementId || item.index}`] || item.generatedValue || "";
  }
  return resume.localizedDisplay?.entries?.[entryKey]?.[item.field] || item.generatedValue || "";
};

const EnglishTranslationReview = ({ resume, onChange, onOpenEditor }) => {
  const groups = useMemo(() => getEnglishReviewGroups(resume), [resume]);
  const [editingKey, setEditingKey] = useState("");
  const [values, setValues] = useState({});
  const [activeKey, setActiveKey] = useState("");
  const pendingGroups = groups.filter((group) => group.status === "pending");
  const approvedCount = groups.length - pendingGroups.length;

  useEffect(() => {
    if (!activeKey || !groups.some((group) => group.key === activeKey && group.status === "pending")) {
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

  const approve = (group, edited = false) => {
    const nextResume = applyEnglishReviewGroup(resume, group, values, edited ? "edited_and_approved" : "approved");
    onChange(nextResume);
    setEditingKey("");
    const nextPending = groups.find((candidate) => candidate.status === "pending" && candidate.key !== group.key);
    setActiveKey(nextPending?.key || "");
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
        <strong>{approvedCount} من {groups.length} تمت مراجعتها</strong>
      </header>
      <div className="english-review-list">
        {groups.map((group) => {
          const isEditing = editingKey === group.key;
          const isApproved = group.status !== "pending";
          return (
            <article key={group.key} className={`english-review-card${isApproved ? " is-approved" : ""}${activeKey === group.key ? " is-active" : ""}`}>
              <div className="english-review-card-head">
                <span>{group.label}</span>
                {isApproved && <b>تم الاعتماد ✓</b>}
              </div>
              {(!isApproved || isEditing) && <>
                <div className="english-review-copy">
                  <label>النص العربي<pre>{sourceText(group)}</pre></label>
                  <label>الترجمة المقترحة<pre dir="ltr">{translatedText(group) || "أضف ترجمة العنصر"}</pre></label>
                </div>
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
                    <button type="button" className="english-review-primary" onClick={() => approve(group, true)}>اعتماد التعديل</button>
                  </div>
                ) : (
                  <div className="english-review-actions">
                    <button type="button" className="english-review-primary" onClick={() => approve(group)}>اعتماد</button>
                    <button type="button" onClick={() => beginEdit(group)}>تعديل</button>
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
