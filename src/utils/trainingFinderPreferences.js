const SESSION_FILTERS_KEY = "darbak:where-to-train:filters:v1";

const normalizeFilter = (value = "") =>
  typeof value === "string" ? value.trim() : "";

export const normalizeTrainingFinderFilters = (value = {}) => ({
  specialty: normalizeFilter(value.specialty),
  city: normalizeFilter(value.city),
});

export const getTrainingFinderSessionFilters = () => {
  if (typeof window === "undefined") return normalizeTrainingFinderFilters();

  try {
    return normalizeTrainingFinderFilters(
      JSON.parse(window.sessionStorage.getItem(SESSION_FILTERS_KEY) || "{}")
    );
  } catch {
    return normalizeTrainingFinderFilters();
  }
};

export const saveTrainingFinderSessionFilters = (value = {}) => {
  const filters = normalizeTrainingFinderFilters(value);
  if (typeof window === "undefined") return filters;

  try {
    if (!filters.specialty && !filters.city) {
      window.sessionStorage.removeItem(SESSION_FILTERS_KEY);
    } else {
      window.sessionStorage.setItem(SESSION_FILTERS_KEY, JSON.stringify(filters));
    }
  } catch {
    // Session persistence is a convenience and must never block discovery.
  }
  return filters;
};

export const clearTrainingFinderSessionFilters = () => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(SESSION_FILTERS_KEY);
  } catch {
    // Ignore unavailable browser storage.
  }
};

export const getTrainingFinderInitialFilters = ({
  routeSpecialty = "",
  querySpecialty = "",
  routeCity = "",
  queryCity = "",
  sessionFilters = {},
} = {}) => {
  const saved = normalizeTrainingFinderFilters(sessionFilters);

  return {
    specialty: routeSpecialty || querySpecialty || saved.specialty,
    city: routeCity || queryCity || saved.city,
  };
};
