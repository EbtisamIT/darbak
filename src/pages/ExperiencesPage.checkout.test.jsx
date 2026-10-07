import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axios from "axios";
import ExperiencesPage from "./ExperiencesPage";
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
}));
jest.mock("axios", () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock("../utils/premiumAccess", () => ({
  PREMIUM_STATUS_EVENT: "darbak:premium-status",
  fetchSubscriptionState: jest.fn(),
  getAccessHeaders: () => ({}),
  hasCoreAccess: jest.fn(),
  requestPremiumAccess: jest.fn(),
  startSubscriptionFlow: jest.fn(),
}));
jest.mock("../components/ShareButton", () => () => null);

const originalFetch = global.fetch;
beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  global.fetch = jest.fn().mockResolvedValue({ json: async () => ({}) });
  axios.get.mockResolvedValue({ data: { data: [], total: 0, hasMore: false } });
  hasCoreAccess.mockReturnValue(false);
  fetchSubscriptionState.mockResolvedValue({ state: "FREE", planId: "" });
  requestPremiumAccess.mockImplementation((detail) => detail.onLimited?.({ reason: "daily_limit" }));
});
afterEach(() => { global.fetch = originalFetch; });

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
