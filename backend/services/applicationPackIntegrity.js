const hasText = (value) => typeof value === "string" && value.trim().length > 0;

const hasResumeContent = (resume = {}) => {
  const personal = resume.personalInfo || {};
  const sections = [
    resume.summary,
    ...(Array.isArray(resume.education) ? resume.education : []),
    ...(Array.isArray(resume.experiences) ? resume.experiences : []),
    ...(Array.isArray(resume.projects) ? resume.projects : []),
    ...(Array.isArray(resume.skills) ? resume.skills : []),
  ];

  return hasText(personal.fullName) && sections.some((item) =>
    typeof item === "string" ? hasText(item) : Boolean(item)
  );
};

const isUsablePart = (part = {}, contentKeys = []) => {
  if (part.status === "needs_input" || part.status === "unavailable") return true;
  if (part.status !== "ready") return false;
  return contentKeys.every((key) => hasText(part[key]));
};

const hasCompleteApplicationPack = ({ resumePayload = {}, applicationPack = {} } = {}) => {
  if (applicationPack.resume?.status !== "ready" || !hasResumeContent(resumePayload)) return false;

  return (
    isUsablePart(applicationPack.trainingLetter, ["body"]) &&
    isUsablePart(applicationPack.email, ["subject", "body"])
  );
};

module.exports = {
  hasCompleteApplicationPack,
  hasResumeContent,
};
