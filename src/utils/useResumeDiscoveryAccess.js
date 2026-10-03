import { useEffect, useState } from "react";
import API_BASE_URL from "../config/api";
import {
  getAccessHeaders,
  getStoredAccessIdentity,
  hasResumeAccessPass,
  PREMIUM_STATUS_EVENT,
} from "./premiumAccess";

// Read-only discovery state. The Resume editor remains the sole owner of its data.
export default function useResumeDiscoveryAccess() {
  const [hasAccess, setHasAccess] = useState(() => hasResumeAccessPass());
  const [hasMaster, setHasMaster] = useState(false);

  useEffect(() => {
    const refresh = () => setHasAccess(hasResumeAccessPass());
    window.addEventListener(PREMIUM_STATUS_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(PREMIUM_STATUS_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    if (!hasAccess) {
      setHasMaster(false);
      return undefined;
    }
    const identity = getStoredAccessIdentity();
    if (!identity.contact || !identity.accessCode) return undefined;
    let active = true;
    fetch(`${API_BASE_URL}/api/resume/me`, { headers: getAccessHeaders() })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (active && data) setHasMaster(Boolean(data.masterResumeExists));
      })
      .catch(() => null);
    return () => { active = false; };
  }, [hasAccess]);

  return { hasAccess, hasMaster };
}
