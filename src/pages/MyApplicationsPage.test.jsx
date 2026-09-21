import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import MyApplicationsPage from "./MyApplicationsPage";

jest.mock("axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), patch: jest.fn() },
}));
jest.mock("react-router-dom", () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
}));
jest.mock("../utils/analytics", () => ({ trackEvent: jest.fn() }));
jest.mock("../utils/premiumAccess", () => ({
  PREMIUM_ACCESS_EVENT: "premium-access",
  PREMIUM_STATUS_EVENT: "premium-status",
  getAccessHeaders: () => ({ "x-test": "yes" }),
  getStoredAccessIdentity: () => ({ contact: "student@example.com", accessCode: "1234" }),
}));

const application = {
  id: "application-a",
  organizationName: "شركة اختبار",
  opportunityTitle: "تدريب تعاوني",
  status: "under_review",
  statusLabel: "قيد المراجعة",
  statusHistory: [],
  submittedAt: "2026-09-10T10:00:00.000Z",
  updatedAt: "2026-09-11T10:00:00.000Z",
};

beforeEach(() => {
  jest.clearAllMocks();
  axios.get.mockResolvedValue({ data: { data: [application] } });
  axios.patch.mockResolvedValue({
    data: {
      success: true,
      data: { ...application, studentReportedStatus: "accepted", studentReportedAt: "2026-09-21T10:00:00.000Z" },
    },
  });
});

test("student report is saved separately without changing the official application status", async () => {
  render(<MyApplicationsPage />);
  expect(await screen.findByText("شركة اختبار")).toBeInTheDocument();
  expect(screen.getAllByText("قيد المراجعة").length).toBeGreaterThan(0);

  fireEvent.change(screen.getByLabelText("تحديث خارجي لطلب شركة اختبار"), {
    target: { value: "accepted" },
  });

  await waitFor(() => expect(axios.patch).toHaveBeenCalledWith(
    expect.stringContaining("/company-applications/me/application-a/student-report"),
    { studentReportedStatus: "accepted" },
    expect.objectContaining({ headers: expect.any(Object) })
  ));
  expect(screen.getAllByText("قيد المراجعة").length).toBeGreaterThan(0);
  expect(await screen.findByText(/آخر بلاغ: تم قبولي/)).toBeInTheDocument();
});
