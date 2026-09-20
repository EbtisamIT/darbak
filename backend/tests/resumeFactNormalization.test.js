const assert = require("assert");
const {
  normalizeActivityFacts,
  normalizeExperienceFacts,
  normalizeProjectFacts,
} = require("../services/resumeFactNormalization");
const { composeCanonicalResume } = require("../services/resumePortfolioHydration");
const { buildUserSourceEnrichmentFacts } = require("../services/resumeAgentAnswerLifecycle");
const { compactVerifiedResumeFacts } = require("../services/resumeProfessionalComposer");

const tarmeezContribution = "شاركت في مهام النادي وتطوير الموقع باستخدام DevOps وتصميم المنشورات الترويجية وحضور فعاليات النادي.";
const enjazContribution = "ساعدت في برمجة موقع النادي كمنصة جامعية لإدارة الجداول.";
const internshipTasks = "طورت واجهات برمجية واختبرت الخصائص وعالجت مشكلات النماذج.";

const tarmeez = normalizeActivityFacts({
  id: "activity-tarmeez",
  title: "Software Designer and Developer",
  organization: "نادي ترميز",
  description: tarmeezContribution,
});
assert.deepStrictEqual(tarmeez.contributions, [tarmeezContribution]);

const enjaz = normalizeActivityFacts({
  id: "activity-enjaz",
  title: "Programmer",
  organization: "نادي إنجاز",
  details: enjazContribution,
});
assert.deepStrictEqual(enjaz.contributions, [enjazContribution]);

const experience = normalizeExperienceFacts({
  id: "experience-dar-alriyadh",
  title: "Software Development Intern",
  organization: "شركة دار الرياض",
  tasks: [internshipTasks, internshipTasks],
});
assert.deepStrictEqual(experience.responsibilities, [internshipTasks]);

const project = normalizeProjectFacts({
  id: "project-schedule",
  title: "University Schedule Platform",
  contribution: "برمجت خصائص إدارة الجداول الجامعية.",
  achievements: [{ id: "generated-old", text: "نقطة مولدة يجب ألا تصبح حقيقة مصدرية." }],
});
assert.deepStrictEqual(project.contributions, ["برمجت خصائص إدارة الجداول الجامعية."]);

const profile = {
  personalInfo: {
    fullName: "Regression Student",
    major: "Information Technology",
    studentStatus: "student",
  },
  experiences: [{
    id: "experience-dar-alriyadh",
    title: "Software Development Intern",
    organization: "شركة دار الرياض",
    description: internshipTasks,
  }],
  projects: [{
    id: "project-schedule",
    title: "University Schedule Platform",
    responsibilities: ["برمجت خصائص إدارة الجداول الجامعية."],
  }],
  volunteering: [
    { id: "activity-tarmeez", title: "Software Designer and Developer", organization: "نادي ترميز", description: tarmeezContribution },
    { id: "activity-enjaz", title: "Programmer", organization: "نادي إنجاز", details: enjazContribution },
  ],
};

const canonical = composeCanonicalResume(profile, {
  projects: [{ id: "project-schedule", description: "Portfolio must not override ResumeProfile." }],
});
assert.strictEqual(canonical.factsProvenance.factsOwner, "resume");
assert.strictEqual(canonical.verifiedResumeFacts.experiences[0].responsibilities.length, 1);
assert.strictEqual(canonical.verifiedResumeFacts.volunteering[0].contributions.length, 1);
assert.strictEqual(canonical.verifiedResumeFacts.volunteering[1].contributions.length, 1);
assert.deepStrictEqual(canonical.verifiedResumeFacts.projects[0].contributions, ["برمجت خصائص إدارة الجداول الجامعية."]);

const enrichmentFacts = buildUserSourceEnrichmentFacts(canonical.verifiedResumeFacts);
assert.strictEqual(enrichmentFacts.experiences[0].responsibilities.length, 1);
assert.strictEqual(enrichmentFacts.volunteering[0].contributions.length, 1);
assert.strictEqual(enrichmentFacts.volunteering[1].contributions.length, 1);

const agentFacts = compactVerifiedResumeFacts(canonical.verifiedResumeFacts);
assert.strictEqual(agentFacts.experiences[0].responsibilities.length, 1);
assert.strictEqual(agentFacts.volunteering[0].contributions.length, 1);
assert.strictEqual(agentFacts.volunteering[1].contributions.length, 1);
assert.strictEqual(agentFacts.projects[0].contributions.length, 1);

console.log("resume fact normalization tests passed");
