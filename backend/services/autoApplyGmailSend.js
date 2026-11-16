const { decryptRefreshToken, requiredConfig } = require("./autoApplyGmailOAuth");

const TEST_SUBJECT = "Darbak Auto Apply — Gmail Test";
const TEST_BODY = "هذه رسالة اختبار من خدمة Auto Apply في دربك.\n\nتم الإرسال من البريد المرتبط بنجاح.";
const PDF_TEST_SUBJECT = "Darbak Auto Apply — PDF Attachment Test";
const PDF_TEST_BODY = "هذه رسالة اختبار من خدمة Auto Apply في دربك.\n\nتم إرفاق ملف PDF تجريبي للتأكد من عمل المرفقات.";
const DEFAULT_TEST_ATTACHMENT_LIMIT = 5 * 1024 * 1024;
const normalizeEmail = (value = "") => String(value || "").trim().toLowerCase();
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));

function approvedRecipients(env = process.env) {
  return new Set(String(env.AUTO_APPLY_GMAIL_TEST_RECIPIENTS || "").split(",").map(normalizeEmail).filter(Boolean));
}

function assertTestSendAllowed({ recipient, env = process.env }) {
  const normalizedRecipient = normalizeEmail(recipient);
  if (env.NODE_ENV === "production") throw Object.assign(new Error("GMAIL_TEST_SEND_DISABLED"), { status: 404 });
  if (env.AUTO_APPLY_REAL_SEND_ENABLED === "true") throw Object.assign(new Error("GMAIL_TEST_SEND_DISABLED"), { status: 403 });
  if (env.AUTO_APPLY_GMAIL_TEST_SEND_ENABLED !== "true") throw Object.assign(new Error("GMAIL_TEST_SEND_DISABLED"), { status: 404 });
  if (!validEmail(normalizedRecipient) || !approvedRecipients(env).has(normalizedRecipient)) {
    throw Object.assign(new Error("GMAIL_TEST_RECIPIENT_NOT_ALLOWED"), { status: 403 });
  }
  return normalizedRecipient;
}

function encodeHeader(value) {
  return `=?UTF-8?B?${Buffer.from(String(value), "utf8").toString("base64")}?=`;
}

function encodeBase64Lines(bytes) {
  return Buffer.from(bytes).toString("base64").match(/.{1,76}/g)?.join("\r\n") || "";
}

function validatePdfAttachment(attachment, env = process.env) {
  if (!attachment || typeof attachment !== "object") {
    throw Object.assign(new Error("GMAIL_TEST_ATTACHMENT_MISSING"), { status: 400 });
  }
  const bytes = Buffer.isBuffer(attachment.bytes) ? attachment.bytes : null;
  if (!bytes?.length) throw Object.assign(new Error("GMAIL_TEST_ATTACHMENT_EMPTY"), { status: 400 });
  const configuredLimit = Number(env.AUTO_APPLY_GMAIL_TEST_MAX_ATTACHMENT_BYTES);
  const maxBytes = Number.isSafeInteger(configuredLimit) && configuredLimit > 0
    ? configuredLimit : DEFAULT_TEST_ATTACHMENT_LIMIT;
  if (bytes.length > maxBytes) {
    throw Object.assign(new Error("GMAIL_TEST_ATTACHMENT_TOO_LARGE"), { status: 413 });
  }
  if (attachment.mimeType !== "application/pdf" || bytes.subarray(0, 5).toString("ascii") !== "%PDF-" ||
    !bytes.includes(Buffer.from("%%EOF"))) {
    throw Object.assign(new Error("GMAIL_TEST_ATTACHMENT_NOT_PDF"), { status: 400 });
  }
  const filename = String(attachment.filename || "").trim();
  if (!filename || !filename.toLowerCase().endsWith(".pdf") || /[\r\n]/.test(filename)) {
    throw Object.assign(new Error("GMAIL_TEST_ATTACHMENT_FILENAME_INVALID"), { status: 400 });
  }
  return { filename, mimeType: "application/pdf", bytes };
}

function buildRawMessage({ to, subject = TEST_SUBJECT, body = TEST_BODY, attachment = null, env = process.env }) {
  const encodedBody = Buffer.from(String(body), "utf8").toString("base64").match(/.{1,76}/g)?.join("\r\n") || "";
  if (attachment) {
    const pdf = validatePdfAttachment(attachment, env);
    const boundary = `darbak-auto-apply-${Buffer.from(subject).toString("base64url").slice(0, 24)}`;
    const encodedFilename = encodeURIComponent(pdf.filename).replace(/'/g, "%27");
    const mime = [
      `To: ${normalizeEmail(to)}`,
      `Subject: ${encodeHeader(subject)}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      encodedBody,
      `--${boundary}`,
      `Content-Type: ${pdf.mimeType}; name*=UTF-8''${encodedFilename}`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename*=UTF-8''${encodedFilename}`,
      "",
      encodeBase64Lines(pdf.bytes),
      `--${boundary}--`,
      "",
    ].join("\r\n");
    return Buffer.from(mime, "utf8").toString("base64url");
  }
  const mime = [
    `To: ${normalizeEmail(to)}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    encodedBody,
  ].join("\r\n");
  return Buffer.from(mime, "utf8").toString("base64url");
}

async function providerJson(url, options, fetchImpl) {
  const response = await fetchImpl(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error("GMAIL_PROVIDER_REQUEST_FAILED");
    error.status = 502;
    error.providerStatus = response.status;
    throw error;
  }
  return data;
}

async function refreshAccessToken(refreshToken, config, fetchImpl = fetch) {
  const data = await providerJson("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret,
      refresh_token: refreshToken, grant_type: "refresh_token" }),
  }, fetchImpl);
  if (!data.access_token) throw Object.assign(new Error("GMAIL_REFRESH_FAILED"), { status: 502 });
  return data.access_token;
}

async function sendTestMessage({ account, recipient, subject = TEST_SUBJECT, body = TEST_BODY,
  attachment = null, env = process.env, fetchImpl = fetch }) {
  if (!account || account.status !== "connected" || !account.encryptedRefreshToken) {
    throw Object.assign(new Error("GMAIL_NOT_CONNECTED"), { status: 409 });
  }
  const normalizedRecipient = assertTestSendAllowed({ recipient, env });
  const config = requiredConfig(env);
  const refreshToken = decryptRefreshToken(account.encryptedRefreshToken, config.encryptionKey);
  const accessToken = await refreshAccessToken(refreshToken, config, fetchImpl);
  const result = await providerJson("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: buildRawMessage({ to: normalizedRecipient, subject, body, attachment, env }) }),
  }, fetchImpl);
  if (!result.id) throw Object.assign(new Error("GMAIL_SEND_RESPONSE_INVALID"), { status: 502 });
  return { providerMessageId: String(result.id), recipient: normalizedRecipient };
}

module.exports = { TEST_SUBJECT, TEST_BODY, PDF_TEST_SUBJECT, PDF_TEST_BODY, assertTestSendAllowed,
  validatePdfAttachment, buildRawMessage, refreshAccessToken, sendTestMessage };
