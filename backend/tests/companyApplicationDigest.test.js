const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Company = require("../models/Company");
const {
  INITIAL_DIGEST_LOOKBACK_MS,
  buildCompanyApplicationDigestEmail,
  getMillisecondsUntilNextRiyadhDigest,
  runCompanyApplicationDigest,
} = require("../services/companyApplicationDigest");

const createFakeRepository = ({ companies = [], campaigns = [], applications = [] } = {}) => {
  const state = {
    companies: companies.map((item) => ({ ...item })),
    campaigns: campaigns.map((item) => ({ ...item })),
    applications: applications.map((item) => ({ ...item })),
    completed: [],
    released: [],
  };

  return {
    state,
    async listDigestCompanies() {
      return state.companies;
    },
    async acquireDigestLease({ companyId, now, leaseUntil }) {
      const company = state.companies.find((item) => item.id === companyId);
      if (!company || company.applicationDigestEnabled === false) return null;
      if (company.applicationDigestLeaseUntil && company.applicationDigestLeaseUntil > now) {
        return null;
      }
      company.applicationDigestLeaseUntil = leaseUntil;
      return { ...company };
    },
    async listCompanyCampaigns(company) {
      return state.campaigns.filter((item) => item.companyId === company.id);
    },
    async getCompanyDigestSummary({ campaigns: companyCampaigns, windowStart, windowEnd }) {
      const campaignIds = new Set(companyCampaigns.map((item) => item._id));
      const all = state.applications.filter(
        (item) => campaignIds.has(item.campaignId) && item.isDemo !== true
      );
      const fresh = all.filter((item) => {
        const createdAt = new Date(item.createdAt);
        return createdAt > windowStart && createdAt <= windowEnd;
      });
      const countRows = (field) => {
        const counts = new Map();
        fresh.forEach((item) => {
          const label = item[field] || "غير محدد";
          counts.set(label, (counts.get(label) || 0) + 1);
        });
        return Array.from(counts, ([label, count]) => ({ label, count }));
      };
      return {
        newApplicationCount: fresh.length,
        campaigns: companyCampaigns
          .map((campaign) => ({
            id: campaign._id,
            title: campaign.opportunityTitle,
            count: fresh.filter((item) => item.campaignId === campaign._id).length,
          }))
          .filter((item) => item.count > 0),
        majors: countRows("major"),
        cities: countRows("city"),
        totalApplicationCount: all.length,
        pendingReviewCount: all.filter((item) => ["submitted", "new"].includes(item.status)).length,
      };
    },
    async completeDigest({ companyId, windowEnd, newApplicationCount }) {
      const company = state.companies.find((item) => item.id === companyId);
      company.lastApplicationDigestSentAt = windowEnd;
      company.applicationDigestLeaseUntil = null;
      state.completed.push({ companyId, windowEnd, newApplicationCount });
    },
    async releaseDigestLease(companyId) {
      const company = state.companies.find((item) => item.id === companyId);
      if (company) company.applicationDigestLeaseUntil = null;
      state.released.push(companyId);
    },
  };
};

const makeCompany = (overrides = {}) => ({
  id: "company-a",
  name: "شركة اختبارية",
  slug: "test-company",
  contactEmail: "digest@example.test",
  portalAccessToken: "a".repeat(64),
  applicationDigestEnabled: true,
  ...overrides,
});

const makeCampaign = (id = "campaign-a", title = "الموارد البشرية") => ({
  _id: id,
  companyId: "company-a",
  opportunityTitle: title,
  applicationNotificationEmail: "",
});

const makeApplication = (overrides = {}) => ({
  campaignId: "campaign-a",
  major: "محاسبة",
  city: "مكة",
  status: "submitted",
  createdAt: "2026-09-22T16:00:00.000Z",
  ...overrides,
});

