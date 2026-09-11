const assert = require("assert");
const { approvedDraftNeedsRematerialization } = require("../services/resumeAiService");
const { composeCanonicalResume } = require("../services/resumePortfolioHydration");

const workflow = { source: "portfolio", factsOwner: "resume" };
const approvedSkills = ["React.js", "Power BI"];
const portfolio = {
  _id: "portfolio-1",
  email: "qa@example.com",
  skills: ["Microsoft Excel"],
};

const composed = composeCanonicalResume({
  workflow,
  personalInfo: { fullName: "QA Student", major: "Information Systems" },
  skills: approvedSkills,
}, portfolio, portfolio.email);

assert.deepStrictEqual(composed.skills, approvedSkills);
assert.deepStrictEqual(composed.verifiedResumeFacts.skills, approvedSkills);

const draft = {
  professionalSummary: "Approved summary.",
  skills: approvedSkills.map((name) => ({ name, evidenceSourceId: "verified_skills" })),
};
assert.strictEqual(approvedDraftNeedsRematerialization(draft, {
  summary: "Approved summary.",
  skills: ["Microsoft Excel"],
}), true);
assert.strictEqual(approvedDraftNeedsRematerialization(draft, {
  summary: "Approved summary.",
  skills: approvedSkills,
}), false);

console.log("resume approved skills persistence tests passed");
