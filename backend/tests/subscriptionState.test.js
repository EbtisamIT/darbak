const assert = require("node:assert/strict");
const { test } = require("node:test");
const { classifySubscriptionState } = require("../services/subscriptionState");

const now = new Date("2026-10-07T12:00:00Z");

test("no subscription is free", () => {
  assert.deepEqual(classifySubscriptionState([], now), {
    state: "FREE", planId: "", expiresAt: null,
  });
});

test("a current subscription is active even with older expired records", () => {
  const state = classifySubscriptionState([
    { status: "expired", planId: "darbak_plus", expiresAt: "2026-10-01T00:00:00Z" },
    { status: "active", planId: "darbak_resume", expiresAt: "2026-11-01T00:00:00Z" },
  ], now);
  assert.equal(state.state, "ACTIVE");
  assert.equal(state.planId, "darbak_resume");
});

test("an ended subscription is expired, while pending is not history", () => {
  const ended = classifySubscriptionState([
    { status: "active", planId: "darbak_plus", expiresAt: "2026-10-06T00:00:00Z" },
    { status: "pending", planId: "darbak_resume", expiresAt: "2026-11-01T00:00:00Z" },
  ], now);
  assert.equal(ended.state, "EXPIRED");
  assert.equal(ended.planId, "darbak_plus");
  assert.equal(classifySubscriptionState([{ status: "pending", expiresAt: "2026-11-01T00:00:00Z" }], now).state, "FREE");
});

test("legacy monthly history resolves to the existing canonical plan", () => {
  const state = classifySubscriptionState([
    { status: "expired", planId: "monthly", planKey: "darbak_plus", expiresAt: "2026-10-01T00:00:00Z" },
  ], now);
  assert.equal(state.planId, "darbak_plus");
});
