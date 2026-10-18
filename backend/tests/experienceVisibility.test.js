const assert = require("node:assert/strict");
const { getPublicExperienceFilter } = require("../services/experienceVisibility");

const filter = getPublicExperienceFilter();
assert.deepEqual(filter.qaTest, { $ne: true });
assert.deepEqual(filter.$or, [
  { status: "approved" },
  { status: { $exists: false } },
]);
assert.equal(filter.qaTest.$ne, true);
console.log("QA experience visibility: PASS");
