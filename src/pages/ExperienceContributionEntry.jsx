import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ACCOUNT_MODAL_EVENT, getStoredAccessIdentity } from "../utils/premiumAccess";
import "./ExperienceJourney.css";
import { canShowExperienceReward } from "../utils/experienceRewardRollout";

const hasAccount = () => {
  const identity = getStoredAccessIdentity();
  return Boolean(identity.contact && identity.accessCode);
};

export default function ExperienceContributionEntry() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [rolloutEnabled, setRolloutEnabled] = useState(null);
  useEffect(() => {
    let active = true;
    canShowExperienceReward().then((enabled) => {
      if (!active) return;
      if (enabled) setRolloutEnabled(true);
      else navigate("/add-experience", { replace: true });
    });
    return () => { active = false; };
  }, [navigate]);
  const formQuery = new URLSearchParams(location.search);
  formQuery.set("source", "journey");
  const formPath = `/add-experience?${formQuery.toString()}`;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [showAuthGate]);

  useEffect(() => {
    if (!showAuthGate) return undefined;
    const onAccountSaved = () => navigate(formPath, { replace: true });
    window.addEventListener("darbak:free-account-saved", onAccountSaved);
    return () => window.removeEventListener("darbak:free-account-saved", onAccountSaved);
  }, [formPath, navigate, showAuthGate]);

  const continueToForm = () => {
    if (hasAccount()) {
      navigate(formPath);
      return;
    }
    setShowAuthGate(true);
  };

  if (!rolloutEnabled) return null;

  return (
    <main className="experience-journey-entry" dir="rtl">
      <section className="experience-journey-card">
        {showAuthGate ? (
          <>
            <h1>احفظ تجربتك ومكافأتك</h1>
            <p>سجّل حسابك المجاني عشان نحفظ تجربتك، تتابع اعتمادها، ونضيف مكافأة السيرة الذاتية لحسابك بعد الموافقة.</p>
            <button type="button" onClick={() => window.dispatchEvent(new CustomEvent(ACCOUNT_MODAL_EVENT, { detail: { mode: "contribution" } }))}>
              تسجيل الدخول أو إنشاء حساب
            </button>
          </>
        ) : (
          <>
            <h1>شارك تجربتك، وخذ شيء يفيدك بعدها</h1>
            <p>بعد اعتماد تجربة تدريبك تحصل على نسخة سيرة ذاتية واحدة مجانًا بقالب Darbak ATS Classic.</p>
            <ul>
              <li>سيرة ذاتية واحدة</li>
              <li>العربية أو الإنجليزية</li>
              <li>قالب ATS Classic</li>
              <li>PDF جاهز للتقديم</li>
            </ul>
            <p className="experience-journey-note">المكافأة لا تشمل باقة «سيرتي» أو خدمات التخصيص والترجمة.</p>
            <button type="button" onClick={continueToForm}>شارك تجربتي</button>
          </>
        )}
      </section>
    </main>
  );
}
