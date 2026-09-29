import React, { useState } from "react";
import { programLabels, sourceLabels, verificationLabels, fieldLabels, dateValue } from "./candidateLabels";

export default function CandidateEditor({ candidate, onSave, onCancel, busy }) {
  const [form, setForm] = useState(candidate);
  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const emails = form.discoveredEmails || [];
  return <form className="oi-editor" onSubmit={(event) => { event.preventDefault(); onSave(form); }}>
    <h3>تعديل المرشح</h3>
    <div className="oi-fields">
      {["title", "company", "companyLogo", "applicationUrl", "sourceUrl"].map((field) => <label key={field}>{fieldLabels[field]}
        <input type={/Url|Logo/.test(field) ? "url" : "text"} value={form[field] || ""} onChange={(e) => set(field, e.target.value)} />
      </label>)}
      {[["programType", "نوع البرنامج", programLabels], ["sourceType", "نوع المصدر", sourceLabels]].map(([field, label, options]) => <label key={field}>{label}<select value={form[field]} onChange={(e) => set(field, e.target.value)}>{Object.entries(options).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>)}
      {["postedAt", "deadline", "trainingStartDate"].map((field) => <label key={field}>{fieldLabels[field]}<input type="date" value={dateValue(form[field])} onChange={(e) => set(field, e.target.value || null)} /></label>)}
      <label>درجة الثقة (0–100)<input type="number" min="0" max="100" value={form.confidenceScore} onChange={(e) => set("confidenceScore", Number(e.target.value))} /></label>
      <label className="oi-check"><input type="checkbox" checked={form.remote || false} onChange={(e) => set("remote", e.target.checked)} />عن بُعد</label>
    </div>
    {["description", "majors", "cities", "responsibilities", "requirements", "aiNotes"].map((field) => {
      const isList = ["majors", "cities", "responsibilities", "requirements"].includes(field);
      return <label key={field}>{fieldLabels[field]}{isList ? " (كل بند بسطر)" : ""}<textarea rows="3" value={isList ? (form[field] || []).join("\n") : form[field] || ""} onChange={(e) => set(field, isList ? e.target.value.split("\n") : e.target.value)} /></label>;
    })}
    <fieldset><legend>التحقق من المصدر</legend><div className="oi-fields">{Object.entries(verificationLabels).map(([field, label]) => <label key={field}>{label}<select value={form.verification?.[field] == null ? "unknown" : String(form.verification[field])} onChange={(e) => set("verification", { ...form.verification, [field]: e.target.value === "unknown" ? null : e.target.value === "true" })}><option value="unknown">غير متحقق</option><option value="true">نعم</option><option value="false">لا</option></select></label>)}</div></fieldset>
    <fieldset><legend>البريد المكتشف</legend>{emails.map((item, index) => <div className="oi-email-editor" key={index}>
      <label>البريد<input type="email" required value={item.email} onChange={(e) => set("discoveredEmails", emails.map((v, i) => i === index ? { ...v, email: e.target.value } : v))} /></label>
      <label>النوع<select value={item.type} onChange={(e) => set("discoveredEmails", emails.map((v, i) => i === index ? { ...v, type: e.target.value } : v))}>{["application", "coop", "training", "careers", "recruitment", "hr", "general"].map((v) => <option key={v}>{v}</option>)}</select></label>
      <label>المصدر<input type="url" value={item.sourceUrl} onChange={(e) => set("discoveredEmails", emails.map((v, i) => i === index ? { ...v, sourceUrl: e.target.value } : v))} /></label>
      <label>الثقة<input type="number" min="0" max="100" value={item.confidence} onChange={(e) => set("discoveredEmails", emails.map((v, i) => i === index ? { ...v, confidence: Number(e.target.value) } : v))} /></label>
      <button type="button" onClick={() => set("discoveredEmails", emails.filter((_, i) => i !== index))}>حذف البريد</button>
    </div>)}<button type="button" onClick={() => set("discoveredEmails", [...emails, { email: "", type: "general", sourceUrl: "", confidence: 0 }])}>إضافة بريد</button></fieldset>
    <div className="oi-actions"><button className="oi-primary" disabled={busy}>حفظ وإعادة فحص المطابقة</button><button type="button" onClick={onCancel} disabled={busy}>إلغاء</button></div>
  </form>;
}
