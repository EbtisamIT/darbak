const Opportunity = require("../models/Opportunity");
const { cleanOpportunityUrl, candidateToOpportunity } = require("./opportunityCandidateData");

// The draft uses existing Opportunity paths, not a second public schema.
const fields = Object.keys(Opportunity.schema.paths).filter((key) => ![
  "_id", "__v", "createdAt", "updatedAt", "automationKey", "companyId",
].includes(key));
function normalizeDraft(input = {}) {
  const values = Object.fromEntries(fields.filter((key) => Object.hasOwn(input, key)).map((key) => [key, input[key]]));
  for (const key of Object.keys(values)) if (values[key] == null && key !== "deadline") delete values[key];
  for (const key of ["cities", "majorCategories", "specialties", "keywords"]) {
    if (Object.hasOwn(values, key) && !Array.isArray(values[key])) throw new TypeError(`${key} must be an array`);
  }
  for (const key of ["logoUrl", "sourceUrl"]) if (values[key]) values[key] = cleanOpportunityUrl(values[key]);
  // The manual form also supports email application channels.
  if (values.applicationUrl && !/^(mailto:)?[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(values.applicationUrl)) values.applicationUrl = cleanOpportunityUrl(values.applicationUrl);
  if (values.deadline === "") values.deadline = null;
  const doc = new Opportunity(values);
  const errors = doc.validateSync()?.errors || {};
  for (const [key, error] of Object.entries(errors)) {
    if (!["organizationName", "title"].includes(key) || error.kind !== "required") throw error;
  }
  const data = doc.toObject();
  data.cities = data.cities?.length ? data.cities : data.city ? [data.city] : [];
  data.city = data.cities[0] || "";
  return Object.fromEntries(fields.map((key) => [key, data[key] ?? (key === "deadline" ? null : "")]));
}
function prepareCandidateInput(input) {
  const canonical = input.opportunityDraft || (Object.hasOwn(input, "organizationName") ? input : null);
  if (!canonical) return input;
  const draft = normalizeDraft(canonical);
  return { ...input, opportunityDraft: draft, company: draft.organizationName, title: draft.title,
    companyLogo: draft.logoUrl, cities: draft.cities, majors: draft.specialties,
    remote: draft.trainingMode === "remote", description: draft.note,
    applicationUrl: /^(mailto:)?[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(draft.applicationUrl) ? "" : draft.applicationUrl,
    sourceUrl: draft.sourceUrl, deadline: draft.deadline,
    sourceType: ["admin", "visitor"].includes(input.sourceType) ? "other" : input.sourceType };
}
function attachDraft(data) {
  return { ...data, evidenceLinks: [...new Set([...(data.evidenceLinks || []), data.sourceUrl, data.applicationUrl].filter(Boolean))].slice(0, 30),
    opportunityDraft: normalizeDraft(candidateToOpportunity(data)) };
}
function reviewState(data) {
  const v = data.verification || {};
  const clear = data.company && data.title && data.applicationUrl && v.officialSource === true &&
    v.companyVerified === true && v.urlWorks === true &&
    (v.appearsOpen === true || data.applicationState === "UNKNOWN_BUT_ACTIONABLE") &&
    data.applicationState !== "CLOSED" && data.pageAvailability !== "GONE" && data.realJobPosting !== false &&
    (!data.deadline || new Date(data.deadline) >= new Date(new Date().toISOString().slice(0, 10)));
  return clear ? "ready_for_review" : "needs_verification";
}
module.exports = { fields, normalizeDraft, prepareCandidateInput, attachDraft, reviewState };
