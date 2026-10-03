import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { FiRefreshCw, FiPlus } from "react-icons/fi";
import API_BASE_URL from "../../config/api";
import CandidateCard, { simpleStatusLabels } from "./CandidateCard";
import CandidateEditor from "./CandidateEditor";
import CandidateComparison from "./CandidateComparison";
import DiscoveryPanel from "./DiscoveryPanel";
import { programLabels } from "./candidateLabels";
import "./OpportunityInbox.css";

const endpoint = `${API_BASE_URL}/api/admin/opportunity-candidates`;
const emptyForm = { title: "", company: "", programType: "unknown", sourceType: "other", confidenceScore: 0, verification: {}, responsibilities: [], requirements: [], cities: [], majors: [], discoveredEmails: [] };

export default function OpportunityInbox({ password, refreshKey = 0, formOptions }) {
  const [result, setResult] = useState({ data: [], summary: {}, total: 0, pages: 0 });
  const [filters, setFilters] = useState({ status: "", programType: "", company: "", city: "" });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [detail, setDetail] = useState(null);
  const [mode, setMode] = useState("");
  const [reload, setReload] = useState(0);
  const refreshCandidates = useCallback(() => setReload((v) => v + 1), []);
  const request = useCallback((method, path = "", data) => axios({ method, url: `${endpoint}${path}`, data, headers: { "x-admin-password": password } }), [password]);
  useEffect(() => {
    if (!password) return;
    const controller = new AbortController();
    setLoading(true); setError("");
    axios.get(endpoint, { headers: { "x-admin-password": password }, params: { ...applied, page }, signal: controller.signal })
      .then(({ data }) => setResult(data))
      .catch((err) => { if (!controller.signal.aborted) setError(err.response?.data?.error || "تعذر تحميل صندوق الفرص. أعيدي المحاولة."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [password, applied, page, reload, refreshKey]);

  const mutate = async (method, path, body) => {
    setBusy(true); setError(""); setMessage("");
    try {
      await request(method, path, body);
      setDetail(null); setMode(""); setReload((v) => v + 1);
      setMessage("تمت العملية بنجاح.");
    } catch (err) { setError(err.response?.data?.error || "تعذر تنفيذ العملية. لم يتم تأكيد نجاحها."); }
    finally { setBusy(false); }
  };
  const action = async (nextMode, item) => {
    setError(""); setMessage("");
    if (["publish", "reject"].includes(nextMode)) {
      if (window.confirm(nextMode === "publish" ? "نشر هذه الفرصة في دربك؟" : "رفض هذا المرشح؟")) await mutate("post", `/${item._id}/${nextMode}`, {});
      return;
    }
    setBusy(true);
    try {
      const { data } = await request("get", `/${item._id}`);
      setDetail(data); setMode(nextMode);
    } catch (err) { setError(err.response?.data?.error || "تعذر فتح المرشح."); }
    finally { setBusy(false); }
  };
  if (!password) return <p>أدخلي كلمة مرور الإدارة لفتح صندوق الفرص.</p>;
  return <div className="opportunity-inbox" dir="rtl">
    <header className="oi-heading"><div><h2>Opportunity Inbox</h2><p>صندوق مراجعة الفرص المكتشفة</p></div><div className="oi-actions">
      <button onClick={() => { setDetail({ candidate: emptyForm }); setMode("create"); }} disabled={busy}><FiPlus />إضافة مرشح</button>
      <button onClick={() => setReload((v) => v + 1)} disabled={busy || loading}><FiRefreshCw />تحديث</button>
      {process.env.NODE_ENV === "development" && <button onClick={() => mutate("post", "/seed", {})} disabled={busy}>إضافة 5 حالات تجريبية</button>}
    </div></header>
    <DiscoveryPanel password={password} onComplete={refreshCandidates} />
    <div className="oi-summary">{[["discoveredToday", "اكتشفت اليوم (UTC)"], ["readyForReview", "جاهزة للمراجعة"], ["needsVerification", "تحتاج تحقق"], ["update_existing", "تحديثات"], ["duplicate", "مكررة"]].map(([key, label]) => <div key={key}><strong>{result.summary[key] || 0}</strong><span>{label}</span></div>)}</div>
    <form className="oi-filters" onSubmit={(e) => { e.preventDefault(); setPage(1); setApplied({ ...filters }); }}>
      {[["status", "الحالة", simpleStatusLabels], ["programType", "البرنامج", programLabels]].map(([field, label, options]) => <label key={field}>{label}<select value={filters[field] || ""} onChange={(e) => setFilters({ ...filters, [field]: e.target.value })}><option value="">الكل</option>{Object.entries(options).map(([v, text]) => <option key={v} value={v}>{text}</option>)}</select></label>)}
      {[ ["company", "الجهة"], ["city", "المدينة"] ].map(([field, label]) => <label key={field}>{label}<input value={filters[field]} onChange={(e) => setFilters({ ...filters, [field]: e.target.value })} /></label>)}
      <button disabled={loading}>تطبيق الفلاتر</button>
    </form>
    {error && <p className="oi-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    {detail && <section className="oi-detail" aria-label="تفاصيل المرشح"><div className="oi-heading"><h2>{detail.candidate.title || "مرشح جديد"}</h2><button disabled={busy} onClick={() => { setDetail(null); setMode(""); }}>إغلاق</button></div>
      {["edit", "create"].includes(mode) ? <CandidateEditor key={`${detail.candidate._id || "new"}-${mode}`} candidate={detail.candidate} formOptions={formOptions} busy={busy} onCancel={() => setDetail(null)} onSave={(data) => mutate(mode === "create" ? "post" : "patch", mode === "create" ? "" : `/${data._id}`, data)} /> :
        mode === "compare" ? <CandidateComparison key={detail.candidate._id} detail={detail} busy={busy} onApply={(fields, expectedUpdatedAt) => {
          if (window.confirm("تطبيق الحقول المختارة فقط على الفرصة الحالية؟")) mutate("post", `/${detail.candidate._id}/apply-update`, { fields, expectedUpdatedAt });
        }} /> : null}
    </section>}
    {loading ? <p role="status">جارٍ تحميل الفرص...</p> : <>
      <p>{result.total} مرشح</p>
      {!result.data.length && <p className="oi-empty">لا توجد فرص مكتشفة تطابق الفلاتر الحالية.</p>}
      <div className="oi-grid">{result.data.map((item) => <CandidateCard key={item._id} item={item} busy={busy} onAction={action} />)}</div>
      <nav className="oi-actions" aria-label="صفحات صندوق الفرص"><button disabled={page <= 1} onClick={() => setPage((v) => v - 1)}>السابق</button><span>{page} / {Math.max(1, result.pages)}</span><button disabled={page >= result.pages} onClick={() => setPage((v) => v + 1)}>التالي</button></nav>
    </>}
  </div>;
}
