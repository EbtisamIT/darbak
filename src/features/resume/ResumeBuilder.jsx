import React, { useMemo, useState } from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { move } from "@dnd-kit/helpers";
import {
  FiChevronDown,
  FiChevronUp,
  FiEye,
  FiEyeOff,
  FiMenu,
  FiPlus,
  FiTrash2,
} from "react-icons/fi";
import RichAchievementEditor from "./RichAchievementEditor";
import {
  RESUME_SECTION_KEYS,
  RESUME_SECTION_META,
  emptyAchievement,
  emptyEntry,
  emptyLanguage,
  hasEntryContent,
} from "./resumeDefaults";
import { getResumeCompletionItems } from "./resumeValidation";
import { getEnglishReviewItems } from "./resumeLocalization";

const fieldLabels = {
  education: {
    title: "المؤهل أو الدرجة",
    organization: "الجامعة أو الجهة",
    location: "المدينة",
    description: "تفاصيل مختصرة",
  },
  experience: {
    title: "المسمى أو نوع الخبرة",
    organization: "الجهة",
    location: "المدينة أو نوع العمل",
    description: "وصف مختصر",
  },
  projects: {
    title: "اسم المشروع",
    organization: "الجهة أو المادة",
    location: "نوع المشروع",
    description: "وصف مختصر",
  },
  certifications: {
    title: "اسم الشهادة أو الدورة",
    organization: "الجهة المقدمة",
    location: "المكان أو المنصة",
    description: "تفاصيل مختصرة",
  },
  volunteering: {
    title: "المبادرة أو الدور التطوعي",
    organization: "الجهة أو الفريق",
    location: "المدينة أو نوع المشاركة",
    description: "تفاصيل مختصرة",
  },
};

const getItemLabel = (item = {}, fallback = "عنصر جديد") =>
  item.title || item.organization || item.subtitle || fallback;

const reorderByIndexes = (items, fromIndex, toIndex) => {
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return items;
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
};

const SortableBlock = ({ id, index, group, children, className = "" }) => {
  const { ref, handleRef, isDragging } = useSortable({ id, index, group });
  return (
    <div
      ref={ref}
      className={`${className}${isDragging ? " is-dragging" : ""}`}
      data-sortable-id={id}
    >
      {children({ handleRef })}
    </div>
  );
};

const SectionShell = ({
  sectionKey,
  index,
  resume,
  onChange,
  onMove,
  children,
  actions,
}) => {
  const hidden = (resume.hiddenSections || []).includes(sectionKey);
  const meta = RESUME_SECTION_META[sectionKey];

  const toggleHidden = () => {
    const hiddenSections = hidden
      ? (resume.hiddenSections || []).filter((section) => section !== sectionKey)
      : [...(resume.hiddenSections || []), sectionKey];
    onChange({ ...resume, hiddenSections });
  };

  return (
    <SortableBlock
      id={sectionKey}
      index={index}
      group="resume-sections"
      className={`resume-builder-section${hidden ? " is-muted" : ""}`}
    >
      {({ handleRef }) => (
        <div id={`resume-section-${sectionKey}`}>
          <div className="resume-builder-section-header">
            <button
              type="button"
              className="resume-drag-handle"
              ref={handleRef}
              aria-label={`ترتيب قسم ${meta.title}`}
            >
              <FiMenu aria-hidden="true" />
            </button>
            <div>
              <h3>{meta.title}</h3>
              <p>{hidden ? "القسم محفوظ لكنه مخفي من السيرة." : meta.emptyText}</p>
            </div>
            <div className="resume-section-header-actions">
              {actions}
              <button type="button" onClick={toggleHidden}>
                {hidden ? <FiEye aria-hidden="true" /> : <FiEyeOff aria-hidden="true" />}
                {hidden ? "إظهار" : "إخفاء"}
              </button>
              <button type="button" onClick={() => onMove(index, Math.max(0, index - 1))}>
                <FiChevronUp aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() =>
                  onMove(index, Math.min((resume.sectionOrder || []).length - 1, index + 1))
                }
              >
                <FiChevronDown aria-hidden="true" />
              </button>
            </div>
          </div>
          {!hidden && children}
        </div>
      )}
    </SortableBlock>
  );
};

