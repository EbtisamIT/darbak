import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import axios from "axios";
import MyResumePage from "./MyResumePage";
import * as isolation from "../features/resume/resumeLanguageIsolation";

jest.mock("axios", () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn() }));
jest.mock("@react-pdf/renderer", () => ({ pdf: jest.fn() }));
jest.mock("../features/resume/ResumePdfDocument", () => () => null);
jest.mock("../features/resume/ResumeAgentFlow", () => ({ __esModule: true, default: () => null, getAgentSessionStorageKey: () => "test" }));
jest.mock("../features/resume/ResumeBuilder", () => ({ __esModule: true, default: () => null, SettingsEditor: () => null }));
jest.mock("../features/resume/ResumePreview", () => ({ resume }) => <pre data-testid="preview">{JSON.stringify(resume)}</pre>);
jest.mock("../features/resume/ResumeJobMatchPanel", () => () => null);
jest.mock("../features/resume/ResumeDashboard", () => () => null);
jest.mock("../features/resume/ResumeFactsReviewJourney", () => () => <div>source review</div>);
jest.mock("../features/resume/ResumeSetupJourney", () => () => null);
jest.mock("../features/resume/ResumeDataSimpleForm", () => () => null);
jest.mock("../features/resume/ApplicationPackPanel", () => () => null);
jest.mock("../features/resume/resumeLocalization", () => ({ getEnglishPdfValidation: () => ({ valid: true }), getEnglishReviewItems: () => [] }));
// Exercise the preserved translation success journey while production is paused.
jest.mock("../features/resume/resumeFeatureFlags", () => ({ RESUME_FEATURE_FLAGS: { englishUpdate: true, improveSummary: false } }));
jest.mock("../utils/analytics", () => ({ getVisitorId: () => "test", trackEvent: jest.fn(), trackEventOncePerSession: jest.fn() }));
jest.mock("../utils/premiumAccess", () => ({
  PREMIUM_ACCESS_EVENT: "test-access", PREMIUM_STATUS_EVENT: "test-status",
  getAccessHeaders: () => ({}), getStoredAccessIdentity: () => ({ contact: "qa@example.test" }),
  getStoredPremiumPass: () => ({}), getSubscriptionCapabilities: () => ({ hasResumeAccess: true }),
}));

const clone = (value) => JSON.parse(JSON.stringify(value));
const entry = (id) => ({
  id, title: "مشروع اختباري", userSourceDescription: "سويت واجهات للموقع",
  description: "تطوير واجهات الموقع", details: "تطوير واجهات الموقع",
  achievements: [{ id: `ai-${id}`, text: "تصميم وتطوير واجهات الموقع لدعم استخدامه.", html: "<p>تصميم وتطوير واجهات الموقع لدعم استخدامه.</p>" }],
});
const master = {
  personalInfo: { fullName: "طالبة اختبار", englishName: "Test Student" },
  summary: "طالبة تقنية معلومات لديها خبرة في تطوير واجهات المواقع.",
  experiences: [entry("experience")], projects: [entry("project")], volunteering: [entry("activity")],
  education: [], certifications: [], skills: ["SQL"], languages: [], links: [],
  settings: { language: "ar", direction: "rtl" },
};
const english = {
  ...clone(master), summary: "Information technology student with website development experience.",
  settings: { language: "en", direction: "ltr" },
};
["experiences", "projects", "volunteering"].forEach((key) => {
  english[key].forEach((item) => {
    item.description = "Developed website interfaces.";
    item.details = item.description;
    item.achievements.forEach((bullet) => { bullet.text = item.description; bullet.html = `<p>${item.description}</p>`; });
  });
});
const version = { _id: "english", variantType: "translation", language: "en", resumePayload: english };

function Routes() {
  const navigate = useNavigate();
  return <><button onClick={() => navigate("/my-resume/master")}>test-open-ar</button><MyResumePage /></>;
}

describe("production EN to Arabic review hydration isolation", () => {
  beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  it.each([false, true])("EN → review → refresh/login preserves Arabic (simulate missing legacy guard: %s)", async (simulateLegacy) => {
    if (simulateLegacy) jest.spyOn(isolation, "canSaveResumeFacts").mockReturnValue(true);
    let persisted = clone(master);
    const before = clone(persisted);
    let delayMaster = false;
    const pendingReads = [];
    const response = () => ({ data: { resume: clone(persisted), masterResumeExists: true } });
    axios.get.mockImplementation((url) => {
      if (url.endsWith("/api/resume/me")) return delayMaster
        ? new Promise((resolve) => pendingReads.push(() => resolve(response())))
        : Promise.resolve(response());
      if (url.includes("/tailored-versions/english")) return Promise.resolve({ data: { version: clone(version) } });
      return Promise.resolve({ data: { versions: [] } });
    });
    axios.post.mockResolvedValue({ data: { version: clone(version) } });
    // In-memory persistence boundary only. No live account, DB or model calls.
    axios.put.mockImplementation(async (url, payload) => {
      if (url.endsWith("/api/resume/me/facts")) persisted = { ...persisted, ...clone(payload) };
      return response();
    });
    const open = () => render(<MemoryRouter initialEntries={["/my-resume/master"]}><Routes /></MemoryRouter>);
    let app;
    await act(async () => { app = open(); });
    const arabicPreviewBefore = screen.getByTestId("preview").textContent;
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "ترجمة EN" })); });
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(persisted).toEqual(before);
    delayMaster = true;
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "فتح النسخة الإنجليزية" })); });
    await act(async () => { fireEvent.click(screen.getAllByRole("button", { name: "مراجعة وتحديث سيرتي" })[0]); });
    await act(async () => { jest.advanceTimersByTime(2000); });
    if (simulateLegacy) {
      expect(axios.put).toHaveBeenCalledTimes(1);
      expect(axios.put.mock.calls[0][0]).toMatch(/\/api\/resume\/me\/facts$/);
      expect(persisted.projects[0].achievements).toEqual(english.projects[0].achievements);
      expect(persisted).not.toEqual(before);
      app.unmount();
      return;
    }
    expect(axios.put).not.toHaveBeenCalled();
    expect(persisted).toEqual(before);
    delayMaster = false;
    await act(async () => { pendingReads.splice(0).forEach((resolve) => resolve()); });
    await act(async () => { fireEvent.click(screen.getByText("test-open-ar")); });
    await act(async () => { jest.advanceTimersByTime(2000); });
    expect(screen.getByTestId("preview").textContent).toBe(arabicPreviewBefore);
    // Fresh mounts model refresh and a new authenticated session, without
    // carrying any previous component state or client presentation cache.
    for (const journey of ["refresh", "logout/login"]) {
      app.unmount();
      if (journey === "logout/login") { localStorage.clear(); sessionStorage.clear(); }
      await act(async () => { app = open(); });
      await act(async () => { jest.advanceTimersByTime(2000); });
      expect(screen.getByTestId("preview").textContent).toBe(arabicPreviewBefore);
    }
    expect(axios.put).not.toHaveBeenCalled();
    expect(persisted).toEqual(before);
  });
});
