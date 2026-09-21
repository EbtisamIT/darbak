const assert = require("assert");
const CompanyApplication = require("../models/CompanyApplication");
const CompanyApplicationCampaign = require("../models/CompanyApplicationCampaign");
const {
  buildCampaignApplicationFilter,
  buildStudentApplicationOwnershipFilter,
  shouldRecordReviewLinkOpen,
} = require("../services/companyApplicationWorkflow");

const campaignFilter = buildCampaignApplicationFilter({
  campaignId: "campaign-a",
  applicationIds: ["application-a"],
});
assert.strictEqual(campaignFilter.campaignId, "campaign-a");
assert.deepStrictEqual(campaignFilter._id, { $in: ["application-a"] });
assert.deepStrictEqual(campaignFilter.isDemo, { $ne: true });
assert.notStrictEqual(campaignFilter.campaignId, "campaign-b");

const ownerFilter = buildStudentApplicationOwnershipFilter({
  studentId: "student-a",
  email: "student@example.com",
});
assert.deepStrictEqual(ownerFilter.$or, [
  { studentId: "student-a" },
  { normalizedEmail: "student@example.com" },
  { email: "student@example.com" },
]);
assert.strictEqual(buildStudentApplicationOwnershipFilter({}), null);

const now = new Date("2026-09-21T12:00:00.000Z");
assert.strictEqual(shouldRecordReviewLinkOpen(null, now), true);
assert.strictEqual(shouldRecordReviewLinkOpen("2026-09-21T11:50:00.000Z", now), false);
assert.strictEqual(shouldRecordReviewLinkOpen("2026-09-21T11:40:00.000Z", now), true);

const application = new CompanyApplication({
  campaignId: "campaign-a",
  companySlug: "company-a",
  organizationName: "Company A",
  fullName: "Student A",
  email: "student@example.com",
  normalizedEmail: "student@example.com",
  status: "under_review",
  studentReportedStatus: "accepted",
  studentReportedAt: now,
});
const applicationError = application.validateSync();
assert.strictEqual(applicationError, undefined);
assert.strictEqual(application.status, "under_review");
assert.strictEqual(application.studentReportedStatus, "accepted");

const campaign = new CompanyApplicationCampaign({
  slug: "company-a-program",
  companySlug: "company-a",
  organizationName: "Company A",
  opportunityTitle: "Co-op",
  applicationShareToken: "a".repeat(64),
  reviewLinkOpenCount: 3,
  csvExportCount: 1,
  outcomeStatus: "reviewing",
});
const campaignError = campaign.validateSync();
assert.strictEqual(campaignError, undefined);
assert.strictEqual(campaign.applicationShareToken, "a".repeat(64));
assert.strictEqual(campaign.outcomeStatus, "reviewing");

console.log("company application workflow tests passed");
