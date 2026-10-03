import { RESUME_FEATURE_FLAGS, isResumeEnglishUpdateEnabled } from "./resumeFeatureFlags";

describe("resume production feature policy", () => {
  test("keeps manual summary improvement disabled until global safety is proven", () => {
    expect(RESUME_FEATURE_FLAGS.improveSummary).toBe(false);
  });

  test("enables English updates after production QA closure", () => {
    expect(RESUME_FEATURE_FLAGS.englishUpdate).toBe(true);
    expect(isResumeEnglishUpdateEnabled({ contact: "qa-resume-c8627f9d-20260930@example.invalid" })).toBe(true);
    expect(isResumeEnglishUpdateEnabled({ contact: "another@example.invalid" })).toBe(true);
    expect(isResumeEnglishUpdateEnabled()).toBe(true);
  });
});
