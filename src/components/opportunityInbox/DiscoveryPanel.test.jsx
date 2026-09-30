import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import axios from "axios";
import DiscoveryPanel from "./DiscoveryPanel";

jest.mock("axios", () => ({ get: jest.fn(), post: jest.fn() }));
beforeEach(() => { jest.clearAllMocks(); axios.get.mockResolvedValue({ data: { run: null, sources: [] } }); });
test("no background discovery or polling while collapsed", () => {
  render(<DiscoveryPanel password="test" onComplete={jest.fn()} />);
  expect(axios.get).not.toHaveBeenCalled(); expect(axios.post).not.toHaveBeenCalled();
});
test("explicit action runs protected discovery and displays summary", async () => {
  const onComplete = jest.fn();
  axios.post.mockResolvedValue({ data: { runId: "test", status: "running" } });
  render(<DiscoveryPanel password="test" onComplete={onComplete} />);
  fireEvent.click(screen.getByRole("button", { name: "الاكتشاف من المصادر الرسمية" }));
  await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));
  axios.get.mockResolvedValue({ data: { run: { status: "completed", summary: { sourcesChecked: 10, newCandidates: 2 }, sources: [] }, sources: [] } });
  fireEvent.click(screen.getByRole("button", { name: "Run Discovery Now" }));
  expect(await screen.findByText("اكتمل")).toBeVisible();
  expect(screen.getByText("10")).toBeVisible();
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/discovery/run"), {}, { headers: { "x-admin-password": "test" } });
});
test("an existing run disables start; errors do not report success", async () => {
  axios.get.mockResolvedValue({ data: { run: { status: "running" }, sources: [] } });
  const view = render(<DiscoveryPanel password="test" onComplete={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "الاكتشاف من المصادر الرسمية" }));
  await screen.findByText("قيد التشغيل");
  expect(screen.getByRole("button", { name: "Run Discovery Now" })).toBeDisabled();
  view.unmount();
  axios.get.mockRejectedValue({ response: { data: { error: "تعذر جلب الحالة" } } });
  render(<DiscoveryPanel password="test" onComplete={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "الاكتشاف من المصادر الرسمية" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("تعذر جلب الحالة");
});
