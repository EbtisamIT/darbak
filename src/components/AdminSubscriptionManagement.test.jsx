import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import AdminSubscriptionManagement, {
  filterAdminSubscriptions,
} from "./AdminSubscriptionManagement";

jest.mock("axios", () => ({
  get: jest.fn(),
  patch: jest.fn(),
}));
jest.mock("../features/resume/ResumePreview", () => () => <div>resume preview</div>);

const subscriptions = [
  {
    id: "subscription-1",
    email: "student@example.com",
    major: "نظم المعلومات",
    planId: "darbak_resume",
    startsAt: "2026-09-01T00:00:00.000Z",
    expiresAt: "2026-10-01T00:00:00.000Z",
    usagePercentage: 63,
    hasUsedAnyFeature: true,
    hasResume: true,
    status: "active",
  },
  {
    id: "subscription-2",
    email: "unused@example.com",
    major: "إدارة الأعمال",
    planId: "darbak_plus",
    startsAt: "2026-09-02T00:00:00.000Z",
    expiresAt: "2026-10-02T00:00:00.000Z",
    usagePercentage: 0,
    hasUsedAnyFeature: false,
    hasResume: false,
    status: "cancel_at_period_end",
  },
];

describe("AdminSubscriptionManagement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("filters lightweight subscription summaries deterministically", () => {
    expect(filterAdminSubscriptions(subscriptions, "active")).toHaveLength(1);
    expect(filterAdminSubscriptions(subscriptions, "resume_created")[0].id).toBe("subscription-1");
    expect(filterAdminSubscriptions(subscriptions, "resume_missing")[0].id).toBe("subscription-2");
    expect(filterAdminSubscriptions(subscriptions, "usage_high")[0].id).toBe("subscription-1");
    expect(filterAdminSubscriptions(subscriptions, "unused")[0].id).toBe("subscription-2");
  });

  test("keeps the current page and filters the existing subscriptions table", () => {
    render(
      <AdminSubscriptionManagement
        subscriptions={subscriptions}
        apiBaseUrl="http://localhost:3001"
        authHeaders={{}}
        getPlanLabel={(plan) => plan}
        onRefresh={jest.fn()}
        onMessage={jest.fn()}
        onResendPaymentEmail={jest.fn()}
      />
    );

    expect(screen.getByText("student@example.com")).toBeInTheDocument();
    expect(screen.getByText("unused@example.com")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("تصفية الاشتراكات"), {
      target: { value: "resume_created" },
    });

    expect(screen.getByText("student@example.com")).toBeInTheDocument();
    expect(screen.queryByText("unused@example.com")).not.toBeInTheDocument();
  });

  test("loads full details lazily and writes once for one admin action", async () => {
    const details = {
      account: { email: "student@example.com", major: "نظم المعلومات" },
      subscription: {
        id: "subscription-1",
        planId: "darbak_resume",
        planLabel: "دربك + سيرتي",
        status: "active",
        cancelAtPeriodEnd: false,
      },
      usage: { percentage: 63, features: [] },
      refund: { status: "none", daysSinceSubscription: 3 },
      adminEvents: [],
      resume: null,
    };
    axios.get.mockResolvedValue({ data: details });
    axios.patch.mockResolvedValue({ data: { ok: true } });

    render(
      <AdminSubscriptionManagement
        subscriptions={[subscriptions[0]]}
        apiBaseUrl="http://localhost:3001"
        authHeaders={{ Authorization: "admin" }}
        getPlanLabel={(plan) => plan}
        onRefresh={jest.fn()}
        onMessage={jest.fn()}
        onResendPaymentEmail={jest.fn()}
      />
    );

    expect(axios.get).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "التفاصيل" }));
    await screen.findByRole("dialog", { name: "تفاصيل المشترك" });
    await screen.findByText("دربك + سيرتي");

    fireEvent.click(screen.getByRole("button", { name: "إلغاء التجديد" }));
    await waitFor(() => expect(axios.patch).toHaveBeenCalledTimes(1));
    expect(axios.patch).toHaveBeenCalledWith(
      "http://localhost:3001/api/admin/subscriptions/subscription-1",
      { action: "cancel_renewal" },
      { headers: { Authorization: "admin" } }
    );
  });
});
