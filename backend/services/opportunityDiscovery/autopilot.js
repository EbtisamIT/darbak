const crypto = require("crypto");
const mongoose = require("mongoose");
const { readyForReview } = require("../opportunityApplicationPolicy");
const { buildCandidateDiff } = require("../opportunityCandidateData");
const { dayWindow } = require("./runControl");

// Opportunity autopilot: scheduled discovery, auto-publication of confident
// cooperative-training candidates, and a daily re-check of active opportunities
// against their official source. Everything uncertain stays in the inbox.

const DISCOVERY_TIMES = ["08:00", "20:00"];
const RECHECK_HOUR = 6; // Riyadh
const CLOSE_AFTER_SIGNALS = 2; // two consecutive closed/gone checks
const TICK_INTERVAL_MS = 10 * 60000;
const LEASE_MS = 20 * 60000;
const ACTION_LOG_LIMIT = 100;

// Explicit cooperative-training wording only. Generic internships, summer
// training and graduate programs are not cooperative training.
// Bare "تعاوني"/"cooperative" is avoided: it matches company names (e.g. التعاونية).
const COOP = /تدريب\s*تعاوني|التدريب\s*التعاوني|\bco-?op\b|\bco-?operative\s+(?:training|program|programme|education|internship|student)/i;
const NOT_COOP_TYPES = new Set(["internship", "summer", "graduate", "graduate_program", "student_program"]);

function isStrictCoop(candidate = {}) {
  return COOP.test(String(candidate.title || "")) ||
    (candidate.programType === "coop" && COOP.test(String(candidate.description || "")));
}

function settings(env = process.env) {
  const min = Number(env.OPPORTUNITY_AUTOPILOT_MIN_COMPLETENESS);
  return {
    forcedOff: env.OPPORTUNITY_AUTOPILOT_DISABLED === "true",
    minCompleteness: Number.isFinite(min) && min >= 0 && min <= 100 ? min : 70,
    recheckLimit: Math.min(100, Math.max(1, parseInt(env.OPPORTUNITY_AUTOPILOT_RECHECK_LIMIT, 10) || 40)),
  };
}

