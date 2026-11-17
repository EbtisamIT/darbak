const crypto = require("node:crypto");
const express = require("express");
const ConnectedEmailAccount = require("../models/ConnectedEmailAccount");
const AutoApplyOAuthState = require("../models/AutoApplyOAuthState");
const {
  oauthEnabled,
  requiredConfig,
  stateHash,
  authorizationUrl,
  safeAccount,
} = require("./autoApplyGmailOAuth");

const router = express.Router();

router.use((req, res, next) => {
  if (!oauthEnabled()) return res.sendStatus(404);
  next();
});

router.get("/email/gmail/connect", async (req, res) => {
  try {
    const config = requiredConfig();
    const state = crypto.randomBytes(32).toString("base64url");
    await AutoApplyOAuthState.create({
      userId: req.autoApplyOAuthUser._id,
      provider: "gmail",
      stateHash: stateHash(state),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    res.set("Cache-Control", "no-store").json({ authorizationUrl: authorizationUrl({ state, config }) });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.status ? error.message : "تعذر بدء ربط Gmail حاليًا." });
  }
});

router.get("/email/status", async (req, res) => {
  try {
    const account = await ConnectedEmailAccount.findOne({
      userId: req.autoApplyOAuthUser._id,
      provider: "gmail",
    }).lean();
    res.set("Cache-Control", "no-store").json(safeAccount(account));
  } catch {
    res.status(500).json({ error: "تعذر التحقق من اتصال Gmail حاليًا." });
  }
});

router.delete("/email/gmail", async (req, res) => {
  try {
    await ConnectedEmailAccount.findOneAndDelete({
      userId: req.autoApplyOAuthUser._id,
      provider: "gmail",
    });
    res.set("Cache-Control", "no-store").json({
      provider: "gmail",
      connectionStatus: "not_connected",
      emailAddress: "",
    });
  } catch {
    res.status(500).json({ error: "تعذر فصل Gmail حاليًا." });
  }
});

module.exports = router;
