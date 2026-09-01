import {
  clearResumeJourneyProgress,
  getReachableJourneyProgress,
  readResumeJourneyProgress,
  writeResumeJourneyProgress,
} from "./resumeJourneyPersistence";

describe("resume journey persistence", () => {
  const accountA = "account-a";
  const accountB = "account-b";

  beforeEach(() => {
    clearResumeJourneyProgress(accountA);
    clearResumeJourneyProgress(accountB);
  });

  it("restores the latest reachable step and completed steps after refresh", () => {
    writeResumeJourneyProgress({
      currentStep: "missing",
      completedSteps: ["data"],
      source: "portfolio",
    }, accountA);

    expect(readResumeJourneyProgress(accountA)).toMatchObject({
      currentStep: "missing",
      completedSteps: ["data"],
      source: "portfolio",
    });
  });

  it("does not persist the current or future steps as completed", () => {
    const progress = writeResumeJourneyProgress({
      currentStep: "missing",
      completedSteps: ["data", "missing", "ready"],
    }, accountA);

    expect(progress.completedSteps).toEqual(["data"]);
  });

  it("never restores a journey from another account scope", () => {
    writeResumeJourneyProgress({
      currentStep: "missing",
      completedSteps: ["data"],
      source: "portfolio",
    }, accountA);

    expect(readResumeJourneyProgress(accountB)).toBeNull();
  });

  it("keeps an explicitly completed step reachable when browser storage is unavailable", () => {
    expect(getReachableJourneyProgress(null, {
      currentStep: "missing",
      completedSteps: ["data"],
      source: "portfolio",
    })).toMatchObject({
      currentStep: "missing",
      completedSteps: ["data"],
    });
  });

  it("does not make a future draft step reachable without its completed steps", () => {
    expect(getReachableJourneyProgress(null, {
      currentStep: "draft",
      completedSteps: [],
      source: "portfolio",
    })).toBeNull();
  });
});
