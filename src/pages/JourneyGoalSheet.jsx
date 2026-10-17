import React from "react";
import { createPortal } from "react-dom";
import "./ExperienceJourney.css";

export default function JourneyGoalSheet({ onGoal, onDismiss }) {
  return createPortal(
    <section className="journey-goal-sheet" role="dialog" aria-label="حدد هدفك في دربك" dir="rtl">
      <div className="journey-goal-inner">
        <div className="journey-goal-head">
          <div><h2>خل دربك يناسب مرحلتك أكثر</h2><p>وش هدفك حاليًا؟</p></div>
          <button type="button" aria-label="إغلاق" onClick={onDismiss}>×</button>
        </div>
        <div className="journey-goal-options">
          <button type="button" onClick={() => onGoal("training")}><strong>أدور فرصة تدريب</strong><small>رتّب لي الفرص حسب تخصصي ومدينتي</small></button>
          <button type="button" onClick={() => onGoal("contribution")}><strong>خلصت تدريب وعندي تجربة</strong><small>شارك تجربتك وخذ نسخة سيرة ذاتية مجانية بقالب ATS</small></button>
        </div>
        <button className="journey-goal-skip" type="button" onClick={onDismiss}>تصفح بدون تخصيص</button>
      </div>
    </section>,
    document.body
  );
}
