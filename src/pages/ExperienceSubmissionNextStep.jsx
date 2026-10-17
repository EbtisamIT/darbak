import React from "react";

export default function ExperienceSubmissionNextStep({ experience, onInterview, onFinish }) {
  return (
    <div style={{ textAlign: "center", padding: 20 }}>
      <h3>وصلت تجربتك للمراجعة</h3>
      <p>شكرًا، تجربتك بتفيد الطلاب اللي جايين بعدك.</p>
      <p>هل كان فيه مقابلة قبل قبولك في التدريب؟</p>
      <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 10 }}>
        <button type="button" onClick={() => onInterview(experience)}>نعم، كانت فيه مقابلة</button>
        <button type="button" onClick={onFinish}>لا</button>
      </div>
    </div>
  );
}
