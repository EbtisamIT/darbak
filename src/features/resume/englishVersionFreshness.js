export const markEnglishVersionFresh = (versions = [], versionId = "", updatedAt = new Date().toISOString()) => {
  const currentVersions = Array.isArray(versions) ? versions : [];
  const existing = currentVersions.find((version) => version._id === versionId) || {};
  const freshVersion = {
    ...existing,
    _id: versionId || existing._id || "",
    variantType: "translation",
    language: "en",
    needsLocalizationRefresh: false,
    updatedAt,
  };

  return currentVersions.some((version) => version._id === freshVersion._id)
    ? currentVersions.map((version) => version._id === freshVersion._id ? freshVersion : version)
    : [...currentVersions, freshVersion];
};
