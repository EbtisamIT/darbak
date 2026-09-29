const express = require("express");
const mongoose = require("mongoose");
const Candidate = require("../models/OpportunityCandidate");
const Opportunity = require("../models/Opportunity");
const { STATUSES, SOURCE_TYPES, PROGRAM_TYPES, buildCandidateDiff } = require("./opportunityCandidateData");
const { createOpportunityCandidate, editCandidate, publishCandidate, existingEmails, fail } = require("./opportunityCandidates");
const { seedOpportunityCandidates } = require("./opportunityCandidateSeed");

function createOpportunityCandidateRouter({ requireAdmin, sanitizeOpportunityPayload, containsBlockedTerms, onPublish = () => {} }) {
  const router = express.Router();
  router.use(requireAdmin);
  router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: "قاعدة البيانات غير متصلة." });
    next();
  });
  const handle = (fn) => async (req, res) => {
    try { await fn(req, res); } catch (error) {
      const status = error.status || (error.name === "ZodError" || error.name === "ValidationError" ? 400 :
        error.code === 11000 || error.name === "VersionError" ? 409 : 500);
      res.status(status).json({ error: status === 500 ? "تعذر تنفيذ العملية. لم يتم تأكيد النشر؛ أعيدي المحاولة." :
        error.name === "ZodError" ? "تحققي من صيغة الحقول والروابط والتواريخ." :
          status === 409 && !error.status ? "تم تعديل هذا السجل أو نشر فرصة مطابقة. حدّثي القائمة." : error.message });
    }
  };
  const enrich = async (rows) => {
    const emails = await existingEmails(rows);
    return rows.map((row) => ({ ...row, discoveredEmails: (row.discoveredEmails || []).map((item) => ({ ...item, existing: emails.has(item.email.toLowerCase()) })) }));
  };
  router.get("/", handle(async (req, res) => {
    const filter = {};
    for (const [key, options] of [["status", STATUSES], ["sourceType", SOURCE_TYPES], ["programType", PROGRAM_TYPES]]) {
      if (req.query[key] && !options.includes(req.query[key])) fail(400, "فلتر غير صالح.");
      if (req.query[key]) filter[key] = req.query[key];
    }
    const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const key of ["company", "city"]) {
      if (req.query[key]) filter[key === "city" ? "cities" : key] = new RegExp(escape(String(req.query[key]).slice(0, 160)), "i");
    }
    if (req.query.minConfidence) {
      const score = Number(req.query.minConfidence);
      if (!Number.isFinite(score) || score < 0 || score > 100) fail(400, "درجة الثقة بين 0 و100.");
      filter.confidenceScore = { $gte: score };
    }
    const page = Math.max(1, Math.min(10000, parseInt(req.query.page, 10) || 1)), limit = 20;
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const [rows, total, groups, discoveredToday] = await Promise.all([
      Candidate.find(filter).sort({ discoveredAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Candidate.countDocuments(filter), Candidate.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Candidate.countDocuments({ discoveredAt: { $gte: today } }),
    ]);
    res.json({ data: await enrich(rows), total, page, pages: Math.ceil(total / limit),
      summary: { discoveredToday, ...Object.fromEntries(groups.map((g) => [g._id, g.count])) } });
  }));
  router.post("/seed", handle(async (req, res) => res.json({ data: await seedOpportunityCandidates() })));
  router.post("/", handle(async (req, res) => res.status(201).json(await createOpportunityCandidate(req.body))));
  router.use("/:id", (req, res, next) => {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.status(400).json({ error: "معرف غير صالح." });
    next();
  });
  router.get("/:id", handle(async (req, res) => {
    const row = await Candidate.findById(req.params.id).select("+rawContent +demoExistingSnapshot").lean();
    if (!row) fail(404, "المرشح غير موجود.");
    const existing = row.isDemo && row.demoExistingSnapshot ? row.demoExistingSnapshot : row.existingOpportunityId ?
      await Opportunity.findById(row.existingOpportunityId).select("organizationName title logoUrl cities city specialties trainingMode applicationUrl sourceUrl note deadline status updatedAt").lean() : null;
    res.json({ candidate: (await enrich([row]))[0], existing, diff: existing ? buildCandidateDiff(row, existing) : [] });
  }));
  router.patch("/:id", handle(async (req, res) => res.json(await editCandidate(req.params.id, req.body))));
  for (const action of ["publish", "apply-update"]) router.post(`/:id/${action}`, handle(async (req, res) => {
    const row = await publishCandidate(req.params.id, { mode: action === "publish" ? "publish" : "update",
      fields: req.body.fields, expectedUpdatedAt: req.body.expectedUpdatedAt, sanitizeOpportunityPayload, containsBlockedTerms });
    onPublish();
    res.json(row);
  }));
  router.post("/:id/reject", handle(async (req, res) => {
    const row = await Candidate.findOneAndUpdate({ _id: req.params.id, status: { $ne: "published" } }, { $set: { status: "rejected" }, $inc: { __v: 1 } }, { new: true });
    if (!row) fail(409, "المرشح غير موجود أو منشور بالفعل.");
    res.json(row);
  }));
  router.post("/:id/mark-duplicate", handle(async (req, res) => {
    const { existingOpportunityId, duplicateOf } = req.body;
    if (Boolean(existingOpportunityId) === Boolean(duplicateOf)) fail(400, "حددي فرصة أو مرشحًا واحدًا مطابقًا.");
    const target = existingOpportunityId || duplicateOf;
    if (!mongoose.isObjectIdOrHexString(target) || target === req.params.id) fail(400, "معرف المطابقة غير صالح.");
    const Model = existingOpportunityId ? Opportunity : Candidate;
    if (!(await Model.exists({ _id: target }))) fail(404, "السجل المطابق غير موجود.");
    const row = await Candidate.findOneAndUpdate({ _id: req.params.id, status: { $nin: ["published", "rejected"] } }, {
      $set: { status: "duplicate", existingOpportunityId: existingOpportunityId || null, duplicateOf: duplicateOf || null }, $inc: { __v: 1 },
    }, { new: true });
    if (!row) fail(409, "تعذر تغيير حالة المرشح.");
    res.json(row);
  }));
  return router;
}
module.exports = { createOpportunityCandidateRouter };
