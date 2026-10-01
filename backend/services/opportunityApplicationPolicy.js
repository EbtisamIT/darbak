const PAGE_AVAILABILITY = ["AVAILABLE", "GONE", "BLOCKED", "ERROR"];
const APPLICATION_STATES = ["OPEN", "CLOSED", "UNKNOWN_BUT_ACTIONABLE", "UNKNOWN"];
const APPLICATION_WARNING = "حالة نموذج التقديم لم تُتحقق آليًا";
const ACTIONABLE_STATES = new Set(["OPEN", "UNKNOWN_BUT_ACTIONABLE"]);

function availabilityFromError(error) {
  const code = String(error?.code || error?.message || error || "");
  if (/HTTP_(404|410)$/.test(code)) return "GONE";
  if (/ROBOTS|SOURCE_BLOCKED|HTTP_(401|403|429)$/.test(code)) return "BLOCKED";
  return "ERROR";
}

function readyForReview(data) {
  const v = data.verification || {};
  return Boolean(data.company && data.title && data.applicationUrl && data.sourceUrl &&
    data.realJobPosting === true && data.pageAvailability === "AVAILABLE" &&
    ACTIONABLE_STATES.has(data.applicationState) &&
    v.officialSource === true && v.companyVerified === true && v.urlWorks === true && v.appearsOpen !== false);
}

module.exports = { PAGE_AVAILABILITY, APPLICATION_STATES, APPLICATION_WARNING, availabilityFromError, readyForReview };
