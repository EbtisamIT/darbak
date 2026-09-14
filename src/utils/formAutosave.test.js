import {
  isCurrentAutosaveResponse,
  shouldHydrateFormSaveResponse,
} from "./formAutosave";

describe("form autosave response reconciliation", () => {
  it("rejects responses older than the latest local text", () => {
    expect(isCurrentAutosaveResponse({
      requestId: 2,
      latestRequestId: 2,
      submittedSnapshot: "old text",
      latestSnapshot: "new text",
    })).toBe(false);
  });

  it("accepts metadata for the current persisted snapshot", () => {
    expect(isCurrentAutosaveResponse({
      requestId: 2,
      latestRequestId: 2,
      submittedSnapshot: "current text",
      latestSnapshot: "current text",
    })).toBe(true);
  });

  it("never hydrates live form text from an autosave response", () => {
    expect(shouldHydrateFormSaveResponse({ manual: false, hasNewerChanges: false })).toBe(false);
    expect(shouldHydrateFormSaveResponse({ manual: false, hasNewerChanges: true })).toBe(false);
  });

  it("hydrates a manual save only when the form did not change during the request", () => {
    expect(shouldHydrateFormSaveResponse({ manual: true, hasNewerChanges: false })).toBe(true);
    expect(shouldHydrateFormSaveResponse({ manual: true, hasNewerChanges: true })).toBe(false);
  });
});
