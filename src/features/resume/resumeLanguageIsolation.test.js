import { shouldAutosaveMasterResume } from "./resumeLanguageIsolation";

describe("resume language state isolation", () => {
  it("does not autosave the open English payload while the Arabic master is hydrating", () => {
    expect(shouldAutosaveMasterResume({
      hasLoaded: true,
      resumeMode: "editor",
      editingTailoredVersion: false,
      masterHydrating: true,
    })).toBe(false);
  });

  it("allows normal Arabic master autosave after hydration completes", () => {
    expect(shouldAutosaveMasterResume({
      hasLoaded: true,
      resumeMode: "editor",
      editingTailoredVersion: false,
      masterHydrating: false,
    })).toBe(true);
  });

  it("never autosaves a standalone English version through the master endpoint", () => {
    expect(shouldAutosaveMasterResume({
      hasLoaded: true,
      resumeMode: "editor",
      editingTailoredVersion: true,
      masterHydrating: false,
    })).toBe(false);
  });
});
