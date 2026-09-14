import React, { useState } from "react";
import { FiPlus, FiTrash2 } from "react-icons/fi";
import ResumeEducationFactsEditor from "./ResumeEducationFactsEditor";
import { emptyEntry, emptyLanguage } from "./resumeDefaults";

const updateSourceNarrative = (entry, value) => ({
  ...entry,
  description: value,
  details: value,
  userSourceDescription: value,
  userSourceContributions: value.trim() ? [value.trim()] : [],
});

const PersonalCard = ({ resume, onChange }) => {
  const personal = resume.personalInfo || {};
  const update = (field, value) => onChange({
    ...resume,
    personalInfo: { ...personal, [field]: value },
  });
  return (
    <section className="resume-builder-card resume-data-section" id="resume-data-personal">
      <div className="resume-card-title"><h3>بياناتك الأساسية</h3><p>المعلومات التي تظهر في أعلى السيرة.</p></div>
      <div className="resume-form-grid">
        <label>الاسم الكامل<input value={personal.fullName || ""} onChange={(event) => update("fullName", event.target.value)} /></label>
        <label>البريد الإلكتروني<input dir="ltr" value={personal.email || ""} onChange={(event) => update("email", event.target.value)} /></label>
        <label>رقم التواصل<input dir="ltr" value={personal.phone || ""} onChange={(event) => update("phone", event.target.value)} /></label>
        <label>الجنس النحوي
          <select value={personal.grammaticalGender || ""} onChange={(event) => update("grammaticalGender", event.target.value)}>
            <option value="">اختر</option><option value="feminine">طالبة / خريجة</option><option value="masculine">طالب / خريج</option>
          </select>
        </label>
      </div>
      <details className="resume-data-more">
        <summary>تفاصيل إضافية</summary>
        <div className="resume-form-grid">
          <label>LinkedIn<input dir="ltr" value={personal.linkedinUrl || ""} onChange={(event) => update("linkedinUrl", event.target.value)} /></label>
          <label>GitHub<input dir="ltr" value={personal.githubUrl || ""} onChange={(event) => update("githubUrl", event.target.value)} /></label>
          <label className="resume-grid-wide">موقع أو ملف أعمال<input dir="ltr" value={personal.portfolioUrl || personal.personalUrl || ""} onChange={(event) => update("portfolioUrl", event.target.value)} /></label>
        </div>
      </details>
    </section>
  );
};

