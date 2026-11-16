const Account = require("../models/ConnectedEmailAccount");
const OAuthState = require("../models/AutoApplyOAuthState");
const { requiredConfig, stateHash, exchangeCode, googleIdentity, validateGrantedScopes,
  encryptRefreshToken } = require("./autoApplyGmailOAuth");

const errorPage = `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>تعذر ربط Gmail</title>
  <body style="font-family:sans-serif;background:#0b1013;color:#eef8f4;padding:40px;text-align:center">
  <h1>تعذر ربط Gmail</h1><p>ارجع إلى دربك وحاول مرة أخرى.</p></body></html>`;

async function completeGmailCallback({ state, code, now = new Date(), config = requiredConfig(),
  StateModel = OAuthState, AccountModel = Account, fetchImpl = fetch }) {
  if (!state || !code) throw new Error("GMAIL_OAUTH_CALLBACK_INCOMPLETE");
  const pendingQuery = StateModel.findOneAndDelete({ provider: "gmail", stateHash: stateHash(state) });
  const pending = typeof pendingQuery.lean === "function" ? await pendingQuery.lean() : await pendingQuery;
  if (!pending || pending.expiresAt <= now) throw new Error("GMAIL_OAUTH_STATE_INVALID");
  const tokens = await exchangeCode(code, config, fetchImpl);
  if (!tokens.access_token || !tokens.refresh_token) throw new Error("GOOGLE_REFRESH_TOKEN_MISSING");
  const scopes = validateGrantedScopes(tokens.scope);
  const emailAddress = await googleIdentity(tokens.access_token, fetchImpl);
  await AccountModel.findOneAndUpdate({ userId: pending.userId, provider: "gmail" }, { $set: {
    emailAddress, status: "connected", encryptedRefreshToken: encryptRefreshToken(tokens.refresh_token, config.encryptionKey),
    scopes, connectedAt: now, lastValidatedAt: now,
  } }, { upsert: true, new: true, runValidators: true });
  return { userId: pending.userId, emailAddress };
}

async function gmailCallback(req, res) {
  try {
    const config = requiredConfig();
    const state = String(req.query.state || "");
    const code = String(req.query.code || "");
    if (!state || !code || req.query.error) return res.redirect(303, "/api/auto-apply/email/gmail/error");
    await completeGmailCallback({ state, code, config });
    return res.redirect(303, config.frontendUri);
  } catch (error) {
    console.error("Auto Apply Gmail OAuth callback failed:", error.message);
    return res.redirect(303, "/api/auto-apply/email/gmail/error");
  }
}

const gmailErrorPage = (_req, res) => res.status(400).set("Cache-Control", "no-store").type("html").send(errorPage);

module.exports = { completeGmailCallback, gmailCallback, gmailErrorPage };
