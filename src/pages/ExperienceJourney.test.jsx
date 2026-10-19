import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import JourneyGoalSheet from "./JourneyGoalSheet";
import ExperienceContributionEntry from "./ExperienceContributionEntry";
import ExperienceSubmissionNextStep from "./ExperienceSubmissionNextStep";
import InterviewsPage from "./InterviewsPage";
import AddExperienceModal from "./AddExperienceModal";
import HomePage from "./HomePage";
import { canShowExperienceReward } from "../utils/experienceRewardRollout";
import { trackEvent } from "../utils/analytics";
import { cityOptions, specializationOptions } from "../data/trainingOptions";
import {
  dismissJourneyGoal,
  getExperienceRewardEligibility,
  getJourneyGoal,
  saveJourneyGoal,
  shouldShowJourneyGoal,
} from "../utils/experienceJourney";

jest.mock("axios", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("react-router-dom", () => ({
  useLocation: jest.fn(),
  useNavigate: jest.fn(),
  Link: ({ to, children, ...props }) => require("react").createElement("a", { href: to, ...props }, children),
}));
jest.mock("../utils/analytics", () => ({ trackEvent: jest.fn(), trackEventOncePerSession: jest.fn() }));
jest.mock("../utils/experienceRewardRollout", () => ({ canShowExperienceReward: jest.fn(async () => true) }));
jest.mock("../components/PublicTestimonials", () => () => null);
jest.mock("../utils/premiumAccess", () => ({
  ACCOUNT_MODAL_EVENT: "darbak:open-account",
  PREMIUM_STATUS_EVENT: "darbak:premium-status-changed",
  getAccessHeaders: jest.fn(() => ({})),
  getStoredAccessIdentity: jest.fn(() => ({})),
  getStoredPremiumPass: jest.fn(() => null),
  passHasEntitlement: jest.fn(() => false),
  hasResumeAccessPass: jest.fn(() => false),
}));

const { getStoredAccessIdentity } = require("../utils/premiumAccess");
const navigate = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  canShowExperienceReward.mockResolvedValue(true);
  localStorage.clear();
  sessionStorage.clear();
  getStoredAccessIdentity.mockReturnValue({});
  useNavigate.mockReturnValue(navigate);
  useLocation.mockReturnValue({ pathname: "/share-experience", search: "" });
  axios.get.mockResolvedValue({ data: { data: [] } });
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ data: [], plans: [] }) }));
  window.scrollTo = jest.fn();
});

test("goal prompt dismisses for the session and goal choice persists without changing account", () => {
  expect(shouldShowJourneyGoal()).toBe(true);
  const onDismiss = jest.fn();
  const onGoal = jest.fn();
  const { unmount } = render(<JourneyGoalSheet onDismiss={onDismiss} onGoal={onGoal} />);
  fireEvent.click(screen.getByText("تصفح بدون تخصيص"));
  expect(onDismiss).toHaveBeenCalledTimes(1);
  dismissJourneyGoal();
  expect(shouldShowJourneyGoal()).toBe(false);
  unmount();
  render(<JourneyGoalSheet onDismiss={onDismiss} onGoal={onGoal} />);
  fireEvent.click(screen.getByText("أدور فرصة تدريب"));
  expect(onGoal).toHaveBeenCalledWith("training");
  saveJourneyGoal("training");
  expect(getJourneyGoal()).toBe("training");
  sessionStorage.clear();
  expect(shouldShowJourneyGoal()).toBe(false);
});

