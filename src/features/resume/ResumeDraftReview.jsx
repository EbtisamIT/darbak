import React, { useMemo, useState } from "react";
import { FiAlertCircle, FiCheck, FiRefreshCw, FiTrash2 } from "react-icons/fi";

const sectionLabels = {
  professionalSummary: "النبذة المهنية",
  education: "التعليم",
  experiences: "الخبرات",
  projects: "المشاريع",
  skills: "المهارات",
  certifications: "الدورات والشهادات",
  volunteering: "الأنشطة والتطوع",
  languages: "اللغات",
};

const clone = (value) => JSON.parse(JSON.stringify(value || {}));

const emptyArrays = {
  education: [],
  experiences: [],
  projects: [],
  skills: [],
  certifications: [],
  volunteering: [],
  languages: [],
};

const fieldValue = (value) => (value ?? "").toString();

const editArrayItem = (draft, sectionKey, index, field, value) => ({
  ...draft,
  [sectionKey]: (draft[sectionKey] || []).map((item, itemIndex) =>
    itemIndex === index ? { ...item, [field]: value } : item
  ),
});

const editArrayItemBullet = (draft, sectionKey, index, bulletIndex, value) => ({
  ...draft,
  [sectionKey]: (draft[sectionKey] || []).map((item, itemIndex) =>
    itemIndex === index
      ? {
          ...item,
          bullets: (item.bullets || []).map((bullet, currentBulletIndex) =>
            currentBulletIndex === bulletIndex ? value : bullet
          ),
        }
      : item
  ),
});

const addBullet = (draft, sectionKey, index) => ({
  ...draft,
  [sectionKey]: (draft[sectionKey] || []).map((item, itemIndex) =>
    itemIndex === index
      ? {
          ...item,
          bullets: [...(item.bullets || []), ""],
        }
      : item
  ),
});

const removeBullet = (draft, sectionKey, index, bulletIndex) => ({
  ...draft,
  [sectionKey]: (draft[sectionKey] || []).map((item, itemIndex) =>
    itemIndex === index
      ? {
          ...item,
          bullets: (item.bullets || []).filter((_, currentBulletIndex) => currentBulletIndex !== bulletIndex),
        }
      : item
  ),
});

const removeItem = (draft, sectionKey, index) => ({
  ...draft,
  [sectionKey]: (draft[sectionKey] || []).filter((_, itemIndex) => itemIndex !== index),
});

const addItem = (draft, sectionKey) => {
  const emptyItem = {
    sourceId: `manual-${sectionKey}-${Date.now().toString(36)}`,
    title: "",
    organization: "",
    dates: "",
    location: "",
    bullets: [""],
  };

  if (sectionKey === "projects") {
    return {
      ...draft,
      projects: [
        ...(draft.projects || []),
        {
          sourceId: emptyItem.sourceId,
          name: "",
          description: "",
          technologies: [],
          bullets: [""],
          url: "",
        },
      ],
    };
  }

  if (sectionKey === "skills") {
    return {
      ...draft,
      skills: [...(draft.skills || []), { name: "", evidenceSourceId: "" }],
    };
  }

  if (sectionKey === "languages") {
    return {
      ...draft,
      languages: [...(draft.languages || []), { name: "", level: "" }],
    };
  }

  if (sectionKey === "certifications") {
    return {
      ...draft,
      certifications: [
        ...(draft.certifications || []),
        { sourceId: emptyItem.sourceId, name: "", issuer: "", date: "", details: "" },
      ],
    };
  }

  return {
    ...draft,
    [sectionKey]: [...(draft[sectionKey] || []), emptyItem],
  };
};

