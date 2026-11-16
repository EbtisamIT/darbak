const crypto = require("node:crypto");
const Account = require("../models/ConnectedEmailAccount");
const OAuthState = require("../models/AutoApplyOAuthState");
const PendingLink = require("../models/AutoApplyGmailPendingLink");
const { requiredConfig, stateHash, exchangeCode, googleIdentity, validateGrantedScopes,
  encryptRefreshToken } = require("./autoApplyGmailOAuth");

const PENDING_LINK_TTL_MS = 10 * 60 * 1000;

const errorPage = `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>تعذر ربط Gmail</title>
  <body style="font-family:sans-serif;background:#0b1013;color:#eef8f4;padding:40px;text-align:center">
  <h1>تعذر ربط Gmail</h1><p>ارجع إلى دربك وحاول مرة أخرى.</p></body></html>`;

const leanResult = async (query) => (typeof query?.lean === "function" ? query.lean() : query);

// Google returns here without any Darbak login. The grant is parked as a
// pending link; it becomes a connected account only after claimGmailLink runs
// with the same student's credentials.
async function completeGmailCallback({ state, code, now = new Date(), config = requiredConfig(),
  StateModel = OAuthState, PendingModel = PendingLink, fetchImpl = fetch }) {
  if (!state || !code) throw new Error("GMAIL_OAUTH_CALLBACK_INCOMPLETE");
  const pending = await leanResult(StateModel.findOneAndDelete({ provider: "gmail", stateHash: stateHash(state) }));
  if (!pending || pending.expiresAt <= now) throw new Error("GMAIL_OAUTH_STATE_INVALID");
  const tokens = await exchangeCode(code, config, fetchImpl);
  if (!tokens.access_token || !tokens.refresh_token) throw new Error("GOOGLE_REFRESH_TOKEN_MISSING");
  const scopes = validateGrantedScopes(tokens.scope);
  const emailAddress = await googleIdentity(tokens.access_token, fetchImpl);
  const linkCode = crypto.randomBytes(32).toString("base64url");
  await PendingModel.create({
    userId: pending.userId, linkCodeHash: stateHash(linkCode), emailAddress, scopes,
    encryptedRefreshToken: encryptRefreshToken(tokens.refresh_token, config.encryptionKey),
    expiresAt: new Date(now.getTime() + PENDING_LINK_TTL_MS),
  });
  return { userId: pending.userId, emailAddress, linkCode };
}

async function claimGmailLink({ linkCode, userId, now = new Date(), PendingModel = PendingLink, AccountModel = Account }) {
  const code = String(linkCode || "");
  if (!/^[A-Za-z0-9_-]{43}$/.test(code) || !userId) {
    throw Object.assign(new Error("GMAIL_LINK_INVALID"), { status: 400 });
  }
  // Single use: the pending grant is removed whether or not the claim matches.
  const query = PendingModel.findOneAndDelete({ linkCodeHash: stateHash(code) });
  const pending = await leanResult(typeof query?.select === "function" ? query.select("+encryptedRefreshToken") : query);
  if (!pending || pending.expiresAt <= now) {
    throw Object.assign(new Error("GMAIL_LINK_INVALID"), { status: 400 });
  }
  if (String(pending.userId) !== String(userId)) {
    throw Object.assign(new Error("GMAIL_LINK_ACCOUNT_MISMATCH"), { status: 403 });
  }
  await AccountModel.findOneAndUpdate({ userId: pending.userId, provider: "gmail" }, { $set: {
    emailAddress: pending.emailAddress, status: "connected", encryptedRefreshToken: pending.encryptedRefreshToken,
    scopes: pending.scopes, connectedAt: now, lastValidatedAt: now,
  } }, { upsert: true, new: true, runValidators: true });
  return { emailAddress: pending.emailAddress };
}

async function gmailCallback(req, res) {
  try {
    const config = requiredConfig();
    const state = String(req.query.state || "");
    const code = String(req.query.code || "");
    if (!state || !code || req.query.error) return res.redirect(303, "/api/auto-apply/email/gmail/error");
    const { linkCode } = await completeGmailCallback({ state, code, config });
    // Fragment, not query: the one-time code never reaches server logs or Referer headers.
    const target = new URL(config.frontendUri);
    target.hash = `gmail_link=${linkCode}`;
    return res.set("Cache-Control", "no-store").redirect(303, target.toString());
  } catch (error) {
    console.error("Auto Apply Gmail OAuth callback failed:", error.message);
    return res.redirect(303, "/api/auto-apply/email/gmail/error");
  }
}

const gmailErrorPage = (_req, res) => res.status(400).set("Cache-Control", "no-store").type("html").send(errorPage);

module.exports = { completeGmailCallback, claimGmailLink, gmailCallback, gmailErrorPage };
