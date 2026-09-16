import {
  getTrainingFinderInitialFilters,
  getTrainingFinderPreferenceKey,
} from "./trainingFinderPreferences";

describe("training finder saved preferences", () => {
  const saved = {
    preferredMajor: "تقنية المعلومات",
    preferredCity: "الرياض",
  };

  test("opens opportunities with the saved major and city", () => {
    expect(getTrainingFinderInitialFilters({ preferences: saved })).toEqual({
      specialty: "تقنية المعلومات",
      city: "الرياض",
    });
  });

  test("keeps saved filters when returning from an opportunity", () => {
    expect(getTrainingFinderInitialFilters({ preferences: saved })).toEqual({
      specialty: "تقنية المعلومات",
      city: "الرياض",
    });
  });

  test("keeps saved filters when returning from apply or review", () => {
    expect(getTrainingFinderInitialFilters({ preferences: saved })).toEqual({
      specialty: "تقنية المعلومات",
      city: "الرياض",
    });
  });

  test("keeps saved filters after a refresh", () => {
    expect(getTrainingFinderPreferenceKey({
      major: saved.preferredMajor,
      city: saved.preferredCity,
    })).toBe("تقنية المعلومات::الرياض");
  });

  test("uses server-restored preferences after logout and login", () => {
    expect(getTrainingFinderInitialFilters({
      preferences: {
        preferredMajor: "نظم المعلومات",
        preferredCity: "جدة",
      },
    })).toEqual({ specialty: "نظم المعلومات", city: "جدة" });
  });

  test("explicit route filters take priority over saved preferences", () => {
    expect(getTrainingFinderInitialFilters({
      querySpecialty: "علوم الحاسب",
      queryCity: "الدمام",
      preferences: saved,
    })).toEqual({ specialty: "علوم الحاسب", city: "الدمام" });
  });
});
