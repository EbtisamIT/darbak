import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import DiscoveryTools from "./DiscoveryTools";
jest.mock("axios", () => ({ get: jest.fn(), post: jest.fn() }));
const sources = [{ key: "official", name: "Official", reviewStatus: "approved" }, { key: "pending", name: "Pending", reviewStatus: "pending" }];
beforeEach(() => jest.clearAllMocks());
test("known URL preview is explicit and does not request candidate creation", async () => {
  axios.post.mockResolvedValue({ data: { stage: "extraction", code: "NO_JOB_CONTENT", results: [] } });
  render(<DiscoveryTools endpoint="/discovery" password="local-test" sources={sources} onRefresh={() => {}} />);
  expect(axios.post).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("المصدر المعتمد"), { target: { value: "official" } });
  fireEvent.change(screen.getByLabelText("رابط الإعلان"), { target: { value: "https://official.example/jobs/42" } });
  fireEvent.click(screen.getByRole("button", { name: /اختبار فقط/ }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith("/discovery/test-url", {
    sourceKey: "official", url: "https://official.example/jobs/42", sendToInbox: false,
  }, expect.any(Object)));
  expect(await screen.findByText("extraction · NO_JOB_CONTENT")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /إرسال المؤهل/ })).toBeDisabled();
  expect(screen.queryByRole("option", { name: "Pending" })).not.toBeInTheDocument();
});
test("explicit Inbox action reruns verification, and changed URL invalidates preview", async () => {
  const result = { stage: "verification", code: "TEST_COMPLETED", results: [{ code: "VERIFIED_FOR_REVIEW", fetchMethod: "structured_data", missingFields: [],
    data: { title: "Marketing Internship", company: "Official", verification: { appearsOpen: true }, discoveredEmails: [] } }] };
  axios.post.mockResolvedValue({ data: result });
  render(<DiscoveryTools endpoint="/discovery" password="local-test" sources={sources} onRefresh={() => {}} />);
  fireEvent.change(screen.getByLabelText("المصدر المعتمد"), { target: { value: "official" } });
  fireEvent.change(screen.getByLabelText("رابط الإعلان"), { target: { value: "https://official.example/jobs/42" } });
  fireEvent.click(screen.getByRole("button", { name: /اختبار فقط/ }));
  await screen.findByRole("heading", { name: "Marketing Internship", hidden: true });
  fireEvent.click(screen.getByRole("button", { name: /إرسال المؤهل/ }));
  await waitFor(() => expect(axios.post).toHaveBeenLastCalledWith("/discovery/test-url", expect.objectContaining({ sendToInbox: true }), expect.any(Object)));
  fireEvent.change(screen.getByLabelText("رابط الإعلان"), { target: { value: "https://evil.example/" } });
  expect(screen.getByRole("button", { name: /إرسال المؤهل/ })).toBeDisabled();
});
