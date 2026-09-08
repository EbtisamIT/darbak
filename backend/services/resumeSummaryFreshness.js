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

const buildEnglishSummaryFreshness = ({
  masterProvenance = {},
  englishProvenance = {},
  masterUpdatedAt = "",
} = {}) => {
  const masterSummaryUpdatedAt = safeText(masterProvenance.summaryUpdatedAt);
  const sourceSummaryUpdatedAt = safeText(englishProvenance.sourceSummaryUpdatedAt);
  const sourceSummaryVersion = safeText(englishProvenance.sourceSummaryVersion);
  const masterSummaryVersion = safeText(masterProvenance.summaryWriterVersion);
  const sourceMasterUpdatedAt = safeText(englishProvenance.sourceMasterUpdatedAt);
  const currentMasterUpdatedAt = safeText(masterUpdatedAt);
  const needsLocalizationRefresh = Boolean(
    (masterSummaryUpdatedAt && (
      !sourceSummaryUpdatedAt ||
      toTimestamp(masterSummaryUpdatedAt) > toTimestamp(sourceSummaryUpdatedAt)
    )) ||
    (currentMasterUpdatedAt && (
      !sourceMasterUpdatedAt ||
      toTimestamp(currentMasterUpdatedAt) > toTimestamp(sourceMasterUpdatedAt)
    ))
  );

  return {
    masterSummaryUpdatedAt,
    masterSummaryVersion,
    sourceSummaryUpdatedAt,
    sourceSummaryVersion,
    sourceMasterUpdatedAt,
    currentMasterUpdatedAt,
    needsLocalizationRefresh,
  };
};

module.exports = {
  buildEnglishSummaryFreshness,
  mergeMasterSummaryProvenance,
};
