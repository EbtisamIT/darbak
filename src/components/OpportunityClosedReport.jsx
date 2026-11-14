import React, { useState } from "react";
import axios from "axios";
import API_BASE_URL from "../config/api";
import { getVisitorId, trackEvent } from "../utils/analytics";

const STORAGE_KEY = "darbak_reported_closed_opportunities";

const readReportedIds = () => {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const rememberReportedId = (id) => {
  try {
    const ids = [...new Set([...readReportedIds(), id])].slice(-200);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Storage is a convenience only; the server also ignores repeat reports.
  }
};

// "الفرصة منتهية؟" — lets students tell Darbak an opportunity has closed.
// Reuses the detail footer's tracker styles (see TrainingFinderPage).
export default function OpportunityClosedReport({ opportunity, className = "" }) {
  const opportunityId = opportunity?._id || opportunity?.id || "";
  const [state, setState] = useState(() =>
    opportunityId && readReportedIds().includes(opportunityId) ? "done" : "idle"
  );

  if (!opportunityId || opportunity?.isDarbakApplication) return null;

  const report = async () => {
    if (state === "sending" || state === "done") return;
    setState("sending");
    try {
      await axios.post(`${API_BASE_URL}/api/opportunities/${opportunityId}/closed-report`, {
        visitorId: getVisitorId(),
      });
      rememberReportedId(opportunityId);
      setState("done");
      trackEvent("opportunity_closed_reported", {
        opportunityId,
        opportunityTitle: opportunity.title || "",
        organizationName: opportunity.organizationName || "",
      });
    } catch {
      setState("error");
    }
  };

  return (
    <div className={`opportunity-detail-tracker ${className}`.trim()} aria-live="polite">
      {state === "done" ? (
        <span>شكرًا، بنتحقق من الفرصة ✓</span>
      ) : (
        <>
          <span>{state === "error" ? "تعذّر الإرسال." : "الفرصة منتهية؟"}</span>
          <button
            type="button"
            className="opportunity-secondary-button"
            disabled={state === "sending"}
            onClick={report}
          >
            {state === "sending" ? "جارٍ الإرسال..." : state === "error" ? "جرّب مرة ثانية" : "بلّغنا"}
          </button>
        </>
      )}
    </div>
  );
}
