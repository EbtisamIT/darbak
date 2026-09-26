import {
  formatOfferCountdown,
  getPlanOfferPricing,
  isCampaignActive,
} from "./nationalDayOffer";

const campaign = {
  id: "national-day-90d-960",
  planId: "one_time_90",
  normalPrice: 15,
  offerPrice: 9.6,
  startsAt: "2026-09-26T19:10:49.000Z",
  endsAt: "2026-09-28T19:10:49.000Z",
  enabled: true,
};

test("National Day offer is active only inside its 48-hour server window", () => {
  expect(isCampaignActive(campaign, Date.parse("2026-09-26T19:10:49.000Z"))).toBe(true);
  expect(isCampaignActive(campaign, Date.parse("2026-09-28T19:10:49.000Z"))).toBe(false);
});

test("offer pricing falls back to the normal 90-day price at expiry", () => {
  const plan = { id: "one_time_90", normalPriceSar: 15, campaign };
  expect(getPlanOfferPricing(plan, Date.parse("2026-09-26T20:10:00.000Z"))).toMatchObject({
    active: true,
    normalPrice: 15,
    price: 9.6,
  });
  expect(getPlanOfferPricing(plan, Date.parse("2026-09-28T19:10:49.000Z"))).toMatchObject({
    active: false,
    price: 15,
  });
});

test("countdown is formatted as HH:MM:SS", () => {
  expect(formatOfferCountdown((3 * 3600 + 4 * 60 + 5) * 1000)).toBe("03:04:05");
});
