import React, { useEffect, useState } from "react";
import axios from "axios";
import API_BASE_URL from "../config/api";

const lifecycleLabels = { student: "طالب جامعي", graduate: "خريج" };
const subscriptionLabels = {
  free: "مجاني", active: "نشط", expired: "منتهي", pending: "قيد الدفع",
  cancelled: "ملغي", suspended: "موقوف", refunded: "مسترد",
};
const dateLabel = (value) => value ? new Date(value).toLocaleDateString("ar-SA") : "";

export default function AdminUserAnalyticsSummary({ userId, authHeaders }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    axios.get(`${API_BASE_URL}/api/admin/users/${encodeURIComponent(userId)}/analytics-summary`, { headers: authHeaders })
      .then(({ data: payload }) => { if (active) setData(payload); })
      .catch(() => { if (active) setError("تعذر تحميل الملخص."); });
    return () => { active = false; };
    // Fetch only when this user detail is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p role="status">جاري تحميل الملخص...</p>;

  const profile = data.profile || {};
  const behaviour = data.behaviour || {};
  const identity = [lifecycleLabels[profile.lifecycleStage], profile.major, profile.city].filter(Boolean);
  const facts = [
    profile.graduationYear && `سنة التخرج: ${profile.graduationYear}`,
    profile.university && `الجامعة: ${profile.university}`,
    profile.signupDate && `انضم في ${dateLabel(profile.signupDate)}`,
    profile.lastActiveAt && `آخر نشاط: ${dateLabel(profile.lastActiveAt)}`,
    profile.activeDays30 > 0 && `أيام النشاط آخر 30 يومًا: ${profile.activeDays30}`,
    `الاشتراك: ${subscriptionLabels[profile.subscriptionStatus] || profile.subscriptionStatus || "غير محدد"}`,
  ].filter(Boolean);
  const activity = [
    ["فرصة مفتوحة", "فرص مفتوحة", behaviour.opportunitiesOpened],
    ["نقرة تقديم", "نقرات تقديم", behaviour.applyClicks],
    ["تقديم محفوظ", "تقديمات محفوظة", behaviour.applicationsTracked],
    ["تجربة مقروءة", "تجارب مقروءة", behaviour.experiencesRead],
    ["مقابلة مقروءة", "مقابلات مقروءة", behaviour.interviewsRead],
    ["تجربة مضافة", "تجارب مضافة", behaviour.experiencesContributed],
  ].filter(([, , count]) => Number(count) > 0);
  const reward = behaviour.rewardStatus === "available" ? "مكافأة جاهزة"
    : behaviour.rewardStatus === "redeemed" ? "سيرة المكافأة مكتملة" : "المكافأة: لا توجد";

  return <section style={{ display: "grid", gap: 10, borderTop: "1px solid rgba(102,208,195,.22)", paddingTop: 12 }}>
    <h4 style={{ margin: 0 }}>ملخص المستخدم</h4>
    {identity.length > 0 && <p style={{ margin: 0 }}>{identity.join(" · ")}</p>}
    <p style={{ margin: 0, color: "#a7b8b4" }}>{facts.join(" · ")}</p>
    {activity.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {activity.map(([singular, plural, count]) => <span key={plural} style={{ border: "1px solid rgba(216,229,226,.12)", borderRadius: 8, padding: "7px 10px" }}>
        {count} {count === 1 ? singular : plural}
      </span>)}
    </div>}
    <p style={{ margin: 0 }}>{reward}</p>
    {data.trackingStartedAt && <small style={{ color: "#a7b8b4" }}>
      يُقاس نشاط الصفحات منذ {dateLabel(data.trackingStartedAt)}.
    </small>}
    {!data.trackingStartedAt && activity.length === 0 && <small style={{ color: "#a7b8b4" }}>تاريخ بدء قياس نشاط الصفحات غير موثّق.</small>}
  </section>;
}
