import API_BASE_URL from "../config/api";
import { getAccessHeaders, getStoredAccessIdentity } from "./premiumAccess";

const QA_PREVIEW_KEY = "darbak_experience_reward_qa_preview";

export async function canShowExperienceReward() {
  const identity = getStoredAccessIdentity();
  const hasIdentity = Boolean(identity.contact && identity.accessCode);
  try {
    const response = await fetch(`${API_BASE_URL}/api/rewards/resume/rollout`, {
      headers: getAccessHeaders({}),
    });
    if (!response.ok) return false;
    const data = await response.json();
    if (data.enabled) {
      if (data.mode === "qa" && hasIdentity) sessionStorage.setItem(QA_PREVIEW_KEY, "1");
      return true;
    }
    return !hasIdentity && data.mode === "qa" && sessionStorage.getItem(QA_PREVIEW_KEY) === "1";
  } catch {
    return false;
  }
}
