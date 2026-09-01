const hashStorageScope = (value = "") => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
};

// Browser storage is only a convenience layer. Keep its keys tied to the
// authenticated access identity so an account switch cannot restore another
// student's resume journey or agent session in the same browser.
export const getResumeStorageScope = (identity = {}) => {
  const contact = (identity.contact || identity.email || "").toString().trim().toLowerCase();
  const accessCode = (identity.accessCode || "").toString().trim();
  if (!contact || !accessCode) return "";
  return hashStorageScope(`${contact}:${accessCode}`);
};

export const getScopedResumeStorageKey = (baseKey = "", storageScope = "") =>
  baseKey && storageScope ? `${baseKey}:${storageScope}` : "";