const runWithFakeMailer = async ({ repository, now = new Date("2026-09-22T17:00:00.000Z"), fail = false }) => {
  const messages = [];
  const result = await runCompanyApplicationDigest({
    repository,
    frontendUrl: "https://darbak.space",
    now,
    logger: { info() {}, error() {} },
    sendEmail: async (message) => {
      messages.push(message);
      return { emailStatus: fail ? "failed" : "sent" };
    },
  });
  return { messages, result };
};

(async () => {
  const companyModel = new Company({ name: "Company", slug: "company" });
  assert.strictEqual(companyModel.applicationDigestEnabled, true);
  assert.strictEqual(companyModel.lastApplicationDigestSentAt, null);
  assert.strictEqual(
    getMillisecondsUntilNextRiyadhDigest(new Date("2026-09-22T16:00:00.000Z")),
    60 * 60 * 1000
  );
  assert.strictEqual(
    getMillisecondsUntilNextRiyadhDigest(new Date("2026-09-22T17:01:00.000Z")),
    (23 * 60 + 59) * 60 * 1000
  );

  const serverSource = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
  assert.doesNotMatch(serverSource, /sendCompanyApplicationReceivedEmail/);
  assert.match(serverSource, /sendCompanyApplicationStatusEmail/);

  const noApplications = createFakeRepository({
    companies: [makeCompany()],
    campaigns: [makeCampaign()],
  });
  const emptyRun = await runWithFakeMailer({ repository: noApplications });
  assert.strictEqual(emptyRun.messages.length, 0);
  assert.strictEqual(emptyRun.result.sent, 0);

  const singleApplication = createFakeRepository({
    companies: [makeCompany()],
    campaigns: [makeCampaign()],
    applications: [makeApplication()],
  });
  const singleRun = await runWithFakeMailer({ repository: singleApplication });
  assert.strictEqual(singleRun.messages.length, 1);
  assert.strictEqual(singleRun.result.sent, 1);
  assert.match(singleRun.messages[0].subject, /محاسبة \| مكة/);
  assert.match(singleRun.messages[0].text, /حسب التخصص:\nمحاسبة: 1/);
  assert.match(singleRun.messages[0].text, /حسب المدينة:\nمكة: 1/);
  assert.match(
    singleRun.messages[0].text,
    /https:\/\/darbak\.space\/company\/test-company\?access=/
  );
  assert.strictEqual(singleApplication.state.completed.length, 1);

  const campaignCounts = [9, 8, 7];
  const campaignRows = [
    makeCampaign("campaign-a", "الموارد البشرية"),
    makeCampaign("campaign-b", "محاسب تكاليف"),
    makeCampaign("campaign-c", "تشغيل الفروع"),
  ];
  const manyApplications = campaignRows.flatMap((campaign, index) =>
    Array.from({ length: campaignCounts[index] }, (_, itemIndex) =>
      makeApplication({
        campaignId: campaign._id,
        major: index === 0 ? "موارد بشرية" : index === 1 ? "محاسبة" : "إدارة أعمال",
        city: itemIndex % 2 ? "جدة" : "مكة",
      })
    )
  );
  const threeCampaigns = createFakeRepository({
    companies: [makeCompany()],
    campaigns: campaignRows,
    applications: manyApplications,
  });
  const threeCampaignRun = await runWithFakeMailer({ repository: threeCampaigns });
  assert.strictEqual(threeCampaignRun.messages.length, 1);
  assert.match(threeCampaignRun.messages[0].subject, /24 طلبًا جديدًا/);
  assert.match(threeCampaignRun.messages[0].text, /الموارد البشرية: 9/);
  assert.match(threeCampaignRun.messages[0].text, /محاسب تكاليف: 8/);
  assert.match(threeCampaignRun.messages[0].text, /تشغيل الفروع: 7/);

  const twentyApplications = createFakeRepository({
    companies: [makeCompany()],
    campaigns: [makeCampaign()],
    applications: Array.from({ length: 20 }, () => makeApplication()),
  });
  const twentyRun = await runWithFakeMailer({ repository: twentyApplications });
  assert.strictEqual(twentyRun.messages.length, 1);

  const missingBreakdown = createFakeRepository({
    companies: [makeCompany()],
    campaigns: [makeCampaign()],
    applications: [makeApplication({ major: "", city: "" })],
  });
  const missingRun = await runWithFakeMailer({ repository: missingBreakdown });
  assert.strictEqual(missingRun.messages.length, 1);
  assert.match(missingRun.messages[0].text, /غير محدد: 1/);

  const failedDelivery = createFakeRepository({
    companies: [makeCompany()],
    campaigns: [makeCampaign()],
    applications: [makeApplication()],
  });
  const failedRun = await runWithFakeMailer({ repository: failedDelivery, fail: true });
  assert.strictEqual(failedRun.result.failed, 1);
  assert.strictEqual(failedDelivery.state.completed.length, 0);
  assert.strictEqual(failedDelivery.state.companies[0].lastApplicationDigestSentAt, undefined);

  const idempotent = createFakeRepository({
    companies: [makeCompany()],
    campaigns: [makeCampaign()],
    applications: [makeApplication()],
  });
  const firstIdempotentRun = await runWithFakeMailer({ repository: idempotent });
  const secondIdempotentRun = await runWithFakeMailer({
    repository: idempotent,
    now: new Date("2026-09-22T17:05:00.000Z"),
  });
  assert.strictEqual(firstIdempotentRun.messages.length, 1);
  assert.strictEqual(secondIdempotentRun.messages.length, 0);

  const cutoffRepository = createFakeRepository({
    companies: [makeCompany()],
    campaigns: [makeCampaign()],
    applications: [
      makeApplication({ createdAt: "2026-09-22T16:59:00.000Z" }),
      makeApplication({ createdAt: "2026-09-22T17:01:00.000Z", major: "مالية" }),
    ],
  });
  const cutoffFirst = await runWithFakeMailer({ repository: cutoffRepository });
  const cutoffSecond = await runWithFakeMailer({
    repository: cutoffRepository,
    now: new Date("2026-09-23T17:00:00.000Z"),
  });
  assert.match(cutoffFirst.messages[0].text, /محاسبة: 1/);
  assert.doesNotMatch(cutoffFirst.messages[0].text, /مالية/);
  assert.match(cutoffSecond.messages[0].text, /مالية: 1/);

  const disabled = createFakeRepository({
    companies: [makeCompany({ applicationDigestEnabled: false })],
    campaigns: [makeCampaign()],
    applications: [makeApplication()],
  });
  const disabledRun = await runWithFakeMailer({ repository: disabled });
  assert.strictEqual(disabledRun.messages.length, 0);

  const email = buildCompanyApplicationDigestEmail({
    companyName: "شركة اختبارية",
    portalUrl: "https://darbak.space/company/test-company?access=secret",
    summary: {
      newApplicationCount: 1,
      campaigns: [{ title: "برنامج", count: 1 }],
      majors: [{ label: "محاسبة", count: 1 }],
      cities: [{ label: "مكة", count: 1 }],
      totalApplicationCount: 4,
      pendingReviewCount: 2,
    },
  });
  ["Student Name", "student@example.com", "0500000000", "linkedin.com/in/student"].forEach(
    (pii) => {
      assert.doesNotMatch(email.text, new RegExp(pii.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.doesNotMatch(email.html, new RegExp(pii.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  );

  const freshCompany = makeCompany();
  const expectedStart = new Date(
    new Date("2026-09-22T17:00:00.000Z").getTime() - INITIAL_DIGEST_LOOKBACK_MS
  );
  const observedRepository = createFakeRepository({
    companies: [freshCompany],
    campaigns: [makeCampaign()],
  });
  let observedStart = null;
  const originalSummary = observedRepository.getCompanyDigestSummary.bind(observedRepository);
  observedRepository.getCompanyDigestSummary = async (args) => {
    observedStart = args.windowStart;
    return originalSummary(args);
  };
  await runWithFakeMailer({ repository: observedRepository });
  assert.strictEqual(observedStart.toISOString(), expectedStart.toISOString());

  console.log("company application digest tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
