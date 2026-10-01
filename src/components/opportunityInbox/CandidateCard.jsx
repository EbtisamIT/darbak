import React from "react";
import { FiExternalLink, FiEye, FiEdit2, FiCheck, FiX, FiCopy, FiRefreshCw } from "react-icons/fi";
import { statusLabels, reviewLabels, programLabels, sourceLabels, verificationLabels, pageAvailabilityLabels, applicationStateLabels, fieldLabels, formatValue, dateValue } from "./candidateLabels";
import { candidateOrigin } from "./candidateOrigin";

export function CandidateContent({ item }) {
  return <>
    <div className="oi-meta"><span aria-label="مصدر الاكتشاف"><bdi>{candidateOrigin(item)}</bdi></span></div>
    {item.importedVia === "agent" && <details><summary>بيانات الاستيراد من الوكيل</summary>
      <p>المصدر: <bdi>{item.importSource}</bdi></p>
      <p>الدفعة: <bdi>{item.importRunId}</bdi></p>
      <p>تاريخ الاستيراد: {dateValue(item.importedAt)}</p>
      <p>بيانات واردة من الوكيل، ولا تمثل تحققًا رسميًا من الإعلان.</p>
    </details>}
    <div className="oi-meta"><span>{programLabels[item.programType]}</span><span>{sourceLabels[item.sourceType]}</span><span>{formatValue(item.cities)}</span>{item.remote && <span>عن بُعد</span>}</div>
    <p>{item.majorScope === "all" ? "جميع التخصصات" : item.majorScope === "broad" ? formatValue(item.rawMajors) : formatValue(item.majors)}</p><p className="oi-description">{item.description || "الوصف غير مذكور"}</p>
    <div className="oi-two"><div><strong>المهام</strong>{item.responsibilities?.length ? <ul>{item.responsibilities.map((v, i) => <li key={i}>{v}</li>)}</ul> : <p>المهام غير مذكورة</p>}</div>
      <div><strong>الشروط</strong>{item.requirements?.length ? <ul>{item.requirements.map((v, i) => <li key={i}>{v}</li>)}</ul> : <p>الشروط غير مذكورة</p>}</div></div>
    <div className="oi-meta"><span>تاريخ النشر: {dateValue(item.postedAt) || "غير مذكور"}</span><span>آخر موعد: {dateValue(item.deadline) || "غير مذكور"}</span><span>بداية التدريب: {dateValue(item.trainingStartDate) || "غير مذكورة"}</span></div>
    {item.completenessScore != null && <div className="oi-confidence"><span>اكتمال البيانات {item.completenessScore}%</span><meter min="0" max="100" value={item.completenessScore} aria-label="اكتمال البيانات" /></div>}
    {["applicationUrl", "sourceUrl"].map((field) => item[field] && <div className="oi-link" key={field}><small>{fieldLabels[field]}</small><a href={item[field]} target="_blank" rel="noreferrer"><FiExternalLink />{item[field]}</a></div>)}
    <div className="oi-verification">{Object.entries(verificationLabels).map(([key, label]) => <span key={key} data-result={String(item.verification?.[key])}>{item.verification?.[key] == null ? "؟" : item.verification[key] ? "✓" : "×"} {label}</span>)}</div>
    {(item.pageAvailability || item.applicationState) && <div className="oi-meta">
      {item.pageAvailability && <span>{pageAvailabilityLabels[item.pageAvailability]}</span>}
      {item.applicationState && <span>{applicationStateLabels[item.applicationState]}</span>}
    </div>}
    {item.verificationWarnings?.map((warning) => <p className="oi-notes" key={warning}>{warning}</p>)}
    {item.missingFields?.length > 0 && <p>الناقص: {item.missingFields.map((f) => f === "duration" ? "مدة التدريب" : f === "programType" ? "نوع البرنامج" : fieldLabels[f] || f).join("، ")}</p>}
    {item.discoveredEmails?.map((entry, i) => <div className="oi-email" key={i}><b dir="ltr">{entry.email}</b><span>{entry.type} · الثقة {entry.confidence}% {entry.existing ? "· موجود مسبقًا (Existing)" : ""}</span>{entry.sourceUrl && <a href={entry.sourceUrl} target="_blank" rel="noreferrer">مصدر البريد <FiExternalLink /></a>}</div>)}
    {item.aiNotes && <p className="oi-notes">ملاحظات: {item.aiNotes}</p>}
    {item.duration && <p>مدة التدريب: {item.duration}</p>}
    {item.verificationNotes && <p className="oi-notes">ملاحظات المصدر غير المتحقق منها: {item.verificationNotes}</p>}
    {item.extractionEvidence && <details><summary>أدلة الاستخراج</summary>{Object.entries(item.extractionEvidence).map(([field, evidence]) => <div key={field}>
      <strong>{fieldLabels[field] || field}</strong><p><bdi>{evidence.method}</bdi>{evidence.heading && ` · ${evidence.heading}`}</p>
      {evidence.rawText && <p className="oi-description">{evidence.rawText}</p>}
      <a href={evidence.sourceUrl} target="_blank" rel="noreferrer">المصدر <FiExternalLink /></a>
    </div>)}</details>}
    {item.searchDiscovery?.provider && <details><summary>بيانات اكتشاف البحث</summary>
      <p>Discovered via: {item.searchDiscovery.provider === "brave" ? "Brave Search" : item.searchDiscovery.provider}</p>
      <p>عنوان نتيجة البحث: {item.searchDiscovery.resultTitle}</p>
      <p>أول اكتشاف: {dateValue(item.searchDiscovery.firstDiscoveredAt) || "غير متوفر"}</p>
      <ul>{item.searchDiscovery.discoveredByQueries?.map((query) => <li key={query}><bdi>{query}</bdi></li>)}</ul>
    </details>}
  </>;
}
export default function CandidateCard({ item, busy, onAction }) {
  const locked = ["published", "rejected"].includes(item.status);
  return <article className="oi-card"><header>
    {item.companyLogo ? <img src={item.companyLogo} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} /> : <span className="oi-logo">{item.company?.slice(0, 1) || "؟"}</span>}
    <div><small>{item.company || "جهة غير محددة"}</small><h3>{item.title || "بدون عنوان"}</h3></div>
    <span className="oi-status" data-status={item.status}>{!locked && reviewLabels[item.reviewStatus] ? reviewLabels[item.reviewStatus] : statusLabels[item.status]}</span></header>
    {item.isDemo && <p className="oi-demo">بيانات تجريبية — غير قابلة للنشر</p>}
    <div className="oi-confidence"><span>الثقة {item.confidenceScore}%</span><meter min="0" max="100" value={item.confidenceScore} aria-label="درجة الثقة" /></div>
    <CandidateContent item={item} />
    <div className="oi-actions">
      <button disabled={busy} onClick={() => onAction("preview", item)}><FiEye />معاينة</button>
      <button disabled={busy || locked} onClick={() => onAction("edit", item)}><FiEdit2 />تعديل</button>
      <button disabled={busy || locked || item.isDemo || !item.sourceUrl} onClick={() => onAction("retry-enrichment", item)}><FiRefreshCw />إعادة الإثراء</button>
      {item.status === "update_existing" ? <button disabled={busy} onClick={() => onAction("compare", item)}>مقارنة الحالي بالجديد</button> : <button className="oi-primary" disabled={busy || item.status !== "ready" || item.isDemo} onClick={() => onAction("publish", item)}><FiCheck />نشر</button>}
      <button disabled={busy || locked} onClick={() => onAction("reject", item)}><FiX />رفض</button>
      <button disabled={busy || locked} onClick={() => onAction("duplicate", item)}><FiCopy />تحديد كمكرر</button>
    </div>
  </article>;
}
