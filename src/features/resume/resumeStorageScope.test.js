import { getResumeStorageScope, getScopedResumeStorageKey } from "./resumeStorageScope";

describe("resume storage scope", () => {
  it("uses different opaque keys for different authenticated accounts", () => {
    const reemScope = getResumeStorageScope({ contact: "reem@example.com", accessCode: "111111" });
    const nouraScope = getResumeStorageScope({ contact: "noura@example.com", accessCode: "222222" });

    expect(reemScope).toBeTruthy();
    expect(reemScope).not.toBe(nouraScope);
    expect(getScopedResumeStorageKey("resume-agent", reemScope))
      .not.toBe(getScopedResumeStorageKey("resume-agent", nouraScope));
  });

  it("does not create a protected storage key without an authenticated scope", () => {
    expect(getScopedResumeStorageKey("resume-agent", "")).toBe("");
  });
});
