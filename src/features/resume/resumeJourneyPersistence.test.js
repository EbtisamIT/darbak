import {
  canRestoreResumeDraft,
  clearResumeJourneyProgress,
  getDraftJourneyProgress,
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

  it("persists the same reachable Draft step for first builds and updates", () => {
    const progress = writeResumeJourneyProgress(getDraftJourneyProgress("portfolio"), accountA);
    expect(progress).toMatchObject({
      currentStep: "draft",
      completedSteps: ["data", "missing"],
      source: "portfolio",
    });
    expect(canRestoreResumeDraft({ persistedProgress: readResumeJourneyProgress(accountA) })).toBe(true);
  });

  it("restores active and completed Drafts without transient navigation state", () => {
    expect(canRestoreResumeDraft({ activeBuildId: "active-qa-build" })).toBe(true);
    expect(canRestoreResumeDraft({ savedSessionId: "completed-qa-session" })).toBe(true);
    expect(canRestoreResumeDraft({ factsComplete: true })).toBe(true);
    expect(canRestoreResumeDraft()).toBe(false);
  });

  it("does not let stale navigation state demote persisted Draft progress", () => {
    writeResumeJourneyProgress(getDraftJourneyProgress(), accountA);
    expect(canRestoreResumeDraft({
      persistedProgress: readResumeJourneyProgress(accountA),
      navigationProgress: { currentStep: "data", completedSteps: [] },
    })).toBe(true);
  });
});
