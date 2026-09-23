import {
  clearTrainingFinderSessionFilters,
  getTrainingFinderInitialFilters,
  getTrainingFinderSessionFilters,
  saveTrainingFinderSessionFilters,
} from "./trainingFinderPreferences";

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
});

const readFinderFilters = () => getTrainingFinderInitialFilters({
  sessionFilters: getTrainingFinderSessionFilters(),
});

test("select major/city then open an opportunity and return keeps session filters", () => {
  saveTrainingFinderSessionFilters({ specialty: "تقنية المعلومات", city: "الرياض" });

  expect(readFinderFilters()).toEqual({ specialty: "تقنية المعلومات", city: "الرياض" });
});

test("apply and review routes can return to the same session filters", () => {
  saveTrainingFinderSessionFilters({ specialty: "نظم المعلومات", city: "جدة" });

  expect(readFinderFilters()).toEqual({ specialty: "نظم المعلومات", city: "جدة" });
});

test("refresh during the same browser session keeps the selected filters", () => {
  saveTrainingFinderSessionFilters({ specialty: "علوم الحاسب", city: "الخبر" });

  expect(getTrainingFinderSessionFilters()).toEqual({ specialty: "علوم الحاسب", city: "الخبر" });
});

test("explicit route filters take priority over session filters", () => {
  saveTrainingFinderSessionFilters({ specialty: "تقنية المعلومات", city: "الرياض" });

  expect(getTrainingFinderInitialFilters({
    querySpecialty: "علوم الحاسب",
    queryCity: "جدة",
    sessionFilters: getTrainingFinderSessionFilters(),
  })).toEqual({ specialty: "علوم الحاسب", city: "جدة" });
});

test("clearing filters removes only session-scoped discovery state", () => {
  window.localStorage.setItem("unrelated-account-preference", "keep");
  saveTrainingFinderSessionFilters({ specialty: "نظم المعلومات", city: "الدمام" });
  clearTrainingFinderSessionFilters();

  expect(getTrainingFinderSessionFilters()).toEqual({ specialty: "", city: "" });
  expect(window.localStorage.getItem("unrelated-account-preference")).toBe("keep");
});

test("changing major or city replaces the active session filters", () => {
  saveTrainingFinderSessionFilters({ specialty: "محاسبة", city: "الرياض" });
  saveTrainingFinderSessionFilters({ specialty: "مالية", city: "الدمام" });

  expect(readFinderFilters()).toEqual({ specialty: "مالية", city: "الدمام" });
});
