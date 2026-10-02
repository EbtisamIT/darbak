import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import axios from "axios";
import DiscoveryPanel from "./DiscoveryPanel";

jest.mock("axios", () => ({ get: jest.fn(), post: jest.fn() }));
beforeEach(() => { jest.clearAllMocks(); axios.get.mockResolvedValue({ data: { run: null, sources: [] } }); });
test("run history and disabled scheduling are visible without starting a run", async () => {
  axios.get.mockResolvedValue({ data: { sources: [], scheduling: { enabled: false, maxDailyRuns: 2, maxSearchQueriesPerRun: 20 },
    recentRuns: [{ _id: "run-1", startedAt: "2026-10-02T05:00:00Z", finishedAt: "2026-10-02T05:00:10Z", durationMs: 10000,
      status: "completed", queries: 15, results: 39, candidatesCreated: 2, duplicates: 0, updates: 0, errors: 0 }] } });
  render(<DiscoveryPanel password="test" onComplete={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "الاكتشاف من المصادر الرسمية" }));
  expect(await screen.findByText(/الجدولة غير مفعلة/)).toBeInTheDocument();
  expect(screen.getByText("آخر 10 تشغيلات")).toBeInTheDocument();
  expect(screen.getByText("39")).toBeInTheDocument();
  expect(axios.post).not.toHaveBeenCalled();
});
test("no background discovery or polling while collapsed", () => {
  render(<DiscoveryPanel password="test" onComplete={jest.fn()} />);
  expect(axios.get).not.toHaveBeenCalled(); expect(axios.post).not.toHaveBeenCalled();
});
test("automation starts only by explicit admin action and displays enrichment summary", async () => {
  axios.post.mockResolvedValue({ data: { status: "running" } });
  axios.get.mockResolvedValue({ data: { sources: [], run: { status: "completed", summary: { opportunitiesEnriched: 3, averageCompleteness: 85 } } } });
  render(<DiscoveryPanel password="test" onComplete={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "الاكتشاف من المصادر الرسمية" }));
  expect(await screen.findByText("85")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Run Opportunity Automation" }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/discovery/run"), { mode: "automation" }, { headers: { "x-admin-password": "test" } }));
});
test("explicit action runs protected discovery and displays summary", async () => {
  const onComplete = jest.fn();
  axios.post.mockResolvedValue({ data: { runId: "test", status: "running" } });
  render(<DiscoveryPanel password="test" onComplete={onComplete} />);
  fireEvent.click(screen.getByRole("button", { name: "الاكتشاف من المصادر الرسمية" }));
  await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));
  axios.get.mockResolvedValue({ data: { run: { status: "completed", summary: { sourcesChecked: 10, newCandidates: 2 }, sources: [] }, sources: [] } });
  fireEvent.click(screen.getByRole("button", { name: "Run Search Discovery Only" }));
  expect(await screen.findByText("اكتمل")).toBeVisible();
  expect(screen.getByText("10")).toBeVisible();
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/discovery/run"), { mode: "search-only" }, { headers: { "x-admin-password": "test" } });
});
test("an existing run disables start; errors do not report success", async () => {
  axios.get.mockResolvedValue({ data: { run: { status: "running" }, sources: [] } });
  const view = render(<DiscoveryPanel password="test" onComplete={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "الاكتشاف من المصادر الرسمية" }));
  await screen.findByText("قيد التشغيل");
  expect(screen.getByRole("button", { name: "Run Search Discovery Only" })).toBeDisabled();
  view.unmount();
  axios.get.mockRejectedValue({ response: { data: { error: "تعذر جلب الحالة" } } });
  render(<DiscoveryPanel password="test" onComplete={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "الاكتشاف من المصادر الرسمية" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("تعذر جلب الحالة");
});
test("full discovery requires a reviewed search run and sends only its ID", async () => {
  axios.get.mockResolvedValue({ data: { sources: [], run: { status: "completed" }, lastSearch: { _id: "search-run", status: "completed", summary: { officialUrlsAccepted: 2 } } } });
  axios.post.mockResolvedValue({ data: { status: "running" } });
  render(<DiscoveryPanel password="test" onComplete={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "الاكتشاف من المصادر الرسمية" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Run Full Discovery" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Run Full Discovery" }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/discovery/run"),
    { mode: "full", searchRunId: "search-run" }, { headers: { "x-admin-password": "test" } }));
});