test("contribution requires a free account and returns to the existing experience route after login", async () => {
  useLocation.mockReturnValue({ pathname: "/share-experience", search: "?companyName=DataVolt&contributionSource=company_page" });
  render(<ExperienceContributionEntry />);
  expect(await screen.findAllByText(/نسخة سيرة ذاتية واحدة مجانًا/)).toHaveLength(1);
  fireEvent.click(screen.getByText("شارك تجربتي"));
  expect(screen.getByText("احفظ تجربتك ومكافأتك")).toBeInTheDocument();
  expect(navigate).not.toHaveBeenCalled();
  const accountEvents = [];
  window.addEventListener("darbak:open-account", (event) => accountEvents.push(event.detail), { once: true });
  fireEvent.click(screen.getByText("تسجيل الدخول أو إنشاء حساب"));
  expect(accountEvents[0].mode).toBe("contribution");
  act(() => window.dispatchEvent(new CustomEvent("darbak:free-account-saved")));
  expect(navigate).toHaveBeenCalledWith("/add-experience?companyName=DataVolt&contributionSource=company_page&source=journey", { replace: true });
});

test("experience page source survives the signed-in contribution entry", async () => {
  getStoredAccessIdentity.mockReturnValue({ contact: "qa@example.com", accessCode: "ABCD1234" });
  useLocation.mockReturnValue({ pathname: "/share-experience", search: "?contributionSource=experiences_page" });
  render(<ExperienceContributionEntry />);
  fireEvent.click(await screen.findByText("شارك تجربتي"));
  expect(navigate).toHaveBeenCalledWith("/add-experience?contributionSource=experiences_page&source=journey");
});

test("signed-in contribution opens the existing experience route without subscription", async () => {
  getStoredAccessIdentity.mockReturnValue({ contact: "qa@example.com", accessCode: "ABCD1234" });
  render(<ExperienceContributionEntry />);
  fireEvent.click(await screen.findByText("شارك تجربتي"));
  expect(navigate).toHaveBeenCalledWith("/add-experience?source=journey");
  expect(axios.post).not.toHaveBeenCalled();
});

test("training goal uses the current major and city controls before Where To Train", async () => {
  global.fetch = jest.fn(() => new Promise(() => {}));
  await act(async () => { render(<HomePage />); });
  fireEvent.click(screen.getByText("أدور فرصة تدريب"));
  fireEvent.change(screen.getByLabelText("التخصص"), { target: { value: specializationOptions[0].value } });
  fireEvent.change(screen.getByLabelText("المدينة"), { target: { value: cityOptions[0] } });
  fireEvent.click(screen.getByText(/رتّب لي رحلتي/));
  expect(navigate).toHaveBeenCalledWith(`/where-to-train?${new URLSearchParams({ major: specializationOptions[0].value, city: cityOptions[0] })}`);
});

test("company contribution reuses the existing form with company prefilled", async () => {
  getStoredAccessIdentity.mockReturnValue({ contact: "qa@example.com", accessCode: "ABCD1234" });
  useLocation.mockReturnValue({ pathname: "/add-experience", search: "?companyName=DataVolt&contributionSource=company_page&source=journey" });
  render(<AddExperienceModal />);
  expect(await screen.findByText("بيانات الجهة")).toBeInTheDocument();
  expect(screen.getByDisplayValue("DataVolt")).toBeInTheDocument();
  expect(screen.getByText(/بعد اعتمادها تحصل على نسخة سيرة ذاتية مجانية بقالب ATS/)).toBeInTheDocument();
  expect(trackEvent).toHaveBeenCalledWith("add_experience_started", expect.objectContaining({ metadata: expect.objectContaining({ source: "company_page" }) }));
  expect(axios.post).not.toHaveBeenCalled();
});

