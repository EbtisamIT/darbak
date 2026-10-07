import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AccountModal from "./AccountModal";
import {
  ACCOUNT_MODAL_EVENT,
  fetchSubscriptionState,
  getStoredPremiumPass,
  startSubscriptionFlow,
} from "../utils/premiumAccess";

jest.mock("axios", () => ({ __esModule: true, default: { post: jest.fn() } }));
jest.mock("../utils/analytics", () => ({ trackEvent: jest.fn() }));
jest.mock("../utils/premiumAccess", () => ({
  ACCOUNT_MODAL_EVENT: "darbak:open-account",
  clearAccessSession: jest.fn(),
  fetchSubscriptionState: jest.fn(),
  getStoredAccessIdentity: () => ({ contact: "qa@example.com", accessCode: "Qa1234" }),
  getStoredPremiumPass: jest.fn(() => null),
  isPremiumGateEnabled: () => true,
  saveAccessIdentity: jest.fn(),
  savePremiumPass: jest.fn(),
  startSubscriptionFlow: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  getStoredPremiumPass.mockReturnValue(null);
});

const openAccount = () => {
  render(<MemoryRouter><AccountModal /></MemoryRouter>);
  act(() => window.dispatchEvent(new Event(ACCOUNT_MODAL_EVENT)));
};

test("expired account shows renewal and skips the identity form", async () => {
  fetchSubscriptionState.mockResolvedValue({
    state: "EXPIRED", planId: "darbak_plus", expiresAt: "2026-10-01T00:00:00Z",
  });
  openAccount();
  expect(await screen.findByText("اشتراكك منتهي")).toBeTruthy();
  expect(screen.queryByRole("textbox", { name: "البريد الإلكتروني أو رقم جوال لحساب سابق" })).toBeNull();
  expect(screen.queryByRole("textbox", { name: "رمز الدخول" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "تجديد الاشتراك" }));
  expect(startSubscriptionFlow).toHaveBeenCalledWith({ planId: "darbak_plus", source: "account_renewal" });
});

test("free account keeps the normal subscription entry", async () => {
  fetchSubscriptionState.mockResolvedValue({ state: "FREE", planId: "", expiresAt: null });
  openAccount();
  await waitFor(() => expect(screen.getByRole("button", { name: "تجديد أو تفعيل دربك+" })).toBeTruthy());
});

test("active account keeps its paid state", async () => {
  getStoredPremiumPass.mockReturnValue({
    accessType: "premium", planId: "darbak_plus", expiresAt: "2099-01-01T00:00:00Z",
  });
  fetchSubscriptionState.mockResolvedValue({
    state: "ACTIVE", planId: "darbak_plus", expiresAt: "2099-01-01T00:00:00Z",
  });
  openAccount();
  expect(await screen.findByText("دربك+ فعال")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "تجديد الاشتراك" })).toBeNull();
});

test("account does not briefly label an unknown subscription as free", () => {
  fetchSubscriptionState.mockReturnValue(new Promise(() => {}));
  openAccount();
  expect(screen.getByText("جارِ التحقق من الاشتراك")).toBeTruthy();
  expect(screen.queryByText("حساب مجاني")).toBeNull();
});
