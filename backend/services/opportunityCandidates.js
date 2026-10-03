const mongoose = require("mongoose");
const crypto = require("crypto");
const Candidate = require("../models/OpportunityCandidate");
const Opportunity = require("../models/Opportunity");
const Company = require("../models/Company");
const { assessEnrichment } = require("./opportunityEnrichmentAssessment");
const { companyAliasesMatchName } = require("./companyDirectorySeeds");
const { prepareCandidateInput, attachDraft, reviewState } = require("./opportunityInboxDraft");
const { inputSchema, normalize, matchOpportunity, hasAdditionalData, getMissingFields,
  candidateToOpportunity, buildCandidateDiff } = require("./opportunityCandidateData");

const fail = (status, message) => { const error = new Error(message); error.status = status; throw error; };
const projection = `${require("./opportunityInboxDraft").fields.join(" ")} companyId updatedAt`;

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
  if (tied) return { ...base, status: "needs_verification", reviewStatus: "NEEDS_VERIFICATION" };
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
  const status = reviewState(data);
  return { ...base, status, reviewStatus: status === "ready_for_review" ? "READY_FOR_REVIEW" : "NEEDS_VERIFICATION" };
}

// Single ingestion boundary for the future Discovery Agent and the dev seed.
// It normalizes/validates facts only; it does not fetch URLs or infer claims.
async function createOpportunityCandidate(input, { isDemo = false, session = null, dryRun = false, previews = [], audit = {} } = {}) {
  const data = attachDraft(inputSchema.parse(prepareCandidateInput(input)));
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
  const merged = { ...candidate.toObject(), ...input,
    evidenceLinks: [...new Set([...(candidate.evidenceLinks || []), ...(input.evidenceLinks || []), candidate.sourceUrl, candidate.applicationUrl].filter(Boolean))].slice(0, 30) };
  // Existing callers can still edit the legacy extraction fields.
  if (!input.opportunityDraft && !Object.hasOwn(input, "organizationName") &&
      ["company", "title", "companyLogo", "cities", "majors", "remote", "description", "responsibilities", "requirements", "postedAt", "trainingStartDate", "duration", "deadline", "sourceUrl", "applicationUrl"].some((key) => Object.hasOwn(input, key))) {
    merged.opportunityDraft = { ...merged.opportunityDraft, ...candidateToOpportunity({ ...merged, opportunityDraft: undefined }) };
  }
  const data = attachDraft(inputSchema.parse(prepareCandidateInput(merged)));
  const previous = inputSchema.parse(candidate.toObject());
  const changed = Object.keys(data).filter((key) => JSON.stringify(data[key]) !== JSON.stringify(previous[key]));
  candidate.manualFields = [...new Set([...(candidate.manualFields || []), ...changed])];
  Object.assign(candidate, data, await classifyCandidate(data, { id, isDemo: candidate.isDemo }));
  return candidate.save();
}

async function publishCandidate(id, { mode = "publish", fields = [], expectedUpdatedAt, sanitizeOpportunityPayload, containsBlockedTerms, hydrateDarbakOpportunityFromCampaign = async (value) => value }) {
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
    const current = await classifyCandidate(data, { id, session });
    if (mode === "publish" && ["duplicate", "update_existing"].includes(current.status)) fail(409, "توجد فرصة مطابقة؛ راجعي التحديث بدل نشر فرصة أخرى.");
    const payload = await hydrateDarbakOpportunityFromCampaign(sanitizeOpportunityPayload(candidateToOpportunity(data)));
    if (!payload.title || !payload.organizationName) fail(422, "اسم الجهة وعنوان الفرصة مطلوبة.");
    if (payload.isDarbakApplication && await Opportunity.exists({ isDarbakApplication: true, companyApplicationCampaignId: payload.companyApplicationCampaignId }).session(session)) fail(409, "هذا البرنامج مرتبط بفرصة بالفعل.");
    if ([payload.title, payload.organizationName, payload.city, payload.note, payload.submitterContact, ...payload.cities, ...(payload.majorCategories || []), ...payload.specialties].some(containsBlockedTerms)) {
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
      const url = data.applicationUrl ? new URL(data.applicationUrl) : null; url?.searchParams.sort();
      const automationKey = crypto.createHash("sha256").update(JSON.stringify([
        normalize(data.company), normalize(data.title), url?.toString() || data.sourceUrl || "", data.cities.map(normalize).sort(),
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
