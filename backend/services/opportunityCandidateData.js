const { z } = require("zod");
const { normalizeCompanyComparable: normalize } = require("./companyDirectorySeeds");
const { PAGE_AVAILABILITY, APPLICATION_STATES, readyForReview } = require("./opportunityApplicationPolicy");

const STATUSES = ["new", "ready", "needs_review", "duplicate", "update_existing", "rejected", "published", "expired"];
const PROGRAM_TYPES = ["coop", "internship", "summer", "graduate", "student_program", "graduate_program", "unknown"];
const SOURCE_TYPES = ["company", "ats", "linkedin", "university", "x", "telegram", "job_board", "other"];
const EMAIL_TYPES = ["application", "coop", "training", "internship", "careers", "recruitment", "hr", "general"];

function cleanOpportunityUrl(value = "") {
  if (!value) return "";
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("رابط غير صالح؛ استخدمي رابط HTTP أو HTTPS بدون بيانات دخول.");
  }
  for (const [key, value] of [...url.searchParams]) {
    if (/^(utm_.+|fbclid|gclid|referrer)$/i.test(key) || /chatgpt|openai/i.test(key) ||
      (/^(ref|source|via|attribution)$/i.test(key) && /chatgpt|openai/i.test(value))) {
      url.searchParams.delete(key);
    }
  }
  return url.toString();
}

const text = (max) => z.string().trim().max(max);
const list = z.array(text(2000)).max(80).transform((values) => [...new Set(values.filter(Boolean))]);
const date = z.union([z.string().datetime({ offset: true }), z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.date()])
  .refine((v) => typeof v !== "string" || v.includes("T") ||
    (!Number.isNaN(new Date(v).getTime()) && new Date(v).toISOString().slice(0, 10) === v), "تاريخ غير صالح")
  .transform((v) => new Date(v)).refine((v) => !Number.isNaN(v.getTime()), "تاريخ غير صالح").nullable();
const url = text(3000).transform((v, ctx) => {
  try { return cleanOpportunityUrl(v); } catch { ctx.addIssue({ code: "custom", message: "رابط غير صالح" }); return z.NEVER; }
});
const inputSchema = z.object({
  title: text(300).default(""), company: text(240).default(""), companyLogo: url.default(""),
  programType: z.enum(PROGRAM_TYPES).default("unknown"), majors: list.default([]), cities: list.default([]),
  remote: z.boolean().default(false), description: text(15000).default(""),
  responsibilities: list.default([]), requirements: list.default([]), applicationUrl: url.default(""), sourceUrl: url.default(""),
  sourceType: z.enum(SOURCE_TYPES).default("other"), postedAt: date.default(null), deadline: date.default(null),
  trainingStartDate: date.default(null), rawContent: text(50000).default(""), confidenceScore: z.number().min(0).max(100).default(0),
  verification: z.object({
    urlWorks: z.boolean().nullable().default(null), officialSource: z.boolean().nullable().default(null),
    appearsOpen: z.boolean().nullable().default(null), dateVerified: z.boolean().nullable().default(null),
    companyVerified: z.boolean().nullable().default(null),
  }).default({}),
  aiNotes: text(5000).default(""),
  duration: text(240).optional(), verificationNotes: text(5000).optional(),
  pageAvailability: z.enum(PAGE_AVAILABILITY).optional(), applicationState: z.enum(APPLICATION_STATES).optional(),
  realJobPosting: z.boolean().optional(), verificationWarnings: z.array(text(500)).max(10).optional(),
  contentQualityWarning: z.boolean().optional(),
  enrichmentVersion: z.literal(1).optional(), enrichedAt: date.optional(),
  majorScope: z.enum(["specific", "all", "broad", "unknown"]).optional(), rawMajors: list.optional(), rawCities: list.optional(),
  extractionEvidence: z.record(z.string().max(80), z.object({
    sourceUrl: url, method: text(80), heading: text(240).optional(), rawText: text(6000).optional(),
  })).optional(),
  searchDiscovery: z.preprocess((value) => value && typeof value === "object" &&
    Object.values(value).every((entry) => entry == null || entry === "" || (Array.isArray(entry) && !entry.length)) ? undefined : value,
  z.object({ provider: text(80), resultTitle: text(500), resultDescription: text(2000),
    resultPublishedAt: date, firstDiscoveredAt: date,
    discoveredByQueries: z.array(text(600)).max(100), classification: text(80),
  }).optional()),
  discoveredEmails: z.array(z.object({
    email: z.string().trim().toLowerCase().email().max(254), type: z.enum(EMAIL_TYPES).default("general"),
    sourceUrl: url.default(""), confidence: z.number().min(0).max(100).default(0),
  })).max(30).default([]),
});

const dateKey = (v) => v ? new Date(v).toISOString().slice(0, 10) : "";
const comparableUrl = (v) => {
  try { const u = new URL(cleanOpportunityUrl(v)); u.searchParams.sort(); return u.toString().replace(/\/$/, ""); }
  catch { return ""; }
};
const similarity = (a, b) => {
  const x = new Set(normalize(a).split(" ").filter(Boolean));
  const y = new Set(normalize(b).split(" ").filter(Boolean));
  return x.size && y.size ? [...x].filter((v) => y.has(v)).length / new Set([...x, ...y]).size : 0;
};
function inferProgramType(row) {
  if (row.programType === "graduate_program") return "graduate";
  if (row.programType && row.programType !== "unknown") return row.programType;
  const title = normalize(row.title);
  if (/تعاوني|\bcoop\b|co op/.test(title)) return "coop";
  if (/صيفي|summer/.test(title)) return "summer";
  if (/خريج|graduate/.test(title)) return "graduate";
  if (/internship|intern\b/.test(title)) return "internship";
  return "unknown";
}

