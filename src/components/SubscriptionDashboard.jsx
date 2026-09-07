import React, { useMemo, useState } from "react";

const colors = {
  brand: "#66d0c3",
  text: "#d8e5e2",
  textSoft: "#bfccc9",
  muted: "#8e9f9b",
  card: "rgba(255,255,255,0.035)",
  border: "rgba(216,229,226,0.09)",
};

const tabs = [
  ["overview", "نظرة عامة"],
  ["subscriptions", "الاشتراكات"],
  ["usage", "استخدام المشتركين"],
  ["resume", "سيرتي بدربك"],
  ["activity", "النشاط والعودة"],
  ["content", "المحتوى"],
  ["users", "المستخدمون"],
];

const metricCard = (label, value, hint = "", accent = colors.brand) => (
  <article
    key={label}
    style={{
      background: colors.card,
      border: `1px solid ${colors.border}`,
      borderTop: `2px solid ${accent}`,
      borderRadius: 12,
      padding: "14px",
      minHeight: 92,
      display: "grid",
      alignContent: "space-between",
      gap: 8,
    }}
  >
    <span style={{ color: colors.muted, fontSize: 12, fontWeight: 800 }}>{label}</span>
    <strong style={{ color: accent, fontSize: 27, lineHeight: 1.1 }}>{value}</strong>
    {hint && <small style={{ color: colors.textSoft, lineHeight: 1.45 }}>{hint}</small>}
  </article>
);

const formatNumber = (value) => Number(value || 0).toLocaleString("en-US");
const formatCurrency = (value) => `${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })} ر.س`;
const formatDuration = (seconds) => {
  const total = Math.max(0, Number(seconds || 0));
  if (total < 60) return `${Math.round(total)} ث`;
  return `${Math.floor(total / 60)} د ${Math.round(total % 60)} ث`;
};

const Section = ({ title, description = "", children, action = null }) => (
  <section
    style={{
      background: colors.card,
      border: `1px solid ${colors.border}`,
      borderRadius: 14,
      padding: "16px",
      display: "grid",
      gap: 14,
    }}
  >
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
      <div>
        <h3 style={{ color: colors.text, margin: 0, fontSize: 17 }}>{title}</h3>
        {description && <p style={{ color: colors.muted, margin: "5px 0 0", fontSize: 12, lineHeight: 1.6 }}>{description}</p>}
      </div>
      {action}
    </div>
    {children}
  </section>
);

