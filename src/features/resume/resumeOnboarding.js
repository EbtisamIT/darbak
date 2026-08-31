// The onboarding is a one-time consent point. Portfolio hydration can populate
// data, but only this persisted workflow flag decides whether it is complete.
export const shouldShowResumeOnboarding = (workflow = {}) => !workflow.isSetupComplete;
