import {
  classifyLocationMatch,
  classifyMajorMatch,
} from "./trainingFinderTaxonomy";

const majorScores = { EXACT: 100, RELATED: 60, BROAD: 25, UNKNOWN: 0, NONE: 0 };
const locationScores = {
  EXACT_CITY: 40,
  REMOTE: 35,
  SAME_REGION: 25,
  OTHER_CITY: 0,
  UNKNOWN: 0,
};
const suitableLocations = new Set(["EXACT_CITY", "REMOTE", "SAME_REGION"]);

const getTier = (majorMatch, locationMatch, hasMajor, hasCity) => {
  if (!hasMajor && !hasCity) return 0;
  if (hasMajor && hasCity) {
    if (majorMatch === "EXACT" && suitableLocations.has(locationMatch)) return 1;
    if (
      (majorMatch === "RELATED" || majorMatch === "BROAD") &&
      suitableLocations.has(locationMatch)
    ) return 2;
    if (majorMatch === "EXACT" && locationMatch === "OTHER_CITY") return 2;
    return 3;
  }
  if (hasMajor) {
    if (majorMatch === "EXACT") return 1;
    return majorMatch === "RELATED" || majorMatch === "BROAD" ? 2 : 3;
  }
  return suitableLocations.has(locationMatch) ? 1 : 3;
};

const getLabels = (majorMatch, locationMatch, hasMajor, hasCity) => {
  const labels = [];
  if (hasMajor && majorMatch === "EXACT") labels.push("مطابق لتخصصك");
  if (hasMajor && majorMatch === "RELATED") labels.push("تخصص قريب");
  if (locationMatch === "REMOTE") labels.push("عن بُعد");
  if (hasCity && locationMatch === "EXACT_CITY") labels.push("في مدينتك");
  if (hasCity && locationMatch === "SAME_REGION") labels.push("في منطقتك");
  if (hasCity && locationMatch === "OTHER_CITY") labels.push("مدينة أخرى");
  return labels.slice(0, 2);
};

export const getOpportunityPersonalization = ({
  opportunity = {},
  specialty = "",
  majorCategories = [],
  city = "",
} = {}) => {
  const hasMajor = Boolean(String(specialty || "").trim());
  const hasCity = Boolean(String(city || "").trim());
  const majorMatch = classifyMajorMatch(opportunity, specialty, majorCategories);
  const locationMatch = classifyLocationMatch(opportunity, city);
  return {
    majorMatch,
    locationMatch,
    tier: getTier(majorMatch, locationMatch, hasMajor, hasCity),
    score: (hasMajor ? majorScores[majorMatch] : 0) +
      (hasCity || locationMatch === "REMOTE" ? locationScores[locationMatch] : 0),
    labels: hasMajor || hasCity
      ? getLabels(majorMatch, locationMatch, hasMajor, hasCity)
      : [],
  };
};

export const getOpportunityPersonalizationTier = (context = {}) =>
  getOpportunityPersonalization(context).tier;

const isOpen = (opportunity, now) =>
  opportunity.status !== "expired" &&
  opportunity.status !== "closed" &&
  (!opportunity.deadline || new Date(opportunity.deadline).getTime() >= now);

const getPublishedAt = (opportunity) =>
  new Date(opportunity.publishedAt || opportunity.createdAt || 0).getTime() || 0;

export const rankOpportunitiesForPersonalization = (opportunities = [], context = {}) => {
  if (!context.specialty && !context.city) return opportunities;
  const now = context.now || Date.now();
  return opportunities
    .map((opportunity, index) => ({
      opportunity,
      index,
      personalization: getOpportunityPersonalization({ opportunity, ...context }),
    }))
    .sort((first, second) =>
      first.personalization.tier - second.personalization.tier ||
      second.personalization.score - first.personalization.score ||
      Number(isOpen(second.opportunity, now)) - Number(isOpen(first.opportunity, now)) ||
      getPublishedAt(second.opportunity) - getPublishedAt(first.opportunity) ||
      String(first.opportunity._id || first.opportunity.id || "")
        .localeCompare(String(second.opportunity._id || second.opportunity.id || "")) ||
      first.index - second.index
    )
    .map(({ opportunity }) => opportunity);
};
