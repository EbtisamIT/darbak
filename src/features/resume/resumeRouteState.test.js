import { getResumeEntryRedirect, getResumeHydrationTarget, RESUME_ROUTES } from "./resumeRouteState";

describe("resume route state separation", () => {
  it("sends a new user to setup and a returning user to the dashboard", () => {
    expect(getResumeEntryRedirect({ routeView: "dashboard", masterResumeExists: false })).toBe(RESUME_ROUTES.setup);
    expect(getResumeEntryRedirect({ routeView: "dashboard", masterResumeExists: true })).toBe("");
    expect(getResumeEntryRedirect({ routeView: "setup", masterResumeExists: true })).toBe(RESUME_ROUTES.dashboard);
  });

  it("keeps facts editing separate from setup and preserves explicit builds", () => {
    expect(getResumeEntryRedirect({ routeView: "review", masterResumeExists: true })).toBe("");
    expect(getResumeEntryRedirect({ routeView: "review", masterResumeExists: false })).toBe(RESUME_ROUTES.setup);
    expect(getResumeEntryRedirect({ routeView: "build", masterResumeExists: true, buildStep: "draft" })).toBe("");
    expect(getResumeEntryRedirect({ routeView: "build", masterResumeExists: true })).toBe(RESUME_ROUTES.dashboard);
  });

  it("rehydrates an explicit English version after login instead of Arabic Master", () => {
    expect(getResumeHydrationTarget({ routeView: "version", routeVersionId: "english-version-id" })).toBe("version");
    expect(getResumeHydrationTarget({ routeView: "master" })).toBe("master");
    expect(getResumeHydrationTarget({ routeView: "version" })).toBe("master");
    expect(getResumeEntryRedirect({ routeView: "version", masterResumeExists: false })).toBe("");
  });
});
