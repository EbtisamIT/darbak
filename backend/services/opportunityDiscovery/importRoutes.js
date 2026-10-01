const express = require("express");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const { importOpportunities } = require("./importBridge");

function requireImportToken(req, res, next) {
  res.set("Cache-Control", "no-store");
  const secret = process.env.DARBAK_DISCOVERY_IMPORT_TOKEN;
  if (!secret || secret.length < 32) return res.status(503).json({ error: "IMPORT_TOKEN_NOT_CONFIGURED" });
  const token = /^Bearer ([^\s]+)$/i.exec(req.get("Authorization") || "")?.[1];
  const digest = (value) => crypto.createHash("sha256").update(value).digest();
  if (!token || !crypto.timingSafeEqual(digest(secret), digest(token))) return res.status(401).json({ error: "UNAUTHORIZED" });
  next();
}

function createOpportunityImportRouter() {
  const router = express.Router();
  router.use(requireImportToken);
  router.post("/", async (req, res) => {
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: "DATABASE_UNAVAILABLE" });
    if (req.query.dryRun !== undefined && !["true", "false"].includes(req.query.dryRun)) {
      return res.status(400).json({ error: "INVALID_DRY_RUN" });
    }
    try {
      res.json(await importOpportunities(req.body, { dryRun: req.query.dryRun === "true" }));
    } catch (error) {
      const status = error.status || (error.name === "ZodError" ? 400 : 500);
      // Never log payloads, request headers, secrets or arbitrary database errors.
      if (status === 500) console.error("Opportunity import failed", { code: "IMPORT_STORAGE_FAILURE" });
      res.status(status).json({ error: error.status ? error.message : status === 400 ? "INVALID_IMPORT_BATCH" : "IMPORT_FAILED_RETRY_SAME_RUN" });
    }
  });
  return router;
}

module.exports = { createOpportunityImportRouter, requireImportToken };
