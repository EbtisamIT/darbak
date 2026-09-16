import { normalizeJourneyPreferences } from "./studentJourneyPreferences";

export const getTrainingFinderInitialFilters = ({
  routeSpecialty = "",
  querySpecialty = "",
  routeCity = "",
  queryCity = "",
  preferences = {},
} = {}) => {
  const saved = normalizeJourneyPreferences(preferences);

  return {
    specialty: routeSpecialty || querySpecialty || saved.preferredMajor,
    city: routeCity || queryCity || saved.preferredCity,
  };
};

export const getTrainingFinderPreferenceKey = ({ major = "", city = "" } = {}) =>
  `${String(major).trim()}::${String(city).trim()}`;
