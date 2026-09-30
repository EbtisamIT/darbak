// Optional real Chromium test. All resources are supplied by fixtures; no network.
const assert = require("node:assert/strict");
const { renderPage } = require("../services/opportunityDiscovery/browser");
const { extractOpportunity } = require("../services/opportunityDiscovery/stages");
const executablePath = process.env.DISCOVERY_BROWSER_EXECUTABLE;
if (!executablePath) throw new Error("Set DISCOVERY_BROWSER_EXECUTABLE to an installed Chromium executable");
const url = "https://official.example/careers/job/42";
const source = { company: "Test Company", metadata: { adapter: "generic", aliases: [], scopes: ["https://official.example/careers/"] } };
const posting = { "@type": "JobPosting", title: "COOP Intern", description: "University students gain practical training.", url };
const initial = { url, status: 200, headers: { "content-type": "text/html" }, text: '<html><body><div id="root"></div><script src="/careers/app.js"></script></body></html>' };
let blocked = false;
const reader = { read: async () => initial, readAsset: async (target) => {
  assert.equal(target, "https://official.example/careers/app.js");
  if (blocked) throw new Error("ROBOTS_DISALLOWED");
  return { url: target, status: 200, headers: { "content-type": "application/javascript" },
    text: `const script=document.createElement("script");script.type="application/ld+json";script.textContent=${JSON.stringify(JSON.stringify(posting))};document.body.append(script);` };
} };
(async () => {
  const result = await extractOpportunity({ url }, source, reader, { browserRenderer: (u, s, r) => renderPage(u, s, r, { executablePath }) });
  assert.equal(result.fetchMethod, "browser"); assert.equal(result.jobs[0].title, posting.title);
  blocked = true;
  await assert.rejects(renderPage(url, source, reader, { executablePath }), /POLICY_DENIED/);
  console.log("Real Chromium integration PASS: dynamic extraction, denied resources never bypassed; fixture transport only");
})().catch((e) => { console.error(e); process.exitCode = 1; });
