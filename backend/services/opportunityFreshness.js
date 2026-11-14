// Keeps published opportunities fresh without manual review: most have no
// deadline, so we periodically re-open their application link and close the
// ones whose page is gone or says applications are closed.
const { pinnedRequest } = require("./opportunityDiscovery/http");
const { CLOSED, text } = require("./opportunityDiscovery/extract");

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const readNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getFreshnessConfig = (env = process.env) => ({
  // No deadline and not confirmed open recently → close after this many days.
  maxAgeWithoutDeadlineDays: readNumber(env.OPPORTUNITY_MAX_AGE_WITHOUT_DEADLINE_DAYS, 45),
  // A link confirmed open within this window still counts as open.
  openGraceDays: readNumber(env.OPPORTUNITY_OPEN_GRACE_DAYS, 7),
  recheckAfterHours: readNumber(env.OPPORTUNITY_RECHECK_AFTER_HOURS, 20),
  // After an admin reopens an auto-closed opportunity, leave it alone this long.
  adminKeepDays: readNumber(env.OPPORTUNITY_ADMIN_KEEP_DAYS, 30),
  // Consecutive "closed" checks (≥ recheckAfterHours apart) before closing.
  closedChecksToExpire: readNumber(env.OPPORTUNITY_CLOSED_CHECKS_TO_EXPIRE, 2),
  batchSize: readNumber(env.OPPORTUNITY_FRESHNESS_BATCH_SIZE, 40),
  concurrency: readNumber(env.OPPORTUNITY_FRESHNESS_CONCURRENCY, 3),
  timeoutMs: readNumber(env.OPPORTUNITY_FRESHNESS_TIMEOUT_MS, 8000),
});

const AUTO_EXPIRE_REASONS = {
  PAGE_CLOSED: "page_closed",
  PAGE_MISSING: "page_missing",
  STALE_UNVERIFIED: "stale_unverified",
};

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 4;

const toHttpsUrl = (value) => {
  try {
    const url = new URL(String(value || "").trim());
    if (url.protocol === "http:") url.protocol = "https:";
    if (url.protocol !== "https:" || url.username || url.password) return null;
    url.hash = "";
    return url;
  } catch {
    return null;
  }
};

const isInternalOpportunity = (opportunity = {}) =>
  Boolean(opportunity.isDarbakApplication) || opportunity.applicationMethod === "darbak";

const getOpportunityCheckUrl = (opportunity = {}) => {
  if (isInternalOpportunity(opportunity)) return "";
  for (const value of [opportunity.applicationUrl, opportunity.sourceUrl]) {
    const url = toHttpsUrl(value);
    if (url) return url.href;
  }
  return "";
};

const trimmedPath = (url) => url.pathname.replace(/\/+$/, "");

// Returns { result: "open" | "closed" | "unknown", reason }.
// Anything we cannot read reliably is "unknown", never "closed".
const checkOpportunityLink = async (
  value,
  { transport = pinnedRequest, timeoutMs = 8000 } = {}
) => {
  let current = toHttpsUrl(value);
  if (!current) return { result: "unknown", reason: "INVALID_URL" };

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    let response;
    try {
      response = await transport(current, { timeout: timeoutMs });
    } catch (err) {
      return { result: "unknown", reason: err?.code || "REQUEST_FAILED" };
    }

    const status = Number(response?.status || 0);
    if (REDIRECT_STATUSES.has(status)) {
      const location = response.headers?.location;
      if (!location || hop === MAX_REDIRECTS) {
        return { result: "unknown", reason: "REDIRECT_LIMIT" };
      }
      const next = toHttpsUrl(new URL(location, current).href);
      if (!next) return { result: "unknown", reason: "UNSAFE_REDIRECT" };
      // Removed postings often bounce to the site's home page; that is a hint,
      // not proof, so the age rule decides instead.
      if (!trimmedPath(next) && trimmedPath(current)) {
        return { result: "unknown", reason: "REDIRECTED_TO_HOMEPAGE" };
      }
      current = next;
      continue;
    }

    if (status === 404 || status === 410) {
      return { result: "closed", reason: `HTTP_${status}` };
    }
    if (status < 200 || status >= 300) {
      return { result: "unknown", reason: `HTTP_${status || "ERROR"}` };
    }

    const contentType = String(response.headers?.["content-type"] || "");
    if (/text\/html|text\/plain|application\/(?:ld\+)?json/i.test(contentType)) {
      const pageText = text(String(response.text || "").slice(0, 2 * 1024 * 1024));
      if (CLOSED.test(pageText)) return { result: "closed", reason: "CLOSED_TEXT" };
    }
    return { result: "open", reason: "OK" };
  }

  return { result: "unknown", reason: "REDIRECT_LIMIT" };
};

const toTime = (value) => {
  if (!value) return NaN;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? NaN : time;
};