export const PersonalInfoEditor = ({ resume, onChange }) => {
  const personal = resume.personalInfo || {};
  const updatePersonal = (field, value) =>
    onChange({
      ...resume,
      personalInfo: {
        ...personal,
        [field]: value,
      },
    });

  return (
    <section id="resume-section-personal" className="resume-builder-card resume-personal-card">
      <div className="resume-card-title">
        <h3>المعلومات الشخصية</h3>
        <p>هذه البيانات تظهر في أعلى السيرة.</p>
      </div>
      <div className="resume-form-grid">
        <label>
          الاسم الكامل
          <input
            value={personal.fullName || ""}
            onChange={(event) => updatePersonal("fullName", event.target.value)}
            placeholder="مثال: سارة أحمد"
          />
        </label>
        <label>
          المسمى أو التخصص
          <input
            value={personal.headline || ""}
            onChange={(event) => updatePersonal("headline", event.target.value)}
            placeholder="مثال: متخصص/ة في نظم المعلومات"
          />
        </label>
        <label>
          البريد
          <input
            value={personal.email || ""}
            onChange={(event) => updatePersonal("email", event.target.value)}
            placeholder="example@email.com"
            dir="ltr"
          />
        </label>
        <label>
          رقم التواصل
          <input
            value={personal.phone || ""}
            onChange={(event) => updatePersonal("phone", event.target.value)}
            placeholder="05xxxxxxxx"
            dir="ltr"
          />
        </label>
        <label>
          التخصص
          <input
            value={personal.major || ""}
            onChange={(event) => updatePersonal("major", event.target.value)}
            placeholder="علوم الحاسب"
          />
        </label>
        <label>
          الجامعة
          <input
            value={personal.university || ""}
            onChange={(event) => updatePersonal("university", event.target.value)}
            placeholder="اسم الجامعة"
          />
        </label>
        <label>
          المدينة
          <input
            value={personal.city || ""}
            onChange={(event) => updatePersonal("city", event.target.value)}
            placeholder="الرياض"
          />
        </label>
        <label>
          LinkedIn
          <input
            value={personal.linkedinUrl || ""}
            onChange={(event) => updatePersonal("linkedinUrl", event.target.value)}
            placeholder="https://linkedin.com/in/..."
            dir="ltr"
          />
        </label>
        <label>
          GitHub
          <input
            value={personal.githubUrl || ""}
            onChange={(event) => updatePersonal("githubUrl", event.target.value)}
            placeholder="https://github.com/..."
            dir="ltr"
          />
        </label>
        <label>
          رابط شخصي أو ملف مهني
          <input
            value={personal.personalUrl || personal.portfolioUrl || ""}
            onChange={(event) => updatePersonal("personalUrl", event.target.value)}
            placeholder="https://..."
            dir="ltr"
          />
        </label>
      </div>
    </section>
  );
};

export const ApplicationDetailsEditor = ({ resume, onChange }) => {
  const personal = resume.personalInfo || {};
  const updatePersonal = (field, value) =>
    onChange({ ...resume, personalInfo: { ...personal, [field]: value } });

  return (
    <section className="resume-builder-card resume-application-details-card">
      <div className="resume-card-title">
        <h3>تفاصيل التدريب</h3>
        <p>نستخدمها عند تجهيز خطاب التقديم ورسالة الإيميل، ولا تظهر داخل السيرة الذاتية.</p>
      </div>
      <div className="resume-form-grid">
        <label>
          بداية التدريب المتوقعة
          <input type="month" value={personal.trainingStart || ""} onChange={(event) => updatePersonal("trainingStart", event.target.value)} />
        </label>
        <label>
          نهاية التدريب المتوقعة
          <input type="month" value={personal.trainingEnd || ""} onChange={(event) => updatePersonal("trainingEnd", event.target.value)} />
        </label>
        <label className="resume-form-field-wide">
          المجال التدريبي الذي تستهدفه
          <input value={personal.trainingField || ""} onChange={(event) => updatePersonal("trainingField", event.target.value)} placeholder="مثال: تقنية المعلومات أو تطوير الويب" />
        </label>
      </div>
    </section>
  );
};

