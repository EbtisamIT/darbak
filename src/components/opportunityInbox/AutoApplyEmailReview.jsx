import React, { useEffect, useState } from "react";
import axios from "axios";
import API_BASE_URL from "../../config/api";

const endpoint = `${API_BASE_URL}/api/admin/opportunity-candidates/email-network`;
const labels = { active_opportunity: "فرصة نشطة", evergreen_training: "قناة تدريب دائمة", hr_general: "موارد بشرية عامة", unknown: "غير معروف" };
const statuses = { verified: "موثق", likely: "مرجح", unverified: "غير موثق", rejected: "مرفوض" };
const evidenceTypes = {
  official_training_page: "صفحة تدريب رسمية", official_careers_page: "صفحة توظيف رسمية",
  official_training_announcement: "إعلان تدريب رسمي حالي", historical_official_training_announcement: "إعلان تدريب رسمي قديم",
  repeated_official_training_announcements: "إعلانات تدريب رسمية متكررة",
  official_social_post: "منشور رسمي", official_company_reply: "رد رسمي من الجهة",
};
const blank = {
  channelType: "unknown", verificationStatus: "unverified", evidenceUrl: "", evidenceType: "",
  evidenceTextSummary: "", evidenceDate: "", expiresAt: "", activeOpportunityId: "",
  majors: "", cities: "", allMajors: false, allSaudi: false, remote: false,
};
const formatDate = (value) => value ? String(value).slice(0, 10) : "";
const editFrom = (row) => row.review ? {
  ...blank, ...row.review, evidenceDate: formatDate(row.review.evidenceDate), expiresAt: formatDate(row.review.expiresAt),
  majors: (row.review.majors || []).join("، "), cities: (row.review.cities || []).join("، "),
  activeOpportunityId: row.review.activeOpportunityId || "",
} : blank;
const split = (value) => String(value || "").split(/[,،\n]/).map((part) => part.trim()).filter(Boolean);

