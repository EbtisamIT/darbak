const { blockedInbox } = require("./autoApplyEmailNetwork");

// Convert one existing admin-reviewed channel. The caller chooses when and where to ingest it.
function legacyEmailObservation(channel, linkedOpportunity) {
  const opportunityId = channel.activeOpportunityId ? String(channel.activeOpportunityId) : "";
  if (linkedOpportunity && (!opportunityId || String(linkedOpportunity._id) !== opportunityId)) {
    throw new Error("Legacy opportunity does not match the channel");
  }

  const sourceType = channel.evidenceType || "legacy_email_channel";
  const documented = channel.verifiedAt && channel.evidenceDate && channel.evidenceTextSummary?.trim() &&
    (channel.evidenceUrl || (sourceType === "official_company_reply" && channel.verificationRespondedAt));
  const verified = channel.verificationStatus === "verified" && channel.acceptsTrainingApplications === true &&
    ["active_opportunity", "evergreen_training"].includes(channel.channelType) && documented && !blockedInbox(channel.email);
  const verificationStatus = verified ? "VERIFIED" :
    ({ likely: "LIKELY", rejected: "REJECTED" }[channel.verificationStatus] || "NEEDS_REVIEW");

  return {
    companyName: channel.company,
    companyId: channel.companyId,
    opportunityId,
    opportunityTitle: linkedOpportunity?.title,
    channelType: "EMAIL",
    destinationEmail: channel.email,
    emailTrainingConfirmed: verified ? true : null,
    majors: channel.majors,
    fields: channel.preferredFields,
    cities: channel.cities,
    allMajors: channel.allMajors || null,
    allSaudi: channel.allSaudi || null,
    remote: channel.remote || null,
    deadline: linkedOpportunity?.deadline,
    sourceUrl: channel.evidenceUrl,
    sourceType,
    evidenceText: channel.evidenceTextSummary,
    evidencePublishedAt: channel.evidenceDate,
    verificationStatus,
    verificationReason: verified ? "Previously verified in the Darbak email review queue" : channel.rejectionReason,
    lastCheckedAt: channel.verifiedAt,
    expiresAt: channel.expiresAt,
  };
}

module.exports = { legacyEmailObservation };
