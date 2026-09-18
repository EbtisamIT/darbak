const assert = require("assert");
const {
  buildCompanyEnrichment,
  mergeAutoEnrichment,
} = require("../services/companyEnrichment");

const aramcoDraft = buildCompanyEnrichment({
  suggestedName: "Aramco",
  aliases: ["Aramco", "أرامكو"],
  experiencesCount: 8,
  interviewsCount: 2,
  opportunitiesCount: 1,
});
assert.equal(aramcoDraft.confidence, "high");
assert.equal(aramcoDraft.slug, "aramco");
assert.equal(aramcoDraft.website, "https://www.aramco.com/");
assert.ok(aramcoDraft.sources.some((source) => source.type === "official_website"));

const internalDraft = buildCompanyEnrichment({
  suggestedName: "جهة تدريب محلية",
  aliases: ["جهة تدريب محلية"],
  experiencesCount: 3,
  interviewsCount: 0,
  opportunitiesCount: 0,
});
assert.equal(internalDraft.confidence, "medium");
assert.equal(internalDraft.website, "");

const ambiguousDraft = buildCompanyEnrichment({
  suggestedName: "جهة",
  aliases: ["جهة", "جهة تدريب", "اسم آخر", "اسم ثالث", "اسم رابع", "اسم خامس"],
  experiencesCount: 1,
});
assert.equal(ambiguousDraft.confidence, "low");

const reviewed = mergeAutoEnrichment(
  { name: "اسم يدوي", fieldProvenance: { name: "manual", website: "manual" } },
  aramcoDraft
);
assert.equal(reviewed.name, undefined);
assert.equal(reviewed.website, undefined);
assert.equal(reviewed.enrichmentStatus, "draft");
assert.equal(reviewed.fieldProvenance.name, "manual");

console.log("company enrichment tests passed");
