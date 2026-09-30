import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import API_BASE_URL from "../config/api";
import { getAccessHeaders } from "../utils/premiumAccess";
import useStudentFeedbackPrompt from "./useStudentFeedbackPrompt";
import "./StudentFeedbackSurvey.css";

const RATING_OPTIONS = [
  { value: 1, emoji: "😕", label: "مو مرة" },
  { value: 2, emoji: "😐", label: "عادية" },
  { value: 3, emoji: "🙂", label: "حلوة" },
  { value: 4, emoji: "😍", label: "ممتازة" },
];

export default function StudentFeedbackSurvey() {
  const location = useLocation();
  const { isOpen, dismiss, complete, hide } = useStudentFeedbackPrompt(location.pathname);
  const [rating, setRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [publicConsent, setPublicConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState("");
  const mountedRef = useRef(false);
  const submittingRef = useRef(false);
  const timerRef = useRef(null);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      window.clearTimeout(timerRef.current);
    };
  }, []);

  const submit = async () => {
    if (!rating || submittingRef.current) return;
    submittingRef.current = true;
    try {
      setIsSubmitting(true);
      setError("");
      const response = await fetch(`${API_BASE_URL}/api/student-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAccessHeaders() },
        body: JSON.stringify({ rating, feedbackText, publicConsent, pageContext: location.pathname }),
      });
      if (!response.ok) throw new Error("feedback_failed");
      complete();
      if (mountedRef.current) {
        setIsComplete(true);
        timerRef.current = window.setTimeout(hide, 2600);
      }
    } catch {
      if (mountedRef.current) setError("تعذر إرسال الرأي. يمكنك المحاولة مجددًا أو إغلاق النافذة.");
    } finally {
      submittingRef.current = false;
      if (mountedRef.current) setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;
  const question = rating >= 3
    ? "وش أكثر شيء ودك دربك يساعدك فيه هالفترة؟"
    : "وش الشي اللي ناقصك أو ضايقك في دربك؟";

  return (
    <div className="student-feedback-sheet-wrap" dir="rtl">
      <section className="student-feedback-sheet" role="dialog" aria-modal="false" aria-labelledby="student-feedback-title">
        <header className="student-feedback-header">
          <span className="student-feedback-kicker">رأيك اختياري 🤍</span>
          <button type="button" className="student-feedback-close" aria-label="إغلاق استبيان الرأي" title="إغلاق" onClick={() => dismiss()}>×</button>
        </header>
        {isComplete ? (
          <div className="student-feedback-thanks">
            <strong id="student-feedback-title">وصلنا رأيك، شكرًا لك 🤍</strong>
            <span>رأيك يساعدنا نحدد وش نطوّر أول.</span>
          </div>
        ) : rating ? (
          <div className="student-feedback-step student-feedback-step-open">
            <span className="student-feedback-kicker">سؤال سريع</span>
            <h2 id="student-feedback-title">{question}</h2>
            <textarea aria-label="رأيك" value={feedbackText} onChange={(event) => setFeedbackText(event.target.value)} placeholder="اكتب اللي بخاطرك..." maxLength={1200} />
            <small>حتى لو كلمة أو جملة قصيرة</small>
            <label className="student-feedback-consent">
              <input type="checkbox" checked={publicConsent} onChange={(event) => setPublicConsent(event.target.checked)} />
              <span>هل تسمح لنا بعرض رأيك بشكل مجهول في دربك؟<small>لن يظهر اسمك الكامل أو بريدك أو رقمك.</small></span>
            </label>
            <button type="button" onClick={submit} disabled={isSubmitting}>
              {isSubmitting ? "جارٍ الإرسال..." : "إرسال رأيي"}
            </button>
            {error && <p role="alert">{error}</p>}
          </div>
        ) : (
          <div className="student-feedback-step">
            <span className="student-feedback-kicker">إذا حاب، شاركنا رأيك 🤍</span>
            <h2 id="student-feedback-title">كيف كانت تجربتك اليوم؟</h2>
            <p>ياخذ أقل من 10 ثواني</p>
            <div className="student-feedback-ratings" aria-label="تقييم التجربة">
              {RATING_OPTIONS.map((option) => (
                <button key={option.value} type="button" className="student-feedback-rating" onClick={() => setRating(option.value)}>
                  <span>{option.emoji}</span>{option.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {!isComplete && <button type="button" className="student-feedback-later" onClick={() => dismiss("later")}>لاحقًا</button>}
      </section>
    </div>
  );
}
