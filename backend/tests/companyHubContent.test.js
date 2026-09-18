const assert = require("assert");
const {
  isRealDarbakOpportunity,
  buildRealOpportunityFilter,
} = require("../services/companyHubContent");

assert.equal(isRealDarbakOpportunity({
  title: "برنامج تدريب تعاوني",
  status: "active",
  sourceType: "admin",
}), true);

assert.equal(isRealDarbakOpportunity({
  title: "بريد للتقديم",
  status: "active",
  sourceType: "application_suggestion",
}), false);

assert.equal(isRealDarbakOpportunity({
  title: "فرصة قديمة",
  status: "draft",
  sourceType: "admin",
}), false);

assert.deepEqual(buildRealOpportunityFilter({ companyId: "company-a" }), {
  companyId: "company-a",
  status: { $in: ["active", "expired"] },
  sourceType: { $in: ["admin", "visitor"] },
  title: { $type: "string", $ne: "" },
});

console.log("company hub content tests passed");