export default function AutoApplyEmailReview({ password }) {
  const [open, setOpen] = useState(false), [page, setPage] = useState(1), [status, setStatus] = useState("");
  const [data, setData] = useState(null), [editing, setEditing] = useState(null), [form, setForm] = useState(blank);
  const [loading, setLoading] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState(""), [reload, setReload] = useState(0);
  useEffect(() => {
    if (!open || !password) return undefined;
    const controller = new AbortController();
    setLoading(true); setError("");
    axios.get(endpoint, { headers: { "x-admin-password": password }, params: { page, status }, signal: controller.signal })
      .then(({ data: result }) => setData(result))
      .catch(() => { if (!controller.signal.aborted) setError("تعذر تحميل قنوات البريد."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, password, page, status, reload]);
  const save = async (nextStatus, nextChannel) => {
    setSaving(true); setError("");
    try {
      await axios.post(`${endpoint}/${editing.key}/review`, {
        ...form, verificationStatus: nextStatus, channelType: nextChannel || form.channelType,
        majors: split(form.majors), cities: split(form.cities),
      }, { headers: { "x-admin-password": password } });
      setEditing(null); setReload((value) => value + 1);
    } catch (failure) { setError(failure.response?.data?.error || "تعذر حفظ المراجعة."); }
    finally { setSaving(false); }
  };
  return <section className="oi-discovery" aria-label="مراجعة قنوات بريد التدريب">
    <button onClick={() => setOpen((value) => !value)} aria-expanded={open}>مراجعة قنوات بريد التدريب</button>
    {open && <div className="oi-email-network">
      <p>قائمة للمراجعة فقط. وجود البريد أو موقع مقر الجهة لا يثبت قبول طلبات التدريب، ولا يبدأ أي إرسال.</p>
      {data && <p>{data.summary.candidateCompanies} جهة مرشحة · {data.summary.candidateEmails} بريد فريد · {data.summary.verifiedActive} جهة نشطة موثقة · {data.summary.verifiedEvergreen} جهة دائمة موثقة</p>}
      <label>حالة المراجعة <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">الكل</option>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {loading && <p role="status">جارٍ تحميل المرشحين...</p>}
      {error && <p className="oi-error" role="alert">{error}</p>}
      {!loading && (data?.data || []).map((row) => <article key={row.key} className="oi-email-candidate">
        <strong>{row.company}</strong> · <bdi>{row.email}</bdi> · {statuses[row.review?.verificationStatus || row.initialStatus]}
        <p>الغرض المبدئي: {row.detectedPurpose} · {row.hqCity ? `مقر الجهة: ${row.hqCity}` : "مقر الجهة غير معروف"}</p>
        <p>المصادر: {row.sourceNames.join("، ")}</p>
        {row.sourceHints?.length > 0 && <p>ملاحظات المصدر (غير موثقة): {row.sourceHints.join(" · ")}</p>}
        <p>الدليل المراجع: {row.review?.evidenceTextSummary || "لم يُراجع بعد"} · تاريخ الدليل: {formatDate(row.review?.evidenceDate) || "غير معروف"}</p>
        <p>تخصصات التدريب المثبتة: {row.review?.allMajors ? "جميع التخصصات" : row.review?.majors?.join("، ") || "غير معروفة"} · مدن التدريب المثبتة: {row.review?.allSaudi ? "جميع المدن" : row.review?.cities?.join("، ") || "غير معروفة"}</p>
        {row.evidenceUrls.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer">مصدر مرشح</a>)}
        <button type="button" onClick={() => { setEditing(row); setForm(editFrom(row)); }}>مراجعة البريد والدليل</button>
      </article>)}
      {data && <nav className="oi-actions" aria-label="صفحات قنوات البريد"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>السابق</button><span>{page} / {Math.max(1, data.pages)}</span><button disabled={page >= data.pages} onClick={() => setPage(page + 1)}>التالي</button></nav>}
      {editing && <section className="oi-detail" aria-label="تحرير قناة البريد"><h3>{editing.company} · <bdi>{editing.email}</bdi></h3>
        <p>أدخلي فقط التخصصات ومدن التدريب التي يذكرها الدليل صراحة. مدينة المقر لا تنتقل تلقائيًا.</p>
        <label>نوع القناة <select value={form.channelType} onChange={(event) => setForm({ ...form, channelType: event.target.value })}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>رابط الدليل <input dir="ltr" value={form.evidenceUrl} onChange={(event) => setForm({ ...form, evidenceUrl: event.target.value })} /></label>
        <label>نوع الدليل <select value={form.evidenceType} onChange={(event) => setForm({ ...form, evidenceType: event.target.value })}><option value="">حددي نوع الدليل</option>{Object.entries(evidenceTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>ماذا يثبت الدليل؟ <textarea value={form.evidenceTextSummary} onChange={(event) => setForm({ ...form, evidenceTextSummary: event.target.value })} /></label>
        <label>تاريخ الدليل <input type="date" value={form.evidenceDate} onChange={(event) => setForm({ ...form, evidenceDate: event.target.value })} /></label>
        <label>انتهاء الصلاحية أو الإعلان <input type="date" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} /></label>
        <label>تخصصات مثبتة بالدليل <input value={form.majors} onChange={(event) => setForm({ ...form, majors: event.target.value })} placeholder="افصلي بفاصلة" /></label>
        <label><input type="checkbox" checked={form.allMajors} onChange={(event) => setForm({ ...form, allMajors: event.target.checked })} />الدليل ينص على جميع التخصصات</label>
        <label>مدن التدريب المثبتة <input value={form.cities} onChange={(event) => setForm({ ...form, cities: event.target.value })} placeholder="افصلي بفاصلة" /></label>
        <label><input type="checkbox" checked={form.allSaudi} onChange={(event) => setForm({ ...form, allSaudi: event.target.checked })} />الدليل ينص على جميع مناطق السعودية</label>
        <label><input type="checkbox" checked={form.remote} onChange={(event) => setForm({ ...form, remote: event.target.checked })} />الدليل ينص على تدريب عن بعد</label>
        <label>معرّف الفرصة النشطة إن وجد <input dir="ltr" value={form.activeOpportunityId} onChange={(event) => setForm({ ...form, activeOpportunityId: event.target.value })} /></label>
        <div className="oi-actions">
          <button disabled={saving} onClick={() => save("verified", "evergreen_training")}>توثيق دائم</button>
          <button disabled={saving} onClick={() => save("verified", "active_opportunity")}>توثيق نشط</button>
          <button disabled={saving} onClick={() => save("likely")}>مرجح</button>
          <button disabled={saving} onClick={() => save("rejected")}>رفض</button>
          <button disabled={saving} onClick={() => setEditing(null)}>إغلاق</button>
        </div>
      </section>}
      {data && <details><summary>التغطية الموثقة حسب التخصص والمدينة</summary>
        {[["التقديم على فرص نشطة", data.coverage.active], ["التقديم الاستباقي", data.coverage.evergreen]].map(([label, rows]) => <div key={label}><h4>{label}</h4>{rows.length ? <ul>{rows.map((item) => <li key={`${item.major}-${item.city}`}>{item.major} · {item.city}: {item.companies}</li>)}</ul> : <p>لا توجد قنوات موثقة لهذا النوع بعد.</p>}</div>)}
      </details>}
    </div>}
  </section>;
}
