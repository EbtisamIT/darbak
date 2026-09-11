const assert = require("assert");
const { rankResumeSkills } = require("../services/resumeSkillRanking");

const names = (result) => result.map((item) => item.name);

const cs = rankResumeSkills({
  verifiedSkills: ["Figma", "react", "Node.js", "MongoDB", "Git", "REST APIs", "Firebase", "Python"],
  personalInfo: { major: "Computer Science" },
  evidence: {
    projects: [
      { title: "Web app", description: "Built with React.js, Node.js, MongoDB, REST APIs and Firebase." },
      { title: "Arabic classifier", description: "Implemented with Python." },
    ],
  },
});
assert.deepStrictEqual(names(cs), ["Python", "React.js", "Node.js", "MongoDB", "REST APIs", "Firebase", "Git", "Figma"]);
assert.strictEqual(cs[0].evidenceStrength, "moderate");

const accounting = rankResumeSkills({
  verifiedSkills: ["Data Entry", "Excel", "Financial Reporting", "Accounting"],
  personalInfo: { major: "Accounting" },
  evidence: { experiences: [{ description: "Reviewed accounting records, prepared financial reporting, and used Microsoft Excel." }] },
});
assert.deepStrictEqual(names(accounting), ["Accounting", "Microsoft Excel", "Financial Reporting", "Data Entry"]);

const mis = rankResumeSkills({
  verifiedSkills: ["Microsoft PowerPoint", "Figma", "SQL", "Data Analysis", "Power BI", "Excel"],
  personalInfo: { major: "Management Information Systems" },
  evidence: { projects: [{ description: "Created a Power BI sales dashboard using Microsoft Excel and Figma." }] },
});
assert.deepStrictEqual(names(mis), ["Power BI", "Microsoft Excel", "Figma", "Data Analysis", "SQL", "Microsoft PowerPoint"]);
assert.strictEqual(new Set(names(mis)).size, mis.length);
assert.ok(names(mis).every((skill) => ["Microsoft PowerPoint", "Figma", "SQL", "Data Analysis", "Power BI", "Microsoft Excel"].includes(skill)));

const stableAgain = rankResumeSkills({
  verifiedSkills: ["Microsoft PowerPoint", "Figma", "SQL", "Data Analysis", "Power BI", "Excel"],
  personalInfo: { major: "Management Information Systems" },
  evidence: { projects: [{ description: "Created a Power BI sales dashboard using Microsoft Excel and Figma." }] },
});
assert.deepStrictEqual(names(stableAgain), names(mis));

console.log("resumeSkillRanking tests passed");
