import React, { useEffect, useState } from "react";
import axios from "axios";
import API_BASE_URL from "../../config/api";

export default function AutoApplyPilotMonitor({ password }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || !password) return;
    const controller = new AbortController();
    axios.get(`${API_BASE_URL}/api/admin/auto-apply/pilot-monitor`, {
      headers: { "x-admin-password": password },
      signal: controller.signal,
    }).then(({ data: result }) => setData(result))
      .catch((requestError) => {
        if (!controller.signal.aborted) setError(requestError.response?.data?.error || "تعذر تحميل المتابعة.");
      });
    return () => controller.abort();
  }, [open, password]);

  return <section className="oi-pilot-monitor">
    <button type="button" onClick={() => setOpen((value) => !value)}>
      {open ? "إخفاء متابعة Auto Apply Pilot" : "متابعة Auto Apply Pilot"}
    </button>
    {open && <div>
      {error && <p className="oi-error">{error}</p>}
      {!data && !error && <p>جارٍ تحميل المتابعة…</p>}
      {data && <>
        <p><strong>{data.allowlisted}/5</strong> مستخدمين · الإرسال الحقيقي: {data.enabled ? "مفعّل" : "متوقف"}</p>
        <p>الحد: {data.limits.total} إجماليًا · {data.limits.daily} يوميًا لكل مستخدم</p>
        <div className="oi-run-history"><table><thead><tr>
          <th>المستخدم</th><th>مطابق</th><th>راجع</th><th>أرسل</th><th>تخطى</th><th>مناسب/غير مناسب</th><th>ردود</th><th>مقابلات</th><th>قبول</th><th>فشل</th>
        </tr></thead><tbody>{data.rows.map((row) => <tr key={row.userId}>
          <td dir="ltr">{row.userId}</td><td>{row.matched}</td><td>{row.reviewed}</td><td>{row.sent}</td>
          <td>{row.skipped}</td><td>{row.feedback.suitable}/{row.feedback.unsuitable}</td>
          <td>{row.outcomes.replies}</td><td>{row.outcomes.interviews}</td><td>{row.outcomes.acceptances}</td><td>{row.failures}</td>
        </tr>)}</tbody></table></div>
        <div className="oi-run-history"><table><thead><tr>
          <th>الجهة</th><th>الوجهة</th><th>توثيق القناة</th><th>حالة المزود</th>
        </tr></thead><tbody>{data.recent.map((row) => <tr key={`${row.userId}-${row.packageId}`}>
          <td>{row.company}</td><td dir="ltr">{row.destination}</td><td>{row.verificationStatus} · {row.channelType}</td><td>{row.providerStatus}</td>
        </tr>)}</tbody></table></div>
      </>}
    </div>}
  </section>;
}
