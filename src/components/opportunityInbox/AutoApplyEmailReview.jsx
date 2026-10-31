import React, { useEffect, useState } from "react";
import axios from "axios";
import API_BASE_URL from "../../config/api";

const endpoint = `${API_BASE_URL}/api/admin/opportunity-candidates/email-network`;
const labels = { active_opportunity: "فرصة نشطة", evergreen_training: "قناة تدريب دائمة", hr_general: "موارد بشرية عامة", unknown: "غير معروف" };
const statuses = { verified: "موثق", likely: "مرجح", unverified: "غير موثق", rejected: "مرفوض" };
export const reviewDisplayStatus = (row) => {
  const review = row.review;
  const status = review?.verificationStatus || row.initialStatus;
  if (status === "verified") {
    const hasMajor = review?.allMajors || review?.majors?.length > 0;
    const hasLocation = review?.allSaudi || review?.remote || review?.cities?.length > 0;
    return hasMajor && hasLocation ? "✅ موثق محدد التخصص والموقع" : "✅ قناة تدريب موثقة عامة";
  }
  if (status === "likely") return "🟡 مرجح";
  if (status === "rejected") return "❌ مستبعد";
  return statuses.unverified;
};
const rejectionReasons = { support_only: "خدمة عملاء فقط", general_contact_only: "تواصل عام فقط", careers_but_no_training_evidence: "توظيف دون دليل تدريب", personal_employee_email: "بريد موظف شخصي", expired_opportunity_only: "إعلان منتهٍ فقط", portal_required: "التقديم عبر بوابة", no_official_evidence: "لا يوجد دليل رسمي" };
const evidenceTypes = {
  official_training_page: "صفحة تدريب رسمية", official_careers_page: "صفحة توظيف رسمية",
  official_training_announcement: "إعلان تدريب رسمي حالي", historical_official_training_announcement: "إعلان تدريب رسمي قديم",
  repeated_official_training_announcements: "إعلانات تدريب رسمية متكررة",
  official_social_post: "منشور رسمي", official_company_reply: "رد رسمي من الجهة",
};
const blank = {
  channelType: "unknown", verificationStatus: "unverified", evidenceUrl: "", evidenceType: "",
  evidenceTextSummary: "", evidenceDate: "", expiresAt: "", activeOpportunityId: "",
  reviewerNote: "", rejectionReason: "",
  majors: "", cities: "", allMajors: false, allSaudi: false, remote: false,
  availabilityMode: "", seasonNote: "",
};
const formatDate = (value) => value ? String(value).slice(0, 10) : "";
const outreachLabels = { not_contacted: "لم يتم التواصل", verification_sent: "تم التواصل", waiting_response: "بانتظار الرد", followup_sent: "أرسلت متابعة", verified_from_reply: "موثق برد رسمي", rejected_from_reply: "مستبعد برد رسمي", no_response: "لا يوجد رد" };
export const verificationMessage = (row) => `السلام عليكم، فريق ${row.company}،\n\nنتواصل من منصة دربك للتحقق من قناة استقبال طلبات التدريب. هل يستقبل البريد ${row.email} طلبات التدريب التعاوني أو التدريب العملي من الطلاب؟ وإذا نعم، هل التقديم متاح طوال العام أم في مواسم محددة؟ وما التخصصات ومدن التدريب أو خيار التدريب عن بُعد، إن كانت محددة؟\n\nهذه رسالة تحقق فقط، ولن نرسل طلبات طلاب قبل تأكيدكم. شكرًا لكم.`;
const editFrom = (row) => row.review ? {
  ...blank, ...row.review, evidenceDate: formatDate(row.review.evidenceDate), expiresAt: formatDate(row.review.expiresAt),
  majors: (row.review.majors || []).join("، "), cities: (row.review.cities || []).join("، "),
  activeOpportunityId: row.review.activeOpportunityId || "",
} : blank;
const split = (value) => String(value || "").split(/[,،\n]/).map((part) => part.trim()).filter(Boolean);

