import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axios from "axios";
import ExperiencesPage from "./ExperiencesPage";
import { canShowExperienceReward } from "../utils/experienceRewardRollout";
import {
  fetchSubscriptionState,
  hasCoreAccess,
  requestPremiumAccess,
  startSubscriptionFlow,
} from "../utils/premiumAccess";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  useLocation: () => ({ pathname: "/experiences", search: "?city=riyadh" }),
  useNavigate: () => mockNavigate,
  useParams: () => ({}),
  Link: ({ to, children, ...props }) => require("react").createElement("a", { href: to, ...props }, children),
}));
jest.mock("axios", () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock("../utils/premiumAccess", () => ({
  PREMIUM_STATUS_EVENT: "darbak:premium-status",
  fetchSubscriptionState: jest.fn(),
  getAccessHeaders: () => ({}),
  getStoredAccessIdentity: () => ({}),
  hasCoreAccess: jest.fn(),
  requestPremiumAccess: jest.fn(),
  startSubscriptionFlow: jest.fn(),
}));
jest.mock("../components/ShareButton", () => () => null);
jest.mock("../utils/experienceRewardRollout", () => ({ canShowExperienceReward: jest.fn(async () => true) }));

const originalFetch = global.fetch;
beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  global.fetch = jest.fn().mockResolvedValue({ json: async () => ({}) });
  axios.get.mockResolvedValue({ data: { data: [], total: 0, hasMore: false } });
  hasCoreAccess.mockReturnValue(false);
  fetchSubscriptionState.mockResolvedValue({ state: "FREE", planId: "" });
  requestPremiumAccess.mockImplementation((detail) => detail.onLimited?.({ reason: "daily_limit" }));
  canShowExperienceReward.mockResolvedValue(true);
});
afterEach(() => { global.fetch = originalFetch; });

test("experience banner uses the existing contribution route with source attribution", async () => {
  await act(async () => { render(<ExperiencesPage />); });
  const link = await screen.findByRole("link", { name: "شارك تجربتك" });
  expect(link).toHaveAttribute("href", "/share-experience?contributionSource=experiences_page");
  expect(screen.getByText("🎁 تدربت قبل؟ شارك تجربتك وخذ سيرة ذاتية مجانية بقالب ATS")).toBeInTheDocument();
  const banner = document.querySelector(".experiences-contribution-banner");
  const search = screen.getByPlaceholderText("ابحث باسم الشركة، الجهة، أو التخصص");
  expect(search.compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test("Darbak+ appears once after the first five experiences", async () => {
  axios.get.mockResolvedValue({ data: {
    data: Array.from({ length: 6 }, (_, index) => ({
      _id: `exp-${index + 1}`,
      title: `تجربة ${index + 1}`,
      organizationName: "جهة اختبار",
      city: "riyadh",
      major: "تقنية المعلومات",
    })),
    total: 6,
    hasMore: false,
  } });
  await act(async () => { render(<ExperiencesPage />); });
  await screen.findAllByRole("button", { name: "عرض التفاصيل" });
  const feedItems = [...document.querySelector(".experience-cards-grid").children];
  expect(feedItems).toHaveLength(7);
  expect(feedItems.slice(0, 5).every((item) => item.classList.contains("experience-card"))).toBe(true);
  expect(feedItems[5]).toHaveAttribute("aria-label", "إعلان دربك بلس");
  expect(feedItems[6]).toHaveClass("experience-card");
  expect(screen.getAllByRole("button", { name: "كمل استكشافك" })).toHaveLength(1);
});

const openExperience = async () => {
  axios.get.mockResolvedValue({ data: {
    data: [{ _id: "exp-1", title: "تجربة تدريب", organizationName: "جهة اختبار", city: "riyadh", major: "تقنية المعلومات" }],
    total: 1,
    hasMore: false,
  } });
  let view;
  await act(async () => { view = render(<ExperiencesPage />); });
  const details = await screen.findByRole("button", { name: "عرض التفاصيل" });
  await act(async () => { fireEvent.click(details); });
  return view;
};

const openLockedExperience = async () => {
  const view = await openExperience();
  const notice = await waitFor(() => document.querySelector(".premium-inline-notice"));
  return { view, cta: () => within(notice).getByRole("button", { name: /^(اشترك|تجديد الاشتراك|فتح الاشتراك)$/ }) };
};

const expectExperienceCheckout = () => {
  expect(startSubscriptionFlow).toHaveBeenCalledTimes(1);
  expect(startSubscriptionFlow).toHaveBeenCalledWith({
    planId: "darbak_plus",
    source: "experience_inline_notice",
    returnTo: "/experiences?city=riyadh",
    navigate: mockNavigate,
  });
};

test("locked experience opens checkout on the first click after status API succeeds", async () => {
  const { cta } = await openLockedExperience();
  await waitFor(() => expect(cta().textContent).toBe("اشترك"));
  fireEvent.click(cta());
  expectExperienceCheckout();
  expect(fetchSubscriptionState).toHaveBeenCalledTimes(1);
});

test("expired status changes the CTA copy without delaying checkout", async () => {
  fetchSubscriptionState.mockResolvedValue({ state: "EXPIRED", planId: "darbak_resume" });
  const { cta } = await openLockedExperience();
  await waitFor(() => expect(cta().textContent).toBe("تجديد الاشتراك"));
  fireEvent.click(cta());
  expectExperienceCheckout();
});

test("locked experience opens checkout on the first click after status API fails", async () => {
  fetchSubscriptionState.mockRejectedValue(new Error("State unavailable"));
  const { cta } = await openLockedExperience();
  await waitFor(() => expect(fetchSubscriptionState).toHaveBeenCalledTimes(1));
  expect(cta().textContent).toBe("فتح الاشتراك");
  fireEvent.click(cta());
  expectExperienceCheckout();
});

test("locked experience opens checkout immediately while status API is pending", async () => {
  fetchSubscriptionState.mockReturnValue(new Promise(() => {}));
  const { cta } = await openLockedExperience();
  expect(cta().textContent).toBe("فتح الاشتراك");
  fireEvent.click(cta());
  expectExperienceCheckout();
});

test("double click starts one checkout operation", async () => {
  const { cta } = await openLockedExperience();
  fireEvent.click(cta());
  fireEvent.click(cta());
  expectExperienceCheckout();
});

test("retry works after checkout closes and the locked experience reopens", async () => {
  const first = await openLockedExperience();
  fireEvent.click(first.cta());
  expectExperienceCheckout();
  first.view.unmount();
  const second = await openLockedExperience();
  fireEvent.click(second.cta());
  expect(startSubscriptionFlow).toHaveBeenCalledTimes(2);
});

test("an active user with access does not see the checkout paywall", async () => {
  hasCoreAccess.mockReturnValue(true);
  requestPremiumAccess.mockImplementation((detail, onGranted) => onGranted());
  await openExperience();
  expect(document.querySelector(".premium-inline-notice")).toBeNull();
  expect(startSubscriptionFlow).not.toHaveBeenCalled();
});

test("experiences banner still enters unified checkout on its first click", async () => {
  await act(async () => { render(<ExperiencesPage />); });
  fireEvent.click(screen.getByRole("button", { name: "كمل استكشافك" }));
  expect(startSubscriptionFlow).toHaveBeenCalledTimes(1);
  expect(startSubscriptionFlow).toHaveBeenCalledWith({
    planId: "darbak_plus",
    source: "experiences_plus_banner",
    returnTo: "/experiences?city=riyadh",
    navigate: mockNavigate,
  });
});
