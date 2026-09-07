const assert = require("assert");
const { getRange } = require("../services/subscriptionDashboard");

const sevenDays = getRange("7");
assert.strictEqual(sevenDays.days, 7);
assert.ok(sevenDays.start < sevenDays.todayStart);
assert.ok(sevenDays.end > sevenDays.todayStart);

const fallbackRange = getRange("unknown");
assert.strictEqual(fallbackRange.days, 30);
assert.ok(fallbackRange.monthStart <= fallbackRange.todayStart);

console.log("subscriptionDashboard tests passed");
