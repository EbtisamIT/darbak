import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axios from "axios";
import MyApplicationsPage from "./MyApplicationsPage";

jest.mock("axios", () => ({ __esModule: true, default: { get: jest.fn(), patch: jest.fn(), post: jest.fn() } }));
jest.mock("react-router-dom", () => ({ Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a> }));
jest.mock("../utils/analytics", () => ({ trackEvent: jest.fn() }));
jest.mock("../utils/premiumAccess", () => ({ PREMIUM_ACCESS_EVENT: "premium-access", PREMIUM_STATUS_EVENT: "premium-status",
  getAccessHeaders: () => ({ "x-test": "yes" }), getStoredAccessIdentity: () => ({ contact: "student@example.com", accessCode: "1234" }) }));
const date = () => new Date(Date.now() - 4 * 86400000).toISOString();
const external = () => { const appliedAt = date(); return ({ id: "tracker-a", recordType: "tracker", sourceType: "manual", organizationName: "شركة اختبار",
  opportunityTitle: "تدريب تعاوني", city: "الرياض", contactEmail: "jobs@example.com", studentStatus: "applied",
  appliedAt, lastUpdatedAt: appliedAt, organizationLogoUrl: "https://example.com/logo.png", statusHistory: [] }); };
const official = () => ({ id: "company-a", recordType: "darbak", sourceType: "darbak", companyStatus: "under_review",
  organizationName: "جهة مباشرة", submittedAt: date() });
beforeEach(() => { jest.clearAllMocks(); axios.get.mockResolvedValue({ data: { data: [external(), official()] } }); });

