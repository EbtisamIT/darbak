const assert = require("assert");

const Company = require("../models/Company");
const Experience = require("../models/Experience");
const InterviewQuestion = require("../models/InterviewQuestion");
const Opportunity = require("../models/Opportunity");

[
  "nameAr",
  "nameEn",
  "sector",
  "aliases",
  "isPublished",
].forEach((field) => {
  assert.ok(Company.schema.path(field), `Company.${field} should exist`);
});

[Experience, InterviewQuestion, Opportunity].forEach((model) => {
  assert.ok(model.schema.path("companyId"), `${model.modelName}.companyId should exist`);
  assert.strictEqual(model.schema.path("companyId").options.ref, "companies");
});

console.log("company directory schema tests passed");
