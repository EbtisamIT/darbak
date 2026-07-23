import React from "react";

export default function PremiumInlineNotice({
  title = "استخدمت المحتوى المجاني المتاح لك 🤍",
  description = "اشترك في دربك+ للوصول إلى جميع تجارب التدريب والفرص المناسبة لتخصصك طوال الشهر بـ5.99 ريال.",
  lockedItems = [],
  onUnlock,
  onSkip,
}) {
  const visibleItems = lockedItems.filter(Boolean).slice(0, 4);

  return (
    <section className="premium-inline-notice" dir="rtl">
      <div className="premium-inline-copy">
        <span className="premium-inline-badge">دربك+</span>
        <h3>{title}</h3>
        <p>{description}</p>

        <div className="premium-inline-actions">
          <button type="button" onClick={onUnlock}>
            فتح جميع التجارب والفرص
          </button>
          <button
            type="button"
            className="premium-inline-skip"
            onClick={onSkip}
          >
            تخطي
          </button>
        </div>
      </div>

      {visibleItems.length > 0 && (
        <div className="premium-inline-locked-list" aria-label="محتوى إضافي مقفل">
          {visibleItems.map((item, index) => (
            <div className="premium-inline-locked-card" key={`${item}-${index}`}>
              <span aria-hidden="true">🔒</span>
              <strong>{item}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
