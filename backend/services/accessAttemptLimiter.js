// Slows down guessing of Darbak access codes.
//
// A "miss" is a contact + access code pair where the contact already has an
// account but no account matches that code. New contacts (first sign-up) and
// correct codes never count, and nothing about existing accounts or their codes
// changes. After too many misses the contact, or the client IP, is paused for a
// short window and every attempt during the pause gets 429 — including a correct
// code, so the pause cannot be used to tell right guesses from wrong ones.
//
// State is in memory per server process: a restart clears it, and several
// instances would each keep their own counts.

const DEFAULTS = {
  windowMs: 15 * 60 * 1000,
  maxContactMisses: 8,
  maxIpMisses: 30,
  verifiedTtlMs: 10 * 60 * 1000,
  maxEntries: 50_000,
};

const THROTTLED_MESSAGE = "محاولات دخول كثيرة برمز غير صحيح. انتظر ١٥ دقيقة ثم حاول مرة أخرى، أو استخدم «نسيت الرمز».";

function createAccessAttemptLimiter(options = {}) {
  const config = { ...DEFAULTS, ...options };
  const now = options.now || (() => Date.now());
  const misses = new Map(); // key -> { count, windowStart, blockedUntil }
  const verified = new Map(); // `${contact}:${hash}` -> expiresAt

  const prune = (map) => {
    if (map.size < config.maxEntries) return;
    const current = now();
    for (const [key, value] of map) {
      const expiry = typeof value === "number" ? value : Math.max(value.blockedUntil, value.windowStart + config.windowMs);
      if (expiry <= current) map.delete(key);
    }
    // Still full of live entries: drop the oldest instead of growing without bound.
    while (map.size >= config.maxEntries) map.delete(map.keys().next().value);
  };

  const blockedUntil = (key) => {
    const entry = misses.get(key);
    if (!entry) return 0;
    return entry.blockedUntil > now() ? entry.blockedUntil : 0;
  };

  const recordMissFor = (key, limit) => {
    const current = now();
    let entry = misses.get(key);
    if (!entry || current - entry.windowStart >= config.windowMs) {
      prune(misses);
      entry = { count: 0, windowStart: current, blockedUntil: 0 };
      misses.set(key, entry);
    }
    entry.count += 1;
    if (entry.count >= limit) entry.blockedUntil = current + config.windowMs;
  };

  return {
    retryAfterSeconds({ contact, ip }) {
      const until = Math.max(blockedUntil(`c:${contact}`), ip ? blockedUntil(`i:${ip}`) : 0);
      return until ? Math.ceil((until - now()) / 1000) : 0;
    },
    recordMiss({ contact, ip }) {
      recordMissFor(`c:${contact}`, config.maxContactMisses);
      if (ip) recordMissFor(`i:${ip}`, config.maxIpMisses);
    },
    isVerified(contact, hash) {
      const expiresAt = verified.get(`${contact}:${hash}`);
      return Boolean(expiresAt && expiresAt > now());
    },
    markVerified(contact, hash) {
      prune(verified);
      verified.set(`${contact}:${hash}`, now() + config.verifiedTtlMs);
    },
  };
}

// Best-effort client IP. The left-most X-Forwarded-For entry can be spoofed, so
// the per-IP limit is only a secondary guard; the per-contact limit is the one
// that protects a known student's email. We avoid the right-most entry because
// behind a CDN it would put many students under one shared IP.
function clientIp(req = {}) {
  const forwarded = String(req.get?.("x-forwarded-for") || "").split(",")[0].trim();
  return forwarded || req.socket?.remoteAddress || "";
}

// Express middleware. `resolveIdentity(req)` returns { contact, accessCode } or
// null; `classify({ contact, accessCode })` resolves to "match" | "miss" | "new".
function createAccessAttemptMiddleware({ limiter, resolveIdentity, classify, hash }) {
  return async (req, res, next) => {
    try {
      const identity = resolveIdentity(req);
      if (!identity) return next();
      const { contact, accessCode } = identity;
      const ip = clientIp(req);
      const retryAfter = limiter.retryAfterSeconds({ contact, ip });
      if (retryAfter) {
        res.set("Retry-After", String(retryAfter));
        return res.status(429).json({ error: THROTTLED_MESSAGE, reason: "access_code_attempts_exceeded" });
      }
      const codeHash = hash(contact, accessCode);
      if (limiter.isVerified(contact, codeHash)) return next();
      const result = await classify({ contact, accessCode, codeHash });
      if (result === "match") limiter.markVerified(contact, codeHash);
      if (result === "miss") limiter.recordMiss({ contact, ip });
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = { createAccessAttemptLimiter, createAccessAttemptMiddleware, clientIp, THROTTLED_MESSAGE };
