const assert = require("node:assert/strict");
const { structuredJobs, trainingType } = require("../services/opportunityDiscovery/extract");

const url = "https://careers.example.test/jobs/123-internship";
const source = { metadata: { scopes: ["https://careers.example.test/"], aliases: [] } };
const description = `<p>Senior students seeking university training.</p>
<p><strong>What you'll be doing</strong></p><p>Support team research.</p>
<p><strong>Key Responsibilities</strong></p><p>Document findings.</p>
<p><strong>What you’ll need to succeed</strong></p>
<ul><li><p><strong>Eligibility</strong>: Senior university student.</p></li><li><p>Basic Excel knowledge.</p></li></ul>
<p><strong>What we can offer you</strong></p><p>Benefits must not become requirements.</p>`;
for (const content of [description, description.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")]) {
  const html = `<script type="application/ld+json">${JSON.stringify({ "@type": "JobPosting",
    title: "Senior Students - Internship Training Program", description: content,
    hiringOrganization: { name: "Example" }, datePosted: "2026-09-07", jobLocation: { address: { addressLocality: "Riyadh", addressCountry: "SA" } },
  })}</script><button data-action="showForm">Apply now</button>`;
  const job = structuredJobs(html, url, source)[0];
  assert.equal(trainingType(job.title, job.description), "internship");
  assert.deepEqual(job.responsibilities, ["Support team research.", "Document findings."]);
  assert.deepEqual(job.requirements, ["Eligibility: Senior university student.", "Basic Excel knowledge."]);
  assert.ok(!job.description.includes("<p>"));
  assert.equal(job.extractionEvidence.requirements.heading, "What you’ll need to succeed");
  assert.equal(job.applyVisible, false, "a JS-only button does not prove the application form works");
}
assert.equal(trainingType("People Experience - Trainee", "Fresh Graduated. Eligible for Tamheer."), "internship");
assert.equal(trainingType("Internship", "University students can apply."), "internship");
assert.equal(trainingType("Senior Software Engineer", "Mentorship of university interns."), null);
assert.equal(trainingType("Senior Internship Manager", "Support university students."), null);
assert.equal(trainingType("Training Manager", "Fresh graduates."), null);
console.log("opportunity live parsing regression tests passed");
