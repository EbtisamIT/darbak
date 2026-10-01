const Candidate = require("../models/OpportunityCandidate");
const Company = require("../models/Company");
const { registrySources } = require("./opportunityDiscovery/management");
const { allowedUrl } = require("./opportunityDiscovery/http");
const { companyAliasesMatchName } = require("./companyDirectorySeeds");
const { enrichOpportunityUrl } = require("./opportunityEnrichment");
const { inputSchema, normalize } = require("./opportunityCandidateData");
const { classifyCandidate, fail } = require("./opportunityCandidates");
const { renderPage } = require("./opportunityDiscovery/browser");

async function retryEnrichment(id, { sources, enrich = enrichOpportunityUrl } = {}) {
  const candidate = await Candidate.findById(id).select("+rawContent +extractionEvidence");
  if (!candidate) fail(404, "المرشح غير موجود.");
  if (candidate.isDemo || ["published", "rejected"].includes(candidate.status)) fail(409, "هذا المرشح غير قابل لإعادة الإثراء.");
  const approved = sources || await registrySources({ activeOnly: true });
  const matches = approved.filter((source) => source.reviewStatus === "approved" && source.active !== false && allowedUrl(candidate.sourceUrl, source));
  if (matches.length !== 1) fail(422, "لا يوجد مصدر رسمي معتمد وحيد لهذا الرابط. راجعي سجل المصادر أولًا.");
  const source = matches[0];
  const companies = await Company.find({ logoUrl: { $nin: [null, ""] } }).select("name nameAr nameEn aliases contentAliases logoUrl").lean();
  const identities = companies.filter((company) => companyAliasesMatchName(company, source.company));
  const result = await enrich({ url: candidate.sourceUrl, source }, { logo: identities.length === 1 ? identities[0].logoUrl : "",
    browserRenderer: process.env.DISCOVERY_BROWSER_EXECUTABLE ? renderPage : undefined });
  const rows = result.results.filter((row) => row.data);
  if (rows.length !== 1) fail(422, `لم يُستخرج إعلان واحد موثوق؛ السجل لم يتغير (${result.reason || result.results[0]?.code || "NO_JOB_CONTENT"}).`);
  const previous = candidate.toObject(), next = { ...previous, ...rows[0].data };
  for (const field of candidate.manualFields || []) {
    if (["verification", "pageAvailability", "applicationState", "realJobPosting", "verificationWarnings",
      "rawContent", "extractionEvidence", "enrichedAt", "enrichmentVersion", "confidenceScore"].includes(field)) continue;
    next[field] = previous[field];
    next.extractionEvidence[field] = { sourceUrl: previous.sourceUrl, method: "admin_review", rawText: String(previous[field] || "").slice(0, 6000) };
  }
  const data = inputSchema.parse(next);
  if (normalize(data.company) !== normalize(rows[0].data.company)) data.verification.companyVerified = null;
  Object.assign(candidate, data, await classifyCandidate(data, { id, isDemo: false }));
  // optimisticConcurrency prevents a slow retry overwriting a newer admin edit.
  await candidate.save();
  return candidate;
}
module.exports = { retryEnrichment };
