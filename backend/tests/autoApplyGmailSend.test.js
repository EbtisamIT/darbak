const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { TEST_SUBJECT, TEST_BODY, PDF_TEST_SUBJECT, PDF_TEST_BODY, assertTestSendAllowed,
  validatePdfAttachment, buildRawMessage, sendTestMessage } = require("../services/autoApplyGmailSend");
const { encryptRefreshToken } = require("../services/autoApplyGmailOAuth");
const { createAutoApplyTestPdf } = require("../fixtures/autoApplyTestPdf");
const { testRecipientOverride, applicationDraft, selectedResumeAttachment,
  assertCompanyRecipientBlocked } = require("../services/autoApplyPackageTestSend");
const { acceptProviderAndTrack } = require("../services/autoApplyPostSendTracking");

const encryptionKey = Buffer.alloc(32, 7).toString("base64");
const baseEnv = { NODE_ENV: "development", AUTO_APPLY_REAL_SEND_ENABLED: "false",
  AUTO_APPLY_GMAIL_TEST_SEND_ENABLED: "true", AUTO_APPLY_GMAIL_TEST_RECIPIENTS: "test@example.com",
  GOOGLE_CLIENT_ID: "client", GOOGLE_CLIENT_SECRET: "secret",
  GOOGLE_OAUTH_REDIRECT_URI: "http://localhost:3001/api/auto-apply/email/gmail/callback",
  AUTO_APPLY_FRONTEND_URL: "http://localhost:3000/auto-apply", AUTO_APPLY_EMAIL_TOKEN_ENCRYPTION_KEY: encryptionKey };

assert.throws(() => assertTestSendAllowed({ recipient: "test@example.com", env: { ...baseEnv, NODE_ENV: "production" } }), /GMAIL_TEST_SEND_DISABLED/);
assert.throws(() => assertTestSendAllowed({ recipient: "company@example.com", env: baseEnv }), /GMAIL_TEST_RECIPIENT_NOT_ALLOWED/);
assert.equal(assertTestSendAllowed({ recipient: "TEST@example.com", env: baseEnv }), "test@example.com");
assert.equal(testRecipientOverride(baseEnv), "test@example.com");
assert.throws(() => testRecipientOverride({ ...baseEnv, AUTO_APPLY_GMAIL_TEST_RECIPIENTS: "a@example.com,b@example.com" }),
  /GMAIL_TEST_RECIPIENT_NOT_CONFIGURED/);
assert.throws(() => assertCompanyRecipientBlocked("test@example.com", "test@example.com"), /AUTO_APPLY_TEST_DESTINATION_UNSAFE/);
assert.doesNotThrow(() => assertCompanyRecipientBlocked("company@example.com", "test@example.com"));
assert.deepEqual(applicationDraft({ subject: " طلب تدريب ", body: " رسالة حقيقية " }),
  { subject: "طلب تدريب", body: "رسالة حقيقية" });
assert.throws(() => applicationDraft({ subject: "", body: "رسالة" }), /AUTO_APPLY_TEST_DRAFT_INVALID/);

const decodedMime = Buffer.from(buildRawMessage({ to: "test@example.com" }), "base64url").toString("utf8");
assert(decodedMime.includes(`Subject: =?UTF-8?B?${Buffer.from(TEST_SUBJECT).toString("base64")}?=`));
assert(decodedMime.includes(Buffer.from(TEST_BODY).toString("base64").slice(0, 40)));

const fixtureBytes = createAutoApplyTestPdf();
const fixtureAttachment = { filename: "darbak-auto-apply-test.pdf", mimeType: "application/pdf", bytes: fixtureBytes };
const selectedResume = selectedResumeAttachment({ filename: "student-cv.pdf", pdf: fixtureBytes,
  sha256: crypto.createHash("sha256").update(fixtureBytes).digest("hex") });
assert.equal(selectedResume.filename, "student-cv.pdf");
assert.equal(selectedResume.bytes, fixtureBytes);
assert.equal(selectedResumeAttachment({ filename: "student-cv.pdf", pdf: { buffer: fixtureBytes },
  sha256: crypto.createHash("sha256").update(fixtureBytes).digest("hex") }).bytes, fixtureBytes);
assert.throws(() => selectedResumeAttachment({ filename: "bad.pdf", pdf: fixtureBytes, sha256: "wrong" }),
  /AUTO_APPLY_TEST_RESUME_INVALID/);
assert.equal(validatePdfAttachment(fixtureAttachment, baseEnv).bytes, fixtureBytes);
assert.throws(() => validatePdfAttachment(null, baseEnv), /GMAIL_TEST_ATTACHMENT_MISSING/);
assert.throws(() => validatePdfAttachment({ ...fixtureAttachment, bytes: Buffer.alloc(0) }, baseEnv), /GMAIL_TEST_ATTACHMENT_EMPTY/);
assert.throws(() => validatePdfAttachment({ ...fixtureAttachment, mimeType: "text/plain" }, baseEnv), /GMAIL_TEST_ATTACHMENT_NOT_PDF/);
assert.throws(() => validatePdfAttachment(fixtureAttachment,
  { ...baseEnv, AUTO_APPLY_GMAIL_TEST_MAX_ATTACHMENT_BYTES: String(fixtureBytes.length - 1) }), /GMAIL_TEST_ATTACHMENT_TOO_LARGE/);

