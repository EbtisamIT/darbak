const mongoose = require("mongoose");
const crypto = require("crypto");
const Candidate = require("../models/OpportunityCandidate");
const Opportunity = require("../models/Opportunity");
const Company = require("../models/Company");
const { assessEnrichment } = require("./opportunityEnrichmentAssessment");
const { companyAliasesMatchName } = require("./companyDirectorySeeds");
const { inputSchema, normalize, matchOpportunity, hasAdditionalData, getMissingFields, isPublishable,
  candidateToOpportunity, buildCandidateDiff } = require("./opportunityCandidateData");

const fail = (status, message) => { const error = new Error(message); error.status = status; throw error; };
const projection = "organizationName title companyId applicationUrl sourceUrl cities city deadline specialties logoUrl note trainingMode status sourceType isDarbakApplication updatedAt";

async function classifyCandidate(data, { id, session = null, isDemo = false, previews = [] } = {}) {
  const companies = await Company.find({}).select("name nameAr nameEn aliases contentAliases").session(session).lean();
  const identities = companies.filter((company) => companyAliasesMatchName(company, data.company));
  // Ambiguous aliases must not widen matching. No weak shared-token merges.
  const identity = identities.length === 1 ? identities[0] : null;
  let best = null, bestScore = 0, tied = false;
  const cursor = Opportunity.find({}).select(projection).session(session).lean().cursor();
  for await (const existing of cursor) {
    const score = matchOpportunity(data, existing, Boolean(identity && companyAliasesMatchName(identity, existing.organizationName)));
    if (score > bestScore) { best = existing; bestScore = score; tied = false; }
    else if (score > 0 && score === bestScore) tied = true;
  }
  const base = { companyNormalized: normalize(data.company), missingFields: getMissingFields(data), duplicateOf: null, existingOpportunityId: null };
  if (data.enrichmentVersion) Object.assign(base, assessEnrichment(data));
  if (best && !tied) return { ...base, existingOpportunityId: best._id,
    ...(data.enrichmentVersion ? { reviewStatus: hasAdditionalData(data, best) ? "UPDATE_EXISTING" : "DUPLICATE" } : {}),
    status: hasAdditionalData(data, best) ? "update_existing" : "duplicate" };
  if (tied) return { ...base, status: "needs_review" };
  const inboxRows = Candidate.find({ companyNormalized: base.companyNormalized, isDemo,
    status: { $nin: ["rejected", "expired", "duplicate"] }, ...(id ? { _id: { $ne: id } } : {}) })
    .session(session).lean().cursor();
  for await (const other of inboxRows) {
    if (matchOpportunity(data, other)) return { ...base, status: "duplicate", duplicateOf: other._id,
      ...(data.enrichmentVersion ? { reviewStatus: "DUPLICATE" } : {}) };
  }
  // Dry runs include earlier items in this batch without persisting temporary rows.
  for (const other of previews) {
    if (other.companyNormalized === base.companyNormalized && !["rejected", "expired", "duplicate"].includes(other.status) &&
      matchOpportunity(data, other)) return { ...base, status: "duplicate", duplicateOf: other._id };
  }
  if (data.deadline && new Date(data.deadline).toISOString().slice(0, 10) < new Date().toISOString().slice(0, 10)) return { ...base, status: "expired" };
  if (base.reviewStatus === "CLOSED") return { ...base, status: "expired" };
  return { ...base, status: isPublishable(data) && (!data.enrichmentVersion || base.reviewStatus === "READY_FOR_REVIEW") ? "ready" : "needs_review" };
}

// Single ingestion boundary for the future Discovery Agent and the dev seed.
// It normalizes/validates facts only; it does not fetch URLs or infer claims.
async function createOpportunityCandidate(input, { isDemo = false, session = null, dryRun = false, previews = [], audit = {} } = {}) {
  const data = inputSchema.parse(input);
  const classification = await classifyCandidate(data, { isDemo, session, previews });
  const payload = { ...data, ...classification, isDemo,
    importedVia: audit.importedVia || "manual", importSource: audit.importSource,
    importRunId: audit.importRunId, importedAt: audit.importedAt };
  if (dryRun) return new Candidate(payload);
  if (session) return (await Candidate.create([payload], { session }))[0];
  return Candidate.create(payload);
}

