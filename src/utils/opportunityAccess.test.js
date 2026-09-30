import axios from "axios";
import { requestOpportunityAccess, getOpportunityErrorMessage } from "./opportunityAccess";
import { PREMIUM_ACCESS_EVENT } from "./premiumAccess";

jest.mock("axios", () => ({ get: jest.fn(), post: jest.fn() }));

const opportunity = { _id: "opportunity-1", title: "Internship", applicationUrl: "https://example.com/apply" };
const denial = (status, reason) => ({ response: { status, data: { granted: false, reason } } });
let detail;
let onGranted;
let gate;

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  detail = { feature: "opportunity_apply", itemKey: "opportunity:opportunity-1", onLimited: jest.fn(), onError: jest.fn() };
  onGranted = jest.fn();
  gate = jest.fn();
  window.addEventListener(PREMIUM_ACCESS_EVENT, gate);
});
afterEach(() => window.removeEventListener(PREMIUM_ACCESS_EVENT, gate));

test("a subscriber loads the real link using existing identity, not the cached pass", async () => {
  localStorage.setItem("darbak_access_identity_v1", JSON.stringify({ contact: "student@example.com", accessCode: "Ab1234" }));
  localStorage.setItem("darbak_premium_pass_v1", JSON.stringify({ expiresAt: "2099-01-01", planId: "darbak_plus" }));
  axios.get.mockResolvedValue({ data: { data: opportunity } });
  await requestOpportunityAccess(detail, onGranted);
  expect(axios.get.mock.calls[0][1].headers["x-darbak-contact"]).toBe("student@example.com");
  expect(onGranted).toHaveBeenCalledWith(opportunity);
  expect(axios.post).not.toHaveBeenCalled();
});

test("a guest claims an allowed free view then loads the opportunity", async () => {
  axios.get.mockRejectedValueOnce(denial(402, "daily_limit")).mockResolvedValueOnce({ data: { data: opportunity } });
  axios.post.mockResolvedValue({ data: { granted: true, accessType: "free_daily" } });
  await requestOpportunityAccess(detail, onGranted);
  expect(axios.post.mock.calls[0][0]).toMatch(/\/api\/access\/check$/);
  expect(axios.post.mock.calls[0][1].itemKey).toBe(detail.itemKey);
  expect(axios.get).toHaveBeenCalledTimes(2);
  expect(onGranted).toHaveBeenCalledWith(opportunity);
  expect(gate).not.toHaveBeenCalled();
});

test("a stale paid pass with a server denial opens the existing access flow, not an error", async () => {
  localStorage.setItem("darbak_premium_pass_v1", JSON.stringify({ expiresAt: "2099-01-01", planId: "darbak_plus" }));
  axios.get.mockRejectedValue(denial(402, "daily_limit"));
  axios.post.mockRejectedValue(denial(402, "daily_limit"));
  await requestOpportunityAccess(detail, onGranted);
  expect(detail.onLimited).toHaveBeenCalled();
  expect(detail.onError).not.toHaveBeenCalled();
  expect(onGranted).not.toHaveBeenCalled();
  expect(gate.mock.calls[0][0].detail.accessStatus.granted).toBe(false);
  expect(gate.mock.calls[0][0].detail.loginOnly).toBe(true);
  axios.get.mockResolvedValue({ data: { data: opportunity } });
  await gate.mock.calls[0][0].detail.onGranted();
  expect(onGranted).toHaveBeenCalledWith(opportunity);
});

test.each([[400, "invalid_identity"], [400, "missing_identity"], [401, "unauthorized"], [403, "forbidden"]])(
  "%s/%s requests sign-in without assuming a new payment is needed", async (status, reason) => {
    axios.get.mockRejectedValue(denial(status, reason));
    await requestOpportunityAccess(detail, onGranted);
    expect(gate.mock.calls[0][0].detail.loginOnly).toBe(true);
    expect(detail.onError).not.toHaveBeenCalled();
    expect(onGranted).not.toHaveBeenCalled();
  }
);

test.each([404, 429, 500, 503])("HTTP %s stays a retryable loading error, never an upsell", async (status) => {
  const error = { response: { status } };
  axios.get.mockRejectedValue(error);
  await requestOpportunityAccess(detail, onGranted);
  expect(detail.onError).toHaveBeenCalledWith(error);
  expect(gate).not.toHaveBeenCalled();
  expect(onGranted).not.toHaveBeenCalled();
});

test("network failure can be retried successfully without losing identity", async () => {
  const error = new Error("Network Error");
  axios.get.mockRejectedValueOnce(error).mockResolvedValueOnce({ data: { data: opportunity } });
  await requestOpportunityAccess(detail, onGranted);
  expect(detail.onError).toHaveBeenCalledWith(error);
  expect(getOpportunityErrorMessage(error)).toContain("اتصالك");
  await requestOpportunityAccess(detail, onGranted);
  expect(onGranted).toHaveBeenCalledWith(opportunity);
});

test("access-check outage does not masquerade as a subscription limit", async () => {
  axios.get.mockRejectedValue(denial(402, "daily_limit"));
  axios.post.mockRejectedValue({ response: { status: 503 } });
  await requestOpportunityAccess(detail, onGranted);
  expect(detail.onError).toHaveBeenCalled();
  expect(gate).not.toHaveBeenCalled();
});

test("second detail denial is bounded and never leaks a cached application URL", async () => {
  axios.get.mockRejectedValue(denial(402, "daily_limit"));
  axios.post.mockResolvedValue({ data: { granted: true } });
  await requestOpportunityAccess(detail, onGranted);
  expect(axios.get).toHaveBeenCalledTimes(2);
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(onGranted).not.toHaveBeenCalled();
  expect(gate).toHaveBeenCalledTimes(1);
});

test("a non-granted 200 check response never authorizes navigation", async () => {
  axios.get.mockRejectedValue(denial(402, "daily_limit"));
  axios.post.mockResolvedValue({ data: { granted: false, reason: "daily_limit" } });
  await requestOpportunityAccess(detail, onGranted);
  expect(onGranted).not.toHaveBeenCalled();
  expect(axios.get).toHaveBeenCalledTimes(1);
});

test("an abandoned direct route does not reopen a modal", async () => {
  axios.get.mockRejectedValue(denial(402, "daily_limit"));
  axios.post.mockRejectedValue(denial(402, "daily_limit"));
  await requestOpportunityAccess({ ...detail, isActive: () => false }, onGranted);
  expect(detail.onLimited).not.toHaveBeenCalled();
  expect(gate).not.toHaveBeenCalled();
});

test("malformed successful responses are not used as opportunity data", async () => {
  axios.get.mockResolvedValue({ data: {} });
  await requestOpportunityAccess(detail, onGranted);
  expect(detail.onError).toHaveBeenCalled();
  expect(onGranted).not.toHaveBeenCalled();
});
