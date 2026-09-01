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

export const readResumeJourneyProgress = () => {
  try {
    const raw = window.localStorage.getItem(RESUME_JOURNEY_STORAGE_KEY);
    return raw ? normalizeProgress(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};

export const writeResumeJourneyProgress = (progress) => {
  const normalized = normalizeProgress(progress);
  try {
    window.localStorage.setItem(RESUME_JOURNEY_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // The backend draft remains the source of recovery if browser storage is unavailable.
  }
  return normalized;
};

export const clearResumeJourneyProgress = () => {
  try {
    window.localStorage.removeItem(RESUME_JOURNEY_STORAGE_KEY);
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
