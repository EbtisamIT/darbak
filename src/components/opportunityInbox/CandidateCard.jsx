import React from "react";
import { FiExternalLink, FiEye, FiEdit2, FiCheck, FiX, FiCopy } from "react-icons/fi";
import { statusLabels, programLabels, sourceLabels, verificationLabels, fieldLabels, formatValue, dateValue } from "./candidateLabels";

export function CandidateContent({ item }) {
  return <>
    <div className="oi-meta"><span>{programLabels[item.programType]}</span><span>{sourceLabels[item.sourceType]}</span><span>{formatValue(item.cities)}</span>{item.remote && <span>عن بُعد</span>}</div>
    <p>{formatValue(item.majors)}</p><p className="oi-description">{item.description || "الوصف غير مذكور"}</p>
    <div className="oi-two"><div><strong>المهام</strong>{item.responsibilities?.length ? <ul>{item.responsibilities.map((v, i) => <li key={i}>{v}</li>)}</ul> : <p>المهام غير مذكورة</p>}</div>
      <div><strong>الشروط</strong>{item.requirements?.length ? <ul>{item.requirements.map((v, i) => <li key={i}>{v}</li>)}</ul> : <p>الشروط غير مذكورة</p>}</div></div>
    <div className="oi-meta"><span>آخر موعد: {dateValue(item.deadline) || "غير مذكور"}</span><span>بداية التدريب: {dateValue(item.trainingStartDate) || "غير مذكورة"}</span></div>
    {["applicationUrl", "sourceUrl"].map((field) => item[field] && <div className="oi-link" key={field}><small>{fieldLabels[field]}</small><a href={item[field]} target="_blank" rel="noreferrer"><FiExternalLink />{item[field]}</a></div>)}
    <div className="oi-verification">{Object.entries(verificationLabels).map(([key, label]) => <span key={key} data-result={String(item.verification?.[key])}>{item.verification?.[key] == null ? "؟" : item.verification[key] ? "✓" : "×"} {label}</span>)}</div>
    {item.missingFields?.length > 0 && <p>الناقص: {item.missingFields.map((f) => fieldLabels[f] || f).join("، ")}</p>}
    {item.discoveredEmails?.map((entry, i) => <div className="oi-email" key={i}><b dir="ltr">{entry.email}</b><span>{entry.type} · الثقة {entry.confidence}% {entry.existing ? "· موجود مسبقًا (Existing)" : ""}</span>{entry.sourceUrl && <a href={entry.sourceUrl} target="_blank" rel="noreferrer">مصدر البريد <FiExternalLink /></a>}</div>)}
    {item.aiNotes && <p className="oi-notes">ملاحظات: {item.aiNotes}</p>}
  </>;
}
export default function CandidateCard({ item, busy, onAction }) {
  const locked = ["published", "rejected"].includes(item.status);
  return <article className="oi-card"><header>
    {item.companyLogo ? <img src={item.companyLogo} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} /> : <span className="oi-logo">{item.company?.slice(0, 1) || "؟"}</span>}
    <div><small>{item.company || "جهة غير محددة"}</small><h3>{item.title || "بدون عنوان"}</h3></div>
    <span className="oi-status" data-status={item.status}>{statusLabels[item.status]}</span></header>
    {item.isDemo && <p className="oi-demo">بيانات تجريبية — غير قابلة للنشر</p>}
    <div className="oi-confidence"><span>الثقة {item.confidenceScore}%</span><meter min="0" max="100" value={item.confidenceScore} aria-label="درجة الثقة" /></div>
    <CandidateContent item={item} />
    <div className="oi-actions">
      <button disabled={busy} onClick={() => onAction("preview", item)}><FiEye />معاينة</button>
      <button disabled={busy || locked} onClick={() => onAction("edit", item)}><FiEdit2 />تعديل</button>
      {item.status === "update_existing" ? <button disabled={busy} onClick={() => onAction("compare", item)}>مقارنة الحالي بالجديد</button> : <button className="oi-primary" disabled={busy || item.status !== "ready" || item.isDemo} onClick={() => onAction("publish", item)}><FiCheck />نشر</button>}
      <button disabled={busy || locked} onClick={() => onAction("reject", item)}><FiX />رفض</button>
      <button disabled={busy || locked} onClick={() => onAction("duplicate", item)}><FiCopy />تحديد كمكرر</button>
    </div>
  </article>;
}
