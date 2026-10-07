import {
  getSubscriptionCapabilities,
  hasSubscriptionFeatureAccess,
  getSafeSubscriptionReturnTo,
  getSubscriptionFlowPath,
  fetchSubscriptionState,
} from "./premiumAccess";

test.each([
  ["darbak_plus", { hasCoreAccess: true, hasResumeAccess: false }],
  ["one_time_90", { hasCoreAccess: true, hasResumeAccess: false }],
  ["darbak_resume", { hasCoreAccess: true, hasResumeAccess: true }],
])("%s exposes the expected capabilities", (planId, expected) => {
  expect(getSubscriptionCapabilities({ planId, entitlements: [] })).toEqual(expected);
});

test("one subscription entry preserves the selected plan and only internal return paths", () => {
  expect(getSubscriptionFlowPath({ planId: "one_time_90", source: "homepage", returnTo: "/opportunities/123" }))
    .toBe("/subscribe?plan=one_time_90&step=checkout&source=homepage&returnTo=%2Fopportunities%2F123");
  expect(getSafeSubscriptionReturnTo("//evil.example/pay")).toBe("");
  expect(getSafeSubscriptionReturnTo("https://evil.example/pay")).toBe("");
});

test("no subscription has no protected capabilities", () => {
  expect(getSubscriptionCapabilities(null)).toEqual({
    hasCoreAccess: false,
    hasResumeAccess: false,
  });
});

test("an expired pass never grants paid access", () => {
  expect(getSubscriptionCapabilities({
    planId: "darbak_resume",
    entitlements: ["darbak_plus", "resume_builder"],
    expiresAt: "2020-01-01T00:00:00Z",
  })).toEqual({ hasCoreAccess: false, hasResumeAccess: false });
});

test("an authenticated account reads its current subscription state without creating a session", async () => {
  const originalFetch = global.fetch;
  window.localStorage.setItem("darbak_access_identity_v1", JSON.stringify({
    contact: "qa@example.com", accessCode: "Qa1234",
  }));
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ state: "EXPIRED", planId: "darbak_plus" }),
  });
  try {
    expect(await fetchSubscriptionState()).toMatchObject({ state: "EXPIRED", planId: "darbak_plus" });
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/api/subscriptions/state"), {
      headers: expect.objectContaining({ "x-darbak-contact": "qa@example.com" }),
    });
  } finally {
    global.fetch = originalFetch;
    window.localStorage.clear();
  }
});

test.each([
  ["one_time_90", true],
  ["darbak_plus", true],
  ["darbak_resume", true],
  ["", false],
])("%s can access the core Apply CTA: %s", (planId, expected) => {
  expect(
    hasSubscriptionFeatureAccess(
      { feature: "opportunity_apply", defaultPlanId: "darbak_plus" },
      planId ? { planId } : null
    )
  ).toBe(expected);
});

test("one_time_90 is directed to Resume upgrade for Smart Application", () => {
  expect(
    hasSubscriptionFeatureAccess(
      { feature: "resume_application_pack", defaultPlanId: "darbak_resume" },
      { planId: "one_time_90" }
    )
  ).toBe(false);
});
