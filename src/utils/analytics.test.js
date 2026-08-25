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
});
