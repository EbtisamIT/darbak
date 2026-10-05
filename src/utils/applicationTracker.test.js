import { needsFollowUpReminder, monthlySummary, followUpMessage } from "./applicationTracker";

const now = Date.parse("2026-10-06T12:00:00Z");
const appliedAt = new Date(now - 4 * 86400000).toISOString();
const item = { recordType: "tracker", sourceType: "manual", studentStatus: "waiting", contactEmail: "jobs@example.com",
  organizationName: "شركة لين", opportunityTitle: "تدريب تعاوني", appliedAt, lastUpdatedAt: appliedAt };

test("follow-up starts at exactly four days and needs real contact data", () => {
  expect(needsFollowUpReminder(item, now)).toBe(true);
  expect(needsFollowUpReminder(item, now - 1)).toBe(false);
  expect(needsFollowUpReminder({ ...item, contactEmail: "" }, now)).toBe(false);
  expect(needsFollowUpReminder({ ...item, lastUpdatedAt: new Date(now - 86400000).toISOString() }, now)).toBe(false);
  expect(needsFollowUpReminder({ ...item, recordType: "darbak" }, now)).toBe(false);
});
test.each(["interview", "accepted", "rejected", "withdrawn"])("no reminder for %s", (studentStatus) => {
  expect(needsFollowUpReminder({ ...item, studentStatus }, now)).toBe(false);
});
test("three-day snooze and seven-day sent suppression", () => {
  expect(needsFollowUpReminder({ ...item, followUpSnoozedUntil: new Date(now + 3 * 86400000).toISOString() }, now)).toBe(false);
  expect(needsFollowUpReminder({ ...item, followUpSentAt: new Date(now - 7 * 86400000 + 1).toISOString() }, now)).toBe(false);
  expect(needsFollowUpReminder({ ...item, followUpSentAt: new Date(now - 7 * 86400000).toISOString() }, now)).toBe(true);
  expect(needsFollowUpReminder({ ...item, followUpDismissedAt: new Date(now).toISOString() }, now)).toBe(false);
});
test("message fills company, opportunity and date without fabricated student details", () => {
  const ar = followUpMessage(item);
  const en = followUpMessage(item, "en");
  expect(ar.subject).toContain("تدريب تعاوني");
  expect(ar.body).toContain("شركة لين");
  expect(ar.body).toContain("أكتوبر");
  expect(en.body).toContain("October");
  expect(en.body).toContain("[Student Name]");
});
test("monthly summary counts only actual current-month applications", () => {
  expect(monthlySummary([item, { ...item, studentStatus: "interview" }, { ...item, appliedAt: "2026-09-01T00:00:00Z" }], now))
    .toEqual({ waiting: 0, action: 1, interview: 1, accepted: 0 });
});
