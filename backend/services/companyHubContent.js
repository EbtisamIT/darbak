const REAL_OPPORTUNITY_SOURCE_TYPES = ["admin", "visitor"];

const isRealDarbakOpportunity = (opportunity = {}) =>
  Boolean(
    opportunity &&
      REAL_OPPORTUNITY_SOURCE_TYPES.includes(opportunity.sourceType) &&
      ["active", "expired"].includes(opportunity.status) &&
      String(opportunity.title || "").trim()
  );

const buildRealOpportunityFilter = (companyFilter = {}) => ({
  ...companyFilter,
  status: { $in: ["active", "expired"] },
  sourceType: { $in: REAL_OPPORTUNITY_SOURCE_TYPES },
  title: { $type: "string", $ne: "" },
});

module.exports = {
  REAL_OPPORTUNITY_SOURCE_TYPES,
  isRealDarbakOpportunity,
  buildRealOpportunityFilter,
};
