import React from "react";
import { FiExternalLink, FiEdit2, FiCheck, FiX } from "react-icons/fi";
import { programLabels } from "./candidateLabels";
import { inboxStatus, opportunityDraft } from "./opportunityDraft";

export const simpleStatusLabels = { ready_for_review: "جاهزة للمراجعة", needs_verification: "تحتاج تحقق", duplicate: "مكررة", update_existing: "تحديث مقترح", rejected: "مرفوضة", published: "منشورة" };
export function CandidateLinks({ item, showEvidence = false }) {
  const draft = opportunityDraft(item);
  const extra = [...new Set(item.evidenceLinks || [])].filter((url) => url !== draft.sourceUrl && url !== draft.applicationUrl);
  return <div className="oi-actions">
    {draft.sourceUrl && <a href={draft.sourceUrl} target="_blank" rel="noreferrer"><FiExternalLink />فتح الإعلان الأصلي</a>}
    {draft.applicationUrl && <a href={/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.applicationUrl) ? `mailto:${draft.applicationUrl}` : draft.applicationUrl} target="_blank" rel="noreferrer"><FiExternalLink />فتح رابط التقديم</a>}
    {showEvidence && extra.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer">مصدر إضافي {index + 1}</a>)}
  </div>;
}
export default function CandidateCard({ item, busy, onAction }) {
  const draft = opportunityDraft(item), status = inboxStatus(item);
  const locked = ["published", "rejected"].includes(status);
  return <article className="oi-card"><header>
    {draft.logoUrl ? <img src={draft.logoUrl} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <span className="oi-logo">{draft.organizationName?.slice(0, 1) || "؟"}</span>}
    <div><small>{draft.organizationName || "جهة غير محددة"}</small><h3><button className="oi-title" onClick={() => onAction("edit", item)}>{draft.title || "بدون عنوان"}</button></h3></div>
    <span className="oi-status" data-status={status}>{simpleStatusLabels[status]}</span>
  </header>
    <div className="oi-meta"><span>{draft.cities?.join("، ") || draft.city || "المدينة غير مذكورة"}</span><span>{programLabels[item.programType] || "غير محدد"}</span></div>
    <p>{draft.specialties?.join("، ") || draft.majorCategories?.join("، ") || "التخصصات غير مذكورة"}</p>
    {item.isDemo && <p className="oi-demo">بيانات تجريبية — غير قابلة للنشر</p>}
    <CandidateLinks item={item} />
    <div className="oi-actions">
      <button disabled={busy || locked} onClick={() => onAction("edit", item)}><FiEdit2 />تعديل</button>
      {status === "update_existing" ? <button disabled={busy || item.isDemo} onClick={() => onAction("compare", item)}>تطبيق التحديث</button> :
        <button className="oi-primary" disabled={busy || locked || status === "duplicate" || item.isDemo} onClick={() => onAction("publish", item)}><FiCheck />نشر</button>}
      <button disabled={busy || locked} onClick={() => onAction("reject", item)}><FiX />رفض</button>
    </div>
  </article>;
}
