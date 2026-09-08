const normalizeProfileFact = (value = "") => String(value || "").trim();

// Portfolio holds professional facts. Account preferences are a safe fallback
// for students who have not completed a Portfolio yet.
const resolveSavedMajorCity = ({ portfolio = {}, user = {} } = {}) => ({
  major: normalizeProfileFact(
    portfolio.major || portfolio.preferredMajor || user.preferredMajor,
  ),
  city: normalizeProfileFact(
    portfolio.city || portfolio.preferredCity || user.preferredCity,
  ),
});

const buildMajorCityProfileUpdates = ({ major = "", city = "" } = {}) => {
  const updates = {};
  const normalizedMajor = normalizeProfileFact(major);
  const normalizedCity = normalizeProfileFact(city);

  if (normalizedMajor) updates.major = normalizedMajor;
  if (normalizedCity) updates.city = normalizedCity;

  return updates;
};

module.exports = {
  buildMajorCityProfileUpdates,
  resolveSavedMajorCity,
};