function riyadhParts(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`, hour: Number(parts.hour) };
}

// Latest discovery slot that has started today (Riyadh), or "" before the first.
function currentDiscoverySlot(now = new Date()) {
  const { date, time } = riyadhParts(now);
  const started = DISCOVERY_TIMES.filter((slot) => slot <= time);
  return started.length ? `${date}T${started[started.length - 1]}` : "";
}

function autoPublishDecision(candidate = {}, { now = new Date(), minCompleteness = 70 } = {}) {
  if (candidate.isDemo) return { action: "review", reason: "DEMO" };
  if (candidate.importedVia !== "official_discovery") return { action: "review", reason: "NOT_AUTOMATED_SOURCE" };
  if (!isStrictCoop(candidate)) {
    return NOT_COOP_TYPES.has(candidate.programType) || /intern|summer|صيفي|graduate|خريج/i.test(candidate.title || "")
      ? { action: "reject_not_coop", reason: "NOT_COOPERATIVE_TRAINING" }
      : { action: "review", reason: "COOP_NOT_EXPLICIT" };
  }
  if (candidate.deadline && new Date(candidate.deadline) < dayWindow(now).start) return { action: "review", reason: "DEADLINE_PASSED" };
  if (!readyForReview(candidate)) return { action: "review", reason: "NOT_VERIFIED_OFFICIAL_OPEN" };
  if (candidate.contentQualityWarning) return { action: "review", reason: "CONTENT_QUALITY_WARNING" };
  if ((candidate.completenessScore || 0) < minCompleteness) return { action: "review", reason: "LOW_COMPLETENESS" };
  if (candidate.status === "ready_for_review" && candidate.reviewStatus === "READY_FOR_REVIEW") return { action: "publish", reason: "CONFIDENT_COOP" };
  if (candidate.status === "update_existing" && candidate.existingOpportunityId) return { action: "update", reason: "SAFE_UPDATE_CHECK" };
  return { action: "review", reason: `STATUS_${String(candidate.status || "unknown").toUpperCase()}` };
}

// Only a later (extended) or newly known deadline is applied without review.
function safeUpdateFields(candidate, existing) {
  const normalized = { responsibilities: [], requirements: [], majors: [], cities: [], ...candidate };
  return buildCandidateDiff(normalized, existing).filter((item) => item.changed && item.field === "deadline" &&
    item.after && (!item.before || new Date(item.after) > new Date(item.before))).map((item) => item.field);
}

function interpretRecheck(result = {}) {
  if (result.pageAvailability === "GONE") return { outcome: "gone" };
  const rows = (result.results || []).filter((row) => row.data);
  if (result.code === "CLOSED" || result.applicationState === "CLOSED" || (rows.length && rows.every((row) => row.code === "CLOSED"))) {
    return { outcome: "closed" };
  }
  const open = rows.find((row) => row.code === "VERIFIED_FOR_REVIEW");
  if (open) return { outcome: "open", deadline: open.data.deadline || null };
  return { outcome: "inconclusive" };
}

function nextCheckState(previous = {}, outcome) {
  const signals = ["closed", "gone"].includes(outcome) ? (previous.closedSignals || 0) + 1 : outcome === "open" ? 0 : previous.closedSignals || 0;
  return { closedSignals: signals, shouldClose: signals >= CLOSE_AFTER_SIGNALS };
}

function createOpportunityAutopilot({ sanitizeOpportunityPayload, containsBlockedTerms, hydrateDarbakOpportunityFromCampaign,
  onPublish = () => {}, env = process.env, log = console } = {}) {
  const State = require("../../models/OpportunityAutopilotState");
  const Candidate = require("../../models/OpportunityCandidate");
  const Opportunity = require("../../models/Opportunity");
  const owner = crypto.randomUUID();

  const pushActions = (actions) => actions.length && State.updateOne({ _id: "autopilot" },
    { $push: { actions: { $each: actions, $position: 0, $slice: ACTION_LOG_LIMIT } } });

  async function ensureState() {
    // Starts enabled on first boot unless OPPORTUNITY_AUTOPILOT_ENABLED=false;
    // afterwards the admin switch in the Opportunity Inbox decides.
    await State.updateOne({ _id: "autopilot" }, { $setOnInsert: { enabled: env.OPPORTUNITY_AUTOPILOT_ENABLED !== "false" } }, { upsert: true }).catch((e) => { if (e.code !== 11000) throw e; });
  }

  async function acquireLease(now = new Date()) {
    const state = await State.findOneAndUpdate({ _id: "autopilot", $or: [{ "lease.until": { $lt: now } }, { "lease.until": null }] },
      { $set: { lease: { owner, until: new Date(now.getTime() + LEASE_MS) } } }, { new: true });
    return state;
  }
  const releaseLease = () => State.updateOne({ _id: "autopilot", "lease.owner": owner }, { $set: { lease: { owner: "", until: null } } });

  async function autoPublishPending({ now = new Date(), limit = 25 } = {}) {
    const { minCompleteness } = settings(env);
    const { publishCandidate } = require("../opportunityCandidates");
    const counts = { published: 0, updated: 0, rejectedNotCoop: 0, sentToReview: 0, failed: 0 }, actions = [];
    const rows = await Candidate.find({ isDemo: { $ne: true }, importedVia: "official_discovery",
      status: { $in: ["ready_for_review", "update_existing", "needs_verification", "new", "ready", "needs_review"] },
      $or: [{ "autopilot.decidedAt": { $exists: false } }, { $expr: { $gt: ["$updatedAt", "$autopilot.decidedAt"] } }] })
      .sort({ discoveredAt: 1 }).limit(limit).lean();
    for (const candidate of rows) {
      let { action, reason } = autoPublishDecision(candidate, { now, minCompleteness });
      const entry = { candidateId: candidate._id, title: candidate.title, company: candidate.company };
      try {
        if (action === "publish") {
          const row = await publishCandidate(candidate._id, { mode: "publish", sanitizeOpportunityPayload, containsBlockedTerms, hydrateDarbakOpportunityFromCampaign });
          await Opportunity.updateOne({ _id: row.publishedOpportunityId }, { $set: { automationCheck: { autoPublished: true, lastCheckedAt: now, lastResult: "open", closedSignals: 0 } } });
          counts.published++; actions.push({ ...entry, at: now, type: "auto_published", opportunityId: row.publishedOpportunityId, reason });
        } else if (action === "update") {
          const existing = await Opportunity.findById(candidate.existingOpportunityId).lean();
          const fields = existing && !existing.isDarbakApplication ? safeUpdateFields(candidate, existing) : [];
          if (!fields.length) { action = "review"; reason = "UPDATE_NEEDS_REVIEW"; }
          else {
            await publishCandidate(candidate._id, { mode: "update", fields, expectedUpdatedAt: existing.updatedAt,
              sanitizeOpportunityPayload, containsBlockedTerms, hydrateDarbakOpportunityFromCampaign });
            counts.updated++; actions.push({ ...entry, at: now, type: "auto_updated", opportunityId: existing._id, reason: "DEADLINE_EXTENDED" });
          }
        } else if (action === "reject_not_coop") {
          await Candidate.updateOne({ _id: candidate._id, status: { $ne: "published" } }, { $set: { status: "rejected" } });
          counts.rejectedNotCoop++; actions.push({ ...entry, at: now, type: "rejected_not_coop", reason });
        }
        if (action === "review") counts.sentToReview++;
      } catch (error) {
        action = "review"; reason = `PUBLISH_FAILED: ${String(error.message || error).slice(0, 160)}`;
        counts.failed++; actions.push({ ...entry, at: now, type: "publish_failed", reason });
      }
      await Candidate.updateOne({ _id: candidate._id }, { $set: { autopilot: { decidedAt: new Date(), decision: action, reason } } }, { timestamps: false });
    }
    if (counts.published || counts.updated) onPublish();
    await pushActions(actions);
    return counts;
  }

  async function recheckPublishedOpportunities({ now = new Date(), limit = settings(env).recheckLimit, check, sources, maxMs = 8 * 60000 } = {}) {
    const { classifyUrl } = require("./searchDiscovery");
    sources ||= await require("./management").registrySources({ activeOnly: true });
    check ||= async (source, url) => {
      const { testOpportunityUrl } = require("./stages");
      const { createReader } = require("./http");
      return testOpportunityUrl(source, url, { reader: createReader(source), enrichment: true, now,
        browserRenderer: env.DISCOVERY_BROWSER_EXECUTABLE ? require("./browser").renderPage : undefined });
    };
    const counts = { checked: 0, stillOpen: 0, closed: 0, deadlineExtended: 0, unverifiable: 0, inconclusive: 0 }, actions = [];
    const started = Date.now();
    const rows = await Opportunity.find({ status: "active", isDarbakApplication: { $ne: true }, "automationCheck.ignore": { $ne: true },
      $or: [{ sourceUrl: { $nin: ["", null] } }, { applicationUrl: { $nin: ["", null] } }] })
      .select("title organizationName sourceUrl applicationUrl deadline automationCheck")
      .sort({ "automationCheck.lastCheckedAt": 1, createdAt: 1 }).limit(limit).lean();
    for (const row of rows) {
      if (Date.now() - started > maxMs) break;
      const url = [row.sourceUrl, row.applicationUrl].find((value) => value && classifyUrl(value, sources).sourceKey);
      const source = url && sources.find((item) => item.key === classifyUrl(url, sources).sourceKey);
      const previous = row.automationCheck || {};
      if (!source) {
        counts.unverifiable++;
        await Opportunity.updateOne({ _id: row._id }, { $set: { "automationCheck.lastCheckedAt": now, "automationCheck.lastResult": "unverifiable" } }, { timestamps: false });
        continue;
      }
      counts.checked++;
      let interpreted;
      try { interpreted = interpretRecheck(await check(source, url)); } catch { interpreted = { outcome: "inconclusive" }; }
      const { closedSignals, shouldClose } = nextCheckState(previous, interpreted.outcome);
      const update = { "automationCheck.lastCheckedAt": now, "automationCheck.lastResult": interpreted.outcome, "automationCheck.closedSignals": closedSignals };
      if (shouldClose) {
        const reason = interpreted.outcome === "gone" ? "SOURCE_PAGE_REMOVED" : "SOURCE_SAYS_CLOSED";
        await Opportunity.updateOne({ _id: row._id, status: "active" }, { $set: { ...update, status: "expired",
          "automationCheck.closedAt": now, "automationCheck.closedReason": reason } });
        counts.closed++; actions.push({ at: now, type: "auto_closed", opportunityId: row._id, title: row.title, company: row.organizationName, reason });
        continue;
      }
      if (interpreted.outcome === "open") {
        counts.stillOpen++;
        const next = interpreted.deadline ? new Date(interpreted.deadline) : null;
        if (next && Number.isFinite(next.getTime()) && row.deadline && next > new Date(row.deadline)) {
          update.deadline = next; counts.deadlineExtended++;
          actions.push({ at: now, type: "auto_updated", opportunityId: row._id, title: row.title, company: row.organizationName, reason: "DEADLINE_EXTENDED" });
        }
      } else if (interpreted.outcome === "inconclusive") counts.inconclusive++;
      await Opportunity.updateOne({ _id: row._id }, { $set: update }, { timestamps: Boolean(update.deadline) });
    }
    if (counts.closed || counts.deadlineExtended) onPublish();
    await pushActions(actions);
    return counts;
  }

  async function tick({ now = new Date(), forceRecheck = false, startDiscovery } = {}) {
    if (mongoose.connection.readyState !== 1) return { skipped: "DATABASE_NOT_CONNECTED" };
    if (settings(env).forcedOff) return { skipped: "DISABLED_BY_ENV" };
    await ensureState();
    const state = await State.findById("autopilot").lean();
    if (!state?.enabled) return { skipped: "DISABLED" };
    if (!await acquireLease(now)) return { skipped: "BUSY" };
    const report = {};
    try {
      const slot = currentDiscoverySlot(now);
      if (slot && slot !== state.lastDiscoverySlot) {
        await State.updateOne({ _id: "autopilot" }, { $set: { lastDiscoverySlot: slot } });
        try {
          const run = await (startDiscovery || require("./service").startDiscovery)({ mode: "automation" });
          report.discovery = { slot, runId: String(run._id) };
        } catch (error) { report.discovery = { slot, error: String(error.message || error).slice(0, 200) }; }
        await State.updateOne({ _id: "autopilot" }, { $set: { lastDiscovery: { at: now, ...report.discovery } } });
      }
      report.autoPublish = await autoPublishPending({ now });
      await State.updateOne({ _id: "autopilot" }, { $set: { lastAutoPublish: { at: now, ...report.autoPublish } } });
      const { date, hour } = riyadhParts(now);
      if (forceRecheck || (hour >= RECHECK_HOUR && state.lastRecheckDay !== date)) {
        await State.updateOne({ _id: "autopilot" }, { $set: { lastRecheckDay: date } });
        report.recheck = await recheckPublishedOpportunities({ now });
        await State.updateOne({ _id: "autopilot" }, { $set: { lastRecheck: { at: now, ...report.recheck } } });
      }
      return report;
    } finally {
      await State.updateOne({ _id: "autopilot" }, { $set: { lastTickAt: now } });
      await releaseLease();
    }
  }

  const safeTick = (options) => tick(options).catch((error) => { log.error("Opportunity autopilot tick failed:", error.message); return { error: "TICK_FAILED" }; });

  function start() {
    const first = setTimeout(safeTick, 60000); first.unref?.();
    const timer = setInterval(safeTick, TICK_INTERVAL_MS); timer.unref?.();
    return () => { clearTimeout(first); clearInterval(timer); };
  }

  async function status() {
    await ensureState();
    const [state, autoPublished, autoClosed, activeWithSource, inReview] = await Promise.all([
      State.findById("autopilot").select("-lease").lean(),
      Opportunity.countDocuments({ "automationCheck.autoPublished": true }),
      Opportunity.countDocuments({ "automationCheck.closedAt": { $ne: null }, status: "expired" }),
      Opportunity.countDocuments({ status: "active", $or: [{ sourceUrl: { $nin: ["", null] } }, { applicationUrl: { $nin: ["", null] } }] }),
      Candidate.countDocuments({ isDemo: { $ne: true }, "autopilot.decision": "review", status: { $nin: ["published", "rejected", "duplicate", "expired"] } }),
    ]);
    const config = settings(env);
    return { ...state, forcedOff: config.forcedOff, minCompleteness: config.minCompleteness,
      schedule: { timezone: "Asia/Riyadh", discoveryTimes: DISCOVERY_TIMES, recheckHour: `${String(RECHECK_HOUR).padStart(2, "0")}:00`, closeAfterSignals: CLOSE_AFTER_SIGNALS },
      cronConfigured: Boolean(env.OPPORTUNITY_AUTOPILOT_CRON_SECRET || env.TELEGRAM_CRON_SECRET),
      totals: { autoPublished, autoClosed, activeWithSource, inReview } };
  }

  async function setEnabled(enabled) {
    if (typeof enabled !== "boolean") { const e = new Error("حددي تشغيل الأتمتة أو إيقافها."); e.status = 400; throw e; }
    await ensureState();
    await State.updateOne({ _id: "autopilot" }, { $set: { enabled } });
    return status();
  }

  async function reopen(opportunityId, { now = new Date() } = {}) {
    const row = await Opportunity.findOneAndUpdate({ _id: opportunityId, status: "expired", "automationCheck.closedAt": { $ne: null } },
      { $set: { status: "active", "automationCheck.ignore": true, "automationCheck.closedSignals": 0 }, $unset: { "automationCheck.closedAt": 1, "automationCheck.closedReason": 1 } },
      { new: true }).lean();
    if (!row) { const e = new Error("لا توجد فرصة أغلقتها الأتمتة بهذا المعرف."); e.status = 404; throw e; }
    onPublish();
    await pushActions([{ at: now, type: "reopened", opportunityId: row._id, title: row.title, company: row.organizationName, reason: "ADMIN_REOPENED" }]);
    return row;
  }

  return { tick: safeTick, start, status, setEnabled, reopen, autoPublishPending, recheckPublishedOpportunities };
}

module.exports = { createOpportunityAutopilot, autoPublishDecision, isStrictCoop, interpretRecheck, nextCheckState,
  currentDiscoverySlot, riyadhParts, safeUpdateFields, CLOSE_AFTER_SIGNALS };
