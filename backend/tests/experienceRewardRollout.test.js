const assert = require("node:assert/strict");
const { getExperienceRewardMode, isExperienceRewardEnabled } = require("../services/experienceRewardRollout");
const qa = process.env.EXPERIENCE_REWARD_QA_USER_ID || "6abd577bec30b3276baf2027";
const oldMode = process.env.EXPERIENCE_REWARD_MODE;
try {
  delete process.env.EXPERIENCE_REWARD_MODE;
  assert.equal(getExperienceRewardMode(), "qa");
  assert.equal(isExperienceRewardEnabled(qa), true);
  assert.equal(isExperienceRewardEnabled("other-user"), false);
  assert.equal(isExperienceRewardEnabled(), false);
  process.env.EXPERIENCE_REWARD_MODE = "off";
  assert.equal(isExperienceRewardEnabled(qa), false);
  process.env.EXPERIENCE_REWARD_MODE = "all";
  assert.equal(isExperienceRewardEnabled("other-user"), true);
  assert.equal(isExperienceRewardEnabled(), true);
  console.log("Experience reward rollout: PASS");
} finally {
  if (oldMode === undefined) delete process.env.EXPERIENCE_REWARD_MODE;
  else process.env.EXPERIENCE_REWARD_MODE = oldMode;
}
