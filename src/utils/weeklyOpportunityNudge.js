export const WEEKLY_OPPORTUNITY_NUDGE_SEEN_KEY =
  "darbak_weekly_opportunity_nudge_seen_v1";

export const normalizeWeeklyOpportunityHighlight = (payload = {}) => {
  const count = Number(payload.count);
  const organizationNames = Array.from(
    new Set(
      (Array.isArray(payload.organizationNames) ? payload.organizationNames : [])
        .map((name) => String(name || "").trim())
        .filter(Boolean)
    )
  ).slice(0, 4);

  return {
    count: Number.isFinite(count) && count > 0 ? Math.floor(count) : 0,
    organizationNames,
    periodKey: String(payload.periodKey || "").trim(),
  };
};

export const hasBlockingAttentionLayer = (documentRef = document) =>
  Boolean(
    documentRef.querySelector(
      [
        '[role="dialog"][aria-modal="true"]',
        ".subscription-reminder-overlay",
        ".subscription-reminder-bar",
        ".premium-access-overlay",
      ].join(",")
    )
  );

export const wasWeeklyOpportunityNudgeSeen = (
  periodKey,
  storage = window.localStorage
) => Boolean(periodKey && storage.getItem(WEEKLY_OPPORTUNITY_NUDGE_SEEN_KEY) === periodKey);

export const markWeeklyOpportunityNudgeSeen = (
  periodKey,
  storage = window.localStorage
) => {
  if (periodKey) {
    storage.setItem(WEEKLY_OPPORTUNITY_NUDGE_SEEN_KEY, periodKey);
  }
};
