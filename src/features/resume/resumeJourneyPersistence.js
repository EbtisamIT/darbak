const RESUME_JOURNEY_STORAGE_KEY = "darbak_resume_journey_v1";
const JOURNEY_STEPS = ["data", "missing", "draft", "polish", "ready"];

const normalizeProgress = (progress = {}) => {
  const currentStep = JOURNEY_STEPS.includes(progress.currentStep) ? progress.currentStep : "data";
  const currentIndex = JOURNEY_STEPS.indexOf(currentStep);
  const completedSteps = Array.isArray(progress.completedSteps)
    ? progress.completedSteps.filter((step) => {
      const stepIndex = JOURNEY_STEPS.indexOf(step);
      return stepIndex >= 0 && stepIndex < currentIndex;
    })
    : [];

  return {
    currentStep,
    completedSteps: [...new Set(completedSteps)],
    source: progress.source === "scratch" ? "scratch" : "portfolio",
    savedAt: progress.savedAt || new Date().toISOString(),
  };
};

const getJourneyStorageKey = (storageScope = "") =>
  storageScope ? `${RESUME_JOURNEY_STORAGE_KEY}:${storageScope}` : "";

export const readResumeJourneyProgress = (storageScope = "") => {
  const storageKey = getJourneyStorageKey(storageScope);
  if (!storageKey) return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? normalizeProgress(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};

export const writeResumeJourneyProgress = (progress, storageScope = "") => {
  const normalized = normalizeProgress(progress);
  const storageKey = getJourneyStorageKey(storageScope);
  if (!storageKey) return normalized;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(normalized));
  } catch {
    // The backend draft remains the source of recovery if browser storage is unavailable.
  }
  return normalized;
};

export const clearResumeJourneyProgress = (storageScope = "") => {
  const storageKey = getJourneyStorageKey(storageScope);
  if (!storageKey) return;
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // Nothing else is required when browser storage is unavailable.
  }
};

// Navigation state is a short-lived confirmation that the student used the
// explicit CTA in this browser session. It prevents a storage-restricted
// browser from bouncing back to step one while localStorage is unavailable.
export const getReachableJourneyProgress = (savedProgress, navigationProgress) => {
  const navigation = navigationProgress && typeof navigationProgress === "object"
    ? normalizeProgress(navigationProgress)
    : null;
  const saved = savedProgress && typeof savedProgress === "object"
    ? normalizeProgress(savedProgress)
    : null;

  if (navigation?.completedSteps?.length || navigation?.currentStep === "data") return navigation;
  return saved;
};