const DraftArraySection = ({ draft, originalDraft, sectionKey, onChange }) => {
  const items = Array.isArray(draft[sectionKey]) ? draft[sectionKey] : [];
  const restoreSection = () => {
    onChange({
      ...draft,
      [sectionKey]: clone(originalDraft[sectionKey] || emptyArrays[sectionKey] || []),
    });
  };

  const clearSection = () => {
    if (!items.length || window.confirm(`حذف قسم ${sectionLabels[sectionKey]} من المسودة؟`)) {
      onChange({
        ...draft,
        [sectionKey]: [],
      });
    }
  };

  return (
    <section className="resume-draft-section">
      <div className="resume-draft-section-head">
        <div>
          <h3>{sectionLabels[sectionKey]}</h3>
          <p>{items.length ? `${items.length} عنصر قابل للتعديل` : "القسم فارغ حاليًا."}</p>
        </div>
        <div>
          <button type="button" onClick={() => onChange(addItem(draft, sectionKey))}>
            إضافة
          </button>
          <button type="button" onClick={restoreSection}>
            <FiRefreshCw aria-hidden="true" />
            استعادة
          </button>
          <button type="button" className="is-danger" onClick={clearSection}>
            <FiTrash2 aria-hidden="true" />
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="resume-draft-empty">لا توجد عناصر في هذا القسم. يمكنك إضافتها الآن أو لاحقًا من المحرر.</div>
      ) : (
        <div className="resume-draft-list">
          {items.map((item, index) => {
            const isProject = sectionKey === "projects";
            const isSkill = sectionKey === "skills";
            const isLanguage = sectionKey === "languages";
            const isCert = sectionKey === "certifications";
            return (
              <article className="resume-draft-item" key={item.sourceId || `${sectionKey}-${index}`}>
                <div className="resume-draft-item-head">
                  <strong>
                    {item.title || item.name || item.organization || item.issuer || `عنصر ${index + 1}`}
                  </strong>
                  <button
                    type="button"
                    className="is-danger"
                    onClick={() => {
                      if (window.confirm("حذف هذا العنصر من المسودة؟")) {
                        onChange(removeItem(draft, sectionKey, index));
                      }
                    }}
                  >
                    حذف
                  </button>
                </div>

                {isSkill ? (
                  <label>
                    المهارة
                    <input
                      value={fieldValue(item.name)}
                      onChange={(event) =>
                        onChange(editArrayItem(draft, sectionKey, index, "name", event.target.value))
                      }
                    />
                  </label>
                ) : isLanguage ? (
                  <div className="resume-draft-grid">
                    <label>
                      اللغة
                      <input
                        value={fieldValue(item.name)}
                        onChange={(event) =>
                          onChange(editArrayItem(draft, sectionKey, index, "name", event.target.value))
                        }
                      />
                    </label>
                    <label>
                      المستوى
                      <input
                        value={fieldValue(item.level)}
                        onChange={(event) =>
                          onChange(editArrayItem(draft, sectionKey, index, "level", event.target.value))
                        }
                      />
                    </label>
                  </div>
                ) : isCert ? (
                  <div className="resume-draft-grid">
                    <label>
                      اسم الشهادة
                      <input
                        value={fieldValue(item.name)}
                        onChange={(event) =>
                          onChange(editArrayItem(draft, sectionKey, index, "name", event.target.value))
                        }
                      />
                    </label>
                    <label>
                      الجهة
                      <input
                        value={fieldValue(item.issuer)}
                        onChange={(event) =>
                          onChange(editArrayItem(draft, sectionKey, index, "issuer", event.target.value))
                        }
                      />
                    </label>
                    <label>
                      التاريخ
                      <input
                        value={fieldValue(item.date)}
                        onChange={(event) =>
                          onChange(editArrayItem(draft, sectionKey, index, "date", event.target.value))
                        }
                      />
                    </label>
                    <label>
                      التفاصيل
                      <input
                        value={fieldValue(item.details)}
                        onChange={(event) =>
                          onChange(editArrayItem(draft, sectionKey, index, "details", event.target.value))
                        }
                      />
                    </label>
                  </div>
                ) : (
                  <>
                    <div className="resume-draft-grid">
                      <label>
                        {isProject ? "اسم المشروع" : "العنوان"}
                        <input
                          value={fieldValue(isProject ? item.name : item.title)}
                          onChange={(event) =>
                            onChange(
                              editArrayItem(
                                draft,
                                sectionKey,
                                index,
                                isProject ? "name" : "title",
                                event.target.value
                              )
                            )
                          }
                        />
                      </label>
                      <label>
                        الجهة
                        <input
                          value={fieldValue(item.organization)}
                          onChange={(event) =>
                            onChange(editArrayItem(draft, sectionKey, index, "organization", event.target.value))
                          }
                        />
                      </label>
                      <label>
                        التاريخ
                        <input
                          value={fieldValue(item.dates)}
                          onChange={(event) =>
                            onChange(editArrayItem(draft, sectionKey, index, "dates", event.target.value))
                          }
                        />
                      </label>
                      <label>
                        المدينة أو النوع
                        <input
                          value={fieldValue(item.location)}
                          onChange={(event) =>
                            onChange(editArrayItem(draft, sectionKey, index, "location", event.target.value))
                          }
                        />
                      </label>
                    </div>
                    {isProject && (
                      <label>
                        وصف المشروع
                        <textarea
                          rows={3}
                          value={fieldValue(item.description)}
                          onChange={(event) =>
                            onChange(editArrayItem(draft, sectionKey, index, "description", event.target.value))
                          }
                        />
                      </label>
                    )}
                    <div className="resume-draft-bullets">
                      <div>
                        <span>النقاط المقترحة</span>
                        <button type="button" onClick={() => onChange(addBullet(draft, sectionKey, index))}>
                          إضافة نقطة
                        </button>
                      </div>
                      {(item.bullets || []).map((bullet, bulletIndex) => (
                        <label key={`${item.sourceId || index}-bullet-${bulletIndex}`}>
                          <input
                            value={fieldValue(bullet)}
                            onChange={(event) =>
                              onChange(
                                editArrayItemBullet(
                                  draft,
                                  sectionKey,
                                  index,
                                  bulletIndex,
                                  event.target.value
                                )
                              )
                            }
                          />
                          <button
                            type="button"
                            className="is-danger"
                            onClick={() => onChange(removeBullet(draft, sectionKey, index, bulletIndex))}
                          >
                            حذف
                          </button>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

const ResumeDraftReview = ({
  draft,
  originalDraft,
  isApproving = false,
  onDraftChange,
  onApprove,
  onBack,
}) => {
  const [activeSection, setActiveSection] = useState("professionalSummary");
  const editableDraft = draft || {};
  const baseDraft = originalDraft || draft || {};

  const sectionKeys = useMemo(
    () => [
      "professionalSummary",
      "education",
      "experiences",
      "projects",
      "skills",
      "certifications",
      "volunteering",
      "languages",
    ],
    []
  );

  const setDraft = (nextDraft) => onDraftChange?.(nextDraft);

  const missing = Array.isArray(editableDraft.missingInformation)
    ? editableDraft.missingInformation
    : [];
  const warnings = Array.isArray(editableDraft.warnings) ? editableDraft.warnings : [];

  return (
    <section className="resume-draft-review" aria-labelledby="resume-draft-review-title">
      <div className="resume-draft-hero">
        <span>مسودتك جاهزة للمراجعة</span>
        <h2 id="resume-draft-review-title">راجِع المحتوى قبل ما نحفظه كسيرة نهائية.</h2>
        <p>
          تقدر تعدّل أو تحذف أي قسم الآن. بعد الاعتماد بننقلها للمحرر الكامل عشان تضبط
          الترتيب والمعاينة وتحمل PDF.
        </p>
      </div>

      {(missing.length > 0 || warnings.length > 0) && (
        <div className="resume-draft-insights">
          {missing.length > 0 && (
            <div>
              <strong>
                <FiAlertCircle aria-hidden="true" />
                معلومات ناقصة
              </strong>
              {missing.map((item, index) => (
                <p key={`${item.section || "missing"}-${index}`}>
                  {item.section ? `${item.section}: ` : ""}
                  {item.question}
                </p>
              ))}
            </div>
          )}
          {warnings.length > 0 && (
            <div>
              <strong>
                <FiAlertCircle aria-hidden="true" />
                ملاحظات مهمة
              </strong>
              {warnings.map((warning, index) => (
                <p key={`warning-${index}`}>{warning}</p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="resume-draft-tabs" role="tablist" aria-label="أقسام المسودة">
        {sectionKeys.map((sectionKey) => (
          <button
            key={sectionKey}
            type="button"
            className={activeSection === sectionKey ? "is-active" : ""}
            onClick={() => setActiveSection(sectionKey)}
          >
            {sectionLabels[sectionKey]}
          </button>
        ))}
      </div>

      {activeSection === "professionalSummary" ? (
        <section className="resume-draft-section">
          <div className="resume-draft-section-head">
            <div>
              <h3>النبذة المهنية</h3>
              <p>يفضل تكون من سطرين إلى أربعة أسطر.</p>
            </div>
            <div>
              <button
                type="button"
                onClick={() =>
                  setDraft({
                    ...editableDraft,
                    professionalSummary: baseDraft.professionalSummary || "",
                  })
                }
              >
                <FiRefreshCw aria-hidden="true" />
                استعادة
              </button>
              <button
                type="button"
                className="is-danger"
                onClick={() => setDraft({ ...editableDraft, professionalSummary: "" })}
              >
                <FiTrash2 aria-hidden="true" />
              </button>
            </div>
          </div>
          <textarea
            rows={7}
            value={fieldValue(editableDraft.professionalSummary)}
            onChange={(event) =>
              setDraft({
                ...editableDraft,
                professionalSummary: event.target.value,
              })
            }
          />
        </section>
      ) : (
        <DraftArraySection
          draft={editableDraft}
          originalDraft={baseDraft}
          sectionKey={activeSection}
          onChange={setDraft}
        />
      )}

      <div className="resume-draft-actions">
        <button type="button" className="is-soft" onClick={onBack} disabled={isApproving}>
          رجوع للأسئلة
        </button>
        <button type="button" onClick={() => onApprove?.(editableDraft)} disabled={isApproving}>
          <FiCheck aria-hidden="true" />
          {isApproving ? "نعتمد المسودة..." : "اعتمد المسودة وافتح المحرر"}
        </button>
      </div>
    </section>
  );
};

export default ResumeDraftReview;