const CollectionSection = ({ title, helper, addLabel, items, onItemsChange, kind }) => {
  const updateItem = (index, patch) => onItemsChange(items.map((item, itemIndex) => (
    itemIndex === index ? { ...item, ...patch } : item
  )));
  const removeItem = (index) => onItemsChange(items.filter((_, itemIndex) => itemIndex !== index));
  return (
    <section className="resume-builder-card resume-data-section" id={`resume-data-${kind}`}>
      <div className="resume-card-title"><h3>{title}</h3><p>{helper}</p></div>
      <div className="resume-data-rows">
        {items.map((item, index) => (
          <article className="resume-data-row" key={item.id}>
            <div className="resume-data-row-head"><strong>{item.title || `${title} ${index + 1}`}</strong><button type="button" onClick={() => removeItem(index)} aria-label={`حذف ${title} ${index + 1}`}><FiTrash2 aria-hidden="true" /></button></div>
            {kind === "projects" && <>
              <div className="resume-form-grid"><label>اسم المشروع<input value={item.title || ""} onChange={(event) => updateItem(index, { title: event.target.value })} /></label><label className="resume-grid-wide">وش سويت في المشروع؟<textarea value={item.userSourceDescription || item.description || ""} onChange={(event) => updateItem(index, updateSourceNarrative(item, event.target.value))} placeholder="اكتب باختصار الأشياء اللي نفذتها بنفسك" /></label></div>
              <TagField label="الأدوات" values={item.technologies || []} onChange={(technologies) => updateItem(index, { technologies })} />
              <details className="resume-data-more"><summary>تفاصيل إضافية</summary><label>رابط المشروع — اختياري<input dir="ltr" value={item.url || ""} onChange={(event) => updateItem(index, { url: event.target.value })} /></label></details>
            </>}
            {kind === "experience" && <>
              <div className="resume-form-grid"><label>المسمى<input value={item.title || ""} onChange={(event) => updateItem(index, { title: event.target.value })} /></label><label>الجهة<input value={item.organization || ""} onChange={(event) => updateItem(index, { organization: event.target.value })} /></label><label>من<input type="month" value={item.startDate || ""} onChange={(event) => updateItem(index, { startDate: event.target.value })} /></label><label>إلى<input type="month" disabled={item.isCurrent} value={item.endDate || ""} onChange={(event) => updateItem(index, { endDate: event.target.value })} /></label><label className="resume-grid-wide">وش كانت أبرز مهامك؟<textarea value={item.userSourceDescription || item.description || ""} onChange={(event) => updateItem(index, updateSourceNarrative(item, event.target.value))} placeholder="مثال: إعداد التقارير الأسبوعية ومتابعة الطلبات" /></label></div>
              <details className="resume-data-more"><summary>تفاصيل إضافية</summary><div className="resume-form-grid"><label>نوع الخبرة<select value={item.entryType || ""} onChange={(event) => updateItem(index, { entryType: event.target.value })}><option value="">اختر</option><option value="coop">تدريب تعاوني</option><option value="internship">تدريب</option><option value="summer_training">تدريب صيفي</option><option value="work">عمل</option><option value="volunteering">تطوع</option></select></label><label>المدينة<input value={item.location || ""} onChange={(event) => updateItem(index, { location: event.target.value })} /></label><label className="resume-checkbox-label"><input type="checkbox" checked={Boolean(item.isCurrent)} onChange={(event) => updateItem(index, { isCurrent: event.target.checked, endDate: event.target.checked ? "" : item.endDate })} /> مستمرة حتى الآن</label></div></details>
            </>}
            {kind === "volunteering" && <>
              <div className="resume-form-grid"><label>اسم النشاط<input value={item.title || ""} onChange={(event) => updateItem(index, { title: event.target.value })} /></label><label>الجهة<input value={item.organization || ""} onChange={(event) => updateItem(index, { organization: event.target.value })} /></label><label className="resume-grid-wide">وش كان دورك أو مساهمتك؟<textarea value={item.userSourceDescription || item.description || ""} onChange={(event) => updateItem(index, updateSourceNarrative(item, event.target.value))} /></label></div>
              <details className="resume-data-more"><summary>تفاصيل إضافية</summary><div className="resume-form-grid"><label>من<input type="month" value={item.startDate || ""} onChange={(event) => updateItem(index, { startDate: event.target.value })} /></label><label>إلى<input type="month" value={item.endDate || ""} onChange={(event) => updateItem(index, { endDate: event.target.value })} /></label></div></details>
            </>}
            {kind === "certifications" && <>
              <div className="resume-form-grid"><label>النوع<select value={item.entryType || "certification"} onChange={(event) => updateItem(index, { entryType: event.target.value })}><option value="certification">شهادة مهنية</option><option value="course">دورة</option></select></label><label>الاسم<input value={item.title || ""} onChange={(event) => updateItem(index, { title: event.target.value })} /></label><label>الجهة<input value={item.organization || ""} onChange={(event) => updateItem(index, { organization: event.target.value })} /></label><label>السنة أو التاريخ<input value={item.period || ""} onChange={(event) => updateItem(index, { period: event.target.value })} placeholder="مثال: 2026" /></label></div>
              <details className="resume-data-more"><summary>تفاصيل إضافية</summary><label>الرابط — اختياري<input dir="ltr" value={item.url || ""} onChange={(event) => updateItem(index, { url: event.target.value })} /></label></details>
            </>}
          </article>
        ))}
      </div>
      <button className="resume-add-button" type="button" onClick={() => onItemsChange([...items, emptyEntry(kind)])}><FiPlus aria-hidden="true" /> {addLabel}</button>
    </section>
  );
};

