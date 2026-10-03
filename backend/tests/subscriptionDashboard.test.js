const assert = require("assert");
const { getRange, buildCheckoutFunnelSources } = require("../services/subscriptionDashboard");

const sevenDays = getRange("7");
assert.strictEqual(sevenDays.days, 7);
assert.ok(sevenDays.start < sevenDays.todayStart);
assert.ok(sevenDays.end > sevenDays.todayStart);

const fallbackRange = getRange("unknown");
assert.strictEqual(fallbackRange.days, 30);
assert.ok(fallbackRange.monthStart <= fallbackRange.todayStart);

assert.deepStrictEqual(buildCheckoutFunnelSources([
  { _id: { source: "homepage", eventName: "subscription_cta_clicked" }, count: 10 },
  { _id: { source: "homepage", eventName: "subscription_checkout_opened" }, count: 4 },
  { _id: { source: "homepage", eventName: "subscription_completed" }, count: 2 },
]), [{ source: "homepage", clicks: 10, checkoutOpened: 4, paymentStarted: 0, paid: 2 }]);

console.log("subscriptionDashboard tests passed");
