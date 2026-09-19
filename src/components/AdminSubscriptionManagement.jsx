import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import ResumePreview from "../features/resume/ResumePreview";

const colors = {
  brand: "#66d0c3",
  brandStrong: "#8ee7dc",
  text: "#d8e5e2",
  textSoft: "#bfccc9",
  muted: "#8e9f9b",
  card: "#11171c",
  border: "rgba(216,229,226,0.12)",
  input: "#0d1317",
  amber: "#fbbf24",
  red: "#fca5a5",
};

export const subscriptionAdminFilterOptions = [
  ["all", "كل الاشتراكات"],
  ["active", "نشط"],
  ["cancel_at_period_end", "إلغاء التجديد"],
  ["expired", "منتهي"],
  ["suspended", "موقوف"],
  ["refunded", "مسترد"],
  ["resume_created", "أنشأ سيرة"],
  ["resume_missing", "لم ينشئ سيرة"],
  ["usage_low", "استفادة منخفضة"],
  ["usage_high", "استفادة مرتفعة"],
  ["unused", "لم يستخدم أي ميزة"],
];

const statusLabels = {
  active: "نشط",
  cancel_at_period_end: "إلغاء التجديد",
  expired: "منتهي",
  suspended: "موقوف",
  refunded: "مسترد",
  pending: "بانتظار الدفع",
  cancelled: "ملغي",
};

const sourceLabels = {
  moyasar: "Moyasar",
  manual: "يدوي",
  compensation: "تعويض",
  free: "مجاني",
};

const refundLabels = {
  none: "لا يوجد طلب",
  requested: "قيد المراجعة",
  approved: "تمت الموافقة",
  rejected: "مرفوض",
  exceptional: "استرجاع استثنائي",
  closed: "مغلق",
};

export const filterAdminSubscriptions = (subscriptions = [], filter = "all") =>
  subscriptions.filter((subscription) => {
    if (filter === "all") return true;
    if (["active", "cancel_at_period_end", "expired", "suspended", "refunded"].includes(filter)) {
      return subscription.status === filter;
    }
    if (filter === "resume_created") return Boolean(subscription.hasResume);
    if (filter === "resume_missing") return !subscription.hasResume;
    if (filter === "usage_low") {
      return subscription.usagePercentage > 0 && subscription.usagePercentage < 40;
    }
    if (filter === "usage_high") return subscription.usagePercentage >= 60;
    if (filter === "unused") return !subscription.hasUsedAnyFeature;
    return true;
  });

const formatDate = (value, includeTime = false) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" } : {}),
  }).format(date);
};

const DetailRow = ({ label, value }) => (
  <div style={{ display: "grid", gap: 4 }}>
    <small style={{ color: colors.muted }}>{label}</small>
    <strong style={{ color: colors.text, overflowWrap: "anywhere" }}>{value || "-"}</strong>
  </div>
);

const StatusBadge = ({ status }) => {
  const warning = ["cancel_at_period_end", "pending"].includes(status);
  const danger = ["suspended", "refunded", "expired", "cancelled"].includes(status);
  return (
    <span
      style={{
        display: "inline-flex",
        borderRadius: 999,
        padding: "5px 9px",
        fontSize: 12,
        fontWeight: 900,
        color: danger ? colors.red : warning ? colors.amber : colors.brandStrong,
        background: danger
          ? "rgba(248,113,113,.1)"
          : warning
          ? "rgba(251,191,36,.1)"
          : "rgba(102,208,195,.1)",
        border: `1px solid ${danger ? "rgba(248,113,113,.28)" : warning ? "rgba(251,191,36,.28)" : "rgba(102,208,195,.28)"}`,
      }}
    >
      {statusLabels[status] || status || "-"}
    </span>
  );
};

const ActionButton = ({ children, danger = false, disabled = false, onClick }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    style={{
      border: `1px solid ${danger ? "rgba(248,113,113,.34)" : "rgba(102,208,195,.3)"}`,
      background: danger ? "rgba(248,113,113,.08)" : "rgba(102,208,195,.08)",
      color: danger ? colors.red : colors.brandStrong,
      borderRadius: 9,
      padding: "9px 11px",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.55 : 1,
      fontFamily: "inherit",
      fontWeight: 800,
    }}
  >
    {children}
  </button>
);