async function existingEmails(rows, { session = null } = {}) {
  const emails = [...new Set(rows.flatMap((row) => row.discoveredEmails || []).map((item) => item.email.toLowerCase()))];
  if (!emails.length) return new Set();
  const escape = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?:^|[^a-z0-9._%+-])(${emails.map(escape).join("|")})(?=$|[^a-z0-9._%+-])`, "i");
  // Only public application channels, never private student/account emails.
  const foundQuery = Opportunity.find({ $or: [{ applicationUrl: pattern }, { note: pattern }] })
    .select("applicationUrl note").lean();
  const companyQuery = Company.distinct("contactEmail", { contactEmail: { $in: emails.map((email) => new RegExp(`^${escape(email)}$`, "i")) } });
  if (session) { foundQuery.session(session); companyQuery.session(session); }
  const found = await foundQuery;
  const companyEmails = await companyQuery;
  return new Set(emails.filter((email) => found.some((row) =>
    new RegExp(`(?:^|[^a-z0-9._%+-])${escape(email)}(?=$|[^a-z0-9._%+-])`, "i").test(`${row.applicationUrl || ""} ${row.note || ""}`)) ||
    companyEmails.some((value) => value.toLowerCase() === email)));
}

async function editCandidate(id, input) {
  const candidate = await Candidate.findById(id).select("+rawContent +extractionEvidence");
  if (!candidate) fail(404, "المرشح غير موجود.");
  if (["published", "rejected"].includes(candidate.status)) fail(409, "لا يمكن تعديل مرشح منشور أو مرفوض.");
  const data = inputSchema.parse({ ...candidate.toObject(), ...input });
  const previous = inputSchema.parse(candidate.toObject());
  const changed = Object.keys(data).filter((key) => JSON.stringify(data[key]) !== JSON.stringify(previous[key]));
  candidate.manualFields = [...new Set([...(candidate.manualFields || []), ...changed])];
  Object.assign(candidate, data, await classifyCandidate(data, { id, isDemo: candidate.isDemo }));
  return candidate.save();
}

async function publishCandidate(id, { mode = "publish", fields = [], expectedUpdatedAt, sanitizeOpportunityPayload, containsBlockedTerms }) {
  let result;
  // Both writes commit together. A failed publication leaves no orphan public
  // opportunity and does not mark an inbox row published. Requires replica set.
  await mongoose.connection.transaction(async (session) => {
    const candidate = await Candidate.findById(id).session(session);
    if (!candidate) fail(404, "المرشح غير موجود.");
    if (candidate.isDemo) fail(409, "البيانات التجريبية لا تُنشر ولا تعدّل الفرص الحقيقية.");
    if (candidate.status === "published") { result = candidate; return; }
    if (["rejected", "duplicate", "expired"].includes(candidate.status)) fail(409, "راجعي حالة المرشح قبل النشر.");
    const data = inputSchema.parse(candidate.toObject());
    if (!isPublishable(data)) fail(422, "راجعي البيانات الأساسية والمصدر وحالة التقديم قبل النشر.");
    const current = await classifyCandidate(data, { id, session });
    if (mode === "publish" && current.status !== "ready") fail(409, "توجد مطابقة أو بيانات تحتاج مراجعة. افتحي التعديل لإعادة فحص المرشح.");
    const payload = sanitizeOpportunityPayload(candidateToOpportunity(data));
    if ([payload.title, payload.organizationName, payload.note, ...payload.cities, ...payload.specialties].some(containsBlockedTerms)) {
      fail(422, "النص يحتوي على عبارات غير مناسبة.");
    }
    if (mode === "update") {
      if (candidate.status !== "update_existing" || !candidate.existingOpportunityId ||
          String(current.existingOpportunityId) !== String(candidate.existingOpportunityId)) fail(409, "تغيّرت المطابقة؛ أعيدي مراجعة المرشح.");
      const existing = await Opportunity.findById(candidate.existingOpportunityId).session(session);
      if (!existing) fail(404, "الفرصة الأصلية غير موجودة.");
      if (existing.isDarbakApplication) fail(409, "عدّلي بيانات برامج التقديم من إدارة البرامج للحفاظ على الربط.");
      if (!expectedUpdatedAt || new Date(expectedUpdatedAt).getTime() !== existing.updatedAt.getTime()) fail(409, "تغيّرت الفرصة منذ المقارنة. أعيدي تحميل المقارنة.");
      const differences = buildCandidateDiff(data, existing.toObject()).filter((item) => item.changed);
      const allowed = differences.map((item) => item.field);
      if (!Array.isArray(fields) || !fields.length || fields.some((field) => !allowed.includes(field))) fail(422, "اختاري حقولًا صالحة من المقارنة.");
      const selectedFields = new Set(fields);
      if (selectedFields.has("cities") || selectedFields.has("city")) { selectedFields.add("cities"); selectedFields.add("city"); }
      selectedFields.forEach((field) => { existing[field] = payload[field]; });
      await existing.save({ session });
      candidate.publishedOpportunityId = existing._id;
    } else {
      const url = new URL(data.applicationUrl); url.searchParams.sort();
      const automationKey = crypto.createHash("sha256").update(JSON.stringify([
        normalize(data.company), normalize(data.title), url.toString(), data.cities.map(normalize).sort(),
        data.deadline ? new Date(data.deadline).toISOString().slice(0, 10) : "",
      ])).digest("hex");
      const [opportunity] = await Opportunity.create([{ ...payload, automationKey }], { session });
      candidate.publishedOpportunityId = opportunity._id;
    }
    candidate.status = "published";
    await candidate.save({ session });
    result = candidate;
  });
  return result;
}

module.exports = { createOpportunityCandidate, classifyCandidate, editCandidate, publishCandidate, existingEmails, fail };
