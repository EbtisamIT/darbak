import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import CompanyApplicationsSharePage from "./CompanyApplicationsSharePage";

jest.mock("axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), patch: jest.fn() },
}));
jest.mock("react-router-dom", () => ({
  useParams: () => ({ shareToken: "secret-token" }),
}));

const response = {
  campaign: {
    id: "campaign-a",
    organizationName: "شركة اختبار",
    opportunityTitle: "تدريب تعاوني",
    status: "closed",
    isOpen: false,
    outcomeStatus: "pending",
  },
  applicationCount: 2,
  statusSummary: {
    total: 2,
    submitted: 1,
    under_review: 1,
    shortlisted: 0,
    interview: 0,
    accepted: 0,
    rejected: 0,
  },
  filters: { majors: [], universities: [] },
  pagination: { page: 1, limit: 50, total: 2 },
  applications: [
    { id: "application-a", fullName: "سارة", email: "sara@example.com", status: "submitted" },
    { id: "application-b", fullName: "نورة", email: "nora@example.com", status: "under_review" },
  ],
};

const renderPage = () => render(<CompanyApplicationsSharePage />);

beforeEach(() => {
  jest.clearAllMocks();
  axios.get.mockResolvedValue({ data: response });
  axios.patch.mockResolvedValue({
    data: {
      success: true,
      changedCount: 1,
      data: [{ ...response.applications[0], status: "interview" }],
    },
  });
});

test("renders program summary and updates one application through the scoped share endpoint", async () => {
  renderPage();
  expect(await screen.findByText("شركة اختبار")).toBeInTheDocument();
  expect(screen.getByText("إجمالي المتقدمين")).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("حالة طلب سارة"), { target: { value: "interview" } });

  await waitFor(() => expect(axios.patch).toHaveBeenCalledWith(
    expect.stringContaining("/company-applications/share/secret-token/applications/application-a/status"),
    { status: "interview" }
  ));
});

test("uses one bulk mutation for selected applicants", async () => {
  axios.patch.mockResolvedValueOnce({ data: { success: true, changedCount: 2, data: [] } });
  renderPage();
  await screen.findByText("شركة اختبار");
  fireEvent.click(screen.getByLabelText("تحديد سارة"));
  fireEvent.click(screen.getByLabelText("تحديد نورة"));
  fireEvent.change(screen.getAllByDisplayValue("قيد المراجعة")[0], { target: { value: "shortlisted" } });
  fireEvent.click(screen.getByRole("button", { name: "تغيير حالة المحددين" }));

  await waitFor(() => expect(axios.patch).toHaveBeenCalledWith(
    expect.stringContaining("/company-applications/share/secret-token/applications/status"),
    { status: "shortlisted", applicationIds: ["application-a", "application-b"] }
  ));
  expect(axios.patch).toHaveBeenCalledTimes(1);
});
