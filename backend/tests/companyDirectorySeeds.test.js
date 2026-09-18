const assert = require("assert");
const {
  DIRECTORY_COMPANY_SEEDS,
  companyAliasesMatchName,
} = require("../services/companyDirectorySeeds");

assert.strictEqual(DIRECTORY_COMPANY_SEEDS.length, 20, "The initial directory should contain 20 companies");
assert.ok(DIRECTORY_COMPANY_SEEDS.every((company) => !company.city), "Directory companies must not be scoped to a city");

const aramco = DIRECTORY_COMPANY_SEEDS.find((company) => company.slug === "aramco");
const saudia = DIRECTORY_COMPANY_SEEDS.find((company) => company.slug === "saudia");
const stc = DIRECTORY_COMPANY_SEEDS.find((company) => company.slug === "stc");
assert.ok(aramco, "Aramco seed should exist");
[
  "أرامكو",
  "شركة أرامكو السعودية",
  "Aramco",
  "Saudi Aramco",
  "Saudi Arabian Oil Company",
].forEach((name) => {
  assert.ok(companyAliasesMatchName(aramco, name), `Aramco should match ${name}`);
});

["الخطوط السعودية", "Saudi Airlines", "Saudia"].forEach((name) => {
  assert.ok(companyAliasesMatchName(saudia, name), `Saudia should match ${name}`);
});
assert.equal(companyAliasesMatchName(saudia, "أرامكو السعودية"), false, "Saudia must not match Aramco through السعودية");
assert.equal(companyAliasesMatchName(aramco, "الخطوط السعودية"), false, "Aramco must not match Saudia through السعودية");
assert.equal(companyAliasesMatchName(stc, "solutions by stc"), false, "STC must not absorb solutions by stc without an explicit alias");

const snb = { name: "البنك الأهلي السعودي", aliases: ["البنك الأهلي السعودي", "Saudi National Bank"] };
const sab = { name: "البنك السعودي الأول", aliases: ["البنك السعودي الأول", "Saudi Awwal Bank"] };
const sama = { name: "البنك المركزي السعودي", aliases: ["البنك المركزي السعودي", "Saudi Central Bank"] };
assert.equal(companyAliasesMatchName(snb, "البنك السعودي الأول"), false);
assert.equal(companyAliasesMatchName(sama, "البنك الأهلي السعودي"), false);

console.log("company directory seed tests passed");
