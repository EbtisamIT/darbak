import { getSubscriptionCapabilities } from "./premiumAccess";

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
