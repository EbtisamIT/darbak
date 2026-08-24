const assert = require("assert");
const {
  PLUS_ENTITLEMENT,
  PLUS_PLAN_KEY,
  RESUME_ENTITLEMENT,
  RESUME_PLAN_KEY,
  calculateAccessWindow,
  getPlanEntitlements,
  getPublicSubscriptionPlans,
  getSubscriptionPlan,
  hasPlanEntitlement,
  isResumePlanLaunchEnabled,
  normalizePlanKey,
} = require("../subscriptionPlans");

const env = {
  SUBSCRIPTION_PRICE_SAR: "5.99",
  SUBSCRIPTION_DURATION_DAYS: "30",
  RESUME_SUBSCRIPTION_PRICE_SAR: "24.99",
  RESUME_SUBSCRIPTION_DURATION_DAYS: "30",
  RESUME_AI_USAGE_LIMIT: "10",
};

assert.strictEqual(normalizePlanKey("monthly"), PLUS_PLAN_KEY);
assert.strictEqual(normalizePlanKey("one_time_90"), PLUS_PLAN_KEY);
assert.strictEqual(normalizePlanKey("resume"), RESUME_PLAN_KEY);

const plusPlan = getSubscriptionPlan(PLUS_PLAN_KEY, env);
assert.strictEqual(plusPlan.priceSar, 5.99);
assert.deepStrictEqual(plusPlan.entitlements, [PLUS_ENTITLEMENT]);

const resumePlan = getSubscriptionPlan(RESUME_PLAN_KEY, env);
assert.strictEqual(resumePlan.priceSar, 24.99);
assert.strictEqual(resumePlan.aiResumeUsageLimit, 10);
assert.strictEqual(resumePlan.label, "دربك+ سيرة");
assert.ok(resumePlan.entitlements.includes(PLUS_ENTITLEMENT));
assert.ok(resumePlan.entitlements.includes(RESUME_ENTITLEMENT));

const defaultResumePlan = getSubscriptionPlan(RESUME_PLAN_KEY, {});
assert.strictEqual(defaultResumePlan.priceSar, 24.99);
assert.strictEqual(defaultResumePlan.aiResumeUsageLimit, 10);

assert.ok(hasPlanEntitlement(RESUME_PLAN_KEY, PLUS_ENTITLEMENT, env));
assert.ok(hasPlanEntitlement(RESUME_PLAN_KEY, RESUME_ENTITLEMENT, env));
assert.ok(!hasPlanEntitlement(PLUS_PLAN_KEY, RESUME_ENTITLEMENT, env));
assert.deepStrictEqual(getPlanEntitlements("unknown", env), [PLUS_ENTITLEMENT]);
assert.strictEqual(isResumePlanLaunchEnabled(env), false);
assert.deepStrictEqual(
  getPublicSubscriptionPlans(env).map((plan) => plan.id),
  [PLUS_PLAN_KEY]
);
assert.deepStrictEqual(
  getPublicSubscriptionPlans({
    ...env,
    RESUME_PLAN_LAUNCH_ENABLED: "true",
  }).map((plan) => plan.id),
  [PLUS_PLAN_KEY, RESUME_PLAN_KEY]
);

const now = new Date("2026-08-17T00:00:00.000Z");
const activeExpiry = new Date("2026-08-27T00:00:00.000Z");
const upgradeWindow = calculateAccessWindow({
  currentExpiresAt: activeExpiry,
  durationDays: 30,
  now,
  extendFromCurrent: true,
});
assert.strictEqual(upgradeWindow.startsAt.toISOString(), now.toISOString());
assert.strictEqual(
  upgradeWindow.expiresAt.toISOString(),
  "2026-09-26T00:00:00.000Z"
);

const renewalWindow = calculateAccessWindow({
  currentExpiresAt: new Date("2026-08-01T00:00:00.000Z"),
  durationDays: 30,
  now,
  extendFromCurrent: true,
});
assert.strictEqual(renewalWindow.startsAt.toISOString(), now.toISOString());
assert.strictEqual(
  renewalWindow.expiresAt.toISOString(),
  "2026-09-16T00:00:00.000Z"
);

console.log("subscriptionPlans tests passed");
