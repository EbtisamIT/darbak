import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiArrowLeft, FiCheck, FiFileText, FiX } from "react-icons/fi";
import axios from "axios";
import API_BASE_URL from "../config/api";
import {
  getStoredPremiumPass,
  hasDarbakPlusPass,
  hasResumeAccessPass,
} from "../utils/premiumAccess";
import { trackEvent } from "../utils/analytics";

const RESUME_PLAN_ID = "darbak_resume";

const formatPlanPrice = (plan = {}) =>
  typeof plan.priceSar === "number"
    ? `${plan.priceSar.toLocaleString("en-US", {
        minimumFractionDigits: plan.priceSar % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      })} ريال`
    : "";

const ResumeServicePromo = ({
  placement = "general",
  compact = false,
  hideForResumeSubscribers = true,
}) => {
  const navigate = useNavigate();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [resumePlan, setResumePlan] = useState(null);
  const [isResumePlanLaunchEnabled, setIsResumePlanLaunchEnabled] =
    useState(false);
  const pass = getStoredPremiumPass();
  const hasResume = hasResumeAccessPass();
  const hasPlus = hasDarbakPlusPass() || Boolean(pass);

  useEffect(() => {
    let isMounted = true;

    axios
      .get(`${API_BASE_URL}/api/subscriptions/plans`)
      .then(({ data }) => {
        if (!isMounted) return;
        const plan = (data.plans || []).find(
          (item) => item.id === RESUME_PLAN_ID || item.planKey === RESUME_PLAN_ID
        );
        setResumePlan(plan || null);
        setIsResumePlanLaunchEnabled(Boolean(data.resumePlanLaunchEnabled && plan));
      })
      .catch(() => {
        if (!isMounted) return;
        setResumePlan(null);
        setIsResumePlanLaunchEnabled(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (!isResumePlanLaunchEnabled) return null;
  if (hideForResumeSubscribers && hasResume) return null;

  const goToResumeOrSubscribe = () => {
    trackEvent("resume_service_promo_clicked", {
      metadata: {
        placement,
        hasPlus,
        hasResume,
        planKey: pass?.planKey || "",
      },
    });

    if (hasResume) {
      navigate("/my-resume");
      return;
    }

    if (hasPlus) {
      setShowUpgradeModal(true);
      return;
    }

    navigate("/subscribe?plan=darbak_resume&source=resume-service");
  };

  const upgrade = () => {
    setShowUpgradeModal(false);
    navigate("/subscribe?plan=darbak_resume&source=resume-upgrade");
  };

  const usageLimit = Number(resumePlan?.aiResumeUsageLimit || 0);
  const priceLabel = formatPlanPrice(resumePlan);

  return (
    <>
      <section
        className={`resume-service-promo${compact ? " is-compact" : ""}`}
        dir="rtl"
      >
        <div className="resume-service-promo-icon" aria-hidden="true">
          <FiFileText />
        </div>
        <div className="resume-service-promo-copy">
          <span>سيرتي بدربك ✨</span>
          <h3>أنشئ سيرتك من ملفك المهني</h3>
          <p>
            أنشئ سيرتك من ملفك المهني، وخصصها حسب متطلبات كل فرصة قبل التقديم.
          </p>
        </div>
        <button type="button" onClick={goToResumeOrSubscribe}>
          جهّز سيرتك الآن
          <FiArrowLeft aria-hidden="true" />
        </button>
      </section>

      {showUpgradeModal && (
        <div
          className="resume-upgrade-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="ترقية دربك+ سيرة"
          dir="rtl"
          onClick={() => setShowUpgradeModal(false)}
        >
          <section
            className="resume-upgrade-card"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="resume-upgrade-close"
              onClick={() => setShowUpgradeModal(false)}
              aria-label="إغلاق"
            >
              <FiX />
            </button>
            <span className="resume-upgrade-badge">ترقية اختيارية</span>
            <h2>دربك+ سيرة</h2>
            <p>
              لديك دربك+ بالفعل. بالترقية تحصل على خدمة سيرتي بدربك مع كل
              مزاياك الحالية.
            </p>
            <ul>
              <li>
                <FiCheck aria-hidden="true" />
                إنشاء سيرة ذاتية مرتبة ومتوافقة مع ATS.
              </li>
              <li>
                <FiCheck aria-hidden="true" />
                استيراد بيانات ملفك المهني.
              </li>
              <li>
                <FiCheck aria-hidden="true" />
                {usageLimit > 0
                  ? `${usageLimit} عمليات تخصيص ذكية شهريًا.`
                  : "عمليات تخصيص ذكية شهريًا."}
              </li>
            </ul>
            {priceLabel && (
              <p className="resume-upgrade-price">
                الترقية إلى {resumePlan?.label || "دربك+ سيرة"} بسعر{" "}
                <strong>{priceLabel}</strong>
              </p>
            )}
            <button type="button" onClick={upgrade}>
              ترقية إلى دربك+ سيرة
            </button>
          </section>
        </div>
      )}
    </>
  );
};

export default ResumeServicePromo;
