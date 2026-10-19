import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import API_BASE_URL from "../config/api";
import "./AdminAnalyticsV2.css";

const tabs = [
  ["overview", "نظرة عامة"],
  ["audience", "الجمهور"],
  ["behaviour", "السلوك"],
  ["conversion", "التحويل"],
  ["content", "المحتوى"],
  ["rewards", "المكافآت"],
  ["subscriptions", "الاشتراكات"],
];

const eventLabels = {
  where_to_train_search: "بحث في وين أتدرب",
  training_finder_opened: "فتح وين أتدرب",
  opportunity_detail_viewed: "فتح فرصة",
  opportunity_apply_clicked: "ضغط تقديم",
  student_applications_page_viewed: "فتح تقديماتي",
  my_applications_opened: "فتح تقديماتي",
  company_page_viewed: "فتح جهة",
  experience_card_opened: "فتح تجربة",
  interview_details_opened: "فتح مقابلة",
  premium_gate_opened: "ظهور بوابة الاشتراك",
  checkout_started: "بدء الدفع",
  add_experience_started: "بدء إضافة تجربة",
  add_experience_submitted: "إرسال تجربة",
  reward_opened: "فتح مكافأة",
  reward_resume_started: "بدء سيرة المكافأة",
  reward_ai_used: "استخدام اقتراح السيرة",
  reward_resume_previewed: "معاينة السيرة",
  reward_resume_finalized: "اعتماد السيرة",
  reward_resume_downloaded: "تنزيل السيرة",
};

const format = (value, unit = "") => value === null || value === undefined
  ? "غير متاح"
  : `${Number(value).toLocaleString("en-US", { maximumFractionDigits: 1 })}${unit}`;

const metric = (label, value, note = "", unit = "") => (
  <div className="analytics-v2-metric" key={label}>
    <span>{label}</span>
    <strong>{value === null && note.includes("يُقاس هذا المؤشر")
      ? "لا توجد بيانات تاريخية لهذا المؤشر" : format(value, unit)}</strong>
    {note && <small>{note}</small>}
  </div>
);

const list = (title, rows = [], empty = "لا توجد بيانات كافية في هذه الفترة.") => (
  <section className="analytics-v2-panel" key={title}>
    <h3>{title}</h3>
    {!rows.length ? <p className="analytics-v2-muted">{empty}</p> : (
      <ol className="analytics-v2-list">
        {rows.map((row) => (
          <li key={row.label}>
            <span dir="auto">{row.label}</span>
            <b>{format(row.count, row.unit || "")}</b>
          </li>
        ))}
      </ol>
    )}
  </section>
);

const Funnel = ({ title, steps = [], trackingAvailable = true }) => (
  <section className="analytics-v2-panel">
    <h3>{title}</h3>
    <div className="analytics-v2-funnel">
      {steps.map((step, index) => (
        <div key={step.label}>
          <span>{step.label}</span>
          <strong>{format(!trackingAvailable && step.count === 0 ? null : step.count)}</strong>
          <small>{index === 0 ? "بداية الرحلة" : step.fromPrevious === null
            ? "لا تتوفر نسبة بعد" : `${format(step.fromPrevious, "%")} من الخطوة السابقة`}</small>
        </div>
      ))}
    </div>
  </section>
);

