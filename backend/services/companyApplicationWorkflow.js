const REVIEW_LINK_OPEN_THROTTLE_MS = 15 * 60 * 1000;

const buildCampaignApplicationFilter = ({ campaignId = "", applicationIds = [] } = {}) => ({
  campaignId: String(campaignId),
  isDemo: { $ne: true },
  ...(applicationIds.length ? { _id: { $in: applicationIds } } : {}),
});

const buildStudentApplicationOwnershipFilter = ({ studentId = null, email = "" } = {}) => {
  const ownership = [];
  if (studentId) ownership.push({ studentId });
  if (email) ownership.push({ normalizedEmail: email }, { email });
  return ownership.length ? { $or: ownership } : null;
};

const shouldRecordReviewLinkOpen = (lastOpenedAt, now = new Date()) => {
  if (!lastOpenedAt) return true;
  const previous = new Date(lastOpenedAt);
  if (Number.isNaN(previous.getTime())) return true;
  return now.getTime() - previous.getTime() >= REVIEW_LINK_OPEN_THROTTLE_MS;
};

module.exports = {
  REVIEW_LINK_OPEN_THROTTLE_MS,
  buildCampaignApplicationFilter,
  buildStudentApplicationOwnershipFilter,
  shouldRecordReviewLinkOpen,
};
