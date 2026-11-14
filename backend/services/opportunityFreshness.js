// Keeps published opportunities fresh without manual review: most have no
// deadline, so we periodically re-open their application link and close the
// ones whose page is gone or says applications are closed.
const crypto = require("crypto");
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
  // Distinct student reports ("الفرصة منتهية؟") within the window that close it.
  reportsToExpire: readNumber(env.OPPORTUNITY_REPORTS_TO_EXPIRE, 3),
  reportWindowDays: readNumber(env.OPPORTUNITY_REPORT_WINDOW_DAYS, 14),
  batchSize: readNumber(env.OPPORTUNITY_FRESHNESS_BATCH_SIZE, 40),
  concurrency: readNumber(env.OPPORTUNITY_FRESHNESS_CONCURRENCY, 3),
  timeoutMs: readNumber(env.OPPORTUNITY_FRESHNESS_TIMEOUT_MS, 8000),
});

const AUTO_EXPIRE_REASONS = {
  PAGE_CLOSED: "page_closed",
  PAGE_MISSING: "page_missing",
  STALE_UNVERIFIED: "stale_unverified",
  STUDENT_REPORTS: "student_reports",
};
const MAX_STORED_REPORTS = 20;

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

// The application page is checked when there is one. Otherwise (e.g. email
// applications) we fall back to the post the opportunity was shared in.
const getOpportunityCheckTarget = (opportunity = {}) => {
  if (isInternalOpportunity(opportunity)) return null;
  const applicationUrl = toHttpsUrl(opportunity.applicationUrl);
  if (applicationUrl) return { url: applicationUrl.href, kind: "application" };
  const sourceUrl = toHttpsUrl(opportunity.sourceUrl);
  if (sourceUrl) return { url: sourceUrl.href, kind: "source" };
  return null;
};

const getOpportunityCheckUrl = (opportunity = {}) =>
  getOpportunityCheckTarget(opportunity)?.url || "";

// A source post (LinkedIn/X announcement) usually stays online long after
// applications close, so it can prove an opportunity is gone but never that
// it is still open.
const applyCheckTarget = (check, target) =>
  target?.kind === "source" && check.result === "open"
    ? { result: "unknown", reason: "SOURCE_PAGE_ONLY" }
    : check;

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
    "freshness.closedReports": [],
  };
};

// Reports store only short one-way hashes, never the raw visitor id or IP.
const hashReporter = (value, salt = process.env.OPPORTUNITY_REPORT_SALT || "darbak-closed-report") => {
  const text = String(value || "").trim();
  if (!text) return "";
  return crypto.createHash("sha256").update(`${salt}:${text}`).digest("hex").slice(0, 24);
};

const getReportClientIp = (req = {}) => {
  const header = (name) => String(req.headers?.[name] || "").trim();
  return header("cf-connecting-ip") || header("x-forwarded-for").split(",")[0].trim() || req.ip || "";
};

// A student says this opportunity is closed. Pure decision; the route saves it.
const decideClosedReport = (
  opportunity = {},
  { visitorKey = "", ipKey = "" } = {},
  { now = new Date(), config = getFreshnessConfig() } = {}
) => {
  if (!visitorKey) return { accepted: false, reason: "MISSING_REPORTER" };
  const nowTime = now.getTime();
  const previous = opportunity.freshness || {};
  const adminKeptTime = toTime(previous.adminKeptAt);
  const keptByAdmin =
    !Number.isNaN(adminKeptTime) && nowTime - adminKeptTime < config.adminKeepDays * DAY_MS;
  // Reports older than the window, or made before an admin reopened it, no longer count.
  const recentReports = (previous.closedReports || []).filter((report) => {
    const at = toTime(report?.at);
    if (Number.isNaN(at) || nowTime - at > config.reportWindowDays * DAY_MS) return false;
    return Number.isNaN(adminKeptTime) || at > adminKeptTime;
  });

  const duplicate = recentReports.some(
    (report) => report.visitorKey === visitorKey || (ipKey && report.ipKey === ipKey)
  );
  if (duplicate) {
    return { accepted: false, reason: "ALREADY_REPORTED", reportCount: recentReports.length };
  }

  const reports = [...recentReports, { visitorKey, ipKey, at: now }].slice(-MAX_STORED_REPORTS);
  const expire = !keptByAdmin && reports.length >= config.reportsToExpire;
  const set = {
    "freshness.closedReports": reports,
    // Moves it to the front of the next link-check batch.
    "freshness.lastCheckedAt": null,
  };
  if (expire) {
    set.status = "expired";
    set["freshness.autoExpiredAt"] = now;
    set["freshness.autoExpiredReason"] = AUTO_EXPIRE_REASONS.STUDENT_REPORTS;
  }
  return { accepted: true, expire, reportCount: reports.length, set };
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
    const target = getOpportunityCheckTarget(opportunity);
    const check = target
      ? applyCheckTarget(
          await checkOpportunityLink(target.url, { transport, timeoutMs: config.timeoutMs }),
          target
        )
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
  getOpportunityCheckTarget,
  getOpportunityCheckUrl,
  applyCheckTarget,
  checkOpportunityLink,
  decideOpportunityFreshness,
  getAdminReactivationFreshness,
  hashReporter,
  getReportClientIp,
  decideClosedReport,
  runOpportunityFreshnessSweep,
};
