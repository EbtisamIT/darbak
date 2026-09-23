const normalize = (value = "") =>
  String(value || "")
    .trim()
    .toLocaleLowerCase("ar")
    .replace(/\s+/g, " ");

const hasTextMatch = (values = [], selectedValues = []) => {
  const normalizedValues = values.map(normalize).filter(Boolean);
  return selectedValues.map(normalize).filter(Boolean).some((selectedValue) =>
    normalizedValues.some(
      (value) =>
        value === selectedValue ||
        value.includes(selectedValue) ||
        selectedValue.includes(value)
    )
  );
};

export const getOpportunityPersonalizationTier = ({
  opportunity = {},
  specialty = "",
  majorCategories = [],
  cityScope = [],
} = {}) => {
  const specialtyValues = [specialty, ...majorCategories].filter(Boolean);
  const opportunitySpecialties = [
    ...(opportunity.specialties || []),
    ...(opportunity.majors || []),
    ...(opportunity.majorCategories || []),
  ];
  const opportunityCities = Array.isArray(opportunity.cities)
    ? opportunity.cities
    : [opportunity.city];
  const majorMatch = hasTextMatch(opportunitySpecialties, specialtyValues);
  const cityMatch = hasTextMatch(opportunityCities, cityScope);

  if (majorMatch && cityMatch) return 3;
  if (majorMatch) return 2;
  if (cityMatch) return 1;
  return 0;
};

// Keep the existing server/general ranking within every relevance tier.
export const rankOpportunitiesForPersonalization = (
  opportunities = [],
  context = {}
) =>
  opportunities
    .map((opportunity, index) => ({
      opportunity,
      index,
      tier: getOpportunityPersonalizationTier({ opportunity, ...context }),
    }))
    .sort((first, second) => second.tier - first.tier || first.index - second.index)
    .map(({ opportunity }) => opportunity);