const attachmentMime = Buffer.from(buildRawMessage({ to: "test@example.com", subject: PDF_TEST_SUBJECT,
  body: PDF_TEST_BODY, attachment: fixtureAttachment, env: baseEnv }), "base64url").toString("utf8");
assert(attachmentMime.includes("Content-Type: multipart/mixed"));
assert(attachmentMime.includes("Content-Type: application/pdf"));
assert(attachmentMime.includes("filename*=UTF-8''darbak-auto-apply-test.pdf"));
assert(attachmentMime.includes(Buffer.from(PDF_TEST_BODY).toString("base64").slice(0, 40)));
const encodedAttachment = Buffer.from(fixtureBytes).toString("base64");
assert(attachmentMime.replace(/\r\n/g, "").includes(encodedAttachment));
assert.equal(crypto.createHash("sha256").update(fixtureBytes).digest("hex"),
  crypto.createHash("sha256").update(Buffer.from(encodedAttachment, "base64")).digest("hex"));

async function run() {
  await assert.rejects(() => sendTestMessage({ account: null, recipient: "test@example.com", env: baseEnv }), /GMAIL_NOT_CONNECTED/);
  const account = { status: "connected", encryptedRefreshToken: encryptRefreshToken("refresh-token", encryptionKey) };
  const calls = [];
  const successFetch = async (url, options) => {
    calls.push({ url, options });
    if (url.includes("oauth2.googleapis.com")) return { ok: true, status: 200, json: async () => ({ access_token: "access-token" }) };
    return { ok: true, status: 200, json: async () => ({ id: "provider-message-id" }) };
  };
  const result = await sendTestMessage({ account, recipient: "test@example.com", env: baseEnv, fetchImpl: successFetch });
  assert.equal(result.providerMessageId, "provider-message-id");
  assert.equal(calls.length, 2);
  assert(calls[1].url.endsWith("/users/me/messages/send"));
  assert(!calls[1].options.body.includes(TEST_BODY));

  calls.length = 0;
  const attachmentResult = await sendTestMessage({ account, recipient: "test@example.com", subject: PDF_TEST_SUBJECT,
    body: PDF_TEST_BODY, attachment: fixtureAttachment, env: baseEnv, fetchImpl: successFetch });
  assert.equal(attachmentResult.providerMessageId, "provider-message-id");
  const providerPayload = JSON.parse(calls[1].options.body);
  const providerMime = Buffer.from(providerPayload.raw, "base64url").toString("utf8");
  assert(providerMime.includes("Content-Type: application/pdf"));

  const failureFetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
  await assert.rejects(() => sendTestMessage({ account, recipient: "test@example.com", env: baseEnv, fetchImpl: failureFetch }), /GMAIL_PROVIDER_REQUEST_FAILED/);

  const postSendEvents = [];
  const acceptedAt = new Date("2026-11-14T01:00:00.000Z");
  const tracked = await acceptProviderAndTrack({
    sendProvider: async () => ({ providerMessageId: "gmail-accepted-id" }),
    markAccepted: async (data) => { postSendEvents.push(["accepted", data]); return { _id: "send-1", ...data }; },
    createTracker: async (data) => { postSendEvents.push(["tracker", data]); },
    now: acceptedAt,
  });
  assert.equal(tracked.providerMessageId, "gmail-accepted-id");
  assert.deepEqual(postSendEvents.map(([name]) => name), ["accepted", "tracker"]);
  let failureTrackerCalls = 0;
  await assert.rejects(() => acceptProviderAndTrack({
    sendProvider: async () => { throw new Error("MOCK_GMAIL_FAILURE"); },
    markAccepted: async () => { throw new Error("must not run"); },
    createTracker: async () => { failureTrackerCalls += 1; },
  }), /MOCK_GMAIL_FAILURE/);
  assert.equal(failureTrackerCalls, 0, "a provider failure creates no application tracker");

  const routes = fs.readFileSync(path.join(__dirname, "../services/autoApplyV1Routes.js"), "utf8");
  const testRoute = routes.slice(routes.indexOf('router.post("/email/gmail/test-send"'));
  assert(!testRoute.includes("ApplicationTracker.create"));
  assert(!testRoute.includes("markApplied"));
  assert(testRoute.includes('router.post("/email/gmail/test-send-pdf"'));
  assert(testRoute.includes('router.post("/packages/:id/test-send"'));
  assert(testRoute.includes("testRecipientOverride()"), "the backend, not the frontend, selects the test recipient");
  const packageRoute = testRoute.slice(testRoute.indexOf('router.post("/packages/:id/test-send"'));
  assert(packageRoute.includes("subject: draft.subject"));
  assert(packageRoute.includes("body: draft.body"));
  assert(packageRoute.includes("attachment"));
  assert(packageRoute.includes('item.status = "approved"'));
  assert(!packageRoute.includes('item.status = "sent"'));
  assert(packageRoute.includes("upsertAcceptedTracker"));
  assert(packageRoute.includes('status: "accepted"'));
  assert(packageRoute.includes('status: "failed"'));
  const reservationModel = fs.readFileSync(path.join(__dirname, "../models/AutoApplySend.js"), "utf8");
  assert(reservationModel.includes("schema.index({ userId: 1, packageId: 1 }, { unique: true })"));
  console.log("Auto Apply Gmail test-send targeted tests passed");
}

run().catch((error) => { console.error(error); process.exit(1); });
