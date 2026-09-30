export const SURVEY_SESSION_KEY = "darbak_student_feedback_session_v2";
export const SURVEY_DEFER_KEY = "darbak_student_feedback_defer_v2";
export const SURVEY_SEEN_KEY = "darbak_student_feedback_seen_v1";
export const SURVEY_DELAY_MS = 5 * 60 * 1000;
export const SURVEY_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * SURVEY_COOLDOWN_MS;

export const isSurveyContentRoute = (pathname) =>
  /^\/(experiences|where-to-train|companies|interviews)(\/|$)/.test(pathname);

export const shouldSkipSurvey = (pathname) =>
  !isSurveyContentRoute(pathname) && pathname !== "/";

export function canShowSurvey() {
  try {
    const submittedAt = Number(localStorage.getItem(SURVEY_SEEN_KEY) || 0);
    return !sessionStorage.getItem(SURVEY_SESSION_KEY)
      && Date.now() >= Number(localStorage.getItem(SURVEY_DEFER_KEY) || 0)
      && (!submittedAt || Date.now() - submittedAt >= THIRTY_DAYS_MS);
  } catch {
    // Without persistence, do not risk repeatedly interrupting the student.
    return false;
  }
}

export function rememberSurvey(action) {
  try {
    sessionStorage.setItem(SURVEY_SESSION_KEY, action);
    if (action === "submitted") localStorage.setItem(SURVEY_SEEN_KEY, String(Date.now()));
    else localStorage.setItem(SURVEY_DEFER_KEY, String(Date.now() + SURVEY_COOLDOWN_MS));
  } catch {
    // Storage failure must never prevent closing the survey.
  }
}

export function hasOtherSurveyModal() {
  const selectors = '[role="dialog"], [aria-modal="true"], dialog[open], .experience-modal, .company-interview-overlay, .interview-question-modal-overlay, .stepper-modal-bg, .national-day-offer-popup, .premium-access-overlay, .weekly-opportunity-nudge-overlay';
  return Array.from(document.querySelectorAll(selectors)).some((element) => {
    if (element.closest(".student-feedback-sheet-wrap")) return false;
    for (let node = element; node instanceof Element; node = node.parentElement) {
      const style = window.getComputedStyle(node);
      if (node.hidden || node.getAttribute("aria-hidden") === "true" || style.display === "none" || style.visibility === "hidden") return false;
    }
    return true;
  });
}
