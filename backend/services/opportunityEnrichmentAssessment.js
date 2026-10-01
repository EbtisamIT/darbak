const WEIGHTS = { company: 10, title: 10, applicationUrl: 10, cities: 10, majors: 10,
  responsibilities: 15, requirements: 15, deadline: 5, companyLogo: 5, description: 5, programType: 5 };
const REVIEW_STATUSES = ["READY_FOR_REVIEW", "NEEDS_DETAILS", "NEEDS_VERIFICATION", "UPDATE_EXISTING", "DUPLICATE", "CLOSED"];
const { readyForReview } = require("./opportunityApplicationPolicy");
function hasField(data, field) {
  if (field === "majors" && ["all", "broad"].includes(data.majorScope)) return true;
  if (field === "programType") return Boolean(data[field] && data[field] !== "unknown");
  return Array.isArray(data[field]) ? data[field].length > 0 : Boolean(data[field]);
}
function assessEnrichment(data, now = new Date()) {
  const completenessScore = Object.entries(WEIGHTS).reduce((score, [field, weight]) => score + (hasField(data, field) ? weight : 0), 0);
  const missingFields = [...Object.keys(WEIGHTS), "postedAt", "trainingStartDate", "duration"].filter((field) => !hasField(data, field));
  const v = data.verification || {};
  const closed = data.applicationState === "CLOSED" || data.pageAvailability === "GONE" || v.appearsOpen === false ||
    (data.deadline && new Date(data.deadline).toISOString().slice(0, 10) < now.toISOString().slice(0, 10));
  if (data.pageAvailability || data.applicationState) {
    const detailsPresent = hasField(data, "description") && (hasField(data, "responsibilities") || hasField(data, "requirements"));
    return { completenessScore, missingFields,
      reviewStatus: closed ? "CLOSED" : !readyForReview(data) ? "NEEDS_VERIFICATION" : detailsPresent ? "READY_FOR_REVIEW" : "NEEDS_DETAILS" };
  }
  const verified = v.officialSource === true && v.companyVerified === true && v.urlWorks === true && v.appearsOpen === true;
  const sufficient = completenessScore >= 65 && ["company", "title", "applicationUrl", "cities", "majors", "requirements"].every((key) => hasField(data, key));
  return { completenessScore, missingFields, reviewStatus: closed ? "CLOSED" : !verified ? "NEEDS_VERIFICATION" : sufficient ? "READY_FOR_REVIEW" : "NEEDS_DETAILS" };
}
module.exports = { WEIGHTS, REVIEW_STATUSES, assessEnrichment };
