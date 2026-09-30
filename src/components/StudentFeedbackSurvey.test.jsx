import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter, Link } from "react-router-dom";
import StudentFeedbackSurvey from "./StudentFeedbackSurvey";
import { trackEvent } from "../utils/analytics";
import { SURVEY_DELAY_MS, SURVEY_COOLDOWN_MS, SURVEY_SESSION_KEY, SURVEY_SEEN_KEY, shouldSkipSurvey } from "../utils/studentFeedbackPrompt";

jest.mock("../utils/analytics", () => ({ trackEvent: jest.fn() }));
jest.mock("../utils/premiumAccess", () => ({ getAccessHeaders: () => ({}), PREMIUM_STATUS_EVENT: "test:account-change" }));

function mount(path = "/experiences") {
  return render(<MemoryRouter initialEntries={[path]}>
    <main>
      <Link to="/companies/stc">شركة</Link><Link to="/where-to-train">فرص</Link>
      <Link to="/subscribe">الدفع</Link><Link to="/my-resume/build">بناء السيرة</Link>
      <button type="button">عرض محتوى</button><input aria-label="حقل عادي" />
    </main>
    <StudentFeedbackSurvey />
  </MemoryRouter>);
}
async function tick(ms = 0) {
  await act(async () => { jest.advanceTimersByTime(ms); });
  await act(async () => { jest.advanceTimersByTime(0); });
}
async function openSurvey() {
  fireEvent.click(screen.getByRole("button", { name: "عرض محتوى" }));
  await tick();
  await tick(SURVEY_DELAY_MS);
  expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "false");
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-09-30T10:00:00Z"));
  localStorage.clear(); sessionStorage.clear();
  jest.clearAllMocks();
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

test("survey dismissal controls stay above the existing sticky subscription bar", () => {
  const fs = require("fs");
  const path = require("path");
  const sheetCss = fs.readFileSync(path.join(__dirname, "StudentFeedbackSurvey.css"), "utf8");
  const appCss = fs.readFileSync(path.join(__dirname, "../App.css"), "utf8");
  const layer = (css, selector) => Number(css.match(new RegExp(`${selector}\\s*\\{[^}]*z-index:\\s*(\\d+)`))[1]);
  expect(layer(sheetCss, "\\.student-feedback-sheet-wrap")).toBeGreaterThan(layer(appCss, "\\.subscription-reminder-bar"));
});

test("does not open on mount, three arbitrary field clicks, or time alone", async () => {
  mount();
  for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole("textbox", { name: "حقل عادي" }));
  await tick(SURVEY_DELAY_MS);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "عرض محتوى" }));
  await tick();
  expect(screen.getByText("رأيك اختياري 🤍")).toBeVisible();
  expect(screen.getByText("إذا حاب، شاركنا رأيك 🤍")).toBeVisible();
  expect(screen.getByText("ياخذ أقل من 10 ثواني")).toBeVisible();
  expect(screen.queryByText("ساعدنا نحسن دربك 🤍")).not.toBeInTheDocument();
});

