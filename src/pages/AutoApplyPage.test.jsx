import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import AutoApplyPage from "./AutoApplyPage";

jest.mock("axios", () => ({ get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() }));
jest.mock("@react-pdf/renderer", () => ({ pdf: jest.fn() }));
jest.mock("../utils/premiumAccess", () => ({
  ACCOUNT_MODAL_EVENT: "darbak:open-account",
  getStoredAccessIdentity: () => ({ contact: "qa@example.test", accessCode: "123456" }),
}));
jest.mock("../features/resume/ResumePdfDocument", () => () => null);

const profile = { educationLevel: "bachelor", major: "نظم المعلومات", preferredFields: ["تحليل البيانات"],
  preferredCities: ["الرياض"], resumeSource: "uploaded", resumeSnapshotId: "asset-1", mode: "review_first", paused: false };
const match = { targetKey: "company:1:evergreen_training", company: "جهة اختبار", title: "تقديم تدريب عام", cities: ["الرياض"],
  applicationMethod: "email", eligibility: "eligible", matchedFields: ["تحليل البيانات"], reasons: ["مدينة التدريب ضمن مدنك المختارة"], blockers: [] };
const packageItem = { _id: "package-1", ...match, status: "ready_for_review", subject: "طلب تدريب تعاوني", body: "رسالة خاصة للجهة",
  matchReasons: match.reasons, resumeSnapshotId: "asset-1", originalTargetEmail: "training@company.example",
  resumeFilename: "student-cv.pdf" };

beforeEach(() => {
  axios.get.mockImplementation((url) => {
    if (url.endsWith("/me")) return Promise.resolve({ data: { profile, packages: [packageItem], fields: { "نظم المعلومات": ["تحليل البيانات"] } } });
    if (url.endsWith("/matches")) return Promise.resolve({ data: { matches: [match] } });
    if (url.endsWith("/existing-resume")) return Promise.resolve({ data: { rewardResumeAvailable: false } });
    return Promise.reject(new Error("Unexpected API request"));
  });
  axios.patch.mockResolvedValue({ data: { package: { ...packageItem, status: "approved" }, sent: 0 } });
  axios.post.mockResolvedValue({ data: {} });
  axios.delete.mockResolvedValue({ data: { provider: "gmail", connectionStatus: "not_connected", emailAddress: "" } });
});

test("reviews the real package and explicitly sends only to the server-selected test recipient", async () => {
  axios.get.mockImplementation((url) => {
    if (url.endsWith("/me")) return Promise.resolve({ data: { profile, packages: [packageItem],
      fields: { "نظم المعلومات": ["تحليل البيانات"] },
      emailIdentity: { provider: "gmail", connectionStatus: "connected", emailAddress: "student@gmail.com" },
      testMode: { enabled: true, recipient: "developer@example.test" } } });
    if (url.endsWith("/matches")) return Promise.resolve({ data: { matches: [match] } });
    if (url.endsWith("/existing-resume")) return Promise.resolve({ data: { rewardResumeAvailable: false } });
    return Promise.reject(new Error("Unexpected API request"));
  });
  axios.post.mockResolvedValueOnce({ data: { ok: true, senderEmail: "student@gmail.com",
    testRecipient: "developer@example.test", sentAt: "2026-11-13T20:00:00.000Z" } });
  render(<AutoApplyPage />);
  fireEvent.click(await screen.findByRole("button", { name: "مراجعة الرسالة" }));
  expect(screen.getByText("وضع اختبار")).toBeInTheDocument();
  expect(screen.getByText("لن تُرسل الرسالة إلى الجهة.")).toBeInTheDocument();
  expect(screen.getByText("developer@example.test")).toBeInTheDocument();
  expect(screen.getByText("training@company.example")).toBeInTheDocument();
  expect(screen.getByText("student-cv.pdf")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "إرسال اختبار" }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/packages/package-1/test-send"),
    { subject: "طلب تدريب تعاوني", body: "رسالة خاصة للجهة" }, expect.any(Object)));
  expect(await screen.findByText("تم إرسال النسخة التجريبية بنجاح ✓")).toBeInTheDocument();
  expect(screen.getByText("لم يتم التواصل مع الجهة.")).toBeInTheDocument();
});

