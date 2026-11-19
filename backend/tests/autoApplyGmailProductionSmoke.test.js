const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  PRODUCTION_SMOKE_SUBJECT,
  PRODUCTION_SMOKE_BODY,
  productionSmokeRecipient,
  buildRawMessage,
  sendProductionSmokeMessage,
} = require("../services/autoApplyGmailSend");
const { encryptRefreshToken } = require("../services/autoApplyGmailOAuth");

const encryptionKey = Buffer.alloc(32, 9).toString("base64");
const baseEnv = {
  NODE_ENV: "production",
  AUTO_APPLY_REAL_SEND_ENABLED: "false",
  AUTO_APPLY_PROD_TEST_SEND_ENABLED: "true",
  AUTO_APPLY_PROD_TEST_RECIPIENT: "controlled@example.com",
  GOOGLE_CLIENT_ID: "client",
  GOOGLE_CLIENT_SECRET: "secret",
  GOOGLE_OAUTH_REDIRECT_URI: "https://api.darbak.space/api/auto-apply/email/gmail/callback",
  AUTO_APPLY_FRONTEND_URL: "https://darbak.space",
  AUTO_APPLY_EMAIL_TOKEN_ENCRYPTION_KEY: encryptionKey,
};

assert.equal(productionSmokeRecipient(baseEnv), "controlled@example.com");
assert.throws(() => productionSmokeRecipient({ ...baseEnv, NODE_ENV: "development" }),
  /PRODUCTION_GMAIL_SMOKE_ENV_INVALID/);
assert.throws(() => productionSmokeRecipient({ ...baseEnv, AUTO_APPLY_PROD_TEST_SEND_ENABLED: "false" }),
  /PRODUCTION_GMAIL_SMOKE_DISABLED/);
assert.throws(() => productionSmokeRecipient({ ...baseEnv, AUTO_APPLY_REAL_SEND_ENABLED: "true" }),
  /PRODUCTION_GMAIL_SMOKE_UNSAFE_REAL_SEND/);
assert.throws(() => productionSmokeRecipient({ ...baseEnv, AUTO_APPLY_PROD_TEST_RECIPIENT: "company" }),
  /PRODUCTION_GMAIL_SMOKE_RECIPIENT_INVALID/);

const mime = Buffer.from(buildRawMessage({ to: "controlled@example.com" }), "base64url").toString("utf8");
assert(mime.includes(`Subject: =?UTF-8?B?${Buffer.from(PRODUCTION_SMOKE_SUBJECT).toString("base64")}?=`));
assert(mime.includes(Buffer.from(PRODUCTION_SMOKE_BODY).toString("base64").slice(0, 40)));
assert(mime.includes("To: controlled@example.com"));

async function run() {
  await assert.rejects(() => sendProductionSmokeMessage({ account: null, env: baseEnv }), /GMAIL_NOT_CONNECTED/);
  const account = {
    status: "connected",
    encryptedRefreshToken: encryptRefreshToken("refresh-token", encryptionKey),
  };
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.includes("oauth2.googleapis.com")) {
      return { ok: true, status: 200, json: async () => ({ access_token: "access-token" }) };
    }
    return { ok: true, status: 200, json: async () => ({ id: "provider-message-id" }) };
  };
  const result = await sendProductionSmokeMessage({ account, env: baseEnv, fetchImpl });
  assert.equal(result.providerMessageId, "provider-message-id");
  assert.equal(calls.length, 2);
  assert(calls[1].url.endsWith("/users/me/messages/send"));

  const server = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
  assert(server.includes('"/api/admin/auto-apply"'));
  assert(server.includes("requireAdmin"));
  assert(server.includes("requireAutoApplyOAuthUser"));
  const route = fs.readFileSync(path.join(__dirname,
    "../services/autoApplyGmailProductionSmokeRoutes.js"), "utf8");
  assert(route.includes("forbiddenRecipientFields"));
  assert(route.includes("productionSmokeRecipient(env)"));
  assert(!route.includes("ApplicationTracker"));
  assert(!route.includes("CompanyApplication"));
  assert(!route.includes("markApplied"));
  const model = fs.readFileSync(path.join(__dirname,
    "../models/AutoApplyProductionGmailSmoke.js"), "utf8");
  assert(model.includes("unique: true"));
  console.log("Production Gmail smoke targeted tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
