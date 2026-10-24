// Run locally after editing a source list. Generated candidates are never verified automatically.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { normalizeCompanyComparable } = require("../services/companyDirectorySeeds");

const root = path.resolve(__dirname, "../..");
const sources = [
  ["src/data/darbakGuideSuggestions.js", "darbakGuideOrganizations"],
  ["src/data/trainingInteractiveDirectory.js", "trainingInteractiveOrganizations"],
  ["src/data/healthHospitalSuggestions.js", "healthHospitalSuggestions"],
];
const candidates = new Map();
for (const [filename, exportName] of sources) {
  const code = fs.readFileSync(path.join(root, filename), "utf8").replace(/\bexport\s+(?=const\s)/g, "");
  const entries = vm.runInNewContext(`${code}\n${exportName}`, {});
  for (const entry of entries) {
    const emails = new Set([...(entry.emails || []), entry.email].filter(Boolean).map((value) => String(value).trim().toLowerCase()));
    for (const email of emails) {
      const key = `${normalizeCompanyComparable(entry.name)}\n${email}`;
      const row = candidates.get(key) || {
        company: entry.name, email, sourceNames: [], sourceUrl: "", contactType: "", usage: "", note: "",
        hqCity: "", claimedMajors: [],
      };
      row.sourceNames = [...new Set([...row.sourceNames, entry.source])];
      row.sourceUrl ||= entry.sourceUrl || entry.url || "";
      row.contactType ||= entry.contactType || "";
      row.usage ||= entry.usage || "";
      row.note ||= entry.note || "";
      row.hqCity ||= entry.city || ""; // Review ordering only, never training-city eligibility.
      row.claimedMajors = [...new Set([...row.claimedMajors, ...(entry.specialties || [])])]; // Review ordering only.
      candidates.set(key, row);
    }
  }
}
fs.writeFileSync(path.join(__dirname, "../data/autoApplyStaticEmailCandidates.json"), `${JSON.stringify([...candidates.values()], null, 2)}\n`);
console.log(`Prepared ${candidates.size} distinct company/email candidates for Admin review.`);
