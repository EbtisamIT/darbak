import { hasCoreAccess, hasResumeAccess } from "./premiumAccess";

test("one_time_90 keeps core access without resume access", () => {
  const activePass = {
    planId: "one_time_90",
    entitlements: ["darbak_plus"],
  };

  expect(hasCoreAccess(activePass)).toBe(true);
  expect(hasResumeAccess(activePass)).toBe(false);
});

test("resume plan retains core and resume access", () => {
  const activePass = {
    planId: "darbak_resume",
    entitlements: ["darbak_plus", "resume_builder"],
  };

  expect(hasCoreAccess(activePass)).toBe(true);
  expect(hasResumeAccess(activePass)).toBe(true);
});
