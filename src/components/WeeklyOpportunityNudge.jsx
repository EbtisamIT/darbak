import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import API_BASE_URL from "../config/api";
import { PREMIUM_ACCESS_EVENT } from "../utils/premiumAccess";
import {
  hasBlockingAttentionLayer,
  markWeeklyOpportunityNudgeSeen,
  normalizeWeeklyOpportunityHighlight,
  wasWeeklyOpportunityNudgeSeen,
} from "../utils/weeklyOpportunityNudge";
import "./WeeklyOpportunityNudge.css";

const INITIAL_DELAY_MS = 60 * 1000;
const RETRY_DELAY_MS = 15 * 1000;

export default function WeeklyOpportunityNudge() {
  const location = useLocation();
  const navigate = useNavigate();
  const [highlight, setHighlight] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const timerRef = useRef(null);
  const isEligiblePath = ![
    "/where-to-train",
    "/subscribe",
  ].includes(location.pathname) &&
    !location.pathname.startsWith("/company/") &&
    !location.pathname.startsWith("/company-applications/") &&
    !location.pathname.startsWith("/darbak-owner-review");

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const close = useCallback(() => {
    if (highlight?.periodKey) {
      markWeeklyOpportunityNudgeSeen(highlight.periodKey);
    }
    setIsVisible(false);
  }, [highlight]);

  useEffect(() => {
    if (!isEligiblePath) return undefined;

    let isMounted = true;
    const loadHighlight = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/opportunities/weekly-highlight`
        );
        if (!response.ok) return;
        const normalized = normalizeWeeklyOpportunityHighlight(
          await response.json()
        );
        if (!isMounted || !normalized.count || !normalized.periodKey) return;
        if (wasWeeklyOpportunityNudgeSeen(normalized.periodKey)) return;
        setHighlight(normalized);
      } catch {
        // This nudge is optional and must never interrupt the student journey.
      }
    };

    loadHighlight();
    return () => {
      isMounted = false;
    };
  }, [isEligiblePath]);

  useEffect(() => {
    clearTimer();
    if (!isEligiblePath || !highlight || isVisible) return undefined;

    const tryToShow = () => {
      if (
        document.visibilityState !== "visible" ||
        hasBlockingAttentionLayer(document)
      ) {
        timerRef.current = window.setTimeout(tryToShow, RETRY_DELAY_MS);
        return;
      }
      setIsVisible(true);
    };

    timerRef.current = window.setTimeout(tryToShow, INITIAL_DELAY_MS);
    return clearTimer;
  }, [clearTimer, highlight, isEligiblePath, isVisible]);

  useEffect(() => {
    const deferForPremiumGate = () => {
      setIsVisible(false);
    };
    window.addEventListener(PREMIUM_ACCESS_EVENT, deferForPremiumGate);
    return () =>
      window.removeEventListener(PREMIUM_ACCESS_EVENT, deferForPremiumGate);
  }, [clearTimer]);

  if (!isVisible || !highlight) return null;

  const names = highlight.organizationNames.join("، ");

  return (
    <div
      className="weekly-opportunity-nudge-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="weekly-opportunity-nudge-title"
      onClick={close}
    >
      <section
        className="weekly-opportunity-nudge-card"
        dir="rtl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="weekly-opportunity-nudge-close"
          aria-label="إغلاق"
          onClick={close}
        >
          ×
        </button>
        <span className="weekly-opportunity-nudge-badge">جديد هذا الأسبوع ✨</span>
        <h2 id="weekly-opportunity-nudge-title">
          أضفنا {highlight.count} {highlight.count === 1 ? "فرصة جديدة" : "فرص جديدة"}
        </h2>
        {names && (
          <p>
            من جهات مثل <strong>{names}</strong>
          </p>
        )}
        <button
          type="button"
          className="weekly-opportunity-nudge-action"
          onClick={() => {
            close();
            navigate("/where-to-train");
          }}
        >
          استكشفها في وين أتدرب ←
        </button>
      </section>
    </div>
  );
}
