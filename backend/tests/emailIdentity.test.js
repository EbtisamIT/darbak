const assert = require("assert");
const {
  canonicalizeEmail,
  buildLegacyEmailIdentityPattern,
} = require("../services/emailIdentity");

const canonical = "maramaljhdlli@gmail.com";

assert.strictEqual(canonicalizeEmail(canonical), canonical);
assert.strictEqual(
  canonicalizeEmail("\u200Fmaramaljhdlli@gmail.com"),
  canonical,
  "direction marks must not produce a second account identity"
);
assert.strictEqual(
  canonicalizeEmail("ma\u200Brama\u200Cljhdlli@gmail.com"),
  canonical,
  "zero-width format characters must not produce a second account identity"
);
assert.strictEqual(
  canonicalizeEmail("  MARAMALJHDLLI@GMAIL.COM\u200F  "),
  canonical,
  "canonical identity must also trim and lowercase"
);

const legacyPattern = buildLegacyEmailIdentityPattern(canonical);
assert.ok(legacyPattern.test("\u200Fmaramaljhdlli@gmail.com"));
assert.ok(legacyPattern.test("m\u200Baramaljhdlli@gmail.com\u200F"));
assert.ok(!legacyPattern.test("another@gmail.com"));

console.log("emailIdentity tests passed");