test("actual logo and official application remain read-only", async () => {
  render(<MyApplicationsPage />);
  const card = (await screen.findByRole("heading", { name: "شركة اختبار" })).closest("article");
  const company = screen.getByRole("heading", { name: "جهة مباشرة" }).closest("article");
  expect(screen.getByText("تابع طلباتك، آخر تحديث لكل فرصة، والخطوة المطلوبة منك.")).toBeInTheDocument();
  expect(card.querySelector("img")).toHaveAttribute("src", "https://example.com/logo.png");
  expect(card.querySelector(".application-company-mark span")).toHaveAttribute("hidden");
  fireEvent.error(card.querySelector("img"));
  expect(card.querySelector(".application-company-mark span")).not.toHaveAttribute("hidden");
  expect(within(card).getByRole("button", { name: "تحديث التقديم" })).toBeInTheDocument();
  expect(within(company).queryByRole("button", { name: "تحديث التقديم" })).not.toBeInTheDocument();
  fireEvent.click(within(company).getByRole("button", { name: "التفاصيل" }));
  expect(within(screen.getByRole("dialog")).getByText("تم التقديم عبر دربك")).toBeInTheDocument();
  expect(axios.patch).not.toHaveBeenCalled();
});
test("manual external application saves the contact email", async () => {
  axios.get.mockResolvedValue({ data: { data: [] } });
  axios.post.mockResolvedValue({ data: { data: external() } });
  render(<MyApplicationsPage />);
  await screen.findByText("لا توجد تقديمات بعد");
  expect(screen.queryByRole("region", { name: "ملخص التقديمات هذا الشهر" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /أضف فرصة خارج دربك/ }));
  fireEvent.change(screen.getByLabelText("اسم الجهة"), { target: { value: "شركة اختبار" } });
  fireEvent.change(screen.getByLabelText("بريد التواصل لدى الجهة (اختياري)"), { target: { value: "jobs@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "حفظ التقديم" }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/api/application-tracker"),
    expect.objectContaining({ companyName: "شركة اختبار", contactEmail: "jobs@example.com" }), expect.any(Object)));
});
test("external status updates use the existing status route", async () => {
  axios.patch.mockResolvedValue({ data: { data: { ...external(), studentStatus: "interview" } } });
  render(<MyApplicationsPage />);
  const card = (await screen.findByRole("heading", { name: "شركة اختبار" })).closest("article");
  fireEvent.click(within(card).getByRole("button", { name: "تحديث التقديم" }));
  const dialog = screen.getByRole("dialog", { name: "ما آخر تحديث للتقديم؟" });
  expect(within(dialog).getAllByRole("radio")).toHaveLength(5);
  fireEvent.click(within(dialog).getByRole("radio", { name: "مقابلة" }));
  fireEvent.click(within(dialog).getByRole("button", { name: "حفظ التحديث" }));
  await waitFor(() => expect(axios.patch).toHaveBeenCalledWith(expect.stringContaining("/tracker-a/status"),
    expect.objectContaining({ studentStatus: "interview", recordType: "tracker" }), expect.any(Object)));
});
test("follow-up editor uses actual data and persists sent action", async () => {
  axios.patch.mockResolvedValue({ data: { data: { ...external(), followUpSentAt: new Date().toISOString() } } });
  render(<MyApplicationsPage />);
  await screen.findByRole("heading", { name: "شركة اختبار" });
  fireEvent.click(within(screen.getByRole("region", { name: "يتطلب إجراء" })).getByRole("button", { name: "إرسال متابعة" }));
  const dialog = screen.getByRole("dialog", { name: "رسالة متابعة" });
  expect(within(dialog).getByLabelText("عنوان الرسالة")).toHaveValue("متابعة طلب التقديم على تدريب تعاوني");
  expect(within(dialog).getByLabelText("نص الرسالة").value).toContain("شركة اختبار");
  fireEvent.change(within(dialog).getByLabelText("اللغة"), { target: { value: "en" } });
  expect(within(dialog).getByLabelText("نص الرسالة").value).toContain("submitted on");
  fireEvent.click(within(dialog).getByRole("button", { name: "تم الإرسال" }));
  await waitFor(() => expect(axios.patch).toHaveBeenCalledWith(expect.stringContaining("/tracker-a/follow-up"),
    { action: "sent" }, expect.any(Object)));
});
test("snooze persists and logo falls back only when absent", async () => {
  const item = { ...external(), organizationLogoUrl: "" };
  axios.get.mockResolvedValue({ data: { data: [item] } });
  axios.patch.mockResolvedValue({ data: { data: { ...item, followUpSnoozedUntil: new Date(Date.now() + 3 * 86400000).toISOString() } } });
  render(<MyApplicationsPage />);
  const card = (await screen.findByRole("heading", { name: "شركة اختبار" })).closest("article");
  expect(within(card).queryByRole("img")).not.toBeInTheDocument();
  expect(within(card).getByText("ش")).toBeInTheDocument();
  fireEvent.click(within(card).getByRole("button", { name: "التفاصيل" }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "تفاصيل التقديم" })).getByRole("button", { name: "تذكيري بعد 3 أيام" }));
  await waitFor(() => expect(axios.patch).toHaveBeenCalledWith(expect.stringContaining("/tracker-a/follow-up"),
    { action: "snooze" }, expect.any(Object)));
});
test("the action card leads the journey and keeps other actions in a disclosure", async () => {
  const second = { ...external(), id: "tracker-b", organizationName: "جهة أخرى" };
  axios.get.mockResolvedValue({ data: { data: [external(), second, official()] } });
  render(<MyApplicationsPage />);
  const actionSection = await screen.findByRole("region", { name: "يتطلب إجراء" });
  const summary = screen.getByRole("region", { name: "ملخص التقديمات هذا الشهر" });
  expect(actionSection.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(within(actionSection).getAllByText(/لم يصلك تحديث من/)).toHaveLength(1);
  expect(within(actionSection).getByRole("button", { name: "تحديث الحالة" })).toBeInTheDocument();
  fireEvent.click(within(actionSection).getByRole("button", { name: "+ 1 إجراءات أخرى" }));
  expect(within(actionSection).getAllByText(/لم يصلك تحديث من/)).toHaveLength(2);
});
test("journey filters actual applications and the feed remains compact", async () => {
  const waiting = { ...external(), appliedAt: new Date().toISOString(), lastUpdatedAt: new Date().toISOString(), contactEmail: "" };
  const interview = { ...official(), id: "company-b", organizationName: "جهة مقابلة", companyStatus: "interview", submittedAt: new Date().toISOString() };
  axios.get.mockResolvedValue({ data: { data: [waiting, interview] } });
  render(<MyApplicationsPage />);
  const summary = await screen.findByRole("region", { name: "ملخص التقديمات هذا الشهر" });
  expect(within(summary).getByRole("button", { name: /الكل 2/ })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(within(summary).getByRole("button", { name: /مقابلة 1/ }));
  expect(screen.getByRole("heading", { name: "مقابلة" })).toBeInTheDocument();
  expect(screen.getAllByRole("article")).toHaveLength(1);
  expect(screen.getByRole("heading", { name: "جهة مقابلة" })).toBeInTheDocument();
  fireEvent.click(within(summary).getByRole("button", { name: /الكل 2/ }));
  expect(screen.getByRole("heading", { name: "تقديماتك" })).toBeInTheDocument();
  expect(screen.getAllByRole("article")).toHaveLength(2);
  const externalCard = screen.getByRole("heading", { name: "شركة اختبار" }).closest("article");
  expect(within(externalCard).queryByRole("button", { name: "إرسال متابعة" })).not.toBeInTheDocument();
  expect(within(externalCard).getByRole("button", { name: "تحديث التقديم" })).toBeInTheDocument();
});
test("the guide remains available without a floating page control", async () => {
  const onOpen = jest.fn();
  window.addEventListener("darbak:open-smart-assistant", onOpen);
  render(<MyApplicationsPage />);
  fireEvent.click(await screen.findByRole("button", { name: "دليل دربك" }));
  expect(onOpen).toHaveBeenCalledTimes(1);
  window.removeEventListener("darbak:open-smart-assistant", onOpen);
});
