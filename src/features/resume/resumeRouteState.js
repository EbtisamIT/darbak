export const RESUME_ROUTES = Object.freeze({
  dashboard: "/my-resume",
  setup: "/my-resume/setup",
  editor: "/my-resume/review",
  build: "/my-resume/build",
});

export const getResumeEntryRedirect = ({ routeView, masterResumeExists, buildStep = "" }) => {
  if (routeView === "dashboard" && !masterResumeExists) return RESUME_ROUTES.setup;
  if (routeView === "setup" && masterResumeExists) return RESUME_ROUTES.dashboard;
  if (routeView === "review" && !masterResumeExists) return RESUME_ROUTES.setup;
  if (routeView === "build" && buildStep !== "draft") {
    return masterResumeExists ? RESUME_ROUTES.dashboard : RESUME_ROUTES.setup;
  }
  return "";
};
