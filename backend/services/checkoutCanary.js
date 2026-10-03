const isCheckoutCanaryEnabled = ({ mode = "qa", userId = "", qaUserId = "" } = {}) => {
  const normalizedMode = String(mode || "qa").trim().toLowerCase();
  if (normalizedMode === "all") return true;
  if (normalizedMode !== "qa") return false;
  return Boolean(userId && qaUserId && String(userId) === String(qaUserId));
};

module.exports = { isCheckoutCanaryEnabled };