test("submission analytics keeps the contribution source without changing the experience payload", async () => {
  getStoredAccessIdentity.mockReturnValue({ contact: "qa@example.com", accessCode: "ABCD1234" });
  useLocation.mockReturnValue({ pathname: "/add-experience", search: "?contributionSource=experiences_page&source=journey" });
  localStorage.setItem("darbak_add_experience_draft_v1", JSON.stringify({
    step: 5, organizationName: "جهة تدريب", city: "الرياض",
    majorCategory: "الحاسب والتقنية", major: "نظم المعلومات",
    howApplied: "بحث شخصي", duration: "3 أشهر", starRating: 3,
    ratings: ["enriching"], publicationConsent: true,
    description: "وصف حقيقي طويل بما يكفي لإرسال تجربة تدريب تخص الطالب فعلًا وتفيد الطلاب الآخرين.",
  }));
  axios.post.mockResolvedValue({ data: { _id: "experience-1", organizationName: "جهة تدريب" } });
  render(<AddExperienceModal />);
  fireEvent.click(await screen.findByText("أرسل تجربتي لتفيد غيري"));
  await waitFor(() => expect(axios.post).toHaveBeenCalled());
  expect(axios.post.mock.calls[0][1]).not.toHaveProperty("contributionSource");
  expect(trackEvent).toHaveBeenCalledWith("add_experience_submitted", expect.objectContaining({ metadata: expect.objectContaining({ source: "experiences_page" }) }));
});

test("contribution keeps the real-experience attestation after QA path removal", async () => {
  getStoredAccessIdentity.mockReturnValue({ contact: "student@example.com", accessCode: "ABCD1234" });
  localStorage.setItem("darbak_add_experience_draft_v1", JSON.stringify({
    step: 5, organizationName: "جهة تدريب", city: "الرياض",
    majorCategory: "الحاسب والتقنية", major: "نظم المعلومات",
    howApplied: "بحث شخصي", duration: "3 أشهر", starRating: 3,
    ratings: ["enriching"], description: "وصف حقيقي طويل بما يكفي لإرسال تجربة تدريب تخص الطالب فعلًا.",
  }));
  render(<AddExperienceModal />);
  expect(await screen.findByText(/تجربة حقيقية تخصني/)).toBeInTheDocument();
  fireEvent.click(screen.getByText("أرسل تجربتي لتفيد غيري"));
  expect(axios.post).not.toHaveBeenCalled();
});

test("post-submit interview question is optional and carries submitted experience data", () => {
  const experience = { organizationName: "DataVolt", major: "تقنية المعلومات", city: "الرياض" };
  const onInterview = jest.fn();
  const onFinish = jest.fn();
  render(<ExperienceSubmissionNextStep experience={experience} onInterview={onInterview} onFinish={onFinish} />);
  expect(screen.getByText("وصلت تجربتك للمراجعة")).toBeInTheDocument();
  fireEvent.click(screen.getByText("نعم، كانت فيه مقابلة"));
  expect(onInterview).toHaveBeenCalledWith(experience);
  fireEvent.click(screen.getByText("لا"));
  expect(onFinish).toHaveBeenCalledTimes(1);
});

test("existing interview form opens with company, major and city prefilled", async () => {
  useLocation.mockReturnValue({ pathname: "/interviews", state: { openQuestionForm: true, prefill: { organizationName: "DataVolt", majorCategory: "الحاسب والتقنية", major: "تقنية المعلومات", city: "الرياض" } } });
  render(<InterviewsPage />);
  await waitFor(() => expect(screen.getByText(/عبّينا البيانات اللي نعرفها/)).toBeInTheDocument());
  expect(screen.getByDisplayValue("DataVolt")).toBeInTheDocument();
  expect(screen.getByDisplayValue("تقنية المعلومات")).toBeInTheDocument();
  expect(screen.getByDisplayValue("الرياض")).toBeInTheDocument();
});

test("reward eligibility is pending until review and never grants a subscription", () => {
  expect(getExperienceRewardEligibility({ status: "pending" })).toBe("pending_review");
  for (const starRating of [1, 3, 5]) {
    expect(getExperienceRewardEligibility({ status: "approved", submittedByUserId: "qa", starRating })).toBe("awaiting_reward");
  }
  expect(getExperienceRewardEligibility({ status: "rejected" })).toBe("not_eligible");
  expect(axios.post).not.toHaveBeenCalled();
});
