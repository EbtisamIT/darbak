const REVIEW_COUNTERS = { READY_FOR_REVIEW: "readyForReview", NEEDS_DETAILS: "needsDetails", NEEDS_VERIFICATION: "needsVerification" };

function summarizeCandidates(groups, discoveredToday, emailLeads) {
  const summary = { discoveredToday, emailLeads, readyForReview: 0, needsDetails: 0, needsVerification: 0, closed: 0 };
  for (const group of groups) {
    const { status, reviewStatus } = group._id;
    summary[status] = (summary[status] || 0) + group.count;
    if (["published", "rejected", "duplicate", "update_existing"].includes(status)) continue;
    if (status === "expired" || reviewStatus === "CLOSED") { summary.closed += group.count; continue; }
    const counter = REVIEW_COUNTERS[reviewStatus] || (status === "ready" ? "readyForReview" : status === "needs_review" ? "needsVerification" : null);
    if (counter) summary[counter] += group.count;
  }
  return summary;
}

module.exports = { summarizeCandidates };
