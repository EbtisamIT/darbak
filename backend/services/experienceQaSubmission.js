const { isExperienceRewardQaTestEnabled } = require("./experienceRewardRollout");

const QA_TEST_CAMPAIGN = "experience-reward-v1.1";

const classifyExperienceSubmission = ({ body = {}, authenticatedUserId = "" } = {}) => {
  const hasQaMarker = body.qaTest === true || Boolean(body.qaTestCampaign);
  if (hasQaMarker) {
    if (body.qaTest !== true || body.qaTestCampaign !== QA_TEST_CAMPAIGN ||
      !isExperienceRewardQaTestEnabled(authenticatedUserId)) {
      return { status: 403, qaTest: false };
    }
    return { status: 200, qaTest: true };
  }
  if (body.publicationConsent !== true) return { status: 400, qaTest: false };
  return { status: 200, qaTest: false };
};

module.exports = { QA_TEST_CAMPAIGN, classifyExperienceSubmission };
