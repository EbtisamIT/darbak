const MS_PER_DAY = 24 * 60 * 60 * 1000;

const PLUS_PLAN_KEY = "darbak_plus";
const RESUME_PLAN_KEY = "darbak_resume";
const PLUS_ENTITLEMENT = "darbak_plus";
const RESUME_ENTITLEMENT = "resume_builder";

const toPositiveNumber = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

const toBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  return ["true", "1", "yes", "on"].includes(
    value.toString().trim().toLowerCase()
  );
};

const isResumePlanLaunchEnabled = (env = process.env) =>
  toBoolean(env.RESUME_PLAN_LAUNCH_ENABLED, true);

const normalizePlanKey = (value = "") => {
  const plan = value.toString().trim().toLowerCase();

  if (
    [
      RESUME_PLAN_KEY,
      "resume",
      "resume_builder",
      "darbak_plus_resume",
      "darbak_resume_monthly",
    ].includes(plan)
  ) {
    return RESUME_PLAN_KEY;
  }

  return PLUS_PLAN_KEY;
};

const buildSubscriptionPlans = (env = process.env) => {
  const plusPrice = toPositiveNumber(env.SUBSCRIPTION_PRICE_SAR, 5.99);
  const plusDuration = toPositiveNumber(env.SUBSCRIPTION_DURATION_DAYS, 30);
  const resumePrice = toPositiveNumber(env.RESUME_SUBSCRIPTION_PRICE_SAR, 24.99);
  const resumeDuration = toPositiveNumber(env.RESUME_SUBSCRIPTION_DURATION_DAYS, 30);
  const resumeUsageLimit = toPositiveNumber(env.RESUME_AI_USAGE_LIMIT, 10);
  const oneTimePrice = toPositiveNumber(
    env.ONE_TIME_SUBSCRIPTION_PRICE_SAR || env.ONE_TIME_PRICE_SAR,
    15
  );
  const oneTimeDuration = toPositiveNumber(
    env.ONE_TIME_SUBSCRIPTION_DURATION_DAYS || env.ONE_TIME_DURATION_DAYS,
    90
  );

  return {
    [PLUS_PLAN_KEY]: {
      id: PLUS_PLAN_KEY,
      planKey: PLUS_PLAN_KEY,
      label: "دربك+",
      priceSar: plusPrice,
      durationDays: plusDuration,
      entitlements: [PLUS_ENTITLEMENT],
      aiResumeUsageLimit: 0,
    },
    [RESUME_PLAN_KEY]: {
      id: RESUME_PLAN_KEY,
      planKey: RESUME_PLAN_KEY,
      label: "دربك+ سيرة",
      priceSar: resumePrice,
      durationDays: resumeDuration,
      entitlements: [PLUS_ENTITLEMENT, RESUME_ENTITLEMENT],
      aiResumeUsageLimit: resumeUsageLimit,
      badge: "⭐ الأفضل لفترة التقديم",
    },
    monthly: {
      id: PLUS_PLAN_KEY,
      planKey: PLUS_PLAN_KEY,
      legacyId: "monthly",
      label: "دربك+",
      priceSar: plusPrice,
      durationDays: plusDuration,
      entitlements: [PLUS_ENTITLEMENT],
      aiResumeUsageLimit: 0,
    },
    one_time_90: {
      id: "one_time_90",
      planKey: PLUS_PLAN_KEY,
      label: "دربك+ 3 أشهر",
      priceSar: oneTimePrice,
      durationDays: oneTimeDuration,
      entitlements: [PLUS_ENTITLEMENT],
      aiResumeUsageLimit: 0,
    },
  };
};

const getSubscriptionPlan = (planId = "", env = process.env) => {
  const plans = buildSubscriptionPlans(env);
  const raw = planId.toString().trim();
  return plans[raw] || plans[normalizePlanKey(raw)] || plans[PLUS_PLAN_KEY];
};

const getPlanEntitlements = (planId = "", env = process.env) => {
  const plan = getSubscriptionPlan(planId, env);
  return Array.from(new Set(plan.entitlements || [PLUS_ENTITLEMENT]));
};

const hasPlanEntitlement = (planId = "", entitlement = "", env = process.env) =>
  getPlanEntitlements(planId, env).includes(entitlement);

const getPlanAiResumeUsageLimit = (planId = "", env = process.env) => {
  const plan = getSubscriptionPlan(planId, env);
  return Number(plan.aiResumeUsageLimit || 0);
};

const serializeSubscriptionPlan = (plan = {}) => ({
  id: plan.id,
  planKey: plan.planKey,
  label: plan.label,
  priceSar: plan.priceSar,
  durationDays: plan.durationDays,
  entitlements: Array.isArray(plan.entitlements) ? plan.entitlements : [],
  aiResumeUsageLimit: Number(plan.aiResumeUsageLimit || 0),
  badge: plan.badge || "",
});

const getPublicSubscriptionPlans = (env = process.env) => {
  const plans = buildSubscriptionPlans(env);
  const resumeLaunchEnabled = isResumePlanLaunchEnabled(env);
  const publicPlans = [plans[PLUS_PLAN_KEY], plans.one_time_90];

  if (resumeLaunchEnabled) {
    publicPlans.push(plans[RESUME_PLAN_KEY]);
  }

  return publicPlans.map(serializeSubscriptionPlan);
};

const calculateAccessWindow = ({
  currentExpiresAt,
  durationDays = 30,
  now = new Date(),
  extendFromCurrent = true,
} = {}) => {
  const currentExpiry = currentExpiresAt ? new Date(currentExpiresAt) : null;
  const hasCurrentAccess =
    extendFromCurrent &&
    currentExpiry &&
    !Number.isNaN(currentExpiry.getTime()) &&
    currentExpiry > now;
  const base = hasCurrentAccess ? currentExpiry : now;
  const expiresAt = new Date(base.getTime() + Number(durationDays || 30) * MS_PER_DAY);

  return {
    startsAt: now,
    expiresAt,
  };
};

module.exports = {
  PLUS_ENTITLEMENT,
  PLUS_PLAN_KEY,
  RESUME_ENTITLEMENT,
  RESUME_PLAN_KEY,
  buildSubscriptionPlans,
  calculateAccessWindow,
  getPlanAiResumeUsageLimit,
  getPlanEntitlements,
  getPublicSubscriptionPlans,
  getSubscriptionPlan,
  hasPlanEntitlement,
  isResumePlanLaunchEnabled,
  normalizePlanKey,
  serializeSubscriptionPlan,
};
