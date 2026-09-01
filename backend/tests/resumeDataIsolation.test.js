const assert = require("assert");
const {
  buildGenerationCacheKey,
  getAccessQuery,
} = require("../agents/darbakResumeAgent");

const accountA = { contact: "a@example.test", accessCodeHash: "hash-a" };
const accountB = { contact: "b@example.test", accessCodeHash: "hash-b" };
const records = [
  {
    _id: "resume-a",
    ...accountA,
    major: "Business Administration",
    project: "Customer Satisfaction Analysis",
    experience: "Administrative Intern",
    organization: "Horizon Business Solutions",
    certification: "Project Management Fundamentals / Coursera",
  },
  {
    _id: "resume-b",
    ...accountB,
    major: "Information Technology",
    project: "Training Application Tracking System",
    skills: ["React.js", "JavaScript", "HTML", "CSS", "GitHub", "Firebase"],
  },
];

const findForAccess = (access) => records.find((record) =>
  Object.entries(getAccessQuery({ access })).every(([key, value]) => record[key] === value)
);

const resumeA = findForAccess(accountA);
const resumeB = findForAccess(accountB);
assert.strictEqual(resumeA.major, "Business Administration");
assert.strictEqual(resumeB.major, "Information Technology");
assert.notStrictEqual(resumeB.project, "Customer Satisfaction Analysis");
assert(!Object.values(resumeB).includes("Administrative Intern"));
assert(!Object.values(resumeB).includes("Horizon Business Solutions"));
assert(!Object.values(resumeB).includes("Project Management Fundamentals / Coursera"));

const findOwnedById = (id, access) => records.find((record) =>
  record._id === id
  && Object.entries(getAccessQuery({ access })).every(([key, value]) => record[key] === value)
);

assert.strictEqual(findOwnedById("resume-a", accountB), undefined, "account B cannot read account A by id");
assert.strictEqual(findOwnedById("resume-b", accountA), undefined, "account A cannot read account B by id");

const makeCacheKey = (access, facts) => buildGenerationCacheKey({
  session: {
    contact: access.contact,
    purpose: "create_resume",
    language: "en",
    collectedFacts: { answers: [] },
  },
  verifiedResumeFacts: facts,
  collectedFacts: { answers: [] },
});

const cacheA = makeCacheKey(accountA, resumeA);
const cacheB = makeCacheKey(accountB, resumeB);
assert.notStrictEqual(cacheA, cacheB, "sequential users must not share an agent output cache key");

const outputCache = new Map([
  [cacheA, { owner: accountA.contact, resume: resumeA }],
  [cacheB, { owner: accountB.contact, resume: resumeB }],
]);
assert.strictEqual(outputCache.get(cacheB).resume.project, "Training Application Tracking System");
assert.strictEqual(outputCache.get(cacheA).resume.project, "Customer Satisfaction Analysis");

console.log("resume data isolation tests passed");
