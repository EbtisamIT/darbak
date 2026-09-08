const assert = require("assert");
const { buildResumeTranslationUpdatePlan } = require("../services/resumeAiService");

const sourceResume = {
  summary: "نبذة مهنية مختصرة",
  projects: [{
    id: "project-1",
    title: "نظام حجوزات",
    description: "تطبيق يتيح حجز المواعيد.",
    achievements: [],
  }],
  education: [],
  experience: [],
  certifications: [],
  volunteering: [],
};

const firstPlan = buildResumeTranslationUpdatePlan({ resume: sourceResume });
const existingEnglishResume = {
  ...sourceResume,
  summary: "Professional summary.",
  projects: [{ ...sourceResume.projects[0], title: "Appointment Booking System", description: "An application for booking appointments." }],
  localizedDisplay: { sourceHashes: firstPlan.sourceHashes },
};

const unchangedPlan = buildResumeTranslationUpdatePlan({
  resume: sourceResume,
  existingEnglishResume,
});
assert.strictEqual(unchangedPlan.changedItems.length, 0, "unchanged fields are not sent for translation again");
assert.strictEqual(unchangedPlan.reusedItems.length, 3, "summary, title, and description are reused");
assert.strictEqual(unchangedPlan.resume.summary, "Professional summary.");

const changedSource = {
  ...sourceResume,
  projects: [{ ...sourceResume.projects[0], title: "نظام إدارة الحجوزات" }],
};
const changedPlan = buildResumeTranslationUpdatePlan({
  resume: changedSource,
  existingEnglishResume,
});
assert.deepStrictEqual(
  changedPlan.changedItems.map((item) => item.id),
  ["projects:project-1:title"],
  "only the field whose Arabic source changed is localized again",
);
assert.strictEqual(changedPlan.resume.summary, "Professional summary.", "unchanged presentation is retained");

console.log("resumeEnglishTranslationUpdate tests passed");
