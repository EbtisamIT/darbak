const { isCheckoutCanaryEnabled } = require("./checkoutCanary");

const QA_USER_ID = process.env.EXPERIENCE_REWARD_QA_USER_ID || "6ad4c81d101441eb032e467e";
const getExperienceRewardMode = () => String(process.env.EXPERIENCE_REWARD_MODE || "qa").trim().toLowerCase();
const getExperienceRewardV11Mode = () => String(process.env.EXPERIENCE_REWARD_V11_MODE || "qa").trim().toLowerCase();
const isExperienceRewardEnabled = (userId = "") => isCheckoutCanaryEnabled({
  mode: getExperienceRewardMode(), userId, qaUserId: QA_USER_ID,
});
const isExperienceRewardV11Enabled = (userId = "") => isCheckoutCanaryEnabled({
  mode: getExperienceRewardV11Mode(), userId, qaUserId: QA_USER_ID,
});

module.exports = { getExperienceRewardMode, isExperienceRewardEnabled,
  getExperienceRewardV11Mode, isExperienceRewardV11Enabled };
