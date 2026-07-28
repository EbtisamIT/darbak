import React, { useEffect, useState } from "react";
import API_BASE_URL from "../config/api";

const formatPlusStat = (value) =>
  typeof value === "number" ? `${value.toLocaleString("en-US")}+` : "";

export default function PremiumInlineNotice({
  title = "وقفت هنا... وباقي أهم التجارب 👀",
  description = "",
  lockedItems = [],
  onUnlock,
  onSkip,
}) {
  const [stats, setStats] = useState({
    experiencesCount: null,
    activeSubscribersCount: null,
  });
  const visibleItems = lockedItems.filter(Boolean).slice(0, 4);
  const experiencesLabel = formatPlusStat(stats.experiencesCount);
  const subscribersLabel = formatPlusStat(stats.activeSubscribersCount);
  const noticeDescription =
    description ||
    `باقي لك تجارب ممكن تختصر عليك شهور بحث وتساعدك تختار الجهة الصح.${
      experiencesLabel ? ` ${experiencesLabel} تجربة + فرص تدريب محدثة.` : ""
    }`;

  useEffect(() => {
    let isMounted = true;

    const fetchStats = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/home-stats`);
        const data = await response.json();
        if (!isMounted) return;

        setStats({
          experiencesCount:
            typeof data.experiencesCount === "number"
              ? data.experiencesCount
              : null,
          activeSubscribersCount:
            typeof data.activeSubscribersCount === "number"
              ? data.activeSubscribersCount
              : null,
        });
      } catch {
        // Decorative stats only.
      }
    };

    fetchStats();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="premium-inline-notice" dir="rtl">
      <div className="premium-inline-copy">
        <span className="premium-inline-badge">دربك+</span>
        <h3>{title}</h3>
        <p>{noticeDescription}</p>

        <div className="premium-inline-actions">
          {subscribersLabel && (
            <span className="premium-inline-social-proof">
              انضم لـ {subscribersLabel} طالب اشتركوا في دربك
            </span>
          )}
          <button type="button" onClick={onUnlock}>
            كمل استكشافك
          </button>
          <button
            type="button"
            className="premium-inline-skip"
            onClick={onSkip}
          >
            لاحقًا
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