const AdminAnalyticsV2 = ({ authHeaders }) => {
  const [tab, setTab] = useState("overview");
  const [range, setRange] = useState("30");
  const [filters, setFilters] = useState({ lifecycleStage: "", major: "", city: "", source: "", from: "", to: "" });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const params = useMemo(() => ({ tab, range, ...filters }), [tab, range, filters]);
  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    let active = true;
    if (range === "custom" && (!filters.from || !filters.to)) return undefined;
    setLoading(true);
    setError("");
    axios.get(`${API_BASE_URL}/api/admin/analytics-v2`, {
      params, headers: authHeaders,
    }).then(({ data: payload }) => {
      if (active) setData(payload);
    }).catch(() => {
      if (active) { setError("تعذر تحميل هذا القسم الآن."); setData(null); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // The serialized key keeps requests scoped to the selected tab and filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey, revision]);

  const changeFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const section = () => {
    if (!data) return null;
    const trackingNote = data.trackingStartedAt
      ? `يُقاس هذا المؤشر منذ ${new Date(data.trackingStartedAt).toLocaleDateString("ar-SA")}`
      : "تاريخ بدء القياس غير موثّق";
    if (tab === "overview") return (
      <div className="analytics-v2-kpis">
        {(data.kpis || []).map((item) => metric(item.label, item.value,
          [item.trackedSince ? trackingNote : "", item.previous === null ? "" : `الفترة السابقة: ${format(item.previous, item.unit || "")}`]
            .filter(Boolean).join(" · "), item.unit || ""))}
      </div>
    );
    if (tab === "audience") {
      const stages = data.audience?.stages || {};
      const total = Object.values(stages).reduce((sum, value) => sum + Number(value || 0), 0);
      return <>
        <section className="analytics-v2-panel">
          <h3>مرحلة المستخدمين</h3>
          <div className="analytics-v2-segments">
            {[["student", "طلاب جامعيون"], ["graduate", "خريجون"], ["unknown", "غير محدد"]].map(([key, label]) => (
              <div key={key}><span>{label}</span><strong>{format(stages[key] || 0)}</strong><small>{total ? format(100 * (stages[key] || 0) / total, "%") : "—"}</small></div>
            ))}
          </div>
        </section>
        <div className="analytics-v2-grid">
          {list("أعلى التخصصات", data.audience?.majors)}
          {list("أعلى المدن", data.audience?.cities)}
          {list("سنوات التخرج", data.audience?.graduationYears, data.audience?.profileLimitations)}
          {list("الجامعات", data.audience?.universities, data.audience?.profileLimitations)}
        </div>
      </>;
    }
    if (tab === "behaviour") return <>
      <section className="analytics-v2-panel">
        <h3>العودة إلى دربك</h3>
        <div className="analytics-v2-segments">
          {[["d1", "بعد يوم"], ["d7", "بعد 7 أيام"], ["d30", "بعد 30 يومًا"]].map(([key, label]) =>
            metric(label, data.retention?.[key], data.retention?.[key] === null ? "لم تكتمل فترة القياس" : "من المؤهلين للقياس", "%"))}
        </div>
      </section>
      {list("الأفعال المهمة", Object.entries(data.events || {}).map(([key, count]) => ({
        label: eventLabels[key] || key, count,
      })), data.behaviourHistoryAvailable ? "لا توجد أحداث في الفترة المحددة." : trackingNote)}
      {list("نشاط الصفحات اليومي منذ بدء التجميع", data.dailyActivity)}
      {list("العودة بعد 7 أيام حسب الفئة", (data.retentionSegments || []).map((item) => ({
        label: ({ student: "طلاب", graduate: "خريجون", free: "مجاني", paid: "مدفوع",
          usedApplications: "استخدم تقديماتي", noApplications: "لم يستخدم تقديماتي",
          rewardUser: "حصل على مكافأة", noReward: "بدون مكافأة" }[item.key] || item.key),
        count: item.d7, unit: "%",
      })))}
    </>;
    if (tab === "conversion") return <div className="analytics-v2-grid">
      <Funnel title="رحلة الفرص" steps={data.funnels?.opportunity} trackingAvailable={data.trackingAvailable} />
      <Funnel title="مشاركة التجربة" steps={data.funnels?.contribution} trackingAvailable={data.trackingAvailable} />
      <Funnel title="مكافأة السيرة" steps={data.funnels?.reward} trackingAvailable={data.trackingAvailable} />
      <Funnel title="الاشتراك" steps={data.funnels?.subscription} trackingAvailable={data.trackingAvailable} />
    </div>;
    if (tab === "content") return <div className="analytics-v2-grid">
      {list("التخصصات الأكثر بحثًا", data.content?.majors)}
      {list("المدن الأكثر بحثًا", data.content?.cities)}
      {list("الجهات الأكثر فتحًا", data.content?.companies)}
      {list("الفرص الأكثر فتحًا", data.content?.opportunities)}
      {list("الفرص الأعلى في نقرات التقديم", data.content?.applies)}
      {list("مشاهدات مرتفعة وتقديم قليل", data.content?.highViewsLowApply)}
      {list("تخصصات تحتاج تجارب أكثر", data.content?.lowCoverageMajors)}
      {list("مدن تحتاج تجارب أكثر", data.content?.lowCoverageCities)}
      <section className="analytics-v2-panel"><h3>تغطية التجارب</h3>
        <p>جهات بدون تجارب: <b>{format(data.content?.companiesWithNoExperience)}</b></p>
        <p>جهات بتجربة واحدة: <b>{format(data.content?.companiesWithOneExperience)}</b></p>
      </section>
    </div>;
    if (tab === "rewards") return <>
      <div className="analytics-v2-kpis">
        {[
          ["تجارب مرسلة", data.metrics?.submitted], ["تجارب معتمدة", data.metrics?.approved],
          ["مكافآت منحت", data.metrics?.granted], ["مكافآت استخدمت", data.metrics?.redeemed],
          ["سير مكتملة", data.metrics?.finalized],
          ["نسبة الاعتماد", data.metrics?.approvalRate],
          ["نسبة فتح المكافأة", data.metrics?.rewardOpenRate],
          ["نسبة استخدام المكافأة", data.metrics?.redemptionRate],
          ["متوسط الساعات حتى الاعتماد", data.metrics?.averageHoursToFinalize],
        ].map(([label, value]) => metric(label, value, "", label.includes("نسبة") ? "%" : ""))}
      </div>
      <Funnel title="من اعتماد التجربة إلى تنزيل السيرة" steps={data.funnels?.reward} trackingAvailable={data.trackingAvailable} />
      <div className="analytics-v2-grid">
        {list("تقييم السيرة بعد التنزيل", data.feedback?.resumeRatings)}
        {list("سهولة إضافة التجربة", data.feedback?.contributionEase)}
      </div>
    </>;
    if (tab === "subscriptions") return <>
      <div className="analytics-v2-kpis">
        {[
          ["سجلات اشتراك مؤكدة", data.subscriptions?.subscriptionsRecorded],
          ["اشتراكات جديدة", data.subscriptions?.newSubscriptions],
          ["تجديدات", data.subscriptions?.renewals],
          ["انتهت خلال الفترة", data.subscriptions?.expired],
          ["من البوابة إلى الدفع", data.subscriptions?.paywallToCheckout],
          ["من الدفع إلى الاشتراك", data.subscriptions?.checkoutToPaid],
        ].map(([label, value]) => metric(label, value,
          label === "اشتراكات جديدة" || label === "تجديدات" ? (data.trackingStartedAt
            ? `يُقاس هذا المؤشر منذ ${new Date(data.trackingStartedAt).toLocaleDateString("ar-SA")}`
            : "تاريخ بدء القياس غير موثّق") : "", label.includes("من ") ? "%" : ""))}
      </div>
      {list("الباقات", data.subscriptions?.plans)}
      {list("مصادر الاشتراك المسجلة", data.subscriptions?.sources)}
      <section className="analytics-v2-panel"><h3>مستخدمو المكافأة الذين اشتروا باقة سيرتي لاحقًا</h3>
        <p>خلال 7 أيام: {format(data.subscriptions?.rewardUsersBoughtResumeWithin7Days)}</p>
        <p>خلال 30 يومًا: {format(data.subscriptions?.rewardUsersBoughtResumeWithin30Days)}</p>
        <small>ارتباط زمني وصفي، ولا يثبت أن المكافأة سببت الاشتراك.</small>
      </section>
    </>;
    return null;
  };

  return <div className="analytics-v2" dir="rtl">
    <header className="analytics-v2-header">
      <div><h2>تحليلات دربك</h2><p>قرارات مبنية على نشاط المستخدمين وبيانات الرحلات الفعلية.</p></div>
      <button type="button" onClick={() => setRevision((value) => value + 1)} disabled={loading}>تحديث</button>
    </header>
    <nav className="analytics-v2-tabs" aria-label="أقسام التحليلات">
      {tabs.map(([key, label]) => <button key={key} type="button" aria-current={tab === key ? "page" : undefined}
        onClick={() => setTab(key)}>{label}</button>)}
    </nav>
    <div className="analytics-v2-filters">
      <label>الفترة<select value={range} onChange={(event) => setRange(event.target.value)}>
        <option value="today">اليوم</option><option value="7">آخر 7 أيام</option>
        <option value="30">آخر 30 يومًا</option><option value="custom">مخصص</option>
      </select></label>
      {range === "custom" && <>
        <label>من<input type="date" value={filters.from} onChange={(event) => changeFilter("from", event.target.value)} /></label>
        <label>إلى<input type="date" value={filters.to} onChange={(event) => changeFilter("to", event.target.value)} /></label>
      </>}
      <label>المرحلة<select value={filters.lifecycleStage} onChange={(event) => changeFilter("lifecycleStage", event.target.value)}>
        <option value="">الجميع</option><option value="student">طالب جامعي</option>
        <option value="graduate">خريج</option><option value="unknown">غير محدد</option>
      </select></label>
      <label>التخصص<input value={filters.major} onChange={(event) => changeFilter("major", event.target.value)} placeholder="كل التخصصات" /></label>
      <label>المدينة<input value={filters.city} onChange={(event) => changeFilter("city", event.target.value)} placeholder="كل المدن" /></label>
      <label>المصدر<input value={filters.source} onChange={(event) => changeFilter("source", event.target.value)} placeholder="كل المصادر" /></label>
    </div>
    {loading && <p role="status">جاري تحميل القسم...</p>}
    {error && <p role="alert">{error}</p>}
    {!loading && section()}
    {data?.trackingStartedAt && <p className="analytics-v2-muted">يُقاس النشاط داخل الموقع منذ {new Date(data.trackingStartedAt).toLocaleDateString("ar-SA")}. السجلات التاريخية المعروضة مستقلة عن هذا القياس.</p>}
    {data?.health && <p className="analytics-v2-health">آخر حدث: {data.health.lastEventAt ? new Date(data.health.lastEventAt).toLocaleString("ar-SA") : "غير متاح"} · آخر تجميع: {data.health.lastAggregationAt ? new Date(data.health.lastAggregationAt).toLocaleString("ar-SA") : "غير متاح"} · إخفاقات الإدخال منذ تشغيل الخادم: {format(data.health.ingestionFailuresSinceRestart)} · دفعات الواجهة المفقودة: {format(data.health.droppedFrontendBatches)}</p>}
  </div>;
};

export default AdminAnalyticsV2;