// Pure decision: what to store after a check, and whether to close it.
const decideOpportunityFreshness = (
  opportunity = {},
  check = { result: "unknown", reason: "" },
  { now = new Date(), config = getFreshnessConfig() } = {}
) => {
  const nowTime = now.getTime();
  const previous = opportunity.freshness || {};
  const closedStreak = check.result === "closed" ? Number(previous.closedStreak || 0) + 1 : 0;
  const lastOpenTime = check.result === "open" ? nowTime : toTime(previous.lastOpenAt);
  const adminKeptTime = toTime(previous.adminKeptAt);
  const keptByAdmin =
    !Number.isNaN(adminKeptTime) && nowTime - adminKeptTime < config.adminKeepDays * DAY_MS;
  const hasDeadline = !Number.isNaN(toTime(opportunity.deadline));
  const createdTime = toTime(opportunity.createdAt);
  const ageDays = Number.isNaN(createdTime) ? 0 : (nowTime - createdTime) / DAY_MS;
  const recentlyOpen =
    !Number.isNaN(lastOpenTime) && nowTime - lastOpenTime < config.openGraceDays * DAY_MS;

  let expireReason = "";
  if (!keptByAdmin) {
    if (closedStreak >= config.closedChecksToExpire) {
      expireReason =
        check.reason === "CLOSED_TEXT"
          ? AUTO_EXPIRE_REASONS.PAGE_CLOSED
          : AUTO_EXPIRE_REASONS.PAGE_MISSING;
    } else if (!hasDeadline && ageDays >= config.maxAgeWithoutDeadlineDays && !recentlyOpen) {
      expireReason = AUTO_EXPIRE_REASONS.STALE_UNVERIFIED;
    }
  }

  const set = {
    "freshness.lastCheckedAt": now,
    "freshness.lastResult": check.result,
    "freshness.lastReason": check.reason || "",
    "freshness.closedStreak": closedStreak,
  };
  if (check.result === "open") set["freshness.lastOpenAt"] = now;
  if (expireReason) {
    set.status = "expired";
    set["freshness.autoExpiredAt"] = now;
    set["freshness.autoExpiredReason"] = expireReason;
  }

  return { set, expire: Boolean(expireReason), reason: expireReason };
};

// When an admin reopens an auto-closed opportunity, trust them for a while.
const getAdminReactivationFreshness = (existing, nextStatus, now = new Date()) => {
  if (!existing || existing.status !== "expired" || nextStatus !== "active") return null;
  if (!existing.freshness?.autoExpiredAt) return null;
  return {
    "freshness.adminKeptAt": now,
    "freshness.closedStreak": 0,
    "freshness.autoExpiredAt": null,
    "freshness.autoExpiredReason": "",
  };
};

const runWithConcurrency = async (items, limit, worker) => {
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index];
      index += 1;
      await worker(item);
    }
  });
  await Promise.all(runners);
};

const runOpportunityFreshnessSweep = async ({
  Opportunity,
  now = new Date(),
  transport = pinnedRequest,
  config = getFreshnessConfig(),
  logger = console,
} = {}) => {
  const recheckCutoff = new Date(now.getTime() - config.recheckAfterHours * HOUR_MS);
  const opportunities = await Opportunity.find({
    status: "active",
    isDarbakApplication: { $ne: true },
    applicationMethod: { $ne: "darbak" },
    $or: [
      { "freshness.lastCheckedAt": { $exists: false } },
      { "freshness.lastCheckedAt": null },
      { "freshness.lastCheckedAt": { $lt: recheckCutoff } },
    ],
  })
    .sort({ "freshness.lastCheckedAt": 1, createdAt: 1 })
    .limit(config.batchSize)
    .select("organizationName title applicationUrl sourceUrl applicationMethod isDarbakApplication deadline createdAt status freshness")
    .lean();

  const summary = { checked: 0, open: 0, closed: 0, unknown: 0, expired: 0, expiredIds: [] };

  await runWithConcurrency(opportunities, config.concurrency, async (opportunity) => {
    const url = getOpportunityCheckUrl(opportunity);
    const check = url
      ? await checkOpportunityLink(url, { transport, timeoutMs: config.timeoutMs })
      : { result: "unknown", reason: "NO_LINK" };
    const decision = decideOpportunityFreshness(opportunity, check, { now, config });

    try {
      // status filter: never overwrite an admin edit made during the check.
      const update = await Opportunity.updateOne(
        { _id: opportunity._id, status: "active" },
        { $set: decision.set }
      );
      if (!update?.matchedCount && update?.matchedCount !== undefined) return;
    } catch (err) {
      logger.error?.("❌ Opportunity freshness update failed:", opportunity._id, err?.message);
      return;
    }

    summary.checked += 1;
    summary[check.result] += 1;
    if (decision.expire) {
      summary.expired += 1;
      summary.expiredIds.push(String(opportunity._id));
    }
  });

  return summary;
};

module.exports = {
  AUTO_EXPIRE_REASONS,
  getFreshnessConfig,
  getOpportunityCheckUrl,
  checkOpportunityLink,
  decideOpportunityFreshness,
  getAdminReactivationFreshness,
  runOpportunityFreshnessSweep,
};