const AchievementListEditor = ({ achievements = [], onChange }) => {
  const items = achievements.length ? achievements : [emptyAchievement()];

  const updateAchievement = (index, value) =>
    onChange(items.map((achievement, itemIndex) => (itemIndex === index ? value : achievement)));

  const removeAchievement = (index) => {
    const achievement = items[index];
    if ((achievement.text || achievement.html) && !window.confirm("حذف نقطة الإنجاز؟")) {
      return;
    }
    const next = items.filter((_, itemIndex) => itemIndex !== index);
    onChange(next.length ? next : [emptyAchievement()]);
  };

  return (
    <div className="resume-achievements-editor">
      <div className="resume-mini-title">
        <strong>نقاط الإنجاز</strong>
        <button type="button" onClick={() => onChange([...items, emptyAchievement()])}>
          <FiPlus aria-hidden="true" />
          إضافة نقطة
        </button>
      </div>
      <DragDropProvider
        onDragEnd={(event) => {
          if (event.canceled) return;
          onChange(move(items, event));
        }}
      >
        {items.map((achievement, index) => (
          <SortableBlock
            key={achievement.id}
            id={achievement.id}
            index={index}
            group="achievement-items"
            className="resume-achievement-row"
          >
            {({ handleRef }) => (
              <>
                <button
                  type="button"
                  className="resume-drag-handle"
                  ref={handleRef}
                  aria-label="ترتيب نقطة الإنجاز"
                >
                  <FiMenu aria-hidden="true" />
                </button>
                <RichAchievementEditor
                  value={achievement}
                  onChange={(value) => updateAchievement(index, value)}
                />
                <button
                  type="button"
                  className="resume-danger-icon"
                  onClick={() => removeAchievement(index)}
                  aria-label="حذف نقطة الإنجاز"
                >
                  <FiTrash2 aria-hidden="true" />
                </button>
              </>
            )}
          </SortableBlock>
        ))}
      </DragDropProvider>
    </div>
  );
};

const EntryAccordion = ({
  sectionKey,
  entries = [],
  onChange,
  language = "ar",
  localizedEntries = {},
  onLocalizedEntryChange,
}) => {
  const labels = fieldLabels[sectionKey] || fieldLabels.experience;
  const [openId, setOpenId] = useState(entries[0]?.id || "");
  const items = entries.length ? entries : [];

  const updateEntry = (index, field, value) =>
    onChange(items.map((entry, itemIndex) => (itemIndex === index ? { ...entry, [field]: value } : entry)));

  const addEntry = () => {
    const nextEntry = emptyEntry(sectionKey);
    onChange([...items, nextEntry]);
    setOpenId(nextEntry.id);
  };

  const removeEntry = (index) => {
    const entry = items[index];
    if (hasEntryContent(entry) && !window.confirm("حذف هذا العنصر؟")) return;
    onChange(items.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <div className="resume-accordion-list">
      {items.length === 0 && <div className="resume-empty-state">لا توجد عناصر بعد.</div>}
      <DragDropProvider
        onDragEnd={(event) => {
          if (event.canceled) return;
          onChange(move(items, event));
        }}
      >
        {items.map((entry, index) => {
          const open = openId === entry.id;
          const localizedEntry = language === "en"
            ? { ...entry, ...(localizedEntries[`${sectionKey}:${entry.id}`] || {}) }
            : entry;
          return (
            <SortableBlock
              key={entry.id}
              id={entry.id}
              index={index}
              group={`${sectionKey}-items`}
              className={`resume-accordion-item${open ? " is-open" : ""}`}
            >
              {({ handleRef }) => (
                <>
                  <div className="resume-accordion-head">
                    <button
                      type="button"
                      className="resume-drag-handle"
                      ref={handleRef}
                      aria-label="ترتيب العنصر"
                    >
                      <FiMenu aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => setOpenId(open ? "" : entry.id)}>
                      <strong>{getItemLabel(localizedEntry, RESUME_SECTION_META[sectionKey].addLabel)}</strong>
                      <span>{entry.organization || entry.subtitle || "أضف التفاصيل"}</span>
                    </button>
                    <button
                      type="button"
                      className="resume-danger-icon"
                      onClick={() => removeEntry(index)}
                      aria-label="حذف"
                    >
                      <FiTrash2 aria-hidden="true" />
                    </button>
                  </div>
                  {open && (
                    <div className="resume-accordion-body">
                      <div className="resume-form-grid">
                        <label>
                          {labels.title}
                          <input
                            value={localizedEntry.title || ""}
                            onChange={(event) => {
                              if (language === "en" && onLocalizedEntryChange) {
                                onLocalizedEntryChange(entry.id, "title", event.target.value);
                                return;
                              }
                              updateEntry(index, "title", event.target.value);
                            }}
                          />
                        </label>
                        <label>
                          {labels.organization}
                          <input
                            value={entry.organization || ""}
                            onChange={(event) =>
                              updateEntry(index, "organization", event.target.value)
                            }
                          />
                        </label>
                        <label>
                          من
                          <input
                            type="month"
                            value={entry.startDate || ""}
                            onChange={(event) =>
                              updateEntry(index, "startDate", event.target.value)
                            }
                          />
                        </label>
                        <label>
                          إلى
                          <input
                            type="month"
                            value={entry.endDate || ""}
                            disabled={entry.isCurrent}
                            onChange={(event) => updateEntry(index, "endDate", event.target.value)}
                          />
                        </label>
                        <label className="resume-checkbox-label">
                          <input
                            type="checkbox"
                            checked={Boolean(entry.isCurrent)}
                            onChange={(event) =>
                              updateEntry(index, "isCurrent", event.target.checked)
                            }
                          />
                          حتى الآن
                        </label>
                        <label>
                          {labels.location}
                          <input
                            value={entry.location || ""}
                            onChange={(event) =>
                              updateEntry(index, "location", event.target.value)
                            }
                          />
                        </label>
                        <label className="resume-grid-wide">
                          رابط اختياري
                          <input
                            value={entry.url || ""}
                            onChange={(event) => updateEntry(index, "url", event.target.value)}
                            placeholder="https://..."
                            dir="ltr"
                          />
                        </label>
                        <label className="resume-grid-wide">
                          {labels.description}
                          <textarea
                            value={entry.description || entry.details || ""}
                            onChange={(event) =>
                              updateEntry(index, "description", event.target.value)
                            }
                            rows={2}
                          />
                        </label>
                      </div>
                      <AchievementListEditor
                        achievements={entry.achievements}
                        onChange={(achievements) => updateEntry(index, "achievements", achievements)}
                      />
                    </div>
                  )}
                </>
              )}
            </SortableBlock>
          );
        })}
      </DragDropProvider>
      <button type="button" className="resume-add-button" onClick={addEntry}>
        <FiPlus aria-hidden="true" />
        {RESUME_SECTION_META[sectionKey].addLabel}
      </button>
    </div>
  );
};

