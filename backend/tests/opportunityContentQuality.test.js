const assert = require("node:assert/strict");
const { cleanOpportunityContent } = require("../services/opportunityContentQuality");
const { enrichExtractedJob } = require("../services/opportunityEnrichment");
const { inputSchema } = require("../services/opportunityCandidateData");
const base = { title: "Marketing Internship - Riyadh", description: "For over seven decades, we have been a global leader. Our culture puts people first.",
  responsibilities: ["By being part of our journey, you can make a real impact on customers and some of the finest brands in the world.",
    "We are always looking for ambitious students from a wide range of backgrounds.", "You will be empowered to innovate, develop and learn in a fun and supportive environment!"],
  requirements: ["You must be a senior student.", "Basic Excel knowledge."] };
const cleaned = cleanOpportunityContent(base);
assert.deepEqual(cleaned.responsibilities, []);
assert.equal(cleaned.description, base.title);
assert.equal(cleaned.contentQualityWarning, true);
assert.deepEqual(cleaned.requirements, base.requirements);
const task = "The Trade Compliance Trainee supports customs operations by handling data entry and ensuring documentation is archived.";
const mixed = cleanOpportunityContent({ ...base, description: `${base.description} ${task}`, responsibilities: [task] });
assert.equal(mixed.description, task);
assert.deepEqual(mixed.responsibilities, [task]);
assert.equal(mixed.contentQualityWarning, false);
const real = cleanOpportunityContent({ title: "Software Intern", description: "The intern will develop software and assist with testing.", responsibilities: ["Develop software.", "Analyze test results."], requirements: [] });
assert.equal(real.responsibilities.length, 2);
assert.equal(real.description, "The intern will develop software and assist with testing.");
const arabic = cleanOpportunityContent({ title: "تدريب تسويق", description: "شركة رائدة عالميا. المتدرب مسؤول عن إعداد التقارير ومتابعة الحملات.", responsibilities: ["بيئة عمل محفزة.", "إعداد التقارير ومتابعة الحملات."], requirements: ["طالب جامعي"] });
assert.deepEqual(arabic.responsibilities, ["إعداد التقارير ومتابعة الحملات."]);
assert.equal(arabic.contentQualityWarning, true);
assert.equal(arabic.description.includes("شركة رائدة"), false);
const enriched = enrichExtractedJob({ ...base, sourceUrl: "https://example.com/jobs/1", rawContent: base.description }, { company: "Example", officialDomains: ["example.com"] });
assert.equal(inputSchema.parse(enriched).contentQualityWarning, true);
assert.equal(enriched.rawContent, base.description);
assert.equal(enriched.extractionEvidence.contentQuality.method, "boilerplate_filter");
console.log("Opportunity content quality PASS: role-only description, no fabricated duties, branding filtered, real duties retained, warning/evidence/raw source preserved.");
