const Source = require("../../models/OpportunitySource");
const Lead = require("../../models/OpportunityEmailLead");
const { SOURCES } = require("./sources");
const { validateSource, sourceExport } = require("./registry");
const { normalize } = require("../opportunityCandidateData");
const { existingEmails, fail, createOpportunityCandidate } = require("../opportunityCandidates");
const { createReader } = require("./http");
const { testOpportunityUrl } = require("./stages");
const { renderPage } = require("./browser");
const Company = require("../../models/Company");
const { companyAliasesMatchName } = require("../companyDirectorySeeds");

async function registrySources({ activeOnly = false } = {}) {
  const states = await Source.find({}).limit(1000).lean();
  const builtins = SOURCES.map((row) => ({ ...row, ...Object.fromEntries(Object.entries(states.find((s) => s.key === row.key) || {})
    .filter(([key]) => ["active", "lastCheckedAt", "lastSuccessAt", "lastError", "lastOpportunityFoundAt", "failureCount"].includes(key))) }));
  const imported = states.filter((s) => !SOURCES.some((b) => b.key === s.key));
  const rows = [...builtins, ...imported];
  return activeOnly ? rows.filter((s) => s.active && s.reviewStatus === "approved") : rows;
}
async function importSources(input) {
  if (!Array.isArray(input) || !input.length || input.length > 100) fail(400, "ملف JSON يجب أن يحتوي من 1 إلى 100 مصدر.");
  let sources;
  try { sources = input.map(validateSource); } catch (e) { fail(400, `ملف المصادر غير صالح: ${e.name === "ZodError" ? "راجعي الحقول والنطاقات" : e.message}`); }
  if (new Set(sources.map((s) => s.key)).size !== sources.length) fail(400, "مفتاح المصدر مكرر في الملف.");
  let added = 0, existing = 0;
  for (const source of sources) {
    if (SOURCES.some((s) => s.key === source.key)) { existing++; continue; }
    const result = await Source.updateOne({ key: source.key }, { $setOnInsert: source }, { upsert: true });
    if (result.upsertedCount) added++; else existing++;
  }
  return { added, existing, message: "المصادر الجديدة غير مفعلة وبانتظار مراجعة النطاقات وروابط الإثبات." };
}
async function approveSource(key, confirmation) {
  if (confirmation !== true) fail(400, "أكدي مراجعة ملكية النطاق وربط ATS الرسمي قبل التفعيل.");
  const row = await Source.findOne({ key }).lean(); if (!row) fail(404, "المصدر غير موجود.");
  if (!SOURCES.some((s) => s.key === key)) validateSource(sourceExport(row));
  return Source.findOneAndUpdate({ key }, { $set: { active: true, reviewStatus: "approved", reviewedAt: new Date() } }, { new: true });
}
async function saveEmailLead(lead, { session = null, dryRun = false } = {}) {
  const filter = { companyNormalized: normalize(lead.company), email: lead.email.trim().toLowerCase() };
  if (dryRun) return !(await Lead.exists(filter));
  const known = await existingEmails([{ discoveredEmails: [{ email: filter.email }] }], { session });
  const result = await Lead.updateOne(filter,
    { $setOnInsert: { ...lead, ...filter, status: known.has(filter.email) ? "existing" : "new" } }, { upsert: true, session });
  return Boolean(result.upsertedCount);
}
async function testKnownUrl({ sourceKey, url, sendToInbox = false }) {
  if (typeof url !== "string" || url.length > 3000 || typeof sourceKey !== "string" || typeof sendToInbox !== "boolean") fail(400, "حددي المصدر ورابط الإعلان.");
  const source = (await registrySources()).find((s) => s.key === sourceKey && s.reviewStatus === "approved");
  if (!source) fail(400, "المصدر غير معتمد. استورديه وراجعي نطاقاته أولًا.");
  const companies = await Company.find({ logoUrl: { $nin: ["", null] } }).select("name nameAr nameEn aliases contentAliases logoUrl").lean();
  const matches = companies.filter((company) => companyAliasesMatchName(company, source.company));
  const result = await testOpportunityUrl(source, url, { reader: createReader(source),
    enrichment: true,
    logo: matches.length === 1 ? matches[0].logoUrl : "",
    browserRenderer: process.env.DISCOVERY_BROWSER_EXECUTABLE ? renderPage : undefined });
  if (sendToInbox) {
    const valid = result.results.filter((row) => row.data && row.code !== "CLOSED");
    if (!valid.length) fail(400, "لا يوجد إعلان مؤهل لإرساله للصندوق. راجعي نتيجة الاختبار.");
    result.candidates = [];
    for (const row of valid) {
      const candidate = await createOpportunityCandidate({ ...row.data, aiNotes: `${row.data.aiNotes} fetchMethod=${row.fetchMethod}` },
        { audit: { importedVia: "official_discovery" } });
      result.candidates.push({ id: candidate._id, status: candidate.status });
    }
  }
  return result;
}
module.exports = { registrySources, importSources, approveSource, saveEmailLead, testKnownUrl, sourceExport };
