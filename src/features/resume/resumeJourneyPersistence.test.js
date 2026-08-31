import {
  clearResumeJourneyProgress,
  readResumeJourneyProgress,
  writeResumeJourneyProgress,
} from "./resumeJourneyPersistence";

describe("resume journey persistence", () => {
  beforeEach(() => {
    clearResumeJourneyProgress();
  });

  it("restores the latest reachable step and completed steps after refresh", () => {
    writeResumeJourneyProgress({
      currentStep: "missing",
      completedSteps: ["data"],
      source: "portfolio",
    });

    expect(readResumeJourneyProgress()).toMatchObject({
      currentStep: "missing",
      completedSteps: ["data"],
      source: "portfolio",
    });
  });

  it("does not persist the current or future steps as completed", () => {
    const progress = writeResumeJourneyProgress({
      currentStep: "missing",
      completedSteps: ["data", "missing", "ready"],
    });

    expect(progress.completedSteps).toEqual(["data"]);
  });
});