test("close is visible, tracks once, and prevents repeat across refresh/remount", async () => {
  const view = mount(); await openSurvey();
  fireEvent.click(screen.getByRole("button", { name: "إغلاق استبيان الرأي" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trackEvent).toHaveBeenCalledWith("survey_closed", { metadata: { reason: "button" } });
  view.unmount(); mount(); await tick(2 * SURVEY_DELAY_MS);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trackEvent.mock.calls.filter(([name]) => name === "survey_shown")).toHaveLength(1);
});

test("later waits for a new session AND the 24 hour window", async () => {
  let view = mount(); await openSurvey();
  fireEvent.click(screen.getByRole("button", { name: "لاحقًا" }));
  expect(trackEvent).toHaveBeenCalledWith("survey_later", { metadata: { reason: "button" } });
  view.unmount(); sessionStorage.clear(); view = mount();
  await tick(SURVEY_DELAY_MS);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  view.unmount(); await tick(SURVEY_COOLDOWN_MS); sessionStorage.clear(); mount();
  await openSurvey();
});

test("three distinct content pages qualify, with a grace period instead of immediate login prompting", async () => {
  mount();
  fireEvent.click(screen.getByRole("link", { name: "شركة" }));
  fireEvent.click(screen.getByRole("link", { name: "فرص" }));
  await tick(); expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await tick(60000); expect(screen.getByRole("dialog")).toBeVisible();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test.each(["/subscribe", "/checkout", "/payment", "/login", "/my-resume/build", "/my-resume/review", "/my-resume/tailor", "/apply/demo"])("does not prompt during %s", async (path) => {
  expect(shouldSkipSurvey(path)).toBe(true);
  mount(path); fireEvent.click(screen.getByRole("button", { name: "عرض محتوى" }));
  await tick(2 * SURVEY_DELAY_MS);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("navigation stays usable and closes the survey before payment/resume", async () => {
  mount(); await openSurvey();
  fireEvent.click(screen.getByRole("link", { name: "الدفع" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: "فرص" }));
  await tick(SURVEY_DELAY_MS);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("another modal blocks the prompt and newly opened modals dismiss it", async () => {
  mount();
  const modal = document.createElement("div"); modal.setAttribute("role", "dialog"); modal.textContent = "Login";
  document.body.appendChild(modal);
  await tick(SURVEY_DELAY_MS);
  expect(screen.queryByText("رأيك اختياري 🤍")).not.toBeInTheDocument();
  modal.remove(); await tick(); await openSurvey();
  document.body.appendChild(modal); await tick();
  expect(screen.queryByText("رأيك اختياري 🤍")).not.toBeInTheDocument();
  modal.remove(); await tick();
  expect(sessionStorage.getItem(SURVEY_SESSION_KEY)).toBe("closed");
});

test("hidden tab time and login interactions do not qualify", async () => {
  mount(); await tick();
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
  fireEvent(document, new Event("visibilitychange")); await tick(); await tick(SURVEY_DELAY_MS);
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  fireEvent(document, new Event("visibilitychange")); await tick();
  fireEvent.click(screen.getByRole("button", { name: "عرض محتوى" })); await tick();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent(window, new Event("test:account-change")); await tick(); await tick(SURVEY_DELAY_MS);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("submission event requires backend success; failure still allows close", async () => {
  global.fetch.mockResolvedValueOnce({ ok: false });
  mount(); await openSurvey();
  fireEvent.click(screen.getByRole("button", { name: /ممتازة/ }));
  fireEvent.click(screen.getByRole("button", { name: "إرسال رأيي" })); await tick();
  expect(screen.getByRole("alert")).toBeVisible();
  expect(trackEvent.mock.calls.some(([name]) => name === "survey_submitted")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "إرسال رأيي" })); await tick();
  expect(trackEvent.mock.calls.filter(([name]) => name === "survey_submitted")).toHaveLength(1);
  expect(localStorage.getItem(SURVEY_SEEN_KEY)).toBeTruthy();
});

test("closing while request is pending never reopens the survey", async () => {
  let resolve;
  global.fetch.mockImplementation(() => new Promise((done) => { resolve = done; }));
  mount(); await openSurvey();
  fireEvent.click(screen.getByRole("button", { name: /ممتازة/ }));
  fireEvent.click(screen.getByRole("button", { name: "إرسال رأيي" }));
  fireEvent.click(screen.getByRole("button", { name: "إغلاق استبيان الرأي" }));
  await act(async () => { resolve({ ok: true }); });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("storage/analytics failures never block dismissal", async () => {
  mount(); await openSurvey();
  jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("unavailable"); });
  trackEvent.mockImplementationOnce(() => { throw new Error("unavailable"); });
  fireEvent.click(screen.getByRole("button", { name: "إغلاق استبيان الرأي" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
