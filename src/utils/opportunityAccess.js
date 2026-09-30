import axios from "axios";
import API_BASE_URL from "../config/api";
import {
  PREMIUM_ACCESS_EVENT,
  getAccessHeaders,
  getAccessPayload,
  hasActivePremiumPass,
} from "./premiumAccess";

const IDENTITY_REASONS = new Set(["invalid_identity", "missing_identity", "missing_user"]);

const isAccessDenial = (error) => {
  const status = error.response?.status;
  return [401, 402, 403].includes(status)
    || (status === 400 && IDENTITY_REASONS.has(error.response?.data?.reason));
};

export function getOpportunityErrorMessage(error) {
  const status = error.response?.status;
  if (status === 404 || status === 410) return "هذه الفرصة لم تعد متاحة. يمكنك استعراض بقية الفرص.";
  if (status === 429) return "طلبات كثيرة خلال وقت قصير. انتظر قليلًا ثم أعد المحاولة.";
  if (!error.response) return "لم يكتمل الاتصال بدربك. تحقق من اتصالك ثم أعد المحاولة.";
  return "حدث عطل مؤقت أثناء تحميل الفرصة. أعد المحاولة بعد قليل؛ لا تحتاج إلى إعادة الاشتراك.";
}

// The detail endpoint is authoritative, even when a locally cached pass or
// frontend gate flag disagrees. A free view is claimed through the existing API.
export async function requestOpportunityAccess(detail, onGranted) {
  const id = detail.itemKey?.replace(/^opportunity:/, "");
  const load = () => axios.get(`${API_BASE_URL}/api/opportunities/${id}`, {
    headers: getAccessHeaders({ itemKey: detail.itemKey }),
    timeout: 20000,
  });
  let response;
  try {
    try {
      response = await load();
    } catch (error) {
      if (error.response?.status !== 402 || error.response?.data?.reason !== "daily_limit") throw error;
      const check = await axios.post(`${API_BASE_URL}/api/access/check`, getAccessPayload(detail), { timeout: 20000 });
      if (!check.data?.granted) {
        const denied = new Error("Opportunity access denied");
        denied.response = { status: 402, data: check.data };
        throw denied;
      }
      response = await load();
    }
  } catch (error) {
    if (detail.isActive && !detail.isActive()) return;
    if (isAccessDenial(error)) {
      const accessStatus = { ...error.response?.data, granted: false };
      detail.onLimited?.(accessStatus);
      window.dispatchEvent(new CustomEvent(PREMIUM_ACCESS_EVENT, {
        detail: {
          ...detail,
          accessStatus,
          loginOnly: hasActivePremiumPass() || accessStatus.reason !== "daily_limit",
          onGranted: () => requestOpportunityAccess(detail, onGranted),
        },
      }));
      return;
    }
    detail.onError?.(error);
    return;
  }
  if (detail.isActive && !detail.isActive()) return;
  const opportunity = response.data?.data || response.data;
  if (!opportunity?._id) {
    detail.onError?.({ response: { status: 502 } });
    return;
  }
  await onGranted(opportunity);
}
