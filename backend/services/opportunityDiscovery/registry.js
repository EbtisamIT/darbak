const { z } = require("zod");
const { normalize, cleanOpportunityUrl } = require("../opportunityCandidateData");
const { allowedUrl, publicAddress } = require("./http");
const net = require("net");
const providers = ["generic", "teamtailor", "greenhouse", "lever", "smartrecruiters", "workday", "oracle", "successfactors"];
const domain = z.string().trim().toLowerCase().max(253).refine((v) =>
  /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(v) && v.includes(".") && !v.endsWith(".local") &&
  !v.endsWith(".internal") && !v.includes("..") && (!net.isIP(v) || publicAddress(v)), "Invalid domain");
const secureUrl = z.string().max(3000).transform((value) => cleanOpportunityUrl(value)).refine((value) => {
  const u = new URL(value); return u.protocol === "https:" && (!u.port || u.port === "443");
});
const sourceSchema = z.object({
  key: z.string().regex(/^[a-z0-9][a-z0-9-]{1,79}$/), name: z.string().trim().min(1).max(240),
  company: z.string().trim().min(1).max(240), sourceUrl: secureUrl,
  sourceType: z.enum(["company", "ats", "university", "other"]).default("company"),
  country: z.literal("SA").default("SA"), trustScore: z.number().min(0).max(100).default(80),
  officialDomains: z.array(domain).min(1).max(10), careerDomains: z.array(domain).max(10).default([]),
  atsProvider: z.enum(providers).default("generic"),
  atsIdentifiers: z.object({ tenant: z.string().regex(/^[\w-]{1,100}$/).optional(), apiUrl: secureUrl.optional() }).default({}),
  searchQueries: z.array(z.string().trim().min(1).max(300)).max(24).default([]),
  aliases: z.array(z.string().trim().min(1).max(240)).max(30).default([]),
  scopes: z.array(secureUrl).min(1).max(20),
  approvalEvidence: z.array(secureUrl).min(1).max(20),
});
const SHARED_ATS = /(?:greenhouse\.io|lever\.co|smartrecruiters\.com|myworkdayjobs\.com|oraclecloud\.com|successfactors\.(?:com|eu))$/i;
function validateSource(input) {
  const row = sourceSchema.parse(input), hosts = new Set([...row.officialDomains, ...row.careerDomains]);
  for (const value of row.scopes) {
    const u = new URL(value);
    if (!hosts.has(u.hostname) || (SHARED_ATS.test(u.hostname) && u.pathname === "/")) throw new Error("TENANT_SCOPED_URL_REQUIRED");
    if (/(?:greenhouse\.io|lever\.co|smartrecruiters\.com)$/i.test(u.hostname)) {
      const tenant = row.atsIdentifiers.tenant;
      const prefix = u.hostname === "boards-api.greenhouse.io" ? `/v1/boards/${tenant}` :
        /^api(?:\.eu)?\.lever\.co$/.test(u.hostname) ? `/v0/postings/${tenant}` :
          u.hostname === "api.smartrecruiters.com" ? `/v1/companies/${tenant}/postings` : `/${tenant}`;
      if (!tenant || !(u.pathname === prefix || u.pathname.startsWith(`${prefix}/`))) throw new Error("TENANT_SCOPED_URL_REQUIRED");
    }
  }
  if (!row.approvalEvidence.every((value) => row.officialDomains.includes(new URL(value).hostname))) throw new Error("OFFICIAL_EVIDENCE_REQUIRED");
  const source = { ...row, baseUrl: new URL(row.sourceUrl).origin, companyNormalized: normalize(row.company),
    active: false, reviewStatus: "pending", metadata: { adapter: row.atsProvider, aliases: row.aliases, scopes: row.scopes,
      maxPages: 8, maxRequests: 20, maxCandidates: 5, maxQueries: 3 } };
  if (!allowedUrl(row.sourceUrl, source) || (row.atsIdentifiers.apiUrl && !allowedUrl(row.atsIdentifiers.apiUrl, source))) throw new Error("UNAPPROVED_URL_SCOPE");
  return source;
}
function sourceExport(row) {
  return { key: row.key, name: row.name, company: row.company, sourceUrl: row.sourceUrl, sourceType: row.sourceType,
    country: row.country || "SA", trustScore: row.trustScore, officialDomains: row.officialDomains,
    careerDomains: row.careerDomains, atsProvider: row.atsProvider || row.metadata.adapter,
    atsIdentifiers: row.atsIdentifiers || {}, searchQueries: row.searchQueries || [],
    aliases: row.metadata.aliases, scopes: row.metadata.scopes, approvalEvidence: row.approvalEvidence || [row.sourceUrl] };
}
module.exports = { validateSource, sourceExport };
