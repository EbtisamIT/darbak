import React from "react";
import { act, render, screen } from "@testing-library/react";
import axios from "axios";
import AccountModal from "./AccountModal";

jest.mock("axios", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("react-router-dom", () => ({
  Link: ({ to, children, ...props }) => require("react").createElement("a", { href: to, ...props }, children),
}));
jest.mock("../utils/analytics", () => ({ trackEvent: jest.fn() }));
jest.mock("../utils/premiumAccess", () => ({
  ACCOUNT_MODAL_EVENT: "darbak:open-account",
  PREMIUM_ACCESS_EVENT: "darbak:premium-access",
  clearAccessSession: jest.fn(),
  fetchSubscriptionState: jest.fn(async () => ({ state: "FREE", planId: "", expiresAt: null })),
  getStoredAccessIdentity: () => ({ contact: "student@example.com", accessCode: "ABCD1234" }),
  getStoredPremiumPass: () => null,
  isPremiumGateEnabled: () => false,
  saveAccessIdentity: jest.fn(),
  savePremiumPass: jest.fn(),
}));

test("approved experience reward appears in account without a subscription", async () => {
  axios.get.mockResolvedValue({ data: { reward: { status: "available" } } });
  render(<AccountModal />);
  await act(async () => window.dispatchEvent(new CustomEvent("darbak:open-account")));
  expect(await screen.findByText("مكافأتك جاهزة")).toBeInTheDocument();
  expect(screen.getByText("إنشاء سيرتي الذاتية").closest("a")).toHaveAttribute("href", "/rewards/resume");
  expect(screen.getByText("حساب مجاني")).toBeInTheDocument();
});
