import { useCallback, useEffect, useRef, useState } from "react";
import { trackEvent } from "../utils/analytics";
import { PREMIUM_STATUS_EVENT } from "../utils/premiumAccess";
import { canShowSurvey, rememberSurvey, shouldSkipSurvey, isSurveyContentRoute, hasOtherSurveyModal, SURVEY_DELAY_MS } from "../utils/studentFeedbackPrompt";

export const trackSurvey = (event, metadata = {}) => {
  try { trackEvent(event, { metadata }); } catch { /* Analytics cannot block the survey or navigation. */ }
};

export default function useStudentFeedbackPrompt(pathname) {
  const [isOpen, setIsOpen] = useState(false);
  const openRef = useRef(false);
  const shownRef = useRef(false);
  const engagement = useRef({ elapsed: 0, interacted: false, pages: new Set(), eligibleAfter: Date.now() + 60000 });
  const dismiss = useCallback((action = "closed", reason = "button") => {
    if (!openRef.current) return;
    openRef.current = false;
    rememberSurvey(action);
    setIsOpen(false);
    trackSurvey(action === "later" ? "survey_later" : "survey_closed", { reason });
  }, []);

  const complete = useCallback(() => {
    rememberSurvey("submitted");
    trackSurvey("survey_submitted");
  }, []);

  useEffect(() => {
    if (openRef.current) dismiss("closed", "navigation");
    if (shownRef.current || !canShowSurvey() || shouldSkipSurvey(pathname)) return undefined;
    const state = engagement.current;
    if (isSurveyContentRoute(pathname)) state.pages.add(pathname);
    if (state.pages.size > 1) state.interacted = true;
    let activeSince = null;
    let timer;
    let scheduled;
    let disposed = false;
    const updateElapsed = () => {
      if (activeSince !== null) state.elapsed += Date.now() - activeSince;
      activeSince = null;
    };
    const check = () => {
      if (disposed) return;
      window.clearTimeout(timer);
      updateElapsed();
      const blocked = document.visibilityState !== "visible" || hasOtherSurveyModal();
      if (blocked) {
        if (openRef.current) dismiss("closed", "interrupted");
        return;
      }
      if (shownRef.current || !canShowSurvey()) return;
      activeSince = Date.now();
      const ready = state.pages.size >= 3 || (state.elapsed >= SURVEY_DELAY_MS && state.interacted);
      if (ready && Date.now() >= state.eligibleAfter) {
        shownRef.current = true;
        openRef.current = true;
        rememberSurvey("shown");
        setIsOpen(true);
        trackSurvey("survey_shown");
        return;
      }
      const wait = ready ? state.eligibleAfter - Date.now() : SURVEY_DELAY_MS - state.elapsed;
      if (wait > 0) timer = window.setTimeout(check, wait);
    };
    const scheduleCheck = () => {
      // Wait for React to finish opening a detail/login modal before considering a prompt.
      window.clearTimeout(scheduled);
      scheduled = window.setTimeout(check, 0);
    };
    const interact = (event) => {
      if (event.target.closest?.(".student-feedback-sheet-wrap") || hasOtherSurveyModal()) return;
      if (!isSurveyContentRoute(pathname)) return;
      // Input focus and arbitrary clicks are not meaningful engagement.
      if (event.type === "click" && !event.target.closest?.("main a[href], main button, article a[href], article button")) return;
      if (event.type === "change" && !event.target.matches?.("select, input[type=search]")) return;
      state.interacted = true;
      scheduleCheck();
    };
    const resetAfterLogin = () => {
      updateElapsed();
      state.elapsed = 0;
      state.interacted = false;
      state.pages.clear();
      state.eligibleAfter = Date.now() + 60000;
      if (openRef.current) dismiss("closed", "account_change");
      scheduleCheck();
    };
    const observer = new MutationObserver(scheduleCheck);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden", "open", "aria-hidden"] });
    document.addEventListener("click", interact);
    document.addEventListener("change", interact);
    document.addEventListener("visibilitychange", scheduleCheck);
    window.addEventListener(PREMIUM_STATUS_EVENT, resetAfterLogin);
    window.addEventListener("darbak:free-account-saved", resetAfterLogin);
    scheduleCheck();
    return () => {
      disposed = true;
      updateElapsed();
      window.clearTimeout(timer);
      window.clearTimeout(scheduled);
      observer.disconnect();
      document.removeEventListener("click", interact);
      document.removeEventListener("change", interact);
      document.removeEventListener("visibilitychange", scheduleCheck);
      window.removeEventListener(PREMIUM_STATUS_EVENT, resetAfterLogin);
      window.removeEventListener("darbak:free-account-saved", resetAfterLogin);
    };
  }, [pathname, dismiss]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (event) => { if (event.key === "Escape") dismiss("closed", "escape"); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, dismiss]);

  return { isOpen: isOpen && !shouldSkipSurvey(pathname), dismiss, complete, hide: () => { openRef.current = false; setIsOpen(false); } };
}