export default function AutoApplyEmailReview({ password }) {
  const [open, setOpen] = useState(false), [page, setPage] = useState(1), [status, setStatus] = useState("");
  const [data, setData] = useState(null), [editing, setEditing] = useState(null), [form, setForm] = useState(blank);
  const [replying, setReplying] = useState(null), [replyNote, setReplyNote] = useState(""), [replyDecision, setReplyDecision] = useState("pending"), [notice, setNotice] = useState("");
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
  const outreach = async (row, action, extra = {}) => {
    setSaving(true); setError("");
    try {
      await axios.post(`${endpoint}/${row.key}/outreach`, { action, ...extra }, { headers: { "x-admin-password": password } });
      setReplying(null); setReload((value) => value + 1);
    } catch (failure) { setError(failure.response?.data?.error || "تعذر حفظ متابعة التواصل."); }
    finally { setSaving(false); }
  };
  const copyVerificationMessage = async (row) => {
    try { await navigator.clipboard.writeText(verificationMessage(row)); setNotice(`نُسخت رسالة التحقق لـ${row.company}. لم تُرسل.`); }
    catch { setError("تعذر النسخ؛ تحققي من صلاحية الحافظة."); }
  };
  return <section className="oi-discovery" aria-label="مراجعة قنوات بريد التدريب">
    <button onClick={() => setOpen((value) => !value)} aria-expanded={open}>مراجعة قنوات بريد التدريب</button>
    {open && <div className="oi-email-network">
      <p>قائمة للمراجعة فقط. وجود البريد أو موقع مقر الجهة لا يثبت قبول طلبات التدريب، ولا يبدأ أي إرسال.</p>
      {data && <div>
        <p>{data.summary.candidateCompanies} جهة مرشحة · {data.summary.candidateEmails} بريد فريد · {data.summary.candidatePairs} جهة/بريد · {data.summary.reviewed} مراجعة محفوظة</p>
        <p>{data.summary.verifiedActive} جهة نشطة موثقة · {data.summary.verifiedEvergreen} جهة دائمة موثقة · {data.summary.verifiedUniqueCompanies} جهة موثقة فريدة</p>
        <p>{data.summary.likely} مرجح · {data.summary.unverified} غير موثق · {data.summary.rejected} مرفوض · {data.summary.evidenceOlderThan12Months} دليل مراجع أقدم من سنة</p>
        <p>تم التواصل: {data.outreach?.contacted || 0} · بانتظار الرد: {data.outreach?.awaitingResponse || 0} · موثق من رد: {data.outreach?.verifiedFromReplies || 0} · مستبعد من رد: {data.outreach?.rejectedFromReplies || 0} · بلا رد: {data.outreach?.noResponse || 0}</p>
      </div>}
      {notice && <p role="status">{notice}</p>}
      <label>حالة المراجعة <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">الكل</option>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {loading && <p role="status">جارٍ تحميل المرشحين...</p>}
      {error && <p className="oi-error" role="alert">{error}</p>}
      {!loading && (data?.data || []).map((row) => <article key={row.key} className="oi-email-candidate">
        <strong>{row.company}</strong> · <bdi>{row.email}</bdi> · {reviewDisplayStatus(row)}
        <p>الغرض المبدئي: {row.detectedPurpose} · {row.hqCity ? `مقر الجهة: ${row.hqCity}` : "مقر الجهة غير معروف"}</p>
        <p>المصادر: {row.sourceNames.join("، ")}</p>
        {row.sourceHints?.length > 0 && <p>ملاحظات المصدر (غير موثقة): {row.sourceHints.join(" · ")}</p>}
        <p>الدليل المراجع: {row.review?.evidenceTextSummary || "لم يُراجع بعد"} · تاريخ الدليل: {formatDate(row.review?.evidenceDate) || "غير معروف"}</p>
        {row.review?.rejectionReason && <p>سبب الاستبعاد: {rejectionReasons[row.review.rejectionReason]}</p>}
        <p>تخصصات التدريب المثبتة: {row.review?.allMajors ? "جميع التخصصات" : row.review?.majors?.join("، ") || "غير معروفة"} · مدن التدريب المثبتة: {row.review?.allSaudi ? "جميع المدن" : row.review?.cities?.join("، ") || "غير معروفة"}</p>
        {row.review?.verificationContactedAt && <p>متابعة التحقق: {outreachLabels[row.review.outreachStatus] || outreachLabels.not_contacted} · تواصل: {formatDate(row.review.verificationContactedAt)}{row.review.needsFollowup ? " · يحتاج متابعة" : ""}</p>}
        {row.evidenceUrls.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer">مصدر مرشح</a>)}
        <button type="button" onClick={() => { setEditing(row); setForm(editFrom(row)); }}>مراجعة البريد والدليل</button>
        {((row.review?.verificationStatus || row.initialStatus) === "likely" || row.review?.verificationContactedAt) && <div className="oi-actions">
          {(row.review?.verificationStatus || row.initialStatus) === "likely" && <button type="button" onClick={() => copyVerificationMessage(row)}>نسخ رسالة التحقق</button>}
          {!row.review?.verificationContactedAt && <button type="button" disabled={saving} onClick={() => outreach(row, "mark_contacted")}>تم التواصل</button>}
          {row.review?.outreachStatus === "verification_sent" && <button type="button" disabled={saving} onClick={() => outreach(row, "mark_waiting")}>بانتظار الرد</button>}
          {row.review?.verificationContactedAt && !["verified_from_reply", "rejected_from_reply"].includes(row.review.outreachStatus) && <button type="button" onClick={() => { setReplying(row); setReplyNote(row.review?.verificationResponseNote || ""); setReplyDecision("pending"); }}>سجل الرد</button>}
          {row.review?.needsFollowup && <button type="button" disabled={saving} onClick={() => outreach(row, "mark_followup")}>تم إرسال متابعة واحدة</button>}
          {row.review?.verificationFollowupAt && !row.review?.verificationRespondedAt && row.review?.outreachStatus !== "no_response" && <button type="button" disabled={saving} onClick={() => outreach(row, "mark_no_response")}>لا يوجد رد</button>}
        </div>}
      </article>)}
      {replying && <section className="oi-detail" aria-label="تسجيل رد الجهة">
        <h3>رد {replying.company}</h3>
        <p>سجلي الرد هنا، ثم راجعي دليله قبل اعتماد القناة. تسجيل الرد لا يوثق البريد تلقائيًا.</p>
        <label>خلاصة الرد <textarea value={replyNote} onChange={(event) => setReplyNote(event.target.value)} /></label>
        <label>نتيجة المراجعة <select value={replyDecision} onChange={(event) => setReplyDecision(event.target.value)}><option value="pending">يحتاج مراجعة الدليل</option><option value="verified">موثق بعد حفظ الدليل الرسمي</option><option value="rejected">مستبعد بعد حفظ السبب</option></select></label>
        <div className="oi-actions"><button disabled={saving} onClick={() => outreach(replying, "record_response", { note: replyNote, decision: replyDecision })}>حفظ الرد</button><button onClick={() => setReplying(null)}>إغلاق</button></div>
      </section>}
      {data && <nav className="oi-actions" aria-label="صفحات قنوات البريد"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>السابق</button><span>{page} / {Math.max(1, data.pages)}</span><button disabled={page >= data.pages} onClick={() => setPage(page + 1)}>التالي</button></nav>}
      {editing && <section className="oi-detail" aria-label="تحرير قناة البريد"><h3>{editing.company} · <bdi>{editing.email}</bdi></h3>
        <p>أدخلي فقط التخصصات ومدن التدريب التي يذكرها الدليل صراحة. مدينة المقر لا تنتقل تلقائيًا.</p>
        <label>نوع القناة <select value={form.channelType} onChange={(event) => setForm({ ...form, channelType: event.target.value })}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>رابط الدليل <input dir="ltr" value={form.evidenceUrl} onChange={(event) => setForm({ ...form, evidenceUrl: event.target.value })} /></label>
        <label>نوع الدليل <select value={form.evidenceType} onChange={(event) => setForm({ ...form, evidenceType: event.target.value })}><option value="">حددي نوع الدليل</option>{Object.entries(evidenceTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>ماذا يثبت الدليل؟ <textarea value={form.evidenceTextSummary} onChange={(event) => setForm({ ...form, evidenceTextSummary: event.target.value })} /></label>
        <label>ملاحظة المراجع <textarea value={form.reviewerNote} onChange={(event) => setForm({ ...form, reviewerNote: event.target.value })} /></label>
        <label>سبب الاستبعاد <select value={form.rejectionReason} onChange={(event) => setForm({ ...form, rejectionReason: event.target.value })}><option value="">لا يوجد</option>{Object.entries(rejectionReasons).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>تاريخ الدليل <input type="date" value={form.evidenceDate} onChange={(event) => setForm({ ...form, evidenceDate: event.target.value })} /></label>
        <label>انتهاء الصلاحية أو الإعلان <input type="date" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} /></label>
        <label>توفر التدريب <select value={form.availabilityMode || ""} onChange={(event) => setForm({ ...form, availabilityMode: event.target.value })}><option value="">غير معروف</option><option value="evergreen">طوال العام</option><option value="seasonal">موسمي</option></select></label>
        <label>ملاحظة الموسم <input value={form.seasonNote || ""} onChange={(event) => setForm({ ...form, seasonNote: event.target.value })} /></label>
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
