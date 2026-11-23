import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import axios from "axios";
import AutopilotPanel from "./AutopilotPanel";

jest.mock("axios", () => ({ get: jest.fn(), post: jest.fn(), patch: jest.fn() }));
const headers = { headers: { "x-admin-password": "test" } };
const status = (overrides = {}) => ({ data: { enabled: false, forcedOff: false, cronConfigured: true,
  schedule: { discoveryTimes: ["08:00", "20:00"] }, totals: { autoPublished: 12, autoClosed: 3, inReview: 4 },
  lastAutoPublish: { published: 2, rejectedNotCoop: 5 }, lastRecheck: { closed: 1, checked: 20 }, actions: [], ...overrides } });
beforeEach(() => { jest.clearAllMocks(); axios.get.mockResolvedValue(status()); });

test("shows status and does not run anything on load", async () => {
  render(<AutopilotPanel password="test" />);
  expect(await screen.findByText("12")).toBeInTheDocument();
  expect(screen.getByText("متوقفة")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "تشغيل الآن" })).toBeDisabled();
  expect(axios.post).not.toHaveBeenCalled(); expect(axios.patch).not.toHaveBeenCalled();
});

test("admin enables the autopilot explicitly", async () => {
  axios.patch.mockResolvedValue({ data: {} });
  render(<AutopilotPanel password="test" />);
  await screen.findByText("12");
  fireEvent.click(screen.getByRole("button", { name: "تفعيل الأتمتة" }));
  await waitFor(() => expect(axios.patch).toHaveBeenCalledWith(expect.stringContaining("/autopilot"), { enabled: true }, headers));
});

test("auto-closed opportunities can be reopened", async () => {
  axios.get.mockResolvedValue(status({ enabled: true, actions: [
    { at: "2026-11-23T05:00:00Z", type: "auto_closed", opportunityId: "o1", title: "برنامج التدريب التعاوني", company: "شركة", reason: "SOURCE_SAYS_CLOSED" },
    { at: "2026-11-23T05:00:00Z", type: "auto_published", opportunityId: "o2", title: "Co-op Program", reason: "CONFIDENT_COOP" },
  ] }));
  axios.post.mockResolvedValue({ data: {} });
  render(<AutopilotPanel password="test" />);
  expect(await screen.findByText("المصدر يذكر أن التقديم مغلق", { exact: false })).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "إعادة فتح" })).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "إعادة فتح" }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/autopilot/reopen/o1"), {}, headers));
});

test("server kill switch disables the toggle", async () => {
  axios.get.mockResolvedValue(status({ enabled: true, forcedOff: true }));
  render(<AutopilotPanel password="test" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("OPPORTUNITY_AUTOPILOT_DISABLED");
  expect(screen.getByRole("button", { name: "إيقاف الأتمتة" })).toBeDisabled();
});