const CompactList = ({ title, items = [], empty = "لا توجد بيانات كافية بعد." }) => (
  <Section title={title}>
    {items.length === 0 ? (
      <p style={{ color: colors.muted, margin: 0 }}>{empty}</p>
    ) : (
      <div style={{ display: "grid", gap: 8 }}>
        {items.map((item, index) => (
          <div key={`${item.label}-${index}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, paddingBottom: 8, borderBottom: index === items.length - 1 ? "none" : `1px solid ${colors.border}` }}>
            <span style={{ color: colors.textSoft }}>{item.label}</span>
            <strong style={{ color: colors.brand }}>{formatNumber(item.count)}</strong>
          </div>
        ))}
      </div>
    )}
  </Section>
);

const MiniSeries = ({ rows = [] }) => {
  const max = Math.max(1, ...rows.flatMap((row) => [row.newSubscriptions, row.renewals, row.expired]));
  return (
    <div style={{ overflowX: "auto", paddingBottom: 3 }}>
      <div style={{ display: "flex", alignItems: "end", gap: 4, height: 150, minWidth: 620 }}>
        {rows.map((row) => (
          <div key={row.date} title={`${row.date}: جديد ${row.newSubscriptions}، تجديد ${row.renewals}، منتهي ${row.expired}`} style={{ flex: 1, minWidth: 13, height: "100%", display: "flex", alignItems: "end", gap: 1 }}>
            {[
              ["#66d0c3", row.newSubscriptions],
              ["#a78bfa", row.renewals],
              ["#f59e0b", row.expired],
            ].map(([color, value], index) => (
              <span key={index} style={{ flex: 1, minHeight: value ? 3 : 0, height: `${(Number(value || 0) / max) * 100}%`, background: color, borderRadius: "3px 3px 0 0" }} />
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 14, color: colors.muted, fontSize: 12, marginTop: 9 }}>
        <span><b style={{ color: "#66d0c3" }}>■</b> جديدة</span>
        <span><b style={{ color: "#a78bfa" }}>■</b> تجديدات</span>
        <span><b style={{ color: "#f59e0b" }}>■</b> منتهية</span>
      </div>
    </div>
  );
};

const usageLabels = {
  premiumExperience: "قرأ تجربة مدفوعة",
  premiumOpportunity: "فتح فرصة مدفوعة",
  whereToTrain: "استخدم وين أتدرب",
  resumeStarted: "بدأ أو بنى سيرة",
  resumeTailored: "خصص سيرة",
  resumeDownloaded: "نزّل سيرة",
  emailGenerated: "ولّد إيميل تقديم",
  emailCopied: "نسخ إيميل تقديم",
  portfolioCreated: "أنشأ ملفًا مهنيًا",
  applicationSubmitted: "قدّم عبر دربك",
};

const SubscriptionDashboard = ({ data, loading, onRefresh, onOpenUsers }) => {
  const [activeTab, setActiveTab] = useState("overview");
  const dashboard = data || {};
  const revenue = dashboard.revenue || {};
  const overview = dashboard.overview || {};
  const subscriptions = dashboard.subscriptions || {};
  const usage = dashboard.subscriberUsage || {};
  const resume = dashboard.resume || {};
  const activity = dashboard.activity || {};
  const content = dashboard.content || {};
  const funnel = dashboard.funnel || [];
  const rangeNotice = dashboard.range?.trackingNotice || "تبدأ المقاييس التي تعتمد على ربط الحساب من تاريخ تفعيل التتبع.";
  const activeUsageRows = useMemo(
    () => Object.entries(usage.metrics || {}).map(([key, stat]) => ({ key, ...(stat || {}) })),
    [usage.metrics]
  );

  const tabButton = (key, label) => (
    <button
      key={key}
      type="button"
      onClick={() => setActiveTab(key)}
      style={{
        border: `1px solid ${activeTab === key ? "rgba(102,208,195,.5)" : colors.border}`,
        background: activeTab === key ? "rgba(102,208,195,.12)" : "transparent",
        borderRadius: 9,
        color: activeTab === key ? colors.brand : colors.textSoft,
        padding: "9px 12px",
        cursor: "pointer",
        fontFamily: "inherit",
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Section
        title="لوحة الاشتراكات"
        description="الإيراد هنا من عمليات ميسر الناجحة والمسجلة فقط. لا تدخل المنح أو التفعيل اليدوي أو المدفوعات المعلقة."
        action={<button type="button" onClick={onRefresh} disabled={loading} style={{ background: colors.brand, color: "#061312", border: 0, borderRadius: 9, padding: "10px 14px", cursor: loading ? "wait" : "pointer", fontFamily: "inherit", fontWeight: 900 }}>{loading ? "جار التحديث..." : "تحديث"}</button>}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          {metricCard("الإيرادات المحصلة عبر ميسر", formatCurrency(revenue.allTimeSar), "مدفوعات ناجحة فقط", "#8ee7dc")}
          {metricCard("إيرادات اليوم", formatCurrency(revenue.todaySar), "من ميسر فقط")}
          {metricCard("آخر 7 أيام", formatCurrency(revenue.last7DaysSar), "تحصيل فعلي")}
          {metricCard("هذا الشهر", formatCurrency(revenue.monthSar), "بدون تمديدات يدوية")}
        </div>
        <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 2 }}>
          {tabs.map(([key, label]) => tabButton(key, label))}
        </div>
      </Section>

      {activeTab === "overview" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
            {metricCard("مشتركين جدد اليوم", formatNumber(overview.newSubscribersToday), "من عمليات ميسر المصنفة")}
            {metricCard("الإيراد اليوم", formatCurrency(overview.revenueTodaySar), "مقابل أمس: لا مقارنة تاريخية مضللة")}
            {metricCard("مستخدمون نشطون اليوم", formatNumber(overview.activeUsersToday), `أمس: ${formatNumber(overview.activeUsersYesterday)}`, "#60a5fa")}
            {metricCard("مشتركون استخدموا ميزة اليوم", formatNumber(overview.subscribersUsedFeatureToday), "مستخدمون فريدون", "#c4b5fd")}
            {metricCard("تجديدات اليوم", formatNumber(overview.renewalsToday), "من التتبع الجديد", "#fbbf24")}
            {metricCard("اشتراكات انتهت اليوم", formatNumber(overview.expiredToday), "كل مصادر الوصول", "#fb7185")}
          </div>
          <Section title="قمع الاشتراك" description="مستخدمون فريدون، وليس مشاهدات صفحات.">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", gap: 10 }}>
              {funnel.map((stage, index) => metricCard(
                ({ visitor: "زائر", paywall: "ظهر له paywall", subscribeClick: "ضغط اشتراك", checkout: "بدأ checkout", paid: "دفع بنجاح" }[stage.key] || stage.key),
                formatNumber(stage.users),
                index ? `${stage.conversion ?? 0}% من السابقة` : "بداية القمع",
                index === funnel.length - 1 ? "#8ee7dc" : colors.brand
              ))}
            </div>
          </Section>
        </>
      )}

      {activeTab === "subscriptions" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
            {metricCard("المشتركون النشطون", formatNumber(subscriptions.active))}
            {metricCard("جديدة اليوم", formatNumber(subscriptions.newToday))}
            {metricCard("جديدة في الفترة", formatNumber(subscriptions.newLast7Days))}
            {metricCard("تجديدات هذا الشهر", formatNumber(subscriptions.renewalsThisMonth), "يبدأ القياس الدقيق بعد التحديث")}
            {metricCard("بانتظار الدفع", formatNumber(subscriptions.pendingPayment), "لا تدخل بالإيراد", "#fbbf24")}
            {metricCard("مفعلة يدويًا", formatNumber(subscriptions.manuallyActivated), "لا تدخل بالإيراد", "#a78bfa")}
          </div>
          <Section title="نسبة التجديد" description="من انتهت أهليته خلال الفترة مقابل من دفع تجديدًا فعليًا بعدها.">
            <strong style={{ fontSize: 34, color: colors.brand }}>{subscriptions.renewalRate === null ? "—" : `${subscriptions.renewalRate}%`}</strong>
            <p style={{ margin: 0, color: colors.muted }}>{subscriptions.renewalTrackingAvailable ? `الأهلية في الفترة: ${formatNumber(subscriptions.renewalEligible)}` : "سيظهر الرقم عند توفر أول دورة تجديد موثقة بالتتبع الجديد."}</p>
          </Section>
          <Section title="آخر 30 يوم" description="جديدة، تجديدات، ومنتهية."><MiniSeries rows={subscriptions.dailySeries || []} /></Section>
        </>
      )}

      {activeTab === "usage" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
            {metricCard("مشتركون استفادوا من ميزة", formatNumber(usage.activeWithAnyFeature), "خلال آخر 7 أيام")}
            {metricCard("نشطون دون استخدام ميزة", formatNumber(usage.activeWithoutFeatureLast7Days), "آخر 7 أيام", "#fbbf24")}
          </div>
          <Section title="كيف يستخدم المشتركون المزايا" description="الرقم الكبير مستخدمون فريدون، والصغير إجمالي الأحداث.">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))", gap: 10 }}>
              {activeUsageRows.map((row) => metricCard(usageLabels[row.key] || row.key, formatNumber(row.users), `${formatNumber(row.events)} حدث`))}
            </div>
          </Section>
        </>
      )}

      {activeTab === "resume" && (
        <>
          <Section title="قمع سيرتي بدربك" description="يبدأ القياس من أحداث السيرة المتوفرة؛ لا يُخمّن ما قبلها.">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", gap: 10 }}>
              {(resume.funnel || []).map((item, index) => metricCard(
                ({ opened: "فتح السيرة", started: "بدأ", completed: "أكمل", tailored: "خصص", downloaded: "نزّل" }[item.key] || item.key),
                formatNumber(item.users),
                index ? `${item.conversion ?? 0}% من السابقة` : `${formatNumber(item.events)} حدث`
              ))}
            </div>
          </Section>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            {metricCard("إجمالي التخصيصات", formatNumber(resume.resumeTailored?.events))}
            {metricCard("متوسط التخصيصات لكل مستخدم", formatNumber(resume.averageTailorsPerUser))}
            {metricCard("وصلوا للحد الشهري", formatNumber(resume.monthlyLimitReached), "يبدأ عند تفعيل عداد السيرة")}
          </div>
          <Section title="مولد الإيميل">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
              {metricCard("ولّدوا إيميل", formatNumber(dashboard.email?.generated?.users), `${formatNumber(dashboard.email?.generated?.events)} إجمالي`) }
              {metricCard("نسخوا الإيميل", formatNumber(dashboard.email?.copied?.users), "إشارة استخدام أقوى")}
              {metricCard("متوسط الإيميلات لكل مستخدم", formatNumber(dashboard.email?.averagePerUser))}
            </div>
          </Section>
        </>
      )}

      {activeTab === "activity" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
            {metricCard("نشطون اليوم", formatNumber(activity.dailyActive))}
            {metricCard("نشطون 7 أيام", formatNumber(activity.weeklyActive))}
            {metricCard("نشطون 30 يوم", formatNumber(activity.monthlyActive))}
            {metricCard("Weekly Returning Users", formatNumber(activity.weeklyReturning), "نشطون في يومين مختلفين أو أكثر")}
            {metricCard("لم يعودوا 7 أيام", formatNumber(activity.subscribersAbsent7Days), "مشتركون حاليون", "#fbbf24")}
            {metricCard("لم يعودوا 14 يوم", formatNumber(activity.subscribersAbsent14Days), "مشتركون حاليون", "#fb7185")}
          </div>
          <Section title="متوسط الوقت النشط" description="يُحسب عند إخفاء الصفحة أو مغادرتها فقط، ولا يوجد ping أو request متكرر.">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
              {metricCard("كل الجلسات", formatDuration(activity.averageSessionSeconds))}
              {metricCard("المشتركون", formatDuration(activity.averagePremiumSessionSeconds))}
              {metricCard("غير المشتركون", formatDuration(activity.averageFreeSessionSeconds))}
            </div>
          </Section>
        </>
      )}

      {activeTab === "content" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 10 }}>
          <CompactList title="أكثر 5 تجارب قراءة" items={content.experiences} />
          <CompactList title="أكثر 5 فرص فتحًا" items={content.opportunities} />
          <CompactList title="أكثر 5 شركات بحثًا" items={content.companies} />
          <CompactList title="أكثر التخصصات" items={content.majors} />
          <CompactList title="أكثر المدن" items={content.cities} />
          <CompactList title="أكثر مصادر بدء checkout" items={dashboard.attribution} />
        </div>
      )}

      {activeTab === "users" && (
        <Section title="المستخدمون والاشتراكات" description="سجل الحسابات الحالي بقي كما هو: البحث بالبريد، حالة الوصول، الباقة، تاريخ الانتهاء وإدارة الحساب.">
          <button type="button" onClick={onOpenUsers} style={{ justifySelf: "start", background: colors.brand, color: "#061312", border: 0, borderRadius: 9, padding: "11px 15px", cursor: "pointer", fontFamily: "inherit", fontWeight: 900 }}>فتح المستخدمين والاشتراكات</button>
        </Section>
      )}

      <p style={{ margin: 0, color: colors.muted, fontSize: 12, lineHeight: 1.7 }}>{rangeNotice}</p>
    </div>
  );
};

export default SubscriptionDashboard;
