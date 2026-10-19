import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import AdminAnalyticsV2 from "./AdminAnalyticsV2";

jest.mock("axios", () => ({ get: jest.fn() }));

describe("Admin Analytics V2", () => {
  beforeEach(() => {
    axios.get.mockImplementation((url, options) => Promise.resolve({ data: {
      tab: options.params.tab,
      kpis: [{ key: "activeUsers", label: "المستخدمون النشطون", value: 12, previous: 8 }],
      audience: { stages: { student: 7, graduate: 3, unknown: 2 }, majors: [], cities: [] },
      metrics: { granted: 1 },
      funnels: { reward: [] },
      health: {},
    } }));
  });
  afterEach(() => jest.clearAllMocks());

  it("loads only the selected tab and defaults to the last 30 days", async () => {
    render(<AdminAnalyticsV2 authHeaders={{ "x-admin-password": "test" }} />);
    await screen.findByText("المستخدمون النشطون");
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get.mock.calls[0][1].params).toEqual(expect.objectContaining({
      tab: "overview", range: "30",
    }));
    fireEvent.click(screen.getByRole("button", { name: "الجمهور" }));
    await screen.findByText("طلاب جامعيون");
    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
    expect(axios.get.mock.calls[1][1].params.tab).toBe("audience");
  });

  it("shows no invented number when a comparison is unavailable", async () => {
    axios.get.mockResolvedValueOnce({ data: {
      tab: "overview", kpis: [{ key: "retention", label: "العودة بعد 7 أيام", value: null, previous: null }],
    } });
    render(<AdminAnalyticsV2 authHeaders={{}} />);
    await screen.findByText("العودة بعد 7 أيام");
    expect(screen.getByText("غير متاح")).toBeInTheDocument();
  });

  it("does not claim a recent tracking start when its date is unknown", async () => {
    axios.get.mockResolvedValueOnce({ data: {
      tab: "overview", trackingStartedAt: null,
      kpis: [{ key: "activeUsers", label: "المستخدمون النشطون", value: 12,
        previous: null, trackedSince: true }],
    } });
    render(<AdminAnalyticsV2 authHeaders={{}} />);
    await screen.findByText("المستخدمون النشطون");
    expect(screen.getByText("تاريخ بدء القياس غير موثّق")).toBeInTheDocument();
    expect(screen.queryByText("بدأ القياس حديثًا")).not.toBeInTheDocument();
  });
});
