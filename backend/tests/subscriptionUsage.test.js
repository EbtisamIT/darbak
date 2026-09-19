const assert = require("assert");
const {
  buildSubscriptionUsageSummary,
  getSubscriptionUsageFeatures,
} = require("../services/subscriptionUsage");
const Subscription = require("../models/Subscription");

const plusSubscription = {
  planKey: "darbak_plus",
  entitlements: ["darbak_plus"],
};
const resumeSubscription = {
  planKey: "darbak_resume",
  entitlements: ["darbak_plus", "resume_builder"],
};

assert.deepStrictEqual(
  getSubscriptionUsageFeatures(plusSubscription).map((feature) => feature.key),
  [
    "premiumExperiences",
    "premiumOpportunities",
    "whereToTrain",
    "portfolioCreated",
    "applicationSubmitted",
  ]
);

const plusUsage = buildSubscriptionUsageSummary({
  subscription: plusSubscription,
  eventCounts: {
    premium_experience_viewed: 4,
    where_to_train_search: 2,
  },
  hasApplication: true,
});
assert.strictEqual(plusUsage.percentage, 60);
assert.strictEqual(plusUsage.usedCount, 3);
assert.strictEqual(plusUsage.totalFeatures, 5);

const resumeUsage = buildSubscriptionUsageSummary({
  subscription: resumeSubscription,
  hasResume: true,
  tailoredResumeCount: 3,
  hasPortfolio: true,
});
assert.strictEqual(resumeUsage.features.find((item) => item.key === "resumeCreated").used, true);
assert.strictEqual(resumeUsage.features.find((item) => item.key === "resumeTailored").count, 3);
assert.strictEqual(resumeUsage.percentage, 38);

const unused = buildSubscriptionUsageSummary({ subscription: plusSubscription });
assert.strictEqual(unused.percentage, 0);
assert.strictEqual(unused.hasUsedAnyFeature, false);

const manageableSubscription = new Subscription({
  email: "student@example.com",
  accessCodeHash: "hash",
  expiresAt: new Date("2026-10-01T00:00:00.000Z"),
  status: "suspended",
  sourceType: "compensation",
  termsAcceptedAt: new Date("2026-09-01T00:00:00.000Z"),
  termsVersion: "2026-09",
  privacyPolicyAcceptedAt: new Date("2026-09-01T00:00:00.000Z"),
  privacyPolicyVersion: "2026-09",
  refundPolicyAcceptedAt: new Date("2026-09-01T00:00:00.000Z"),
  refundPolicyVersion: "2026-09",
  refund: { status: "requested", reason: "طلب المستخدم" },
});
assert.strictEqual(manageableSubscription.validateSync(), undefined);

console.log("subscription usage tests passed");
