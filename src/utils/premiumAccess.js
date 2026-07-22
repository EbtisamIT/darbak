import API_BASE_URL from "../config/api";
import { getVisitorId } from "./analytics";

export const PREMIUM_ACCESS_EVENT = "darbak:request-premium-access";
export const ACCOUNT_MODAL_EVENT = "darbak:open-account";

const PREMIUM_PASS_KEY = "darbak_premium_pass_v1";
const PREMIUM_PREVIEW_KEY = "darbak_premium_gate_preview_v1";
const ACCESS_IDENTITY_KEY = "darbak_access_identity_v1";

const getPremiumPreviewFlag = () => {
  if (typeof window === "undefined") return false;

  try {
    const params = new URLSearchParams(window.location.search);
    const previewParam = params.get("premium_test");

    if (previewParam === "1") {
      window.localStorage.setItem(PREMIUM_PREVIEW_KEY, "true");
      return true;
    }

    if (previewParam === "0") {
      window.localStorage.removeItem(PREMIUM_PREVIEW_KEY);
      return false;
    }

    return window.localStorage.getItem(PREMIUM_PREVIEW_KEY) === "true";
  } catch {
    return false;
  }
};

export const isPremiumGateEnabled = () =>
  process.env.REACT_APP_PREMIUM_GATE_ENABLED === "true" ||
  getPremiumPreviewFlag();

export const getStoredPremiumPass = () => {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.localStorage.getItem(PREMIUM_PASS_KEY);
    if (!stored) return null;

    const pass = JSON.parse(stored);
    const expiresAt = pass?.expiresAt ? new Date(pass.expiresAt) : null;

    if (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
      window.localStorage.removeItem(PREMIUM_PASS_KEY);
      return null;
    }

    return pass;
  } catch {
    return null;
  }
};

export const hasActivePremiumPass = () => Boolean(getStoredPremiumPass());

export const getStoredAccessIdentity = () => {
  if (typeof window === "undefined") return {};

  try {
    return JSON.parse(window.localStorage.getItem(ACCESS_IDENTITY_KEY) || "{}");
  } catch {
    return {};
  }
};

export const saveAccessIdentity = ({ contact = "", email = "", accessCode = "" } = {}) => {
  if (typeof window === "undefined") return;

  const normalizedContact = (contact || email || "").toString().trim();
  const normalizedCode = accessCode.toString().trim();
  if (!normalizedContact || !normalizedCode) return;

  try {
    window.localStorage.setItem(
      ACCESS_IDENTITY_KEY,
      JSON.stringify({
        contact: normalizedContact,
        accessCode: normalizedCode,
        savedAt: new Date().toISOString(),
      })
    );
  } catch {
    // The user can still enter the same data again if storage is blocked.
  }
};

export const savePremiumPass = (pass) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      PREMIUM_PASS_KEY,
      JSON.stringify({
        contact: pass.contact || pass.email,
        email: pass.email,
        expiresAt: pass.expiresAt,
        isAdmin: Boolean(pass.isAdmin),
        accessType: pass.accessType || "premium",
        savedAt: new Date().toISOString(),
      })
    );
  } catch {
    // Access remains server-verifiable even if local storage is unavailable.
  }
};

export const getAccessPayload = (detail = {}) => {
  const identity = getStoredAccessIdentity();
  return {
    contact: identity.contact || identity.email || "",
    accessCode: identity.accessCode || "",
    visitorId: getVisitorId(),
    itemKey: detail.itemKey || "",
  };
};

export const getAccessHeaders = (detail = {}) => {
  const payload = getAccessPayload(detail);
  return Object.entries({
    "x-darbak-contact": payload.contact,
    "x-darbak-access-code": payload.accessCode,
    "x-darbak-visitor-id": payload.visitorId,
    "x-darbak-item-key": payload.itemKey,
    "x-darbak-access-gate": isPremiumGateEnabled() ? "true" : "",
  }).reduce((headers, [key, value]) => {
    if (value) headers[key] = value;
    return headers;
  }, {});
};

const openPremiumGate = (detail, onGranted, accessStatus = {}) => {
  window.dispatchEvent(
    new CustomEvent(PREMIUM_ACCESS_EVENT, {
      detail: {
        ...detail,
        accessStatus,
        onGranted,
      },
    })
  );
};

export const requestPremiumAccess = (detail = {}, onGranted = () => {}) => {
  if (!isPremiumGateEnabled() || hasActivePremiumPass()) {
    onGranted();
    return true;
  }

  if (typeof window === "undefined") return false;

  fetch(`${API_BASE_URL}/api/access/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(getAccessPayload(detail)),
  })
    .then(async (response) => {
      const data = await response.json().catch(() => ({}));

      if (response.ok && data.granted) {
        if (data.isPremium || data.isAdmin) {
          savePremiumPass({
            ...data,
            contact: getStoredAccessIdentity().contact,
            email: getStoredAccessIdentity().contact,
            expiresAt:
              data.expiresAt ||
              new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          });
        }
        onGranted();
        return;
      }

      if (typeof detail.onLimited === "function") {
        detail.onLimited(data);
      }
      openPremiumGate(detail, onGranted, data);
    })
    .catch(() => {
      openPremiumGate(detail, onGranted, { reason: "check_failed" });
    });

  return false;
};
