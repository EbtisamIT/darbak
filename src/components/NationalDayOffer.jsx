import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import API_BASE_URL from "../config/api";
import {
  formatOfferCountdown,
  getCampaignRemainingMs,
  getServerTimeOffset,
  isCampaignActive,
} from "../utils/nationalDayOffer";

const getSeenKey = (campaignId = "") => `darbak:campaign:${campaignId}:seen`;

const isCampaignResponse = (campaign) =>
  campaign?.id === "national-day-90d-960" && campaign?.planId === "one_time_90";

export default function NationalDayOffer() {
  const navigate = useNavigate();
  const location = useLocation();
  const [campaign, setCampaign] = useState(null);
  const [serverOffset, setServerOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [showPopup, setShowPopup] = useState(false);
  const [didExpire, setDidExpire] = useState(false);
  const wasActiveRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    fetch(`${API_BASE_URL}/api/subscriptions/plans`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!mounted || !isCampaignResponse(payload?.campaign)) return;
        setCampaign(payload.campaign);
        setServerOffset(getServerTimeOffset(payload.serverNow));
      })
      .catch(() => null);

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const serverNow = now + serverOffset;
  const isActive = isCampaignActive(campaign, serverNow);
  const countdown = formatOfferCountdown(getCampaignRemainingMs(campaign, serverNow));

  useEffect(() => {
    if (!campaign) return;
    if (wasActiveRef.current && !isActive) setDidExpire(true);
    wasActiveRef.current = isActive;
  }, [campaign, isActive]);

  useEffect(() => {
    if (!isActive || !campaign?.id) return;
    try {
      if (!window.localStorage.getItem(getSeenKey(campaign.id))) {
        window.localStorage.setItem(getSeenKey(campaign.id), "1");
        setShowPopup(true);
      }
    } catch {
      // If storage is unavailable, keep the campaign non-blocking.
    }
  }, [campaign?.id, isActive]);

  useEffect(() => {
    if (!didExpire) return undefined;
    const timer = window.setTimeout(() => setDidExpire(false), 7000);
    return () => window.clearTimeout(timer);
  }, [didExpire]);

  const subscribeUrl = useMemo(
    () => "/subscribe?plan=one_time_90&source=national_day_campaign",
    []
  );
  const goToSubscribe = () => {
    setShowPopup(false);
    navigate(subscribeUrl);
  };

  if (location.pathname.startsWith("/company") || location.pathname.startsWith("/p/")) {
    return null;
  }

  return (
    <>
      {isActive && (
        <button
          type="button"
          className="national-day-offer-bar"
          onClick={goToSubscribe}
          dir="rtl"
        >
          <span className="national-day-offer-bar-desktop">
            عرض اليوم الوطني 🇸🇦 <i /> 3 أشهر بـ 9.60 بدل 15 ريال <i /> باقي {countdown}
          </span>
          <span className="national-day-offer-bar-mobile">
            اليوم الوطني 🇸🇦 3 أشهر بـ9.60 <i /> باقي {countdown}
          </span>
        </button>
      )}

      {didExpire && (
        <div className="national-day-offer-expired" role="status" dir="rtl">
          انتهى عرض اليوم الوطني وعاد سعر باقة الثلاثة أشهر إلى 15 ريال.
        </div>
      )}

      {showPopup && isActive && (
        <div className="national-day-offer-backdrop" role="presentation">
          <section
            className="national-day-offer-popup"
            role="dialog"
            aria-modal="true"
            aria-labelledby="national-day-offer-title"
            dir="rtl"
          >
            <span className="national-day-offer-eyebrow">عرض اليوم الوطني 🇸🇦</span>
            <h2 id="national-day-offer-title">باقة دربك الشاملة لمدة 3 أشهر بـ 9.60 ريال</h2>
            <p>احتفالًا باليوم الوطني، بدل 15 ريال. فرصة مناسبة لموسم التدريب، والعرض متاح لمدة 24 ساعة فقط.</p>
            <button type="button" className="national-day-offer-primary" onClick={goToSubscribe}>
              اشترك بـ 9.60 ريال
            </button>
            <button type="button" className="national-day-offer-later" onClick={() => setShowPopup(false)}>
              لاحقًا
            </button>
          </section>
        </div>
      )}
    </>
  );
}
