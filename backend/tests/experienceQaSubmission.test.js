const assert = require("node:assert/strict");
const { QA_TEST_CAMPAIGN, classifyExperienceSubmission } = require("../services/experienceQaSubmission");

const qaUser = process.env.EXPERIENCE_REWARD_QA_USER_ID || "6ad4c81d101441eb032e467e";
const previous = process.env.EXPERIENCE_REWARD_V11_MODE;
try {
  process.env.EXPERIENCE_REWARD_V11_MODE = "qa";
  const qaBody = { qaTest: true, qaTestCampaign: QA_TEST_CAMPAIGN, publicationConsent: false };
  assert.deepEqual(classifyExperienceSubmission({ body: qaBody, authenticatedUserId: qaUser }),
    { status: 200, qaTest: true });
  assert.equal(classifyExperienceSubmission({ body: qaBody, authenticatedUserId: "other-user" }).status, 403);
  assert.equal(classifyExperienceSubmission({ body: qaBody }).status, 403);
  assert.equal(classifyExperienceSubmission({ body: { qaTest: true, publicationConsent: true },
    authenticatedUserId: qaUser }).status, 403);
  assert.equal(classifyExperienceSubmission({ body: { qaTestCampaign: QA_TEST_CAMPAIGN },
    authenticatedUserId: qaUser }).status, 403);
  assert.deepEqual(classifyExperienceSubmission({ body: { publicationConsent: true } }),
    { status: 200, qaTest: false });
  assert.equal(classifyExperienceSubmission({ body: { publicationConsent: false } }).status, 400);
  process.env.EXPERIENCE_REWARD_V11_MODE = "all";
  assert.equal(classifyExperienceSubmission({ body: qaBody, authenticatedUserId: qaUser }).status, 403);
  console.log("QA experience submission gate: PASS");
} finally {
  if (previous === undefined) delete process.env.EXPERIENCE_REWARD_V11_MODE;
  else process.env.EXPERIENCE_REWARD_V11_MODE = previous;
}
