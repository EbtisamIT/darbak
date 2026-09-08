import {
  getStoredJourneyPreferences,
  hasJourneyPreferences,
  saveStoredJourneyPreferences,
} from "./studentJourneyPreferences";

describe("student journey preferences", () => {
  beforeEach(() => window.localStorage.clear());

  test("keeps a complete guest journey locally", () => {
    saveStoredJourneyPreferences({ preferredMajor: " تقنية المعلومات ", preferredCity: " الرياض " });

    expect(getStoredJourneyPreferences()).toEqual({
      preferredMajor: "تقنية المعلومات",
      preferredCity: "الرياض",
    });
    expect(hasJourneyPreferences(getStoredJourneyPreferences())).toBe(true);
  });

  test("does not consider partial preferences a saved journey", () => {
    expect(hasJourneyPreferences({ preferredMajor: "تقنية المعلومات" })).toBe(false);
  });
});
