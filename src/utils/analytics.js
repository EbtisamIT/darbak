import API_BASE_URL from "../config/api";

const VISITOR_ID_KEY = "darbak_visitor_id_v1";
const SESSION_ID_KEY = "darbak_session_id_v1";
const LOCAL_DEDUPE_KEY = "darbak_analytics_dedupe_v1";

export const getVisitorId = () => {
  if (typeof window === "undefined") return "";

  try {
    const existingId = window.localStorage.getItem(VISITOR_ID_KEY);
    if (existingId) return existingId;

    const randomId =
      window.crypto?.randomUUID?.() ||
      `visitor_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem(VISITOR_ID_KEY, randomId);
    return randomId;
  } catch {
    return "";
  }
};

const getDeviceType = () => {
  if (typeof window === "undefined") return "unknown";
  const width = window.innerWidth;

  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
};

const getSessionId = () => {
  if (typeof window === "undefined") return "";

  try {
    const existingId = window.sessionStorage.getItem(SESSION_ID_KEY);
    if (existingId) return existingId;

    const randomId =
      window.crypto?.randomUUID?.() ||
      `session_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    window.sessionStorage.setItem(SESSION_ID_KEY, randomId);
    return randomId;
  } catch {
    return "";
  }
};

export const trackEvent = (eventName, payload = {}) => {
  if (!eventName || typeof window === "undefined") return;
  const sessionId = getSessionId();

  const body = {
    eventName,
    visitorId: getVisitorId(),
    page: window.location.pathname,
    deviceType: getDeviceType(),
    ...payload,
    metadata: {
      ...(payload.metadata || {}),
      ...(sessionId ? { sessionId } : {}),
    },
  };

  fetch(`${API_BASE_URL}/api/analytics-events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {
    // Analytics should never interrupt the user experience.
  });
};

const getDedupeStorageKey = (eventName, dedupeKey = "default") =>
  `darbak_analytics_once_${eventName}_${dedupeKey}`;

export const trackEventOncePerSession = (
  eventName,
  payload = {},
  dedupeKey = "default"
) => {
  if (!eventName || typeof window === "undefined") return;

  try {
    const storageKey = getDedupeStorageKey(eventName, dedupeKey);
    if (window.sessionStorage.getItem(storageKey)) return;
    window.sessionStorage.setItem(storageKey, "1");
  } catch {
    // If storage is blocked, fall back to normal analytics.
  }

  trackEvent(eventName, payload);
};

export const trackEventOnceLocal = (
  eventName,
  payload = {},
  dedupeKey = "default"
) => {
  if (!eventName || typeof window === "undefined") return;

  try {
    const storedKeys = JSON.parse(
      window.localStorage.getItem(LOCAL_DEDUPE_KEY) || "[]"
    );
    const safeKeys = Array.isArray(storedKeys) ? storedKeys : [];
    const nextKey = `${eventName}:${dedupeKey}`;
    if (safeKeys.includes(nextKey)) return;

    const nextKeys = [...safeKeys.slice(-120), nextKey];
    window.localStorage.setItem(LOCAL_DEDUPE_KEY, JSON.stringify(nextKeys));
  } catch {
    // If storage is blocked, fall back to normal analytics.
  }

  trackEvent(eventName, payload);
};
