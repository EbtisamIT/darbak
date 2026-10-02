import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import ResumeAgentFlow from "./ResumeAgentFlow";

jest.mock("axios", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("../../utils/premiumAccess", () => ({ getAccessHeaders: () => ({}) }));
jest.mock("../../utils/analytics", () => ({ getVisitorId: () => "qa-visitor", trackEvent: jest.fn() }));

const buildRequestId = "92d4307e-86e2-4f5b-9469-512a0764774c";
const baseProps = {
  purpose: "create_resume",
  source: "professional_profile",
  language: "ar",
  storageScope: "qa-single-flight",
  buildRequestId,
  onBuildSettled: jest.fn(),
};

beforeEach(() => {
  window.sessionStorage.clear();
  axios.get.mockReset();
  axios.post.mockReset();
});

test("opening Draft without explicit build intent never starts the Agent", async () => {
  const onStartBuild = jest.fn();
  render(<ResumeAgentFlow {...baseProps} buildRequestId="" onStartBuild={onStartBuild} />);
  await screen.findByRole("button", { name: "ابنِ سيرتي" });
  expect(axios.post).not.toHaveBeenCalled();
});

test("remount and route return while generation is running share one start request", async () => {
  axios.get.mockRejectedValue({ response: { status: 404 } });
  let finishRequest;
  axios.post.mockImplementation(() => new Promise((resolve) => { finishRequest = resolve; }));

  const first = render(<ResumeAgentFlow {...baseProps} />);
  await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));
  expect(axios.post.mock.calls[0][1].buildRequestId).toBe(buildRequestId);
  first.unmount();

  render(<ResumeAgentFlow {...baseProps} />);
  await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
  expect(axios.post).toHaveBeenCalledTimes(1);
  await act(async () => {
    finishRequest({ data: {
      session: { sessionId: buildRequestId, status: "collecting_information" },
      output: { status: "needs_information", questions: [] },
    } });
  });
  expect(axios.post).toHaveBeenCalledTimes(1);
});
