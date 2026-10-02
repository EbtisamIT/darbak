import React, { useEffect, useState } from "react";
import axios from "axios";
import { FiPlay, FiRefreshCw } from "react-icons/fi";
import API_BASE_URL from "../../config/api";
import DiscoveryTools from "./DiscoveryTools";
import SearchDiscoveryReport from "./SearchDiscoveryReport";

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
  const run = async (mode) => {
    setBusy(true); setError("");
    try {
      await axios.post(`${endpoint}/run`, { mode, ...(mode === "full" ? { searchRunId: result.lastSearch._id } : {}) }, { headers: { "x-admin-password": password } });
      setResult((old) => ({ ...old, run: { status: "running" } })); setRefresh((v) => v + 1);
    } catch (e) { setError(e.response?.data?.error || "تعذر بدء الاكتشاف."); }
    finally { setBusy(false); }
  };
  return <section className="oi-discovery" aria-label="الاكتشاف الرسمي">
    <button onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>الاكتشاف من المصادر الرسمية</button>
    {expanded && <>
      <div className="oi-actions">
        <button onClick={() => run("automation")} disabled={busy || result?.run?.status === "running"}><FiPlay />Run Opportunity Automation</button>
        <button onClick={() => run("search-only")} disabled={busy || result?.run?.status === "running"}><FiPlay />Run Search Discovery Only</button>
        <button onClick={() => run("full")} disabled={busy || result?.run?.status === "running" || !["completed", "partial"].includes(result?.lastSearch?.status) || !result?.lastSearch?.summary?.officialUrlsAccepted}><FiPlay />Run Full Discovery</button>
        <button onClick={() => setRefresh((v) => v + 1)} disabled={busy}><FiRefreshCw />تحديث الحالة</button>
        <span role="status">{busy ? "جارٍ بدء الاكتشاف..." : states[result?.run?.status] || "لم يبدأ الاكتشاف"}</span>
      </div>
      {error && <p className="oi-error" role="alert">{error}</p>}
      {result && <p>البحث الخارجي: {result.searchConfigured ? "مهيأ" : "غير مهيأ"} · عرض المتصفح: {result.browserConfigured ? "مهيأ" : "غير مهيأ"}</p>}
      {result?.scheduling && <p>الجدولة غير مفعلة · 08:00 و20:00 بتوقيت الرياض · الحد اليومي {result.scheduling.maxDailyRuns} · الاستعلامات لكل جولة {result.scheduling.maxSearchQueriesPerRun}</p>}
      {result?.recentRuns?.length > 0 && <details><summary>آخر 10 تشغيلات</summary>
        <div className="oi-run-history"><table><thead><tr>{["البداية", "النهاية", "الحالة", "المدة (ث)", "استعلامات", "نتائج", "مرشحون", "مكررات", "تحديثات", "أخطاء"].map((label) => <th key={label}>{label}</th>)}</tr></thead>
          <tbody>{result.recentRuns.map((item) => <tr key={item._id}>
            <td>{new Date(item.startedAt).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })}</td>
            <td>{item.finishedAt ? new Date(item.finishedAt).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" }) : "—"}</td>
            <td>{states[item.status] || item.status}</td><td>{item.durationMs == null ? "—" : (item.durationMs / 1000).toFixed(1)}</td>
            {["queries", "results", "candidatesCreated", "duplicates", "updates", "errors"].map((key) => <td key={key}>{item[key]}</td>)}
          </tr>)}</tbody></table></div>
      </details>}
      {result?.run?.runType && <p>{result.run.runType === "search-only" ? "بحث فقط؛ لم تُجلب صفحات الإعلانات ولم يُنشأ مرشحون." : "فحص نتائج البحث؛ لا نشر تلقائي."}</p>}
      <SearchDiscoveryReport key={result?.run?._id} report={result?.run?.searchReport} />
      {result?.run?.summary && <div className="oi-summary">{[["pagesExtracted", "صفحات استُخرجت"], ["opportunitiesEnriched", "فرص أُثريت"], ["averageCompleteness", "متوسط الاكتمال %"],
        ["readyForReview", "جاهزة للمراجعة"], ["needsDetails", "تحتاج تفاصيل"], ["needsVerification", "تحتاج تحقق"],
        ["officialSourcesResolved", "روابط رسمية استُعيدت"], ["recoveryQueries", "استعلامات الاستعادة"]].map(([key, label]) => <div key={key}><strong>{result.run.summary[key] || 0}</strong><span>{label}</span></div>)}</div>}
      {result?.run?.searchReport?.recoveryDetails?.length > 0 && <details><summary>استعادة المصادر الرسمية</summary><ul>{result.run.searchReport.recoveryDetails.map((item, index) => <li key={index}><bdi>{item.code}</bdi><p dir="ltr">{item.url || item.query}</p></li>)}</ul></details>}
      {result?.run?.summary && <div className="oi-summary">{[["searchResultsReceived", "نتائج البحث"], ["uniqueUrlsDiscovered", "روابط بحث فريدة"],
        ["officialUrlsClassified", "نتائج من نطاقات رسمية"],
        ["recentTrainingHints", "نتائج بحث تدريب حديثة مبدئيًا"], ["needsReview", "مرشحون يحتاجون مراجعة"], ["discoveryLeads", "روابط للمراجعة المستقبلية"],
        ["oldOpportunities", "إعلانات قديمة"]].map(([key, label]) => <div key={key}><strong>{result.run.summary[key] || 0}</strong><span>{label}</span></div>)}</div>}
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
