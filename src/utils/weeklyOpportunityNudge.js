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
  _periodKey,
  storage = window.localStorage
) => {
  try {
    return Boolean(storage.getItem(WEEKLY_OPPORTUNITY_NUDGE_SEEN_KEY));
  } catch {
    return false;
  }
};

export const markWeeklyOpportunityNudgeSeen = (
  _periodKey,
  storage = window.localStorage
) => {
  try {
    storage.setItem(WEEKLY_OPPORTUNITY_NUDGE_SEEN_KEY, "seen");
  } catch {
    // The nudge is optional; restricted storage must not break the page.
  }
};