const TagField = ({ label, values, onChange }) => {
  const [draft, setDraft] = useState("");
  const add = () => {
    const value = draft.trim();
    if (!value || values.some((item) => item.toLowerCase() === value.toLowerCase())) return;
    onChange([...values, value]);
    setDraft("");
  };
  return <div className="resume-data-tags"><strong>{label}</strong><div className="resume-inline-add"><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }} placeholder={`أضف ${label}`} /><button type="button" onClick={add}>إضافة</button></div><div className="resume-skill-chips">{values.map((value) => <button type="button" key={value} onClick={() => onChange(values.filter((item) => item !== value))}>{value}<span>×</span></button>)}</div></div>;
};

const SkillsAndLanguages = ({ resume, onChange }) => {
  const languages = resume.languages || [];
  return <>
    <section id="resume-data-skills" className="resume-builder-card resume-data-section"><div className="resume-card-title"><h3>المهارات</h3><p>أضف كل مهارة في خانة مستقلة.</p></div><TagField label="مهارة" values={resume.skills || []} onChange={(skills) => onChange({ ...resume, skills })} /></section>
    <section id="resume-data-languages" className="resume-builder-card resume-data-section"><div className="resume-card-title"><h3>اللغات</h3><p>اللغة ومستواك فيها فقط.</p></div><div className="resume-data-rows">{languages.map((language, index) => <div className="resume-simple-row" key={language.id}><input aria-label={`اللغة ${index + 1}`} value={language.name || ""} onChange={(event) => onChange({ ...resume, languages: languages.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) })} placeholder="العربية" /><input aria-label={`مستوى اللغة ${index + 1}`} value={language.level || ""} onChange={(event) => onChange({ ...resume, languages: languages.map((item, itemIndex) => itemIndex === index ? { ...item, level: event.target.value } : item) })} placeholder="اللغة الأم" /><button type="button" onClick={() => onChange({ ...resume, languages: languages.filter((_, itemIndex) => itemIndex !== index) })}>حذف</button></div>)}</div><button className="resume-add-button" type="button" onClick={() => onChange({ ...resume, languages: [...languages, emptyLanguage()] })}><FiPlus aria-hidden="true" /> إضافة لغة</button></section>
  </>;
};

const ResumeDataSimpleForm = ({ resume, onChange }) => {
  const experience = resume.experience || resume.experiences || [];
  const setCollection = (section, items) => onChange(section === "experience" ? { ...resume, experience: items, experiences: items } : { ...resume, [section]: items });
  return <div className="resume-data-simple-form">
    <PersonalCard resume={resume} onChange={onChange} />
    <ResumeEducationFactsEditor resume={resume} onChange={onChange} />
    <CollectionSection kind="experience" title="الخبرات — اختياري" helper="تدريب، عمل، أو تجربة تطوعية." addLabel="إضافة خبرة" items={experience} onItemsChange={(items) => setCollection("experience", items)} />
    <CollectionSection kind="projects" title="المشاريع" helper="اكتب ما نفذته بطريقتك، ودربك يصيغه مهنيًا." addLabel="إضافة مشروع" items={resume.projects || []} onItemsChange={(items) => setCollection("projects", items)} />
    <SkillsAndLanguages resume={resume} onChange={onChange} />
    <CollectionSection kind="certifications" title="الشهادات والدورات — اختياري" helper="أضف الشهادات أو الدورات المهمة فقط." addLabel="إضافة شهادة أو دورة" items={resume.certifications || []} onItemsChange={(items) => setCollection("certifications", items)} />
    <CollectionSection kind="volunteering" title="الأنشطة والتطوع — اختياري" helper="النشاط ودورك فيه، بدون مصطلحات معقدة." addLabel="إضافة نشاط" items={resume.volunteering || []} onItemsChange={(items) => setCollection("volunteering", items)} />
  </div>;
};

export default ResumeDataSimpleForm;
