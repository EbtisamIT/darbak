const assert = require("assert");
const {
  DIRECTORY_COMPANY_SEEDS,
  companyAliasesMatchName,
} = require("../services/companyDirectorySeeds");

assert.strictEqual(DIRECTORY_COMPANY_SEEDS.length, 20, "The initial directory should contain 20 companies");
assert.ok(DIRECTORY_COMPANY_SEEDS.every((company) => !company.city), "Directory companies must not be scoped to a city");

const aramco = DIRECTORY_COMPANY_SEEDS.find((company) => company.slug === "aramco");
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

console.log("company directory seed tests passed");