function matchOpportunity(candidate, existing, sameCompany = false) {
  const company = normalize(candidate.company);
  if (!company || (!sameCompany && company !== normalize(existing.organizationName || existing.company))) return 0;
  const titleScore = similarity(candidate.title, existing.title);
  if (titleScore < 0.8) return 0;
  const typeA = inferProgramType(candidate), typeB = inferProgramType(existing);
  if (typeA !== "unknown" && typeB !== "unknown" && typeA !== typeB) return 0;
  const aCities = candidate.cities.map(normalize);
  const bCities = (existing.cities?.length ? existing.cities : [existing.city]).filter(Boolean).map(normalize);
  if (aCities.length && bCities.length && !aCities.some((v) => bCities.includes(v))) return 0;
  const urlsA = [candidate.applicationUrl, candidate.sourceUrl].map(comparableUrl).filter(Boolean);
  const urlsB = [existing.applicationUrl, existing.sourceUrl].map(comparableUrl).filter(Boolean);
  const sharedUrl = urlsA.find((u) => urlsB.includes(u));
  // Only a job-specific identifier can bridge changed deadlines. Generic
  // careers URLs recur across multiple campaigns and are not identities.
  const jobSpecific = sharedUrl && /[?&](job_?id|requisition_?id|reqid|gh_jid)=|\/(jobs?|requisitions?|positions?)\/[^/?]+/i.test(sharedUrl);
  if (candidate.deadline && existing.deadline && dateKey(candidate.deadline) !== dateKey(existing.deadline) && !jobSpecific) return 0;
  if (!sharedUrl && !(titleScore === 1 && aCities.length && bCities.length && candidate.deadline && existing.deadline)) return 0;
  return titleScore * 60 + (sharedUrl ? 25 : 0) + (aCities.length && bCities.length ? 5 : 0) +
    (candidate.deadline && existing.deadline ? 5 : 0) + (typeA === typeB && typeA !== "unknown" ? 5 : 0);
}

function candidateToOpportunity(candidate) {
  const note = [candidate.description,
    candidate.responsibilities.length ? `المهام:\n${candidate.responsibilities.map((v) => `- ${v}`).join("\n")}` : "",
    candidate.requirements.length ? `الشروط:\n${candidate.requirements.map((v) => `- ${v}`).join("\n")}` : "",
    candidate.trainingStartDate ? `بداية التدريب: ${dateKey(candidate.trainingStartDate)}` : "",
  ].filter(Boolean).join("\n\n");
  return {
    organizationName: candidate.company, title: candidate.title, logoUrl: candidate.companyLogo,
    cities: candidate.cities, city: candidate.cities[0] || "", specialties: candidate.majors,
    trainingMode: candidate.remote ? "remote" : "", applicationMethod: "website",
    applicationUrl: candidate.applicationUrl, sourceUrl: candidate.sourceUrl, note,
    deadline: candidate.deadline, status: "active", sourceType: "admin",
  };
}

const updateFields = ["organizationName", "title", "logoUrl", "cities", "city", "specialties", "trainingMode", "applicationUrl", "sourceUrl", "note", "deadline"];
function buildCandidateDiff(candidate, existing) {
  const proposed = candidateToOpportunity(candidate);
  return updateFields.filter((field) => {
    const value = proposed[field];
    return value != null && value !== "" && (!Array.isArray(value) || value.length);
  }).map((field) => ({
    field, before: existing[field] ?? null, after: proposed[field],
    changed: JSON.stringify(field === "deadline" ? dateKey(existing[field]) : existing[field] ?? null) !==
      JSON.stringify(field === "deadline" ? dateKey(proposed[field]) : proposed[field]),
  }));
}

function hasAdditionalData(candidate, existing) {
  return buildCandidateDiff(candidate, existing).some(({ field, before, after, changed }) => {
    if (!changed) return false;
    if (before == null || before === "" || (Array.isArray(before) && !before.length)) return true;
    if (Array.isArray(after)) return after.some((v) => !before.includes(v));
    if (field === "deadline") return new Date(after) > new Date(before);
    return field === "note" && after.length > String(before).length;
  });
}
function getMissingFields(candidate) {
  return ["title", "company", "applicationUrl", "sourceUrl", "description", "deadline", "cities", "majors"]
    .filter((key) => !candidate[key] || (Array.isArray(candidate[key]) && !candidate[key].length));
}
function isPublishable(candidate, now = new Date()) {
  if (candidate.deadline && dateKey(candidate.deadline) < dateKey(now)) return false;
  if (candidate.pageAvailability || candidate.applicationState) return readyForReview(candidate);
  return Boolean(candidate.title && candidate.company && candidate.applicationUrl && candidate.sourceUrl &&
    ["urlWorks", "officialSource", "appearsOpen", "dateVerified", "companyVerified"].every((key) => candidate.verification?.[key] === true));
}
module.exports = { STATUSES, PROGRAM_TYPES, SOURCE_TYPES, EMAIL_TYPES, inputSchema, cleanOpportunityUrl,
  normalize, matchOpportunity, candidateToOpportunity, buildCandidateDiff, hasAdditionalData, getMissingFields, isPublishable };
