import { RESUME_FEATURE_FLAGS } from "./resumeFeatureFlags";

describe("resume production feature policy", () => {
  test("keeps manual summary improvement disabled until global safety is proven", () => {
    expect(RESUME_FEATURE_FLAGS.improveSummary).toBe(false);
  });
});
