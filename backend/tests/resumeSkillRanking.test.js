const assert = require("assert");
const { MAX_DISPLAY_SKILLS, rankResumeSkills } = require("../services/resumeSkillRanking");

const names = (result) => result.map((item) => item.name);
const strengths = (result) => Object.fromEntries(result.map((item) => [item.name, item.evidenceStrength]));

const faisalSource = ["Figma", "react", "Node.js", "MongoDB", "Git", "REST APIs", "FireBase", "Python"];
const faisal = rankResumeSkills({
  verifiedSkills: faisalSource,
  major: "Computer Science",
  personalInfo: { studentStatus: "student" },
  projectEvidence: [
    { title: "Web app", tools: ["React.js", "Node.js", "MongoDB", "REST APIs", "Firebase"] },
    { title: "Arabic classifier", description: "Implemented Arabic text classification with Python." },
  ],
});
assert.deepStrictEqual(names(faisal), ["Python", "React.js", "Node.js", "MongoDB", "REST APIs", "Firebase", "Git", "Figma"]);
assert.strictEqual(strengths(faisal).Python, "strong");
assert.strictEqual(strengths(faisal)["React.js"], "strong");
assert.strictEqual(strengths(faisal).Figma, "weak");
assert.deepStrictEqual(faisalSource, ["Figma", "react", "Node.js", "MongoDB", "Git", "REST APIs", "FireBase", "Python"]);

const dana = rankResumeSkills({
  verifiedSkills: ["Data Entry", "Excel", "Financial Reporting", "Accounting"],
  major: "Accounting",
  personalInfo: { studentStatus: "graduate" },
  experienceEvidence: [{ responsibilities: ["Reviewed accounting records", "Prepared financial reports", "Used Microsoft Excel"] }],
});
assert.deepStrictEqual(names(dana), ["Accounting", "Microsoft Excel", "Financial Reporting", "Data Entry"]);
assert.deepStrictEqual(strengths(dana), {
  Accounting: "strong",
  "Microsoft Excel": "strong",
  "Financial Reporting": "strong",
  "Data Entry": "moderate",
});

const sara = rankResumeSkills({
  verifiedSkills: ["Microsoft PowerPoint", "figma", "SQL", "Data Analysis", "Power BI", "Excel"],
  major: "Management Information Systems",
  academicTrack: "Business Analytics",
  personalInfo: { studentStatus: "student" },
  projectEvidence: [
    { description: "Created a Power BI sales dashboard using Microsoft Excel for data analysis." },
    { title: "Reservation prototype", tools: ["Figma"] },
  ],
});
assert.deepStrictEqual(names(sara), ["Power BI", "Microsoft Excel", "Data Analysis", "Figma", "SQL", "Microsoft PowerPoint"]);
assert.deepStrictEqual(strengths(sara), {
  "Power BI": "strong",
  "Microsoft Excel": "strong",
  "Data Analysis": "strong",
  Figma: "strong",
  SQL: "moderate",
  "Microsoft PowerPoint": "moderate",
});

const stableAgain = rankResumeSkills({
  verifiedSkills: ["Microsoft PowerPoint", "figma", "SQL", "Data Analysis", "Power BI", "Excel"],
  major: "Management Information Systems",
  academicTrack: "Business Analytics",
  personalInfo: { studentStatus: "student" },
  projectEvidence: [
    { description: "Created a Power BI sales dashboard using Microsoft Excel for data analysis." },
    { title: "Reservation prototype", tools: ["Figma"] },
  ],
});
assert.deepStrictEqual(names(stableAgain), names(sara));

const fifteenSource = Array.from({ length: 15 }, (_, index) => `Skill ${String(index + 1).padStart(2, "0")}`);
const limitedDisplay = rankResumeSkills({ verifiedSkills: fifteenSource });
assert.strictEqual(limitedDisplay.length, MAX_DISPLAY_SKILLS);
assert.ok(names(limitedDisplay).every((skill) => fifteenSource.includes(skill)));
assert.strictEqual(new Set(names(limitedDisplay)).size, limitedDisplay.length);
assert.strictEqual(fifteenSource.length, 15);

const threeSource = ["github", "reactjs", "sql"];
const threeDisplay = rankResumeSkills({ verifiedSkills: threeSource, major: "Computer Science" });
assert.deepStrictEqual(names(threeDisplay), ["React.js", "GitHub", "SQL"]);
assert.strictEqual(threeDisplay.length, 3);

console.log("resumeSkillRanking tests passed");
