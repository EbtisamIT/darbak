const crypto = require("node:crypto");

const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
const IDENTITY_SCOPES = ["openid", "email"];
const REQUESTED_SCOPES = [...IDENTITY_SCOPES, GMAIL_SEND_SCOPE];

function requiredConfig(env = process.env) {
  const config = {
    clientId: env.GOOGLE_CLIENT_ID || "",
    clientSecret: env.GOOGLE_CLIENT_SECRET || "",
    redirectUri: env.GOOGLE_OAUTH_REDIRECT_URI || "",
    frontendUri: env.AUTO_APPLY_FRONTEND_URL || "http://localhost:3000/auto-apply",
    encryptionKey: env.AUTO_APPLY_EMAIL_TOKEN_ENCRYPTION_KEY || "",
  };
  if (!config.clientId || !config.clientSecret || !config.redirectUri || !config.encryptionKey) {
    const error = new Error("GMAIL_OAUTH_NOT_CONFIGURED");
    error.status = 503;
    throw error;
  }
  for (const [value, purpose] of [[config.redirectUri, "callback"], [config.frontendUri, "frontend"]]) {
    let parsed;
    try { parsed = new URL(value); } catch { parsed = null; }
    const local = parsed && ["localhost", "127.0.0.1"].includes(parsed.hostname);
    if (!parsed || (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:"))) {
      const error = new Error(`INVALID_${purpose.toUpperCase()}_URI`);
      error.status = 503;
      throw error;
    }
  }
  return config;
}

function encryptionKey(value) {
  const source = String(value || "");
  const key = /^[a-f0-9]{64}$/i.test(source) ? Buffer.from(source, "hex") : Buffer.from(source, "base64");
  if (key.length !== 32) {
    const error = new Error("INVALID_TOKEN_ENCRYPTION_KEY");
    error.status = 503;
    throw error;
  }
  return key;
}

function encryptRefreshToken(token, keyValue) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(keyValue), iv);
  const encrypted = Buffer.concat([cipher.update(String(token), "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decryptRefreshToken(value, keyValue) {
  const [version, iv, tag, encrypted] = String(value || "").split(".");
  if (version !== "v1" || !iv || !tag || !encrypted) throw new Error("INVALID_ENCRYPTED_TOKEN");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(keyValue), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}

const stateHash = (state) => crypto.createHash("sha256").update(String(state || "")).digest("hex");

function authorizationUrl({ state, config }) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: REQUESTED_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
    state,
  }).toString();
  return url.toString();
}

async function googleRequest(url, options, fetchImpl = fetch) {
  const response = await fetchImpl(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error("GOOGLE_OAUTH_REQUEST_FAILED");
    error.status = 502;
    error.providerStatus = response.status;
    throw error;
  }
  return data;
}

async function exchangeCode(code, config, fetchImpl = fetch) {
  return googleRequest("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret,
      redirect_uri: config.redirectUri, grant_type: "authorization_code" }),
  }, fetchImpl);
}

async function googleIdentity(accessToken, fetchImpl = fetch) {
  const identity = await googleRequest("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  }, fetchImpl);
  if (!identity.email || identity.email_verified !== true) {
    const error = new Error("GOOGLE_EMAIL_NOT_VERIFIED");
    error.status = 400;
    throw error;
  }
  return String(identity.email).trim().toLowerCase();
}

function grantedScopes(value) {
  return String(value || "").split(/\s+/).filter(Boolean);
}

function validateGrantedScopes(value) {
  const scopes = grantedScopes(value);
  if (!scopes.includes(GMAIL_SEND_SCOPE)) {
    const error = new Error("GMAIL_SEND_SCOPE_NOT_GRANTED");
    error.status = 400;
    throw error;
  }
  const gmailScopes = scopes.filter((scope) => scope.includes("googleapis.com/auth/gmail.") || scope === "https://mail.google.com/");
  if (gmailScopes.some((scope) => scope !== GMAIL_SEND_SCOPE)) {
    const error = new Error("UNEXPECTED_GMAIL_SCOPE_GRANTED");
    error.status = 400;
    throw error;
  }
  return scopes;
}

function safeAccount(account) {
  if (!account || account.status !== "connected") return { provider: "gmail", connectionStatus: "not_connected", emailAddress: "" };
  return { provider: "gmail", connectionStatus: "connected", emailAddress: account.emailAddress };
}

module.exports = { GMAIL_SEND_SCOPE, IDENTITY_SCOPES, REQUESTED_SCOPES, requiredConfig, encryptRefreshToken,
  decryptRefreshToken, stateHash, authorizationUrl, exchangeCode, googleIdentity, validateGrantedScopes, safeAccount };
