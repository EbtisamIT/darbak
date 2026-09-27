import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import API_BASE_URL from "../config/api";
import { getAccessHeaders } from "../utils/premiumAccess";
import "./StudentFeedbackSurvey.css";

const SURVEY_SEEN_KEY = "darbak_student_feedback_seen_v1";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const RATING_OPTIONS = [
  { value: 1, emoji: "😕", label: "مو مرة" },
  { value: 2, emoji: "😐", label: "عادية" },
  { value: 3, emoji: "🙂", label: "حلوة" },
  { value: 4, emoji: "😍", label: "ممتازة" },
];

const shouldSkipSurvey = (pathname) =>
  pathname.startsWith("/subscribe") ||
  pathname.startsWith("/my-resume") ||
  pathname.startsWith("/darbak-owner-review") ||
  pathname.startsWith("/company/") ||
  pathname.startsWith("/company-applications/");

const canShowAgain = () => {
  try {
    const seenAt = Number(window.localStorage.getItem(SURVEY_SEEN_KEY) || 0);
    return !seenAt || Date.now() - seenAt >= THIRTY_DAYS_MS;
  } catch {
    return false;
  }
};

const markSeen = () => {
  try {
    window.localStorage.setItem(SURVEY_SEEN_KEY, String(Date.now()));
  } catch {
    // The survey remains optional when local storage is unavailable.
  }
};

export default function StudentFeedbackSurvey() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [publicConsent, setPublicConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const interactionCountRef = useRef(0);
  const shownRef = useRef(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (shouldSkipSurvey(location.pathname) || !canShowAgain() || shownRef.current) {
      return undefined;
    }

    const tryOpen = () => {
      if (shownRef.current || document.visibilityState !== "visible") return;
      if (document.querySelector(".premium-access-overlay, .national-day-offer-popup, .weekly-opportunity-nudge-overlay")) {
        timerRef.current = window.setTimeout(tryOpen, 30000);
        return;
      }
      shownRef.current = true;
      markSeen();
      setIsOpen(true);
    };

    timerRef.current = window.setTimeout(tryOpen, 5 * 60 * 1000);
    const onMeaningfulInteraction = (event) => {
      if (!event.target.closest("button, a, input, select, textarea")) return;
      interactionCountRef.current += 1;
      if (interactionCountRef.current >= 3) tryOpen();
    };
    document.addEventListener("click", onMeaningfulInteraction);
    return () => {
      window.clearTimeout(timerRef.current);
      document.removeEventListener("click", onMeaningfulInteraction);
    };
  }, [location.pathname]);

  const submit = async () => {
    if (!rating || isSubmitting) return;
    try {
      setIsSubmitting(true);
      const response = await fetch(`${API_BASE_URL}/api/student-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAccessHeaders() },
        body: JSON.stringify({ rating, feedbackText, publicConsent, pageContext: location.pathname }),
      });
      if (!response.ok) throw new Error("feedback_failed");
      setIsComplete(true);
      window.setTimeout(() => setIsOpen(false), 2600);
    } catch {
      // Keep the sheet open: the student can retry without losing their text.
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;
  const question = rating >= 3
    ? "وش أكثر شيء ودك دربك يساعدك فيه هالفترة؟"
    : "وش الشي اللي ناقصك أو ضايقك في دربك؟";

  return (
    <div className="student-feedback-sheet-wrap" dir="rtl" role="dialog" aria-modal="true" aria-labelledby="student-feedback-title">
      <section className="student-feedback-sheet">
        {isComplete ? (
          <div className="student-feedback-thanks">
            <strong>وصلنا رأيك، شكرًا لك 🤍</strong>
            <span>رأيك يساعدنا نحدد وش نطوّر أول.</span>
          </div>
        ) : rating ? (
          <div className="student-feedback-step student-feedback-step-open">
            <span className="student-feedback-kicker">سؤال سريع</span>
            <h2 id="student-feedback-title">{question}</h2>
            <textarea value={feedbackText} onChange={(event) => setFeedbackText(event.target.value)} placeholder="اكتب اللي بخاطرك..." maxLength={1200} autoFocus />
            <small>حتى لو كلمة أو جملة قصيرة</small>
            <label className="student-feedback-consent">
              <input type="checkbox" checked={publicConsent} onChange={(event) => setPublicConsent(event.target.checked)} />
              <span>هل تسمح لنا بعرض رأيك بشكل مجهول في دربك؟<small>لن يظهر اسمك الكامل أو بريدك أو رقمك.</small></span>
            </label>
            <button type="button" onClick={submit} disabled={isSubmitting}>
              {isSubmitting ? "جارٍ الإرسال..." : "إرسال رأيي"}
            </button>
          </div>
        ) : (
          <div className="student-feedback-step">
            <span className="student-feedback-kicker">ساعدنا نحسن دربك 🤍</span>
            <h2 id="student-feedback-title">كيف كانت تجربتك اليوم؟</h2>
            <p>بنأخذ منك 10 ثواني بس</p>
            <div className="student-feedback-ratings" aria-label="تقييم التجربة">
              {RATING_OPTIONS.map((option) => (
                <button key={option.value} type="button" className="student-feedback-rating" onClick={() => setRating(option.value)}>
                  <span>{option.emoji}</span>{option.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
