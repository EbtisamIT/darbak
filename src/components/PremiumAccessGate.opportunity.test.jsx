import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import PremiumAccessGate from "./PremiumAccessGate";
import { PREMIUM_ACCESS_EVENT } from "../utils/premiumAccess";

jest.mock("axios", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("../utils/analytics", () => ({ trackEvent: jest.fn(), trackEventOnceLocal: jest.fn(), trackEventOncePerSession: jest.fn(), getVisitorId: () => "test-visitor" }));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState({}, "", "/");
  axios.get.mockResolvedValue({ data: {} });
  axios.post.mockResolvedValue({ data: {} });
});

test("payment return verifies the exact invoice before granting access", async () => {
  localStorage.setItem("darbak_pending_subscription_v1", JSON.stringify({ contact: "qa@example.com", accessCode: "Qa1234", planId: "darbak_plus", invoiceId: "invoice-qa" }));
  window.history.replaceState({}, "", "/?subscription=success");
  axios.post.mockResolvedValue({ data: { active: true, email: "qa@example.com", planId: "darbak_plus", expiresAt: "2099-01-01" } });
  render(<MemoryRouter><PremiumAccessGate /></MemoryRouter>);
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
    expect.stringContaining("/api/subscriptions/verify"),
    expect.objectContaining({ invoiceId: "invoice-qa" })
  ));
  expect(JSON.parse(localStorage.getItem("darbak_premium_pass_v1")).planId).toBe("darbak_plus");
});

test("server denied opportunity can request sign-in despite a cached pass and disabled frontend gate", async () => {
  localStorage.setItem("darbak_premium_pass_v1", JSON.stringify({ expiresAt: "2099-01-01", planId: "darbak_plus", entitlements: ["darbak_plus"] }));
  const resume = jest.fn();
  render(<MemoryRouter><PremiumAccessGate /></MemoryRouter>);
  await act(async () => {});
  act(() => window.dispatchEvent(new CustomEvent(PREMIUM_ACCESS_EVENT, {
    detail: { feature: "opportunity_apply", defaultPlanId: "darbak_plus", loginOnly: true, accessStatus: { granted: false, reason: "daily_limit" }, onGranted: resume },
  })));
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(screen.getByText("تسجيل الدخول إلى دربك+")).toBeTruthy();
  expect(resume).not.toHaveBeenCalled();
});

test("server denied guest receives the existing limit notice even if frontend gating is off", async () => {
  render(<MemoryRouter><PremiumAccessGate /></MemoryRouter>);
  await act(async () => {});
  act(() => window.dispatchEvent(new CustomEvent(PREMIUM_ACCESS_EVENT, {
    detail: { feature: "opportunity_apply", itemKey: "opportunity:one", defaultPlanId: "darbak_plus", accessStatus: { granted: false, reason: "daily_limit" } },
  })));
  expect(document.querySelector(".subscription-limit-gate, .subscription-reminder, .premium-access-overlay, .subscription-reminder-overlay")).toBeTruthy();
});

test("expired authenticated QA checkout does not ask for email or access code", async () => {
  localStorage.setItem("darbak_access_identity_v1", JSON.stringify({ contact: "qa@example.com", accessCode: "Qa1234" }));
  localStorage.setItem("darbak_premium_pass_v1", JSON.stringify({ planId: "darbak_plus", expiresAt: "2020-01-01T00:00:00Z" }));
  axios.get.mockImplementation((url) => Promise.resolve({ data: url.includes("checkout-canary") ? { enabled: true } : {} }));
  render(<MemoryRouter><PremiumAccessGate /></MemoryRouter>);
  await act(async () => {});
  act(() => window.dispatchEvent(new CustomEvent(PREMIUM_ACCESS_EVENT, {
    detail: { feature: "subscribe_page", defaultPlanId: "darbak_plus", source: "navbar", openCheckout: true },
  })));
  expect(await screen.findByText("اشتراكك سيتفعّل مباشرة على حسابك الحالي بعد إتمام الدفع.")).toBeTruthy();
  expect(screen.queryByText("البريد الإلكتروني")).toBeNull();
  expect(screen.queryByText("رمز الدخول")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "الانتقال للدفع الآمن" }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
    expect.stringContaining("/api/subscriptions/checkout"),
    expect.not.objectContaining({ email: expect.anything(), accessCode: expect.anything() }),
    expect.objectContaining({ headers: expect.objectContaining({ "x-darbak-contact": "qa@example.com" }) })
  ));
});

test("non-QA account keeps the legacy identity form and checkout route", async () => {
  localStorage.setItem("darbak_access_identity_v1", JSON.stringify({ contact: "regular@example.com", accessCode: "Darb123" }));
  axios.get.mockImplementation((url) => Promise.resolve({ data: url.includes("checkout-canary") ? { enabled: false } : {} }));
  render(<MemoryRouter><PremiumAccessGate /></MemoryRouter>);
  await act(async () => {});
  act(() => window.dispatchEvent(new CustomEvent(PREMIUM_ACCESS_EVENT, {
    detail: { feature: "subscribe_page", defaultPlanId: "darbak_plus", openCheckout: true },
  })));
  expect(await screen.findByText("البريد الإلكتروني")).toBeTruthy();
  expect(screen.getByText("رمز الدخول")).toBeTruthy();
  fireEvent.change(screen.getByPlaceholderText("example@email.com"), { target: { value: "regular@example.com" } });
  fireEvent.change(screen.getByPlaceholderText("رمز تحفظه"), { target: { value: "Darb123" } });
  fireEvent.click(screen.getByRole("button", { name: "الانتقال للدفع الآمن" }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
    expect.stringContaining("/api/subscriptions/start-checkout"),
    expect.objectContaining({ email: "regular@example.com", accessCode: "Darb123" }),
    expect.anything()
  ));
});
