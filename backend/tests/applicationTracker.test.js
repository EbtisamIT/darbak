const assert = require("assert");
const ApplicationTracker = require("../models/ApplicationTracker");
const CompanyApplication = require("../models/CompanyApplication");

const tracker = new ApplicationTracker({
  studentId: "507f1f77bcf86cd799439011",
  opportunityId: "507f1f77bcf86cd799439012",
  companyName: "شركة تدريب",
  roleTitle: "محلل أعمال",
  sourceType: "external_link",
  studentStatus: "applied",
});

assert.strictEqual(tracker.studentStatus, "applied");
assert.strictEqual(tracker.sourceType, "external_link");

const companyApplication = new CompanyApplication({
  companySlug: "test-company",
  organizationName: "شركة اختبار",
  fullName: "طالب اختبار",
  email: "student@example.com",
  normalizedEmail: "student@example.com",
});

assert.strictEqual(companyApplication.studentStatus, "applied");
console.log("application tracker tests passed");
