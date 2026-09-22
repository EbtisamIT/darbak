export const formatOfferCountdown = (remainingMs = 0) => {
  const seconds = Math.max(0, Math.floor(Number(remainingMs || 0) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  return [hours, minutes, remainingSeconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
};

export const getServerTimeOffset = (serverNow = "") => {
  const timestamp = new Date(serverNow).getTime();
  return Number.isFinite(timestamp) ? timestamp - Date.now() : 0;
};

export const isCampaignActive = (campaign, now = Date.now()) => {
  if (!campaign?.enabled) return false;
  const startsAt = new Date(campaign.startsAt).getTime();
  const endsAt = new Date(campaign.endsAt).getTime();

  return (
    Number.isFinite(startsAt) &&
    Number.isFinite(endsAt) &&
    now >= startsAt &&
    now < endsAt
  );
};

export const getCampaignRemainingMs = (campaign, now = Date.now()) => {
  const endsAt = new Date(campaign?.endsAt).getTime();
  return Number.isFinite(endsAt) ? Math.max(0, endsAt - now) : 0;
};

export const getPlanOfferPricing = (plan = {}, now = Date.now()) => {
  const campaign = plan.campaign;
  const active = isCampaignActive(campaign, now);
  const normalPrice = Number(plan.normalPriceSar ?? campaign?.normalPrice ?? plan.priceSar);
  const offerPrice = Number(campaign?.offerPrice ?? plan.priceSar);

  return {
    active,
    normalPrice,
    price: active ? offerPrice : normalPrice,
    campaign,
  };
};
