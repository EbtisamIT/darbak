import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import { pdf } from "@react-pdf/renderer";
import EmailApplicationSheet from "./EmailApplicationSheet";
import { trackEvent } from "../utils/analytics";

jest.mock("axios", () => ({ get: jest.fn().mockResolvedValue({ data: {} }) }));
jest.mock("@react-pdf/renderer", () => ({ pdf: jest.fn(() => ({ toBlob: jest.fn().mockResolvedValue(new Blob(["pdf"])) })) }));
jest.mock("../features/resume/ResumePdfDocument", () => () => null);
jest.mock("../utils/analytics", () => ({ trackEvent: jest.fn(), getVisitorId: jest.fn(() => "visitor") }));

beforeEach(() => {
  window.localStorage.clear();
  jest.clearAllMocks();
  pdf.mockImplementation(() => ({ toBlob: jest.fn().mockResolvedValue(new Blob(["pdf"])) }));
  URL.createObjectURL = jest.fn(() => "blob:resume-pdf");
  URL.revokeObjectURL = jest.fn();
});

test("shows the no-resume reminder without a download control", () => {
  render(<MemoryRouter><EmailApplicationSheet
    opportunity={{ applicationUrl: "mailto:apply@example.com" }}
    hasMasterResume={false} onClose={() => {}} onOpenMail={() => {}}
  /></MemoryRouter>);
  expect(screen.getByText("لا تنسَ إرفاق سيرتك الذاتية قبل الإرسال.")).toBeInTheDocument();
  expect(screen.getByText("لا يستطيع دربك إرفاق الملف تلقائيًا.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "تنزيل السيرة" })).not.toBeInTheDocument();
});

test("downloads the existing master resume through the current PDF renderer", async () => {
  axios.get.mockResolvedValue({ data: { masterResumeExists: true, resume: { personalInfo: { fullName: "طالبة اختبار" } } } });
  const anchorClick = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  render(<MemoryRouter><EmailApplicationSheet
    opportunity={{ applicationUrl: "mailto:apply@example.com" }}
    hasMasterResume onClose={() => {}} onOpenMail={() => {}}
  /></MemoryRouter>);
  expect(screen.getByText("سيرتك جاهزة للإرفاق ✓")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "تنزيل السيرة" }));
  await waitFor(() => expect(anchorClick).toHaveBeenCalledTimes(1));
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/api/resume/me"), expect.anything());
  expect(pdf).toHaveBeenCalledTimes(1);
  anchorClick.mockRestore();
});

test("downloads a redeemed reward's existing PDF without regenerating it", async () => {
  window.localStorage.setItem("darbak_access_identity_v1", JSON.stringify({ contact: "qa@example.com", accessCode: "test-code" }));
  axios.get.mockImplementation((url) => Promise.resolve({ data: url.endsWith("/api/rewards/resume/me")
    ? { reward: { status: "redeemed" } } : new Blob(["saved-pdf"]) }));
  const anchorClick = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  render(<MemoryRouter><EmailApplicationSheet
    opportunity={{ applicationUrl: "mailto:apply@example.com" }}
    hasMasterResume={false} onClose={() => {}} onOpenMail={() => {}}
  /></MemoryRouter>);
  const download = await screen.findByRole("button", { name: "تنزيل السيرة" });
  fireEvent.click(download);
  await waitFor(() => expect(anchorClick).toHaveBeenCalledTimes(1));
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/api/rewards/resume/pdf"), expect.objectContaining({ responseType: "blob" }));
  expect(pdf).not.toHaveBeenCalled();
  anchorClick.mockRestore();
});

test("copy controls copy address and edited message without opening mail", async () => {
  const writeText = jest.fn().mockResolvedValue();
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  const onOpenMail = jest.fn();
  render(<MemoryRouter><EmailApplicationSheet
    opportunity={{ _id: "opp-1", title: "متدرب", organizationName: "شركة ألف", applicationUrl: "mailto:apply@example.com" }}
    hasMasterResume={false} onClose={() => {}} onOpenMail={onOpenMail}
  /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "نسخ البريد" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith("apply@example.com"));
  fireEvent.change(screen.getByRole("textbox", { name: "رسالة مقترحة" }), { target: { value: "رسالة الطالب المعدلة" } });
  fireEvent.click(screen.getByRole("button", { name: "نسخ الرسالة" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith("رسالة الطالب المعدلة"));
  expect(onOpenMail).not.toHaveBeenCalled();
  expect(trackEvent).toHaveBeenCalledWith("email_address_copied", expect.anything());
  expect(trackEvent).toHaveBeenCalledWith("email_message_copied", expect.anything());
  expect(JSON.stringify(trackEvent.mock.calls)).not.toContain("رسالة الطالب المعدلة");
});
