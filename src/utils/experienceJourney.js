export const GOAL_PREFERENCE_KEY = "darbak:journey-goal:v1";
export const GOAL_DISMISSED_KEY = "darbak:journey-goal-dismissed:v1";

export const getJourneyGoal = () => {
  try {
    return window.localStorage.getItem(GOAL_PREFERENCE_KEY) || "";
  } catch {
    return "";
  }
};

export const saveJourneyGoal = (goal) => {
  if (!["training", "contribution"].includes(goal)) return;
  try {
    window.localStorage.setItem(GOAL_PREFERENCE_KEY, goal);
    window.sessionStorage.setItem(GOAL_DISMISSED_KEY, "1");
  } catch {
    // Browsing remains available when storage is disabled.
  }
};

export const shouldShowJourneyGoal = () => {
  try {
    return !getJourneyGoal() && window.sessionStorage.getItem(GOAL_DISMISSED_KEY) !== "1";
  } catch {
    return false;
  }
};

export const dismissJourneyGoal = () => {
  try {
    window.sessionStorage.setItem(GOAL_DISMISSED_KEY, "1");
  } catch {
    // The sheet still closes for the current render.
  }
};

// A submission can only be considered for the future reward after approval.
// This does not grant a subscription or generate a resume.
export const getExperienceRewardEligibility = (experience = {}) => {
  if (experience.status === "approved" && experience.submittedByUserId) return "awaiting_reward";
  if (experience.status === "rejected") return "not_eligible";
  return "pending_review";
};
