import React from "react";

export default function StudentFeedbackControls({ tab, pagination, loading, colors, onTabChange, onPageChange, showTabs = true }) {
  const { page, limit, total, totalPages } = pagination;
  const buttonStyle = {
    padding: "8px 12px", borderRadius: "8px", border: `1px solid ${colors.inputBorder}`,
    background: "transparent", color: colors.text, fontFamily: "inherit", cursor: "pointer",
  };
  return (
    <div style={{ display: "grid", gap: "12px" }} aria-busy={loading}>
      {showTabs && <div role="group" aria-label="تصفية آراء الطلاب" style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {[["written", "آراء مكتوبة"], ["all", "كل الردود"], ["publishable", "قابلة للنشر"], ["published", "منشورة"]].map(([value, label]) => (
          <button key={value} type="button" disabled={loading} aria-pressed={tab === value} onClick={() => onTabChange(value)}
            style={{ ...buttonStyle, fontWeight: 800, background: tab === value ? colors.brand : "transparent", color: tab === value ? "#08201c" : colors.text }}>
            {label}
          </button>
        ))}
      </div>}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
        <span role="status" style={{ color: colors.muted, fontSize: "13px" }}>
          {loading ? "جارٍ تحميل الآراء..." : `عرض ${total ? (page - 1) * limit + 1 : 0}–${Math.min(page * limit, total)} من ${total} ردًا`}
        </span>
        {totalPages > 1 && <nav aria-label="صفحات آراء الطلاب" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
          <button type="button" disabled={loading || page <= 1} onClick={() => onPageChange(page - 1)} style={{ ...buttonStyle, opacity: loading || page <= 1 ? 0.45 : 1 }}>الأحدث</button>
          <span style={{ color: colors.muted, fontSize: "13px" }}>صفحة {page} من {totalPages}</span>
          <button type="button" disabled={loading || page >= totalPages} onClick={() => onPageChange(page + 1)} style={{ ...buttonStyle, opacity: loading || page >= totalPages ? 0.45 : 1 }}>الأقدم</button>
        </nav>}
      </div>
    </div>
  );
}
