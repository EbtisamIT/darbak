const assert = require("assert");
const {
  buildOpportunityDirectoryExport,
  buildDirectoryCsvRows,
} = require("../services/opportunityDirectoryExport");

const data = buildOpportunityDirectoryExport({
  companies: [{
    _id: "company-1",
    name: "شركة ألف",
    city: "الرياض",
    contactEmail: "training@alpha.sa",
    createdAt: "2026-09-01T00:00:00.000Z",
  }],
  opportunities: [{
    _id: "opportunity-1",
    companyId: "company-1",
    organizationName: "شركة ألف",
    title: "تدريب تعاوني",
    specialties: ["نظم المعلومات"],
    cities: ["الرياض"],
    applicationMethod: "email",
    applicationUrl: "mailto:coop@alpha.sa",
    status: "active",
    sourceType: "admin",
    createdAt: "2026-09-02T00:00:00.000Z",
  }],
});

assert.strictEqual(data.companies.length, 1);
assert.strictEqual(data.opportunities.length, 1);
assert.deepStrictEqual(data.opportunities[0].emails, ["coop@alpha.sa", "training@alpha.sa"]);
assert.deepStrictEqual(data.emailEligibleCoverage, [{
  specialty: "نظم المعلومات",
  city: "الرياض",
  eligibleCompanyCount: 1,
  eligibleOpportunityCount: 1,
}]);
assert.ok(!JSON.stringify(data).includes("student"));
assert.strictEqual(buildDirectoryCsvRows(data, "records")[0][0], "recordType");
assert.strictEqual(buildDirectoryCsvRows(data, "coverage")[1][2], 1);

console.log("opportunity directory export tests passed");
