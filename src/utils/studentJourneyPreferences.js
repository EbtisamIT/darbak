const STORAGE_KEY = "darbak:student-journey-preferences:v1";

const normalizePreference = (value) => (typeof value === "string" ? value.trim() : "");

export const normalizeJourneyPreferences = (value = {}) => ({
  preferredMajor: normalizePreference(value.preferredMajor),
  preferredCity: normalizePreference(value.preferredCity),
});

export const hasJourneyPreferences = (value = {}) => {
  const preferences = normalizeJourneyPreferences(value);
  return Boolean(preferences.preferredMajor && preferences.preferredCity);
};

export const getStoredJourneyPreferences = () => {
  if (typeof window === "undefined") return normalizeJourneyPreferences();

  try {
    return normalizeJourneyPreferences(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}"));
  } catch {
    return normalizeJourneyPreferences();
  }
};

export const saveStoredJourneyPreferences = (value = {}) => {
  const preferences = normalizeJourneyPreferences(value);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  }
  return preferences;
};

export const getFirstName = (fullName = "") => normalizePreference(fullName).split(/\s+/)[0] || "";
