const assert = require("node:assert/strict");
const { test } = require("node:test");
const { isCheckoutCanaryEnabled } = require("../services/checkoutCanary");

test("QA mode permits only the exact internal user ID", () => {
  const qaUserId = "6abd577bec30b3276baf2027";
  assert.equal(isCheckoutCanaryEnabled({ mode: "qa", userId: qaUserId, qaUserId }), true);
  assert.equal(isCheckoutCanaryEnabled({ mode: "qa", userId: "other", qaUserId }), false);
  assert.equal(isCheckoutCanaryEnabled({ mode: "qa", userId: "", qaUserId }), false);
});

test("off mode denies everyone and all mode permits rollout", () => {
  assert.equal(isCheckoutCanaryEnabled({ mode: "off", userId: "qa", qaUserId: "qa" }), false);
  assert.equal(isCheckoutCanaryEnabled({ mode: "all" }), true);
});
