export const WEEKLY_OPPORTUNITY_NUDGE_SEEN_KEY =
  "darbak_weekly_opportunity_nudge_seen_v1";
const WEEKLY_OPPORTUNITY_NUDGE_PERIOD_PREFIX =
  "darbak_weekly_opportunity_nudge_seen_v2";

const getWeeklyOpportunityNudgePeriodKey = (periodKey = "") =>
  `${WEEKLY_OPPORTUNITY_NUDGE_PERIOD_PREFIX}:${String(periodKey || "").trim()}`;

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
) => {
  try {
    return Boolean(storage.getItem(getWeeklyOpportunityNudgePeriodKey(periodKey)));
  } catch {
    return false;
  }
};

export const markWeeklyOpportunityNudgeSeen = (
  periodKey,
  storage = window.localStorage
) => {
  try {
    storage.setItem(getWeeklyOpportunityNudgePeriodKey(periodKey), "seen");
  } catch {
    // The nudge is optional; restricted storage must not break the page.
  }
};

// The old implementation kept a single forever key. Preserve the current
// week's dismissal once during the transition, then allow future weekly batches.
export const migrateLegacyWeeklyOpportunityNudgeSeen = (
  periodKey,
  storage = window.localStorage
) => {
  try {
    const currentKey = getWeeklyOpportunityNudgePeriodKey(periodKey);
    if (periodKey && storage.getItem(WEEKLY_OPPORTUNITY_NUDGE_SEEN_KEY) && !storage.getItem(currentKey)) {
      storage.setItem(currentKey, "seen");
    }
  } catch {
    // The nudge is optional; restricted storage must not break the page.
  }
};
