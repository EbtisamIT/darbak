import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { FiPlay, FiPower, FiRefreshCw, FiRotateCcw } from "react-icons/fi";
import API_BASE_URL from "../../config/api";

const endpoint = `${API_BASE_URL}/api/admin/opportunity-candidates/autopilot`;
const actionLabels = {
  auto_published: "نُشرت تلقائيًا",
  auto_updated: "حُدّثت تلقائيًا",
  auto_closed: "أُغلقت تلقائيًا",
  rejected_not_coop: "استُبعدت (ليست تعاوني)",
  reopened: "أُعيد فتحها يدويًا",
  publish_failed: "تعذر النشر، حُوّلت للمراجعة",
};
const reasonLabels = {
  SOURCE_PAGE_REMOVED: "صفحة الإعلان حُذفت من المصدر",
  SOURCE_SAYS_CLOSED: "المصدر يذكر أن التقديم مغلق",
  DEADLINE_EXTENDED: "تمديد الموعد النهائي",
  NOT_COOPERATIVE_TRAINING: "تدريب صيفي أو خريجين أو internship عام",
  CONFIDENT_COOP: "تدريب تعاوني من مصدر رسمي مكتمل",
  ADMIN_REOPENED: "قرار الإدارة",
};
const formatDate = (value) => (value ? new Date(value).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh", dateStyle: "medium", timeStyle: "short" }) : "—");

export default function AutopilotPanel({ password, onChange = () => {} }) {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const headers = { "x-admin-password": password };

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(endpoint, { headers: { "x-admin-password": password } });
      setState(data); setError("");
    } catch (e) { setError(e.response?.data?.error || "تعذر تحميل حالة الأتمتة."); }
  }, [password]);
  useEffect(() => { if (password) load(); }, [password, load]);

  const act = async (request, successMessage) => {
    setBusy(true); setError(""); setNotice("");
    try { await request(); setNotice(successMessage); await load(); onChange(); }
    catch (e) { setError(e.response?.data?.error || "تعذر تنفيذ العملية."); }
    finally { setBusy(false); }
  };
  const toggle = () => act(() => axios.patch(endpoint, { enabled: !state?.enabled }, { headers }),
    state?.enabled ? "أُوقفت الأتمتة. لن يُنشر أو يُغلق أي شيء تلقائيًا." : "فُعّلت الأتمتة.");
  const runNow = () => act(() => axios.post(`${endpoint}/run`, {}, { headers }),
    "بدأ التشغيل في الخلفية: نشر المرشحين الواضحين وفحص الفرص المنشورة. حدّث الحالة بعد دقائق.");
  const reopen = (id) => act(() => axios.post(`${endpoint}/reopen/${id}`, {}, { headers }), "أُعيد فتح الفرصة ولن تفحصها الأتمتة مجددًا.");

  const enabled = Boolean(state?.enabled) && !state?.forcedOff;
  const publish = state?.lastAutoPublish || {};
  const recheck = state?.lastRecheck || {};
  return <section className="oi-discovery oi-autopilot" aria-label="الأتمتة الكاملة للفرص">
    <div className="oi-autopilot-head">
      <div>
        <h3>الأتمتة الكاملة للفرص <span className={`oi-autopilot-badge ${enabled ? "on" : "off"}`}>{enabled ? "مفعّلة" : "متوقفة"}</span></h3>
        <p>تبحث مرتين يوميًا ({(state?.schedule?.discoveryTimes || ["08:00", "20:00"]).join(" و")} بتوقيت الرياض)، وتنشر فرص <strong>التدريب التعاوني</strong> الواضحة من المصادر الرسمية فقط،
          وتفحص الفرص المنشورة يوميًا وتغلق المنتهي منها بعد تأكيده مرتين. أي فرصة غير واضحة تبقى في الصندوق للمراجعة.</p>
      </div>
      <div className="oi-actions">
        <button onClick={toggle} disabled={busy || !state || state.forcedOff}><FiPower />{state?.enabled ? "إيقاف الأتمتة" : "تفعيل الأتمتة"}</button>
        <button onClick={runNow} disabled={busy || !enabled}><FiPlay />تشغيل الآن</button>
        <button onClick={load} disabled={busy}><FiRefreshCw />تحديث الحالة</button>
      </div>
    </div>
    {state?.forcedOff && <p className="oi-error" role="alert">الأتمتة موقوفة من إعدادات الخادم (OPPORTUNITY_AUTOPILOT_DISABLED).</p>}
    {error && <p className="oi-error" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {state && <>
      <div className="oi-summary">{[
        [state.totals?.autoPublished, "نُشرت تلقائيًا (الإجمالي)"],
        [state.totals?.autoClosed, "أُغلقت تلقائيًا"],
        [state.totals?.inReview, "تنتظر مراجعتك"],
        [publish.published, "نُشرت في آخر دورة"],
        [publish.rejectedNotCoop, "استُبعدت (ليست تعاوني)"],
        [recheck.closed, "أُغلقت في آخر فحص"],
      ].map(([value, label]) => <div key={label}><strong>{value || 0}</strong><span>{label}</span></div>)}</div>
      <ul className="oi-autopilot-meta">
        <li>آخر بحث: {formatDate(state.lastDiscovery?.at)}{state.lastDiscovery?.error && <small dir="auto">{state.lastDiscovery.error}</small>}</li>
        <li>آخر فحص للفرص المنشورة: {formatDate(recheck.at)} · فُحصت {recheck.checked || 0} · ما زالت مفتوحة {recheck.stillOpen || 0} · غير حاسم {recheck.inconclusive || 0} · من مصادر غير معتمدة {recheck.unverifiable || 0}</li>
        <li>آخر نبضة: {formatDate(state.lastTickAt)} · المجدول الخارجي: {state.cronConfigured ? "مهيأ" : "غير مهيأ"}</li>
      </ul>
      {state.actions?.length > 0 && <details open>
        <summary>آخر الإجراءات التلقائية ({state.actions.length})</summary>
        <ul>{state.actions.slice(0, 30).map((item, index) => <li key={`${item.at}-${index}`}>
          <strong>{actionLabels[item.type] || item.type}</strong> · <bdi>{item.title || "—"}</bdi>{item.company && <> · <bdi>{item.company}</bdi></>}
          <small>{formatDate(item.at)} · {reasonLabels[item.reason] || <bdi dir="ltr">{item.reason}</bdi>}</small>
          {item.type === "auto_closed" && item.opportunityId && <button onClick={() => reopen(item.opportunityId)} disabled={busy}><FiRotateCcw />إعادة فتح</button>}
        </li>)}</ul>
      </details>}
    </>}
  </section>;
}
