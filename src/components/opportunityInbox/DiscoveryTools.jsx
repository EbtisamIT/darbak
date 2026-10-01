import React, { useState } from "react";
import axios from "axios";
import { FiDownload, FiPlay, FiUpload } from "react-icons/fi";
import { pageAvailabilityLabels, applicationStateLabels } from "./candidateLabels";

const fields = { title: "العنوان", company: "الجهة", programType: "نوع البرنامج", majors: "التخصصات", cities: "المدن",
  responsibilities: "المهام", requirements: "الشروط", postedAt: "تاريخ النشر", deadline: "آخر موعد", trainingStartDate: "بداية التدريب",
  applicationUrl: "رابط التقديم", sourceUrl: "المصدر", confidenceScore: "الثقة" };
export default function DiscoveryTools({ endpoint, password, sources, onRefresh }) {
  const [sourceKey, setSource] = useState(""), [url, setUrl] = useState(""), [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [json, setJson] = useState(""), [leads, setLeads] = useState(null);
  const config = { headers: { "x-admin-password": password } };
  const act = async (fn) => {
    setBusy(true); setError(""); setNotice("");
    try { await fn(); } catch (e) { setError(e.response?.data?.error || "تعذر تنفيذ العملية؛ راجعي المدخلات."); }
    finally { setBusy(false); }
  };
  const test = (sendToInbox = false) => act(async () => {
    const { data } = await axios.post(`${endpoint}/test-url`, { sourceKey, url, sendToInbox }, config);
    setResult(data); if (sendToInbox) { setNotice("تم إرسال النتائج المؤهلة لصندوق المراجعة دون نشر."); onRefresh(); }
  });
  const exportSources = () => act(async () => {
    const { data } = await axios.get(`${endpoint}/sources/export`, config);
    const href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = href; link.download = "darbak-opportunity-sources.json"; link.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  });
  return <div className="oi-discovery-tools">
    <details><summary>Test Opportunity URL — اختبار إعلان مباشر</summary>
      <div className="oi-filters">
        <label>المصدر المعتمد<select disabled={busy} value={sourceKey} onChange={(e) => { setSource(e.target.value); setResult(null); }}>
          <option value="">اختاري المصدر</option>{sources.filter((s) => s.reviewStatus === "approved").map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
        </select></label>
        <label>رابط الإعلان<input disabled={busy} type="url" dir="ltr" value={url} onChange={(e) => { setUrl(e.target.value); setResult(null); }} /></label>
      </div>
      <div className="oi-actions"><button disabled={busy || !sourceKey || !url || !password} onClick={() => test(false)}><FiPlay />اختبار فقط</button>
        <button disabled={busy || !result?.results?.some((row) => row.data && row.code !== "CLOSED")} onClick={() => test(true)}>إرسال المؤهل إلى Inbox</button></div>
      {result && <div aria-live="polite"><p>{result.stage} · {result.code}</p>
        {(result.results || []).map((row, i) => <article key={i} className="oi-test-result">
          <h4>{row.data?.title || row.title}</h4><p>{row.code} · {row.fetchMethod}</p>
          {row.data?.companyLogo && <img src={row.data.companyLogo} alt={row.data.company} width="44" height="44" style={{ objectFit: "contain" }} />}
          {row.data && <dl>{Object.entries(fields).map(([key, label]) => <React.Fragment key={key}><dt>{label}</dt>
            <dd>{Array.isArray(row.data[key]) ? row.data[key].join(" · ") || "غير مذكور" : row.data[key] ?? "غير مذكور"}</dd></React.Fragment>)}
            <dt>التقديم مفتوح</dt><dd>{row.data.verification.appearsOpen === null ? "غير مؤكد" : row.data.verification.appearsOpen ? "نعم" : "لا"}</dd>
            {row.data.pageAvailability && <><dt>حالة الصفحة</dt><dd>{pageAvailabilityLabels[row.data.pageAvailability]}</dd></>}
            {row.data.applicationState && <><dt>حالة التقديم</dt><dd>{applicationStateLabels[row.data.applicationState]}</dd></>}
            <dt>البريد</dt><dd>{row.data.discoveredEmails.map((v) => v.email).join(" · ") || "غير مذكور"}</dd>
            <dt>الحقول الناقصة</dt><dd>{row.missingFields.join(" · ") || "لا يوجد"}</dd>
          </dl>}
          {row.data?.verificationWarnings?.map((warning) => <p className="oi-notes" key={warning}>{warning}</p>)}
        </article>)}
        <details><summary>تفاصيل الاختبار</summary><pre dir="ltr">{JSON.stringify(result, null, 2)}</pre></details>
      </div>}
    </details>
    <details><summary>المصادر والبريد المكتشف</summary>
      <div className="oi-actions"><button disabled={busy} onClick={exportSources}><FiDownload />تصدير المصادر JSON</button>
        <button disabled={busy} onClick={() => act(async () => { const { data } = await axios.get(`${endpoint}/leads`, config); setLeads(data.data); })}>البريد المكتشف</button></div>
      <label>استيراد مصادر JSON<textarea dir="ltr" value={json} onChange={(e) => setJson(e.target.value)} rows="5" /></label>
      <button disabled={busy || !json.trim()} onClick={() => act(async () => {
        const { data } = await axios.post(`${endpoint}/sources/import`, { sources: JSON.parse(json) }, config);
        setNotice(`${data.message} أضيف: ${data.added}، موجود مسبقًا: ${data.existing}`); onRefresh();
      })}><FiUpload />استيراد للمراجعة</button>
      {sources.filter((s) => s.reviewStatus === "pending").map((s) => <div key={s.key}>
        <h4>{s.name}</h4><p dir="ltr">{[...(s.officialDomains || []), ...(s.careerDomains || [])].join(" · ")}</p>
        {(s.approvalEvidence || []).map((link) => <p key={link}><a href={link} target="_blank" rel="noreferrer">{link}</a></p>)}
        <button disabled={busy} onClick={() => {
          if (!window.confirm("هل راجعتِ ملكية النطاقات وروابط الشركة الرسمية التي تثبت ارتباط ATS؟ سيتم تفعيل هذا المصدر للاكتشاف.")) return;
          act(async () => { await axios.post(`${endpoint}/sources/${encodeURIComponent(s.key)}/approve`, { reviewedOfficialOwnership: true }, config); onRefresh(); });
        }}>اعتماد النطاقات وتفعيل المصدر</button>
      </div>)}
      {leads && <ul>{leads.length ? leads.map((lead) => <li key={lead._id}>{lead.company} · <bdi>{lead.email}</bdi> · {lead.status} · <a href={lead.sourceUrl} target="_blank" rel="noreferrer">المصدر</a></li>) : <li>لا يوجد بريد مكتشف محفوظ.</li>}</ul>}
    </details>
    {busy && <p role="status">جارٍ تنفيذ العملية...</p>}{error && <p className="oi-error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
  </div>;
}
