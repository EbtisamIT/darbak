const crypto = require("node:crypto");
const mongoose = require("mongoose");
const { z } = require("zod");
const ImportRun = require("../../models/OpportunityImportRun");
const Candidate = require("../../models/OpportunityCandidate");
const EmailLead = require("../../models/OpportunityEmailLead");
const { inputSchema, normalize } = require("../opportunityCandidateData");
const { createOpportunityCandidate, fail } = require("../opportunityCandidates");
const { saveEmailLead } = require("./management");

const batchSchema = z.object({
  source: z.string().trim().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/),
  runId: z.string().trim().min(1).max(160),
  opportunities: z.array(z.unknown()).max(25).default([]),
  emailLeads: z.array(z.unknown()).max(25).default([]),
}).strict().refine((body) => body.opportunities.length + body.emailLeads.length > 0, "Empty batch");

const fields = ["company", "title", "programType", "cities", "majors", "remote", "description",
  "responsibilities", "requirements", "postedAt", "deadline", "trainingStartDate", "duration",
  "applicationUrl", "sourceUrl", "companyLogo", "sourceType", "discoveredEmails", "rawContent", "verificationNotes"];
const opportunitySchema = inputSchema.pick(Object.fromEntries(fields.map((field) => [field, true])))
  .refine((data) => Boolean(data.company && normalize(data.company)), { path: ["company"], message: "Company required" })
  .refine((data) => Boolean(data.title), { path: ["title"], message: "Title required" })
  .refine((data) => Boolean(data.applicationUrl || data.sourceUrl), { path: ["sourceUrl"], message: "Application or source URL required" });
const leadSchema = z.object({
  company: z.string().trim().min(1).max(240).refine((value) => Boolean(normalize(value))),
  email: inputSchema.shape.discoveredEmails.unwrap().element.shape.email,
  emailType: inputSchema.shape.discoveredEmails.unwrap().element.shape.type,
  sourceUrl: inputSchema.shape.sourceUrl.refine(Boolean),
  city: z.string().trim().max(240).optional(),
  majors: inputSchema.shape.majors,
});

// Object key order is irrelevant; array order identifies item positions in a run.
function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function prepare(body) {
  const batch = batchSchema.parse(body);
  const errors = [], opportunities = [], emailLeads = [];
  for (const [kind, schema, target] of [["opportunities", opportunitySchema, opportunities], ["emailLeads", leadSchema, emailLeads]]) {
    batch[kind].forEach((value, index) => {
      const result = schema.safeParse(value);
      if (result.success) target.push({ index, data: result.data });
      else errors.push({ kind, index, code: "INVALID_ITEM", fields: [...new Set(result.error.issues.map((issue) => issue.path.join(".") || "item"))] });
    });
  }
  return { batch, opportunities, emailLeads, errors,
    hash: crypto.createHash("sha256").update(stableJson(batch)).digest("hex") };
}

function replay(run, hash) {
  if (run.payloadHash !== hash) fail(409, "IMPORT_RUN_PAYLOAD_CONFLICT: استخدمي runId جديدًا لدفعة مختلفة.");
  return { ...run.summary, replayed: true };
}

async function importOpportunities(body, { dryRun = false } = {}) {
  const { batch, opportunities, emailLeads, errors, hash } = prepare(body);
  const key = { source: batch.source, runId: batch.runId };
  if (!dryRun) {
    // Collections/indexes must exist before opening the transaction.
    for (const model of [ImportRun, Candidate, EmailLead]) await model.init();
    const previous = await ImportRun.findOne(key).lean();
    if (previous) return replay(previous, hash);
  }
  const execute = async (session = null) => {
    const summary = { received: batch.opportunities.length, created: 0, duplicates: 0, updates: 0,
      needsReview: 0, rejected: errors.length, errors: [...errors],
      emailLeads: { received: batch.emailLeads.length, created: 0, existing: 0 },
      results: [], dryRun, replayed: false };
    const previews = [], seenEmails = new Set();
    const audit = { importedVia: "agent", importSource: batch.source, importRunId: batch.runId, importedAt: new Date() };
    // Insert the receipt first to serialize simultaneous retries of this run.
    let receipt;
    if (!dryRun) [receipt] = await ImportRun.create([{ ...key, payloadHash: hash, summary }], { session });
    for (const { index, data } of opportunities) {
      // Only factual fields survived the allowlist. Agent status, score and
      // verification claims never grant official/ready status.
      const candidate = await createOpportunityCandidate(data, { session, dryRun, previews, audit });
      if (dryRun) previews.push(candidate);
      summary.created++;
      if (candidate.status === "duplicate") summary.duplicates++;
      if (candidate.status === "update_existing") summary.updates++;
      if (candidate.status === "needs_review") summary.needsReview++;
      summary.results.push({ kind: "opportunity", index, status: candidate.status,
        ...(!dryRun ? { candidateId: String(candidate._id) } : {}),
        existingOpportunityId: candidate.existingOpportunityId || null, missingFields: candidate.missingFields });
    }
    for (const { index, data } of emailLeads) {
      const identity = `${normalize(data.company)}\n${data.email}`;
      const created = !seenEmails.has(identity) && await saveEmailLead({ ...data, ...audit,
        officialSource: false, confidence: 0 }, { session, dryRun });
      seenEmails.add(identity);
      summary.emailLeads[created ? "created" : "existing"]++;
      summary.results.push({ kind: "emailLead", index, action: created ? "create" : "existing" });
    }
    if (receipt) { receipt.summary = summary; await receipt.save({ session }); }
    return summary;
  };
  if (dryRun) return execute();
  try {
    // A storage failure rolls back candidates, leads and receipt together.
    return await mongoose.connection.transaction(execute, { maxCommitTimeMS: 15000 });
  } catch (error) {
    if (error.code === 11000) {
      const previous = await ImportRun.findOne(key).lean();
      if (previous) return replay(previous, hash);
      fail(409, "IMPORT_CONFLICT_RETRY: أعيدي إرسال نفس الدفعة بنفس runId.");
    }
    throw error;
  }
}

module.exports = { importOpportunities, prepare };
