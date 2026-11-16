const assert = require("node:assert");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { GMAIL_SEND_SCOPE, authorizationUrl, decryptRefreshToken, safeAccount } = require("../services/autoApplyGmailOAuth");
const { completeGmailCallback, claimGmailLink } = require("../services/autoApplyGmailCallback");

const encryptionKey = crypto.randomBytes(32).toString("base64");
const config = {
  clientId: "client.test.apps.googleusercontent.com",
  clientSecret: "secret-for-test",
  redirectUri: "http://localhost:3001/api/auto-apply/email/gmail/callback",
  frontendUri: "http://localhost:3000/auto-apply",
  encryptionKey,
};

function response(status, data) {
  return { ok: status >= 200 && status < 300, status, json: async () => data };
}

async function run() {
  const auth = new URL(authorizationUrl({ state: "state-1", config }));
  const scopes = auth.searchParams.get("scope").split(" ");
  assert.equal(auth.origin, "https://accounts.google.com");
  assert.equal(auth.searchParams.get("response_type"), "code");
  assert.equal(auth.searchParams.get("access_type"), "offline");
  assert.equal(auth.searchParams.get("state"), "state-1");
  assert(scopes.includes(GMAIL_SEND_SCOPE));
  assert(scopes.includes("openid") && scopes.includes("email"));
  assert(!scopes.some((scope) => /gmail\.readonly|gmail\.modify|mail\.google\.com/.test(scope)));

  const missingState = { findOneAndDelete: () => ({ lean: async () => null }) };
  await assert.rejects(() => completeGmailCallback({ state: "wrong", code: "code", config,
    StateModel: missingState, PendingModel: {}, fetchImpl: async () => response(500, {}) }), /GMAIL_OAUTH_STATE_INVALID/);

  let pendingRecord;
  let fetchCalls = 0;
  const StateModel = { findOneAndDelete: (query) => ({ lean: async () => {
    assert.equal(query.provider, "gmail");
    return { userId: "user-1", expiresAt: new Date(Date.now() + 60_000) };
  } }) };
  const PendingModel = {
    create: async (record) => { pendingRecord = record; return record; },
    findOneAndDelete: (query) => {
      const match = pendingRecord && query.linkCodeHash === pendingRecord.linkCodeHash ? pendingRecord : null;
      pendingRecord = null; // single use, even on mismatch
      return { select: (fields) => { assert.equal(fields, "+encryptedRefreshToken"); return { lean: async () => match }; } };
    },
  };
  const fetchImpl = async (url) => {
    fetchCalls += 1;
    if (url === "https://oauth2.googleapis.com/token") return response(200, {
      access_token: "access-token", refresh_token: "refresh-token", scope: `openid email ${GMAIL_SEND_SCOPE}`,
    });
    if (url === "https://openidconnect.googleapis.com/v1/userinfo") return response(200, {
      email: "Student@Gmail.com", email_verified: true,
    });
    throw new Error(`Unexpected URL: ${url}`);
  };

  // The callback never connects an account by itself; it parks a pending link.
  const completed = await completeGmailCallback({ state: "correct", code: "code", config, StateModel, PendingModel, fetchImpl });
  assert.equal(completed.userId, "user-1");
  assert.equal(completed.emailAddress, "student@gmail.com");
  assert.match(completed.linkCode, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(fetchCalls, 2);
  assert.equal(pendingRecord.userId, "user-1");
  assert.notEqual(pendingRecord.linkCodeHash, completed.linkCode);
  assert.notEqual(pendingRecord.encryptedRefreshToken, "refresh-token");
  assert(pendingRecord.expiresAt > new Date());
  const parkedRecord = { ...pendingRecord };

  let storedQuery;
  let storedUpdate;
  const AccountModel = { findOneAndUpdate: async (query, update, options) => {
    storedQuery = query; storedUpdate = update.$set;
    assert.deepEqual(options, { upsert: true, new: true, runValidators: true });
  } };

  // Rejected: another Darbak account opens the victim's link code (link CSRF).
  await assert.rejects(() => claimGmailLink({ linkCode: completed.linkCode, userId: "attacker-2", PendingModel, AccountModel }),
    /GMAIL_LINK_ACCOUNT_MISMATCH/);
  assert.equal(storedUpdate, undefined);
  // The mismatched attempt burned the code, so the owner cannot reuse it either.
  await assert.rejects(() => claimGmailLink({ linkCode: completed.linkCode, userId: "user-1", PendingModel, AccountModel }),
    /GMAIL_LINK_INVALID/);

  // Rejected: malformed and expired codes.
  await assert.rejects(() => claimGmailLink({ linkCode: "short", userId: "user-1", PendingModel, AccountModel }), /GMAIL_LINK_INVALID/);
  pendingRecord = { ...parkedRecord, expiresAt: new Date(Date.now() - 1) };
  await assert.rejects(() => claimGmailLink({ linkCode: completed.linkCode, userId: "user-1", PendingModel, AccountModel }),
    /GMAIL_LINK_INVALID/);

  // Accepted: the same account that started the link claims it.
  pendingRecord = { ...parkedRecord };
  const claimed = await claimGmailLink({ linkCode: completed.linkCode, userId: "user-1", PendingModel, AccountModel });
  assert.deepEqual(claimed, { emailAddress: "student@gmail.com" });
  assert.deepEqual(storedQuery, { userId: "user-1", provider: "gmail" });
  assert.equal(storedUpdate.status, "connected");
  assert.equal(decryptRefreshToken(storedUpdate.encryptedRefreshToken, encryptionKey), "refresh-token");
  await assert.rejects(() => claimGmailLink({ linkCode: completed.linkCode, userId: "user-1", PendingModel, AccountModel }),
    /GMAIL_LINK_INVALID/);
  assert.deepEqual(safeAccount({ status: "connected", emailAddress: "student@gmail.com", encryptedRefreshToken: "never-return" }),
    { provider: "gmail", connectionStatus: "connected", emailAddress: "student@gmail.com" });

  const routes = fs.readFileSync(path.join(__dirname, "../services/autoApplyV1Routes.js"), "utf8");
  const server = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
  assert(routes.includes("if (!req.autoApplyUser?._id) return res.status(401)"));
  assert(routes.includes("userId: req.autoApplyUser._id, provider: \"gmail\""));
  assert(routes.includes("findOneAndDelete({ userId: req.autoApplyUser._id, provider: \"gmail\" })"));
  assert(server.includes("app.use(\"/api/auto-apply\", requireAutoApplyUser, require(\"./services/autoApplyV1Routes\"))"));
  assert(routes.includes("router.post(\"/email/gmail/complete\""));
  assert(routes.includes("claimGmailLink({ linkCode: req.body?.linkCode, userId: req.autoApplyUser._id })"));
  assert(!routes.includes("users.messages.send"));
  assert(!fs.readFileSync(path.join(__dirname, "../services/autoApplyGmailOAuth.js"), "utf8").includes("users.messages.send"));

  console.log("Auto Apply Gmail OAuth targeted tests passed");
}

run().catch((error) => { console.error(error); process.exit(1); });
