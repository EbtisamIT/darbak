import { trackEvent } from "./analytics";

describe("analytics delivery", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.useFakeTimers();
    global.fetch = jest.fn(() => Promise.reject(new Error("analytics unavailable")));
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    global.fetch = originalFetch;
  });

  it("does not block the student flow when analytics is unavailable", () => {
    expect(() => {
      trackEvent("application_pack_started", {
        metadata: { packType: "opportunity_pack" },
      });
      jest.advanceTimersByTime(1800);
    }).not.toThrow();
  });

  it("records one attributed resume checkout event from the existing checkout event", () => {
    sessionStorage.setItem("darbak_resume_discovery_attribution_v1", JSON.stringify({ source: "opportunity_card", pageContext: "where_to_train", opportunityId: "op-1" }));
    trackEvent("checkout_started", { metadata: { planId: "darbak_resume", providerPaymentId: "payment-1" } });
    jest.advanceTimersByTime(1800);
    const sent = global.fetch.mock.calls.flatMap((call) => JSON.parse(call[1].body).events);
    expect(sent.filter((event) => event.eventName === "resume_checkout_started")).toHaveLength(1);
    expect(sent.find((event) => event.eventName === "resume_checkout_started").metadata).toEqual(expect.objectContaining({
      source: "opportunity_card", opportunityId: "op-1", providerPaymentId: "payment-1",
    }));
    sessionStorage.clear();
  });
});
