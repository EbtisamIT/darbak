import React, { useState } from "react";
import { fieldLabels, formatValue } from "./candidateLabels";

export default function CandidateComparison({ detail, busy, onApply }) {
  const [selected, setSelected] = useState([]);
  if (!detail.existing) return <p>الفرصة الأصلية غير متوفرة للمقارنة.</p>;
  return <section className="oi-comparison"><h3>البيانات الحالية والمقترحة</h3>
    {detail.diff.map(({ field, before, after, changed }) => <div className="oi-diff" key={field}>
      <label className="oi-check"><input type="checkbox" disabled={!changed || busy || detail.candidate.isDemo} checked={selected.includes(field)} onChange={(e) => setSelected((prev) => e.target.checked ? [...prev, field] : prev.filter((v) => v !== field))} />{fieldLabels[field] || field}{!changed && " · بدون تغيير"}</label>
      <div><small>الحالي</small><p>{formatValue(before)}</p></div><div><small>المقترح</small><p>{formatValue(after)}</p></div>
    </div>)}
    <button className="oi-primary" disabled={busy || !selected.length || detail.candidate.isDemo} onClick={() => onApply(selected, detail.existing.updatedAt)}>تطبيق الحقول المختارة</button>
  </section>;
}
