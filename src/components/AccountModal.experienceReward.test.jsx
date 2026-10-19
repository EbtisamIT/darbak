import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

beforeEach(() => { jest.clearAllMocks(); axios.post.mockResolvedValue({ data: { acknowledged: true } }); });

test("approved reward shows once, dismiss keeps the account card and CTA without subscription", async () => {
  axios.get.mockResolvedValue({ data: { reward: { id: "reward-1", status: "available", v11Enabled: true, announcementSeenAt: null } } });
  render(<AccountModal />);
  expect(await screen.findByText("🎉 مبروك! تم اعتماد تجربتك")).toBeInTheDocument();
  expect(screen.getByText("هديتك جاهزة: سيرة ذاتية احترافية مجانًا بقالب Darbak ATS.")).toBeInTheDocument();
  expect(screen.getByText("بنرتب خبرتك ومهاراتك ومشاريعك ونجهزها لك بشكل مناسب للتقديم.")).toBeInTheDocument();
  fireEvent.click(screen.getByText("لاحقًا"));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("announcement-seen"),
    {}, expect.any(Object)));
  expect(screen.queryByText("🎉 مبروك! تم اعتماد تجربتك")).not.toBeInTheDocument();
  await act(async () => window.dispatchEvent(new CustomEvent("darbak:open-account")));
  expect(await screen.findByText("🎁 هديتك جاهزة")).toBeInTheDocument();
  expect(screen.getByText("ابدأ الآن").closest("a")).toHaveAttribute("href", "/rewards/resume");
  expect(screen.getByText("حساب مجاني")).toBeInTheDocument();
});

test("already announced reward does not reopen automatically", async () => {
  axios.get.mockResolvedValue({ data: { reward: { id: "reward-1", status: "available", v11Enabled: true, announcementSeenAt: "2026-10-18" } } });
  render(<AccountModal />);
  await waitFor(() => expect(axios.get).toHaveBeenCalled());
  expect(screen.queryByText("🎉 مبروك! تم اعتماد تجربتك")).not.toBeInTheDocument();
  await act(async () => window.dispatchEvent(new CustomEvent("darbak:open-account")));
  expect(await screen.findByText("🎁 هديتك جاهزة")).toBeInTheDocument();
});

test("non-QA users retain the V1 account card and do not see the V1.1 popup", async () => {
  axios.get.mockResolvedValue({ data: { reward: { id: "reward-1", status: "available",
    v11Enabled: false, announcementSeenAt: null } } });
  render(<AccountModal />);
  await waitFor(() => expect(axios.get).toHaveBeenCalled());
  expect(screen.queryByText("🎉 مبروك! تم اعتماد تجربتك")).not.toBeInTheDocument();
  await act(async () => window.dispatchEvent(new CustomEvent("darbak:open-account")));
  expect(await screen.findByText("مكافأتك جاهزة")).toBeInTheDocument();
});

test("saved available draft says continue instead of starting over", async () => {
  axios.get.mockResolvedValue({ data: { reward: { id: "reward-1", status: "available", v11Enabled: true,
    hasDraft: true, announcementSeenAt: "2026-10-18" } } });
  render(<AccountModal />);
  await act(async () => window.dispatchEvent(new CustomEvent("darbak:open-account")));
  expect(await screen.findByText("أكمل سيرتي")).toHaveAttribute("href", "/rewards/resume");
});

test("redeemed reward keeps a permanent card with view and saved PDF download", async () => {
  axios.get.mockResolvedValue({ data: { reward: { id: "reward-1", status: "redeemed", v11Enabled: true, language: "ar",
    redeemedAt: "2026-10-18T12:00:00.000Z", announcementSeenAt: null } } });
  render(<AccountModal />);
  await act(async () => window.dispatchEvent(new CustomEvent("darbak:open-account")));
  expect(await screen.findByText("سيرتي المجانية")).toBeInTheDocument();
  expect(screen.getByText("Darbak ATS Classic · العربية")).toBeInTheDocument();
  expect(screen.getByText("تم إنشاؤها", { exact: false })).toBeInTheDocument();
  expect(screen.getByText("عرض السيرة").closest("a")).toHaveAttribute("href", "/rewards/resume");
  expect(screen.getByText("تنزيل PDF")).toBeInTheDocument();
  expect(screen.queryByText("مبروك! تم اعتماد تجربتك", { exact: false })).not.toBeInTheDocument();
});

test("account download reads the existing PDF endpoint without generating a resume", async () => {
  const finalPdf = new Blob(["saved-pdf"], { type: "application/pdf" });
  axios.get.mockImplementation(async (url) => url.endsWith("/pdf")
    ? { data: finalPdf } : { data: { reward: { id: "reward-1", status: "redeemed", v11Enabled: true, language: "ar" } } });
  URL.createObjectURL = jest.fn(() => "blob:saved-pdf");
  URL.revokeObjectURL = jest.fn();
  jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  render(<AccountModal />);
  await act(async () => window.dispatchEvent(new CustomEvent("darbak:open-account")));
  fireEvent.click(await screen.findByText("تنزيل PDF"));
  await waitFor(() => expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/api/rewards/resume/pdf"),
    expect.objectContaining({ responseType: "blob" })));
  expect(axios.post).not.toHaveBeenCalled();
});

test("lifecycle question saves a one-time choice without changing account access", async () => {
  let dismissed = false;
  axios.get.mockImplementation(async (url) => url.endsWith("/api/account/free-session")
    ? { data: { account: { lifecycleStage: dismissed ? "student" : "unknown",
      lifecyclePromptDismissedAt: dismissed ? "2026-10-19T00:00:00Z" : null } } }
    : { data: { reward: null } });
  axios.post.mockImplementation(async (url, body) => {
    if (url.endsWith("/api/account/lifecycle-stage")) {
      expect(body).toEqual({ lifecycleStage: "student" });
      dismissed = true;
    }
    return { data: { ok: true } };
  });
  render(<AccountModal />);
  await act(async () => window.dispatchEvent(new CustomEvent("darbak:open-account")));
  fireEvent.click(await screen.findByRole("button", { name: "طالب جامعي" }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
    expect.stringContaining("/api/account/lifecycle-stage"), { lifecycleStage: "student" }, expect.any(Object)));
  await act(async () => window.dispatchEvent(new CustomEvent("darbak:open-account")));
  await waitFor(() => expect(axios.get.mock.calls.filter(([url]) => url.endsWith("/api/account/free-session"))).toHaveLength(2));
  expect(screen.queryByRole("button", { name: "طالب جامعي" })).not.toBeInTheDocument();
  expect(screen.getByText("حساب مجاني")).toBeInTheDocument();
});
