import {
  WEEKLY_OPPORTUNITY_NUDGE_SEEN_KEY,
  hasBlockingAttentionLayer,
  markWeeklyOpportunityNudgeSeen,
  migrateLegacyWeeklyOpportunityNudgeSeen,
  normalizeWeeklyOpportunityHighlight,
  wasWeeklyOpportunityNudgeSeen,
} from "./weeklyOpportunityNudge";

describe("weekly opportunity nudge", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.body.innerHTML = "";
  });

  test("normalizes real opportunity count and unique organization names", () => {
    expect(
      normalizeWeeklyOpportunityHighlight({
        count: 7,
        organizationNames: ["جهة أ", "جهة أ", "جهة ب", "", "جهة ج"],
        periodKey: "2026-09-07",
      })
    ).toEqual({
      count: 7,
      organizationNames: ["جهة أ", "جهة ب", "جهة ج"],
      periodKey: "2026-09-07",
    });
  });

  test("shows once per weekly batch, without suppressing future batches", () => {
    expect(wasWeeklyOpportunityNudgeSeen("2026-09-07")).toBe(false);
    markWeeklyOpportunityNudgeSeen("2026-09-07");
    expect(wasWeeklyOpportunityNudgeSeen("2026-09-07")).toBe(true);
    expect(wasWeeklyOpportunityNudgeSeen("2026-09-14")).toBe(false);
  });

  test("keeps the current legacy dismissal once, then allows the next batch", () => {
    window.localStorage.setItem(WEEKLY_OPPORTUNITY_NUDGE_SEEN_KEY, "seen");
    migrateLegacyWeeklyOpportunityNudgeSeen("2026-09-07");
    expect(wasWeeklyOpportunityNudgeSeen("2026-09-07")).toBe(true);
    expect(wasWeeklyOpportunityNudgeSeen("2026-09-14")).toBe(false);
  });

  test("detects subscription and daily-limit attention layers", () => {
    const reminder = document.createElement("div");
    reminder.className = "subscription-reminder-bar";
    document.body.appendChild(reminder);
    expect(hasBlockingAttentionLayer(document)).toBe(true);

    reminder.remove();
    expect(hasBlockingAttentionLayer(document)).toBe(false);
  });
});
