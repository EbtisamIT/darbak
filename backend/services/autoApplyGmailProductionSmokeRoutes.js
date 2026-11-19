const crypto = require("node:crypto");
const express = require("express");
const ConnectedEmailAccount = require("../models/ConnectedEmailAccount");
const AutoApplyProductionGmailSmoke = require("../models/AutoApplyProductionGmailSmoke");
const {
  productionSmokeRecipient,
  sendProductionSmokeMessage,
} = require("./autoApplyGmailSend");

const SMOKE_KEY = "production-gmail-smoke-v1";
const forbiddenRecipientFields = ["recipient", "to", "email", "companyEmail", "targetEmail"];

function createProductionSmokeRouter({
  Account = ConnectedEmailAccount,
  Smoke = AutoApplyProductionGmailSmoke,
  sendMessage = sendProductionSmokeMessage,
  env = process.env,
} = {}) {
  const router = express.Router();

  router.post("/gmail/production-smoke", async (req, res) => {
    let reservation = null;
    try {
      if (forbiddenRecipientFields.some((field) => req.body?.[field] != null)) {
        return res.status(400).json({ error: "لا يقبل اختبار الإنتاج عنوان وجهة من الطلب." });
      }
      const recipient = productionSmokeRecipient(env);
      const account = await Account.findOne({
        userId: req.autoApplyOAuthUser._id,
        provider: "gmail",
      }).select("+encryptedRefreshToken");
      if (!account || account.status !== "connected") {
        return res.status(409).json({ error: "اربط Gmail أولًا." });
      }
      reservation = await Smoke.create({
        smokeKey: SMOKE_KEY,
        userId: req.autoApplyOAuthUser._id,
        recipientHash: crypto.createHash("sha256").update(recipient).digest("hex"),
        status: "pending",
        attemptedAt: new Date(),
      });
      const result = await sendMessage({ account, env });
      reservation.status = "accepted";
      reservation.providerMessageId = result.providerMessageId;
      reservation.acceptedAt = new Date();
      await reservation.save();
      return res.status(201).json({
        ok: true,
        status: "accepted",
        providerMessageId: result.providerMessageId,
      });
    } catch (error) {
      if (reservation?.status === "pending") {
        reservation.status = "failed";
        reservation.failureCode = String(error.message || "UNKNOWN").slice(0, 80);
        await reservation.save().catch(() => {});
      }
      if (error?.code === 11000) {
        return res.status(409).json({ error: "تم تنفيذ اختبار Gmail الإنتاجي مسبقًا." });
      }
      const knownStatus = Number.isInteger(error?.status) ? error.status : 502;
      if (knownStatus >= 500) {
        console.error("Production Gmail smoke failed:", error.message, error.providerStatus || "");
      }
      return res.status(knownStatus).json({ error: "تعذر تنفيذ اختبار Gmail الإنتاجي." });
    }
  });

  return router;
}

module.exports = { SMOKE_KEY, createProductionSmokeRouter };
