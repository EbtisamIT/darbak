import React, { useState } from "react";

const labels = { official_company: "شركة رسمية", official_ats: "ATS رسمي", university: "جامعة",
  trusted_job_board: "موقع توظيف", social: "منصة اجتماعية", unknown: "غير معتمد" };
export default function SearchDiscoveryReport({ report }) {
  const [page, setPage] = useState(0);
  if (!report) return null;
  const results = report.results || [], pages = Math.max(1, Math.ceil(results.length / 20));
  const current = Math.min(page, pages - 1);
  return <div className="oi-search-report">
    {report.error && <p role="alert" className="oi-error">{report.error}</p>}
    <details><summary>استعلامات البحث ({report.queries?.length || 0})</summary>
      <ol>{report.queries?.map((q, i) => <li key={i}><bdi>{q.query}</bdi><p>{q.count} نتيجة · <bdi>{q.code}</bdi></p></li>)}</ol>
    </details>
    <details open><summary>الروابط وتصنيفها ({results.length})</summary>
      <ol>{results.slice(current * 20, (current + 1) * 20).map((row) => <li key={row.url}>
        <a href={row.url} target="_blank" rel="noreferrer">{row.title || row.domain}</a>
        <p><span>{labels[row.classification] || row.classification}</span> · {row.accepted ? "مؤهل للاستخراج" : "لن يُجلب تلقائيًا"}</p>
        <p dir="ltr">{row.url}</p><p><bdi>{row.reason}</bdi></p>
        <details><summary>مصدر الاكتشاف</summary><p>{row.description}</p>
          <p>تاريخ نتيجة البحث: {row.publishedAt ? new Date(row.publishedAt).toLocaleDateString("ar-SA") : "غير متوفر"}</p>
          <p>تاريخ البحث ليس تاريخ الإعلان المؤكد.</p>
          <ul>{row.discoveredByQueries?.map((q) => <li key={q}><bdi>{q}</bdi></li>)}</ul>
        </details>
      </li>)}</ol>
      {pages > 1 && <div className="oi-actions"><button disabled={current === 0} onClick={() => setPage(current - 1)}>السابق</button>
        <span>{current + 1} / {pages}</span><button disabled={current + 1 >= pages} onClick={() => setPage(current + 1)}>التالي</button></div>}
    </details>
  </div>;
}
