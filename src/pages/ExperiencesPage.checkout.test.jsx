import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import ExperiencesPage from "./ExperiencesPage";
import { fetchSubscriptionState, requestPremiumAccess, startSubscriptionFlow } from "../utils/premiumAccess";

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
  hasCoreAccess: () => false,
  requestPremiumAccess: jest.fn(),
  startSubscriptionFlow: jest.fn(),
}));
jest.mock("../components/ShareButton", () => () => null);
jest.mock("../components/PremiumInlineNotice", () => ({ onUnlock }) => (
  <button type="button" onClick={onUnlock}>افتح التجربة المقفلة</button>
));

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  axios.get.mockResolvedValue({ data: { data: [], total: 0, hasMore: false } });
  fetchSubscriptionState.mockResolvedValue({ state: "FREE", planId: "" });
});

const openLockedExperience = async () => {
  axios.get.mockResolvedValue({ data: {
    data: [{ _id: "exp-1", title: "تجربة تدريب", organizationName: "جهة اختبار", city: "riyadh", major: "تقنية المعلومات" }],
    total: 1,
    hasMore: false,
  } });
  requestPremiumAccess.mockImplementation((detail) => detail.onLimited?.({ reason: "daily_limit" }));
  await act(async () => { render(<ExperiencesPage />); });
  fireEvent.click(await screen.findByRole("button", { name: "عرض التفاصيل" }));
  await screen.findByRole("button", { name: "افتح التجربة المقفلة" });
  fireEvent.click(screen.getByRole("button", { name: "افتح التجربة المقفلة" }));
};

test("expired locked experience enters renewal checkout on the first click", async () => {
  fetchSubscriptionState.mockResolvedValue({ state: "EXPIRED", planId: "darbak_resume" });
  await openLockedExperience();
  await waitFor(() => expect(startSubscriptionFlow).toHaveBeenCalledWith({
    planId: "darbak_resume",
    source: "experience_inline_renewal",
    returnTo: "/experiences?city=riyadh",
    navigate: mockNavigate,
  }));
});

test("free locked experience enters the existing plus checkout", async () => {
  await openLockedExperience();
  await waitFor(() => expect(startSubscriptionFlow).toHaveBeenCalledWith({
    planId: "darbak_plus",
    source: "experience_inline_notice",
    returnTo: "/experiences?city=riyadh",
    navigate: mockNavigate,
  }));
});

test("active locked experience retries access without opening checkout", async () => {
  fetchSubscriptionState.mockResolvedValue({ state: "ACTIVE", planId: "darbak_plus" });
  await openLockedExperience();
  await waitFor(() => expect(requestPremiumAccess).toHaveBeenCalledTimes(2));
  expect(startSubscriptionFlow).not.toHaveBeenCalled();
});

test("locked experience does not guess a plan when state lookup fails", async () => {
  fetchSubscriptionState.mockRejectedValue(new Error("State unavailable"));
  await openLockedExperience();
  await waitFor(() => expect(screen.getByText("تعذر تحديد حالة الاشتراك الآن. حاول مرة أخرى.")).toBeTruthy());
  expect(startSubscriptionFlow).not.toHaveBeenCalled();
});

test("experiences banner enters unified checkout on its first click", async () => {
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
