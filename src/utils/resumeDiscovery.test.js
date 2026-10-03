import {
  getResumeDiscoveryAttribution,
  getResumeDiscoveryUserState,
  getResumeLandingPath,
  setResumeDiscoveryAttribution,
  trackResumeDiscovery,
} from "./resumeDiscovery";
import { trackEvent } from "./analytics";

jest.mock("./analytics", () => ({ trackEvent: jest.fn(), trackEventOncePerSession: jest.fn() }));

beforeEach(() => {
  sessionStorage.clear();
  trackEvent.mockClear();
});

test("opportunity attribution survives route navigation in the same session", () => {
  setResumeDiscoveryAttribution({ source: "opportunity_card", pageContext: "where_to_train", opportunityId: "op-1" });
  expect(getResumeLandingPath({ source: "opportunity_card", opportunityId: "op-1" }))
    .toBe("/resume?source=opportunity_card&opportunityId=op-1");
  expect(getResumeDiscoveryAttribution()).toEqual({ source: "opportunity_card", pageContext: "where_to_train", opportunityId: "op-1" });
  trackResumeDiscovery("resume_cta_clicked", { planId: "darbak_resume" });
  expect(trackEvent).toHaveBeenCalledWith("resume_cta_clicked", {
    metadata: expect.objectContaining({ source: "opportunity_card", opportunityId: "op-1", planId: "darbak_resume" }),
  });
  sessionStorage.clear();
  expect(getResumeDiscoveryAttribution()).toEqual({});
});

test("discovery state distinguishes guest, unbuilt subscriber, and ready resume", () => {
  expect(getResumeDiscoveryUserState({ hasAccess: false, hasMaster: false })).toBe("non_subscriber");
  expect(getResumeDiscoveryUserState({ hasAccess: true, hasMaster: false })).toBe("resume_not_built");
  expect(getResumeDiscoveryUserState({ hasAccess: true, hasMaster: true })).toBe("resume_ready");
});
