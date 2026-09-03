const safeText = (value = "") => String(value || "").trim();

const toTimestamp = (value) => {
  const time = new Date(value || "").getTime();
  return Number.isFinite(time) ? time : 0;
};

const mergeMasterSummaryProvenance = ({
  existing = {},
  incoming = {},
  previousSummary = "",
  nextSummary = "",
  generated = false,
  now = new Date(),
} = {}) => {
  const summaryChanged = generated || safeText(previousSummary) !== safeText(nextSummary);
  const merged = { ...(existing || {}), ...(incoming || {}) };

  if (summaryChanged && safeText(nextSummary)) {
    merged.summaryUpdatedAt = now.toISOString();
  }

  return merged;
};

const buildEnglishSummaryFreshness = ({ masterProvenance = {}, englishProvenance = {} } = {}) => {
  const masterSummaryUpdatedAt = safeText(masterProvenance.summaryUpdatedAt);
  const sourceSummaryUpdatedAt = safeText(englishProvenance.sourceSummaryUpdatedAt);
  const sourceSummaryVersion = safeText(englishProvenance.sourceSummaryVersion);
  const masterSummaryVersion = safeText(masterProvenance.summaryWriterVersion);
  const needsLocalizationRefresh = Boolean(
    masterSummaryUpdatedAt && (
      !sourceSummaryUpdatedAt ||
      toTimestamp(masterSummaryUpdatedAt) > toTimestamp(sourceSummaryUpdatedAt)
    )
  );

  return {
    masterSummaryUpdatedAt,
    masterSummaryVersion,
    sourceSummaryUpdatedAt,
    sourceSummaryVersion,
    needsLocalizationRefresh,
  };
};

module.exports = {
  buildEnglishSummaryFreshness,
  mergeMasterSummaryProvenance,
};
