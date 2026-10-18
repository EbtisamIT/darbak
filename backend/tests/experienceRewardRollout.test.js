const assert = require("node:assert/strict");
const { getExperienceRewardMode, isExperienceRewardEnabled,
  getExperienceRewardV11Mode, isExperienceRewardV11Enabled,
  isExperienceRewardQaTestEnabled } = require("../services/experienceRewardRollout");
const qa = process.env.EXPERIENCE_REWARD_QA_USER_ID || "6ad4c81d101441eb032e467e";
const oldMode = process.env.EXPERIENCE_REWARD_MODE;
const oldV11Mode = process.env.EXPERIENCE_REWARD_V11_MODE;
try {
  delete process.env.EXPERIENCE_REWARD_MODE;
  assert.equal(getExperienceRewardMode(), "qa");
  assert.equal(isExperienceRewardEnabled(qa), true);
  assert.equal(isExperienceRewardEnabled("6abd577bec30b3276baf2027"), false);
  assert.equal(isExperienceRewardEnabled("other-user"), false);
  assert.equal(isExperienceRewardEnabled(), false);
  process.env.EXPERIENCE_REWARD_MODE = "off";
  assert.equal(isExperienceRewardEnabled(qa), false);
  process.env.EXPERIENCE_REWARD_MODE = "all";
  assert.equal(isExperienceRewardEnabled("other-user"), true);
  assert.equal(isExperienceRewardEnabled(), true);
  delete process.env.EXPERIENCE_REWARD_V11_MODE;
  assert.equal(getExperienceRewardV11Mode(), "qa");
  assert.equal(isExperienceRewardV11Enabled(qa), true);
  assert.equal(isExperienceRewardQaTestEnabled(qa), true);
  assert.equal(isExperienceRewardV11Enabled("other-user"), false,
    "V1 remains global while V1.1 stays QA-only");
  assert.equal(isExperienceRewardQaTestEnabled("other-user"), false);
  process.env.EXPERIENCE_REWARD_V11_MODE = "off";
  assert.equal(isExperienceRewardQaTestEnabled(qa), false);
  process.env.EXPERIENCE_REWARD_V11_MODE = "all";
  assert.equal(isExperienceRewardV11Enabled("other-user"), true);
  assert.equal(isExperienceRewardQaTestEnabled(qa), false,
    "The temporary QA submission must stop before global launch");
  console.log("Experience reward rollout: PASS");
} finally {
  if (oldMode === undefined) delete process.env.EXPERIENCE_REWARD_MODE;
  else process.env.EXPERIENCE_REWARD_MODE = oldMode;
  if (oldV11Mode === undefined) delete process.env.EXPERIENCE_REWARD_V11_MODE;
  else process.env.EXPERIENCE_REWARD_V11_MODE = oldV11Mode;
}
