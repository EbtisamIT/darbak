import { shouldShowResumeOnboarding } from "./resumeOnboarding";

describe("resume onboarding entry", () => {
  it("stays visible for an incomplete Portfolio even after hydration", () => {
    expect(shouldShowResumeOnboarding({ isSetupComplete: false })).toBe(true);
  });

  it("stays visible for a complete Portfolio until the explicit CTA persists completion", () => {
    expect(shouldShowResumeOnboarding({})).toBe(true);
    expect(shouldShowResumeOnboarding({ isSetupComplete: false })).toBe(true);
  });

  it("does not return after explicit onboarding completion", () => {
    expect(shouldShowResumeOnboarding({ isSetupComplete: true })).toBe(false);
  });
});