function SubscriberDrawer({
  details,
  loading,
  error,
  busy,
  onClose,
  onRetry,
  onAction,
  onResendPaymentEmail,
}) {
  const [showResume, setShowResume] = useState(false);
  const [compensationDays, setCompensationDays] = useState("3");
  const [compensationReason, setCompensationReason] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundNote, setRefundNote] = useState("");
  const [refundAmount, setRefundAmount] = useState("");

  const subscription = details?.subscription || {};
  const refund = details?.refund || {};

  useEffect(() => {
    setRefundReason(refund.reason || "");
    setRefundNote(refund.adminNote || "");
    setRefundAmount(
      refund.refundedAmountSar > 0 ? String(refund.refundedAmountSar) : ""
    );
  }, [refund.adminNote, refund.reason, refund.refundedAmountSar]);

  const submitAction = (action, payload = {}) => onAction(action, payload);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="تفاصيل المشترك"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1200,
        background: "rgba(0,0,0,.62)",
        display: "flex",
        justifyContent: "flex-start",
      }}
    >
      <aside
        style={{
          width: "min(680px, 100%)",
          height: "100%",
          overflowY: "auto",
          background: "#0d1216",
          borderLeft: `1px solid ${colors.border}`,
          padding: 20,
          boxSizing: "border-box",
          direction: "rtl",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <h2 style={{ color: colors.text, margin: 0 }}>تفاصيل المشترك</h2>
            <p style={{ color: colors.muted, margin: "5px 0 0" }}>{details?.account?.email || ""}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="إغلاق" style={{ background: "transparent", border: 0, color: colors.text, fontSize: 26, cursor: "pointer" }}>×</button>
        </div>

        {loading ? (
          <p style={{ color: colors.muted, marginTop: 30 }}>جارٍ تحميل التفاصيل...</p>
        ) : !details ? (
          <div style={{ ...cardStyle, marginTop: 30 }}>
            <p style={{ color: colors.red, margin: "0 0 12px" }}>
              {error || "تعذر تحميل تفاصيل المشترك."}
            </p>
            <ActionButton onClick={onRetry}>إعادة المحاولة</ActionButton>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
            <section className="admin-subscription-detail-grid" style={{ ...cardStyle, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}>
              <h3 style={{ color: colors.brand, margin: 0, gridColumn: "1 / -1" }}>معلومات الحساب</h3>
              <DetailRow label="البريد" value={details.account?.email} />
              <DetailRow label="الاسم" value={details.account?.name} />
              <DetailRow label="التخصص" value={details.account?.major} />
              <DetailRow label="المدينة" value={details.account?.city} />
            </section>

            <section className="admin-subscription-detail-grid" style={{ ...cardStyle, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}>
              <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <h3 style={{ color: colors.brand, margin: 0 }}>معلومات الاشتراك</h3>
                <StatusBadge status={subscription.status} />
              </div>
              <DetailRow label="الباقة" value={subscription.planLabel || subscription.planId} />
              <DetailRow label="المصدر" value={sourceLabels[subscription.sourceType] || subscription.sourceType} />
              <DetailRow label="تاريخ البداية" value={formatDate(subscription.startsAt)} />
              <DetailRow label="تاريخ الانتهاء" value={formatDate(subscription.expiresAt)} />
              <DetailRow label="القيمة" value={`${subscription.priceSar || 0} SAR`} />
              <DetailRow label="رقم عملية الدفع" value={subscription.providerPaymentId} />
            </section>

            <section style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <h3 style={{ color: colors.brand, margin: 0 }}>الاستفادة من الاشتراك</h3>
                <strong style={{ color: colors.brandStrong, fontSize: 22 }}>{details.usage?.percentage || 0}%</strong>
              </div>
              <div style={{ height: 8, background: "rgba(255,255,255,.07)", borderRadius: 999, overflow: "hidden", margin: "12px 0" }}>
                <div style={{ width: `${details.usage?.percentage || 0}%`, height: "100%", background: colors.brand }} />
              </div>
              {details.usage?.unavailable && (
                <small style={{ display: "block", color: colors.amber, marginBottom: 10 }}>
                  تعذر تحديث ملخص الاستخدام الآن، لكن بقية تفاصيل الاشتراك متاحة.
                </small>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                {(details.usage?.features || []).map((feature) => (
                  <div key={feature.key} style={{ color: colors.textSoft, fontSize: 13 }}>
                    {feature.label}: <strong style={{ color: feature.used ? colors.brandStrong : colors.muted }}>{feature.used ? feature.count > 1 ? `${feature.count} مرات` : "مستخدمة" : "لم تستخدم"}</strong>
                  </div>
                ))}
              </div>
            </section>

            <section style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <h3 style={{ color: colors.brand, margin: "0 0 5px" }}>السيرة الذاتية</h3>
                  <span style={{ color: details.resume ? colors.brandStrong : colors.muted }}>{details.resume ? "تم إنشاؤها" : "لم يتم"}</span>
                </div>
                {details.resume && <ActionButton onClick={() => setShowResume(true)}>عرض السيرة</ActionButton>}
              </div>
            </section>

            <section style={cardStyle}>
              <h3 style={{ color: colors.brand, margin: "0 0 12px" }}>إدارة الاشتراك</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {subscription.status === "suspended" ? (
                  <ActionButton disabled={busy} onClick={() => submitAction("reactivate")}>إعادة تفعيل الاشتراك</ActionButton>
                ) : (
                  <ActionButton danger disabled={busy || ["expired", "refunded"].includes(subscription.status)} onClick={() => {
                    if (window.confirm("سيتم إيقاف وصول المستخدم للمزايا المدفوعة فورًا. هل تريدين المتابعة؟")) submitAction("suspend");
                  }}>إيقاف الاشتراك</ActionButton>
                )}
                <ActionButton disabled={busy || subscription.cancelAtPeriodEnd} onClick={() => submitAction("cancel_renewal")}>إلغاء التجديد</ActionButton>
                {subscription.providerPaymentId && <ActionButton disabled={busy} onClick={() => onResendPaymentEmail(subscription)}>إيميل الدفع</ActionButton>}
              </div>
              <div className="admin-subscription-compensation-form" style={{ display: "grid", gridTemplateColumns: "120px 1fr auto", gap: 8, marginTop: 12 }}>
                <select value={compensationDays} onChange={(event) => setCompensationDays(event.target.value)} style={inputStyle}>
                  <option value="3">+3 أيام</option>
                  <option value="7">+7 أيام</option>
                  <option value="30">+30 يومًا</option>
                </select>
                <input value={compensationReason} onChange={(event) => setCompensationReason(event.target.value)} placeholder="سبب التعويض" style={inputStyle} />
                <ActionButton disabled={busy || !compensationReason.trim()} onClick={() => submitAction("add_days", { days: Number(compensationDays), reason: compensationReason.trim() })}>إضافة مدة</ActionButton>
              </div>
            </section>

            <section style={cardStyle}>
              <h3 style={{ color: colors.brand, margin: "0 0 10px" }}>حالة الاسترجاع</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                <DetailRow label="الحالة" value={refundLabels[refund.status]} />
                <DetailRow label="تاريخ الاشتراك" value={formatDate(subscription.startsAt)} />
                <DetailRow label="تاريخ طلب الاسترجاع" value={formatDate(refund.requestedAt)} />
                <DetailRow label="الأيام منذ الاشتراك" value={String(refund.daysSinceSubscription ?? 0)} />
                <DetailRow label="استخدم ميزة مدفوعة؟" value={refund.usedPaidFeature ? "نعم" : "لا"} />
                <DetailRow label="نسبة الاستفادة" value={`${refund.usagePercentage || 0}%`} />
                <DetailRow label="المبلغ المدفوع" value={`${refund.paidAmountSar || 0} SAR`} />
                <DetailRow label="المبلغ المسترد" value={`${refund.refundedAmountSar || 0} SAR`} />
              </div>
              <textarea value={refundReason} onChange={(event) => setRefundReason(event.target.value)} placeholder="سبب الاسترجاع" rows={2} style={{ ...inputStyle, marginTop: 10, resize: "vertical" }} />
              <textarea value={refundNote} onChange={(event) => setRefundNote(event.target.value)} placeholder="ملاحظة الأدمن" rows={2} style={{ ...inputStyle, marginTop: 8, resize: "vertical" }} />
              <input type="number" min="0" step="0.01" value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} placeholder={`مبلغ الاسترجاع — الافتراضي ${refund.paidAmountSar || 0} SAR`} style={{ ...inputStyle, marginTop: 8 }} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                <ActionButton disabled={busy} onClick={() => submitAction("refund_request", { reason: refundReason, adminNote: refundNote })}>تسجيل طلب استرجاع</ActionButton>
                <ActionButton disabled={busy} onClick={() => submitAction("refund_approve", { reason: refundReason, adminNote: refundNote, amountSar: refundAmount === "" ? refund.paidAmountSar : Number(refundAmount) })}>تمت الموافقة</ActionButton>
                <ActionButton danger disabled={busy} onClick={() => submitAction("refund_reject", { reason: refundReason, adminNote: refundNote })}>تم الرفض</ActionButton>
                <ActionButton disabled={busy} onClick={() => submitAction("refund_exceptional", { reason: refundReason, adminNote: refundNote, amountSar: refundAmount === "" ? refund.paidAmountSar : Number(refundAmount) })}>استرجاع استثنائي</ActionButton>
                <ActionButton disabled={busy} onClick={() => submitAction("refund_close", { adminNote: refundNote })}>إغلاق الطلب</ActionButton>
              </div>
              <small style={{ display: "block", color: colors.muted, marginTop: 9 }}>هذه الإجراءات تسجل القرار فقط ولا تنفذ Refund تلقائيًا من Moyasar.</small>
            </section>

            <section style={cardStyle}>
              <h3 style={{ color: colors.brand, margin: "0 0 10px" }}>السجل الإداري</h3>
              {(details.adminEvents || []).length ? (
                <div style={{ display: "grid", gap: 9 }}>
                  {details.adminEvents.map((event, index) => (
                    <div key={`${event.type}-${event.createdAt}-${index}`} style={{ borderBottom: index < details.adminEvents.length - 1 ? `1px solid ${colors.border}` : 0, paddingBottom: 8 }}>
                      <strong style={{ color: colors.text }}>{event.label}</strong>
                      <small style={{ display: "block", color: colors.muted, marginTop: 3 }}>{formatDate(event.createdAt, true)}{event.reason ? ` — ${event.reason}` : ""}</small>
                    </div>
                  ))}
                </div>
              ) : <p style={{ color: colors.muted, margin: 0 }}>لا توجد إجراءات إدارية بعد.</p>}
            </section>
          </div>
        )}
      </aside>

      {showResume && details?.resume && (
        <div role="dialog" aria-modal="true" aria-label="السيرة المحفوظة" style={{ position: "fixed", inset: 0, zIndex: 1300, background: "rgba(0,0,0,.78)", overflowY: "auto", padding: "28px 14px" }}>
          <div style={{ maxWidth: 920, margin: "0 auto" }}>
            <button type="button" onClick={() => setShowResume(false)} style={{ ...inputStyle, width: "auto", marginBottom: 12, cursor: "pointer" }}>إغلاق السيرة</button>
            <ResumePreview resume={details.resume} />
          </div>
        </div>
      )}
    </div>
  );
}

const cardStyle = {
  background: "rgba(255,255,255,.025)",
  border: `1px solid ${colors.border}`,
  borderRadius: 13,
  padding: 15,
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  background: colors.input,
  color: colors.text,
  border: `1px solid ${colors.border}`,
  borderRadius: 9,
  padding: "9px 10px",
  fontFamily: "inherit",
};

export default function AdminSubscriptionManagement({
  subscriptions = [],
  apiBaseUrl,
  authHeaders,
  getPlanLabel,
  onRefresh,
  onMessage,
  onResendPaymentEmail,
}) {
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [details, setDetails] = useState(null);
  const [detailsError, setDetailsError] = useState("");
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const filteredSubscriptions = useMemo(
    () => filterAdminSubscriptions(subscriptions, filter),
    [subscriptions, filter]
  );

  const openDetails = async (id) => {
    setSelectedId(id);
    setDetails(null);
    setDetailsError("");
    setDetailsLoading(true);
    try {
      const { data } = await axios.get(`${apiBaseUrl}/api/admin/subscriptions/${id}`, { headers: authHeaders });
      setDetails(data);
    } catch (error) {
      const errorMessage =
        error.response?.data?.error || "تعذر تحميل تفاصيل المشترك.";
      setDetailsError(errorMessage);
      onMessage(errorMessage);
    } finally {
      setDetailsLoading(false);
    }
  };

  const applyAction = async (action, payload = {}) => {
    if (!selectedId) return;
    setActionBusy(true);
    try {
      await axios.patch(
        `${apiBaseUrl}/api/admin/subscriptions/${selectedId}`,
        { action, ...payload },
        { headers: authHeaders }
      );
      onMessage("تم تحديث الاشتراك بنجاح.");
      await openDetails(selectedId);
      onRefresh();
    } catch (error) {
      onMessage(error.response?.data?.error || "تعذر تحديث الاشتراك.");
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <section style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12, flexWrap: "wrap", marginBottom: 13 }}>
        <div>
          <h3 style={{ color: colors.brand, margin: "0 0 6px" }}>الاشتراكات</h3>
          <p style={{ color: colors.muted, margin: 0, lineHeight: 1.7 }}>ملخص خفيف للحساب، وتظهر التفاصيل والاستخدام والسيرة عند فتح المشترك فقط.</p>
        </div>
        <label style={{ display: "grid", gap: 5, color: colors.muted, fontSize: 12 }}>
          تصفية الاشتراكات
          <select value={filter} onChange={(event) => setFilter(event.target.value)} style={{ ...inputStyle, minWidth: 210 }}>
            {subscriptionAdminFilterOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 1180, borderCollapse: "collapse", color: colors.text }}>
          <thead>
            <tr style={{ color: colors.muted, fontSize: 12 }}>
              {["البريد", "التخصص", "الباقة", "البداية", "الانتهاء", "الاستفادة", "السيرة", "آخر استخدام", "الحالة", ""].map((label) => <th key={label || "action"} style={{ textAlign: "right", padding: 9 }}>{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {!filteredSubscriptions.length ? (
              <tr><td colSpan="10" style={{ padding: 14, color: colors.muted }}>لا توجد اشتراكات مطابقة لهذا الفلتر.</td></tr>
            ) : filteredSubscriptions.map((subscription) => (
              <tr key={subscription.id} onClick={() => openDetails(subscription.id)} style={{ borderTop: `1px solid ${colors.border}`, cursor: "pointer" }}>
                <td style={cellStyle}>{subscription.email || "-"}</td>
                <td style={cellStyle}>{subscription.major || "-"}</td>
                <td style={cellStyle}>{getPlanLabel(subscription.planId)}</td>
                <td style={cellStyle}>{formatDate(subscription.startsAt)}</td>
                <td style={cellStyle}>{formatDate(subscription.expiresAt)}</td>
                <td style={cellStyle}><strong style={{ color: colors.brandStrong }}>{subscription.usagePercentage || 0}%</strong></td>
                <td style={cellStyle}>{subscription.hasResume ? "تم إنشاؤها" : "لم يتم"}</td>
                <td style={cellStyle}>{formatDate(subscription.lastFeatureUsedAt, true)}</td>
                <td style={cellStyle}><StatusBadge status={subscription.status} /></td>
                <td style={cellStyle}><ActionButton onClick={(event) => { event.stopPropagation(); openDetails(subscription.id); }}>التفاصيل</ActionButton></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedId && (
        <SubscriberDrawer
          details={details}
          loading={detailsLoading}
          error={detailsError}
          busy={actionBusy}
          onClose={() => { setSelectedId(""); setDetails(null); }}
          onRetry={() => openDetails(selectedId)}
          onAction={applyAction}
          onResendPaymentEmail={onResendPaymentEmail}
        />
      )}
    </section>
  );
}

const cellStyle = {
  padding: 9,
  fontSize: 13,
  whiteSpace: "nowrap",
  verticalAlign: "middle",
};
