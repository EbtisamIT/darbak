import {
  getSubscriptionCapabilities,
  hasSubscriptionFeatureAccess,
} from "./premiumAccess";

test.each([
  ["darbak_plus", { hasCoreAccess: true, hasResumeAccess: false }],
  ["one_time_90", { hasCoreAccess: true, hasResumeAccess: false }],
  ["darbak_resume", { hasCoreAccess: true, hasResumeAccess: true }],
])("%s exposes the expected capabilities", (planId, expected) => {
  expect(getSubscriptionCapabilities({ planId, entitlements: [] })).toEqual(expected);
});

test("no subscription has no protected capabilities", () => {
  expect(getSubscriptionCapabilities(null)).toEqual({
    hasCoreAccess: false,
    hasResumeAccess: false,
  });
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
