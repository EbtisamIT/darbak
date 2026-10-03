import { trackEvent, trackEventOncePerSession } from "./analytics";

const ATTRIBUTION_KEY = "darbak_resume_discovery_attribution_v1";
const SOURCES = new Set([
  "homepage", "opportunity", "opportunity_card", "opportunity_page", "external_apply",
  "subscription_page", "navbar", "resume_landing",
]);

export const getResumeDiscoveryAttribution = () => {
  if (typeof window === "undefined") return {};
  try {
    const value = JSON.parse(window.sessionStorage.getItem(ATTRIBUTION_KEY) || "{}");
    return SOURCES.has(value.source) ? value : {};
  } catch {
    return {};
  }
};

export const setResumeDiscoveryAttribution = ({ source, pageContext, opportunityId } = {}) => {
  if (typeof window === "undefined" || !SOURCES.has(source)) return {};
  const value = {
    source,
    pageContext: String(pageContext || source).slice(0, 80),
    opportunityId: String(opportunityId || "").slice(0, 80),
  };
  try {
    window.sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(value));
  } catch {
    // Discovery still works when session storage is unavailable.
  }
  return value;
};

export const getResumeLandingPath = ({ source, pageContext, opportunityId } = {}) => {
  const params = new URLSearchParams();
  if (SOURCES.has(source)) params.set("source", source);
  if (pageContext) params.set("pageContext", pageContext);
  if (opportunityId) params.set("opportunityId", opportunityId);
  return `/resume${params.toString() ? `?${params}` : ""}`;
};

export const trackResumeDiscovery = (eventName, { onceKey, ...metadata } = {}) => {
  const attribution = getResumeDiscoveryAttribution();
  const payload = { metadata: { ...attribution, ...metadata } };
  if (onceKey) trackEventOncePerSession(eventName, payload, onceKey);
  else trackEvent(eventName, payload);
};

export const getResumeDiscoveryUserState = ({ hasAccess, hasMaster }) =>
  !hasAccess ? "non_subscriber" : hasMaster ? "resume_ready" : "resume_not_built";
