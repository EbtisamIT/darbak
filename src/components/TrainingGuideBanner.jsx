import React from "react";

export const guideUrl =
  "https://darbakk.com/%D8%AD%D8%B2%D9%85%D8%A9-%D8%AF%D8%B1%D8%A8%D9%83-%D9%84%D9%84%D8%AA%D9%82%D8%AF%D9%8A%D9%85-%D8%B9%D9%84%D9%89-%D8%A7%D9%84%D8%AA%D8%AF%D8%B1%D9%8A%D8%A8-%D8%A7%D9%84%D8%AA%D8%B9%D8%A7%D9%88%D9%86%D9%8A-%D8%AC%D9%87%D8%A7%D8%AA-%D8%A5%D9%8A%D9%85%D9%8A%D9%84%D8%A7%D8%AA-%D8%B1%D9%88%D8%A7%D8%A8%D8%B7-%D9%85%D8%AA%D8%A7%D8%A8%D8%B9%D8%A9/p2135973764";

export default function TrainingGuideBanner({
  compact = false,
  style = {},
  onClick,
  ariaLabel = "دليل التقديم على التدريب التعاوني لعام 2026",
  badges = ["🌟 للطلاب المقبلين على التدريب", "✅ أكثر من 700 جهة"],
  title = "لا تبدأ رحلة التدريب من الصفر 🌟",
  description = "جهزنا لك حزمة دربك للتقديم على التدريب التعاوني لعام 2026 ✅ أكثر من 700 جهة، روابط وإيميلات، وطريقة سهلة تتابع فيها طلباتك خطوة بخطوة.",
  buttonText = "ابدأ الآن بـ 25 ريال فقط ✅",
}) {
  return (
    <section
      className={`training-guide-banner${compact ? " training-guide-banner--compact" : ""}`}
      aria-label={ariaLabel}
      style={{
        position: "relative",
        overflow: "hidden",
        display: "grid",
        gridTemplateColumns: compact ? "minmax(0, 1fr)" : "minmax(0, 1fr) auto",
        gap: compact ? "12px" : "16px",
        alignItems: "center",
        width: "100%",
        background:
          "linear-gradient(135deg, rgba(125,219,205,0.18), var(--app-surface) 52%, rgba(245,158,11,0.12))",
        border: "1px solid var(--app-brand-border)",
        borderRadius: compact ? "16px" : "18px",
        padding: compact ? "14px" : "18px",
        boxShadow: "0 16px 36px var(--app-shadow)",
        textAlign: "right",
        boxSizing: "border-box",
        ...style,
      }}
    >
      <div style={{ display: "grid", gap: "7px" }}>
        <div style={{ display: "flex", gap: "7px", flexWrap: "wrap" }}>
          {badges.map((badge) => (
            <span
              key={badge}
              style={{
                width: "fit-content",
                background: "rgba(245,158,11,0.14)",
                border: "1px solid rgba(245,158,11,0.28)",
                color: "#facc15",
                borderRadius: "999px",
                padding: "5px 10px",
                fontSize: "12px",
                fontWeight: "900",
              }}
            >
              {badge}
            </span>
          ))}
        </div>
        <h2
          style={{
            margin: 0,
            color: "var(--app-text)",
            fontSize: compact ? "clamp(18px, 3vw, 24px)" : "clamp(20px, 3vw, 30px)",
            lineHeight: 1.35,
          }}
        >
          {title}
        </h2>
        <p
          style={{
            margin: 0,
            color: "var(--app-text-soft)",
            fontSize: compact ? "13px" : "14px",
            lineHeight: 1.8,
            maxWidth: compact ? "none" : "660px",
          }}
        >
          {description}
        </p>
      </div>

      <a
        href={guideUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        style={{ textDecoration: "none" }}
      >
        <button
          type="button"
          style={{
            width: compact ? "100%" : "auto",
            background: "var(--app-brand)",
            color: "#07100e",
            border: "none",
            borderRadius: "14px",
            padding: compact ? "11px 14px" : "12px 16px",
            cursor: "pointer",
            fontFamily: "inherit",
            fontWeight: "900",
            fontSize: "13px",
            lineHeight: 1.6,
            whiteSpace: "normal",
            maxWidth: compact ? "none" : "230px",
            boxShadow: "0 0 18px var(--app-brand-border)",
          }}
        >
          {buttonText}
        </button>
      </a>

      <style>{`
        @media (max-width: 760px) {
          .training-guide-banner {
            grid-template-columns: 1fr !important;
            padding: 14px !important;
            gap: 12px !important;
          }

          .training-guide-banner a,
          .training-guide-banner button {
            width: 100% !important;
            max-width: none !important;
          }

          .training-guide-banner h2 {
            font-size: 20px !important;
          }
        }
      `}</style>
    </section>
  );
}
