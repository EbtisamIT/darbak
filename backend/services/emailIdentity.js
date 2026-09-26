const EMAIL_FORMAT_CHARACTERS = /[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;
const EMAIL_FORMAT_CHARACTER_CLASS = String.fromCodePoint(
  0x200b,
  0x200c,
  0x200d,
  0xfeff,
  0x200e,
  0x200f,
  0x202a,
  0x202b,
  0x202c,
  0x202d,
  0x202e,
  0x2066,
  0x2067,
  0x2068,
  0x2069
);

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
  // MongoDB PCRE2 does not accept JavaScript-style `\\uXXXX` escapes. Use
  // literal code points so this compatibility lookup works in production.
  const format = `[${EMAIL_FORMAT_CHARACTER_CLASS}]*`;
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
