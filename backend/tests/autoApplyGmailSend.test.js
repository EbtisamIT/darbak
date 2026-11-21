const assert = require("node:assert");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { encryptRefreshToken } = require("../services/autoApplyGmailOAuth");
const { sendRealApplicationMessage } = require("../services/autoApplyGmailSend");
const { assertRealSendEnabled, isPilotUser } = require("../services/autoApplyPilot");
const { documentsSatisfied, assertReviewApproved, reserveSendSlot } = require("../services/autoApplyPilotSend");
const { acceptProviderAndTrack } = require("../services/autoApplyPostSendTracking");

const ids = [1, 2, 3, 4, 5].map((value) => `00000000000000000000000${value}`);
const pilotEnv = { AUTO_APPLY_REAL_SEND_ENABLED: "true", AUTO_APPLY_PILOT_USER_IDS: ids.join(",") };
const verifiedChannel = { verificationStatus: "verified", acceptsTrainingApplications: true,
  channelType: "evergreen_training", email: "training@example.com", requiredDocuments: { resume: "required" } };

async function run() {
  assert.equal(isPilotUser(ids[0], pilotEnv), true);
  assert.equal(isPilotUser("000000000000000000000099", pilotEnv), false);
  assert.throws(() => assertRealSendEnabled({ userId: ids[0], env: { ...pilotEnv, AUTO_APPLY_REAL_SEND_ENABLED: "false" } }),
    /AUTO_APPLY_REAL_SEND_DISABLED/);
  assert.deepEqual(assertRealSendEnabled({ userId: ids[0], env: pilotEnv }), { total: 5, daily: 5 });
  assert.throws(() => assertRealSendEnabled({ userId: "000000000000000000000099", env: pilotEnv }),
    /AUTO_APPLY_PILOT_NOT_ALLOWED/);

  assert.throws(() => assertReviewApproved({ item: { status: "ready_for_review", eligibility: "eligible" },
    channel: verifiedChannel, documentState: { ok: true }, profile: { realSendConsentAt: new Date() } }),
  /AUTO_APPLY_REVIEW_NOT_APPROVED/);
  assert.throws(() => assertReviewApproved({ item: { status: "approved", eligibility: "eligible" },
    channel: { ...verifiedChannel, verificationStatus: "likely" }, documentState: { ok: true },
    profile: { realSendConsentAt: new Date() } }), /AUTO_APPLY_CHANNEL_NOT_VERIFIED/);
  assert.throws(() => assertReviewApproved({ item: { status: "approved", eligibility: "eligible" },
    channel: verifiedChannel, documentState: { ok: false, missing: ["academic_transcript"] },
    profile: { realSendConsentAt: new Date() } }), /AUTO_APPLY_REQUIRED_DOCUMENT_MISSING/);
  assert.equal(documentsSatisfied({ channel: { ...verifiedChannel, requiredDocuments: {
    resume: "required", trainingLetter: "required" } }, resume: {}, documents: [{ type: "training_letter",
    scope: "company_specific", companyId: "other" }] }).ok, false);

  let quota = { totalReserved: 4, dayReserved: 4, dayKey: new Date().toISOString().slice(0, 10) };
  const QuotaModel = {
    findOneAndUpdate: async (query, update) => {
      if (update.$setOnInsert) return quota;
      if (query.totalReserved?.$lt <= quota.totalReserved || query.dayReserved?.$lt <= quota.dayReserved) return null;
      quota = { ...quota, totalReserved: quota.totalReserved + 1, dayReserved: quota.dayReserved + 1 };
      return quota;
    },
    updateOne: async () => ({}),
  };
  await reserveSendSlot({ QuotaModel, userId: ids[0], limits: { total: 5, daily: 5 } });
  await assert.rejects(() => reserveSendSlot({ QuotaModel, userId: ids[0], limits: { total: 5, daily: 5 } }),
    /AUTO_APPLY_PILOT_SEND_LIMIT_REACHED/);

  const encryptionKey = crypto.randomBytes(32).toString("base64");
  const env = { ...pilotEnv, GOOGLE_CLIENT_ID: "client", GOOGLE_CLIENT_SECRET: "secret",
    GOOGLE_OAUTH_REDIRECT_URI: "https://api.darbak.space/api/auto-apply/email/gmail/callback",
    AUTO_APPLY_FRONTEND_URL: "https://darbak.space", AUTO_APPLY_EMAIL_TOKEN_ENCRYPTION_KEY: encryptionKey };
  const account = { status: "connected", encryptedRefreshToken: encryptRefreshToken("refresh", encryptionKey) };
  let calls = 0;
  const fetchImpl = async (url) => {
    calls += 1;
    if (url.includes("oauth2.googleapis.com")) return { ok: true, json: async () => ({ access_token: "access" }) };
    return { ok: true, json: async () => ({ id: "provider-1" }) };
  };
  await assert.rejects(() => sendRealApplicationMessage({ account, recipient: "training@example.com",
    subject: "طلب تدريب", body: "رسالة", attachment: { filename: "resume.pdf", mimeType: "application/pdf",
      bytes: Buffer.from("%PDF-1.4\n%%EOF") }, authorization: "pilot-review-approved",
    env: { ...env, AUTO_APPLY_REAL_SEND_ENABLED: "false" }, fetchImpl }), /AUTO_APPLY_REAL_SEND_DISABLED/);
  assert.equal(calls, 0);
  const sent = await sendRealApplicationMessage({ account, recipient: "training@example.com",
    subject: "طلب تدريب", body: "رسالة", attachment: { filename: "resume.pdf", mimeType: "application/pdf",
      bytes: Buffer.from("%PDF-1.4\n%%EOF") }, authorization: "pilot-review-approved", env, fetchImpl });
  assert.equal(sent.providerMessageId, "provider-1");

  let tracked = 0;
  await assert.rejects(() => acceptProviderAndTrack({
    sendProvider: async () => { throw new Error("provider failed"); },
    markAccepted: async () => { throw new Error("must not run"); },
    createTracker: async () => { tracked += 1; },
  }), /provider failed/);
  assert.equal(tracked, 0);
  await acceptProviderAndTrack({ sendProvider: async () => ({ providerMessageId: "provider-2" }),
    markAccepted: async () => ({ _id: "send-1" }), createTracker: async () => { tracked += 1; } });
  assert.equal(tracked, 1);

  const routeSource = fs.readFileSync(path.join(__dirname, "../services/autoApplyV1Routes.js"), "utf8");
  assert(routeSource.includes("assertReviewApproved"));
  assert(routeSource.includes('status: "accepted"'));
  assert(routeSource.includes('isTest: false'));
  assert(routeSource.includes("تم إرسال هذا التقديم مسبقًا"));
  assert(routeSource.includes("assertRealSendEnabled"));
  console.log("Auto Apply controlled pilot targeted tests passed");
}

run().catch((error) => { console.error(error); process.exit(1); });
