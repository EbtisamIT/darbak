const FEATURE_DEFINITIONS = Object.freeze([
  {
    key: "premiumExperiences",
    label: "التجارب",
    entitlement: "darbak_plus",
    eventNames: ["premium_experience_viewed"],
  },
  {
    key: "premiumOpportunities",
    label: "الفرص",
    entitlement: "darbak_plus",
    eventNames: ["premium_opportunity_viewed"],
  },
  {
    key: "whereToTrain",
    label: "وين أتدرب",
    entitlement: "darbak_plus",
    eventNames: ["where_to_train_search"],
  },
  {
    key: "resumeCreated",
    label: "السيرة الذاتية",
    entitlement: "resume_builder",
    eventNames: [
      "resume_agent_draft_approved",
      "resume_agent_draft_approved_frontend",
      "resume_ai_draft_approved",
      "resume_saved",
    ],
  },
  {
    key: "resumeTailored",
    label: "تخصيص السيرة",
    entitlement: "resume_builder",
    eventNames: ["resume_ai_tailored", "resume_agent_tailor_started"],
  },
  {
    key: "portfolioCreated",
    label: "Portfolio",
    entitlement: "darbak_plus",
    eventNames: ["portfolio_saved", "portfolio_saved_from_page"],
  },
  {
    key: "applicationSubmitted",
    label: "التقديم عبر دربك",
    entitlement: "darbak_plus",
    eventNames: ["company_application_submitted", "opportunity_apply_clicked"],
  },
  {
    key: "applicationTools",
    label: "أدوات التقديم",
    entitlement: "resume_builder",
    eventNames: ["application_pack_completed", "email_copied"],
  },
]);

const getSubscriptionEntitlementsForUsage = (subscription = {}) => {
  const explicit = Array.isArray(subscription.entitlements)
    ? subscription.entitlements.filter(Boolean)
    : [];
  if (explicit.length) return new Set(explicit);

  const plan = String(subscription.planKey || subscription.planId || "");
  return new Set(
    plan.includes("resume")
      ? ["darbak_plus", "resume_builder"]
      : ["darbak_plus"]
  );
};

const getSubscriptionUsageFeatures = (subscription = {}) => {
  const entitlements = getSubscriptionEntitlementsForUsage(subscription);
  return FEATURE_DEFINITIONS.filter((feature) =>
    entitlements.has(feature.entitlement)
  );
};

const getSubscriptionUsageEventNames = (subscription = {}) =>
  Array.from(
    new Set(
      getSubscriptionUsageFeatures(subscription).flatMap(
        (feature) => feature.eventNames
      )
    )
  );

const buildSubscriptionUsageSummary = ({
  subscription = {},
  eventCounts = {},
  eventLastUsedAt = {},
  hasResume = false,
  tailoredResumeCount = 0,
  hasPortfolio = false,
  hasApplication = false,
} = {}) => {
  const features = getSubscriptionUsageFeatures(subscription).map((feature) => {
    const trackedCount = feature.eventNames.reduce(
      (total, eventName) => total + Number(eventCounts[eventName] || 0),
      0
    );
    const storedCount =
      feature.key === "resumeCreated" && hasResume
        ? 1
        : feature.key === "resumeTailored"
        ? Number(tailoredResumeCount || 0)
        : feature.key === "portfolioCreated" && hasPortfolio
        ? 1
        : feature.key === "applicationSubmitted" && hasApplication
        ? 1
        : 0;
    const count = Math.max(trackedCount, storedCount);
    const lastUsedAt = feature.eventNames
      .map((eventName) => eventLastUsedAt[eventName])
      .filter(Boolean)
      .sort((first, second) => new Date(second) - new Date(first))[0] || null;

    return {
      key: feature.key,
      label: feature.label,
      used: count > 0,
      count,
      lastUsedAt,
    };
  });
  const usedCount = features.filter((feature) => feature.used).length;
  const percentage = features.length
    ? Math.round((usedCount / features.length) * 100)
    : 0;
  const lastUsedAt = features
    .map((feature) => feature.lastUsedAt)
    .filter(Boolean)
    .sort((first, second) => new Date(second) - new Date(first))[0] || null;

  return {
    percentage,
    usedCount,
    totalFeatures: features.length,
    hasUsedAnyFeature: usedCount > 0,
    lastUsedAt,
    features,
  };
};

module.exports = {
  FEATURE_DEFINITIONS,
  buildSubscriptionUsageSummary,
  getSubscriptionUsageEventNames,
  getSubscriptionUsageFeatures,
};
