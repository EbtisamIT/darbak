const assert = require("assert");
const {
  PLUS_ENTITLEMENT,
  PLUS_PLAN_KEY,
  RESUME_ENTITLEMENT,
  RESUME_PLAN_KEY,
  calculateAccessWindow,
  getNationalDayOffer,
  getPlanEntitlements,
  getPublicSubscriptionPlans,
  getSubscriptionCheckoutPricing,
  getSubscriptionPlan,
  hasPlanEntitlement,
  isResumePlanLaunchEnabled,
  normalizePlanKey,
} = require("../subscriptionPlans");

const env = {
  RESUME_PLAN_LAUNCH_ENABLED: "false",
  SUBSCRIPTION_PRICE_SAR: "5.99",
  SUBSCRIPTION_DURATION_DAYS: "30",
  RESUME_SUBSCRIPTION_PRICE_SAR: "34.99",
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
assert.strictEqual(resumePlan.priceSar, 34.99);
assert.strictEqual(resumePlan.aiResumeUsageLimit, 10);
assert.strictEqual(resumePlan.label, "دربك+ سيرة");
assert.ok(resumePlan.entitlements.includes(PLUS_ENTITLEMENT));
assert.ok(resumePlan.entitlements.includes(RESUME_ENTITLEMENT));

const defaultResumePlan = getSubscriptionPlan(RESUME_PLAN_KEY, {});
assert.strictEqual(defaultResumePlan.priceSar, 34.99);
assert.strictEqual(defaultResumePlan.aiResumeUsageLimit, 10);

assert.ok(hasPlanEntitlement(RESUME_PLAN_KEY, PLUS_ENTITLEMENT, env));
assert.ok(hasPlanEntitlement(RESUME_PLAN_KEY, RESUME_ENTITLEMENT, env));
assert.ok(!hasPlanEntitlement(PLUS_PLAN_KEY, RESUME_ENTITLEMENT, env));
assert.ok(hasPlanEntitlement("one_time_90", PLUS_ENTITLEMENT, env));
assert.ok(!hasPlanEntitlement("one_time_90", RESUME_ENTITLEMENT, env));
for (const planId of [PLUS_PLAN_KEY, "one_time_90", RESUME_PLAN_KEY]) {
  assert.ok(
    hasPlanEntitlement(planId, PLUS_ENTITLEMENT, env),
    `${planId} must retain Darbak core access`
  );
}
assert.deepStrictEqual(getPlanEntitlements("unknown", env), [PLUS_ENTITLEMENT]);
assert.strictEqual(isResumePlanLaunchEnabled(env), false);
assert.deepStrictEqual(
  getPublicSubscriptionPlans(env).map((plan) => plan.id),
  [PLUS_PLAN_KEY, "one_time_90"]
);

const nationalDayStart = new Date("2026-09-22T16:00:00.000Z");
const nationalDayEnd = new Date("2026-09-23T18:00:00.000Z");
const nationalDayActive = getNationalDayOffer(
  new Date("2026-09-22T16:00:01.000Z")
);
assert.strictEqual(nationalDayActive.id, "national-day-90d-960");
assert.strictEqual(nationalDayActive.isActive, true);
assert.strictEqual(nationalDayActive.startsAt, nationalDayStart.toISOString());
assert.strictEqual(nationalDayActive.endsAt, nationalDayEnd.toISOString());
assert.strictEqual(
  getNationalDayOffer(nationalDayEnd).isActive,
  false,
  "the offer must end exactly at the configured end timestamp"
);

const ninetyDayPlan = getSubscriptionPlan("one_time_90", env);
const activeCampaignPricing = getSubscriptionCheckoutPricing({
  plan: ninetyDayPlan,
  now: new Date("2026-09-22T17:00:00.000Z"),
});
assert.strictEqual(activeCampaignPricing.priceSar, 9.6);
assert.strictEqual(activeCampaignPricing.originalPriceSar, 15);
assert.strictEqual(activeCampaignPricing.campaign.id, "national-day-90d-960");
assert.strictEqual(ninetyDayPlan.durationDays, 90, "offer cannot change entitlement duration");

const expiredCampaignPricing = getSubscriptionCheckoutPricing({
  plan: ninetyDayPlan,
  now: nationalDayEnd,
});
assert.strictEqual(expiredCampaignPricing.priceSar, 15);
assert.strictEqual(expiredCampaignPricing.campaign, null);

const activePublicNinetyDayPlan = getPublicSubscriptionPlans(
  env,
  new Date("2026-09-22T17:00:00.000Z")
).find((plan) => plan.id === "one_time_90");
assert.strictEqual(activePublicNinetyDayPlan.priceSar, 9.6);
assert.strictEqual(activePublicNinetyDayPlan.normalPriceSar, 15);
assert.strictEqual(activePublicNinetyDayPlan.durationDays, 90);
assert.deepStrictEqual(
  getPublicSubscriptionPlans({
    ...env,
    RESUME_PLAN_LAUNCH_ENABLED: "true",
  }).map((plan) => plan.id),
  [PLUS_PLAN_KEY, "one_time_90", RESUME_PLAN_KEY]
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
