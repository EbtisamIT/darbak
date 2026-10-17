const { isCheckoutCanaryEnabled } = require("./checkoutCanary");

const QA_USER_ID = process.env.EXPERIENCE_REWARD_QA_USER_ID || "6abd577bec30b3276baf2027";
const getExperienceRewardMode = () => String(process.env.EXPERIENCE_REWARD_MODE || "qa").trim().toLowerCase();
const isExperienceRewardEnabled = (userId = "") => isCheckoutCanaryEnabled({
  mode: getExperienceRewardMode(), userId, qaUserId: QA_USER_ID,
});

module.exports = { getExperienceRewardMode, isExperienceRewardEnabled };
