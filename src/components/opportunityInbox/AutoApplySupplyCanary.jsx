import React, { useState } from "react";
import axios from "axios";
import API_BASE_URL from "../../config/api";

const endpoint = API_BASE_URL + "/api/admin/auto-apply-supply/canary";

export default function AutoApplySupplyCanary({ password }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const auth = { headers: { "x-admin-password": password } };

  async function refresh() {
    const { data } = await axios.get(endpoint, auth);
    setReport(data);
  }

  async function read() {
    setBusy(true);
    setError("");
    try { await refresh(); }
    catch (failure) {
      setError(failure.response?.status === 404 ? "اختبار التوريد مقفّل على الخادم." : "تعذر تحميل تقرير التوريد.");
    } finally { setBusy(false); }
  }

  async function run() {
    setBusy(true);
    setError("");
    try { await axios.post(endpoint, {}, auth); }
    catch { setError("تعذر استلام نتيجة التشغيل. راجع السجل قبل أي تشغيل آخر."); }
    try { await refresh(); }
    catch { setError("تعذر تحديث التقرير. يمكن تحديثه دون بدء تشغيل جديد."); }
    finally { setBusy(false); }
  }

  const readiness = report?.readiness;
  const runnable = readiness?.nextSlot && readiness.realSendingOff && readiness.standardCollectorOff &&
    readiness.searchConfigured && readiness.openAiConfigured;
  return <section className="oi-pilot-monitor" aria-label="اختبار توريد Auto Apply">
    <button type="button" disabled={busy} onClick={() => {
      setOpen(!open);
      if (!open) void read();
    }}>{open ? "إخفاء اختبار التوريد" : "اختبار توريد Auto Apply"}</button>
    {open && <>
      <div className="oi-actions">
        <button type="button" disabled={busy} onClick={read}>تحديث تقرير التوريد</button>
        {runnable && <button type="button" disabled={busy} onClick={run}>تشغيل اختبار التوريد {readiness.nextSlot}</button>}
      </div>
      {busy && <p role="status">جارٍ العمل على اختبار التوريد…</p>}
      {error && <p role="alert">{error}</p>}
      {report && <div className="oi-run-history"><pre dir="ltr" aria-label="تقرير اختبار التوريد">{JSON.stringify(report, null, 2)}</pre></div>}
    </>}
  </section>;
}