test("shows the connected Gmail identity without tokens and disconnects it", async () => {
  let connected = true;
  axios.get.mockImplementation((url) => {
    if (url.endsWith("/me")) return Promise.resolve({ data: { profile, packages: [], fields: {},
      emailIdentity: connected
        ? { provider: "gmail", connectionStatus: "connected", emailAddress: "student@gmail.com" }
        : { provider: "gmail", connectionStatus: "not_connected", emailAddress: "" } } });
    if (url.endsWith("/matches")) return Promise.resolve({ data: { matches: [] } });
    if (url.endsWith("/existing-resume")) return Promise.resolve({ data: { rewardResumeAvailable: false } });
    return Promise.reject(new Error("Unexpected API request"));
  });
  axios.delete.mockImplementation(() => {
    connected = false;
    return Promise.resolve({ data: { provider: "gmail", connectionStatus: "not_connected", emailAddress: "" } });
  });
  render(<AutoApplyPage />);
  expect(await screen.findByText("Gmail متصل ✓")).toBeInTheDocument();
  expect(screen.getByText("student@gmail.com")).toBeInTheDocument();
  expect(screen.queryByText(/token/i)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "فصل الاتصال" }));
  await waitFor(() => expect(axios.delete).toHaveBeenCalledWith(expect.stringContaining("/email/gmail"), expect.any(Object)));
  expect(await screen.findByRole("button", { name: "ربط Gmail" })).toBeInTheDocument();
});

test("shows setup, verified match reasons, a base CV, and a review-first draft without sending", async () => {
  render(<AutoApplyPage />);
  expect(await screen.findByText(/الوضع التجريبي: لا تُرسل رسائل/)).toBeInTheDocument();
  expect(screen.getByText("مجالات التدريب التي تهمك")).toBeInTheDocument();
  expect(screen.getByText(/السيرة المختارة: PDF مرفوع/)).toBeInTheDocument();
  expect(screen.getByText("مطابقة موثقة")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "مراجعة الرسالة" }));
  expect(screen.getByRole("dialog", { name: "مراجعة طلب التقديم" })).toBeInTheDocument();
  expect(screen.getByDisplayValue("رسالة خاصة للجهة")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "موافقة تجريبية" }));
  await waitFor(() => expect(axios.patch).toHaveBeenCalledWith(expect.stringContaining("package-1"),
    expect.objectContaining({ action: "approve" }), expect.any(Object)));
  expect(axios.post).not.toHaveBeenCalled();
});

test("claims a returning Gmail link with this browser's own login and clears it from the address bar", async () => {
  const linkCode = "a".repeat(43);
  window.history.replaceState(null, "", `/auto-apply#gmail_link=${linkCode}`);
  axios.post.mockResolvedValueOnce({ data: { provider: "gmail", connectionStatus: "connected", emailAddress: "student@gmail.com" } });
  render(<AutoApplyPage />);
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/api/auto-apply/email/gmail/complete"),
    { linkCode }, { headers: expect.objectContaining({ "x-darbak-contact": "qa@example.test", "x-darbak-access-code": "123456" }) }));
  expect(window.location.hash).toBe("");
  expect(await screen.findByText("تم ربط Gmail بحسابك.")).toBeInTheDocument();
});

test("shows the server reason when a Gmail link belongs to another Darbak account", async () => {
  window.history.replaceState(null, "", `/auto-apply#gmail_link=${"b".repeat(43)}`);
  axios.post.mockRejectedValueOnce({ response: { data: { error: "بدأ ربط Gmail من حساب دربك مختلف، فلم نربطه بحسابك. ابدأ الربط من حسابك أنت." } } });
  render(<AutoApplyPage />);
  expect(await screen.findByText("بدأ ربط Gmail من حساب دربك مختلف، فلم نربطه بحسابك. ابدأ الربط من حسابك أنت.")).toBeInTheDocument();
  expect(window.location.hash).toBe("");
});
