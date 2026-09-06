const assert = require("assert");
const {
  DEMO_PROGRAM,
  DEMO_APPLICANTS,
  buildCompanyPortalPresentation,
  shouldShowCompanyPortalDemo,
} = require("../services/companyPortalDemo");

assert.strictEqual(shouldShowCompanyPortalDemo({ status: "trial" }), true);
assert.strictEqual(shouldShowCompanyPortalDemo({ status: "trial", demoPortalDismissedAt: new Date() }), false);
assert.strictEqual(shouldShowCompanyPortalDemo({ status: "active", demoPortalEnabled: true }), true);

const noDemo = buildCompanyPortalPresentation({ demoEnabled: false, realApplicants: [] });
assert.strictEqual(noDemo.demoMode, false);
assert.strictEqual(noDemo.applicants.length, 0);
assert.deepStrictEqual(noDemo.metrics, { total: 0, new: 0, reviewing: 0, shortlisted: 0 });

const demo = buildCompanyPortalPresentation({ demoEnabled: true, realApplicants: [] });
assert.strictEqual(demo.demoMode, true);
assert.strictEqual(demo.applicants.length, 1);
assert.strictEqual(demo.programs.length, 1);
assert.strictEqual(demo.programs[0].id, DEMO_PROGRAM.id);
assert.strictEqual(demo.metrics.total, 1);
assert.strictEqual(demo.metrics.new, 1);
assert.strictEqual(demo.metrics.reviewing, 0);
assert.strictEqual(demo.metrics.shortlisted, 0);
assert.strictEqual(demo.applicants[0].fullName, "سارة العتيبي");
assert.strictEqual(demo.programs[0].opportunityTitle, "برنامج التدريب التعاوني — تجريبي");
assert.strictEqual(demo.applicants[0].city, "الرياض");
assert.ok(demo.applicants[0].demoResume);
assert.ok(DEMO_APPLICANTS.every((applicant) => applicant.isDemo));
assert.ok(DEMO_APPLICANTS.every((applicant) => applicant.email.endsWith("@example.com")));
assert.ok(DEMO_APPLICANTS.every((applicant) => !Object.prototype.hasOwnProperty.call(applicant, "phone")));

const real = buildCompanyPortalPresentation({
  demoEnabled: true,
  realApplicants: [{ id: "real-1", fullName: "طالب حقيقي", status: "submitted" }],
});
assert.strictEqual(real.demoMode, false);
assert.strictEqual(real.hasRealApplicants, true);
assert.strictEqual(real.applicants.length, 1);
assert.strictEqual(real.applicants[0].isDemo, false);
assert.strictEqual(real.metrics.total, 1);
assert.strictEqual(real.metrics.new, 1);

const realProgram = buildCompanyPortalPresentation({
  demoEnabled: true,
  realApplicants: [],
  realProgramCount: 1,
});
assert.strictEqual(realProgram.demoMode, false);
assert.strictEqual(realProgram.programs.length, 0);

const preciseMetrics = buildCompanyPortalPresentation({
  demoEnabled: true,
  realApplicants: [{ id: "recent-real", fullName: "متقدم حديث", status: "submitted" }],
  realApplicantCount: 18,
  realMetrics: { total: 18, new: 7, reviewing: 8, shortlisted: 3 },
});
assert.strictEqual(preciseMetrics.demoMode, false);
assert.deepStrictEqual(preciseMetrics.metrics, { total: 18, new: 7, reviewing: 8, shortlisted: 3 });

console.log("companyPortalDemo tests passed");