const SkillsEditor = ({ resume, onChange }) => {
  const [draft, setDraft] = useState("");
  const skills = resume.skills || [];

  const addSkill = () => {
    const skill = draft.trim();
    if (!skill) return;
    if (skills.some((item) => item.toLowerCase() === skill.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange({ ...resume, skills: [...skills, skill] });
    setDraft("");
  };

  return (
    <div className="resume-skills-editor">
      <div className="resume-inline-add">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addSkill();
            }
          }}
          placeholder="مثال: Excel"
        />
        <button type="button" onClick={addSkill}>
          إضافة
        </button>
      </div>
      {skills.length ? (
        <div className="resume-skill-chips">
          {skills.map((skill) => (
            <button
              type="button"
              key={skill}
              onClick={() =>
                onChange({ ...resume, skills: skills.filter((item) => item !== skill) })
              }
              title="اضغط لحذف المهارة"
            >
              {skill}
              <span>×</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="resume-empty-state">أضف مهاراتك واحدة تلو الأخرى.</div>
      )}
    </div>
  );
};

const LanguagesEditor = ({ resume, onChange }) => {
  const languages = resume.languages || [];
  const updateLanguage = (index, field, value) =>
    onChange({
      ...resume,
      languages: languages.map((language, itemIndex) =>
        itemIndex === index ? { ...language, [field]: value } : language
      ),
    });

  return (
    <div className="resume-simple-list">
      {languages.map((language, index) => (
        <div className="resume-simple-row" key={language.id}>
          <input
            value={language.name}
            onChange={(event) => updateLanguage(index, "name", event.target.value)}
            placeholder="العربية"
          />
          <input
            value={language.level}
            onChange={(event) => updateLanguage(index, "level", event.target.value)}
            placeholder="متقدم"
          />
          <button
            type="button"
            onClick={() =>
              onChange({
                ...resume,
                languages: languages.filter((_, itemIndex) => itemIndex !== index),
              })
            }
          >
            حذف
          </button>
        </div>
      ))}
      <button
        type="button"
        className="resume-add-button"
        onClick={() => onChange({ ...resume, languages: [...languages, emptyLanguage()] })}
      >
        <FiPlus aria-hidden="true" />
        إضافة لغة
      </button>
    </div>
  );
};

export const SettingsEditor = ({ resume, onChange }) => {
  const settings = resume.settings || {};
  const updateSetting = (field, value) => {
    const nextSettings = {
      ...settings,
      [field]: value,
    };
    if (field === "language") {
      nextSettings.direction = value === "en" ? "ltr" : "rtl";
    }
    onChange({ ...resume, settings: nextSettings });
  };

  return (
    <section className="resume-builder-card resume-settings-card">
      <div className="resume-card-title">
        <h3>تغيير القالب</h3>
        <p>اختر الشكل أولًا، ثم افتح التخصيصات عند الحاجة.</p>
      </div>
      <div className="resume-template-cards" role="radiogroup" aria-label="قالب السيرة">
        {[["clean", "نظيف"], ["modern", "حديث"], ["formal", "رسمي"]].map(([value, label]) => (
          <button key={value} type="button" className={settings.template === value ? "is-active" : ""} onClick={() => updateSetting("template", value)}>
            <span className={`resume-template-mini is-${value}`}><i /><i /><i /></span><strong>{label}</strong>
          </button>
        ))}
      </div>
      <details className="resume-more-settings">
        <summary>تخصيص أكثر</summary>
        <div className="resume-form-grid">
        <label>
          كثافة المحتوى
          <select
            value={settings.density || "comfortable"}
            onChange={(event) => updateSetting("density", event.target.value)}
          >
            <option value="comfortable">مريح</option>
            <option value="compact">مضغوط</option>
          </select>
        </label>
        <label>
          حجم الخط
          <select
            value={settings.fontSize || "medium"}
            onChange={(event) => updateSetting("fontSize", event.target.value)}
          >
            <option value="small">صغير</option>
            <option value="medium">متوسط</option>
            <option value="large">كبير</option>
          </select>
        </label>
        <label>
          لون العناوين
          <select
            value={settings.accentColor || "#42cfc3"}
            onChange={(event) => updateSetting("accentColor", event.target.value)}
          >
            <option value="#42cfc3">فيروزي دربك</option>
            <option value="#178f83">أخضر هادئ</option>
            <option value="#315cfd">أزرق رسمي</option>
            <option value="#7c3aed">بنفسجي بسيط</option>
            <option value="#111827">أسود كلاسيكي</option>
          </select>
        </label>
        </div>
      </details>
    </section>
  );
};

const sectionForCompletionItem = (title) => {
  if (["الاسم", "البريد الإلكتروني", "رقم التواصل", "التخصص أو المسمى"].includes(title)) return "personal";
  if (title === "النبذة المهنية") return "summary";
  if (title === "التعليم" || title === "التواريخ") return "education";
  if (title === "خبرة أو مشروع واحد على الأقل") return "projects";
  if (title === "المهارات" || title === "تكرار المهارات") return "skills";
  if (title === "الأقسام الفارغة") return "summary";
  return null;
};

const getReviewSuggestions = (resume) => {
  const sections = ["education", "experience", "projects", "certifications", "volunteering"];
  const mixedScript = (value = "") => /[A-Za-z]/.test(value) && /[\u0600-\u06FF]/.test(value);

  for (const section of sections) {
    for (const entry of resume[section] || []) {
      if (mixedScript(entry.organization)) {
        return [{
          status: "review",
          title: "راجع اسم الجهة",
          detail: `القيمة الحالية: ${entry.organization}`,
          section,
        }];
      }
      if (entry.title && entry.title.trim().length < 3) {
        return [{
          status: "review",
          title: "راجع المسمى",
          detail: `القيمة الحالية: ${entry.title}`,
          section,
        }];
      }
    }
  }
  return [];
};

const CompletionPanel = ({ resume, onChange, hideCompletedChecklist = false }) => {
  const items = useMemo(() => getResumeCompletionItems(resume), [resume]);
  const [inProgress, setInProgress] = useState(() => new Set());
  const requiredTitles = ["الاسم", "البريد الإلكتروني", "رقم التواصل", "التخصص أو المسمى", "التعليم", "خبرة أو مشروع واحد على الأقل", "المهارات"];
  const required = requiredTitles.map((title) => {
    const item = items.find((candidate) => candidate.title === title);
    const key = `required:${title}`;
    return {
      ...item,
      key,
      section: sectionForCompletionItem(title),
      status: item?.status === "complete" ? "completed" : inProgress.has(key) ? "in_progress" : "needs_action",
    };
  });
  const hasActionableItem = required.some((item) => item.status !== "completed") || items.some((item) => item.status === "needs_review");
  if (hideCompletedChecklist && !hasActionableItem) return null;
  const reviews = [...getReviewSuggestions(resume), ...getEnglishReviewItems(resume).map((item) => ({
    ...item,
    title: `راجع ${item.label}`,
    detail: `القيمة الحالية: ${item.value}`,
  }))].map((item, index) => {
    const key = `review:${item.title}:${item.detail}:${index}`;
    return {
      ...item,
      key,
      status: inProgress.has(key) ? "in_progress" : "needs_action",
    };
  });
  const optional = items
    .filter((item) => item.status !== "complete" && !requiredTitles.includes(item.title))
    .map((item) => ({ ...item, key: `optional:${item.title}`, section: sectionForCompletionItem(item.title), status: inProgress.has(`optional:${item.title}`) ? "in_progress" : "optional" }));
  const completedRequired = required.filter((item) => item.status === "completed").length + reviews.filter((item) => item.status === "completed").length;
  const requiredTotal = required.length + reviews.length;
  const progress = requiredTotal ? Math.round((completedRequired / requiredTotal) * 100) : 100;
  const recommendations = [...required, ...reviews, ...optional].slice(0, 8);

  const scrollToSection = (section) => {
    if (!section) return;
    document.getElementById(`resume-section-${section}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const addEnglishDisplayValue = (item) => {
    const value = window.prompt(`اكتب ${item.label} بالإنجليزية كما يظهر رسميًا`, item.generatedValue || "");
    if (!value?.trim()) return;
    const localizedDisplay = {
      ...(resume.localizedDisplay || {}),
      personalInfo: { ...(resume.localizedDisplay?.personalInfo || {}) },
      entries: { ...(resume.localizedDisplay?.entries || {}) },
      achievements: { ...(resume.localizedDisplay?.achievements || {}) },
      review: { ...(resume.localizedDisplay?.review || {}) },
    };
    if (item.section === "personal") {
      localizedDisplay.personalInfo[item.field] = value.trim();
    } else if (item.section && item.entryId) {
      const key = `${item.section}:${item.entryId}`;
      if (item.field === "achievement") {
        const achievementKey = `${key}:${item.achievementId || item.index}`;
        localizedDisplay.achievements[achievementKey] = value.trim();
        localizedDisplay.review[`achievements:${achievementKey}`] = {
          source: item.value,
          approved: true,
        };
      } else {
        localizedDisplay.entries[key] = { ...(localizedDisplay.entries[key] || {}), [item.field]: value.trim() };
        localizedDisplay.review[`entries:${key}:${item.field}`] = {
          source: item.value,
          approved: true,
        };
      }
    }
    onChange({ ...resume, localizedDisplay });
  };

  const approveEnglishDisplayValue = (item) => {
    const localizedDisplay = {
      ...(resume.localizedDisplay || {}),
      review: { ...(resume.localizedDisplay?.review || {}) },
    };
    const key = `${item.section}:${item.entryId}`;
    const reviewKey = item.field === "achievement"
      ? `achievements:${key}:${item.achievementId || item.index}`
      : `entries:${key}:${item.field}`;
    localizedDisplay.review[reviewKey] = {
      source: item.value,
      approved: true,
    };
    onChange({ ...resume, localizedDisplay });
  };

  return (
    <aside className="resume-completion-panel">
      <div className="resume-completion-head">
        <div>
          <span>{progress === 100 ? "سيرتك جاهزة للتقديم ✓" : "اكتمال السيرة"}</span>
          <strong>{progress}%</strong>
        </div>
        <div className="resume-completion-track" aria-label={`اكتمال السيرة ${progress}%`}>
          <i style={{ width: `${progress}%` }} />
        </div>
      </div>
      <ul>
        {recommendations.map((item) => (
          <li key={item.key} className={`is-${item.status}`}>
            <div>
              <span>{item.title}</span>
              <p>{item.detail}</p>
            </div>
            <div className="resume-completion-actions">
              {item.status === "completed" ? <b>تم التحسين ✓</b> : <>
                {item.localizationState === "review" ? <>
                  <p className="resume-localization-preview"><b>{item.value}</b><span>{item.generatedValue}</span></p>
                  <button type="button" onClick={() => approveEnglishDisplayValue(item)}>اعتماد كما هي</button>
                  <button type="button" onClick={() => addEnglishDisplayValue(item)}>تعديل</button>
                </> : item.field ? <button type="button" onClick={() => addEnglishDisplayValue(item)}>إضافة كتابة إنجليزية</button> : item.section && <button type="button" onClick={() => { setInProgress((current) => new Set(current).add(item.key)); scrollToSection(item.section); }}>مراجعة</button>}
                {item.status === "optional" && <em>تحسين اختياري</em>}
                {item.status === "in_progress" && <em>قيد التحسين</em>}
              </>}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
};

const ResumeBuilder = ({
  resume,
  onChange,
  onUsePortfolio,
  onCreateScratch,
  onContinueSaved,
  hideCompletedChecklist = false,
}) => {
  const order = resume.sectionOrder || RESUME_SECTION_KEYS;

  const updateSectionOrder = (nextOrder) => onChange({ ...resume, sectionOrder: nextOrder });
  const moveSection = (fromIndex, toIndex) =>
    updateSectionOrder(reorderByIndexes(order, fromIndex, toIndex));

  const renderSectionContent = (sectionKey) => {
    if (sectionKey === "summary") {
      return (
        <textarea
          value={resume.summary || ""}
          onChange={(event) => onChange({ ...resume, summary: event.target.value })}
          placeholder="اكتب نبذة من 3 إلى 4 أسطر عن تخصصك واهتماماتك وما تبحث عنه في التدريب."
          rows={5}
        />
      );
    }

    if (sectionKey === "skills") {
      return <SkillsEditor resume={resume} onChange={onChange} />;
    }

    if (sectionKey === "languages") {
      return <LanguagesEditor resume={resume} onChange={onChange} />;
    }

    return (
      <EntryAccordion
        sectionKey={sectionKey}
        entries={resume[sectionKey] || []}
        language={resume.settings?.language || "ar"}
        localizedEntries={resume.localizedDisplay?.entries || {}}
        onLocalizedEntryChange={(entryId, field, value) => {
          const key = `${sectionKey}:${entryId}`;
          onChange({
            ...resume,
            localizedDisplay: {
              ...(resume.localizedDisplay || {}),
              entries: {
                ...(resume.localizedDisplay?.entries || {}),
                [key]: {
                  ...(resume.localizedDisplay?.entries?.[key] || {}),
                  [field]: value,
                },
              },
            },
          });
        }}
        onChange={(entries) =>
          onChange({
            ...resume,
            [sectionKey]: entries,
            ...(sectionKey === "experience" ? { experiences: entries } : {}),
          })
        }
      />
    );
  };

  return (
    <div className="resume-builder-editor">
      <section className="resume-start-options">
        <button type="button" onClick={onUsePortfolio}>
          استخدام بيانات الملف المهني
        </button>
        <button type="button" onClick={onCreateScratch}>
          إنشاء سيرة من الصفر
        </button>
        <button type="button" onClick={onContinueSaved}>
          متابعة آخر سيرة محفوظة
        </button>
      </section>

      <CompletionPanel resume={resume} onChange={onChange} hideCompletedChecklist={hideCompletedChecklist} />
      <SettingsEditor resume={resume} onChange={onChange} />
      <PersonalInfoEditor resume={resume} onChange={onChange} />
      <ApplicationDetailsEditor resume={resume} onChange={onChange} />

      <DragDropProvider
        onDragEnd={(event) => {
          if (event.canceled) return;
          updateSectionOrder(move(order, event));
        }}
      >
        {order.map((sectionKey, index) => (
          <SectionShell
            key={sectionKey}
            sectionKey={sectionKey}
            index={index}
            resume={resume}
            onChange={onChange}
            onMove={moveSection}
          >
            {renderSectionContent(sectionKey)}
          </SectionShell>
        ))}
      </DragDropProvider>
    </div>
  );
};

export default ResumeBuilder;
