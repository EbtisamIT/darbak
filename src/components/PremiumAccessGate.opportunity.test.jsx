import React from "react";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import PremiumAccessGate from "./PremiumAccessGate";
import { PREMIUM_ACCESS_EVENT } from "../utils/premiumAccess";

jest.mock("axios", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("../utils/analytics", () => ({ trackEvent: jest.fn(), getVisitorId: () => "test-visitor" }));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  axios.get.mockResolvedValue({ data: {} });
  axios.post.mockResolvedValue({ data: {} });
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
