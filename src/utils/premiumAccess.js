export const PREMIUM_ACCESS_EVENT = "darbak:request-premium-access";

const PREMIUM_PASS_KEY = "darbak_premium_pass_v1";

export const isPremiumGateEnabled = () =>
  process.env.REACT_APP_PREMIUM_GATE_ENABLED === "true";

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

export const savePremiumPass = (pass) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      PREMIUM_PASS_KEY,
      JSON.stringify({
        email: pass.email,
        expiresAt: pass.expiresAt,
        savedAt: new Date().toISOString(),
      })
    );
  } catch {
    // Access remains server-verifiable even if local storage is unavailable.
  }
};

export const requestPremiumAccess = (detail = {}, onGranted = () => {}) => {
  if (!isPremiumGateEnabled() || hasActivePremiumPass()) {
    onGranted();
    return true;
  }

  if (typeof window === "undefined") return false;

  window.dispatchEvent(
    new CustomEvent(PREMIUM_ACCESS_EVENT, {
      detail: {
        ...detail,
        onGranted,
      },
    })
  );

  return false;
};
