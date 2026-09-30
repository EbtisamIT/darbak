import React, { useEffect, useState } from "react";
import axios from "axios";
import { FiPlay, FiRefreshCw } from "react-icons/fi";
import API_BASE_URL from "../../config/api";
import DiscoveryTools from "./DiscoveryTools";

const endpoint = `${API_BASE_URL}/api/admin/opportunity-candidates/discovery`;
const states = { running: "قيد التشغيل", completed: "اكتمل", partial: "اكتمل مع ملاحظات", failed: "تعذر الاكتشاف", interrupted: "توقف قبل الاكتمال" };
export default function DiscoveryPanel({ password, onComplete }) {
  const [expanded, setExpanded] = useState(false), [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!expanded || !password) return undefined;
    const controller = new AbortController(); let timer;
    const load = async () => {
      try {
        const { data } = await axios.get(endpoint, { headers: { "x-admin-password": password }, signal: controller.signal });
        if (controller.signal.aborted) return;
        setResult(data); setError("");
        if (data.run?.status === "running") timer = setTimeout(load, 5000);
        else onComplete();
      } catch (e) { if (!controller.signal.aborted) setError(e.response?.data?.error || "تعذر تحميل حالة الاكتشاف. حدّثي الحالة."); }
    };
    load(); return () => { controller.abort(); clearTimeout(timer); };
  }, [expanded, password, refresh, onComplete]);
  const run = async () => {
    setBusy(true); setError("");
    try {
      await axios.post(`${endpoint}/run`, {}, { headers: { "x-admin-password": password } });
      setResult((old) => ({ ...old, run: { status: "running" } })); setRefresh((v) => v + 1);
    } catch (e) { setError(e.response?.data?.error || "تعذر بدء الاكتشاف."); }
    finally { setBusy(false); }
  };
  return <section className="oi-discovery" aria-label="الاكتشاف الرسمي">
    <button onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>الاكتشاف من المصادر الرسمية</button>
    {expanded && <>
      <div className="oi-actions">
        <button onClick={run} disabled={busy || result?.run?.status === "running"}><FiPlay />Run Discovery Now</button>
        <button onClick={() => setRefresh((v) => v + 1)} disabled={busy}><FiRefreshCw />تحديث الحالة</button>
        <span role="status">{busy ? "جارٍ بدء الاكتشاف..." : states[result?.run?.status] || "لم يبدأ الاكتشاف"}</span>
      </div>
      {error && <p className="oi-error" role="alert">{error}</p>}
      {result && <p>البحث الخارجي: {result.searchConfigured ? "مهيأ" : "غير مهيأ"} · عرض المتصفح: {result.browserConfigured ? "مهيأ" : "غير مهيأ"}</p>}
      <DiscoveryTools endpoint={endpoint} password={password} sources={result?.sources || []} onRefresh={() => setRefresh((v) => v + 1)} />
      {result?.run?.summary && <div className="oi-summary">{[["sourcesChecked", "مصادر فُحصت"], ["searchQueriesRun", "استعلامات بحث"], ["urlsDiscovered", "روابط مكتشفة"], ["officialUrlsAccepted", "روابط رسمية"], ["urlsRejected", "روابط مرفوضة"], ["pagesFetched", "صفحات جُلبت"], ["fetchFailures", "تعذر جلبها"], ["trainingPagesDetected", "إعلانات تدريب"], ["opportunitiesExtracted", "إعلانات مستخرجة"], ["newCandidates", "مرشحون جدد"], ["duplicates", "مكررات"], ["updates", "تحديثات مقترحة"], ["emailLeads", "بريد مكتشف جديد"], ["closedOpportunities", "فرص مغلقة"], ["errors", "أخطاء"]].map(([key, label]) => <div key={key}><strong>{result.run.summary[key] || 0}</strong><span>{label}</span></div>)}</div>}
      <ul>{(result?.sources || []).map((source) => {
        const log = result.run?.sources?.find((row) => row.key === source.key);
        return <li key={source.key}><a href={source.sourceUrl} target="_blank" rel="noreferrer">{source.name}</a>
          {log && <span> · {log.found} فرصة · {(log.durationMs / 1000).toFixed(1)} ث · {log.status}</span>}
          {(log?.error || log?.warnings?.length > 0 || source.lastError) && <small dir="ltr">{log?.error || log?.warnings?.join(", ") || source.lastError}</small>}
          {log?.details?.length > 0 && <details><summary>تفاصيل المراحل ({log.details.length})</summary><ol>{log.details.map((detail, i) => <li key={i}><bdi>{detail.stage} · {detail.code}</bdi><p>{detail.title || detail.query}</p>{detail.url && <p dir="ltr">{detail.url}</p>}{detail.fetchMethod && <small>{detail.fetchMethod}</small>}</li>)}</ol></details>}
        </li>;
      })}</ul>
    </>}
  </section>;
}
