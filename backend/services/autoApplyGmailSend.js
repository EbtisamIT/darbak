const { decryptRefreshToken, requiredConfig } = require("./autoApplyGmailOAuth");

const PRODUCTION_SMOKE_SUBJECT = "Darbak Auto Apply — Production Gmail Smoke";
const PRODUCTION_SMOKE_BODY = "هذه رسالة اختبار إنتاجية من خدمة Auto Apply في دربك.\n\nلم يتم إرسال أي طلب تدريب أو التواصل مع أي جهة.";

const normalizeEmail = (value = "") => String(value || "").trim().toLowerCase();
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));

function productionSmokeRecipient(env = process.env) {
  if (env.NODE_ENV !== "production") {
    throw Object.assign(new Error("PRODUCTION_GMAIL_SMOKE_ENV_INVALID"), { status: 404 });
  }
  if (env.AUTO_APPLY_REAL_SEND_ENABLED === "true") {
    throw Object.assign(new Error("PRODUCTION_GMAIL_SMOKE_UNSAFE_REAL_SEND"), { status: 403 });
  }
  if (env.AUTO_APPLY_PROD_TEST_SEND_ENABLED !== "true") {
    throw Object.assign(new Error("PRODUCTION_GMAIL_SMOKE_DISABLED"), { status: 404 });
  }
  const recipient = normalizeEmail(env.AUTO_APPLY_PROD_TEST_RECIPIENT);
  if (!validEmail(recipient)) {
    throw Object.assign(new Error("PRODUCTION_GMAIL_SMOKE_RECIPIENT_INVALID"), { status: 503 });
  }
  return recipient;
}

function encodeHeader(value) {
  return `=?UTF-8?B?${Buffer.from(String(value), "utf8").toString("base64")}?=`;
}

function buildRawMessage({ to, subject = PRODUCTION_SMOKE_SUBJECT, body = PRODUCTION_SMOKE_BODY }) {
  const encodedBody = Buffer.from(String(body), "utf8").toString("base64")
    .match(/.{1,76}/g)?.join("\r\n") || "";
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
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  }, fetchImpl);
  if (!data.access_token) {
    throw Object.assign(new Error("GMAIL_REFRESH_FAILED"), { status: 502 });
  }
  return data.access_token;
}

async function sendProductionSmokeMessage({ account, env = process.env, fetchImpl = fetch }) {
  if (!account || account.status !== "connected" || !account.encryptedRefreshToken) {
    throw Object.assign(new Error("GMAIL_NOT_CONNECTED"), { status: 409 });
  }
  const recipient = productionSmokeRecipient(env);
  const config = requiredConfig(env);
  const refreshToken = decryptRefreshToken(account.encryptedRefreshToken, config.encryptionKey);
  const accessToken = await refreshAccessToken(refreshToken, config, fetchImpl);
  const result = await providerJson("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: buildRawMessage({ to: recipient }) }),
  }, fetchImpl);
  if (!result.id) {
    throw Object.assign(new Error("GMAIL_SEND_RESPONSE_INVALID"), { status: 502 });
  }
  return { providerMessageId: String(result.id), recipient };
}

module.exports = {
  PRODUCTION_SMOKE_SUBJECT,
  PRODUCTION_SMOKE_BODY,
  productionSmokeRecipient,
  buildRawMessage,
  refreshAccessToken,
  sendProductionSmokeMessage,
};
