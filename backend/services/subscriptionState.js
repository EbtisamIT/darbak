const toTime = (value) => {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
};

const classifySubscriptionState = (subscriptions = [], now = new Date()) => {
  const nowTime = toTime(now);
  const active = subscriptions
    .filter((item) => item.status === "active" && toTime(item.expiresAt) > nowTime)
    .sort((a, b) => toTime(b.expiresAt) - toTime(a.expiresAt))[0];
  const expired = subscriptions
    .filter((item) => item.status === "expired" ||
      (item.status === "active" && toTime(item.expiresAt) <= nowTime))
    .sort((a, b) => toTime(b.expiresAt) - toTime(a.expiresAt))[0];
  const subscription = active || expired;

  return {
    state: active ? "ACTIVE" : expired ? "EXPIRED" : "FREE",
    planId: subscription
      ? getSubscriptionPlan(subscription.planId || subscription.planKey).id
      : "",
    expiresAt: subscription?.expiresAt || null,
  };
};

module.exports = { classifySubscriptionState };
const { getSubscriptionPlan } = require("../subscriptionPlans");
