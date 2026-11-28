const crypto = require("node:crypto");
const mongoose = require("mongoose");
const Supply = require("../models/AutoApplySupply");
const { runAutoApplySupplyDiscovery, mongoRuns } = require("./autoApplySupplyCollector");
const { canaryEnvironment, canaryReadiness, canaryAudit, priorCanaryIds, repairCanaryIdentities } = require("./autoApplySupplyCanary");
const { classifySupplyBatch, classifierSettings } = require("./autoApplySupplyClassifier");

function validSchedulerToken(header, secret) {
  const token = /^Bearer ([^\s]+)$/i.exec(header || "")?.[1];
  if (!token || !secret || secret.length < 32) return false;
  const digest = (value) => crypto.createHash("sha256").update(value).digest();
  return crypto.timingSafeEqual(digest(secret), digest(token));
}

function mountAutoApplySupplyCollectorRoutes(app, requireAdmin, {
  env = process.env, isConnected = () => mongoose.connection.readyState === 1,
  run = runAutoApplySupplyDiscovery, reports = mongoRuns(),
  auditCanary = canaryAudit, probeClassifier = classifySupplyBatch, repairIdentities = repairCanaryIdentities,
  getClassification = (id) => Supply.findById(id).select("companyName opportunityTitle sourceType sourceUrl evidenceText emailEvidenceText applicationEvidenceText pageTitle verificationStatus verificationReason classifiedAt classifierVersion classificationHash classification").lean(),
} = {}) {
  const enabled = (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (env.AUTO_APPLY_SUPPLY_COLLECTOR_ENABLED !== "true") return res.sendStatus(404);
    next();
  };
  const ready = (req, res, next) => {
    if (!isConnected()) return res.status(503).json({ error: "DATABASE_UNAVAILABLE" });
    next();
  };
  const authenticateScheduler = (req, res, next) => {
    if (!validSchedulerToken(req.get("Authorization"), env.AUTO_APPLY_SUPPLY_COLLECTOR_TOKEN)) {
      return res.status(401).json({ error: "UNAUTHORIZED" });
    }
    next();
  };
  const launch = (trigger) => async (_req, res) => {
    try {
      const result = await run({ trigger, env });
      const status = result.status === "already_running" ? 409 : result.status === "failed" ? 502 : 200;
      res.status(status).json(result);
    } catch {
      res.status(503).json({ error: "SUPPLY_COLLECTOR_UNAVAILABLE" });
    }
  };
  app.post("/api/internal/auto-apply-supply/run", enabled, authenticateScheduler, ready, launch("scheduler"));
  app.post("/api/admin/auto-apply-supply/run", enabled, requireAdmin, ready, launch("admin"));
  const canaryEnabled = (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (env.AUTO_APPLY_SUPPLY_CANARY_ENABLED !== "true") return res.sendStatus(404);
    next();
  };
  let diagnostic;
  app.post("/api/admin/auto-apply-supply/canary/diagnostic", canaryEnabled, requireAdmin, ready, async (_req, res) => {
    const config = classifierSettings(env);
    if (!config.apiKey || env.AUTO_APPLY_REAL_SEND_ENABLED !== "false" || env.AUTO_APPLY_SUPPLY_COLLECTOR_ENABLED === "true") {
      return res.status(409).json({ error: "CANARY_PREREQUISITES_NOT_MET" });
    }
    try {
      if (canaryReadiness(env, await reports.canaries()).nextSlot !== 3) {
        return res.status(409).json({ error: "CANARY_SLOT_UNAVAILABLE" });
      }
      diagnostic ||= probeClassifier({ env: canaryEnvironment(env, 3), previewRecords: [{
        _id: "supply-classifier-diagnostic", contentHash: "supply-classifier-diagnostic",
        verificationStatus: "NEEDS_REVIEW", isActive: true, channelType: "EMAIL",
        companyName: "Example Training", destinationEmail: "coop@example.org",
        sourceUrl: "https://example.org/coop", sourceType: "official_careers_page", collectorSource: "synthetic",
        opportunityTitle: "Cooperative Training",
        evidenceText: "Cooperative training for university students in Saudi Arabia. Send your COOP application and CV to coop@example.org.",
        emailEvidenceText: "Send your COOP application and CV to coop@example.org.",
      }] });
      res.json({ model: config.model, ...(await diagnostic) });
    } catch {
      res.status(503).json({ error: "CLASSIFIER_DIAGNOSTIC_UNAVAILABLE" });
    }
  });
  app.get("/api/admin/auto-apply-supply/canary", canaryEnabled, requireAdmin, ready, async (_req, res) => {
    try {
      const rows = await reports.canaries();
      res.json({ readiness: canaryReadiness(env, rows), runs: await Promise.all(rows.map(auditCanary)) });
    } catch {
      res.status(503).json({ error: "CANARY_REPORT_UNAVAILABLE" });
    }
  });
  app.post("/api/admin/auto-apply-supply/canary", canaryEnabled, requireAdmin, ready, async (_req, res) => {
    try {
      const records = await reports.canaries();
      const state = canaryReadiness(env, records);
      if (!state.realSendingOff || !state.standardCollectorOff || !state.searchConfigured || !state.openAiConfigured) {
        return res.status(409).json({ error: "CANARY_PREREQUISITES_NOT_MET" });
      }
      if (!state.nextSlot) return res.status(409).json({ error: "CANARY_SLOT_UNAVAILABLE" });
      const retryCandidateIds = state.nextSlot === 4 ? priorCanaryIds(records.find((item) => item.canarySlot === 3)) :
        state.nextSlot === 3 ? (records.find((item) => item.canarySlot === 1)?.metrics?.candidateIds || []).slice(0, 1) : [];
      const result = await run({ trigger: "canary", canarySlot: state.nextSlot, env: canaryEnvironment(env, state.nextSlot), retryCandidateIds });
      const status = result.status === "already_running" ? 409 : result.status === "failed" ? 502 : 200;
      res.status(status).json(result);
    } catch {
      res.status(503).json({ error: "SUPPLY_CANARY_UNAVAILABLE" });
    }
  });
  app.post("/api/admin/auto-apply-supply/canary/repair-identities", canaryEnabled, requireAdmin, ready, async (_req, res) => {
    if (env.AUTO_APPLY_REAL_SEND_ENABLED !== "false" || env.AUTO_APPLY_SUPPLY_COLLECTOR_ENABLED === "true") {
      return res.status(409).json({ error: "CANARY_PREREQUISITES_NOT_MET" });
    }
    try {
      const qualityRun = (await reports.canaries()).find((item) => item.canarySlot === 4 && item.finishedAt);
      if (!qualityRun) return res.status(409).json({ error: "CANARY_NOT_FINISHED" });
      res.json({ repaired: await repairIdentities(qualityRun) });
    } catch {
      res.status(503).json({ error: "CANARY_REPAIR_UNAVAILABLE" });
    }
  });
  app.get("/api/admin/auto-apply-supply/summary", enabled, requireAdmin, ready, async (_req, res) => {
    try { res.json({ run: await reports.latest() }); }
    catch { res.status(503).json({ error: "SUPPLY_COLLECTOR_UNAVAILABLE" }); }
  });
  app.get("/api/admin/auto-apply-supply/:id/classification", enabled, requireAdmin, ready, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.sendStatus(404);
    try {
      const record = await getClassification(req.params.id);
      if (!record) return res.sendStatus(404);
      res.json({ record });
    } catch {
      res.status(503).json({ error: "SUPPLY_CLASSIFICATION_UNAVAILABLE" });
    }
  });
}

module.exports = { mountAutoApplySupplyCollectorRoutes, validSchedulerToken };
