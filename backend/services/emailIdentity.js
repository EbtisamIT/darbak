const EMAIL_FORMAT_CHARACTERS = /[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

/**
 * Produces the internal identity form of an email address. Display copies are
 * intentionally left alone; this is only for account and subscription lookup.
 */
const canonicalizeEmail = (value = "") =>
  value
    .toString()
    .normalize("NFKC")
    .replace(EMAIL_FORMAT_CHARACTERS, "")
    .trim()
    .toLowerCase();

const escapeRegExp = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Matches a legacy email that only differs by invisible Unicode formatting
 * characters. It is deliberately limited to the canonical email characters.
 */
const buildLegacyEmailIdentityPattern = (canonicalEmail = "") => {
  const format = "[\\u200B-\\u200D\\uFEFF\\u200E\\u200F\\u202A-\\u202E\\u2066-\\u2069]*";
  return new RegExp(
    `^${format}${Array.from(canonicalizeEmail(canonicalEmail))
      .map((character) => `${escapeRegExp(character)}${format}`)
      .join("")}$`,
    "i"
  );
};

module.exports = {
  canonicalizeEmail,
  buildLegacyEmailIdentityPattern,
};
