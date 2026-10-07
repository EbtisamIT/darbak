import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
const originalFetch = global.fetch;
beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  global.fetch = jest.fn().mockResolvedValue({ json: async () => ({}) });
  axios.get.mockResolvedValue({ data: { data: [], total: 0, hasMore: false } });
  fetchSubscriptionState.mockResolvedValue({ state: "FREE", planId: "" });
});
afterEach(() => { global.fetch = originalFetch; });

const openLockedExperience = async () => {
  axios.get.mockResolvedValue({ data: {
    data: [{ _id: "exp-1", title: "تجربة تدريب", organizationName: "جهة اختبار", city: "riyadh", major: "تقنية المعلومات" }],
    total: 1,
    hasMore: false,
  } });
  requestPremiumAccess.mockImplementation((detail) => detail.onLimited?.({ reason: "daily_limit" }));
  let view;
  await act(async () => { view = render(<ExperiencesPage />); });
  fireEvent.click(await screen.findByRole("button", { name: "عرض التفاصيل" }));
  const notice = await waitFor(() => document.querySelector(".premium-inline-notice"));
  return { view, cta: () => within(notice).getByRole("button", { name: /كمل استكشافك|جارِ فتح الاشتراك|تعذر الاتصال/ }) };
};

test("expired locked experience enters renewal checkout on the first click", async () => {
  fetchSubscriptionState.mockResolvedValue({ state: "EXPIRED", planId: "darbak_resume" });
  const { cta } = await openLockedExperience();
  fireEvent.click(cta());
  await waitFor(() => expect(startSubscriptionFlow).toHaveBeenCalledWith({
    planId: "darbak_resume",
    source: "experience_inline_renewal",
    returnTo: "/experiences?city=riyadh",
    navigate: mockNavigate,
  }));
  expect(startSubscriptionFlow).toHaveBeenCalledTimes(1);
});

test.each(["qa", "all"])("free locked experience enters plus checkout in %s mode", async (mode) => {
  fetchSubscriptionState.mockResolvedValue({ state: "FREE", planId: "", checkoutMode: mode });
  const { cta } = await openLockedExperience();
  fireEvent.click(cta());
  await waitFor(() => expect(startSubscriptionFlow).toHaveBeenCalledWith({
    planId: "darbak_plus",
    source: "experience_inline_notice",
    returnTo: "/experiences?city=riyadh",
    navigate: mockNavigate,
  }));
  expect(startSubscriptionFlow).toHaveBeenCalledTimes(1);
});

test("active locked experience retries access without opening checkout", async () => {
  fetchSubscriptionState.mockResolvedValue({ state: "ACTIVE", planId: "darbak_plus" });
  const { cta } = await openLockedExperience();
  fireEvent.click(cta());
  await waitFor(() => expect(requestPremiumAccess).toHaveBeenCalledTimes(2));
  expect(startSubscriptionFlow).not.toHaveBeenCalled();
});

test("locked experience shows retry when both state lookups fail", async () => {
  fetchSubscriptionState.mockRejectedValue(new Error("State unavailable"));
  const { cta } = await openLockedExperience();
  fireEvent.click(cta());
  await waitFor(() => expect(cta().textContent).toBe("تعذر الاتصال، حاول مرة أخرى"));
  expect(startSubscriptionFlow).not.toHaveBeenCalled();
});

test("first click survives a transient state lookup failure", async () => {
  fetchSubscriptionState
    .mockRejectedValueOnce(new Error("temporary error"))
    .mockResolvedValueOnce({ state: "FREE", planId: "" });
  const { cta } = await openLockedExperience();
  fireEvent.click(cta());
  await waitFor(() => expect(startSubscriptionFlow).toHaveBeenCalledTimes(1));
  expect(fetchSubscriptionState).toHaveBeenCalledTimes(2);
});

test("double click while lookup is pending starts one checkout", async () => {
  let resolveState;
  fetchSubscriptionState.mockReturnValue(new Promise((resolve) => { resolveState = resolve; }));
  const { cta } = await openLockedExperience();
  fireEvent.click(cta());
  expect(cta().textContent).toBe("جارِ فتح الاشتراك...");
  fireEvent.click(cta());
  expect(fetchSubscriptionState).toHaveBeenCalledTimes(1);
  await act(async () => resolveState({ state: "FREE", planId: "" }));
  expect(startSubscriptionFlow).toHaveBeenCalledTimes(1);
  fireEvent.click(cta());
  expect(startSubscriptionFlow).toHaveBeenCalledTimes(1);
});

test("retry after a failed lookup opens checkout once", async () => {
  fetchSubscriptionState
    .mockRejectedValueOnce(new Error("temporary error"))
    .mockRejectedValueOnce(new Error("temporary error"))
    .mockResolvedValueOnce({ state: "EXPIRED", planId: "darbak_plus" });
  const { cta } = await openLockedExperience();
  fireEvent.click(cta());
  await waitFor(() => expect(cta().textContent).toBe("تعذر الاتصال، حاول مرة أخرى"));
  fireEvent.click(cta());
  await waitFor(() => expect(startSubscriptionFlow).toHaveBeenCalledTimes(1));
});

test("checkout remains available after closing and returning to the locked experience", async () => {
  const first = await openLockedExperience();
  fireEvent.click(first.cta());
  await waitFor(() => expect(startSubscriptionFlow).toHaveBeenCalledTimes(1));
  first.view.unmount();
  const second = await openLockedExperience();
  fireEvent.click(second.cta());
  await waitFor(() => expect(startSubscriptionFlow).toHaveBeenCalledTimes(2));
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
